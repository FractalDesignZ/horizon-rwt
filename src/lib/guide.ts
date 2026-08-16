export interface GuideArticle {
  id: string;
  title: string;
  blurb: string;
  body: string[];
  also?: string;
}

export const GUIDE: GuideArticle[] = [
  {
    id: "field",
    title: "Project",
    blurb: "Starts empty. Only files you import are in the session.",
    body: [
      "Horizon does not ship field data. Import LAS, CSV, JSON, or data[channel, …] files. Several files, or several wells in one file, are split into objects.",
      "A type well (TVT + GR, no survey) attaches to the laterals. Formation-top name columns on a well file are dropped.",
      "Generate test wells is a dry-run only. Those laterals are not field data and are not saved.",
    ],
    also: "empty project, import, test wells",
  },
  {
    id: "pad",
    title: "Pad",
    blurb: "The well group that shares one type well.",
    body: [
      "A pad is laterals that share a surface and a type well. Offset laterals may each keep their own type well.",
      "Dashboard, Fence, and Compare operate on the current project. Fence hangs only the wells in the same area as the one you have open.",
    ],
    also: "well group, field, project",
  },
  {
    id: "load",
    title: "Import",
    blurb: "Upload a log file. Columns are mapped to channels.",
    body: [
      "Drop one or many well files (LAS, CSV, JSON, or data[channel, …]) or a type well (TVT, GR, Geology).",
      "The parser splits mixed objects. Map columns sends only headers and a few sample rows to the assistant when names are unclear. Full curves stay local.",
      "Formation-top columns on the well file are dropped so they cannot leak. Files longer than ~400 stations are thinned.",
    ],
    also: "ingest, upload, LAS, channel index",
  },
  {
    id: "book",
    title: "Type well",
    blurb: "GR versus TVT — the reference curve for the pad.",
    body: [
      "The type well is GR on TVT. Every lateral is correlated against that curve.",
      "When live GR matches a stretch of the type well, that TVT is the current pick.",
    ],
    also: "type log, GR@TVT",
  },
  {
    id: "bed",
    title: "TVT",
    blurb: "True vertical thickness — stratigraphic position.",
    body: [
      "TVT is where you sit in the section. MD is how far you have drilled.",
      "Predict outputs a TVT pick and a confidence band at each station.",
    ],
    also: "true vertical thickness, stratigraphic position",
  },
  {
    id: "gamma",
    title: "GR",
    blurb: "Gamma ray — the primary correlation curve.",
    body: [
      "GR is the main channel. High and low intervals are the pattern we match.",
      "RES, NPHI, RHOB, DT, PE ride along as extra channels. They do not replace GR.",
    ],
    also: "gamma ray",
  },
  {
    id: "last-bed",
    title: "Last known",
    blurb: "The last labeled TVT before the unlabeled interval.",
    body: [
      "Until landing, TVT is labeled. After that the model forecasts ahead of the bit.",
      "Last known is the start of every forecast. Offset last known to run a what-if.",
    ],
    also: "last-known prior, labeled TVT",
  },
  {
    id: "match",
    title: "Correlation",
    blurb: "Does live GR line up with the type well?",
    body: [
      "Normalized cross-correlation slides live GR against the type well.",
      "A particle filter keeps a posterior over TVT. Tight posterior = high confidence.",
    ],
    also: "NCC, particle filter, GR agree",
  },
  {
    id: "floor",
    title: "Baseline",
    blurb: "The model must beat a simple prior on held-out wells.",
    body: [
      "Baselines: last known, flat hold, local dip. Residual is accepted only if it beats every baseline out of fold.",
      "If it does not, the selected output is the winning baseline.",
    ],
    also: "Gate 3, OOF floor, residual law",
  },
  {
    id: "leftover",
    title: "Residual",
    blurb: "The model correction. Shipped only if it beats baseline.",
    body: [
      "Residual is what remains after the simple prior. It may improve RMSE. It may not.",
      "It is selected only when out-of-fold RMSE beats every baseline. Otherwise baseline stands.",
    ],
    also: "Gate 3 accept, residual model",
  },
  {
    id: "miss",
    title: "RMSE",
    blurb: "Toe error against hidden labels, when labels exist.",
    body: [
      "RMSE is feet of TVT error on the unlabeled interval, if truth is present.",
      "No labels, no score. Demo wells carry hidden truth so the number is real.",
    ],
    also: "toe RMSE, holdout error",
  },
  {
    id: "lost",
    title: "Lost lock",
    blurb: "Correlation collapsed. Do not steer on it.",
    body: [
      "When mismatch is high and recoverability is low, the lock is lost.",
      "That is an alert, not a formation top. Advisory goes to CUT.",
    ],
    also: "horizon onset, recoverability collapse",
  },
  {
    id: "bounce",
    title: "Mismatch",
    blurb: "How far live GR has departed from the type well.",
    body: [
      "Mismatch is |Γ| on the Smith disk — a reflection analog of the live-vs-type residual.",
      "Center is a clean lock. The dashed ring is the alert threshold. Outside it, lock is lost.",
    ],
    also: "Smith |Γ|, reflection, recoverability",
  },
  {
    id: "pins",
    title: "Gates",
    blurb: "Six checks. Residual fires only when enough pass.",
    body: [
      "Last known. GR fit. Particle confidence. Neighbor. Baseline. Still locked.",
      "Score is the mean of the six. Ready means residual is allowed at this station.",
    ],
    also: "tumblers, key fit, acceptance gates",
  },
  {
    id: "neighbors",
    title: "Transfer",
    blurb: "A neighbor can lend its posterior. It cannot invent yours.",
    body: [
      "The current posterior is transported across pad edges to nearby laterals.",
      "If closed loops do not sum to ~0, transfer stays pairwise. It is not a pad-wide field.",
    ],
    also: "pad transport, sheaf gate, cycle residual",
  },
  {
    id: "call",
    title: "Advisory",
    blurb: "HOLD · BUILD · DROP · CUT.",
    body: [
      "HOLD: stay. BUILD: walk TVT up toward the type-well target. DROP: walk down.",
      "CUT: lock is lost or about to be. Do not chase the type well on a dead correlation.",
    ],
    also: "steer call, geosteering advisory",
  },
  {
    id: "path",
    title: "Recommended path",
    blurb: "Lowest-cost walk from the bit to the type-well target.",
    body: [
      "From the bit, a geodesic walks remaining MD toward the target TVT.",
      "Lost-lock stations cost extra. Max build is 8 ft / 1000 ft MD.",
    ],
    also: "value-warped geodesic, corridor",
  },
  {
    id: "fence",
    title: "Fence",
    blurb: "Pad cross-section. Align on TVT or MD.",
    body: [
      "Each well is a spine. GR is the wiggle. Markers are beds from the active well’s type well.",
      "Fence hangs wells in the same area. Red = lost lock. Export writes a standalone HTML report.",
    ],
    also: "stratigraphic hang, cross-section",
  },
  {
    id: "bit",
    title: "Drilling",
    blurb: "WOB, RPM, torque, ROP — regime and setpoints.",
    body: [
      "Regimes: Normal, Stick-slip, Whirl, Bit bounce. Detected from a sliding window on the four channels.",
      "Three lights: Stop, Ease, Watch. Experts vote. Output is a WOB and RPM change.",
    ],
    also: "GT-MoE, mechanics, safety axioms",
  },
  {
    id: "say",
    title: "Audit",
    blurb: "Four claim types. Only three may ship.",
    body: [
      "Definition — something we chose. Check — a test that passed or failed. Measurement — a score on this pad.",
      "Excluded — pictures are not physics, not a proof, not a new formation.",
    ],
    also: "evidence class, claim ledger",
  },
  {
    id: "slider",
    title: "Playback",
    blurb: "A slider is not a clock unless it says so.",
    body: [
      "MD is hole depth. Station is the sample index. Offset last known is a what-if, not a new run.",
      "Play is a preview loop. It is not the rig clock.",
    ],
    also: "typed time, station, what-if",
  },
];

export function articleById(id: string) {
  return GUIDE.find((a) => a.id === id);
}
