import { createServerFn } from "@tanstack/react-start";
import type { ObjectKind } from "./objects";

export interface LlmFileSnippet {
  name: string;
  head: string;
  headers: string[];
  sample: (number | string)[][];
}

export interface LlmObjectPlan {
  sourceName: string;
  name: string;
  kind: ObjectKind;
  columnMap: Record<string, string>;
  splitColumn?: string;
  notes?: string;
}

export interface LlmParseResult {
  ok: boolean;
  usedLlm: boolean;
  objects: LlmObjectPlan[];
  error?: string;
}

const CANON = [
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
].join(", ");

export const planIngest = createServerFn({ method: "POST" })
  .validator((input: { files: LlmFileSnippet[] }) => input)
  .handler(async ({ data }): Promise<LlmParseResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, usedLlm: false, objects: [], error: "Assistant is not available here." };
    }

    const files = data.files.slice(0, 8).map((f) => ({
      name: f.name.slice(0, 120),
      head: f.head.slice(0, 6000),
      headers: f.headers.slice(0, 40),
      sample: f.sample.slice(0, 4).map((r) => r.slice(0, 20)),
    }));

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You classify well-log files for an import tool. Return JSON only. " +
              `Canonical channels: ${CANON}. ` +
              "Kinds: well, typewell, mechanics, skip. " +
              "A typewell is GR vs TVT with no MD/X survey. " +
              "A well is a lateral or vertical with MD and/or GR. " +
              "mechanics is WOB/RPM/TRQ/ROP only. " +
              "columnMap maps each original header to a canonical name or leaves it as-is. " +
              "splitColumn is the well-id column when one table holds many wells. " +
              "Do not invent numeric values. Drop formation-top name columns. " +
              'Shape: {"objects":[{"sourceName":"","name":"","kind":"well","columnMap":{},"splitColumn":"","notes":""}]}',
          },
          {
            role: "user",
            content: JSON.stringify({ files }),
          },
        ],
      }),
    });

    if (!res.ok) {
      return { ok: false, usedLlm: true, objects: [], error: `Assistant error ${res.status}` };
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content ?? "";
    try {
      const parsed = JSON.parse(text) as { objects?: LlmObjectPlan[] };
      const objects = Array.isArray(parsed.objects) ? parsed.objects : [];
      return {
        ok: true,
        usedLlm: true,
        objects: objects.map((o) => ({
          sourceName: String(o.sourceName ?? ""),
          name: String(o.name ?? "import"),
          kind: sanitizeKind(o.kind),
          columnMap: o.columnMap && typeof o.columnMap === "object" ? o.columnMap : {},
          splitColumn: o.splitColumn ? String(o.splitColumn) : undefined,
          notes: o.notes ? String(o.notes) : undefined,
        })),
      };
    } catch {
      return { ok: false, usedLlm: true, objects: [], error: "Assistant returned unreadable JSON." };
    }
  });

function sanitizeKind(k: unknown): ObjectKind {
  if (k === "well" || k === "typewell" || k === "mechanics" || k === "skip") return k;
  return "unknown";
}
