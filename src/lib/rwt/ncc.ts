import { clamp, interp, ncc0 } from "./math";
import { GR_AGREE_SCALE, MAX_TVT_DEV, type Typewell, type Well } from "./types";

export function invertTypewell(tw: Typewell, gr: number, prefer?: number) {
  let best = prefer ?? tw.tvt[0] ?? NaN;
  let d = Infinity;
  for (let i = 0; i < tw.gr.length; i++) {
    const g = tw.gr[i]!;
    const t = tw.tvt[i]!;
    if (!Number.isFinite(g) || !Number.isFinite(t)) continue;
    if (prefer != null && Number.isFinite(prefer) && Math.abs(t - prefer) > MAX_TVT_DEV) continue;
    const e = Math.abs(g - gr);
    const bias = prefer != null && Number.isFinite(prefer) ? 0.05 * Math.abs(t - prefer) : 0;
    if (e + bias < d) {
      d = e + bias;
      best = t;
    }
  }
  return best;
}

export function typewellGrAt(tw: Typewell, t: number, a = 1, b = 0) {
  return a * interp(t, tw.tvt, tw.gr) + b;
}

export function fitHeelAffine(well: Well) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of well.stations) {
    const t = s.tvtInput ?? s.tvt;
    if (t == null || !Number.isFinite(s.gr)) continue;
    xs.push(interp(t, well.typewell.tvt, well.typewell.gr));
    ys.push(s.gr);
  }
  if (xs.length < 8) return { a: 1, b: 0 };
  const n = xs.length;
  let sxx = 0;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]!;
    sy += ys[i]!;
    sxx += xs[i]! * xs[i]!;
    sxy += xs[i]! * ys[i]!;
  }
  const det = n * sxx - sx * sx;
  if (Math.abs(det) < 1e-9) return { a: 1, b: 0 };
  const a = (n * sxy - sx * sy) / det;
  const b = (sy - a * sx) / n;
  if (!Number.isFinite(a) || a <= 1e-3) return { a: 1, b: 0 };
  return { a, b };
}

function windowAt(arr: number[], center: number, scale: number) {
  const half = Math.floor(scale / 2);
  const lo = Math.max(0, center - half);
  const hi = Math.min(arr.length, center + half);
  const raw = arr.slice(lo, hi);
  const finite = raw.filter(Number.isFinite);
  if (finite.length < Math.max(4, scale / 4)) return null;
  if (raw.length === scale && finite.length === raw.length) return raw;
  const filled = raw.map((v, i) => (Number.isFinite(v) ? v : finite[i % finite.length]!));
  if (filled.length === scale) return filled;
  const out = new Array<number>(scale);
  for (let i = 0; i < scale; i++) {
    const u = (i / Math.max(scale - 1, 1)) * (filled.length - 1);
    const j = Math.floor(u);
    const t = u - j;
    out[i] = filled[j]! * (1 - t) + filled[Math.min(j + 1, filled.length - 1)]! * t;
  }
  return out;
}

export function nccTrack(well: Well, seed: number) {
  const n = well.stations.length;
  const gr = well.stations.map((s) => s.gr);
  const known = well.stations.map((s) => s.tvtInput ?? s.tvt);
  const track = Array(n).fill(NaN) as number[];
  const conf = Array(n).fill(0) as number[];
  let last = seed;
  const stride = 8;
  const scales = [32, 64];

  for (let i = 0; i < n; i += stride) {
    if (known[i] != null && Number.isFinite(known[i]!)) {
      track[i] = known[i]!;
      last = known[i]!;
      continue;
    }
    const hints: number[] = [];
    const peaks: number[] = [];
    for (const sc of scales) {
      const win = windowAt(gr, i, sc);
      if (!win) continue;
      const loT = last - MAX_TVT_DEV * 1.25;
      const hiT = last + MAX_TVT_DEV * 1.25;
      let best = -Infinity;
      let bestT = last;
      const tw = well.typewell;
      const step = Math.max(1, Math.floor(tw.tvt.length / 80));
      for (let k = 0; k < tw.tvt.length - sc; k += step) {
        const t0 = tw.tvt[k]!;
        if (t0 < loT || t0 > hiT) continue;
        const tmpl = tw.gr.slice(k, k + sc);
        const score = ncc0(win, tmpl);
        if (score > best) {
          best = score;
          bestT = tw.tvt[Math.min(k + Math.floor(sc / 2), tw.tvt.length - 1)]!;
        }
      }
      if (best > 0.12) {
        hints.push(bestT);
        peaks.push(best);
      }
    }
    if (!hints.length) continue;
    const hint = hints.reduce((a, b) => a + b, 0) / hints.length;
    const peak = Math.max(...peaks);
    track[i] = last + clamp(hint - last, -MAX_TVT_DEV, MAX_TVT_DEV);
    conf[i] = clamp(peak, 0, 1);
  }

  const idx: number[] = [];
  for (let i = 0; i < n; i++) if (Number.isFinite(track[i]!)) idx.push(i);
  const filled = Array(n).fill(seed) as number[];
  if (idx.length >= 2) {
    for (let i = 0; i < n; i++) {
      filled[i] = interp(
        i,
        idx,
        idx.map((j) => track[j]!),
      );
    }
  } else if (idx.length === 1) {
    filled.fill(track[idx[0]!]!);
  }
  const confF = Array(n).fill(0) as number[];
  const peaks = idx.filter((i) => conf[i]! > 0);
  for (let i = 0; i < n; i++) {
    if (!peaks.length) continue;
    let best = peaks[0]!;
    let bd = Math.abs(best - i);
    for (const p of peaks) {
      const d = Math.abs(p - i);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    confF[i] = conf[best]! * 0.85;
  }
  for (const p of peaks) confF[p] = conf[p]!;
  for (let i = 0; i < n; i++) {
    filled[i] = seed + clamp(filled[i]! - seed, -MAX_TVT_DEV, MAX_TVT_DEV);
    if (known[i] != null && Number.isFinite(known[i]!)) {
      filled[i] = known[i]!;
      confF[i] = 1;
    }
  }
  return { priorNcc: filled, nccConf: confF };
}

export function grMismatch(well: Well, tvtHat: number[], a: number, b: number) {
  return well.stations.map((s, i) => {
    if (!Number.isFinite(s.gr) || !Number.isFinite(tvtHat[i]!)) return NaN;
    return s.gr - typewellGrAt(well.typewell, tvtHat[i]!, a, b);
  });
}

export function grAgree(absMismatch: number[]) {
  return absMismatch.map((m) =>
    Number.isFinite(m) ? Math.exp(-Math.abs(m) / GR_AGREE_SCALE) : 0,
  );
}
