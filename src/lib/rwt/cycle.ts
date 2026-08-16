import { clamp, jacobiEigen, mean } from "./math";
import type {
  LockReport,
  PadEdge,
  PadNode,
  PadSheaf,
  PersistBar,
  PersistReport,
  PipelineResult,
  Well,
} from "./types";

function lastOf(well: Well) {
  for (let i = well.stations.length - 1; i >= 0; i--) {
    const v = well.stations[i]!.tvtInput ?? well.stations[i]!.tvt;
    if (v != null && Number.isFinite(v)) return v;
  }
  return NaN;
}

function centroid(well: Well) {
  const n = well.stations.length || 1;
  let x = 0;
  let y = 0;
  for (const s of well.stations) {
    x += s.x;
    y += s.y;
  }
  return { x: x / n, y: y / n };
}

function azimuthOf(well: Well) {
  const a = well.stations[0]!;
  const b = well.stations[well.stations.length - 1]!;
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function computeLocks(result: PipelineResult, station: number): LockReport {
  const i = Math.max(0, Math.min(station, result.well.stations.length - 1));
  const g3 = result.residual.gate3;
  const floor = Number.isFinite(g3.bestFloor) ? g3.bestFloor : 1;
  const gateVal = g3.accept
    ? 1
    : clamp(1 - (g3.residualRmse - floor) / Math.max(floor, 1e-3), 0, 0.85);
  const tumblers = [
    {
      id: "prior",
      name: "Last known",
      value: Number.isFinite(result.priors.lastKnown) ? 1 : 0,
      locked: Number.isFinite(result.priors.lastKnown),
      note: `last ${result.priors.lastKnown.toFixed(1)}`,
    },
    {
      id: "match",
      name: "GR fit",
      value: clamp(result.priors.grAgree[i] ?? 0, 0, 1),
      locked: (result.priors.grAgree[i] ?? 0) >= 0.45,
      note: `${((result.priors.grAgree[i] ?? 0) * 100).toFixed(0)}%`,
    },
    {
      id: "particle",
      name: "Particles",
      value: clamp(result.priors.pfConf[i] ?? 0, 0, 1),
      locked: (result.priors.pfConf[i] ?? 0) >= 0.28,
      note: `${((result.priors.pfConf[i] ?? 0) * 100).toFixed(0)}%`,
    },
    {
      id: "neighbor",
      name: "Neighbor",
      value: clamp(result.priors.neighborOk[i] ?? 0, 0, 1),
      locked: (result.priors.neighborOk[i] ?? 0) >= 0.4,
      note: Number.isFinite(result.priors.neighborTvt[i]!)
        ? `TVT ${result.priors.neighborTvt[i]!.toFixed(1)}`
        : "no neighbor",
    },
    {
      id: "gate3",
      name: "Baseline",
      value: gateVal,
      locked: g3.accept,
      note: g3.accept ? "residual wins" : `held ${g3.bestFloorName}`,
    },
    {
      id: "horizon",
      name: "Lock",
      value: clamp(result.sheaf.recoverability[i] ?? 0, 0, 1),
      locked: !(result.probability[i]?.horizon ?? false),
      note: result.probability[i]?.horizon ? "lost lock" : "locked",
    },
  ];
  const keyFit = mean(tumblers.map((t) => t.value));
  const turns = tumblers.filter((t) => t.locked).length;
  return {
    tumblers,
    keyFit,
    turns,
    fireReady: result.residual.fire[i] === true,
  };
}

function rot2(th: number, k: number) {
  const s = Math.sqrt(Math.max(k, 1e-6));
  const c = Math.cos(th);
  const si = Math.sin(th);
  return [
    [s * c, -s * si],
    [s * si, s * c],
  ];
}

export function computePadSheaf(wells: Well[], results: Record<string, PipelineResult>): PadSheaf {
  const nodes: PadNode[] = wells.map((w) => {
    const c = centroid(w);
    const r = results[w.id];
    return {
      id: w.id,
      x: c.x,
      y: c.y,
      last: r?.priors.lastKnown ?? lastOf(w),
      azi: r?.geometry.signedAzimuth ?? azimuthOf(w),
    };
  });

  const pairs: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y);
      pairs.push({ i, j, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const keep = new Set<string>();
  const degree = nodes.map(() => 0);
  for (const p of pairs) {
    if (p.d > 2000 && keep.size >= Math.max(nodes.length - 1, 1)) continue;
    if (degree[p.i]! >= 3 && degree[p.j]! >= 3) continue;
    keep.add(`${p.i}-${p.j}`);
    degree[p.i]! += 1;
    degree[p.j]! += 1;
  }
  if (!keep.size && pairs[0]) keep.add(`${pairs[0].i}-${pairs[0].j}`);

  const edges: PadEdge[] = [];
  const m = nodes.length;
  const dim = 2;
  const nv = m * dim;
  const delta: number[][] = [];
  let hol = 0;

  for (const key of keep) {
    const [is, js] = key.split("-").map(Number);
    const a = nodes[is!]!;
    const b = nodes[js!]!;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const twist = b.azi - a.azi;
    hol += twist;
    const ra = results[a.id];
    const rb = results[b.id];
    const stiff =
      0.4 +
      0.6 *
        0.5 *
        ((ra?.priors.neighborOk[0] ?? 0.5) + (rb?.priors.neighborOk[0] ?? 0.5));
    const dLast =
      Number.isFinite(a.last) && Number.isFinite(b.last) ? Math.abs(a.last - b.last) / 18 : 0.4;
    const tension = clamp(0.35 * Math.abs(twist) + 0.65 * dLast, 0, 1);
    edges.push({ a: a.id, b: b.id, dist, twist, stiffness: stiff, tension });

    const Ru = rot2(0, stiff);
    const Rv = rot2(twist, stiff);
    const row0 = Array(nv).fill(0);
    const row1 = Array(nv).fill(0);
    row0[is! * 2] = Ru[0]![0]!;
    row0[is! * 2 + 1] = Ru[0]![1]!;
    row0[js! * 2] = -Rv[0]![0]!;
    row0[js! * 2 + 1] = -Rv[0]![1]!;
    row1[is! * 2] = Ru[1]![0]!;
    row1[is! * 2 + 1] = Ru[1]![1]!;
    row1[js! * 2] = -Rv[1]![0]!;
    row1[js! * 2 + 1] = -Rv[1]![1]!;
    delta.push(row0, row1);
  }

  const L = Array.from({ length: nv }, () => Array(nv).fill(0) as number[]);
  for (const row of delta) {
    for (let i = 0; i < nv; i++) {
      for (let j = 0; j < nv; j++) L[i]![j] += row[i]! * row[j]!;
    }
  }
  const { values } = nv > 0 ? jacobiEigen(L, 40) : { values: [] as number[] };
  const kernelDim = values.filter((v) => v < 1e-4).length;
  const algebraicConnectivity = values.find((v) => v > 1e-4) ?? 0;

  return {
    nodes,
    edges,
    eigenvalues: values.slice(0, 10),
    kernelDim,
    frustration: mean(values.slice(0, 4).map(Math.abs)),
    algebraicConnectivity,
    holonomy: hol,
  };
}

function dist3(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function ripsDiagram(points: [number, number, number][], labels?: string[]): PersistReport {
  const n = points.length;
  if (n < 2) {
    return { bars: [], beta0: n, beta1: 0, mergeScale: null };
  }
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  const pairs: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) pairs.push({ i, j, d: dist3(points[i]!, points[j]!) });
  }
  pairs.sort((a, b) => a.d - b.d);
  const bars: PersistBar[] = [];
  let comps = n;
  let lastMerge: number | null = null;
  let h1 = 0;
  for (const p of pairs) {
    const A = find(p.i);
    const B = find(p.j);
    if (A !== B) {
      parent[A] = B;
      comps -= 1;
      lastMerge = p.d;
      bars.push({
        dim: 0,
        birth: 0,
        death: p.d,
        label: labels?.[p.i] ?? `c${p.i}`,
      });
    } else if (h1 < 3) {
      bars.push({
        dim: 1,
        birth: p.d,
        death: p.d * 1.65,
        label: "cycle",
      });
      h1 += 1;
    }
  }
  bars.push({ dim: 0, birth: 0, death: Infinity, label: "∞" });
  return {
    bars,
    beta0: 1,
    beta1: h1,
    mergeScale: lastMerge,
  };
}

export function wellPersistence(
  result: Pick<PipelineResult, "well" | "geometry" | "priors">,
): PersistReport {
  const well = result.well;
  const step = Math.max(1, Math.floor(well.stations.length / 22));
  const pts: [number, number, number][] = [];
  const labels: string[] = [];
  for (let i = 0; i < well.stations.length; i += step) {
    pts.push([
      result.geometry.eRef[i] ?? 0,
      (result.geometry.localTorsion[i] ?? 0) * 8,
      (result.priors.grMismatch[i] ?? 0) / 20,
    ]);
    labels.push(well.stations[i]!.md.toFixed(0));
  }
  return ripsDiagram(pts, labels);
}

export function padPersistence(wells: Well[]): PersistReport {
  const pts: [number, number, number][] = wells.map((w) => {
    const c = centroid(w);
    return [c.x / 400, c.y / 400, lastOf(w) / 80];
  });
  return ripsDiagram(
    pts,
    wells.map((w) => w.id),
  );
}

export function applyWhatIf(result: PipelineResult, bias: number): PipelineResult {
  if (!bias) return result;
  const well = result.well;
  const n = well.stations.length;
  const ps = well.stations.findIndex((s) => s.isPredict);
  const fade = (i: number) => {
    if (!well.stations[i]!.isPredict) return 0;
    if (ps < 0) return 1;
    return clamp((i - ps) / Math.max(n - 1 - ps, 1), 0, 1);
  };
  const selected = result.selected.map((v, i) => v + bias * fade(i));
  const probability = result.probability.map((f, i) => {
    const d = bias * fade(i);
    if (!d) return f;
    return {
      ...f,
      mode: f.mode + d,
      mean: f.mean + d,
      bins: f.bins.map((b) => b + d),
    };
  });
  return { ...result, selected, probability };
}
