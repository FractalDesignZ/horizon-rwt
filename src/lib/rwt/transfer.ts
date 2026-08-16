import { clamp, entropy } from "./math";
import type { PadSheaf, PipelineResult, ProbabilityFrame, TransferHit } from "./types";

function gaussFrame(bins: number[], mu: number, sig: number): ProbabilityFrame {
  const s = Math.max(sig, 1.1);
  const mass = bins.map((b) => Math.exp(-0.5 * ((b - mu) / s) ** 2));
  const z = mass.reduce((a, b) => a + b, 0) || 1;
  const p = mass.map((v) => v / z);
  const meanV = p.reduce((a, v, k) => a + v * bins[k]!, 0);
  const varr = p.reduce((a, v, k) => a + v * (bins[k]! - meanV) ** 2, 0);
  const mode = bins[p.indexOf(Math.max(...p))] ?? mu;
  const h = entropy(p);
  const hMax = Math.log(bins.length);
  const horizonScore = clamp(0.35 * (h / hMax) + 0.4 * Math.min(1, Math.sqrt(varr) / 10), 0, 1);
  return {
    bins,
    mass: p,
    mode,
    mean: meanV,
    std: Math.sqrt(varr),
    entropy: h,
    horizon: horizonScore > 0.72,
    horizonScore,
  };
}

export function transferPosterior(
  source: PipelineResult,
  station: number,
  padSheaf: PadSheaf,
  results: Record<string, PipelineResult>,
): TransferHit[] {
  const i = Math.max(0, Math.min(station, source.well.stations.length - 1));
  const srcFrame = source.probability[i];
  if (!srcFrame) return [];
  const srcLast = source.priors.lastKnown;
  const hits: TransferHit[] = [];

  for (const e of padSheaf.edges) {
    const other = e.a === source.well.id ? e.b : e.b === source.well.id ? e.a : null;
    if (!other) continue;
    const tgt = results[other];
    if (!tgt) continue;
    const shift = (tgt.priors.lastKnown - srcLast) * 0.45 + e.twist * 2.4;
    const weight = clamp(e.stiffness * (1 - 0.65 * e.tension), 0.05, 1);
    const mu = srcFrame.mean + shift;
    const sig = srcFrame.std * (1 + 0.85 * e.tension);
    hits.push({
      wellId: other,
      weight,
      tension: e.tension,
      shift,
      frame: gaussFrame(srcFrame.bins, mu, sig),
    });
  }

  hits.sort((a, b) => b.weight - a.weight);
  return hits;
}