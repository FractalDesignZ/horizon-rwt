import { clamp, mean, std } from "./math";
import { wellPersistence } from "./cycle";
import type { ChannelStat, CtsReport, CtsStage, PipelineResult, TensorPoint, Well } from "./types";
import { LOG_CHANNELS } from "./types";

function series(well: Well, name: string): number[] {
  return well.stations.map((s) => {
    if (name === "GR") return s.gr;
    const v = s.extra[name];
    return v != null && Number.isFinite(v) ? v : NaN;
  });
}

function corr(a: number[], b: number[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < a.length; i++) {
    if (Number.isFinite(a[i]!) && Number.isFinite(b[i]!)) {
      xs.push(a[i]!);
      ys.push(b[i]!);
    }
  }
  if (xs.length < 4) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const u = xs[i]! - mx;
    const v = ys[i]! - my;
    num += u * v;
    dx += u * u;
    dy += v * v;
  }
  return num / Math.max(Math.sqrt(dx * dy), 1e-9);
}

function autocorr(a: number[], lag = 1) {
  const f = a.filter(Number.isFinite);
  if (f.length < lag + 4) return 0;
  return corr(f.slice(0, f.length - lag), f.slice(lag));
}

function dominantFreq(a: number[]) {
  const f = a.filter(Number.isFinite);
  const n = Math.min(f.length, 64);
  if (n < 8) return 0;
  const x = f.slice(0, n);
  const m = mean(x);
  let best = 0;
  let bestK = 1;
  for (let k = 1; k <= Math.floor(n / 4); k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const ang = (-2 * Math.PI * k * i) / n;
      const v = x[i]! - m;
      re += v * Math.cos(ang);
      im += v * Math.sin(ang);
    }
    const p = re * re + im * im;
    if (p > best) {
      best = p;
      bestK = k;
    }
  }
  return bestK / n;
}

function channelStats(well: Well): ChannelStat[] {
  const gr = series(well, "GR");
  const names = ["GR", ...LOG_CHANNELS.filter((n) => n !== "GR" && well.stations.some((s) => Number.isFinite(s.extra[n]!)))];
  return names.map((name) => {
    const y = series(well, name);
    return {
      name,
      mean: mean(y),
      std: std(y),
      corrGr: name === "GR" ? 1 : corr(gr, y),
    };
  });
}

export function computeCts(
  result: Pick<PipelineResult, "well" | "geometry" | "priors" | "sheaf" | "probability">,
  station: number,
): CtsReport {
  const well = result.well;
  const i = Math.max(0, Math.min(station, well.stations.length - 1));
  const channels = channelStats(well);
  const ph = wellPersistence(result);
  const persist = ph.mergeScale ?? 0;
  const tensor: TensorPoint = {
    p: clamp(persist / 2, 0, 1),
    t: clamp((autocorr(series(well, "GR")) + 1) / 2, 0, 1),
    m: clamp((mean(series(well, "GR")) - 40) / 80, 0, 1),
    f: clamp(dominantFreq(series(well, "GR")) * 8, 0, 1),
  };
  const value = clamp(result.priors.adaptiveConf[i] ?? 0, 0, 1);
  const warp = Math.exp(-2.2 * value);
  const phi = result.sheaf.algebraicConnectivity;
  const qPersist = persist;
  const contact = clamp(result.priors.grAgree[i] ?? 0, 0, 1);
  const schematism =
    contact > 0.08 &&
    contact < 0.98 &&
    Number.isFinite(qPersist) &&
    qPersist > 0 &&
    (phi > 1e-8 || tensor.p > 0.05);

  const stages: CtsStage[] = [
    {
      id: "X",
      name: "State",
      value: `${channels.length} ch`,
      ok: channels.length >= 2,
      note: "data[channel, …]",
    },
    {
      id: "U",
      name: "Tensor",
      value: `P${tensor.p.toFixed(2)}`,
      ok: true,
      note: `T ${tensor.t.toFixed(2)} · F ${tensor.f.toFixed(2)}`,
    },
    {
      id: "Mv",
      name: "Warp",
      value: warp.toFixed(2),
      ok: warp < 0.95,
      note: `v ${value.toFixed(2)} · e^{−βv}`,
    },
    {
      id: "Q",
      name: "Persist",
      value: qPersist.toFixed(2),
      ok: qPersist > 0,
      note: `β₁ ${ph.beta1}`,
    },
    {
      id: "Φ",
      name: "Coherence",
      value: phi < 1e-3 ? phi.toExponential(1) : phi.toFixed(3),
      ok: phi > 1e-5,
      note: schematism ? "schematism holds" : "schematism fail",
    },
  ];

  return {
    stages,
    tensor,
    value,
    warp,
    phi,
    qPersist,
    schematism,
    contact,
    channels,
  };
}

export function channelAt(well: Well, name: string, i: number) {
  if (name === "GR") return well.stations[i]!.gr;
  const v = well.stations[i]!.extra[name];
  return v != null && Number.isFinite(v) ? v : NaN;
}

export { series as channelSeries };
