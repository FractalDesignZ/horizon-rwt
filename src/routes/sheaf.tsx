import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { HorizonStrip } from "@/components/horizon-strip";
import { SmithDisk } from "@/components/smith-disk";
import { PlayBar } from "@/components/play-bar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/sheaf")({ component: SheafPage });

function SheafPage() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const setWell = useHorizon((s) => s.setWell);
  const results = useHorizon((s) => s.results);
  const station = useHorizon((s) => s.station);
  const setStation = useHorizon((s) => s.setStation);
  const runWell = useHorizon((s) => s.runWell);
  const running = useHorizon((s) => s.running);
  const well = pad.wells.find((w) => w.id === active);
  const result = results[active];

  useEffect(() => {
    if (well && !results[well.id] && !running) runWell(well.id);
  }, [well, results, running, runWell]);

  const sheaf = result?.sheaf;
  const maxE = sheaf ? Math.max(...sheaf.eigenvalues.map(Math.abs), 1e-6) : 1;
  const cur = sheaf?.smithPath[Math.min(station, (sheaf.smithPath.length || 1) - 1)];
  const rec = sheaf?.recoverability[Math.min(station, (sheaf.recoverability.length || 1) - 1)];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">M7 · digital horizon</p>
            <h1 className="font-display text-4xl tracking-tight">Sheaf</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Restriction maps carry SO(2) torsion and GR-agreement stiffness. The Smith disk is
              the reflection analog of local GR/impedance mismatch — a horizon when |Γ| decouples
              and recoverability collapses.
            </p>
          </div>
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
        </div>

        {sheaf && result && well ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <Metric label="Holonomy" value={sheaf.holonomy.toFixed(3)} hint="open-curve twist" />
              <Metric label="Winding" value={sheaf.winding.toFixed(2)} hint="Δarg Γ / 2π" />
              <Metric label="Frustration" value={sheaf.frustration.toFixed(4)} hint="mean small λ" />
              <Metric label="Kernel" value={String(sheaf.kernelDim)} hint={`Nτ ${sheaf.nearKernel}`} />
              <Metric
                label="λ₂"
                value={
                  sheaf.algebraicConnectivity < 1e-3
                    ? sheaf.algebraicConnectivity.toExponential(2)
                    : sheaf.algebraicConnectivity.toFixed(4)
                }
                hint="algebraic connectivity"
              />
              <Metric
                label="κ(L)"
                value={sheaf.condition > 1e4 ? sheaf.condition.toExponential(1) : sheaf.condition.toFixed(1)}
                hint="condition number"
              />
              <Metric
                label="|Γ|"
                value={cur ? cur.mag.toFixed(3) : "—"}
                hint={cur ? `h ${cur.hyp.toFixed(2)}` : "—"}
              />
              <Metric
                label="Onset"
                value={
                  sheaf.horizonOnset != null
                    ? well.stations[sheaf.horizonOnset]!.md.toFixed(0)
                    : "none"
                }
                hint="first decoupled MD"
              />
            </div>

            <Card className="overflow-hidden p-0">
              <CardHeader className="p-5 pb-2">
                <CardTitle>Horizon along MD</CardTitle>
                <CardDescription>
                  |Γ| · hyperbolic radius h = 2 artanh|Γ| · recoverability · click to scrub
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <HorizonStrip well={well} result={result} station={station} onStation={setStation} />
              </CardContent>
            </Card>
            <PlayBar max={well.stations.length - 1} />

            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Smith chart</CardTitle>
                  <CardDescription>
                    Γ = (z−1)/(z+1) · dashed ring |Γ|=0.72 · click a point
                    {sheaf.horizonOnset != null
                      ? ` · onset MD ${well.stations[sheaf.horizonOnset]?.md.toFixed(0)}`
                      : " · no horizon on this run"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-3">
                  <SmithDisk sheaf={sheaf} index={station} onIndex={setStation} />
                  {cur && (
                    <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                      <dt className="text-muted">re / im</dt>
                      <dd className="text-right">
                        {cur.re.toFixed(3)} / {cur.im.toFixed(3)}
                      </dd>
                      <dt className="text-muted">arg</dt>
                      <dd className="text-right">{((cur.arg * 180) / Math.PI).toFixed(1)}°</dd>
                      <dt className="text-muted">A = 2/|1−Γ|²</dt>
                      <dd className="text-right">{cur.amp.toFixed(2)}</dd>
                      <dt className="text-muted">recoverability</dt>
                      <dd className="text-right">{rec != null ? rec.toFixed(3) : "—"}</dd>
                    </dl>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sheaf spectrum</CardTitle>
                  <CardDescription>Smallest eigenvalues of L = δ*δ · closing twist on last edge</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex h-40 items-end gap-2">
                    {sheaf.eigenvalues.map((v, i) => (
                      <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-sm bg-accent"
                          style={{
                            height: `${Math.max(6, (Math.abs(v) / maxE) * 100)}%`,
                            opacity: 0.35 + 0.65 * (1 - i / 10),
                          }}
                        />
                        <span className="font-mono text-[10px] text-subtle">λ{i}</span>
                      </div>
                    ))}
                  </div>
                  <dl className="mt-6 grid grid-cols-2 gap-2 font-mono text-xs">
                    <dt className="text-muted">mean κ</dt>
                    <dd className="text-right">{result.geometry.meanCurv.toFixed(5)}</dd>
                    <dt className="text-muted">|holonomy|</dt>
                    <dd className="text-right">{result.geometry.absCumTwist.toFixed(3)}</dd>
                    <dt className="text-muted">E_ref</dt>
                    <dd className="text-right">{result.geometry.meanERef.toFixed(4)}</dd>
                    <dt className="text-muted">tortuosity</dt>
                    <dd className="text-right">{result.geometry.tortuosity.toFixed(4)}</dd>
                    <dt className="text-muted">azimuth</dt>
                    <dd className="text-right">{result.geometry.azimuthDeg.toFixed(1)}°</dd>
                    <dt className="text-muted">dip</dt>
                    <dd className="text-right">{result.geometry.dipDeg.toFixed(2)}°</dd>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant={sheaf.horizonOnset != null ? "danger" : "ok"}>
                      {sheaf.horizonOnset != null ? "horizon" : "matched"}
                    </Badge>
                    <Badge>Nτ {sheaf.nearKernel}</Badge>
                    <Badge>wind {sheaf.winding.toFixed(2)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">{running ? "Computing sheaf…" : "Run a well from Predict."}</p>
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
