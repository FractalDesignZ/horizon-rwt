import { mean, std } from "./math";
import { computeLocks } from "./cycle";
import { computeSteer } from "./steer";
import type { PipelineResult, SteerCall, Typewell, Well } from "./types";

export interface BookMarker {
  id: string;
  name: string;
  tvt: number;
  gr: number;
}

export interface FenceHit {
  markerId: string;
  md: number;
  tvt: number;
  i: number;
}

export interface FencePoint {
  i: number;
  md: number;
  tvt: number;
  gr: number;
  predict: boolean;
  horizon: boolean;
}

export interface FenceTrack {
  wellId: string;
  points: FencePoint[];
  hits: FenceHit[];
}

export interface WellBrief {
  wellId: string;
  advisory: SteerCall;
  reason: string;
  rmse: number | null;
  horizonMd: number | null;
  keyFit: number;
  last: number;
}

export function pickMarkers(tw: Typewell, want = 5): BookMarker[] {
  const gr = tw.gr;
  const tvt = tw.tvt;
  const mu = mean(gr);
  const s = Math.max(std(gr), 1);
  const peaks: { i: number; g: number }[] = [];
  for (let i = 2; i < gr.length - 2; i++) {
    const g = gr[i]!;
    if (g > gr[i - 1]! && g > gr[i + 1]! && g > gr[i - 2]! && g >= mu + 0.45 * s) {
      peaks.push({ i, g });
    }
  }
  peaks.sort((a, b) => b.g - a.g);
  const kept: BookMarker[] = [];
  for (const p of peaks) {
    const t = tvt[p.i]!;
    if (kept.some((k) => Math.abs(k.tvt - t) < 14)) continue;
    kept.push({
      id: `mk-${kept.length + 1}`,
      name: `M${kept.length + 1}`,
      tvt: t,
      gr: p.g,
    });
    if (kept.length >= want) break;
  }
  kept.sort((a, b) => a.tvt - b.tvt);
  kept.forEach((k, i) => {
    k.name = `M${i + 1}`;
    k.id = `mk-${i + 1}`;
  });
  return kept;
}

export function buildFence(
  wells: Well[],
  results: Record<string, PipelineResult>,
  markers: BookMarker[],
): FenceTrack[] {
  return wells.map((w) => {
    const r = results[w.id];
    const points: FencePoint[] = w.stations.map((s, i) => ({
      i,
      md: s.md,
      tvt: r?.selected[i] ?? s.tvtInput ?? s.tvt ?? NaN,
      gr: s.gr,
      predict: s.isPredict,
      horizon: r?.probability[i]?.horizon ?? false,
    }));
    const hits: FenceHit[] = [];
    for (const mk of markers) {
      let best = -1;
      let d = Infinity;
      for (let i = 0; i < points.length; i++) {
        const t = points[i]!.tvt;
        if (!Number.isFinite(t)) continue;
        const e = Math.abs(t - mk.tvt);
        if (e < d) {
          d = e;
          best = i;
        }
      }
      if (best >= 0 && d < 10) {
        hits.push({
          markerId: mk.id,
          md: points[best]!.md,
          tvt: points[best]!.tvt,
          i: best,
        });
      }
    }
    return { wellId: w.id, points, hits };
  });
}

export function padBrief(wells: Well[], results: Record<string, PipelineResult>): WellBrief[] {
  return wells.map((w) => {
    const r = results[w.id];
    if (!r) {
      return {
        wellId: w.id,
        advisory: "HOLD" as const,
        reason: "awaiting run",
        rmse: null,
        horizonMd: null,
        keyFit: 0,
        last: NaN,
      };
    }
    const ps = Math.max(
      0,
      r.well.stations.findIndex((s) => s.isPredict),
    );
    const steer = computeSteer(r, ps);
    const locks = computeLocks(r, ps);
    const onset = r.sheaf.horizonOnset;
    return {
      wellId: r.well.id,
      advisory: steer.advisory,
      reason: steer.reason,
      rmse: r.toeRmse,
      horizonMd: onset != null ? r.well.stations[onset]!.md : null,
      keyFit: locks.keyFit,
      last: r.priors.lastKnown,
    };
  });
}