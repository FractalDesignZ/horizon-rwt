import { clamp, rmse, solveSymmetric } from "./math";
import {
  MAX_TVT_DEV,
  type Gate3Result,
  type GeometryFeatures,
  type PriorBundle,
  type ResidualResult,
  type Well,
} from "./types";

function truth(well: Well) {
  return well.stations.map((s) => {
    if (s.tvt != null && Number.isFinite(s.tvt)) return s.tvt;
    if (s.tvtTrue != null && Number.isFinite(s.tvtTrue)) return s.tvtTrue;
    return NaN;
  });
}

function ridgeFit(X: number[][], y: number[], lambda = 8) {
  const p = X[0]?.length ?? 0;
  const XtX = Array.from({ length: p }, () => Array(p).fill(0));
  const Xty = Array(p).fill(0) as number[];
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i]![a]! * y[i]!;
      for (let b = 0; b < p; b++) XtX[a]![b] += X[i]![a]! * X[i]![b]!;
    }
  }
  for (let a = 0; a < p; a++) XtX[a]![a] += lambda;
  return solveSymmetric(XtX, Xty);
}

function features(well: Well, geom: GeometryFeatures, priors: PriorBundle, i: number) {
  const s = well.stations[i]!;
  const relMd = s.md - priors.psMd;
  const last = priors.lastKnown;
  return [
    1,
    relMd / 1000,
    (s.z - well.stations[0]!.z) / 100,
    geom.localCurv[i]! * 20,
    geom.eRef[i]!,
    priors.nccConf[i]!,
    priors.pfConf[i]!,
    Number.isFinite(priors.grMismatch[i]!) ? priors.grMismatch[i]! / 20 : 0,
    geom.localTorsion[i]! * 10,
    priors.adaptiveConf[i]!,
    last ? 0 : 0,
  ];
}

export function computeResidual(
  well: Well,
  geom: GeometryFeatures,
  priors: PriorBundle,
): ResidualResult {
  const n = well.stations.length;
  const yTrue = truth(well);
  const base = priors.priorStack;
  const X: number[][] = [];
  const y: number[] = [];
  const trainIdx: number[] = [];
  for (let i = 0; i < n; i++) {
    if (well.stations[i]!.isPredict) continue;
    if (!Number.isFinite(yTrue[i]!) || !Number.isFinite(base[i]!)) continue;
    trainIdx.push(i);
    X.push(features(well, geom, priors, i));
    y.push(yTrue[i]! - base[i]!);
  }

  const beta = X.length >= 12 ? ridgeFit(X, y, 12) : X[0]?.map(() => 0) ?? [0];
  const delta = Array(n).fill(0) as number[];
  for (let i = 0; i < n; i++) {
    const f = features(well, geom, priors, i);
    let d = 0;
    for (let k = 0; k < beta.length; k++) d += beta[k]! * (f[k] ?? 0);
    delta[i] = clamp(d, -MAX_TVT_DEV, MAX_TVT_DEV);
    if (!well.stations[i]!.isPredict && Number.isFinite(yTrue[i]!)) {
      delta[i] = yTrue[i]! - base[i]!;
    }
  }

  const residualPred = base.map((p, i) =>
    well.stations[i]!.isPredict
      ? p + delta[i]!
      : Number.isFinite(yTrue[i]!)
        ? yTrue[i]!
        : p,
  );
  void residualPred;

  // Honest Gate3: fit on first 75% of heel, score last 25% with unlocked priors
  const cut = Math.floor(trainIdx.length * 0.75);
  const fitIdx = trainIdx.slice(0, Math.max(cut, 8));
  const hold = trainIdx.slice(Math.max(cut, 8));
  const lastTrain = fitIdx.length
    ? (yTrue[fitIdx[fitIdx.length - 1]!] ?? priors.lastKnown)
    : priors.lastKnown;
  const Xfit = fitIdx.map((i) => features(well, geom, priors, i));
  const yfit = fitIdx.map((i) => yTrue[i]! - lastTrain);
  const betaOof = Xfit.length >= 12 ? ridgeFit(Xfit, yfit, 12) : beta;
  const holdY = hold.map((i) => yTrue[i]!);
  const holdRes = hold.map((i) => {
    const f = features(well, geom, priors, i);
    let d = 0;
    for (let k = 0; k < betaOof.length; k++) d += betaOof[k]! * (f[k] ?? 0);
    return lastTrain + clamp(d, -MAX_TVT_DEV, MAX_TVT_DEV);
  });
  const u = priors.unlocked;
  const floors: Record<string, number> = {
    last_known: rmse(holdY, hold.map(() => lastTrain)),
    prior_flat: rmse(holdY, hold.map((i) => u.flat[i]!)),
    prior_local_dip: rmse(holdY, hold.map((i) => u.localDip[i]!)),
    prior_stack: rmse(holdY, hold.map((i) => u.stack[i]!)),
    prior_best: rmse(holdY, hold.map((i) => u.best[i]!)),
    prior_pf_blend: rmse(holdY, hold.map((i) => u.pfBlend[i]!)),
  };
  const residualRmse = rmse(holdY, holdRes);
  // Pure floors only — PF/stack saw heel labels, so they are not Gate3 competitors
  const pureNames = ["last_known", "prior_flat", "prior_local_dip"] as const;
  let bestFloor = Infinity;
  let bestFloorName = "last_known";
  for (const k of pureNames) {
    const v = floors[k]!;
    if (Number.isFinite(v) && v < bestFloor) {
      bestFloor = v;
      bestFloorName = k;
    }
  }
  const accept =
    Number.isFinite(residualRmse) &&
    hold.length >= 4 &&
    residualRmse <= (floors.last_known ?? Infinity) + 1e-9 &&
    residualRmse <= bestFloor + 1e-9;

  const gate3: Gate3Result = {
    accept,
    residualRmse,
    lastKnownRmse: floors.last_known ?? NaN,
    stackRmse: floors.prior_stack ?? NaN,
    bestFloor,
    bestFloorName,
    floors,
  };

  const fire = well.stations.map((s, i) => {
    if (!s.isPredict) return false;
    if (!accept) return false;
    return priors.adaptiveConf[i]! >= 0.18;
  });

  const served = base.map((p, i) => {
    if (!well.stations[i]!.isPredict) {
      return Number.isFinite(yTrue[i]!) ? yTrue[i]! : p;
    }
    if (accept && fire[i]) {
      return p + delta[i]!;
    }
    return p;
  });

  return {
    delta,
    served,
    fire,
    useResidual: accept,
    gate3,
    priorCol: "prior_stack",
  };
}
