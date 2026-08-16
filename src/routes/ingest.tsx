import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseAny } from "@/lib/rwt/ingest";
import { CANONICAL_CHANNELS } from "@/lib/rwt/types";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/ingest")({ component: Ingest });

function Ingest() {
  const draft = useHorizon((s) => s.ingestDraft);
  const setDraft = useHorizon((s) => s.setIngestDraft);
  const ingest = useHorizon((s) => s.ingest);
  const loadSample = useHorizon((s) => s.loadSample);
  const err = useHorizon((s) => s.ingestError);
  const lastFormat = useHorizon((s) => s.lastFormat);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const preview = useMemo(() => (draft.trim() ? parseAny(draft) : null), [draft]);

  async function takeFile(file: File) {
    const text = await file.text();
    setDraft(text);
    setFileName(file.name);
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Any format index</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Ingest</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Drop a channel index <span className="font-mono text-fg">data[GR, MD, X, Y, Z, …]</span>,
            CSV, LAS, JSON objects, or a numeric matrix. Formation tops (ANCC…BUDA) are dropped
            on contact — they never enter residual X. Ingested wells share the pad GR@TVT book.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Channel tape</CardTitle>
              <CardDescription>Paste, type, or drop a file. Sample uses the live pad book.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files[0];
                  if (f) void takeFile(f);
                }}
                className={`flex min-h-16 w-full items-center justify-center rounded-md border border-dashed px-4 py-3 text-sm ${
                  drag ? "border-accent bg-elevated text-fg" : "border-border text-muted"
                }`}
              >
                {fileName ? fileName : "Drop LAS / CSV / JSON · or click to open"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".las,.csv,.txt,.json,.dat,text/plain,text/csv,application/json"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void takeFile(f);
                }}
              />
              <Label htmlFor="tape">data[channel, channel, …]</Label>
              <Textarea
                id="tape"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={'data[MD, X, Y, Z, GR, TVT, RES, NPHI]\n8500, 1200.1, 3400.2, -8120, 86.4, 118.2, 12.1, 0.18'}
                className="min-h-72"
              />
              {err && <p className="text-sm text-danger">{err}</p>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => ingest(draft, fileName ?? undefined)}>Index & predict</Button>
                <Button variant="secondary" onClick={loadSample}>
                  Load sample
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Mapped channels</CardTitle>
                <CardDescription>
                  Format {preview?.format ?? lastFormat}
                  {preview ? ` · ${preview.rows.length} rows` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {preview && preview.mapped.length ? (
                  <ul className="space-y-1 font-mono text-xs">
                    {preview.mapped.map((m, i) => (
                      <li key={`${m}-${i}`} className="flex justify-between gap-3">
                        <span className="text-muted">{preview.headers[i]}</span>
                        <span className={String(m).startsWith("__leak") ? "text-danger" : "text-fg"}>
                          {String(m).startsWith("__leak") ? "DROPPED" : m}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Awaiting tape.</p>
                )}
                {preview?.leakDropped.length ? (
                  <p className="mt-3 text-xs text-danger">
                    Form leak removed: {preview.leakDropped.join(", ")}
                  </p>
                ) : null}
                {preview && preview.rows.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[280px] text-left font-mono text-[10px]">
                      <thead className="text-subtle">
                        <tr>
                          {preview.headers.slice(0, 6).map((h) => (
                            <th key={h} className="pr-3 pb-1 font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.slice(0, 4).map((row, i) => (
                          <tr key={i} className="text-muted">
                            {row.slice(0, 6).map((v, j) => (
                              <td key={j} className="pr-3 tabular-nums">
                                {Number.isFinite(v) ? v.toFixed(2) : "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Canonical book</CardTitle>
                <CardDescription>Recognized aliases fold into these stalks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {CANONICAL_CHANNELS.map((c) => (
                    <span
                      key={c}
                      className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-muted"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
