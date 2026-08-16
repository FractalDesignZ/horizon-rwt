import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
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
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load ledger"));
  }, [user]);

  const live = pad.wells
    .map((w) => ({ w, r: results[w.id] }))
    .filter((x): x is { w: (typeof pad.wells)[0]; r: NonNullable<(typeof results)[string]> } => !!x.r);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">M6 CERTIFY</p>
          <h1 className="font-display text-4xl tracking-tight">Ledger</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Public clamp law: residual ships only if it beats the best pure floor and last-known.
            Session results below; sealed rows persist to your account.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Session certificate</CardTitle>
            <CardDescription>This preview · GroupKFold unit = well</CardDescription>
          </CardHeader>
          <CardContent>
            {live.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[0.08em] text-muted">
                    <tr>
                      <th className="pb-2 font-medium">Well</th>
                      <th className="pb-2 font-medium">Serve</th>
                      <th className="pb-2 font-medium">Gate3</th>
                      <th className="pb-2 font-medium">Floor</th>
                      <th className="pb-2 font-medium">Horizon</th>
                      <th className="pb-2 font-medium">Toe RMSE</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {live.map(({ w, r }) => (
                      <tr key={w.id} className="border-t border-border">
                        <td className="py-2">{w.id}</td>
                        <td className="py-2 text-muted">{r.selectedName}</td>
                        <td className="py-2">
                          <Badge variant={r.residual.useResidual ? "ok" : "warn"}>
                            {r.residual.useResidual ? "ACCEPT" : "REJECT"}
                          </Badge>
                        </td>
                        <td className="py-2 text-muted">{r.residual.gate3.bestFloor.toFixed(2)}</td>
                        <td className="py-2">
                          {r.sheaf.horizonOnset != null ? (
                            <Badge variant="danger">
                              MD {w.stations[r.sheaf.horizonOnset]!.md.toFixed(0)}
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
              <p className="text-sm text-muted">Run the pad from Wellscape to fill the session ledger.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sealed runs</CardTitle>
            <CardDescription>
              {isPending ? "Resolving session…" : user ? "Your account" : "Sign in to persist certificates"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {err && <p className="text-sm text-danger">{err}</p>}
            {user && runs.length === 0 && !err && (
              <p className="text-sm text-muted">No sealed runs yet. Predict → Seal run.</p>
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
