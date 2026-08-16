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
    ? "residual + stack"
    : residual.gate3.bestFloorName;
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
      id: "1",
      name: "Bounds",
      role: "Unlabeled interval",
      status: "ok",
      note: `${well.stations.filter((s) => s.isPredict).length} stations unlabeled`,
    },
    {
      id: "2",
      name: "Geometry",
      role: "Wellpath",
      status: "ok",
      note: `twist ${geometry.cumTwist.toFixed(2)}`,
    },
    {
      id: "3",
      name: "Prior",
      role: "Last known TVT",
      status: "ok",
      note: `last ${priors.lastKnown.toFixed(1)} ft`,
    },
    {
      id: "4",
      name: "Correlation",
      role: "GR vs type well",
      status: "ok",
      note: `particles ${(meanFinite(priors.pfConf) * 100).toFixed(0)}`,
    },
    {
      id: "5",
      name: "Split",
      role: "Labeled / unlabeled",
      status: "ok",
      note: `split at ${priors.psMd.toFixed(0)}`,
    },
    {
      id: "6",
      name: "Residual",
      role: "Accept if beats baseline",
      status: residual.useResidual ? "ok" : "warn",
      note: residual.useResidual
        ? `clears baseline · ${residual.gate3.residualRmse.toFixed(2)}`
        : `baseline held · ${residual.gate3.bestFloorName}`,
    },
    {
      id: "7",
      name: "Score",
      role: "Toe RMSE",
      status: "ok",
      note: toeRmse != null ? `RMSE ${toeRmse.toFixed(2)} ft` : "no hidden truth",
    },
    {
      id: "8",
      name: "Alert",
      role: "Lost lock",
      status: onset != null ? "warn" : "ok",
      note:
        onset != null
          ? `alert at ${well.stations[onset]!.md.toFixed(0)}`
          : "still locked on the toe",
    },
    {
      id: "9",
      name: "Gates",
      role: "Six acceptance checks",
      status: locks.fireReady ? "ok" : "warn",
      note: `${locks.turns}/6 pass · ${(locks.keyFit * 100).toFixed(0)} score`,
    },
    {
      id: "10",
      name: "Transfer",
      role: "Neighbor posterior",
      status: cts.schematism ? "ok" : "warn",
      note: cts.schematism ? "contact ok" : "contact weak",
    },
    {
      id: "11",
      name: "Advisory",
      role: "HOLD / BUILD / DROP / CUT",
      status: steer.advisory === "CUT" ? "warn" : "ok",
      note: `${steer.advisory} · ${steer.reason}`,
    },
    {
      id: "12",
      name: "Fence",
      role: "Pad cross-section",
      status: "ok",
      note: `${markers.length} markers on type well`,
    },
    {
      id: "13",
      name: "Compare",
      role: "Aligned wells",
      status: "ok",
      note: "aligned on MD",
    },
    {
      id: "14",
      name: "Drilling",
      role: "WOB RPM TRQ ROP",
      status: "ok",
      note: "regime + setpoints",
    },
    {
      id: "15",
      name: "Audit",
      role: "Claim ledger",
      status: "ok",
      note: "pairwise until cycles close",
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