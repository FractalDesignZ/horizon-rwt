import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { ChannelRaster } from "@/components/channel-raster";
import { PlayBar } from "@/components/play-bar";
import { ProbabilityPanel } from "@/components/probability-panel";
import { TypewellBook } from "@/components/typewell-book";
import { WellTracks } from "@/components/well-tracks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/well/$id")({ component: WellPage });

function WellPage() {
  const { id } = Route.useParams();
  const pad = useHorizon((s) => s.pad);
  const results = useHorizon((s) => s.results);
  const station = useHorizon((s) => s.station);
  const setWell = useHorizon((s) => s.setWell);
  const setStation = useHorizon((s) => s.setStation);
  const runWell = useHorizon((s) => s.runWell);
  const running = useHorizon((s) => s.running);

  useEffect(() => {
    setWell(id);
    if (!results[id] && !running) runWell(id);
  }, [id, results, running, runWell, setWell]);

  const well = pad.wells.find((w) => w.id === id);
  const result = results[id];
  if (!well) {
    return (
      <AppShell>
        <p className="text-muted">Well {id} is not on the pad.</p>
      </AppShell>
    );
  }

  const s = well.stations[Math.min(station, well.stations.length - 1)]!;
  const extras = Object.keys(s.extra);
  const frame = result?.probability[station];
  const onset = result?.sheaf.horizonOnset;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{well.sourceFormat}</p>
            <h1 className="font-display text-4xl tracking-tight">{well.name}</h1>
            <p className="mt-1 font-mono text-sm text-muted">
              MD {s.md.toFixed(1)} · Z {s.z.toFixed(1)} · {s.isPredict ? "toe" : "heel"}
              {onset != null ? ` · horizon ${well.stations[onset]!.md.toFixed(0)}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => runWell(id)} disabled={running}>
              {running ? "Running…" : "Recompute"}
            </Button>
            <Link to="/predict" className="inline-flex h-10 items-center rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg no-underline">
              Predict
            </Link>
          </div>
        </div>

        <Card className="overflow-hidden p-0">
          <WellTracks well={well} result={result} station={station} onStation={setStation} />
        </Card>
        <PlayBar max={well.stations.length - 1} />
        <Card className="overflow-hidden p-0">
          <CardHeader className="p-5 pb-2">
            <CardTitle>Channels</CardTitle>
            <CardDescription>Same MD index · GR plus extra logs</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ChannelRaster
              well={well}
              names={["GR", ...extras]}
              station={station}
              onStation={setStation}
            />
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Labeled values</CardTitle>
              <CardDescription>Station stalks · extra channels ride the same index</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-sm">
                <Row k="MD" v={s.md.toFixed(2)} />
                <Row k="X" v={s.x.toFixed(1)} />
                <Row k="Y" v={s.y.toFixed(1)} />
                <Row k="Z" v={s.z.toFixed(1)} />
                <Row k="GR" v={Number.isFinite(s.gr) ? s.gr.toFixed(2) : "—"} />
                <Row k="TVT in" v={s.tvtInput != null ? s.tvtInput.toFixed(2) : "—"} />
                <Row k="TVT hat" v={result ? result.selected[station]!.toFixed(2) : "—"} />
                <Row k="TVT true" v={s.tvtTrue != null ? s.tvtTrue.toFixed(2) : "hidden"} />
                {result?.sheaf.smithPath[station] && (
                  <Row k="|Γ|" v={result.sheaf.smithPath[station]!.mag.toFixed(3)} />
                )}
                {extras.map((k) => (
                  <Row key={k} k={k} v={Number.isFinite(s.extra[k]!) ? s.extra[k]!.toFixed(3) : "—"} />
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{s.isPredict ? "predict" : "known"}</Badge>
                {result && (
                  <Badge variant={result.residual.fire[station] ? "ok" : "default"}>
                    {result.residual.fire[station] ? "residual fire" : "prior only"}
                  </Badge>
                )}
                {result?.probability[station]?.horizon && <Badge variant="danger">horizon</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Encoded probability</CardTitle>
              <CardDescription>Particle / residual posterior over TVT bins</CardDescription>
            </CardHeader>
            <CardContent>
              {frame ? (
                <ProbabilityPanel frame={frame} />
              ) : (
                <p className="text-sm text-muted">Run the well to encode outcome mass.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <CardHeader className="p-5 pb-2">
            <CardTitle>GR@TVT book</CardTitle>
            <CardDescription>
              Typewell curve · heel in green · toe in paper · ring is the current station
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TypewellBook well={well} result={result} station={station} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className="text-right tabular-nums text-fg">{v}</dd>
    </>
  );
}
