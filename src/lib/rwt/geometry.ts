import { clamp, cross3, dot3, mean, norm3, std, unit3 } from "./math";
import type { GeometryFeatures, Well } from "./types";

function rotBetween(
  u0: [number, number, number],
  v0: [number, number, number],
): number[][] {
  const u = unit3(u0);
  const v = unit3(v0);
  const c = clamp(dot3(u, v), -1, 1);
  const ax0 = cross3(u, v);
  const s = norm3(ax0);
  if (s < 1e-12) {
    if (c > 0) return ident();
    const helper: [number, number, number] =
      Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const ax = unit3(cross3(u, helper));
    return [
      [2 * ax[0] * ax[0] - 1, 2 * ax[0] * ax[1], 2 * ax[0] * ax[2]],
      [2 * ax[1] * ax[0], 2 * ax[1] * ax[1] - 1, 2 * ax[1] * ax[2]],
      [2 * ax[2] * ax[0], 2 * ax[2] * ax[1], 2 * ax[2] * ax[2] - 1],
    ];
  }
  const ax: [number, number, number] = [ax0[0] / s, ax0[1] / s, ax0[2] / s];
  const th = Math.atan2(s, c);
  const K = [
    [0, -ax[2], ax[1]],
    [ax[2], 0, -ax[0]],
    [-ax[1], ax[0], 0],
  ];
  const K2 = matmul(K, K);
  const I = ident();
  const out = ident();
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i]![j] = I[i]![j]! + Math.sin(th) * K[i]![j]! + (1 - Math.cos(th)) * K2[i]![j]!;
    }
  }
  return out;
}

function ident() {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}

function matmul(A: number[][], B: number[][]) {
  const n = A.length;
  const out = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      for (let j = 0; j < n; j++) out[i]![j] += A[i]![k]! * B[k]![j]!;
    }
  }
  return out;
}

function tangents(well: Well) {
  const s = well.stations;
  const T: [number, number, number][] = [];
  for (let i = 0; i < s.length - 1; i++) {
    const d: [number, number, number] = [
      s[i + 1]!.x - s[i]!.x,
      s[i + 1]!.y - s[i]!.y,
      s[i + 1]!.z - s[i]!.z,
    ];
    T.push(unit3(d));
  }
  return T;
}

function curvature(T: [number, number, number][]) {
  const out: number[] = [];
  for (let i = 0; i < T.length - 1; i++) {
    out.push(Math.acos(clamp(dot3(T[i]!, T[i + 1]!), -1, 1)));
  }
  return out;
}

function torsion(T: [number, number, number][]) {
  const B: [number, number, number][] = [];
  for (let i = 0; i < T.length - 1; i++) {
    const t0 = T[i]!;
    const t1 = T[i + 1]!;
    let dn: [number, number, number] = [t1[0] - t0[0], t1[1] - t0[1], t1[2] - t0[2]];
    const proj = dot3(dn, t0);
    dn = [dn[0] - proj * t0[0], dn[1] - proj * t0[1], dn[2] - proj * t0[2]];
    let n: [number, number, number];
    if (norm3(dn) < 1e-12) {
      const helper: [number, number, number] =
        Math.abs(t0[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
      n = unit3(cross3(t0, helper));
    } else n = unit3(dn);
    B.push(unit3(cross3(t0, n)));
  }
  const out: number[] = [];
  for (let i = 0; i < B.length - 1; i++) {
    const t = T[Math.min(i + 1, T.length - 1)]!;
    const b0p = unit3(projPerp(B[i]!, t));
    const b1p = unit3(projPerp(B[i + 1]!, t));
    if (norm3(b0p) < 1e-9 || norm3(b1p) < 1e-9) {
      out.push(0);
      continue;
    }
    const c = clamp(dot3(b0p, b1p), -1, 1);
    const s = dot3(cross3(b0p, b1p), t);
    out.push(Math.atan2(s, c));
  }
  return out;
}

function projPerp(v: [number, number, number], t: [number, number, number]): [number, number, number] {
  const p = dot3(v, t);
  return [v[0] - p * t[0], v[1] - p * t[1], v[2] - p * t[2]];
}

function so3Angle(R: number[][]) {
  const tr = R[0]![0]! + R[1]![1]! + R[2]![2]!;
  return Math.acos(clamp((tr - 1) * 0.5, -1, 1));
}

export function computeGeometry(well: Well): GeometryFeatures {
  const s = well.stations;
  const n = s.length;
  const empty = {
    nStations: n,
    mdSpan: n > 1 ? s[n - 1]!.md - s[0]!.md : 0,
    deltaZ: n > 1 ? s[n - 1]!.z - s[0]!.z : 0,
    pathLength: 0,
    meanCurv: 0,
    maxCurv: 0,
    cumTwist: 0,
    absCumTwist: 0,
    twistStd: 0,
    meanAbsTorsion: 0,
    meanERef: 0,
    maxERef: 0,
    tortuosity: 0,
    signedAzimuth: 0,
    azimuthDeg: 0,
    dipDeg: 0,
    localCurv: Array(n).fill(0),
    localTorsion: Array(n).fill(0),
    eRef: Array(n).fill(0),
  };
  if (n < 3) return empty;

  const Traw = tangents(well);
  const T = Traw.map((t, i) => {
    if (i === 0 || i === Traw.length - 1) return t;
    const a = Traw[i - 1]!;
    const b = Traw[i + 1]!;
    return unit3([t[0] * 2 + a[0] + b[0], t[1] * 2 + a[1] + b[1], t[2] * 2 + a[2] + b[2]]);
  });
  const curv = curvature(T);
  const tors = torsion(T);
  let path = 0;
  const segs: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const d = Math.hypot(
      s[i + 1]!.x - s[i]!.x,
      s[i + 1]!.y - s[i]!.y,
      s[i + 1]!.z - s[i]!.z,
    );
    segs.push(d);
    path += d;
  }
  const chord = Math.hypot(
    s[n - 1]!.x - s[0]!.x,
    s[n - 1]!.y - s[0]!.y,
    s[n - 1]!.z - s[0]!.z,
  );
  const scale = Math.max(medianOf(segs), 1e-3);
  const eRef = Array(n).fill(0) as number[];
  for (let i = 0; i < T.length; i++) {
    const j = Math.min(i + 1, T.length - 1);
    const R = i === j ? ident() : rotBetween(T[i]!, T[j]!);
    const tvec: [number, number, number] = [
      s[Math.min(i + 1, n - 1)]!.x - s[i]!.x,
      s[Math.min(i + 1, n - 1)]!.y - s[i]!.y,
      s[Math.min(i + 1, n - 1)]!.z - s[i]!.z,
    ];
    const th = so3Angle(R);
    eRef[Math.min(i + 1, n - 1)] = Math.hypot(th, norm3(tvec) / scale);
  }
  eRef[0] = eRef[1] ?? 0;

  const localCurv = Array(n).fill(0) as number[];
  const localTorsion = Array(n).fill(0) as number[];
  if (curv.length) {
    for (let i = 0; i < curv.length; i++) localCurv[i + 1] = curv[i]!;
    localCurv[0] = localCurv[1] ?? 0;
    localCurv[n - 1] = localCurv[n - 2] ?? 0;
  }
  if (tors.length) {
    for (let i = 0; i < tors.length; i++) localTorsion[i + 2] = tors[i]!;
    localTorsion[0] = localTorsion[2] ?? 0;
    localTorsion[1] = localTorsion[2] ?? 0;
  }

  const cut = Math.max(1, Math.floor(0.4 * (n - 1)));
  let ax = 0;
  let ay = 0;
  let az = 0;
  let ah = 0;
  let c = 0;
  for (let i = cut; i < n - 1; i++) {
    ax += s[i + 1]!.x - s[i]!.x;
    ay += s[i + 1]!.y - s[i]!.y;
    az += s[i + 1]!.z - s[i]!.z;
    ah += Math.hypot(s[i + 1]!.x - s[i]!.x, s[i + 1]!.y - s[i]!.y);
    c++;
  }
  const azimuthDeg =
    (Math.atan2(ay / Math.max(c, 1), ax / Math.max(c, 1) + 1e-15) * 180) / Math.PI;
  const dipDeg =
    (Math.atan2(az / Math.max(c, 1), ah / Math.max(c, 1) + 1e-15) * 180) / Math.PI;

  let hx = 0;
  let hy = 0;
  for (const t of T) {
    const hn = Math.hypot(t[0], t[1]);
    if (hn > 1e-8) {
      hx += t[0] / hn;
      hy += t[1] / hn;
    }
  }
  hx /= Math.max(T.length, 1);
  hy /= Math.max(T.length, 1);

  return {
    nStations: n,
    mdSpan: s[n - 1]!.md - s[0]!.md,
    deltaZ: s[n - 1]!.z - s[0]!.z,
    pathLength: path,
    meanCurv: mean(curv),
    maxCurv: curv.length ? Math.max(...curv) : 0,
    cumTwist: tors.reduce((a, b) => a + b, 0),
    absCumTwist: tors.reduce((a, b) => a + Math.abs(b), 0),
    twistStd: std(tors),
    meanAbsTorsion: mean(tors.map(Math.abs)),
    meanERef: mean(eRef),
    maxERef: Math.max(...eRef),
    tortuosity: path / Math.max(chord, 1e-6) - 1,
    signedAzimuth: Math.atan2(hy, hx + 1e-15),
    azimuthDeg,
    dipDeg,
    localCurv,
    localTorsion,
    eRef,
  };
}

function medianOf(a: number[]) {
  const f = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!f.length) return 1;
  return f[Math.floor(f.length / 2)]!;
}
