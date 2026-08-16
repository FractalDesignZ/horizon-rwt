import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyPad } from "@/components/empty-pad";
import { PlayBar } from "@/components/play-bar";
import { ProbabilityPanel } from "@/components/probability-panel";
import { SteerCorridor } from "@/components/steer-corridor";
import { Caption, PageLead } from "@/components/caption";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applyWhatIf } from "@/lib/rwt/cycle";
import { adviseAt } from "@/lib/rwt/evolve";
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
  const evolves = useHorizon((s) => s.evolves);

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

  if (!well) return <EmptyPad title="Steer needs a well" />;

  const frame = result?.probability[station];
  const evo = result && evolves[active] ? adviseAt(evolves[active]!, result, station) : null;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <PageLead kicker="From the bit" title="Steer" id="call">
              Current TVT versus type-well target. Recommended path is the lowest-cost walk
              ahead. Red ticks are lost lock. Advisory is HOLD, BUILD, DROP, or CUT.
            </PageLead>
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
            <Button variant="secondary" asChild>
              <Link to="/train">Train</Link>
            </Button>
          </div>
        </div>

        {steer && well && result ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Advisory</p>
                <p className="mt-1 font-display text-4xl tracking-tight">{steer.advisory}</p>
                <p className="mt-1 text-xs text-subtle">
                  {steer.reason}
                  {evo ? ` · trained ${evo.action}` : ""}
                </p>
              </div>
              <Metric label="Bit MD" value={steer.bitMd.toFixed(0)} hint={`TVT ${steer.bitTvt.toFixed(1)}`} />
              <Metric
                label="Target TVT"
                value={steer.target.toFixed(1)}
                hint={`window ${steer.windowLo.toFixed(0)}–${steer.windowHi.toFixed(0)}`}
              />
              <Metric
                label="To alert"
                value={steer.mdToHorizon == null ? "none" : steer.mdToHorizon.toFixed(0)}
                hint={steer.mdToHorizon == null ? "still locked" : "ft MD remaining"}
              />
            </div>

            <Card className="overflow-hidden p-0">
              <CardHeader className="p-5 pb-2">
                <CardTitle>Corridor</CardTitle>
                <Caption id="path">
                  Band is the posterior spread. Dashed is the type-well target. Solid is the
                  recommended path. Red is lost lock.
                </Caption>
              </CardHeader>
              <CardContent className="p-0">
                <SteerCorridor steer={steer} onBit={setStation} />
              </CardContent>
            </Card>
            <PlayBar max={well.stations.length - 1} />

            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Posterior at bit</CardTitle>
                  <Caption id="match">Offset last known to walk the path.</Caption>
                </CardHeader>
                <CardContent>
                  {frame ? <ProbabilityPanel frame={frame} /> : <p className="text-sm text-muted">No posterior yet.</p>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant={steer.advisory === "CUT" ? "danger" : steer.advisory === "HOLD" ? "ok" : "warn"}>
                      {steer.advisory}
                    </Badge>
                    <Badge>path ends {steer.geoEnd.toFixed(1)}</Badge>
                    <Badge>risk {(steer.risk * 100).toFixed(0)}</Badge>
                    <Badge>{steer.remaining} left</Badge>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Rationale</CardTitle>
                  <Caption id="call">Recoverability, offset from target, distance to lost lock.</Caption>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted">
                  <p>
                    Lost-lock stations cost extra. The path goes around them when it can. Max
                    build is 8 ft / 1000 ft MD.
                  </p>
                  <ul className="space-y-2 font-mono text-xs">
                    <li className="flex justify-between">
                      <span className="text-subtle">bit − target</span>
                      <span>{(steer.bitTvt - steer.target).toFixed(2)} ft</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-subtle">path ends</span>
                      <span>{steer.geoEnd.toFixed(2)}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-subtle">alert at</span>
                      <span>{steer.onsetMd != null ? steer.onsetMd.toFixed(0) : "—"}</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-subtle">offset</span>
                      <span>{whatIf >= 0 ? "+" : ""}{whatIf.toFixed(1)}</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">{running ? "Computing path…" : "Run a well first."}</p>
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
