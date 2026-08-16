import { linspace, mulberry32, randn } from "./math";
import type { PadField, Station, Typewell, Well } from "./types";

function typewellBook(rng: () => number): Typewell {
  const tvt = linspace(40, 230, 380);
  const gr = tvt.map((t) => {
    const shale = 0.5 + 0.5 * Math.sin(t / 11.5);
    const cycle = 28 * Math.sin(t / 7.2) + 14 * Math.sin(t / 3.4 + 0.6);
    const spike = Math.exp(-((t - 96) ** 2) / 18) * 38 + Math.exp(-((t - 162) ** 2) / 22) * 30;
    return 48 + 46 * shale + cycle + spike + rng() * 1.4;
  });
  return { tvt, gr };
}

function bookGr(tw: Typewell, t: number) {
  const x = tw.tvt;
  const y = tw.gr;
  if (t <= x[0]!) return y[0]!;
  if (t >= x[x.length - 1]!) return y[y.length - 1]!;
  let lo = 0;
  let hi = x.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (x[mid]! <= t) lo = mid;
    else hi = mid;
  }
  const u = (t - x[lo]!) / Math.max(x[hi]! - x[lo]!, 1e-9);
  return y[lo]! + u * (y[hi]! - y[lo]!);
}

export function synthesizePad(seed = 7): PadField {
  const rng = mulberry32(seed);
  const tw = typewellBook(rng);
  const wells: Well[] = [];
  const specs = [
    { id: "H-01A", azi: 12, len: 4200, walk: 0.004 },
    { id: "H-01B", azi: 28, len: 3900, walk: -0.003 },
    { id: "H-02A", azi: 44, len: 4500, walk: 0.006 },
    { id: "H-02B", azi: 58, len: 3700, walk: -0.005 },
    { id: "H-03A", azi: 74, len: 4100, walk: 0.002 },
    { id: "H-03B", azi: 88, len: 4000, walk: -0.004 },
  ];

  const t0 = 118;
  const dipX = 0.0016;
  const dipY = -0.0011;

  for (let w = 0; w < specs.length; w++) {
    const spec = specs[w]!;
    const n = 260;
    const build = Math.floor(n * 0.28);
    const ps = Math.floor(n * 0.62);
    const az = (spec.azi * Math.PI) / 180;
    const padX = 1200 + w * 180;
    const padY = 3400 + (w % 2) * 90;
    const stations: Station[] = [];
    let tvt = t0 + dipX * padX + dipY * padY + randn(rng) * 1.2;

    for (let i = 0; i < n; i++) {
      const md = i * (spec.len / (n - 1));
      const inBuild = i < build;
      const frac = inBuild ? i / Math.max(build, 1) : 1;
      const inc = inBuild ? frac * 90 : 90 + Math.sin(i / 18) * 0.8;
      const ds = spec.len / (n - 1);
      const horiz = ds * Math.sin((inc * Math.PI) / 180);
      const dz = -ds * Math.cos((inc * Math.PI) / 180);
      const x = padX + (i < build ? 0 : (i - build) * horiz * Math.cos(az) * 0.22);
      const y = padY + (i < build ? i * 4 : build * 4 + (i - build) * horiz * Math.sin(az) * 0.22);
      const z =
        (i === 0 ? -40 : stations[i - 1]!.z + dz) + randn(rng) * 0.15;

      if (i > 0) {
        tvt += spec.walk * (md - stations[i - 1]!.md);
        tvt += dipX * (x - stations[i - 1]!.x) + dipY * (y - stations[i - 1]!.y);
        tvt += randn(rng) * 0.045;
      }
      const tvtTrue = tvt;
      const gr = bookGr(tw, tvtTrue) + randn(rng) * 3.1;
      const lith = (gr - 40) / 80;
      const extra = {
        RES: Math.exp(2.4 - 1.8 * lith + randn(rng) * 0.08),
        NPHI: clamp01(0.08 + 0.22 * lith + randn(rng) * 0.012),
        RHOB: 2.68 - 0.28 * lith + randn(rng) * 0.015,
        CALI: 8.5 + Math.abs(randn(rng)) * 0.12,
        DT: 58 + 28 * lith + randn(rng) * 1.2,
        PE: 4.8 - 1.4 * lith + randn(rng) * 0.08,
      };
      const known = i < ps;
      stations.push({
        md,
        x,
        y,
        z,
        gr,
        tvt: known ? tvtTrue : null,
        tvtInput: known ? tvtTrue : null,
        isPredict: !known,
        tvtTrue,
        extra,
      });
    }

    wells.push({
      id: spec.id,
      name: spec.id,
      padId: "eagle-01",
      stations,
      typewell: tw,
      sourceFormat: "synthetic-pad",
      channels: ["MD", "X", "Y", "Z", "GR", "TVT", "TVT_input", "RES", "NPHI", "RHOB", "CALI", "DT", "PE"],
    });
  }

  return { id: "eagle-01", name: "Eagle pad 01", wells, typewell: tw };
}

function clamp01(v: number) {
  return Math.max(0.01, Math.min(0.45, v));
}

export function sampleIngestText(well: Well) {
  const extra = ["RES", "NPHI", "RHOB"];
  const lines = [`data[MD, X, Y, Z, GR, TVT, TVT_input, ${extra.join(", ")}]`];
  for (const s of well.stations) {
    const tvt = s.isPredict ? "" : (s.tvt ?? "");
    const tin = s.isPredict ? "" : (s.tvtInput ?? "");
    lines.push(
      [
        s.md.toFixed(2),
        s.x.toFixed(2),
        s.y.toFixed(2),
        s.z.toFixed(2),
        Number.isFinite(s.gr) ? s.gr.toFixed(2) : "",
        tvt === "" ? "" : Number(tvt).toFixed(3),
        tin === "" ? "" : Number(tin).toFixed(3),
        ...extra.map((k) =>
          Number.isFinite(s.extra[k]!) ? s.extra[k]!.toFixed(3) : "",
        ),
      ].join(", "),
    );
  }
  return lines.join("\n");
}
