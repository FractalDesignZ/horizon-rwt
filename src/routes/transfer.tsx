import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyPad } from "@/components/empty-pad";
import { ChannelRaster } from "@/components/channel-raster";
import { CtsChain } from "@/components/cts-chain";
import { PadCycle } from "@/components/pad-cycle";
import { PlayBar } from "@/components/play-bar";
import { ProbabilityPanel } from "@/components/probability-panel";
import { Caption, PageLead } from "@/components/caption";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  if (!well) return <EmptyPad title="Transfer needs a well" />;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <PageLead kicker="Source → target" title="Transfer" id="neighbors">
              Pack the posterior on the source well and send it to a neighbor. If pad loops do
              not close, this stays a pairwise link — not a pad-wide field.
            </PageLead>
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
                  source {w.id}
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
                    target {w.id}
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
                label="Contact"
                value={cts.schematism ? "ok" : "weak"}
                hint={`fit ${cts.contact.toFixed(2)}`}
              />
              <Metric label="Warp" value={cts.warp.toFixed(2)} hint={`value ${cts.value.toFixed(2)}`} />
              <Metric
                label="Shift"
                value={hit ? `${hit.shift >= 0 ? "+" : ""}${hit.shift.toFixed(2)}` : "—"}
                hint={hit ? `weight ${hit.weight.toFixed(2)}` : "run pad for neighbors"}
              />
              <Metric
                label="Landed"
                value={hit ? hit.frame.mode.toFixed(1) : "—"}
                hint={hit ? `on ${hit.wellId}` : "no neighbor"}
              />
            </div>

            <CtsChain cts={cts} />

            <Card className="overflow-hidden p-0">
              <CardHeader className="p-5 pb-2">
                <CardTitle>Channels</CardTitle>
                <Caption id="gamma">Click a station. Extra logs share MD.</Caption>
              </CardHeader>
              <CardContent className="p-0">
                <ChannelRaster well={well} names={names} station={station} onStation={setStation} />
              </CardContent>
            </Card>
            <PlayBar max={well.stations.length - 1} />

            <div className="grid gap-5 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {well.id} @ {well.stations[station]!.md.toFixed(0)}
                  </CardTitle>
                  <Caption id="match">Source posterior</Caption>
                </CardHeader>
                <CardContent>
                  {srcFrame ? (
                    <ProbabilityPanel frame={srcFrame} />
                  ) : (
                    <p className="text-sm text-muted">No posterior yet.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cts.channels.slice(0, 6).map((c) => (
                      <Badge key={c.name}>
                        {c.name} {Number.isFinite(c.corrGr) ? `r ${c.corrGr.toFixed(2)}` : ""}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Received on {hit?.wellId ?? targetId}</CardTitle>
                  <Caption id="neighbors">
                    Transported posterior · tension {hit ? hit.tension.toFixed(2) : "—"}
                  </Caption>
                </CardHeader>
                <CardContent>
                  {hit ? (
                    <ProbabilityPanel frame={hit.frame} />
                  ) : (
                    <p className="text-sm text-muted">Run the pad so neighbors have results.</p>
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
                              {h.frame.mode.toFixed(1)} · wt {h.weight.toFixed(2)}
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
                <CardTitle>Pad</CardTitle>
                <Caption id="pad">Click a well to set it as source.</Caption>
              </CardHeader>
              <CardContent className="p-0">
                <PadCycle sheaf={padSheaf} active={active} onSelect={setWell} />
              </CardContent>
            </Card>
          </>
        ) : (
          <p className="text-sm text-muted">{running ? "Transferring…" : "Run a well first."}</p>
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
