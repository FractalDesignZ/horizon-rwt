import {
  looksLikeTypewell,
  parseAny,
  parseTypewellText,
  tableToWell,
} from "./ingest";
import { emptyTypewell } from "./empty";
import { planIngest } from "./llm-parse";
import {
  applyColumnMap,
  classifyTable,
  fileHead,
  planLocal,
  splitSources,
  type IngestFile,
  type ObjectPlan,
} from "./objects";
import type { Typewell, Well } from "./types";

export interface IngestBundle {
  wells: Well[];
  typewells: { name: string; tw: Typewell }[];
  skipped: { name: string; reason: string }[];
  plans: ObjectPlan[];
  usedLlm: boolean;
  notes: string[];
}

export function snippetsOf(files: IngestFile[]) {
  return splitSources(files).slice(0, 8).map((obj) => {
    const table = parseAny(obj.text);
    return {
      name: obj.sourceName || obj.name,
      head: fileHead(obj.text),
      headers: table.headers,
      sample: table.rows.slice(0, 3).map((r) => r.map((v) => (Number.isFinite(v) ? v : ""))),
    };
  });
}

export async function wrapIngest(
  files: IngestFile[],
  opts?: { useAssistant?: boolean },
): Promise<IngestBundle> {
  const cleaned = files.filter((f) => f.text.trim());
  const local = planLocal(cleaned);
  const notes: string[] = [];
  let plans = local;
  let usedLlm = false;

  const ask = opts?.useAssistant === true;
  if (ask && cleaned.length) {
    try {
      const remote = await planIngest({ data: { files: snippetsOf(cleaned) } });
      if (remote.ok && remote.objects.length) {
        usedLlm = true;
        plans = mergePlans(local, remote.objects);
        notes.push("Assistant mapped columns.");
      } else if (remote.error) {
        notes.push(remote.error);
      }
    } catch (err) {
      notes.push(err instanceof Error ? err.message : "Assistant unavailable.");
    }
  }

  return materialize(cleaned, plans, usedLlm, notes);
}

function mergePlans(
  local: ObjectPlan[],
  remote: {
    sourceName: string;
    name: string;
    kind: ObjectPlan["kind"];
    columnMap: Record<string, string>;
    splitColumn?: string;
    notes?: string;
  }[],
): ObjectPlan[] {
  return local.map((p, i) => {
    const hit =
      remote.find(
        (r) =>
          r.sourceName === p.sourceName ||
          r.sourceName === p.name ||
          r.name === p.name,
      ) ?? remote[i];
    if (!hit) return p;
    return {
      ...p,
      name: hit.name || p.name,
      kind: hit.kind === "unknown" ? p.kind : hit.kind,
      columnMap: { ...p.columnMap, ...hit.columnMap },
      splitColumn: hit.splitColumn ?? p.splitColumn,
      notes: hit.notes ? [...p.notes, hit.notes] : p.notes,
    };
  });
}

function materialize(
  files: IngestFile[],
  plans: ObjectPlan[],
  usedLlm: boolean,
  notes: string[],
): IngestBundle {
  const objects = splitSources(files);
  const wells: Well[] = [];
  const typewells: { name: string; tw: Typewell }[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const sharedTw = emptyTypewell();

  objects.forEach((obj, i) => {
    const plan = plans[i];
    const table0 = parseAny(obj.text);
    const table = plan ? applyColumnMap(table0, plan.columnMap) : table0;
    const kind = plan?.kind ?? classifyTable(table, obj.name);

    if (kind === "skip") {
      skipped.push({ name: obj.name, reason: "skipped" });
      return;
    }
    if (kind === "typewell" || looksLikeTypewell(table)) {
      const tw = parseTypewellText(obj.text);
      if (tw.tvt.length < 8) {
        skipped.push({ name: obj.name, reason: "type well needs TVT and GR" });
        return;
      }
      typewells.push({ name: plan?.name ?? obj.name, tw });
      return;
    }
    if (!table.rows.length) {
      skipped.push({ name: obj.name, reason: "no numeric rows" });
      return;
    }
    const well = tableToWell(table, {
      id: slugId(plan?.name ?? obj.name, i),
      name: plan?.name ?? obj.name,
      typewell: sharedTw,
    });
    wells.push(well);
  });

  if (typewells.length === 1) {
    const tw = typewells[0]!.tw;
    for (const w of wells) w.typewell = tw;
  } else if (typewells.length > 1 && wells.length) {
    for (const tw of typewells) {
      const hit = wells.find((w) => namesClose(w.name, tw.name) || namesClose(w.id, tw.name));
      if (hit) hit.typewell = tw.tw;
    }
  }

  return { wells, typewells, skipped, plans, usedLlm, notes };
}

function slugId(name: string, i: number) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 16);
  return `${base || "ING"}-${(Date.now() + i).toString(36).slice(-4)}`;
}

function namesClose(a: string, b: string) {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const x = n(a);
  const y = n(b);
  return Boolean(x && y && (x.includes(y) || y.includes(x)));
}
