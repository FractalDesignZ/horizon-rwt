import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Caption, PageLead } from "@/components/caption";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { channelLabel } from "@/lib/plain";
import { parseAny } from "@/lib/rwt/ingest";
import { planLocal, type IngestFile } from "@/lib/rwt/objects";
import { CANONICAL_CHANNELS } from "@/lib/rwt/types";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/ingest")({ component: Ingest });

function Ingest() {
  const draft = useHorizon((s) => s.ingestDraft);
  const setDraft = useHorizon((s) => s.setIngestDraft);
  const ingestFiles = useHorizon((s) => s.ingestFiles);
  const ingestTypewell = useHorizon((s) => s.ingestTypewell);
  const loadTestPad = useHorizon((s) => s.loadTestPad);
  const clearPad = useHorizon((s) => s.clearPad);
  const bookKind = useHorizon((s) => s.bookKind);
  const err = useHorizon((s) => s.ingestError);
  const busy = useHorizon((s) => s.ingestBusy);
  const lastFormat = useHorizon((s) => s.lastFormat);
  const lastBundle = useHorizon((s) => s.lastBundle);
  const ingestStatus = useHorizon((s) => s.ingestStatus);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState<IngestFile[]>([]);

  const sources = useMemo<IngestFile[]>(() => {
    if (files.length) return files;
    if (draft.trim()) return [{ name: "paste.txt", text: draft }];
    return [];
  }, [files, draft]);

  const preview = useMemo(() => (sources.length ? planLocal(sources) : []), [sources]);
  const firstTable = useMemo(
    () => (sources[0]?.text.trim() ? parseAny(sources[0].text) : null),
    [sources],
  );

  async function takeFiles(list: FileList | File[]) {
    const next: IngestFile[] = [];
    for (const file of Array.from(list)) {
      next.push({ name: file.name, text: await file.text() });
    }
    setFiles((cur) => {
      const byName = new Map(cur.map((f) => [f.name, f]));
      for (const f of next) byName.set(f.name, f);
      return [...byName.values()];
    });
    if (next[0]) setDraft(next[0].text);
  }

  function removeFile(name: string) {
    setFiles((cur) => cur.filter((f) => f.name !== name));
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <PageLead kicker="Any format" title="Import" id="load">
            Drop one or many well files. The parser splits mixed objects (several wells in one
            file, type well + laterals, LAS/CSV/JSON). Nothing is preloaded.
          </PageLead>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Source</CardTitle>
              <Caption id="load">
                Multi-file drop is the normal path. Paste works for a single object. Formation-top
                columns on a well file are dropped.
              </Caption>
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
                  if (e.dataTransfer.files.length) void takeFiles(e.dataTransfer.files);
                }}
                className={`flex min-h-16 w-full items-center justify-center rounded-md border border-dashed px-4 py-3 text-sm ${
                  drag ? "border-accent bg-elevated text-fg" : "border-border text-muted"
                }`}
              >
                {files.length
                  ? `${files.length} file${files.length === 1 ? "" : "s"} ready`
                  : "Drop files or click to browse"}
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".las,.csv,.txt,.json,.dat,text/plain,text/csv,application/json"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.length) void takeFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {files.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {files.map((f) => (
                    <li key={f.name} className="flex items-center justify-between gap-3 font-mono">
                      <span className="truncate text-fg">{f.name}</span>
                      <button
                        type="button"
                        className="text-subtle hover:text-danger"
                        onClick={() => removeFile(f.name)}
                      >
                        remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Label htmlFor="source">Or paste one object</Label>
              <Textarea
                id="source"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setFiles([]);
                }}
                placeholder={"data[MD, X, Y, Z, GR, TVT, RES, NPHI]\n8500, 1200.1, 3400.2, -8120, 86.4, 118.2, 12.1, 0.18"}
                className="min-h-56"
              />
              {err && <p className="text-sm text-danger">{err}</p>}
              {ingestStatus && <p className="text-sm text-fg">{ingestStatus}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void ingestFiles(sources)}
                  disabled={busy || !sources.length}
                >
                  {busy ? "Parsing…" : "Import and run"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void ingestFiles(sources, { useAssistant: true })}
                  disabled={busy || !sources.length}
                >
                  Map columns
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => ingestTypewell(draft, files[0]?.name ?? "typewell")}
                  disabled={busy || !draft.trim()}
                >
                  Attach type well
                </Button>
              </div>
              <p className="text-xs text-subtle">
                Map columns sends headers and a few sample rows to the assistant when names are
                unclear. The file stays local. Full curves are not uploaded.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Objects</CardTitle>
                <Caption id="load">
                  {preview.length
                    ? `${preview.length} object${preview.length === 1 ? "" : "s"} found`
                    : lastFormat
                      ? `last format ${lastFormat}`
                      : "Waiting for input."}
                </Caption>
              </CardHeader>
              <CardContent>
                {preview.length ? (
                  <ul className="space-y-3">
                    {preview.map((p, i) => (
                      <li key={`${p.name}-${i}`} className="rounded-md border border-border px-3 py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm text-fg">{p.name}</span>
                          <span className="shrink-0 font-mono text-[10px] uppercase text-subtle">
                            {p.kind} · {p.rows} rows
                          </span>
                        </div>
                        <p className="mt-1 truncate font-mono text-[10px] text-muted">
                          {p.mapped.map((m) => channelLabel(String(m))).join(" · ")}
                        </p>
                        {p.notes.length ? (
                          <p className="mt-1 text-[11px] text-subtle">{p.notes.join(" · ")}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">Waiting for input.</p>
                )}
                {lastBundle?.usedLlm && (
                  <p className="mt-3 text-xs text-muted">Last import used the column mapper.</p>
                )}
                {lastBundle?.skipped.length ? (
                  <p className="mt-2 text-xs text-danger">
                    Skipped: {lastBundle.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}
                  </p>
                ) : null}
                {firstTable?.leakDropped.length ? (
                  <p className="mt-3 text-xs text-danger">
                    Formation name dropped: {firstTable.leakDropped.join(", ")}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Known channels</CardTitle>
                <Caption id="gamma">File headers map to these names.</Caption>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {CANONICAL_CHANNELS.map((c) => (
                    <span
                      key={c}
                      className="rounded-sm border border-border px-2 py-1 text-[11px] text-muted"
                    >
                      {channelLabel(c)}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Testing</CardTitle>
                <Caption id="load">
                  Generated laterals for a dry run. Not field data. Not saved. Cleared by Clear
                  project.
                </Caption>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={loadTestPad}>
                  Generate test wells
                </Button>
                <Button variant="secondary" onClick={clearPad} disabled={bookKind === "empty"}>
                  Clear project
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
