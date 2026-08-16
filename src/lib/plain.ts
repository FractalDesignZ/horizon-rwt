export const FLOOR_LABEL: Record<string, string> = {
  last_known: "last known",
  prior_flat: "flat hold",
  prior_local_dip: "local dip",
  prior_stack: "stack",
  prior_best: "best stack",
  prior_pf_blend: "particle blend",
};

export function floorLabel(key: string) {
  return FLOOR_LABEL[key] ?? key.replace(/_/g, " ");
}

export const CHANNEL_LABEL: Record<string, string> = {
  MD: "MD",
  X: "X",
  Y: "Y",
  Z: "TVD",
  GR: "GR",
  TVT: "TVT",
  TVT_input: "TVT in",
  RES: "RES",
  NPHI: "NPHI",
  RHOB: "RHOB",
  CALI: "CALI",
  DT: "DT",
  PE: "PE",
  WOB: "WOB",
  RPM: "RPM",
  TRQ: "TRQ",
  ROP: "ROP",
};

export const BED_LABEL: Record<string, string> = {
  ANCC: "Austin",
  ASTNU: "Austin upper",
  ASTNL: "Austin lower",
  EGFDU: "Eagle Ford upper",
  EGFDL: "Eagle Ford lower",
  LTHL: "Lower thick",
  LTGT: "Lower tight",
  LBHL: "Lower base",
  MNSS: "Maness",
  BUDA: "Buda",
};

export function bedLabel(name: string) {
  return BED_LABEL[name] ?? name;
}

export function channelLabel(key: string) {
  return CHANNEL_LABEL[key] ?? key;
}

export const STATUS_LABEL = {
  pass: "pass",
  fail: "fail",
  excluded: "excluded",
  hold: "pending",
} as const;

export function statusLabel(status: keyof typeof STATUS_LABEL | string) {
  return STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status;
}

export const CERT_LABEL: Record<string, string> = {
  "input-hash": "checksum",
  psd: "spectrum ≥ 0",
  gate3: "residual vs baseline",
  loops: "cycle consistency",
  "no-tops": "no formation tops",
  slider: "axis type",
};

export function certLabel(id: string) {
  return CERT_LABEL[id] ?? id.replace(/-/g, " ");
}

export function serveLabel(name: string) {
  if (name.startsWith("residual")) return "residual + stack";
  if (name.startsWith("pure ")) return floorLabel(name.slice(5));
  return name.replace(/_/g, " ");
}

export const REGIME_LABEL: Record<string, string> = {
  normal: "Normal",
  "stick-slip": "Stick-slip",
  whirl: "Whirl",
  bounce: "Bit bounce",
};

export function regimeLabel(key: string) {
  return REGIME_LABEL[key] ?? key;
}
