import { clamp, mulberry32, randn } from "./math";
import type { PipelineResult, SteerCall } from "./types";

export const ACTIONS: SteerCall[] = ["HOLD", "BUILD", "DROP", "CUT"];
export const GRID_R = 8;
export const GRID_C = 8;
export const N_SCALAR = 8;
export const N_IN = GRID_R * GRID_C + N_SCALAR;
export const N_HID = 16;
export const N_OUT = ACTIONS.length;

const W1 = N_HID * N_IN;
const B1 = N_HID;
const W2 = N_OUT * N_HID;
const B2 = N_OUT;
export const GENOME = W1 + B1 + W2 + B2;

export type CellKind = "empty" | "zone" | "threat" | "bit" | "labeled";

export interface WorldFrame {
  grid: number[][];
  kinds: CellKind[][];
  flat: number[];
  scalars: number[];
  labels: string[];
}

export interface Genome {
  id: string;
  w: number[];
}

export interface FitScore {
  train: number;
  holdout: number;
  accTrain: number;
  accHold: number;
  nTrain: number;
  nHold: number;
}

export interface GenStat {
  gen: number;
  best: number;
  mean: number;
  holdout: number;
  accHold: number;
}

export interface EvolveReport {
  wellId: string;
  seed: number;
  pop: number;
  gens: number;
  mutation: number;
  best: Genome;
  history: GenStat[];
  fit: FitScore;
  rule: FitScore;
  atStation: {
    i: number;
    world: WorldFrame;
    scores: number[];
    action: SteerCall;
    ruleAction: SteerCall;
  };
  notes: string[];
}

function slice(w: number[]) {
  let o = 0;
  const w1 = w.slice(o, (o += W1));
  const b1 = w.slice(o, (o += B1));
  const w2 = w.slice(o, (o += W2));
  const b2 = w.slice(o, (o += B2));
  return { w1, b1, w2, b2 };
}

export function randomGenome(rng: () => number, id: string): Genome {
  const w = Array.from({ length: GENOME }, () => randn(rng) * 0.35);
  return { id, w };
}

export function forward(genome: Genome, x: number[]) {
  const { w1, b1, w2, b2 } = slice(genome.w);
  const h = new Array<number>(N_HID);
  for (let i = 0; i < N_HID; i++) {
    let s = b1[i]!;
    const row = i * N_IN;
    for (let j = 0; j < N_IN; j++) s += w1[row + j]! * (x[j] ?? 0);
    h[i] = Math.tanh(s);
  }
  const y = new Array<number>(N_OUT);
  for (let i = 0; i < N_OUT; i++) {
    let s = b2[i]!;
    const row = i * N_HID;
    for (let j = 0; j < N_HID; j++) s += w2[row + j]! * h[j]!;
    y[i] = s;
  }
  return y;
}

export function pickAction(scores: number[]): SteerCall {
  let k = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i]! > scores[k]!) k = i;
  return ACTIONS[k]!;
}

function softmax(y: number[]) {
  const m = Math.max(...y);
  const e = y.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0) || 1;
  return e.map((v) => v / s);
}

export function crossover(a: Genome, b: Genome, rng: () => number, id: string): Genome {
  const cut = Math.floor(rng() * a.w.length);
  const w = a.w.map((v, i) => (i < cut ? v : b.w[i]!));
  return { id, w };
}

export function mutate(g: Genome, rate: number, rng: () => number): Genome {
  const w = g.w.map((v) => (rng() < rate ? v + randn(rng) * 0.25 : v));
  return { ...g, w };
}

function cellKind(v: number): CellKind {
  if (v === 2) return "bit";
  if (v === 3) return "labeled";
  if (v === -1) return "threat";
  if (v === 1) return "zone";
  return "empty";
}

export function worldAt(result: PipelineResult, bit: number): WorldFrame {
  const well = result.well;
  const n = well.stations.length;
  const i0 = clamp(Math.floor(bit), 0, Math.max(n - 1, 0));
  const last = result.priors.lastKnown;
  const here = result.selected[i0] ?? last;
  const span = 16;
  const lo = here - span;
  const hi = here + span;
  const grid = Array.from({ length: GRID_R }, () => Array<number>(GRID_C).fill(0));
  const kinds = Array.from({ length: GRID_R }, () => Array<CellKind>(GRID_C).fill("empty"));

  const rowOf = (tvt: number) =>
    clamp(Math.round(((tvt - lo) / Math.max(hi - lo, 1e-6)) * (GRID_R - 1)), 0, GRID_R - 1);

  const unlabeled0 = well.stations.findIndex((s) => s.isPredict);
  const ahead = Math.max(1, n - 1 - i0);

  for (let c = 0; c < GRID_C; c++) {
    const i = clamp(i0 + Math.round((c / Math.max(GRID_C - 1, 1)) * Math.min(ahead, 48)), 0, n - 1);
    const s = well.stations[i]!;
    const tvt = result.selected[i] ?? here;
    const r = rowOf(Number.isFinite(tvt) ? tvt : here);
    const grMis = result.priors.grMismatch[i] ?? 0;
    const rec = result.sheaf.recoverability[i] ?? 0.5;
    const hz = Boolean(result.probability[i]?.horizon) || result.sheaf.horizonOnset === i;
    const labeled = !s.isPredict && i <= i0;

    if (rec > 0.4 && !hz) grid[r]![c] = 1;
    if (grMis > 0.55 || rec < 0.28) grid[r]![c] = -1;
    if (hz) grid[r]![c] = -1;
    if (labeled) grid[Math.min(GRID_R - 1, r)]![c] = 3;

    for (let rr = 0; rr < GRID_R; rr++) kinds[rr]![c] = cellKind(grid[rr]![c]!);
  }

  const br = rowOf(here);
  grid[br]![0] = 2;
  kinds[br]![0] = "bit";

  const scalars = [
    Number.isFinite(here) ? clamp((here - last) / 12, -1, 1) : 0,
    result.sheaf.recoverability[i0] ?? 0.5,
    result.priors.grMismatch[i0] ?? 0,
    result.probability[i0]?.horizonScore ?? (result.sheaf.horizonOnset != null && result.sheaf.horizonOnset <= i0 ? 1 : 0),
    result.residual.useResidual ? 1 : 0,
    result.residual.fire[i0] ? 1 : 0,
    unlabeled0 >= 0 ? clamp((i0 - unlabeled0) / 40, -1, 1) : 0,
    clamp(result.geometry.meanCurv * 200, -1, 1),
  ];

  const flat = grid.flat();
  return {
    grid,
    kinds,
    flat: [...flat, ...scalars],
    scalars,
    labels: [
      "offset last known",
      "recoverability",
      "GR mismatch",
      "lost lock",
      "residual on",
      "residual fire",
      "past last known",
      "curvature",
    ],
  };
}

function truthAction(result: PipelineResult, i: number): SteerCall {
  const well = result.well;
  const a = well.stations[i]!;
  const b = well.stations[Math.min(i + 1, well.stations.length - 1)]!;
  const ta = a.tvtTrue ?? a.tvt ?? result.selected[i];
  const tb = b.tvtTrue ?? b.tvt ?? result.selected[i + 1];
  const hz =
    result.probability[i + 1]?.horizon ||
    (result.sheaf.horizonOnset != null && result.sheaf.horizonOnset <= i + 2);
  if (hz) return "CUT";
  if (ta == null || tb == null || !Number.isFinite(ta) || !Number.isFinite(tb)) return "HOLD";
  const d = tb - ta;
  if (d > 0.35) return "BUILD";
  if (d < -0.35) return "DROP";
  return "HOLD";
}

export function ruleAction(result: PipelineResult, i: number): SteerCall {
  const rec = result.sheaf.recoverability[i] ?? 0.5;
  const hz = Boolean(result.probability[i]?.horizon) || result.sheaf.horizonOnset === i;
  const last = result.priors.lastKnown;
  const here = result.selected[i] ?? last;
  const book = result.probability[i]?.mean ?? here;
  if (hz || rec < 0.22) return "CUT";
  const d = (book ?? here) - here;
  if (d > 0.8) return "BUILD";
  if (d < -0.8) return "DROP";
  return "HOLD";
}

function scoreAction(pred: SteerCall, truth: SteerCall): number {
  if (pred === truth) return pred === "CUT" ? 2 : 1;
  if (pred === "CUT" && truth !== "CUT") return -1.4;
  if (truth === "CUT" && pred !== "CUT") return -0.8;
  if ((pred === "BUILD" && truth === "DROP") || (pred === "DROP" && truth === "BUILD")) return -0.7;
  return -0.15;
}

function labeledIdx(result: PipelineResult) {
  const idx: number[] = [];
  for (let i = 1; i < result.well.stations.length - 1; i++) {
    const s = result.well.stations[i]!;
    const n = result.well.stations[i + 1]!;
    if (s.isPredict && n.isPredict && s.tvtTrue == null) continue;
    if (!s.isPredict || s.tvtTrue != null) idx.push(i);
  }
  return idx;
}

export function scoreGenome(genome: Genome, result: PipelineResult): FitScore {
  const idx = labeledIdx(result);
  const split = Math.max(4, Math.floor(idx.length * 0.7));
  let train = 0;
  let hold = 0;
  let okT = 0;
  let okH = 0;
  let nT = 0;
  let nH = 0;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k]!;
    const world = worldAt(result, i);
    const pred = pickAction(forward(genome, world.flat));
    const truth = truthAction(result, i);
    const s = scoreAction(pred, truth);
    const hit = pred === truth;
    if (k < split) {
      train += s;
      nT += 1;
      if (hit) okT += 1;
    } else {
      hold += s;
      nH += 1;
      if (hit) okH += 1;
    }
  }
  return {
    train: nT ? train / nT : 0,
    holdout: nH ? hold / nH : train / Math.max(nT, 1),
    accTrain: nT ? okT / nT : 0,
    accHold: nH ? okH / nH : okT / Math.max(nT, 1),
    nTrain: nT,
    nHold: nH,
  };
}

function scoreRule(result: PipelineResult): FitScore {
  const idx = labeledIdx(result);
  const split = Math.max(4, Math.floor(idx.length * 0.7));
  let train = 0;
  let hold = 0;
  let okT = 0;
  let okH = 0;
  let nT = 0;
  let nH = 0;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k]!;
    const pred = ruleAction(result, i);
    const truth = truthAction(result, i);
    const s = scoreAction(pred, truth);
    const hit = pred === truth;
    if (k < split) {
      train += s;
      nT += 1;
      if (hit) okT += 1;
    } else {
      hold += s;
      nH += 1;
      if (hit) okH += 1;
    }
  }
  return {
    train: nT ? train / nT : 0,
    holdout: nH ? hold / nH : train / Math.max(nT, 1),
    accTrain: nT ? okT / nT : 0,
    accHold: nH ? okH / nH : okT / Math.max(nT, 1),
    nTrain: nT,
    nHold: nH,
  };
}

function tournament(pop: { g: Genome; f: FitScore }[], rng: () => number) {
  const a = pop[Math.floor(rng() * pop.length)]!;
  const b = pop[Math.floor(rng() * pop.length)]!;
  return a.f.train >= b.f.train ? a.g : b.g;
}

export interface EvolveOpts {
  pop?: number;
  gens?: number;
  mutation?: number;
  seed?: number;
  station?: number;
  onGen?: (stat: GenStat, best: Genome) => void;
}

export function evolveNet(result: PipelineResult, opts: EvolveOpts = {}): EvolveReport {
  const popN = opts.pop ?? 20;
  const gens = opts.gens ?? 16;
  const mutation = opts.mutation ?? 0.05;
  const seed = opts.seed ?? 11;
  const rng = mulberry32(seed);
  let pop = Array.from({ length: popN }, (_, i) => randomGenome(rng, `g0-${i}`));
  const history: GenStat[] = [];
  let bestG = pop[0]!;
  let bestF = scoreGenome(bestG, result);

  for (let gen = 0; gen < gens; gen++) {
    const scored = pop.map((g) => ({ g, f: scoreGenome(g, result) }));
    scored.sort((a, b) => b.f.train - a.f.train);
    bestG = scored[0]!.g;
    bestF = scored[0]!.f;
    const mean = scored.reduce((s, x) => s + x.f.train, 0) / scored.length;
    const stat: GenStat = {
      gen,
      best: bestF.train,
      mean,
      holdout: bestF.holdout,
      accHold: bestF.accHold,
    };
    history.push(stat);
    opts.onGen?.(stat, bestG);

    const next: Genome[] = [bestG, scored[1]?.g ?? bestG];
    while (next.length < popN) {
      const pa = tournament(scored, rng);
      const pb = tournament(scored, rng);
      const child = mutate(crossover(pa, pb, rng, `g${gen + 1}-${next.length}`), mutation, rng);
      next.push(child);
    }
    pop = next;
  }

  const i = clamp(opts.station ?? 0, 0, result.well.stations.length - 1);
  const world = worldAt(result, i);
  const scores = softmax(forward(bestG, world.flat));
  const action = pickAction(forward(bestG, world.flat));
  const notes: string[] = [
    "Reads the live grid. Does not replay a stored path.",
    "Fitness is scored on labeled stations. Holdout is the last 30% — unseen during breeding.",
    bestF.holdout + 0.05 >= bestF.train
      ? "Holdout keeps up with train — the net is not just memorizing."
      : "Holdout lags train — treat the call as a hint, not a ship gate.",
  ];

  return {
    wellId: result.well.id,
    seed,
    pop: popN,
    gens,
    mutation,
    best: bestG,
    history,
    fit: bestF,
    rule: scoreRule(result),
    atStation: {
      i,
      world,
      scores,
      action,
      ruleAction: ruleAction(result, i),
    },
    notes,
  };
}

export function adviseAt(report: EvolveReport, result: PipelineResult, station: number) {
  const world = worldAt(result, station);
  const raw = forward(report.best, world.flat);
  return {
    world,
    scores: softmax(raw),
    action: pickAction(raw),
    ruleAction: ruleAction(result, station),
  };
}
