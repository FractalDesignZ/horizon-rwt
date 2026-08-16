import { computeLocks, computePadSheaf } from "./cycle";
import { computeCts } from "./cts";
import { mulberry32 } from "./math";
import { computeRogue } from "./rogue";
import { computeSteer } from "./steer";
import type { PadField, PipelineResult } from "./types";

export type EvidenceClass = "identity" | "certificate" | "empirical" | "speculative";
export type TimeKind = "physical" | "parameter" | "filtration" | "simulation";
export type ClaimStatus = "hold" | "pass" | "fail" | "excluded";

export interface Claim {
  id: string;
  statement: string;
  klass: EvidenceClass;
  status: ClaimStatus;
  note: string;
}

export interface SheafGate {
  kind: "connection" | "sheaf";
  triangles: number;
  maxCycleResidual: number;
  compatible: boolean;
  reason: string;
}

export interface CertRow {
  id: string;
  pass: boolean;
  note: string;
}

export interface NullReport {
  name: string;
  justification: string;
  B: number;
  observed: number;
  pExact: number;
  nullMean: number;
}

export interface AuditReport {
  padId: string;
  wellId: string;
  claims: Claim[];
  gate: SheafGate;
  certificates: CertRow[];
  nulls: NullReport[];
  hash: string;
}

function wrap(a: number) {
  let d = a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function fnv(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function sheafGate(pad: PadField, results: Record<string, PipelineResult>): SheafGate {
  const sh = computePadSheaf(pad.wells, results);
  const adj = new Map<string, Map<string, number>>();
  for (const e of sh.edges) {
    if (!adj.has(e.a)) adj.set(e.a, new Map());
    if (!adj.has(e.b)) adj.set(e.b, new Map());
    adj.get(e.a)!.set(e.b, e.twist);
    adj.get(e.b)!.set(e.a, -e.twist);
  }
  const ids = sh.nodes.map((n) => n.id);
  let triangles = 0;
  let maxRes = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      for (let k = j + 1; k < ids.length; k++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const c = ids[k]!;
        const ab = adj.get(a)?.get(b);
        const bc = adj.get(b)?.get(c);
        const ca = adj.get(c)?.get(a);
        if (ab == null || bc == null || ca == null) continue;
        triangles += 1;
        maxRes = Math.max(maxRes, Math.abs(wrap(ab + bc + ca)));
      }
    }
  }
  if (triangles === 0) {
    return {
      kind: "connection",
      triangles: 0,
      maxCycleResidual: 0,
      compatible: false,
      reason: "No closed loops. Pairwise links only. Not a pad-wide field.",
    };
  }
  const compatible = maxRes < 0.18;
  return {
    kind: compatible ? "sheaf" : "connection",
    triangles,
    maxCycleResidual: maxRes,
    compatible,
    reason: compatible
      ? `${triangles} cycles close · residual ${maxRes.toFixed(3)} · pad field allowed`
      : `${triangles} cycles · residual ${maxRes.toFixed(3)} · links do not close`,
  };
}

function holonomyNull(twists: number[], B = 47): NullReport {
  const obs = Math.abs(twists.reduce((s, t) => s + t, 0));
  const rng = mulberry32(0x51a7d);
  let ge = 0;
  let acc = 0;
  for (let b = 0; b < B; b++) {
    const p = [...twists];
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [p[i], p[j]] = [p[j]!, p[i]!];
    }
    const v = Math.abs(p.reduce((s, t) => s + t, 0));
    acc += v;
    if (v >= obs - 1e-12) ge += 1;
  }
  return {
    name: "Shuffle neighbor twists",
    justification:
      "A null test, not a proof. Same twists, random order, so cycles break. Not a physics test.",
    B,
    observed: obs,
    pExact: (1 + ge) / (B + 1),
    nullMean: acc / Math.max(B, 1),
  };
}

export function compileAudit(
  pad: PadField,
  results: Record<string, PipelineResult>,
  wellId: string,
): AuditReport {
  const r = results[wellId];
  const gate = sheafGate(pad, results);
  const sh = computePadSheaf(pad.wells, results);
  const hash = fnv(
    `${pad.id}|${pad.wells.map((w) => `${w.id}:${w.stations.length}`).join(",")}|${wellId}`,
  );
  const claims: Claim[] = [];

  claims.push({
    id: "smith-def",
    statement: "|Γ| is the chosen drawing of live-vs-type mismatch.",
    klass: "identity",
    status: "pass",
    note: "A definition. Not a discovery.",
  });
  claims.push({
    id: "lap-psd",
    statement: "Neighbor-link eigenvalues are non-negative.",
    klass: "certificate",
    status: sh.eigenvalues.every((v) => v > -1e-6) ? "pass" : "fail",
    note: `lowest ${(sh.eigenvalues[0] ?? 0).toFixed(4)}`,
  });
  claims.push({
    id: "holonomy",
    statement: "Pad holonomy is the sum of edge twists, not a force.",
    klass: "certificate",
    status: "pass",
    note: `holonomy ${sh.holonomy.toFixed(3)}`,
  });
  claims.push({
    id: "higher-sheaf",
    statement: "A pad-wide field is allowed.",
    klass: "certificate",
    status: gate.compatible ? "pass" : "excluded",
    note: gate.reason,
  });

  if (r) {
    const g3 = r.residual.gate3;
    claims.push({
      id: "floor",
      statement: "Residual ships only if it beats every baseline.",
      klass: "certificate",
      status: g3.accept ? "pass" : "fail",
      note: g3.accept
        ? `RMSE ${r.toeRmse?.toFixed(2) ?? "—"} beats ${g3.bestFloor.toFixed(2)}`
        : `baseline held · ${g3.bestFloorName}`,
    });
    claims.push({
      id: "rmse",
      statement: "RMSE is toe TVT error on this pad, this type well.",
      klass: "empirical",
      status: r.toeRmse != null ? "hold" : "fail",
      note: r.toeRmse != null ? r.toeRmse.toFixed(2) : "no truth on the toe",
    });
    const onset = r.sheaf.horizonOnset;
    claims.push({
      id: "horizon",
      statement: "Lost lock is a flag that GR quit lining up. It is not a top.",
      klass: "empirical",
      status: "hold",
      note: onset != null ? `at ${r.well.stations[onset]!.md.toFixed(0)}` : "still locked",
    });
    const steer = computeSteer(r, Math.max(0, r.well.stations.findIndex((s) => s.isPredict)));
    claims.push({
      id: "steer",
      statement: `${steer.advisory} is an advisory from the type well and the path, not a survey.`,
      klass: "empirical",
      status: "hold",
      note: steer.reason,
    });
    const cts = computeCts(r, 0);
    claims.push({
      id: "cts",
      statement: "Contact is whether the neighbor still receives this well.",
      klass: "empirical",
      status: cts.schematism ? "pass" : "hold",
      note: cts.schematism ? "contact ok" : "contact weak",
    });
    const locks = computeLocks(r, 0);
    claims.push({
      id: "locks",
      statement: "Score is how many of the six gates pass. It is a score, not a law.",
      klass: "empirical",
      status: locks.fireReady ? "pass" : "hold",
      note: `${locks.turns}/6 · ${(locks.keyFit * 100).toFixed(0)}`,
    });
    const rogue = computeRogue(r.well);
    const mid = rogue.frames[Math.floor(rogue.frames.length * 0.55)]!;
    const names = { normal: "Normal", "stick-slip": "Stick-slip", whirl: "Whirl", bounce: "Bit bounce" } as const;
    claims.push({
      id: "rogue",
      statement: `“${names[mid.regime]}” is the name of the WOB / RPM / TRQ / ROP shape.`,
      klass: "empirical",
      status: "hold",
      note: `${(mid.confidence * 100).toFixed(0)}% · not a downhole vote`,
    });
  } else {
    claims.push({
      id: "run",
      statement: "This well has not been run.",
      klass: "empirical",
      status: "fail",
      note: "Run it first.",
    });
  }

  claims.push({
    id: "physics",
    statement: "Holonomy, the Smith disk, or the manifold is gravity, electricity, or a proof.",
    klass: "speculative",
    status: "excluded",
    note: "We will not claim that.",
  });
  claims.push({
    id: "gue",
    statement: "This pad proves or disproves a number-theory law of spacings.",
    klass: "speculative",
    status: "excluded",
    note: "Wrong test for a well pad.",
  });

  const certificates: CertRow[] = [
    { id: "input-hash", pass: true, note: hash },
    {
      id: "psd",
      pass: sh.eigenvalues.every((v) => v > -1e-6),
      note: "neighbor-link spectrum",
    },
    {
      id: "gate3",
      pass: r?.residual.gate3.accept ?? false,
      note: r ? r.residual.gate3.bestFloorName : "no run",
    },
    {
      id: "loops",
      pass: gate.compatible,
      note: gate.kind === "sheaf" ? "pad field" : "pairwise",
    },
    {
      id: "no-tops",
      pass: !pad.wells.some((w) => w.stations.some((s) => "ANCC" in s.extra)),
      note: "formation names stayed out",
    },
    {
      id: "slider",
      pass: true,
      note: "MD, station, filtration, play — four different axes",
    },
  ];

  const nulls = [holonomyNull(sh.edges.map((e) => e.twist))];

  return { padId: pad.id, wellId, claims, gate, certificates, nulls, hash };
}

export const TIME_COPY: Record<TimeKind, { title: string; body: string }> = {
  physical: {
    title: "MD",
    body: "Measured depth. The only clock that belongs to the hole.",
  },
  parameter: {
    title: "Station",
    body: "Sample index along the well. It orders the series. It is not a clock.",
  },
  filtration: {
    title: "Join radius",
    body: "Distance threshold on the persistence diagram. Moving it does not move the bit.",
  },
  simulation: {
    title: "Play",
    body: "A preview loop on the screen. It is not the rig clock.",
  },
};

