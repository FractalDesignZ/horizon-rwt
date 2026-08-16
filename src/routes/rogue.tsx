import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
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

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">M13 · GT-MoE</p>
            <h1 className="font-display text-4xl tracking-tight">Rogue</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              WOB, RPM, torque, and ROP live on a curved manifold. Sliding-window homology
              reads the regime. Experts gate. Safety is three axioms, not a threshold list.
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
          </div>
        </div>

        {report && frame && well ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="WOB" value={frame.mech.wob.toFixed(0)} hint="kN" />
              <Metric label="RPM" value={frame.mech.rpm.toFixed(0)} hint="rev/min" />
              <Metric label="Torque" value={frame.mech.trq.toFixed(1)} hint="kN·m" />
              <Metric label="ROP" value={frame.mech.rop.toFixed(1)} hint="m/hr" />
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