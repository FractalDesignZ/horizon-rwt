import { mapHeader, parseAny, type ParsedTable } from "./ingest";
import type { CanonicalChannel } from "./types";

export type ObjectKind = "well" | "typewell" | "mechanics" | "unknown" | "skip";

export interface RawObject {
  name: string;
  text: string;
  sourceName: string;
}

export interface ObjectPlan {
  name: string;
  sourceName: string;
  kind: ObjectKind;
  format: string;
  headers: string[];
  mapped: (CanonicalChannel | string)[];
  rows: number;
  columnMap: Record<string, string>;
  splitColumn?: string;
  notes: string[];
}

export interface IngestFile {
  name: string;
  text: string;
}

function normalizeHeader(h: string) {
  return h.trim().replace(/^\uFEFF/, "").replace(/[\[\]"'`]/g, "");
}

function splitLine(line: string) {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes(";")) return line.split(";").map((c) => c.trim());
  if (line.includes(",")) return line.split(",").map((c) => c.trim());
  return line.trim().split(/\s+/);
}

function stem(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "import";
}

function detectDataIndex(text: string): string[] | null {
  const m = text.match(/data\s*\[\s*([^\]]+)\]/i);
  if (!m) return null;
  return m[1]!.split(",").map((s) => normalizeHeader(s));
}

export function fileHead(text: string, maxLines = 60, maxChars = 6000) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).slice(0, maxLines);
  const head = lines.join("\n");
  return head.length > maxChars ? head.slice(0, maxChars) : head;
}

export function splitSources(files: IngestFile[]): RawObject[] {
  const out: RawObject[] = [];
  for (const f of files) {
    const parts = splitOne(f.text, f.name);
    if (parts.length) out.push(...parts);
    else if (f.text.trim()) {
      out.push({ name: stem(f.name), text: f.text, sourceName: f.name });
    }
  }
  return out;
}

function splitOne(text: string, name: string): RawObject[] {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return [];

  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const fromJson = splitJson(JSON.parse(raw), name);
      if (fromJson.length > 1) return fromJson;
      if (fromJson.length === 1) return fromJson;
    } catch {
      /* fall through */
    }
  }

  const las = splitLasWells(raw, name);
  if (las.length > 1) return las;

  const blocks = splitDataBlocks(raw, name);
  if (blocks.length > 1) return blocks;

  const byId = splitByWellColumn(raw, name);
  if (byId.length > 1) return byId;

  return [{ name: stem(name), text: raw, sourceName: name }];
}

function splitDataBlocks(raw: string, name: string): RawObject[] {
  const re = /data\s*\[[^\]]+\]/gi;
  const hits: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) hits.push(m.index);
  if (hits.length < 2) return [];
  return hits.map((start, i) => {
    const end = hits[i + 1] ?? raw.length;
    const chunk = raw.slice(start, end).trim();
    const hdr = chunk.match(/data\s*\[([^\]]+)\]/i)?.[1] ?? String(i + 1);
    return {
      name: `${stem(name)} ${i + 1}`,
      text: chunk,
      sourceName: `${name}#${hdr.slice(0, 24)}`,
    };
  });
}

function splitLasWells(raw: string, name: string): RawObject[] {
  const parts = raw.split(/(?=^~V)/im).filter((p) => p.trim());
  if (parts.length < 2) return [];
  return parts.map((chunk, i) => {
    const wm = chunk.match(/^\s*WELL\s*\.\s*(.+?)\s*:/im);
    return {
      name: (wm?.[1] ?? `${stem(name)} ${i + 1}`).trim(),
      text: chunk,
      sourceName: name,
    };
  });
}

function splitByWellColumn(text: string, name: string): RawObject[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("//"));
  if (lines.length < 3) return [];

  const dataIdx = detectDataIndex(text);
  let headers: string[];
  let start: number;
  if (dataIdx) {
    headers = dataIdx;
    const idxLine = lines.findIndex((l) => /data\s*\[/i.test(l));
    start = idxLine >= 0 ? idxLine + 1 : 0;
  } else {
    const first = splitLine(lines[0] ?? "");
    const numeric = first.filter((c) => c !== "" && Number.isFinite(Number(c))).length;
    if (numeric >= first.length * 0.6) return [];
    headers = first.map(normalizeHeader);
    start = 1;
  }

  const splitIdx = headers.findIndex((h) =>
    /^(well|well_id|wellid|uwi|api|hole|borehole)$/i.test(h),
  );
  if (splitIdx < 0) return [];

  const groups = new Map<string, string[]>();
  for (let i = start; i < lines.length; i++) {
    const cells = splitLine(lines[i]!);
    const id = (cells[splitIdx] ?? "").trim() || "WELL";
    const bucket = groups.get(id) ?? [];
    bucket.push(lines[i]!);
    groups.set(id, bucket);
  }
  if (groups.size < 2) return [];

  const headerLine = `data[${headers.join(", ")}]`;
  return [...groups.entries()].map(([id, rows]) => ({
    name: id,
    sourceName: name,
    text: `${headerLine}\n${rows.join("\n")}`,
  }));
}

function splitJson(json: unknown, name: string): RawObject[] {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const rec = json as Record<string, unknown>;
    const list = rec.wells ?? rec.objects ?? rec.files ?? rec.logs;
    if (Array.isArray(list) && list.length) {
      return list.flatMap((item, i) => jsonItem(item, name, i));
    }
    if (rec.well && typeof rec.well === "object") {
      return jsonItem(rec.well, name, 0);
    }
  }
  if (Array.isArray(json) && json.length && typeof json[0] === "object" && !Array.isArray(json[0])) {
    const objs = json as Record<string, unknown>[];
    const idKey = Object.keys(objs[0] ?? {}).find((k) =>
      /^(well|well_id|wellid|uwi|id|name)$/i.test(k),
    );
    if (idKey) {
      const ids = new Set(objs.map((o) => String(o[idKey] ?? "")));
      if (ids.size > 1) {
        return [...ids].map((id) => ({
          name: id || stem(name),
          sourceName: name,
          text: JSON.stringify(objs.filter((o) => String(o[idKey] ?? "") === id)),
        }));
      }
    }
    if (objs.some((o) => Array.isArray(o.data) || Array.isArray(o.stations))) {
      return objs.flatMap((item, i) => jsonItem(item, name, i));
    }
  }
  return [];
}

function jsonItem(item: unknown, name: string, i: number): RawObject[] {
  if (!item || typeof item !== "object") return [];
  const rec = item as Record<string, unknown>;
  const id = String(rec.id ?? rec.name ?? rec.well_id ?? rec.well ?? `${stem(name)} ${i + 1}`);
  return [{ name: id, sourceName: name, text: JSON.stringify(item) }];
}

export function classifyTable(table: ParsedTable, name: string): ObjectKind {
  const mapped = table.mapped.map((h) => String(h).toUpperCase());
  const has = (k: string) => mapped.includes(k);
  const mechanics = ["WOB", "RPM", "TRQ", "ROP"].filter((k) => has(k)).length;
  if (has("TVT") && has("GR") && !has("MD") && !has("X") && table.rows.length >= 8) {
    return "typewell";
  }
  if (/typewell|type[_-]?well|type[_-]?log/i.test(name)) return "typewell";
  if (mechanics >= 2 && !has("GR") && !has("TVT")) return "mechanics";
  if (has("MD") || has("GR") || has("TVT") || table.rows.length >= 8) return "well";
  if (table.rows.length === 0) return "skip";
  return "unknown";
}

export function planLocal(files: IngestFile[]): ObjectPlan[] {
  return splitSources(files).map((obj) => {
    const table = parseAny(obj.text);
    const kind = classifyTable(table, obj.name);
    const notes: string[] = [];
    if (table.leakDropped.length) notes.push(`dropped ${table.leakDropped.join(", ")}`);
    if (kind === "unknown") notes.push("columns not recognized");
    if (table.mapped.every((h) => /^ch\d+$/i.test(String(h)))) {
      notes.push("headers look like ch0, ch1 — assistant can map them");
    }
    return {
      name: obj.name,
      sourceName: obj.sourceName,
      kind,
      format: table.format,
      headers: table.headers,
      mapped: table.mapped,
      rows: table.rows.length,
      columnMap: Object.fromEntries(
        table.headers.map((h, i) => [h, String(table.mapped[i] ?? h)]),
      ),
      notes,
    };
  });
}

export function applyColumnMap(table: ParsedTable, map: Record<string, string>): ParsedTable {
  if (!map || !Object.keys(map).length) return table;
  const mapped = table.headers.map((h, i) => {
    const hit = Object.entries(map).find(
      ([k]) => k.toLowerCase() === h.toLowerCase() || k.toLowerCase() === String(table.mapped[i]).toLowerCase(),
    );
    if (hit?.[1]) return mapHeader(hit[1]);
    return table.mapped[i]!;
  });
  return { ...table, mapped };
}

export function needsAssistant(plans: ObjectPlan[]) {
  if (!plans.length) return false;
  return plans.some(
    (p) =>
      p.kind === "unknown" ||
      p.mapped.every((h) => /^ch\d+$/i.test(String(h))) ||
      (p.kind === "well" && !p.mapped.includes("GR") && !p.mapped.includes("MD")),
  );
}
