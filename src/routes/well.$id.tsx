import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyPad } from "@/components/empty-pad";
import { ChannelRaster } from "@/components/channel-raster";
import { Caption, PageLead } from "@/components/caption";
import { PlayBar } from "@/components/play-bar";
import { ProbabilityPanel } from "@/components/probability-panel";
import { TypewellBook } from "@/components/typewell-book";
import { WellTracks } from "@/components/well-tracks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { channelLabel } from "@/lib/plain";
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
    return <EmptyPad title="Well not loaded" />;
  }

  const s = well.stations[Math.min(station, well.stations.length - 1)]!;
  const extras = Object.keys(s.extra);
  const frame = result?.probability[station];
  const onset = result?.sheaf.horizonOnset;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <PageLead kicker={well.sourceFormat} title={well.name} id="pad">
              MD {s.md.toFixed(1)} · {s.isPredict ? "unlabeled" : "labeled"}
              {onset != null ? ` · alert at ${well.stations[onset]!.md.toFixed(0)}` : ""}
            </PageLead>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => runWell(id)} disabled={running}>
              {running ? "Running…" : "Run again"}
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
            <Caption id="gamma">Same MD. GR plus extras.</Caption>
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
              <CardTitle>Station</CardTitle>
              <Caption id="bed">Values at this MD.</Caption>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-sm">
                <Row k="MD" v={s.md.toFixed(2)} />
                <Row k="X" v={s.x.toFixed(1)} />
                <Row k="Y" v={s.y.toFixed(1)} />
                <Row k="TVD" v={s.z.toFixed(1)} />
                <Row k="GR" v={Number.isFinite(s.gr) ? s.gr.toFixed(2) : "—"} />
                <Row k="TVT in" v={s.tvtInput != null ? s.tvtInput.toFixed(2) : "—"} />
                <Row k="selected" v={result ? result.selected[station]!.toFixed(2) : "—"} />
                <Row k="truth" v={s.tvtTrue != null ? s.tvtTrue.toFixed(2) : "hidden"} />
                {result?.sheaf.smithPath[station] && (
                  <Row k="|Γ|" v={result.sheaf.smithPath[station]!.mag.toFixed(3)} />
                )}
                {extras.map((k) => (
                  <Row key={k} k={channelLabel(k)} v={Number.isFinite(s.extra[k]!) ? s.extra[k]!.toFixed(3) : "—"} />
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{s.isPredict ? "unlabeled" : "labeled"}</Badge>
                {result && (
                  <Badge variant={result.residual.fire[station] ? "ok" : "default"}>
                    {result.residual.fire[station] ? "residual" : "last known"}
                  </Badge>
                )}
                {result?.probability[station]?.horizon && <Badge variant="danger">alert</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Confidence</CardTitle>
              <Caption id="match">Posterior over TVT. Tight pile = high confidence.</Caption>
            </CardHeader>
            <CardContent>
              {frame ? (
                <ProbabilityPanel frame={frame} />
              ) : (
                <p className="text-sm text-muted">Run the well to see the posterior.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <CardHeader className="p-5 pb-2">
            <CardTitle>Type well</CardTitle>
            <Caption id="book">
              GR vs TVT. Heel in green. Toe in paper. Ring is this station.
            </Caption>
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
