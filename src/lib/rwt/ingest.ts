import {
  CANONICAL_CHANNELS,
  CHANNEL_ALIASES,
  FORM_LEAK,
  type CanonicalChannel,
  type Station,
  type Typewell,
  type Well,
} from "./types";
import { isLasNull, linspace } from "./math";

export interface ParsedTable {
  format: string;
  headers: string[];
  mapped: (CanonicalChannel | string)[];
  rows: number[][];
  leakDropped: string[];
}

function normalizeHeader(h: string) {
  return h.trim().replace(/^\uFEFF/, "").replace(/[\[\]"'`]/g, "");
}

function aliasKey(h: string) {
  return normalizeHeader(h).toLowerCase().replace(/[\s\-\.\/]+/g, "_");
}

export function mapHeader(h: string): CanonicalChannel | string {
  const key = aliasKey(h);
  if (CHANNEL_ALIASES[key]) return CHANNEL_ALIASES[key]!;
  const upper = normalizeHeader(h).toUpperCase();
  if ((CANONICAL_CHANNELS as readonly string[]).includes(upper)) {
    return upper as CanonicalChannel;
  }
  return normalizeHeader(h);
}

function splitLine(line: string, sep?: string) {
  if (sep) return line.split(sep).map((c) => c.trim());
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes(";")) return line.split(";").map((c) => c.trim());
  if (line.includes(",")) return line.split(",").map((c) => c.trim());
  return line.trim().split(/\s+/);
}

function parseNumber(tok: string) {
  const t = tok.replace(/[,]$/, "").trim();
  if (!t || t === "-" || t.toLowerCase() === "nan" || t === "null") return NaN;
  const v = Number(t);
  return Number.isFinite(v) && !isLasNull(v) ? v : NaN;
}

function detectDataIndex(text: string): string[] | null {
  const m = text.match(/data\s*\[\s*([^\]]+)\]/i);
  if (!m) return null;
  return m[1]!.split(",").map((s) => normalizeHeader(s));
}

export function parseAny(text: string): ParsedTable {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) {
    return { format: "empty", headers: [], mapped: [], rows: [], leakDropped: [] };
  }

  // JSON object array or numeric matrix
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const json = JSON.parse(raw);
      return parseJson(json);
    } catch {
      /* fall through */
    }
  }

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("//"));

  const dataIdx = detectDataIndex(raw);
  let start = 0;
  let headers: string[] = [];
  let format = "delimited";

  const lasCurve = lines.findIndex((l) => /^~c(urve)?/i.test(l));
  const lasA = lines.findIndex((l) => /^~a/i.test(l));
  if (lasCurve >= 0 && lasA > lasCurve) {
    format = "las";
    headers = [];
    for (let i = lasCurve + 1; i < lasA; i++) {
      const name = lines[i]!.split(/\s+/)[0];
      if (name && !name.startsWith("~")) headers.push(name);
    }
    start = lasA + 1;
  } else if (dataIdx) {
    format = "data-index";
    headers = dataIdx;
    const idxLine = lines.findIndex((l) => /data\s*\[/i.test(l));
    start = idxLine >= 0 ? idxLine + 1 : 0;
  } else {
    const first = splitLine(lines[0] ?? "");
    const numeric = first.filter((c) => c !== "" && Number.isFinite(Number(c))).length;
    if (numeric < first.length * 0.6) {
      headers = first.map(normalizeHeader);
      start = 1;
      format = "csv";
    } else {
      headers = first.map((_, i) => `ch${i}`);
      format = "numeric-matrix";
    }
  }

  const leakDropped: string[] = [];
  const mapped = headers.map((h) => {
    const up = normalizeHeader(h).toUpperCase();
    if (FORM_LEAK.includes(up)) {
      leakDropped.push(up);
      return `__leak_${up}`;
    }
    return mapHeader(h);
  });

  const rows: number[][] = [];
  for (let i = start; i < lines.length; i++) {
    const cells = splitLine(lines[i]!);
    if (cells.length < 2) continue;
    const row = mapped.map((_, j) => parseNumber(cells[j] ?? ""));
    if (row.some(Number.isFinite)) rows.push(row);
  }

  return { format, headers, mapped, rows, leakDropped };
}

function parseJson(json: unknown): ParsedTable {
  if (Array.isArray(json) && json.length && typeof json[0] === "object" && !Array.isArray(json[0])) {
    const objs = json as Record<string, unknown>[];
    const headers = Object.keys(objs[0] ?? {});
    const leakDropped: string[] = [];
    const mapped = headers.map((h) => {
      const up = normalizeHeader(h).toUpperCase();
      if (FORM_LEAK.includes(up)) {
        leakDropped.push(up);
        return `__leak_${up}`;
      }
      return mapHeader(h);
    });
    const rows = objs.map((o) =>
      headers.map((h) => {
        const v = Number(o[h]);
        return Number.isFinite(v) && !isLasNull(v) ? v : NaN;
      }),
    );
    return { format: "json-objects", headers, mapped, rows, leakDropped };
  }
  if (Array.isArray(json) && json.length && Array.isArray(json[0])) {
    const matrix = json as unknown[][];
    const headers = (matrix[0] ?? []).map((_, i) => `ch${i}`);
    const mapped = headers.map((h) => mapHeader(h));
    const rows = matrix.map((r) =>
      r.map((c) => {
        const v = Number(c);
        return Number.isFinite(v) && !isLasNull(v) ? v : NaN;
      }),
    );
    return { format: "json-matrix", headers, mapped, rows, leakDropped: [] };
  }
  if (json && typeof json === "object" && "data" in (json as object)) {
    const rec = json as { channels?: string[]; data: unknown };
    const headers = rec.channels ?? [];
    return parseJson(
      Array.isArray(rec.data)
        ? rec.data
        : [],
    ).headers.length
      ? { ...parseJson(rec.data), headers: headers.length ? headers : parseJson(rec.data).headers }
      : parseJson(rec.data);
  }
  return { format: "json", headers: [], mapped: [], rows: [], leakDropped: [] };
}

function col(table: ParsedTable, name: CanonicalChannel | string) {
  const i = table.mapped.findIndex((h) => h === name);
  if (i < 0) return null;
  return table.rows.map((r) => r[i] ?? NaN);
}

function firstFinite(a: number[] | null) {
  if (!a) return NaN;
  for (const v of a) if (Number.isFinite(v)) return v;
  return NaN;
}

export function tableToWell(
  table: ParsedTable,
  opts?: { id?: string; name?: string; typewell?: Typewell },
): Well {
  const n0 = table.rows.length;
  const md0 = col(table, "MD") ?? linspace(0, Math.max(n0 - 1, 1), n0);
  const x0 = col(table, "X") ?? md0.map((v, i) => (Number.isFinite(v) ? v : i));
  const y0 = col(table, "Y") ?? md0.map(() => 0);
  const z0 = col(table, "Z") ?? md0.map((_, i) => -i * 2);
  const gr0 = col(table, "GR") ?? md0.map(() => NaN);
  const tvtCol = col(table, "TVT");
  const tvtInCol = col(table, "TVT_input");
  const extraNames = table.mapped.filter(
    (h) =>
      typeof h === "string" &&
      !(CANONICAL_CHANNELS as readonly string[]).includes(h) &&
      !h.startsWith("__leak_"),
  );

  const hasTvtIn = Boolean(tvtInCol?.some((v) => Number.isFinite(v)));

  const raw: Station[] = [];
  for (let i = 0; i < n0; i++) {
    const tvt = tvtCol?.[i];
    const tvtIn = tvtInCol?.[i];
    const labeled = hasTvtIn
      ? Number.isFinite(tvtIn)
      : Number.isFinite(tvtIn) || Number.isFinite(tvt);
    const extra: Record<string, number> = {};
    for (const name of extraNames) {
      const idx = table.mapped.indexOf(name);
      extra[String(name)] = table.rows[i]?.[idx] ?? NaN;
    }
    for (const ch of ["RES", "NPHI", "RHOB", "CALI", "DT", "PE", "WOB", "RPM", "TRQ", "ROP"] as const) {
      const c = col(table, ch);
      if (c) extra[ch] = c[i] ?? NaN;
    }
    const truth = Number.isFinite(tvt) ? tvt : Number.isFinite(tvtIn) ? tvtIn : undefined;
    raw.push({
      md: Number.isFinite(md0[i]) ? md0[i]! : i,
      x: Number.isFinite(x0[i]) ? x0[i]! : i,
      y: Number.isFinite(y0[i]) ? y0[i]! : 0,
      z: Number.isFinite(z0[i]) ? z0[i]! : 0,
      gr: Number.isFinite(gr0[i]) && (gr0[i] as number) > -50 ? gr0[i]! : NaN,
      tvt: labeled && Number.isFinite(tvtIn) ? tvtIn! : labeled && Number.isFinite(tvt) ? tvt! : null,
      tvtInput: labeled && Number.isFinite(tvtIn) ? tvtIn! : labeled && Number.isFinite(tvt) ? tvt! : null,
      isPredict: !labeled,
      tvtTrue: truth,
      extra,
    });
  }

  // If every TVT is present and there was no sparse TVT_input, hide last 38%.
  const labeledN = raw.filter((s) => !s.isPredict).length;
  if (!hasTvtIn && labeledN === n0 && n0 > 8) {
    const ps = Math.floor(n0 * 0.62);
    for (let i = ps; i < n0; i++) {
      const s = raw[i]!;
      s.tvtTrue = s.tvt ?? s.tvtInput ?? s.tvtTrue;
      s.tvt = null;
      s.tvtInput = null;
      s.isPredict = true;
    }
  }

  fillGrGaps(raw);
  const stations = downsampleStations(raw, 400);

  const typewell =
    opts?.typewell ?? inferTypewell(stations, col(table, "TVT") ?? col(table, "TVT_input"));

  const channels = [
    ...new Set(
      table.mapped.filter((h) => typeof h === "string" && !h.startsWith("__leak_")),
    ),
  ];

  return {
    id: opts?.id ?? `ingested-${Date.now().toString(36)}`,
    name: opts?.name ?? "INGEST-01",
    padId: "ingest",
    stations,
    typewell,
    sourceFormat: table.format,
    channels,
  };
}

function fillGrGaps(stations: Station[]) {
  let last = NaN;
  for (const s of stations) {
    if (Number.isFinite(s.gr)) last = s.gr;
    else if (Number.isFinite(last)) s.gr = last;
  }
  let next = NaN;
  for (let i = stations.length - 1; i >= 0; i--) {
    const s = stations[i]!;
    if (Number.isFinite(s.gr)) next = s.gr;
    else if (Number.isFinite(next)) s.gr = next;
  }
}

export function downsampleStations(stations: Station[], target = 400): Station[] {
  const n = stations.length;
  if (n <= target) return stations;
  let lastKnown = 0;
  for (let i = 0; i < n; i++) if (!stations[i]!.isPredict) lastKnown = i;
  const must = new Set([0, n - 1, lastKnown, Math.min(n - 1, lastKnown + 1)]);
  const stride = n / (target - 1);
  const idx = new Set(must);
  for (let k = 0; k < n; k += stride) idx.add(Math.min(n - 1, Math.round(k)));
  const lo = Math.max(0, lastKnown - 16);
  const hi = Math.min(n - 1, lastKnown + 28);
  const step = Math.max(1, Math.floor((hi - lo) / 20));
  for (let i = lo; i <= hi; i += step) idx.add(i);
  return [...idx].sort((a, b) => a - b).map((i) => stations[i]!);
}

export function looksLikeTypewell(table: ParsedTable) {
  const hasTvt = table.mapped.includes("TVT");
  const hasGr = table.mapped.includes("GR");
  const hasMd = table.mapped.includes("MD");
  const hasX = table.mapped.includes("X");
  return hasTvt && hasGr && !hasMd && !hasX && table.rows.length >= 8;
}

export function parseTypewell(table: ParsedTable): Typewell {
  const tvtCol = col(table, "TVT") ?? [];
  const grCol = col(table, "GR") ?? [];
  const geoIdx = table.headers.findIndex((h) => /geol|formation|bed|top/i.test(h));
  const tvt: number[] = [];
  const gr: number[] = [];
  const tops: { name: string; tvt: number }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < table.rows.length; i++) {
    const t = tvtCol[i];
    if (!Number.isFinite(t)) continue;
    tvt.push(t!);
    const g = grCol[i];
    gr.push(Number.isFinite(g) ? g! : NaN);
    if (geoIdx >= 0) {
      const raw = table.rows[i]?.[geoIdx];
      // geology is numeric-parsed; recover from original is lost. skip if numeric.
      void raw;
    }
  }
  // recover geology names from headers-only tables via mapped extras is not possible
  // after numeric parse — tops stay empty unless inferTypewell tops are supplied.
  void tops;
  void seen;
  return { tvt, gr };
}

export function parseTypewellText(text: string): Typewell {
  const raw = text.replace(/^\uFEFF/, "").trim();
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("//"));
  if (!lines.length) return { tvt: [], gr: [] };
  const first = splitLine(lines[0]!);
  const numeric = first.filter((c) => c !== "" && Number.isFinite(Number(c))).length;
  const headered = numeric < first.length * 0.6;
  const headers = headered ? first.map((h) => normalizeHeader(h)) : [];
  const start = headered ? 1 : 0;
  const tvtIdx = headers.findIndex((h) => /^(tvt|tvdss|ss)$/i.test(h));
  const grIdx = headers.findIndex((h) => /^(gr|gamma|gammaray)$/i.test(h));
  const geoIdx = headers.findIndex((h) => /geol|formation|bed|top/i.test(h));
  const tCol = tvtIdx >= 0 ? tvtIdx : 0;
  const gCol = grIdx >= 0 ? grIdx : 1;
  const tvt: number[] = [];
  const gr: number[] = [];
  const tops: { name: string; tvt: number }[] = [];
  const seen = new Set<string>();
  for (let i = start; i < lines.length; i++) {
    const cells = splitLine(lines[i]!);
    const t = parseNumber(cells[tCol] ?? "");
    if (!Number.isFinite(t)) continue;
    const g = parseNumber(cells[gCol] ?? "");
    tvt.push(t);
    gr.push(g);
    if (geoIdx >= 0) {
      const name = (cells[geoIdx] ?? "").trim();
      if (name && !seen.has(name) && !Number.isFinite(Number(name))) {
        seen.add(name);
        tops.push({ name, tvt: t });
      }
    }
  }
  return { tvt, gr, tops: tops.length ? tops : undefined };
}

function inferTypewell(stations: Station[], tvtHint: number[] | null): Typewell {
  const pairs: { t: number; g: number }[] = [];
  for (let i = 0; i < stations.length; i++) {
    const t = stations[i]!.tvtInput ?? stations[i]!.tvt ?? tvtHint?.[i] ?? null;
    const g = stations[i]!.gr;
    if (t != null && Number.isFinite(t) && Number.isFinite(g)) pairs.push({ t, g });
  }
  if (pairs.length < 8) {
    return { tvt: [], gr: [] };
  }
  pairs.sort((a, b) => a.t - b.t);
  const tvt = pairs.map((p) => p.t);
  const gr = pairs.map((p) => p.g);
  return { tvt, gr };
}

export function wellToCsv(well: Well) {
  const extras = new Set<string>();
  for (const s of well.stations) for (const k of Object.keys(s.extra)) extras.add(k);
  const extraCols = [...extras];
  const header = ["well_id", "MD", "X", "Y", "Z", "GR", "TVT", "TVT_input", ...extraCols];
  const lines = [header.join(",")];
  for (const s of well.stations) {
    const row = [
      well.id,
      s.md,
      s.x,
      s.y,
      s.z,
      Number.isFinite(s.gr) ? s.gr : "",
      s.tvt ?? "",
      s.tvtInput ?? "",
      ...extraCols.map((c) => (Number.isFinite(s.extra[c]!) ? s.extra[c] : "")),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

export { firstFinite };
