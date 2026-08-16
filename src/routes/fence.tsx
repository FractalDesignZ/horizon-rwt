import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyPad } from "@/components/empty-pad";
import { FenceView } from "@/components/fence-view";
import { Caption, PageLead } from "@/components/caption";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { briefHtml } from "@/lib/rwt/brief-html";
import { buildFence, padBrief, pickMarkers } from "@/lib/rwt/fence";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/fence")({ component: FencePage });

function FencePage() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const setWell = useHorizon((s) => s.setWell);
  const results = useHorizon((s) => s.results);
  const runPad = useHorizon((s) => s.runPad);
  const running = useHorizon((s) => s.running);
  const [hang, setHang] = useState<"tvt" | "md">("tvt");

  useEffect(() => {
    if (!running && pad.wells.some((w) => !results[w.id])) runPad();
  }, [pad.wells, results, running, runPad]);

  const well = pad.wells.find((w) => w.id === active) ?? pad.wells[0];
  const book = well?.typewell ?? pad.typewell;
  const areaWells = pad.wells.filter((w) => !well?.area || !w.area || w.area === well.area);
  const markers = useMemo(() => pickMarkers(book, 8), [book]);
  const tracks = useMemo(
    () => buildFence(well ? [well] : [], results, markers),
    [well, results, markers],
  );
  const brief = useMemo(() => padBrief(pad.wells, results), [pad.wells, results]);
  const cuts = brief.filter((b) => b.advisory === "CUT").length;
  const withMiss = brief.filter((b) => b.rmse != null);
  const miss =
    withMiss.length > 0
      ? withMiss.reduce((s, b) => s + (b.rmse ?? 0), 0) / withMiss.length
      : null;

  if (!pad.wells.length) return <EmptyPad title="Fence needs a well" />;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <PageLead kicker="Cross-section" title="Fence" id="fence">
              One well at a time, hung on its own type well. Markers are beds. Red is lost lock.
            </PageLead>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={hang === "tvt" ? "default" : "secondary"} onClick={() => setHang("tvt")}>
              Align TVT
            </Button>
            <Button size="sm" variant={hang === "md" ? "default" : "secondary"} onClick={() => setHang("md")}>
              Align MD
            </Button>
            <Button variant="secondary" onClick={runPad} disabled={running}>
              {running ? "Running…" : "Run pad"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const blob = new Blob([briefHtml(pad, brief, markers)], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${pad.id}-report.html`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export report
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Markers" value={String(markers.length)} hint="beds on this type well" />
          <Metric label="CUT" value={`${cuts}/${brief.length}`} hint="lost lock at bit" />
          <Metric label="Pad RMSE" value={miss != null ? miss.toFixed(2) : "—"} hint="mean labeled toe" />
          <Metric
            label="Aligned"
            value={`${tracks.filter((t) => t.points.some((p) => Number.isFinite(p.tvt))).length}`}
            hint="wells with a pick"
          />
        </div>

        <Card className="overflow-hidden p-0">
          <CardHeader className="p-5 pb-2">
            <CardTitle>{well?.name ?? active} · {hang === "tvt" ? "TVT" : "MD"}</CardTitle>
            <Caption id="fence">GR versus the type well. Switch wells below.</Caption>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-wrap gap-1 px-5 pb-3">
              {areaWells.map((w) => (
                <Button
                  key={w.id}
                  size="sm"
                  variant={w.id === active ? "default" : "secondary"}
                  onClick={() => setWell(w.id)}
                >
                  {w.name}
                </Button>
              ))}
            </div>
            <FenceView tracks={tracks} markers={markers} hang={hang} active={active} onSelect={setWell} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pad report</CardTitle>
            <Caption id="call">Advisory at the bit · score · alert MD</Caption>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="pb-2 font-medium">Well</th>
                  <th className="pb-2 font-medium">Advisory</th>
                  <th className="pb-2 font-medium">RMSE</th>
                  <th className="pb-2 font-medium">Last known</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium">Alert MD</th>
                  <th className="pb-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {brief.map((b) => (
                  <tr
                    key={b.wellId}
                    className={`border-t border-border ${b.wellId === active ? "bg-elevated/60" : ""}`}
                  >
                    <td className="py-2">
                      <button type="button" className="font-mono" onClick={() => setWell(b.wellId)}>
                        {b.wellId}
                      </button>
                    </td>
                    <td className="py-2">
                      <Badge variant={b.advisory === "CUT" ? "danger" : b.advisory === "HOLD" ? "ok" : "warn"}>
                        {b.advisory}
                      </Badge>
                    </td>
                    <td className="py-2 font-mono tabular-nums">
                      {b.rmse != null ? b.rmse.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 font-mono tabular-nums">
                      {Number.isFinite(b.last) ? b.last.toFixed(1) : "—"}
                    </td>
                    <td className="py-2 font-mono tabular-nums">{(b.keyFit * 100).toFixed(0)}</td>
                    <td className="py-2 font-mono tabular-nums">
                      {b.horizonMd != null ? b.horizonMd.toFixed(0) : "—"}
                    </td>
                    <td className="max-w-[220px] truncate py-2 text-xs text-muted">{b.reason}</td>
                  </tr>
                ))}
                {!brief.length && (
                  <tr>
                    <td colSpan={7} className="py-4 text-sm text-muted">
                      Run the pad to fill the report.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Link to="/steer" className="mt-4 inline-block text-sm text-muted no-underline hover:text-fg">
              Open steer for {active}
            </Link>
          </CardContent>
        </Card>
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
