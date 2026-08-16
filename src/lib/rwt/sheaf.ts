import { clamp, entropy, jacobiEigen, mean } from "./math";
import type {
  GeometryFeatures,
  PriorBundle,
  ProbabilityFrame,
  SheafReport,
  SmithPoint,
  Well,
} from "./types";

function rot2(th: number, k: number) {
  const s = Math.sqrt(Math.max(k, 1e-6));
  const c = Math.cos(th);
  const si = Math.sin(th);
  return [
    [s * c, -s * si],
    [s * si, s * c],
  ];
}

export function smithFromZ(zr: number, zi: number): SmithPoint {
  const den = (zr + 1) ** 2 + zi * zi;
  const re = ((zr - 1) * (zr + 1) + zi * zi) / Math.max(den, 1e-9);
  const im = (2 * zi) / Math.max(den, 1e-9);
  const mag = Math.min(0.999, Math.hypot(re, im));
  const arg = Math.atan2(im, re);
  const hyp = 2 * Math.atanh(mag);
  const amp = 2 / Math.max((1 - re) ** 2 + im * im, 1e-9);
  return { re, im, mag, arg, hyp, amp };
}

export function wrapDelta(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function computeSmithPath(well: Well, priors: PriorBundle): SmithPoint[] {
  return well.stations.map((s, i) => {
    const mm = Number.isFinite(priors.grMismatch[i]!) ? priors.grMismatch[i]! / 40 : 0;
    const dmd = i > 0 ? s.md - well.stations[i - 1]!.md : 1;
    const dt =
      i > 0 && Number.isFinite(priors.priorBest[i]!) && Number.isFinite(priors.priorBest[i - 1]!)
        ? (priors.priorBest[i]! - priors.priorBest[i - 1]!) / Math.max(dmd, 1e-3)
        : 0;
    return smithFromZ(1 + mm, dt / 0.008);
  });
}

export function computeSheaf(
  well: Well,
  geom: GeometryFeatures,
  priors: PriorBundle,
): SheafReport {
  const n0 = well.stations.length;
  const step = Math.max(1, Math.floor(n0 / 28));
  const idx: number[] = [];
  for (let i = 0; i < n0; i += step) idx.push(i);
  if (idx[idx.length - 1] !== n0 - 1) idx.push(n0 - 1);
  const m = idx.length;
  const dim = 2;
  const nv = m * dim;
  const delta: number[][] = [];
  const hol = geom.cumTwist;

  for (let e = 0; e < m - 1; e++) {
    const i = idx[e]!;
    const j = idx[e + 1]!;
    const closing = e === m - 2;
    const th = (geom.localTorsion[j] ?? 0) + (closing ? hol * 0.25 : 0);
    const k = 0.35 + 1.4 * (priors.grAgree[j] ?? 0.3);
    const Ru = rot2(0, k);
    const Rv = rot2(th, k);
    const row0 = Array(nv).fill(0);
    const row1 = Array(nv).fill(0);
    row0[e * 2] = Ru[0]![0]!;
    row0[e * 2 + 1] = Ru[0]![1]!;
    row0[(e + 1) * 2] = -Rv[0]![0]!;
    row0[(e + 1) * 2 + 1] = -Rv[0]![1]!;
    row1[e * 2] = Ru[1]![0]!;
    row1[e * 2 + 1] = Ru[1]![1]!;
    row1[(e + 1) * 2] = -Rv[1]![0]!;
    row1[(e + 1) * 2 + 1] = -Rv[1]![1]!;
    delta.push(row0, row1);
  }

  const L = Array.from({ length: nv }, () => Array(nv).fill(0) as number[]);
  for (const row of delta) {
    for (let i = 0; i < nv; i++) {
      for (let j = 0; j < nv; j++) {
        L[i]![j] += row[i]! * row[j]!;
      }
    }
  }

  const { values } = jacobiEigen(L, 36);
  const kernelDim = values.filter((v) => v < 1e-4).length;
  const frustration = mean(values.slice(0, 6).map(Math.abs));
  const algebraicConnectivity = values.find((v) => v > 1e-4) ?? 0;
  const lamMax = values[values.length - 1] ?? 1;
  const nearKernel = values.filter((v) => v <= 1e-3 * Math.max(Math.abs(lamMax), 1)).length;
  const condition = Math.abs(lamMax) / Math.max(algebraicConnectivity, 1e-12);

  const smithPath = computeSmithPath(well, priors);
  let winding = 0;
  for (let i = 1; i < smithPath.length; i++) {
    winding += wrapDelta(smithPath[i - 1]!.arg, smithPath[i]!.arg);
  }
  winding /= 2 * Math.PI;

  const recoverability = well.stations.map((_, i) => {
    const rec = clamp(priors.adaptiveConf[i] ?? 0, 0, 1);
    return rec * (1 - smithPath[i]!.mag);
  });
  const decoupling = smithPath.map((p, i) =>
    clamp(0.42 * p.mag + 0.28 * (1 - recoverability[i]!) + 0.3 * clamp(p.hyp / 3, 0, 1), 0, 1),
  );

  let horizonOnset: number | null = null;
  for (let i = 0; i < smithPath.length; i++) {
    if (
      well.stations[i]!.isPredict &&
      smithPath[i]!.mag > 0.65 &&
      decoupling[i]! > 0.62 &&
      recoverability[i]! < 0.38
    ) {
      horizonOnset = i;
      break;
    }
  }

  return {
    eigenvalues: values.slice(0, 10),
    kernelDim,
    frustration,
    holonomy: hol,
    algebraicConnectivity,
    smithPath,
    horizonOnset,
    winding,
    nearKernel,
    condition,
    recoverability,
    decoupling,
  };
}

export function encodeProbability(
  well: Well,
  priors: PriorBundle,
  served: number[],
  sheaf?: SheafReport,
): ProbabilityFrame[] {
  const last = priors.lastKnown;
  const bins = Array.from({ length: 21 }, (_, i) => last - 18 + i * 1.8);
  return well.stations.map((_, i) => {
    const mu = served[i] ?? priors.priorBest[i] ?? last;
    const sig = Math.max(priors.pfStd[i] ?? 4, 1.2);
    const mass = bins.map((b) => Math.exp(-0.5 * ((b - mu) / sig) ** 2));
    const z = mass.reduce((s, v) => s + v, 0) || 1;
    const p = mass.map((v) => v / z);
    const meanV = p.reduce((s, v, k) => s + v * bins[k]!, 0);
    const varr = p.reduce((s, v, k) => s + v * (bins[k]! - meanV) ** 2, 0);
    const mode = bins[p.indexOf(Math.max(...p))] ?? mu;
    const h = entropy(p);
    const hMax = Math.log(bins.length);
    const mag = sheaf?.smithPath[i]?.mag ?? 0;
    const horizonScore = clamp(
      0.32 * (1 - (priors.adaptiveConf[i] ?? 0)) +
        0.24 * (h / hMax) +
        0.16 * Math.min(1, Math.sqrt(varr) / 10) +
        0.28 * mag,
      0,
      1,
    );
    return {
      bins,
      mass: p,
      mode,
      mean: meanV,
      std: Math.sqrt(varr),
      entropy: h,
      horizon: horizonScore > 0.62 && well.stations[i]!.isPredict,
      horizonScore,
    };
  });
}
