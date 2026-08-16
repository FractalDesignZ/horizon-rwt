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
      reason: "No 2-cells. Pairwise transports stay a connection. H¹ stays closed.",
    };
  }
  const compatible = maxRes < 0.18;
  return {
    kind: compatible ? "sheaf" : "connection",
    triangles,
    maxCycleResidual: maxRes,
    compatible,
    reason: compatible
      ? `${triangles} triangles · max |Π−I| ${maxRes.toFixed(3)} · restriction maps compose`
      : `${triangles} triangles · cycle residual ${maxRes.toFixed(3)} fails functoriality · connection only`,
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
    name: "Edge-twist shuffle",
    justification:
      "Diagnostic only. Permutes observed twists; preserves the multiset, destroys cycle incidence. Not a GUE null.",
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
    statement: "Γ = (z−1)/(z+1) is the Smith chart of the normalized mismatch.",
    klass: "identity",
    status: "pass",
    note: "Definition. Not a discovery.",
  });
  claims.push({
    id: "lap-psd",
    statement: "The assembled connection Laplacian is positive semidefinite.",
    klass: "certificate",
    status: sh.eigenvalues.every((v) => v > -1e-6) ? "pass" : "fail",
    note: `λmin ${ (sh.eigenvalues[0] ?? 0).toFixed(4) }`,
  });
  claims.push({
    id: "holonomy",
    statement: "Pad cycle product is discrete connection holonomy.",
    klass: "certificate",
    status: "pass",
    note: `Σ twist ${sh.holonomy.toFixed(3)} · not spacetime curvature`,
  });
  claims.push({
    id: "higher-sheaf",
    statement: "H¹ of a cellular sheaf is available.",
    klass: "certificate",
    status: gate.compatible ? "pass" : "excluded",
    note: gate.reason,
  });

  if (r) {
    const g3 = r.residual.gate3;
    claims.push({
      id: "gate3",
      statement: "Toe residual may ship only if it beats every pure-prior floor.",
      klass: "certificate",
      status: g3.accept ? "pass" : "fail",
      note: g3.accept
        ? `RMSE ${r.toeRmse?.toFixed(2) ?? "—"} < floor ${g3.bestFloor.toFixed(2)}`
        : `blocked by ${g3.bestFloorName}`,
    });
    claims.push({
      id: "rmse",
      statement: "Certified toe RMSE is an empirical score on this pad, this book.",
      klass: "empirical",
      status: r.toeRmse != null ? "hold" : "fail",
      note: r.toeRmse != null ? r.toeRmse.toFixed(2) : "no truth on toe",
    });
    const onset = r.sheaf.horizonOnset;
    claims.push({
      id: "horizon",
      statement: "Horizon onset is an operational flag (|Γ| and recoverability), not a formation top.",
      klass: "empirical",
      status: "hold",
      note: onset != null ? `MD ${r.well.stations[onset]!.md.toFixed(0)}` : "no onset on this well",
    });
    const steer = computeSteer(r, Math.max(0, r.well.stations.findIndex((s) => s.isPredict)));
    claims.push({
      id: "steer",
      statement: `${steer.advisory} is an advisory from book window + geodesic, not a survey.`,
      klass: "empirical",
      status: "hold",
      note: steer.reason,
    });
    const cts = computeCts(r, 0);
    claims.push({
      id: "cts",
      statement: "CTS schematism is a discrete contact test, not a physical field.",
      klass: "empirical",
      status: cts.schematism ? "pass" : "hold",
      note: `Φ ${cts.phi < 1e-3 ? cts.phi.toExponential(1) : cts.phi.toFixed(3)}`,
    });
    const locks = computeLocks(r, 0);
    claims.push({
      id: "locks",
      statement: "Key fit is a tumbler score, not an identity.",
      klass: "empirical",
      status: locks.fireReady ? "pass" : "hold",
      note: `${locks.turns}/6 · ${(locks.keyFit * 100).toFixed(0)}`,
    });
    const rogue = computeRogue(r.well);
    const mid = rogue.frames[Math.floor(rogue.frames.length * 0.55)]!;
    claims.push({
      id: "rogue",
      statement: `Regime “${mid.regime}” is a Betti+feature classification of WOB/RPM/TRQ/ROP.`,
      klass: "empirical",
      status: "hold",
      note: `${(mid.confidence * 100).toFixed(0)}% · not a downhole sensor vote`,
    });
  } else {
    claims.push({
      id: "run",
      statement: "No pipeline result for the selected well.",
      klass: "empirical",
      status: "fail",
      note: "Run the well first.",
    });
  }

  claims.push({
    id: "physics",
    statement: "Holonomy, sheaf spectrum, or Rogue manifold is electromagnetic / gravitational / RH.",
    klass: "speculative",
    status: "excluded",
    note: "No model tying fibers, units, and dynamics. Studio will not assert this.",
  });
  claims.push({
    id: "gue",
    statement: "This pad’s spectrum is GUE or disproves GUE.",
    klass: "speculative",
    status: "excluded",
    note: "GUE is a zeta/point-spectrum null. Wrong null for a well pad.",
  });

  const certificates: CertRow[] = [
    { id: "input-hash", pass: true, note: hash },
    {
      id: "psd",
      pass: sh.eigenvalues.every((v) => v > -1e-6),
      note: "connection Laplacian",
    },
    {
      id: "gate3",
      pass: r?.residual.gate3.accept ?? false,
      note: r ? r.residual.gate3.bestFloorName : "no run",
    },
    {
      id: "sheaf-gate",
      pass: gate.compatible,
      note: gate.kind,
    },
    {
      id: "no-leak",
      pass: !pad.wells.some((w) => w.stations.some((s) => "ANCC" in s.extra)),
      note: "form-leak mnemonics absent",
    },
    {
      id: "time-typed",
      pass: true,
      note: "MD physical · station parameter · ε filtration · play simulation",
    },
  ];

  const nulls = [holonomyNull(sh.edges.map((e) => e.twist))];

  return { padId: pad.id, wellId, claims, gate, certificates, nulls, hash };
}

export const TIME_COPY: Record<TimeKind, { title: string; body: string }> = {
  physical: {
    title: "Physical time",
    body: "A timestamp or measured-depth clock. MD on this pad is the only physical coordinate.",
  },
  parameter: {
    title: "Trajectory parameter",
    body: "Station index along the well. It orders samples. It is not a clock and not ε.",
  },
  filtration: {
    title: "Filtration scale",
    body: "ε of the Rips complex. Sweeping it does not advance the bit.",
  },
  simulation: {
    title: "Simulation time",
    body: "Play-MD is a display loop. It is not drilling time and not a Hamiltonian.",
  },
};
