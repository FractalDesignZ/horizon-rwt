import { clamp, mean, mulberry32, std } from "./math";
import type { PersistBar, Well } from "./types";

export type Regime = "normal" | "stick-slip" | "whirl" | "bounce";

export interface MechanicSample {
  md: number;
  wob: number;
  rpm: number;
  trq: number;
  rop: number;
}

export interface RogueFrame {
  i: number;
  md: number;
  mech: MechanicSample;
  beta0: number;
  beta1: number;
  regime: Regime;
  confidence: number;
  experts: Record<Regime, number>;
  hard: boolean;
  soft: boolean;
  warn: boolean;
  recWob: number;
  recRpm: number;
  recNote: string;
  bars: PersistBar[];
}

export interface RogueReport {
  samples: MechanicSample[];
  frames: RogueFrame[];
  safe: { wob: number; rpm: number; trq: number };
}

const WIN = 22;
const HARD = { wob: 200, rpm: 176, trq: 26 };
const SOFT = { wob: 172, rpm: 154, trq: 22 };

function hashSeed(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function mechanicsOf(well: Well): MechanicSample[] {
  const rng = mulberry32(hashSeed(well.id) ^ 0x9e3779b9);
  const n = well.stations.length;
  const off = (hashSeed(well.id) % 5) / 5;
  return well.stations.map((s, i) => {
    const frac = i / Math.max(n - 1, 1);
    const lith = clamp((s.gr - 40) / 80, 0, 1);
    let wob = s.extra.WOB ?? 118 + 16 * lith;
    let rpm = s.extra.RPM ?? 108 - 8 * lith;
    let trq = s.extra.TRQ ?? 13.5 + 3.2 * lith;
    let rop = s.extra.ROP ?? 38 - 10 * lith;
    const phase = frac + off;
    const ss = bump(phase, 0.22, 0.07);
    const wh = bump(phase, 0.48, 0.06);
    const bn = bump(phase, 0.74, 0.055);
    wob += 22 * ss * Math.sin(i * 0.95) + rng() * 1.4;
    rpm -= 16 * ss * Math.sin(i * 0.95) + rng() * 0.8;
    rpm += 28 * wh + 7 * wh * Math.sin(i * 1.35);
    trq += 5.4 * wh * Math.sin(i * 1.35 + 1.1);
    wob += 34 * bn * ((i % 2) * 2 - 1);
    rop += 6 * ss * Math.abs(Math.sin(i * 0.95)) - 8 * wh - 10 * bn;
    wob = clamp(wob, 40, 240);
    rpm = clamp(rpm, 40, 210);
    trq = clamp(trq, 4, 34);
    rop = clamp(rop, 2, 80);
    return { md: s.md, wob, rpm, trq, rop };
  });
}

function bump(x: number, c: number, w: number) {
  const t = (x - c) / w;
  return Math.exp(-t * t);
}

function zcol(vals: number[]) {
  const m = mean(vals);
  const s = Math.max(std(vals), 1e-6);
  return vals.map((v) => (v - m) / s);
}

function cloud(samples: MechanicSample[], i: number) {
  const lo = Math.max(0, i - WIN + 1);
  const sl = samples.slice(lo, i + 1);
  const wob = zcol(sl.map((s) => s.wob));
  const rpm = zcol(sl.map((s) => s.rpm));
  const trq = zcol(sl.map((s) => s.trq));
  const rop = zcol(sl.map((s) => s.rop));
  return sl.map((_, k) => [wob[k]!, rpm[k]!, trq[k]!, rop[k]!]);
}

function dist(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i]! - b[i]!) ** 2;
  return Math.sqrt(s);
}

function homology(pts: number[][], eps: number): { b0: number; b1: number } {
  const n = pts.length;
  if (n < 3) return { b0: n, b1: 0 };
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  const unite = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pa] = pb;
  };
  let e = 0;
  const adj: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dist(pts[i]!, pts[j]!) <= eps) {
        unite(i, j);
        adj[i]![j] = adj[j]![i] = true;
        e++;
      }
    }
  }
  const roots = new Set<number>();
  for (let i = 0; i < n; i++) roots.add(find(i));
  let tri = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!adj[i]![j]) continue;
      for (let k = j + 1; k < n; k++) {
        if (adj[i]![k] && adj[j]![k]) tri++;
      }
    }
  }
  const b0 = roots.size;
  const b1 = Math.max(0, e - n + b0 - tri);
  return { b0, b1 };
}

function persistBars(pts: number[][]): PersistBar[] {
  const n = pts.length;
  if (n < 3) return [];
  const edges: { a: number; b: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) edges.push({ a: i, b: j, d: dist(pts[i]!, pts[j]!) });
  }
  edges.sort((x, y) => x.d - y.d);
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  const bars: PersistBar[] = [];
  for (const ed of edges) {
    const pa = find(ed.a);
    const pb = find(ed.b);
    if (pa === pb) {
      bars.push({ dim: 1, birth: ed.d, death: ed.d * 1.45, label: "H1" });
    } else {
      parent[pa] = pb;
      bars.push({ dim: 0, birth: 0, death: ed.d, label: "H0" });
    }
  }
  return bars.filter((b) => b.death - b.birth > 0.12).slice(0, 18);
}

function features(sl: MechanicSample[]) {
  const wob = sl.map((s) => s.wob);
  const rpm = sl.map((s) => s.rpm);
  const mw = mean(wob);
  const mr = mean(rpm);
  let cov = 0;
  for (let i = 0; i < sl.length; i++) cov += (wob[i]! - mw) * (rpm[i]! - mr);
  const corr = cov / Math.max(sl.length * std(wob) * std(rpm), 1e-6);
  const wobBim = std(wob) / Math.max(Math.abs(mw), 1);
  return { corr, rpmVar: std(rpm), wobBim };
}

function classify(b0: number, b1: number, feat: { corr: number; rpmVar: number; wobBim: number }): {
  regime: Regime;
  experts: Record<Regime, number>;
} {
  const raw = {
    normal: 1.6 - 0.8 * Math.max(0, b0 - 1) - 0.7 * b1,
    "stick-slip": 0.3 + (b1 === 1 ? 1.8 : 0.2 * b1) + (feat.corr < -0.25 ? 1.1 : 0),
    whirl: 0.2 + (b1 >= 2 ? 2.1 : 0) + (feat.rpmVar > 12 ? 0.8 : 0),
    bounce: 0.15 + (b0 >= 2 ? 2.2 : 0) + (feat.wobBim > 0.18 ? 0.9 : 0),
  };
  const ex = Math.exp;
  const e = {
    normal: ex(raw.normal),
    "stick-slip": ex(raw["stick-slip"]),
    whirl: ex(raw.whirl),
    bounce: ex(raw.bounce),
  };
  const z = e.normal + e["stick-slip"] + e.whirl + e.bounce;
  const experts: Record<Regime, number> = {
    normal: e.normal / z,
    "stick-slip": e["stick-slip"] / z,
    whirl: e.whirl / z,
    bounce: e.bounce / z,
  };
  let regime: Regime = "normal";
  let best = 0;
  (Object.keys(experts) as Regime[]).forEach((k) => {
    if (experts[k]! > best) {
      best = experts[k]!;
      regime = k;
    }
  });
  return { regime, experts };
}

export function computeRogue(well: Well): RogueReport {
  const samples = mechanicsOf(well);
  const frames: RogueFrame[] = samples.map((mech, i) => {
    const pts = cloud(samples, i);
    const ds: number[] = [];
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) ds.push(dist(pts[a]!, pts[b]!));
    }
    ds.sort((x, y) => x - y);
    const eps = ds[Math.floor(ds.length * 0.32)] ?? 1.1;
    const { b0, b1 } = homology(pts, eps);
    const sl = samples.slice(Math.max(0, i - WIN + 1), i + 1);
    const { regime, experts } = classify(b0, b1, features(sl));
    const hard = mech.wob > HARD.wob || mech.rpm > HARD.rpm || mech.trq > HARD.trq;
    const soft = mech.wob > SOFT.wob || mech.rpm > SOFT.rpm || mech.trq > SOFT.trq;
    const warn = regime !== "normal" || soft;
    const rec = advise(mech, regime, hard);
    return {
      i,
      md: mech.md,
      mech,
      beta0: b0,
      beta1: b1,
      regime,
      confidence: experts[regime]!,
      experts,
      hard,
      soft,
      warn,
      recWob: rec.wob,
      recRpm: rec.rpm,
      recNote: rec.note,
      bars: persistBars(pts),
    };
  });
  const safe = {
    wob: mean(samples.filter((_, i) => frames[i]!.regime === "normal").map((s) => s.wob)),
    rpm: mean(samples.filter((_, i) => frames[i]!.regime === "normal").map((s) => s.rpm)),
    trq: mean(samples.filter((_, i) => frames[i]!.regime === "normal").map((s) => s.trq)),
  };
  return { samples, frames, safe };
}

function advise(m: MechanicSample, regime: Regime, hard: boolean) {
  if (hard) return { wob: Math.min(m.wob, 150), rpm: Math.min(m.rpm, 120), note: "A3.1 · pull back now" };
  if (regime === "stick-slip")
    return { wob: m.wob - 18, rpm: m.rpm + 12, note: "unload bit · raise RPM" };
  if (regime === "whirl") return { wob: m.wob + 4, rpm: m.rpm - 22, note: "drop RPM · damp whirl" };
  if (regime === "bounce") return { wob: m.wob - 24, rpm: m.rpm - 6, note: "ease WOB · kill bounce" };
  return { wob: m.wob, rpm: m.rpm, note: "hold parameters" };
}

export { HARD, SOFT };
