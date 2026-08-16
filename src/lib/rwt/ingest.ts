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
  const n = table.rows.length;
  const md = col(table, "MD") ?? linspace(0, Math.max(n - 1, 1), n);
  const x = col(table, "X") ?? md.map((v, i) => (Number.isFinite(v) ? v : i));
  const y = col(table, "Y") ?? md.map(() => 0);
  const z = col(table, "Z") ?? md.map((_, i) => -i * 2);
  const gr = col(table, "GR") ?? md.map(() => NaN);
  const tvtCol = col(table, "TVT");
  const tvtInCol = col(table, "TVT_input");
  const extraNames = table.mapped.filter(
    (h) =>
      typeof h === "string" &&
      !(CANONICAL_CHANNELS as readonly string[]).includes(h) &&
      !h.startsWith("__leak_"),
  );

  const stations: Station[] = [];
  for (let i = 0; i < n; i++) {
    const tvt = tvtCol?.[i];
    const tvtIn = tvtInCol?.[i];
    const known = Number.isFinite(tvtIn) || Number.isFinite(tvt);
    const extra: Record<string, number> = {};
    for (const name of extraNames) {
      const idx = table.mapped.indexOf(name);
      extra[String(name)] = table.rows[i]?.[idx] ?? NaN;
    }
    for (const ch of ["RES", "NPHI", "RHOB", "CALI", "DT", "PE"] as const) {
      const c = col(table, ch);
      if (c) extra[ch] = c[i] ?? NaN;
    }
    stations.push({
      md: Number.isFinite(md[i]) ? md[i]! : i,
      x: Number.isFinite(x[i]) ? x[i]! : i,
      y: Number.isFinite(y[i]) ? y[i]! : 0,
      z: Number.isFinite(z[i]) ? z[i]! : 0,
      gr: Number.isFinite(gr[i]) && (gr[i] as number) > -50 ? gr[i]! : NaN,
      tvt: Number.isFinite(tvt) ? tvt! : null,
      tvtInput: Number.isFinite(tvtIn) ? tvtIn! : Number.isFinite(tvt) ? tvt! : null,
      isPredict: !known,
      extra,
    });
  }

  // If every TVT is present, treat last 38% as predict zone (middle-out demo)
  const labeled = stations.filter((s) => s.tvt != null || s.tvtInput != null).length;
  if (labeled === n && n > 8) {
    const ps = Math.floor(n * 0.62);
    for (let i = ps; i < n; i++) {
      const s = stations[i]!;
      s.tvtTrue = s.tvt ?? s.tvtInput ?? undefined;
      s.tvt = null;
      s.tvtInput = null;
      s.isPredict = true;
    }
  } else {
    for (const s of stations) {
      if (s.isPredict && (s.tvt != null || s.tvtInput != null)) {
        s.tvtTrue = s.tvt ?? s.tvtInput ?? undefined;
        s.tvt = null;
        s.tvtInput = null;
      }
    }
  }

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

function inferTypewell(stations: Station[], tvtHint: number[] | null): Typewell {
  const pairs: { t: number; g: number }[] = [];
  for (let i = 0; i < stations.length; i++) {
    const t = stations[i]!.tvtInput ?? stations[i]!.tvt ?? tvtHint?.[i] ?? null;
    const g = stations[i]!.gr;
    if (t != null && Number.isFinite(t) && Number.isFinite(g)) pairs.push({ t, g });
  }
  if (pairs.length < 8) {
    const tvt = linspace(40, 220, 180);
    const gr = tvt.map((t) => 55 + 32 * Math.sin(t / 14) + 12 * Math.sin(t / 6));
    return { tvt, gr };
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
