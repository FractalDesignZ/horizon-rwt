import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ProbabilityPanel } from "@/components/probability-panel";
import { WellTracks } from "@/components/well-tracks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeLocks, computePadSheaf } from "@/lib/rwt/cycle";
import { computeSteer } from "@/lib/rwt/steer";
import { transferPosterior } from "@/lib/rwt/transfer";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/compare")({ component: ComparePage });

function ComparePage() {
  const pad = useHorizon((s) => s.pad);
  const aId = useHorizon((s) => s.activeWellId);
  const bId = useHorizon((s) => s.targetWellId);
  const setWell = useHorizon((s) => s.setWell);
  const setTarget = useHorizon((s) => s.setTarget);
  const results = useHorizon((s) => s.results);
  const station = useHorizon((s) => s.station);
  const setStation = useHorizon((s) => s.setStation);
  const runWell = useHorizon((s) => s.runWell);
  const running = useHorizon((s) => s.running);

  const wellA = pad.wells.find((w) => w.id === aId);
  const wellB = pad.wells.find((w) => w.id === bId);
  const resA = results[aId];
  const resB = results[bId];

  useEffect(() => {
    if (wellA && !results[wellA.id] && !running) runWell(wellA.id);
  }, [wellA, results, running, runWell]);
  useEffect(() => {
    if (wellB && wellB.id !== wellA?.id && !results[wellB.id] && !running) runWell(wellB.id);
  }, [wellB, wellA, results, running, runWell]);

  const padSheaf = useMemo(() => computePadSheaf(pad.wells, results), [pad.wells, results]);
  const hits = useMemo(
    () => (resA ? transferPosterior(resA, station, padSheaf, results) : []),
    [resA, station, padSheaf, results],
  );
  const hit = hits.find((h) => h.wellId === bId);

  const frac = wellA ? station / Math.max(wellA.stations.length - 1, 1) : 0;
  const bIndex = wellB ? Math.round(frac * (wellB.stations.length - 1)) : 0;
  const steerA = resA ? computeSteer(resA, station) : null;
  const steerB = resB ? computeSteer(resB, bIndex) : null;
  const lockA = resA ? computeLocks(resA, station) : null;
  const lockB = resB ? computeLocks(resB, bIndex) : null;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">M12 · pair</p>
            <h1 className="font-display text-4xl tracking-tight">Compare</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Two laterals, same pad book. Align on fractional MD. The transferred posterior is
              what A would tell B from this station.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-10 rounded-sm border border-border bg-elevated px-3 text-sm"
              value={aId}
              onChange={(e) => setWell(e.target.value)}
              aria-label="Well A"
            >
              {pad.wells.map((w) => (
                <option key={w.id} value={w.id}>
                  A {w.id}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-sm border border-border bg-elevated px-3 text-sm"
              value={bId}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="Well B"
            >
              {pad.wells
                .filter((w) => w.id !== aId)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    B {w.id}
                  </option>
                ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => {
                const prev = aId;
                setWell(bId);
                setTarget(prev);
              }}
            >
              Swap
            </Button>
          </div>
        </div>

        {wellA && wellB ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Delta
                label="Last-known"
                a={resA ? resA.priors.lastKnown.toFixed(1) : "—"}
                b={resB ? resB.priors.lastKnown.toFixed(1) : "—"}
              />
              <Delta
                label="Toe RMSE"
                a={resA?.toeRmse != null ? resA.toeRmse.toFixed(2) : "—"}
                b={resB?.toeRmse != null ? resB.toeRmse.toFixed(2) : "—"}
              />
              <Delta label="Call" a={steerA?.advisory ?? "—"} b={steerB?.advisory ?? "—"} />
              <Delta
                label="Key fit"
                a={lockA ? `${(lockA.keyFit * 100).toFixed(0)}` : "—"}
                b={lockB ? `${(lockB.keyFit * 100).toFixed(0)}` : "—"}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Card className="overflow-hidden p-0">
                <CardHeader className="p-5 pb-2">
                  <CardTitle>{wellA.id}</CardTitle>
                  <CardDescription>Serve at aligned station</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <WellTracks well={wellA} result={resA} station={station} onStation={setStation} />
                </CardContent>
              </Card>
              <Card className="overflow-hidden p-0">
                <CardHeader className="p-5 pb-2">
                  <CardTitle>{wellB.id}</CardTitle>
                  <CardDescription>Same fractional MD</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <WellTracks well={wellB} result={resB} station={bIndex} onStation={(i) => {
                    const f = i / Math.max(wellB.stations.length - 1, 1);
                    setStation(Math.round(f * (wellA.stations.length - 1)));
                  }} />
                </CardContent>
              </Card>
            </div>
            <input
              type="range"
              min={0}
              max={wellA.stations.length - 1}
              value={Math.min(station, wellA.stations.length - 1)}
              onChange={(e) => setStation(Number(e.target.value))}
              className="w-full"
              aria-label="Aligned station"
            />

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>A at MD {wellA.stations[Math.min(station, wellA.stations.length - 1)]!.md.toFixed(0)}</CardTitle>
                  <CardDescription>Native posterior</CardDescription>
                </CardHeader>
                <CardContent>
                  {resA?.probability[station] ? (
                    <ProbabilityPanel frame={resA.probability[station]!} />
                  ) : (
                    <p className="text-sm text-muted">Run A.</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>A → B transfer</CardTitle>
                  <CardDescription>
                    {hit
                      ? `shift ${hit.shift >= 0 ? "+" : ""}${hit.shift.toFixed(2)} · w ${hit.weight.toFixed(2)}`
                      : "Need a pad edge"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hit ? (
                    <ProbabilityPanel frame={hit.frame} />
                  ) : resB?.probability[bIndex] ? (
                    <ProbabilityPanel frame={resB.probability[bIndex]!} />
                  ) : (
                    <p className="text-sm text-muted">Run both wells.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {steerA && <Badge variant={steerA.advisory === "CUT" ? "danger" : "ok"}>{wellA.id} {steerA.advisory}</Badge>}
                    {steerB && <Badge variant={steerB.advisory === "CUT" ? "danger" : "ok"}>{wellB.id} {steerB.advisory}</Badge>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Need two wells on the pad.</p>
        )}
      </div>
    </AppShell>
  );
}

function Delta({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-mono text-lg tabular-nums">
        {a} <span className="text-subtle">/</span> {b}
      </p>
    </div>
  );
}