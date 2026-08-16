import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { PlayBar } from "@/components/play-bar";
import { ProbabilityPanel } from "@/components/probability-panel";
import { SteerCorridor } from "@/components/steer-corridor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { applyWhatIf } from "@/lib/rwt/cycle";
import { computeSteer } from "@/lib/rwt/steer";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/steer")({ component: SteerPage });

function SteerPage() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const setWell = useHorizon((s) => s.setWell);
  const results = useHorizon((s) => s.results);
  const station = useHorizon((s) => s.station);
  const setStation = useHorizon((s) => s.setStation);
  const runWell = useHorizon((s) => s.runWell);
  const running = useHorizon((s) => s.running);
  const whatIf = useHorizon((s) => s.whatIf);

  const well = pad.wells.find((w) => w.id === active);
  const raw = results[active];
  const result = useMemo(() => (raw ? applyWhatIf(raw, whatIf) : raw), [raw, whatIf]);
  const steer = useMemo(() => (result ? computeSteer(result, station) : null), [result, station]);

  useEffect(() => {
    if (well && !results[well.id] && !running) runWell(well.id);
  }, [well, results, running, runWell]);

  useEffect(() => {
    if (!well) return;
    const ps = well.stations.findIndex((s) => s.isPredict);
    if (ps >= 0) setStation(ps);
  }, [well, setStation]);

  const frame = result?.probability[station];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">M10 · from the bit</p>
            <h1 className="font-display text-4xl tracking-tight">Steer</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Current position is the bit. The book inverts GR to a TVT target. A geodesic on the
              value-warped metric walks the remaining lateral. Horizon ticks are where match dies.
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
            <Button variant="secondary" onClick={() => runWell(active)} disabled={running}>
              {running ? "Running…" : "Run"}
            </Button>
            <Link
              to="/transfer"
              className="inline-flex h-10 items-center rounded-sm border border-border px-3 text-sm text-muted no-underline hover:text-fg"
            >
              Transfer
            </Link>
          </div>
        </div>

        {steer && well && result ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Advisory</p>
                <p className="mt-1 font-display text-4xl tracking-tight">{steer.advisory}</p>
                <p className="mt-1 text-xs text-subtle">{steer.reason}</p>
              </div>
              <Metric label="Bit MD" value={steer.bitMd.toFixed(0)} hint={`TVT ${steer.bitTvt.toFixed(1)}`} />
              <Metric
                label="Book target"
                value={steer.target.toFixed(1)}
                hint={`window ${steer.windowLo.toFixed(0)}–${steer.windowHi.toFixed(0)}`}
              />
              <Metric
                label="To horizon"
                value={steer.mdToHorizon == null ? "none" : steer.mdToHorizon.toFixed(0)}
                hint={steer.mdToHorizon == null ? "recoverable" : "ft remaining"}
              />
            </div>

            <Card className="overflow-hidden p-0">
              <CardHeader className="p-5 pb-2">
                <CardTitle>Ahead of bit</CardTitle>
                <CardDescription>
                  Teal band = posterior σ · dashed = book · paper = geodesic · red ticks = horizon
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <SteerCorridor steer={steer} onBit={setStation} />
              </CardContent>
            </Card>
            <PlayBar max={well.stations.length - 1} />

            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Outcome here</CardTitle>
                  <CardDescription>Encoded mass at the bit · bias walks the geodesic</CardDescription>
                </CardHeader>
                <CardContent>
                  {frame ? <ProbabilityPanel frame={frame} /> : <p className="text-sm text-muted">No frame.</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant={steer.advisory === "CUT" ? "danger" : steer.advisory === "HOLD" ? "ok" : "warn"}>
                      {steer.advisory}
                    </Badge>
                    <Badge>geo → {steer.geoEnd.toFixed(1)}</Badge>
                    <Badge>risk {(steer.risk * 100).toFixed(0)}</Badge>
                    <Badge>{steer.remaining} stn left</Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Why this call</CardTitle>
                  <CardDescription>Agency is a flow on Mv that stays on the book</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted">
                  <p>
                    Value at each bin is recoverability, inverse horizon score, and distance to the
                    GR-inverted book TVT. The conformal factor e^(-βv) shortens high-value steps.
                    Slope stays under 0.008 ft/ft.
                  </p>
                  <ul className="space-y-2 font-mono text-xs">
                    <li className="flex justify-between">
                      <span className="text-subtle">bit vs book</span>
                      <span>{(steer.bitTvt - steer.target).toFixed(2)} ft</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-subtle">geo end</span>
                      <span>{steer.geoEnd.toFixed(2)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-subtle">onset MD</span>
                      <span>{steer.onsetMd != null ? steer.onsetMd.toFixed(0) : "—"}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-subtle">what-if</span>
                      <span>{whatIf >= 0 ? "+" : ""}{whatIf.toFixed(1)}</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">{running ? "Computing steer…" : "Run a well first."}</p>
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