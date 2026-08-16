import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyPad } from "@/components/empty-pad";
import { PageLead } from "@/components/caption";
import { PlayBar } from "@/components/play-bar";
import { RogueStudio } from "@/components/rogue-studio";
import { Button } from "@/components/ui/button";
import { computeRogue } from "@/lib/rwt/rogue";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/rogue")({ component: RoguePage });

function RoguePage() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const setWell = useHorizon((s) => s.setWell);
  const results = useHorizon((s) => s.results);
  const station = useHorizon((s) => s.station);
  const runWell = useHorizon((s) => s.runWell);
  const running = useHorizon((s) => s.running);
  const well = pad.wells.find((w) => w.id === active);
  const report = useMemo(() => (well ? computeRogue(well) : null), [well]);
  const frame = report?.frames[Math.min(station, (report.frames.length || 1) - 1)];

  useEffect(() => {
    if (well && !results[well.id] && !running) runWell(well.id);
  }, [well, results, running, runWell]);

  if (!well) return <EmptyPad title="Drilling needs a well" />;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <PageLead kicker="Mechanics" title="Drilling" id="bit">
              WOB, RPM, torque, ROP. Regime: Normal, Stick-slip, Whirl, or Bit bounce. Three
              lights — Stop, Ease, Watch. Output is a WOB and RPM change.
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
          </div>
        </div>

        {report && frame && well ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="WOB" value={frame.mech.wob.toFixed(0)} hint="klbf" />
              <Metric label="RPM" value={frame.mech.rpm.toFixed(0)} hint="rev / min" />
              <Metric label="Torque" value={frame.mech.trq.toFixed(1)} hint="kft·lbf" />
              <Metric label="ROP" value={frame.mech.rop.toFixed(1)} hint="ft / hr" />
            </div>
            <RogueStudio report={report} station={Math.min(station, well.stations.length - 1)} />
            <PlayBar max={well.stations.length - 1} />
          </>
        ) : (
          <p className="text-sm text-muted">Select a well.</p>
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
