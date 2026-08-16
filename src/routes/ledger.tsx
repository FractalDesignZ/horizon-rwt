import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Caption, PageLead } from "@/components/caption";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { serveLabel } from "@/lib/plain";
import { listRuns } from "@/lib/runs";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/ledger")({ component: Ledger });

type RunRow = {
  id: string;
  name: string;
  well_id: string;
  source: string;
  metrics: string;
  created_at: string;
};

function Ledger() {
  const { user, isPending } = useCurrentUserState();
  const results = useHorizon((s) => s.results);
  const pad = useHorizon((s) => s.pad);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listRuns()
      .then(setRuns)
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load saved runs"));
  }, [user]);

  const live = pad.wells
    .map((w) => ({ w, r: results[w.id] }))
    .filter((x): x is { w: (typeof pad.wells)[0]; r: NonNullable<(typeof results)[string]> } => !!x.r);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <PageLead kicker="Runs" title="History" id="say">
            Residual ships only if it beats the baselines. This session is below. Saved rows
            stay with your account.
          </PageLead>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>This session</CardTitle>
            <Caption id="floor">Each well is scored on its own. Scores are not pooled.</Caption>
          </CardHeader>
          <CardContent>
            {live.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[0.08em] text-muted">
                    <tr>
                      <th className="pb-2 font-medium">Well</th>
                      <th className="pb-2 font-medium">Model</th>
                      <th className="pb-2 font-medium">Selected</th>
                      <th className="pb-2 font-medium">Baseline</th>
                      <th className="pb-2 font-medium">Alert MD</th>
                      <th className="pb-2 font-medium">RMSE</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {live.map(({ w, r }) => (
                      <tr key={w.id} className="border-t border-border">
                        <td className="py-2">{w.id}</td>
                        <td className="py-2 text-muted">{serveLabel(r.selectedName)}</td>
                        <td className="py-2">
                          <Badge variant={r.residual.useResidual ? "ok" : "warn"}>
                            {r.residual.useResidual ? "residual" : "baseline"}
                          </Badge>
                        </td>
                        <td className="py-2 text-muted">{r.residual.gate3.bestFloor.toFixed(2)}</td>
                        <td className="py-2">
                          {r.sheaf.horizonOnset != null ? (
                            <Badge variant="danger">
                              {w.stations[r.sheaf.horizonOnset]!.md.toFixed(0)}
                            </Badge>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-2 tabular-nums">
                          {r.toeRmse != null ? r.toeRmse.toFixed(2) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">Run the pad to fill this session.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved runs</CardTitle>
            <Caption id="say">
              {isPending ? "Checking sign-in…" : user ? "Your account" : "Sign in to keep runs"}
            </Caption>
          </CardHeader>
          <CardContent>
            {err && <p className="text-sm text-danger">{err}</p>}
            {user && runs.length === 0 && !err && (
              <p className="text-sm text-muted">No saved runs yet. Predict → Save run.</p>
            )}
            {runs.length > 0 && (
              <ul className="space-y-3">
                {runs.map((run) => {
                  let metrics: Record<string, unknown> = {};
                  try {
                    metrics = JSON.parse(run.metrics) as Record<string, unknown>;
                  } catch {
                    /* ignore */
                  }
                  return (
                    <li key={run.id} className="rounded-md border border-border px-3 py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-mono text-sm">{run.well_id}</span>
                        <span className="text-xs text-subtle">{run.created_at}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted">{run.name}</p>
                      <p className="mt-1 font-mono text-xs text-subtle">
                        RMSE {String(metrics.toeRmse ?? "—")} · {run.source}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
