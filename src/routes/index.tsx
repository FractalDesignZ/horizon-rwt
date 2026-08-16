import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ModeRail } from "@/components/mode-rail";
import { IsoPad } from "@/components/iso-pad";
import { PadMap } from "@/components/pad-map";
import { WellSection } from "@/components/well-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Wellscape });

function Wellscape() {
  const pad = useHorizon((s) => s.pad);
  const results = useHorizon((s) => s.results);
  const active = useHorizon((s) => s.activeWellId);
  const running = useHorizon((s) => s.running);
  const setWell = useHorizon((s) => s.setWell);
  const runWell = useHorizon((s) => s.runWell);
  const runPad = useHorizon((s) => s.runPad);
  const removeWell = useHorizon((s) => s.removeWell);
  const result = results[active];
  const [view, setView] = useState<"plan" | "section" | "iso">("plan");

  useEffect(() => {
    if (!results[active] && !running) runWell(active);
  }, [active, results, running, runWell]);

  const well = pad.wells.find((w) => w.id === active);
  const toeCount = well?.stations.filter((s) => s.isPredict).length ?? 0;
  const rmses = pad.wells.map((w) => results[w.id]?.toeRmse).filter((v): v is number => v != null);
  const meanRmse = rmses.length ? rmses.reduce((a, b) => a + b, 0) / rmses.length : null;
  const horizons = pad.wells.filter((w) => results[w.id]?.sheaf.horizonOnset != null).length;

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Eagle pad 01</p>
            <h1 className="mt-1 font-display text-4xl tracking-tight md:text-5xl">Wellscape</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Geology is a GR@TVT book. Laterals are paths that must be placed on it.
              Priors first, match second, residual only if Gate 3 accepts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => runWell(active)} disabled={running}>
              {running ? "Running…" : "Run well"}
            </Button>
            <Button onClick={runPad} disabled={running}>
              Run pad
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Wells" value={String(pad.wells.length)} hint="synthetic pad + ingest" />
          <Kpi label="Active toe" value={String(toeCount)} hint="1-ft predict stations" />
          <Kpi
            label="Selected RMSE"
            value={result?.toeRmse != null ? result.toeRmse.toFixed(2) : "—"}
            hint={result?.selectedName ?? "awaiting run"}
          />
          <Kpi
            label="Horizons"
            value={`${horizons}/${pad.wells.length}`}
            hint={meanRmse != null ? `pad RMSE ${meanRmse.toFixed(2)}` : "run pad to certify"}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          <Card className="overflow-hidden p-0">
            <CardHeader className="p-5 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{view === "plan" ? "Plan" : view === "section" ? "Section" : "Iso"}</CardTitle>
                  <CardDescription>
                    {view === "plan"
                      ? "Lateral XY · click a toe to select"
                      : view === "section"
                        ? "Departure vs TVD · red = horizon onset"
                        : "Isometric XYZ · heel to toe"}
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant={view === "plan" ? "default" : "secondary"} onClick={() => setView("plan")}>
                    Plan
                  </Button>
                  <Button
                    size="sm"
                    variant={view === "section" ? "default" : "secondary"}
                    onClick={() => setView("section")}
                  >
                    Section
                  </Button>
                  <Button size="sm" variant={view === "iso" ? "default" : "secondary"} onClick={() => setView("iso")}>
                    Iso
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {view === "plan" ? <PadMap /> : view === "section" ? <WellSection /> : <IsoPad />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Wells</CardTitle>
              <CardDescription>GroupKFold unit is the well</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 p-5 pt-0">
              {pad.wells.map((w) => {
                const r = results[w.id];
                const on = w.id === active;
                const ingested = w.padId === "ingest";
                return (
                  <div
                    key={w.id}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 ${
                      on ? "bg-elevated" : "hover:bg-elevated/60"
                    }`}
                  >
                    <button type="button" onClick={() => setWell(w.id)} className="min-w-0 flex-1 text-left">
                      <span className="font-mono text-sm">{w.id}</span>
                    </button>
                    <span className="flex items-center gap-2">
                      {r?.sheaf.horizonOnset != null && <Badge variant="danger">H</Badge>}
                      {r ? (
                        <Badge variant={r.residual.useResidual ? "ok" : "warn"}>
                          {r.residual.useResidual ? "G3" : "floor"}
                        </Badge>
                      ) : (
                        <Badge>idle</Badge>
                      )}
                      <span className="font-mono text-xs tabular-nums text-muted">
                        {r?.toeRmse != null ? r.toeRmse.toFixed(2) : "—"}
                      </span>
                      {ingested && (
                        <button
                          type="button"
                          className="text-xs text-subtle hover:text-danger"
                          onClick={() => removeWell(w.id)}
                          aria-label={`Remove ${w.id}`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
              <div className="mt-3 flex flex-wrap gap-4">
                <Link
                  to="/well/$id"
                  params={{ id: active }}
                  className="text-sm text-muted no-underline hover:text-fg"
                >
                  Open well {active}
                </Link>
                <Link to="/fence" className="text-sm text-muted no-underline hover:text-fg">
                  Pad fence
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {result && <ModeRail modes={result.modes} />}
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-mono text-3xl tabular-nums text-fg">{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}
