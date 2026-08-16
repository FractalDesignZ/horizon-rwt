import { clamp, mean } from "./math";
import { invertTypewell } from "./ncc";
import { MAX_MD_SLOPE } from "./types";
import type { PipelineResult, SteerCall, SteerReport, SteerSample } from "./types";

export function computeSteer(result: PipelineResult, station: number): SteerReport {
  const well = result.well;
  const n = well.stations.length;
  const bit = Math.max(0, Math.min(station, n - 1));
  const bitMd = well.stations[bit]!.md;
  const bitTvt = result.selected[bit] ?? result.priors.lastKnown;
  const bookNow = invertTypewell(well.typewell, well.stations[bit]!.gr, bitTvt);
  const target = Number.isFinite(bookNow) ? bookNow : result.priors.lastKnown;
  const windowLo = target - 6;
  const windowHi = target + 6;

  const samples: SteerSample[] = [];
  const bins = result.probability[bit]?.bins ?? [];
  const geo = Array(n).fill(NaN) as number[];
  geo[bit] = bitTvt;

  for (let i = bit; i < n; i++) {
    const f = result.probability[i];
    const rec = result.sheaf.recoverability[i] ?? 0;
    const book = invertTypewell(well.typewell, well.stations[i]!.gr, bitTvt);
    const mu = f?.mean ?? result.selected[i] ?? bitTvt;
    const sig = f?.std ?? 4;
    samples.push({
      i,
      md: well.stations[i]!.md,
      mean: mu,
      lo: mu - sig,
      hi: mu + sig,
      geo: bitTvt,
      book,
      rec,
      horizon: f?.horizon ?? false,
    });
  }

  for (let s = 1; s < samples.length; s++) {
    const i = samples[s]!.i;
    const prev = geo[samples[s - 1]!.i]!;
    const dmd = Math.max(well.stations[i]!.md - well.stations[i - 1]!.md, 1e-3);
    const maxStep = MAX_MD_SLOPE * dmd;
    const f = result.probability[i];
    const choices = f?.bins?.length ? f.bins : [samples[s]!.mean];
    const masses = f?.mass;
    let best = prev;
    let bestC = Infinity;
    for (let k = 0; k < choices.length; k++) {
      const tv = choices[k]!;
      const step = Math.abs(tv - prev);
      if (step > maxStep * 1.8) continue;
      const rec = result.sheaf.recoverability[i] ?? 0.4;
      const hz = f?.horizonScore ?? 0;
      const onBook = Math.exp(-0.5 * ((tv - samples[s]!.book) / 8) ** 2);
      const v = clamp(0.4 * rec + 0.25 * (1 - hz) + 0.35 * onBook, 0, 1);
      const warp = Math.exp(-2.1 * v);
      const prior = masses ? 1 - masses[k]! : 0.5;
      const cost = warp * (1 + (step / Math.max(maxStep, 1e-3)) ** 2) + 0.15 * prior;
      if (cost < bestC) {
        bestC = cost;
        best = tv;
      }
    }
    if (!Number.isFinite(bestC)) {
      best = clamp(samples[s]!.book, prev - maxStep, prev + maxStep);
    }
    geo[i] = best;
    samples[s]!.geo = best;
  }

  const onset = result.sheaf.horizonOnset;
  const onsetMd = onset != null && onset >= bit ? well.stations[onset]!.md : onset != null ? well.stations[onset]!.md : null;
  const mdToHorizon =
    onset != null && well.stations[onset]!.md > bitMd
      ? well.stations[onset]!.md - bitMd
      : onset != null && well.stations[onset]!.md <= bitMd
        ? 0
        : null;

  const horizonNow = Boolean(result.probability[bit]?.horizon) || (onset != null && onset <= bit);
  const look = samples[Math.min(samples.length - 1, 18)];
  const geoEnd = samples[samples.length - 1]?.geo ?? bitTvt;
  const ahead = look?.geo ?? bitTvt;
  const d = ahead - bitTvt;
  const inWindow = bitTvt >= windowLo && bitTvt <= windowHi;
  const risk = mean(samples.slice(0, Math.min(samples.length, 24)).map((s) => (s.horizon ? 1 : 1 - s.rec)));

  let advisory: SteerCall = "HOLD";
  let reason = `window ${windowLo.toFixed(0)}–${windowHi.toFixed(0)}`;
  if (horizonNow || mdToHorizon === 0) {
    advisory = "CUT";
    reason = "lost lock at the bit · do not steer on it";
  } else if (mdToHorizon != null && mdToHorizon < 80) {
    advisory = "CUT";
    reason = `lost lock in ${mdToHorizon.toFixed(0)} ft`;
  } else if (mdToHorizon != null && mdToHorizon < 420) {
    advisory = bitTvt < target - 1 ? "BUILD" : bitTvt > target + 1 ? "DROP" : "HOLD";
    reason = `lost lock in ${mdToHorizon.toFixed(0)} ft · hold target`;
  } else if (d > 1.6 || bitTvt < windowLo) {
    advisory = "BUILD";
    reason = `target ${target.toFixed(1)} · ${inWindow ? "walk up" : "below window"}`;
  } else if (d < -1.6 || bitTvt > windowHi) {
    advisory = "DROP";
    reason = `target ${target.toFixed(1)} · ${inWindow ? "walk down" : "above window"}`;
  } else {
    advisory = "HOLD";
    reason = `window ${windowLo.toFixed(0)}–${windowHi.toFixed(0)} · risk ${(risk * 100).toFixed(0)}`;
  }

  return {
    bit,
    bitMd,
    bitTvt,
    remaining: n - 1 - bit,
    onsetMd,
    mdToHorizon,
    advisory,
    reason,
    windowLo,
    windowHi,
    target,
    samples,
    geoEnd,
    risk,
  };
}