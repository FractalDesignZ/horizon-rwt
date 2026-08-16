import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { ChannelRaster } from "@/components/channel-raster";
import { CtsChain } from "@/components/cts-chain";
import { PadCycle } from "@/components/pad-cycle";
import { PlayBar } from "@/components/play-bar";
import { ProbabilityPanel } from "@/components/probability-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeCts } from "@/lib/rwt/cts";
import { computePadSheaf } from "@/lib/rwt/cycle";
import { applyWhatIf } from "@/lib/rwt/cycle";
import { transferPosterior } from "@/lib/rwt/transfer";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/transfer")({ component: TransferPage });

function TransferPage() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const targetId = useHorizon((s) => s.targetWellId);
  const setWell = useHorizon((s) => s.setWell);
  const setTarget = useHorizon((s) => s.setTarget);
  const results = useHorizon((s) => s.results);
  const station = useHorizon((s) => s.station);
  const setStation = useHorizon((s) => s.setStation);
  const runWell = useHorizon((s) => s.runWell);
  const runPad = useHorizon((s) => s.runPad);
  const running = useHorizon((s) => s.running);
  const whatIf = useHorizon((s) => s.whatIf);

  const well = pad.wells.find((w) => w.id === active);
  const raw = results[active];
  const result = useMemo(() => (raw ? applyWhatIf(raw, whatIf) : raw), [raw, whatIf]);

  useEffect(() => {
    if (well && !results[well.id] && !running) runWell(well.id);
  }, [well, results, running, runWell]);

  const cts = useMemo(() => (result ? computeCts(result, station) : null), [result, station]);
  const padSheaf = useMemo(() => computePadSheaf(pad.wells, results), [pad.wells, results]);
  const hits = useMemo(
    () => (result ? transferPosterior(result, station, padSheaf, results) : []),
    [result, station, padSheaf, results],
  );
  const hit = hits.find((h) => h.wellId === targetId) ?? hits[0];
  const srcFrame = result?.probability[station];
  const names = result?.cts.channels.map((c) => c.name) ?? ["GR", "RES", "NPHI", "RHOB"];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">M9 · from here</p>
            <h1 className="font-display text-4xl tracking-tight">Transfer</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Every extra log is a stalk. The CTS chain compresses state to a coherent pair
              (Q, Φ). The encoded posterior at this station is transported across the pad sheaf
              onto a neighbor.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="h-10 rounded-sm border border-border bg-elevated px-3 text-sm"
              value={active}
              onChange={(e) => setWell(e.target.value)}
              aria-label="Source well"
            >
              {pad.wells.map((w) => (
                <option key={w.id} value={w.id}>
                  from {w.id}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-sm border border-border bg-elevated px-3 text-sm"
              value={targetId}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="Target well"
            >
              {pad.wells
                .filter((w) => w.id !== active)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    onto {w.id}
                  </option>
                ))}
            </select>
            <Button variant="secondary" onClick={runPad} disabled={running}>
              {running ? "Running…" : "Run pad"}
            </Button>
          </div>
        </div>

        {result && well && cts ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Schematism"
                value={cts.schematism ? "holds" : "fails"}
                hint={`contact ${cts.contact.toFixed(2)}`}
              />
              <Metric label="Warp e^{−βv}" value={cts.warp.toFixed(2)} hint={`value ${cts.value.toFixed(2)}`} />
              <Metric
                label="Shift"
                value={hit ? `${hit.shift >= 0 ? "+" : ""}${hit.shift.toFixed(2)}` : "—"}
                hint={hit ? `weight ${hit.weight.toFixed(2)}` : "run pad for edges"}
              />
              <Metric
                label="Received"
                value={hit ? hit.frame.mode.toFixed(1) : "—"}
                hint={hit ? `${hit.wellId} mode` : "no neighbor"}
              />
            </div>

            <CtsChain cts={cts} />

            <Card className="overflow-hidden p-0">
              <CardHeader className="p-5 pb-2">
                <CardTitle>data[channel, …]</CardTitle>
                <CardDescription>Click the raster to set current station · extra logs ride the same MD index</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ChannelRaster well={well} names={names} station={station} onStation={setStation} />
              </CardContent>
            </Card>
            <PlayBar max={well.stations.length - 1} />

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Source at MD {well.stations[station]!.md.toFixed(0)}</CardTitle>
                  <CardDescription>{well.id} · encoded posterior</CardDescription>
                </CardHeader>
                <CardContent>
                  {srcFrame ? (
                    <ProbabilityPanel frame={srcFrame} />
                  ) : (
                    <p className="text-sm text-muted">No frame.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cts.channels.slice(0, 6).map((c) => (
                      <Badge key={c.name}>
                        {c.name} {Number.isFinite(c.corrGr) ? `ρ ${c.corrGr.toFixed(2)}` : ""}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Received on {hit?.wellId ?? targetId}</CardTitle>
                  <CardDescription>
                    Restriction across pad edge · tension {hit ? hit.tension.toFixed(2) : "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hit ? (
                    <ProbabilityPanel frame={hit.frame} />
                  ) : (
                    <p className="text-sm text-muted">Run the pad so neighbor stalks exist.</p>
                  )}
                  {hits.length > 1 && (
                    <ul className="mt-4 space-y-1.5">
                      {hits.map((h) => (
                        <li key={h.wellId}>
                          <button
                            type="button"
                            onClick={() => setTarget(h.wellId)}
                            className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-left text-sm hover:bg-elevated"
                          >
                            <span className="font-mono">{h.wellId}</span>
                            <span className="font-mono text-xs text-muted">
                              {h.frame.mode.toFixed(1)} · w {h.weight.toFixed(2)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="overflow-hidden p-0">
              <CardHeader className="p-5 pb-2">
                <CardTitle>Pad transport</CardTitle>
                <CardDescription>Click a well to retarget the source</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <PadCycle sheaf={padSheaf} active={active} onSelect={setWell} />
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="text-sm text-muted">{running ? "Computing transfer…" : "Run a well first."}</p>
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