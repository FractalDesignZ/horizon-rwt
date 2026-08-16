import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ParticleCloud } from "@/components/particle-cloud";
import { PlayBar } from "@/components/play-bar";
import { ProbabilityPanel } from "@/components/probability-panel";
import { WellTracks, type TrackOverlay } from "@/components/well-tracks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { applyWhatIf } from "@/lib/rwt/cycle";
import { resultToCsv } from "@/lib/rwt/pipeline";
import { saveRun } from "@/lib/runs";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/predict")({ component: Predict });

const OVERLAYS: { id: TrackOverlay; label: string }[] = [
  { id: "served", label: "serve" },
  { id: "truth", label: "truth" },
  { id: "last", label: "last" },
  { id: "stack", label: "stack" },
  { id: "pf", label: "PF" },
  { id: "ncc", label: "NCC" },
];

function Predict() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const setWell = useHorizon((s) => s.setWell);
  const results = useHorizon((s) => s.results);
  const station = useHorizon((s) => s.station);
  const setStation = useHorizon((s) => s.setStation);
  const runWell = useHorizon((s) => s.runWell);
  const running = useHorizon((s) => s.running);
  const whatIf = useHorizon((s) => s.whatIf);
  const { user } = useCurrentUserState();
  const [saved, setSaved] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<TrackOverlay[]>(["served", "truth", "last"]);

  const well = pad.wells.find((w) => w.id === active);
  const raw = results[active];
  const result = useMemo(() => (raw ? applyWhatIf(raw, whatIf) : raw), [raw, whatIf]);

  useEffect(() => {
    if (well && !results[well.id] && !running) runWell(well.id);
  }, [well, results, running, runWell]);

  if (!well) {
    return (
      <AppShell>
        <p className="text-muted">No well selected.</p>
      </AppShell>
    );
  }

  const frame = result?.probability[station];
  const g3 = result?.residual.gate3;

  function toggle(id: TrackOverlay) {
    setOverlays((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function downloadCsv() {
    if (!result || !well) return;
    const blob = new Blob([resultToCsv(well, result)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${well.id}-served.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function persist() {
    if (!result || !user || !well) return;
    setSaveErr(null);
    try {
      const res = await saveRun({
        data: {
          name: `${well.name} · ${result.selectedName}`,
          wellId: well.id,
          source: well.sourceFormat,
          metrics: {
            toeRmse: result.toeRmse,
            gate3: result.residual.gate3,
            selectedName: result.selectedName,
            holonomy: result.geometry.cumTwist,
            frustration: result.sheaf.frustration,
            winding: result.sheaf.winding,
            horizonOnset: result.sheaf.horizonOnset,
            whatIf,
          },
        },
      });
      setSaved(res.id);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">M0–M8 serve</p>
            <h1 className="font-display text-4xl tracking-tight">Predict</h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Encoded variable probability of outcome, dynamic along MD. Play the toe. Bias
              last-known and watch the posterior walk.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <Button variant="secondary" onClick={downloadCsv} disabled={!result}>
              Export
            </Button>
            <Button onClick={() => void persist()} disabled={!result || !user}>
              {user ? "Seal run" : "Sign in to seal"}
            </Button>
          </div>
        </div>

        {saved && <p className="text-sm text-ok">Sealed {saved}</p>}
        {saveErr && <p className="text-sm text-danger">{saveErr}</p>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Serve" value={result?.selectedName ?? "—"} />
          <Stat label="Toe RMSE" value={result?.toeRmse != null ? result.toeRmse.toFixed(2) : "—"} />
          <Stat label="Gate3" value={g3 ? (g3.accept ? "ACCEPT" : "REJECT") : "—"} />
          <Stat label="Best floor" value={g3 ? `${g3.bestFloorName} ${g3.bestFloor.toFixed(2)}` : "—"} />
          <Stat
            label="Fire rate"
            value={
              result
                ? `${((result.residual.fire.filter(Boolean).length / Math.max(well.stations.filter((s) => s.isPredict).length, 1)) * 100).toFixed(0)}%`
                : "—"
            }
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {OVERLAYS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={`rounded-sm border px-2.5 py-1 text-xs ${
                overlays.includes(o.id)
                  ? "border-accent bg-elevated text-fg"
                  : "border-border text-muted"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <Card className="overflow-hidden p-0">
          <WellTracks
            well={well}
            result={result}
            station={station}
            onStation={setStation}
            overlays={overlays}
          />
        </Card>
        <PlayBar max={well.stations.length - 1} />

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Outcome at MD {well.stations[station]!.md.toFixed(0)}</CardTitle>
              <CardDescription>Dynamic posterior · horizon when local recoverability drops</CardDescription>
            </CardHeader>
            <CardContent>
              {frame ? <ProbabilityPanel frame={frame} /> : <p className="text-sm text-muted">Run first.</p>}
              {result && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant={result.residual.fire[station] ? "ok" : "default"}>
                    {result.residual.fire[station] ? "Δ fire" : "prior"}
                  </Badge>
                  <Badge>PF {(result.priors.pfConf[station]! * 100).toFixed(0)}</Badge>
                  <Badge>GR {(result.priors.grAgree[station]! * 100).toFixed(0)}</Badge>
                  {result.probability[station]?.horizon && <Badge variant="danger">horizon</Badge>}
                  {whatIf !== 0 && <Badge variant="warn">bias {whatIf > 0 ? "+" : ""}{whatIf.toFixed(1)}</Badge>}
                </div>
              )}
              {result && (
                <div className="mt-6">
                  <ParticleCloud result={result} station={station} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prior floors</CardTitle>
              <CardDescription>Holdout heel RMSE · residual must beat all</CardDescription>
            </CardHeader>
            <CardContent>
              {g3 ? (
                <ul className="space-y-2">
                  {Object.entries(g3.floors).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-mono text-muted">{k}</span>
                      <span className="font-mono tabular-nums text-fg">
                        {Number.isFinite(v) ? v.toFixed(3) : "—"}
                      </span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm">
                    <span className="font-mono text-muted">residual</span>
                    <span className="font-mono tabular-nums text-fg">{g3.residualRmse.toFixed(3)}</span>
                  </li>
                </ul>
              ) : (
                <p className="text-sm text-muted">Awaiting Gate 3.</p>
              )}
              <Link to="/steer" className="mt-4 ml-4 inline-block text-sm text-muted no-underline hover:text-fg">
                Steer from bit
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 truncate font-mono text-lg tabular-nums text-fg">{value}</p>
    </div>
  );
}