import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { LockRing } from "@/components/lock-ring";
import { PadCycle } from "@/components/pad-cycle";
import { PersistBarcode } from "@/components/persist-barcode";
import { PlayBar } from "@/components/play-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeLocks, computePadSheaf, padPersistence, wellPersistence } from "@/lib/rwt/cycle";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/locks")({ component: LocksPage });

function LocksPage() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const setWell = useHorizon((s) => s.setWell);
  const results = useHorizon((s) => s.results);
  const station = useHorizon((s) => s.station);
  const runWell = useHorizon((s) => s.runWell);
  const runPad = useHorizon((s) => s.runPad);
  const running = useHorizon((s) => s.running);
  const well = pad.wells.find((w) => w.id === active);
  const result = results[active];

  useEffect(() => {
    if (well && !results[well.id] && !running) runWell(well.id);
  }, [well, results, running, runWell]);

  const locks = useMemo(() => (result ? computeLocks(result, station) : null), [result, station]);
  const padSheaf = useMemo(() => computePadSheaf(pad.wells, results), [pad.wells, results]);
  const wellPH = useMemo(() => (result ? wellPersistence(result) : null), [result]);
  const padPH = useMemo(() => padPersistence(pad.wells), [pad.wells]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">M8 · CycleSheaf</p>
            <h1 className="font-display text-4xl tracking-tight">Locks</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Tumblers are local constraints. The key is a global section — residual turns only
              when enough pins align. The pad graph is a CycleSheaf; persistence replaces algebraic
              contraction on curvature features.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-10 rounded-sm border border-border bg-elevated px-3 text-sm"
              value={active}
              onChange={(e) => setWell(e.target.value)}
            >
              {pad.wells.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={runPad} disabled={running}>
              {running ? "Running…" : "Run pad"}
            </Button>
          </div>
        </div>

        {locks && result && well ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Key fit" value={`${(locks.keyFit * 100).toFixed(0)}`} hint={`${locks.turns} pins down`} />
              <Metric
                label="Pad λ₂"
                value={
                  padSheaf.algebraicConnectivity < 1e-3
                    ? padSheaf.algebraicConnectivity.toExponential(2)
                    : padSheaf.algebraicConnectivity.toFixed(3)
                }
                hint={`h⁰ ${padSheaf.kernelDim}`}
              />
              <Metric
                label="Pad holonomy"
                value={padSheaf.holonomy.toFixed(2)}
                hint={`${padSheaf.edges.length} restriction edges`}
              />
              <Metric
                label="PH merge"
                value={wellPH?.mergeScale != null ? wellPH.mergeScale.toFixed(2) : "—"}
                hint={`β₀ ${wellPH?.beta0 ?? "—"} · β₁ ${wellPH?.beta1 ?? "—"}`}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Tumblers</CardTitle>
                  <CardDescription>
                    Station MD {well.stations[Math.min(station, well.stations.length - 1)]!.md.toFixed(0)} ·
                    {locks.fireReady ? " residual key turns" : " prior holds the cylinder"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <LockRing locks={locks} />
                  <ul className="w-full space-y-1.5">
                    {locks.tumblers.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2">
                          <Badge variant={t.locked ? "ok" : "warn"}>{t.locked ? "in" : "out"}</Badge>
                          <span>{t.name}</span>
                        </span>
                        <span className="font-mono text-xs text-muted">{t.note}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="overflow-hidden p-0">
                <CardHeader className="p-5 pb-2">
                  <CardTitle>Pad CycleSheaf</CardTitle>
                  <CardDescription>
                    Stalks last-known × azimuth · edge tension from ΔTVT and twist · click a well
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <PadCycle sheaf={padSheaf} active={active} onSelect={setWell} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Play from here</CardTitle>
                <CardDescription>Encoded posterior walks the toe. Bias last-known without a re-run.</CardDescription>
              </CardHeader>
              <CardContent>
                <PlayBar max={well.stations.length - 1} />
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="overflow-hidden p-0">
                <CardHeader className="p-5 pb-2">
                  <CardTitle>Well persistence</CardTitle>
                  <CardDescription>
                    Rips on (E_ref, torsion, GR mismatch) · Shiab-style curvature features
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {wellPH && <PersistBarcode report={wellPH} />}
                </CardContent>
              </Card>
              <Card className="overflow-hidden p-0">
                <CardHeader className="p-5 pb-2">
                  <CardTitle>Pad persistence</CardTitle>
                  <CardDescription>Rips on well centroids + last-known · H0 merge of the pad</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <PersistBarcode report={padPH} />
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">{running ? "Computing locks…" : "Run a well to cut the key."}</p>
        )}
      </div>
    </AppShell>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}