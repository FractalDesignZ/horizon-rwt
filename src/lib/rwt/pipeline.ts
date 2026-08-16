import { rmse } from "./math";
import { computeCts } from "./cts";
import { pickMarkers } from "./fence";
import { computeSteer } from "./steer";
import { computeLocks } from "./cycle";
import { computeGeometry } from "./geometry";
import { computePriors } from "./priors";
import { computeResidual } from "./residual";
import { computeSheaf, encodeProbability } from "./sheaf";
import type { ModeStatus, PipelineResult, Well } from "./types";

export function runPipeline(well: Well, pad: Well[]): PipelineResult {
  const geometry = computeGeometry(well);
  const priors = computePriors(well, geometry, pad);
  const residual = computeResidual(well, geometry, priors);
  const sheaf = computeSheaf(well, geometry, priors);
  const selected = residual.useResidual ? residual.served : priors.priorStack;
  const selectedName = residual.useResidual
    ? "residual + prior_stack"
    : `pure ${residual.gate3.bestFloorName}`;
  const probability = encodeProbability(well, priors, selected, sheaf);

  const y: number[] = [];
  const p: number[] = [];
  for (let i = 0; i < well.stations.length; i++) {
    const s = well.stations[i]!;
    if (!s.isPredict) continue;
    const t = s.tvtTrue;
    if (t == null || !Number.isFinite(t)) continue;
    y.push(t);
    p.push(selected[i]!);
  }
  const toeRmse = y.length ? rmse(y, p) : null;
  const onset = sheaf.horizonOnset;
  const mid = Math.min(
    well.stations.length - 1,
    Math.max(
      well.stations.findIndex((s) => s.isPredict),
      0,
    ) + Math.floor(well.stations.filter((s) => s.isPredict).length / 2),
  );
  const draft: PipelineResult = {
    well,
    geometry,
    priors,
    residual,
    sheaf,
    probability,
    selected,
    selectedName,
    toeRmse,
    modes: [],
    cts: {
      stages: [],
      tensor: { p: 0, t: 0, m: 0, f: 0 },
      value: 0,
      warp: 1,
      phi: 0,
      qPersist: 0,
      schematism: false,
      contact: 0,
      channels: [],
    },
  };
  const locks = computeLocks(draft, mid);
  const cts = computeCts(draft, mid);
  const steer = computeSteer(draft, mid);
  const markers = pickMarkers(well.typewell, 5);

  const modes: ModeStatus[] = [
    {
      id: "M0",
      name: "RESTRICT",
      role: "TVT RMSE · heel/toe mask · no form leak",
      status: "ok",
      note: `${well.stations.filter((s) => s.isPredict).length} toe stations`,
    },
    {
      id: "M1",
      name: "GEOM",
      role: "Open-curve Bishop · curvature · E_ref",
      status: "ok",
      note: `κ̅ ${geometry.meanCurv.toFixed(4)} · holonomy ${geometry.cumTwist.toFixed(3)}`,
    },
    {
      id: "M2",
      name: "PRIOR",
      role: "Last-known · flat C−Z · MD slope ≤ 0.008",
      status: "ok",
      note: `last ${priors.lastKnown.toFixed(2)} ft`,
    },
    {
      id: "M3",
      name: "MATCH",
      role: "GR@TVT book · NCC · particle stalk",
      status: "ok",
      note: `PF conf ${meanFinite(priors.pfConf).toFixed(2)}`,
    },
    {
      id: "M4",
      name: "MIDDLE_OUT",
      role: "Known heel · masked toe",
      status: "ok",
      note: `PS @ MD ${priors.psMd.toFixed(0)}`,
    },
    {
      id: "M5",
      name: "RESIDUAL",
      role: "Ridge Δ on prior_stack · Gate3",
      status: residual.useResidual ? "ok" : "warn",
      note: residual.useResidual
        ? `ACCEPT · holdout ${residual.gate3.residualRmse.toFixed(2)}`
        : `REJECT · floor ${residual.gate3.bestFloorName} ${residual.gate3.bestFloor.toFixed(2)}`,
    },
    {
      id: "M6",
      name: "CERTIFY",
      role: "Floors · provenance · serve law",
      status: "ok",
      note: toeRmse != null ? `toe RMSE ${toeRmse.toFixed(2)} ft` : "no hidden labels",
    },
    {
      id: "M7",
      name: "HORIZON",
      role: "Smith |Γ| · recoverability collapse",
      status: onset != null ? "warn" : "ok",
      note:
        onset != null
          ? `onset MD ${well.stations[onset]!.md.toFixed(0)} · |Γ| ${sheaf.smithPath[onset]!.mag.toFixed(2)}`
          : "recoverable along toe",
    },
    {
      id: "M8",
      name: "LOCKS",
      role: "Tumblers · key fit · pad sheaf",
      status: locks.fireReady ? "ok" : "warn",
      note: `${locks.turns}/6 pins · fit ${(locks.keyFit * 100).toFixed(0)}`,
    },
    {
      id: "M9",
      name: "TRANSFER",
      role: "CTS · channel stalks · pad transport",
      status: cts.schematism ? "ok" : "warn",
      note: cts.schematism
        ? `Ct coherent · Φ ${cts.phi < 1e-3 ? cts.phi.toExponential(1) : cts.phi.toFixed(3)}`
        : `schematism · contact ${cts.contact.toFixed(2)}`,
    },
    {
      id: "M10",
      name: "STEER",
      role: "Book target · geodesic · advisory",
      status: steer.advisory === "CUT" ? "warn" : "ok",
      note: `${steer.advisory} · ${steer.reason}`,
    },
    {
      id: "M11",
      name: "FENCE",
      role: "Markers · hang · pad brief",
      status: "ok",
      note: `${markers.length} book markers`,
    },
    {
      id: "M12",
      name: "COMPARE",
      role: "Pair delta · aligned MD · transfer",
      status: "ok",
      note: "neighbor on fractional MD",
    },
    {
      id: "M13",
      name: "ROGUE",
      role: "Mechanics · TDA · MoE · axioms",
      status: "ok",
      note: "WOB/RPM/TRQ/ROP on the manifold",
    },
    {
      id: "M14",
      name: "STUDIO",
      role: "Claim ledger · sheaf gate · typed time",
      status: "ok",
      note: "connection until 2-cells compose",
    },
  ];

  return { ...draft, cts, modes };
}

function meanFinite(a: number[]) {
  const f = a.filter(Number.isFinite);
  if (!f.length) return 0;
  return f.reduce((s, x) => s + x, 0) / f.length;
}

export function runPad(wells: Well[]) {
  return wells.map((w) => runPipeline(w, wells));
}

export function resultToCsv(well: Well, result: PipelineResult) {
  const lines = [
    "MD,X,Y,Z,GR,TVT_hat,TVT_true,RES,NPHI,RHOB,fire,gamma,hyp,amp,horizon,recoverability",
  ];
  for (let i = 0; i < well.stations.length; i++) {
    const s = well.stations[i]!;
    const g = result.sheaf.smithPath[i];
    const rec = result.sheaf.recoverability[i];
    const hz = result.probability[i]?.horizon ? 1 : 0;
    lines.push(
      [
        s.md.toFixed(3),
        s.x.toFixed(3),
        s.y.toFixed(3),
        s.z.toFixed(3),
        Number.isFinite(s.gr) ? s.gr.toFixed(3) : "",
        result.selected[i]?.toFixed(4) ?? "",
        s.tvtTrue != null && Number.isFinite(s.tvtTrue) ? s.tvtTrue.toFixed(4) : "",
        Number.isFinite(s.extra.RES) ? s.extra.RES!.toFixed(4) : "",
        Number.isFinite(s.extra.NPHI) ? s.extra.NPHI!.toFixed(4) : "",
        Number.isFinite(s.extra.RHOB) ? s.extra.RHOB!.toFixed(4) : "",
        result.residual.fire[i] ? 1 : 0,
        g?.mag.toFixed(5) ?? "",
        g?.hyp.toFixed(5) ?? "",
        g?.amp.toFixed(4) ?? "",
        hz,
        rec != null ? rec.toFixed(4) : "",
      ].join(","),
    );
  }
  return lines.join("\n");
}