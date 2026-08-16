import { clamp, mean, solveSymmetric } from "./math";
import { MAX_MD_SLOPE, MAX_TVT_DEV, type GeometryFeatures, type PriorBundle, type Well } from "./types";
import { fitHeelAffine, grAgree, grMismatch, nccTrack } from "./ncc";
import { bagPf, blendPfLast } from "./particle";

function knownTvt(well: Well) {
  return well.stations.map((s) => {
    const v = s.tvtInput ?? s.tvt;
    return v != null && Number.isFinite(v) ? v : NaN;
  });
}

function lastKnownOf(well: Well) {
  const k = knownTvt(well);
  for (let i = k.length - 1; i >= 0; i--) if (Number.isFinite(k[i]!)) return k[i]!;
  return NaN;
}

export function neighborTransfer(target: Well, pad: Well[]) {
  const n = target.stations.length;
  const out = Array(n).fill(NaN) as number[];
  const ok = Array(n).fill(0) as number[];
  const cx = mean(target.stations.map((s) => s.x));
  const cy = mean(target.stations.map((s) => s.y));
  const neighbors = pad
    .filter((w) => w.id !== target.id)
    .map((w) => {
      const wx = mean(w.stations.map((s) => s.x));
      const wy = mean(w.stations.map((s) => s.y));
      const d = Math.hypot(wx - cx, wy - cy);
      const last = lastKnownOf(w);
      return { d, last, w };
    })
    .filter((n0) => Number.isFinite(n0.last) && n0.d < 1800)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  if (!neighbors.length) return { neighborTvt: out, neighborOk: ok };
  const tLast = lastKnownOf(target);
  for (let i = 0; i < n; i++) {
    let num = 0;
    let den = 0;
    for (const nb of neighbors) {
      const wgt = 1 / Math.max(nb.d, 40);
      num += wgt * nb.last;
      den += wgt;
    }
    const est = num / Math.max(den, 1e-9);
    out[i] = Number.isFinite(tLast)
      ? tLast + clamp(est - tLast, -MAX_TVT_DEV, MAX_TVT_DEV)
      : est;
    ok[i] = clamp(1 - neighbors[0]!.d / 1800, 0.2, 0.95);
  }
  return { neighborTvt: out, neighborOk: ok };
}

export function computePriors(
  well: Well,
  geom: GeometryFeatures,
  pad: Well[],
): PriorBundle {
  const n = well.stations.length;
  const known = knownTvt(well);
  const last = lastKnownOf(well);
  const md = well.stations.map((s) => s.md);
  const z = well.stations.map((s) => s.z);
  const x = well.stations.map((s) => s.x);
  const y = well.stations.map((s) => s.y);

  let psMd = md[0] ?? 0;
  let psZ = z[0] ?? 0;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(known[i]!)) {
      psMd = md[i]!;
      psZ = z[i]!;
    }
  }

  const priorLast = Array(n).fill(last) as number[];
  for (let i = 0; i < n; i++) if (Number.isFinite(known[i]!)) priorLast[i] = known[i]!;

  const heelIdx: number[] = [];
  for (let i = 0; i < n; i++) if (Number.isFinite(known[i]!) && Number.isFinite(z[i]!)) heelIdx.push(i);
  const fitIdx = heelIdx.slice(-Math.min(120, heelIdx.length));
  const C =
    fitIdx.length >= 3
      ? mean(fitIdx.map((i) => known[i]! + z[i]!))
      : last + (Number.isFinite(psZ) ? psZ : 0);
  const priorFlat = z.map((zi, i) =>
    Number.isFinite(known[i]!) ? known[i]! : C - zi,
  );

  let mdSlope = 0;
  if (fitIdx.length >= 8) {
    const a = fitIdx[0]!;
    const b = fitIdx[fitIdx.length - 1]!;
    const dmd = md[b]! - md[a]!;
    if (Math.abs(dmd) > 1) {
      mdSlope = clamp((known[b]! - known[a]!) / dmd, -MAX_MD_SLOPE, MAX_MD_SLOPE);
    }
  }
  const priorLocalDip = md.map((m, i) =>
    Number.isFinite(known[i]!) ? known[i]! : last + mdSlope * (m - psMd),
  );

  let cx = 0;
  let cy = 0;
  const dipTrend = Array(n).fill(0) as number[];
  if (fitIdx.length >= 4) {
    const Xh = fitIdx.map((i) => [x[i]!, y[i]!]);
    const res = fitIdx.map((i) => known[i]! - (C - z[i]!));
    const mx = mean(Xh.map((r) => r[0]!));
    const my = mean(Xh.map((r) => r[1]!));
    const ym = mean(res);
    const XtX = [
      [0, 0],
      [0, 0],
    ];
    const Xty = [0, 0];
    for (let k = 0; k < Xh.length; k++) {
      const dx = Xh[k]![0]! - mx;
      const dy = Xh[k]![1]! - my;
      const yc = res[k]! - ym;
      XtX[0]![0] += dx * dx;
      XtX[0]![1] += dx * dy;
      XtX[1]![0] += dy * dx;
      XtX[1]![1] += dy * dy;
      Xty[0] += dx * yc;
      Xty[1] += dy * yc;
    }
    XtX[0]![0] += 50;
    XtX[1]![1] += 50;
    const coef = solveSymmetric(XtX, Xty);
    cx = coef[0]!;
    cy = coef[1]!;
    const intercept = ym - cx * mx - cy * my;
    for (let i = 0; i < n; i++) {
      const rel = Math.max(md[i]! - psMd, 0);
      const w = Math.exp(-rel / 2500);
      dipTrend[i] = w * (cx * x[i]! + cy * y[i]! + intercept);
    }
  }
  const priorDipStack = priorFlat.map((f, i) =>
    Number.isFinite(known[i]!) ? known[i]! : f + dipTrend[i]!,
  );

  const { a, b } = fitHeelAffine(well);
  const ncc = nccTrack(well, last);
  const pf = bagPf(well, last, a, b);
  const priorPfBlend = blendPfLast(pf.priorBag, last, pf.pfConf);
  const pfBlendUnlocked = priorPfBlend.slice();
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(known[i]!)) {
      pf.priorPf[i] = known[i]!;
      pf.priorBag[i] = known[i]!;
      priorPfBlend[i] = known[i]!;
    }
  }

  const { neighborTvt, neighborOk } = neighborTransfer(well, pad);

  const priorStackUnlocked = priorDipStack.map((dip, i) => {
    const dipDelta = clamp(dip - last, -MAX_TVT_DEV, MAX_TVT_DEV);
    const struct = last + 0.15 * dipDelta;
    const c = clamp((pf.pfConf[i]! - 0.25) / 0.45, 0, 1);
    const pfDelta = clamp(pfBlendUnlocked[i]! - last, -MAX_TVT_DEV, MAX_TVT_DEV);
    let out = (1 - c) * struct + c * (last + pfDelta);
    const nc = ncc.nccConf[i]!;
    if (nc > 0.45 && Number.isFinite(ncc.priorNcc[i]!)) {
      const cn = clamp((nc - 0.45) / 0.4, 0, 1) * 0.2;
      const nd = clamp(ncc.priorNcc[i]! - last, -MAX_TVT_DEV, MAX_TVT_DEV);
      out = (1 - cn) * out + cn * (last + nd);
    }
    return last + clamp(out - last, -MAX_TVT_DEV, MAX_TVT_DEV);
  });
  const priorStack = priorStackUnlocked.map((out, i) =>
    Number.isFinite(known[i]!) ? known[i]! : out,
  );

  const priorBestUnlocked = priorStackUnlocked.map((stack, i) => {
    const conf = clamp(pf.pfConf[i]!, 0, 1);
    const wLast = 0.24 + 0.14 * (1 - conf);
    const wStack = 0.42 + 0.1 * conf;
    const wPf = 0.06 + 0.16 * conf;
    const wLoc = 0.02 * (1 - conf);
    const wNb =
      Number.isFinite(neighborTvt[i]!) && neighborOk[i]! > 0.55
        ? 0.08 * neighborOk[i]! * conf
        : 0;
    const wNcc = 0.22 * ncc.nccConf[i]!;
    const wSum = wLast + wStack + wPf + wLoc + wNb + wNcc || 1;
    const v =
      (wLast * last +
        wStack * stack +
        wPf * pfBlendUnlocked[i]! +
        wLoc * priorLocalDip[i]! +
        wNb * (neighborTvt[i] ?? last) +
        wNcc * (ncc.priorNcc[i] ?? last)) /
      wSum;
    return last + clamp(v - last, -MAX_TVT_DEV, MAX_TVT_DEV);
  });
  const priorBest = priorBestUnlocked.map((v, i) =>
    Number.isFinite(known[i]!) ? known[i]! : v,
  );

  const mismatch = grMismatch(well, priorBest, a, b);
  const agree = grAgree(mismatch.map(Math.abs));
  const adaptive = agree.map((g, i) => g * clamp(pf.pfConf[i]!, 0, 1));

  void geom;

  return {
    lastKnown: last,
    psMd,
    priorLast,
    priorFlat,
    priorLocalDip,
    priorDipStack,
    priorNcc: ncc.priorNcc,
    nccConf: ncc.nccConf,
    priorPf: pf.priorPf,
    priorPfBlend,
    pfConf: pf.pfConf,
    pfStd: pf.pfStd,
    priorStack,
    priorBest,
    neighborTvt,
    neighborOk,
    grMismatch: mismatch,
    grAgree: agree,
    adaptiveConf: adaptive,
    particlesAt: pf.particlesAt,
    unlocked: {
      last: Array(n).fill(last),
      flat: priorFlat.map((v, i) =>
        Number.isFinite(known[i]!) ? C - z[i]! : v,
      ),
      localDip: priorLocalDip.map((v, i) =>
        Number.isFinite(known[i]!) ? last + mdSlope * (md[i]! - psMd) : v,
      ),
      stack: priorStackUnlocked,
      best: priorBestUnlocked,
      pfBlend: pfBlendUnlocked,
    },
  };
}
