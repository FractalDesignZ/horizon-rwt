import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { Caption, PageLead } from "@/components/caption";
import { EmptyPad } from "@/components/empty-pad";
import { ActionBars, FitnessChart, WorldGrid } from "@/components/evolve-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adviseAt } from "@/lib/rwt/evolve";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/train")({ component: TrainPage });

function TrainPage() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const setWell = useHorizon((s) => s.setWell);
  const results = useHorizon((s) => s.results);
  const station = useHorizon((s) => s.station);
  const setStation = useHorizon((s) => s.setStation);
  const runWell = useHorizon((s) => s.runWell);
  const running = useHorizon((s) => s.running);
  const evolve = useHorizon((s) => s.evolve);
  const evolves = useHorizon((s) => s.evolves);
  const evolving = useHorizon((s) => s.evolving);
  const evolveTick = useHorizon((s) => s.evolveTick);
  const well = pad.wells.find((w) => w.id === active);
  const result = results[active];
  const report = evolves[active];

  useEffect(() => {
    if (well && !results[well.id] && !running) runWell(well.id);
  }, [well, results, running, runWell]);

  const live = useMemo(() => {
    if (!report || !result) return null;
    return adviseAt(report, result, station);
  }, [report, result, station]);

  if (!well) return <EmptyPad title="Train needs a well" />;

  const beat = report && report.fit.holdout > report.rule.holdout + 0.02;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <PageLead kicker="From scratch" title="Train" id="train">
              A small net reads the live grid (zone, threat, bit) and votes HOLD / BUILD / DROP /
              CUT. Weights breed by fitness. Holdout is unseen during breeding — that is the
              generalization check.
            </PageLead>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-10 rounded-sm border border-border bg-elevated px-3 text-sm"
              value={active}
              onChange={(e) => setWell(e.target.value)}
              aria-label="Well"
            >
              {pad.wells.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <Button onClick={() => evolve(active)} disabled={evolving || !result}>
              {evolving ? `Gen ${evolveTick?.gen ?? 0}…` : "Train"}
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/steer">Steer</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Train fit"
            value={report ? report.fit.train.toFixed(2) : "—"}
            hint={report ? `${report.fit.nTrain} labeled` : "run train"}
          />
          <Kpi
            label="Holdout"
            value={report ? report.fit.holdout.toFixed(2) : "—"}
            hint={report ? `${(report.fit.accHold * 100).toFixed(0)}% match` : "unseen slice"}
          />
          <Kpi
            label="Vs rule"
            value={
              report
                ? `${report.fit.holdout >= report.rule.holdout ? "+" : ""}${(report.fit.holdout - report.rule.holdout).toFixed(2)}`
                : "—"
            }
            hint={beat ? "evolved wins holdout" : "rule is the baseline"}
          />
          <Kpi
            label="Call"
            value={live?.action ?? report?.atStation.action ?? "—"}
            hint={live ? `rule ${live.ruleAction}` : "after train"}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle>World grid</CardTitle>
              <Caption id="train">
                Columns look ahead of the bit. Rows are TVT around the current pick. Same idea as
                reading a tile map — not a stored button sequence.
              </Caption>
            </CardHeader>
            <CardContent>
              {live || report ? (
                <WorldGrid world={(live ?? report!.atStation).world} />
              ) : (
                <p className="text-sm text-muted">Run the well, then Train.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Action scores</CardTitle>
              <Caption id="train">Highest bar is the call at this station.</Caption>
            </CardHeader>
            <CardContent>
              {live || report ? (
                <ActionBars
                  scores={(live ?? report!.atStation).scores}
                  action={(live ?? report!.atStation).action}
                  rule={(live ?? report!.atStation).ruleAction}
                />
              ) : (
                <p className="text-sm text-muted">No net yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Fitness</CardTitle>
                <Caption id="train">
                  Light = best on train. Gold = holdout. Grey = population mean.
                </Caption>
              </div>
              {report && (
                <Badge variant={beat ? "ok" : "warn"}>{beat ? "holdout beats rule" : "rule holds"}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {report ? (
              <FitnessChart report={report} />
            ) : evolveTick ? (
              <p className="font-mono text-sm text-muted">
                gen {evolveTick.gen} · best {evolveTick.best.toFixed(2)} · holdout{" "}
                {evolveTick.holdout.toFixed(2)}
              </p>
            ) : (
              <p className="text-sm text-muted">No run yet.</p>
            )}
          </CardContent>
        </Card>

        {well.stations.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.12em] text-muted">Station</span>
            <input
              type="range"
              min={0}
              max={well.stations.length - 1}
              value={Math.min(station, well.stations.length - 1)}
              onChange={(e) => setStation(Number(e.target.value))}
            />
          </label>
        )}

        {report && (
          <ul className="max-w-2xl space-y-1 text-sm text-muted">
            {report.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
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
