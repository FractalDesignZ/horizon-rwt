import { clamp, interp, mulberry32, randn } from "./math";
import { MAX_TVT_DEV, type Typewell, type Well } from "./types";

export interface PfOut {
  priorPf: number[];
  pfConf: number[];
  pfStd: number[];
  particlesAt: number[][];
}

export function particleFilter(
  well: Well,
  seed: number,
  opts?: {
    nParticles?: number;
    processSigma?: number;
    grSigma?: number;
    tvtSpan?: number;
    rngSeed?: number;
    aCal?: number;
    bCal?: number;
  },
): PfOut {
  const nP = opts?.nParticles ?? 140;
  const proc0 = opts?.processSigma ?? 0.22;
  const grSig = opts?.grSigma ?? 18;
  const span = opts?.tvtSpan ?? 55;
  const rng = mulberry32(opts?.rngSeed ?? 11);
  const aCal = opts?.aCal ?? 1;
  const bCal = opts?.bCal ?? 0;
  const n = well.stations.length;
  const tw = well.typewell;
  const tMin = tw.tvt[0]!;
  const tMax = tw.tvt[tw.tvt.length - 1]!;
  const known = well.stations.map((s) => s.tvtInput ?? s.tvt);

  let bias = 0;
  const kIdx: number[] = [];
  for (let i = 0; i < n; i++) if (known[i] != null && Number.isFinite(known[i]!)) kIdx.push(i);
  const heel = kIdx.slice(-80);
  const steps: number[] = [];
  for (let i = 1; i < heel.length; i++) {
    if (heel[i] === heel[i - 1]! + 1) {
      steps.push(known[heel[i]!]! - known[heel[i - 1]!]!);
    }
  }
  if (steps.length) {
    const mid = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)]!;
    bias = clamp(mid, -0.05, 0.05);
  }

  const lo0 = Math.max(tMin, seed - span);
  const hi0 = Math.min(tMax, seed + span);
  let particles = Array.from({ length: nP }, () => lo0 + rng() * (hi0 - lo0));
  let weights = Array(nP).fill(1 / nP) as number[];

  const prior = Array(n).fill(seed) as number[];
  const conf = Array(n).fill(0) as number[];
  const stds = Array(n).fill(0) as number[];
  const snap: number[][] = [];
  let prevObs = NaN;

  const grAt = (t: number) => aCal * interp(t, tw.tvt, tw.gr) + bCal;

  for (let i = 0; i < n; i++) {
    const k = known[i];
    if (k != null && Number.isFinite(k)) {
      particles = particles.map(() => k + randn(rng) * proc0);
      particles = particles.map((p) => clamp(p, tMin, tMax));
      weights = Array(nP).fill(1 / nP);
      prior[i] = k;
      conf[i] = 1;
      stds[i] = proc0;
      if (Number.isFinite(well.stations[i]!.gr)) prevObs = well.stations[i]!.gr;
      snap.push(particles.slice(0, 48));
      continue;
    }

    const obs = well.stations[i]!.gr;
    const dmd = i > 0 ? Math.abs(well.stations[i]!.md - well.stations[i - 1]!.md) : 15;
    let sig = proc0 * Math.sqrt(Math.max(dmd, 0.5) / 15);
    if (!Number.isFinite(obs)) sig *= 1.75;
    if (i > 0 && Number.isFinite(stds[i - 1]!)) {
      sig *= clamp(1 + 0.15 * (stds[i - 1]! / 5), 1, 1.8);
    }
    particles = particles.map((p) => clamp(p + bias + randn(rng) * sig, tMin, tMax));

    if (Number.isFinite(obs)) {
      const like = particles.map((p) => {
        const hyp = grAt(p);
        return Math.exp(-0.5 * ((obs - hyp) / grSig) ** 2);
      });
      let s = 0;
      for (let j = 0; j < nP; j++) {
        weights[j] = weights[j]! * like[j]!;
        s += weights[j]!;
      }
      if (s < 1e-30) weights = Array(nP).fill(1 / nP);
      else weights = weights.map((w) => w / s);
      prevObs = obs;
    }
    void prevObs;

    let essInv = 0;
    let mu = 0;
    for (let j = 0; j < nP; j++) {
      mu += weights[j]! * particles[j]!;
      essInv += weights[j]! * weights[j]!;
    }
    const ess = 1 / (essInv + 1e-15);
    let v = 0;
    for (let j = 0; j < nP; j++) v += weights[j]! * (particles[j]! - mu) ** 2;
    prior[i] = mu;
    stds[i] = Math.sqrt(v + 1e-12);
    let cr = (ess / nP) * (1 / (1 + stds[i]! / 5));
    if (!Number.isFinite(obs)) cr *= 0.35;
    conf[i] = clamp(cr, 0, 1);

    if (ess < 0.45 * nP) {
      const cdf: number[] = [];
      let acc = 0;
      for (const w of weights) {
        acc += w;
        cdf.push(acc);
      }
      const u0 = rng() / nP;
      const next: number[] = [];
      let kptr = 0;
      for (let j = 0; j < nP; j++) {
        const u = u0 + j / nP;
        while (kptr < cdf.length - 1 && cdf[kptr]! < u) kptr++;
        next.push(particles[kptr]!);
      }
      particles = next;
      weights = Array(nP).fill(1 / nP);
    }
    snap.push(particles.slice(0, 48));
  }

  return { priorPf: prior, pfConf: conf, pfStd: stds, particlesAt: snap };
}

export function blendPfLast(pf: number[], last: number, conf: number[]) {
  const floor = 0.25;
  const ceil = 0.7;
  return pf.map((v, i) => {
    const c = clamp((conf[i]! - floor) / Math.max(ceil - floor, 1e-6), 0, 1);
    const d = clamp(v - last, -MAX_TVT_DEV, MAX_TVT_DEV);
    return last + c * d;
  });
}

export function bagPf(well: Well, seed: number, aCal: number, bCal: number) {
  const cfgs = [
    { nParticles: 96, processSigma: 0.16, grSigma: 14, tvtSpan: 45, rngSeed: 1 },
    { nParticles: 110, processSigma: 0.22, grSigma: 18, tvtSpan: 55, rngSeed: 2 },
    { nParticles: 96, processSigma: 0.28, grSigma: 22, tvtSpan: 65, rngSeed: 3 },
  ];
  const runs = cfgs.map((c) => particleFilter(well, seed, { ...c, aCal, bCal }));
  const n = well.stations.length;
  const bag = Array(n).fill(0) as number[];
  const conf = Array(n).fill(0) as number[];
  const stds = Array(n).fill(0) as number[];
  for (let i = 0; i < n; i++) {
    const vals = runs.map((r) => r.priorPf[i]!).sort((a, b) => a - b);
    bag[i] = vals[1] ?? vals[0]!;
    conf[i] = runs.reduce((s, r) => s + r.pfConf[i]!, 0) / runs.length;
    stds[i] = runs.reduce((s, r) => s + r.pfStd[i]!, 0) / runs.length;
    const disagree = Math.hypot(vals[vals.length - 1]! - vals[0]!);
    conf[i] *= 1 / (1 + disagree / 8);
  }
  const single = runs[1] ?? runs[0]!;
  return {
    priorPf: single.priorPf,
    priorBag: bag,
    pfConf: conf,
    pfStd: stds,
    particlesAt: single.particlesAt,
  };
}

export type { Typewell };
