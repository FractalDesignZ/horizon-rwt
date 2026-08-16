export const CANONICAL_CHANNELS = [
  "MD",
  "X",
  "Y",
  "Z",
  "GR",
  "TVT",
  "TVT_input",
  "RES",
  "NPHI",
  "RHOB",
  "CALI",
  "DT",
  "PE",
  "WOB",
  "RPM",
  "TRQ",
  "ROP",
] as const;

export type CanonicalChannel = (typeof CANONICAL_CHANNELS)[number];

export const CHANNEL_ALIASES: Record<string, CanonicalChannel> = {
  md: "MD",
  measureddepth: "MD",
  measured_depth: "MD",
  dept: "MD",
  depth: "MD",
  x: "X",
  easting: "X",
  y: "Y",
  northing: "Y",
  z: "Z",
  tvd: "Z",
  ss: "Z",
  gr: "GR",
  gammaray: "GR",
  gamma_ray: "GR",
  sgr: "GR",
  cgr: "GR",
  tvt: "TVT",
  trueverticalthickness: "TVT",
  tvt_input: "TVT_input",
  tvtinput: "TVT_input",
  res: "RES",
  rt: "RES",
  ild: "RES",
  lld: "RES",
  nphi: "NPHI",
  neu: "NPHI",
  rhob: "RHOB",
  den: "RHOB",
  rhoz: "RHOB",
  cali: "CALI",
  cal: "CALI",
  dt: "DT",
  ac: "DT",
  dtc: "DT",
  pe: "PE",
  pef: "PE",
  wob: "WOB",
  weightonbit: "WOB",
  weight_on_bit: "WOB",
  rpm: "RPM",
  rotary: "RPM",
  trq: "TRQ",
  torque: "TRQ",
  rop: "ROP",
  rateofpenetration: "ROP",
  rate_of_penetration: "ROP",
};

export const LAS_NULLS = [-999.25, -999, -9999, -9999.25, -999.99];

export const MAX_TVT_DEV = 18;
export const MAX_MD_SLOPE = 0.008;
export const GR_AGREE_SCALE = 20;

export interface Station {
  md: number;
  x: number;
  y: number;
  z: number;
  gr: number;
  tvt: number | null;
  tvtInput: number | null;
  isPredict: boolean;
  tvtTrue?: number;
  extra: Record<string, number>;
}

export interface BedTop {
  name: string;
  tvt: number;
}

export interface Typewell {
  tvt: number[];
  gr: number[];
  tops?: BedTop[];
}

export interface Well {
  id: string;
  name: string;
  padId: string;
  stations: Station[];
  typewell: Typewell;
  sourceFormat: string;
  channels: string[];
  area?: string;
}

export interface GeometryFeatures {
  nStations: number;
  mdSpan: number;
  deltaZ: number;
  pathLength: number;
  meanCurv: number;
  maxCurv: number;
  cumTwist: number;
  absCumTwist: number;
  twistStd: number;
  meanAbsTorsion: number;
  meanERef: number;
  maxERef: number;
  tortuosity: number;
  signedAzimuth: number;
  azimuthDeg: number;
  dipDeg: number;
  localCurv: number[];
  localTorsion: number[];
  eRef: number[];
}

export interface PriorBundle {
  lastKnown: number;
  psMd: number;
  priorLast: number[];
  priorFlat: number[];
  priorLocalDip: number[];
  priorDipStack: number[];
  priorNcc: number[];
  nccConf: number[];
  priorPf: number[];
  priorPfBlend: number[];
  pfConf: number[];
  pfStd: number[];
  priorStack: number[];
  priorBest: number[];
  neighborTvt: number[];
  neighborOk: number[];
  grMismatch: number[];
  grAgree: number[];
  adaptiveConf: number[];
  particlesAt: number[][];
  unlocked: {
    last: number[];
    flat: number[];
    localDip: number[];
    stack: number[];
    best: number[];
    pfBlend: number[];
  };
}

export interface ResidualResult {
  delta: number[];
  served: number[];
  fire: boolean[];
  useResidual: boolean;
  gate3: Gate3Result;
  priorCol: string;
}

export interface Gate3Result {
  accept: boolean;
  residualRmse: number;
  lastKnownRmse: number;
  stackRmse: number;
  bestFloor: number;
  bestFloorName: string;
  floors: Record<string, number>;
}

export interface ProbabilityFrame {
  bins: number[];
  mass: number[];
  mode: number;
  mean: number;
  std: number;
  entropy: number;
  horizon: boolean;
  horizonScore: number;
}

export interface SmithPoint {
  re: number;
  im: number;
  mag: number;
  arg: number;
  hyp: number;
  amp: number;
}

export interface SheafReport {
  eigenvalues: number[];
  kernelDim: number;
  frustration: number;
  holonomy: number;
  algebraicConnectivity: number;
  smithPath: SmithPoint[];
  horizonOnset: number | null;
  winding: number;
  nearKernel: number;
  condition: number;
  recoverability: number[];
  decoupling: number[];
}

export interface PipelineResult {
  well: Well;
  geometry: GeometryFeatures;
  priors: PriorBundle;
  residual: ResidualResult;
  sheaf: SheafReport;
  probability: ProbabilityFrame[];
  selected: number[];
  selectedName: string;
  toeRmse: number | null;
  modes: ModeStatus[];
  cts: CtsReport;
}

export type SteerCall = "HOLD" | "BUILD" | "DROP" | "CUT";

export interface SteerSample {
  i: number;
  md: number;
  mean: number;
  lo: number;
  hi: number;
  geo: number;
  book: number;
  rec: number;
  horizon: boolean;
}

export interface SteerReport {
  bit: number;
  bitMd: number;
  bitTvt: number;
  remaining: number;
  onsetMd: number | null;
  mdToHorizon: number | null;
  advisory: SteerCall;
  reason: string;
  windowLo: number;
  windowHi: number;
  target: number;
  samples: SteerSample[];
  geoEnd: number;
  risk: number;
}

export interface ModeStatus {
  id: string;
  name: string;
  role: string;
  status: "ok" | "warn" | "idle";
  note: string;
}

export interface PadField {
  id: string;
  name: string;
  wells: Well[];
  typewell: Typewell;
}

export interface LockTumbler {
  id: string;
  name: string;
  value: number;
  locked: boolean;
  note: string;
}

export interface LockReport {
  tumblers: LockTumbler[];
  keyFit: number;
  turns: number;
  fireReady: boolean;
}

export interface PadNode {
  id: string;
  x: number;
  y: number;
  last: number;
  azi: number;
}

export interface PadEdge {
  a: string;
  b: string;
  dist: number;
  twist: number;
  stiffness: number;
  tension: number;
}

export interface PadSheaf {
  nodes: PadNode[];
  edges: PadEdge[];
  eigenvalues: number[];
  kernelDim: number;
  frustration: number;
  algebraicConnectivity: number;
  holonomy: number;
}

export interface PersistBar {
  dim: 0 | 1;
  birth: number;
  death: number;
  label: string;
}

export interface PersistReport {
  bars: PersistBar[];
  beta0: number;
  beta1: number;
  mergeScale: number | null;
}

export const FORM_LEAK = ["ANCC", "ASTNU", "ASTNL", "EGFDU", "EGFDL", "BUDA"];

export const LOG_CHANNELS = ["GR", "RES", "NPHI", "RHOB", "DT", "PE", "CALI"] as const;

export interface ChannelStat {
  name: string;
  mean: number;
  std: number;
  corrGr: number;
}

export interface TensorPoint {
  p: number;
  t: number;
  m: number;
  f: number;
}

export interface CtsStage {
  id: string;
  name: string;
  value: string;
  ok: boolean;
  note: string;
}

export interface CtsReport {
  stages: CtsStage[];
  tensor: TensorPoint;
  value: number;
  warp: number;
  phi: number;
  qPersist: number;
  schematism: boolean;
  contact: number;
  channels: ChannelStat[];
}

export interface TransferHit {
  wellId: string;
  weight: number;
  tension: number;
  shift: number;
  frame: ProbabilityFrame;
}
