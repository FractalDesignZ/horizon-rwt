import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptyPad } from "@/components/empty-pad";
import { Caption, PageLead } from "@/components/caption";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { certLabel, statusLabel } from "@/lib/plain";
import { compileAudit, TIME_COPY, type EvidenceClass, type TimeKind } from "@/lib/rwt/audit";
import { useHorizon } from "@/lib/store";

export const Route = createFileRoute("/studio")({ component: StudioPage });

const KLASS_HINT: Record<EvidenceClass, string> = {
  identity: "definition",
  certificate: "check",
  empirical: "measurement",
  speculative: "excluded",
};

function StudioPage() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const setWell = useHorizon((s) => s.setWell);
  const results = useHorizon((s) => s.results);
  const runPad = useHorizon((s) => s.runPad);
  const running = useHorizon((s) => s.running);
  const [time, setTime] = useState<TimeKind>("physical");
  const [klassFilter, setKlassFilter] = useState<EvidenceClass | "all">("all");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!running && pad.wells.some((w) => !results[w.id])) runPad();
  }, [pad.wells, results, running, runPad]);

  const audit = useMemo(() => compileAudit(pad, results, active), [pad, results, active]);
  const shown =
    klassFilter === "all" ? audit.claims : audit.claims.filter((c) => c.klass === klassFilter);
  const certPass = audit.certificates.filter((c) => c.pass).length;

  if (!ready) {
    return (
      <AppShell>
        <p className="text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }

  if (!pad.wells.length) return <EmptyPad title="Audit needs a well" />;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <PageLead kicker="Claim ledger" title="Audit" id="say">
              Every line is a definition, a check, a measurement, or something we refuse to
              claim. Neighbor links are not a pad-wide field until cycles close.
            </PageLead>
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
            <Button variant="secondary" onClick={runPad} disabled={running}>
              {running ? "Running…" : "Run pad"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const blob = new Blob([JSON.stringify(audit, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${pad.id}-${active}-audit.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export JSON
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Scope"
            value={audit.gate.kind === "sheaf" ? "Pad field" : "Pairwise"}
            hint={audit.gate.reason}
          />
          <Metric
            label="Checks"
            value={`${certPass}/${audit.certificates.length}`}
            hint={`checksum ${audit.hash}`}
          />
          <Metric
            label="Shuffle p"
            value={audit.nulls[0] ? audit.nulls[0].pExact.toFixed(3) : "—"}
            hint={audit.nulls[0]?.name ?? ""}
          />
          <Metric
            label="Excluded"
            value={String(audit.claims.filter((c) => c.status === "excluded").length)}
            hint="refused claims"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Axis type</CardTitle>
            <Caption id="slider">A slider is not a clock unless it says so.</Caption>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TIME_COPY) as TimeKind[]).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={time === k ? "default" : "secondary"}
                  onClick={() => setTime(k)}
                >
                  {TIME_COPY[k].title}
                </Button>
              ))}
            </div>
            <p className="mt-3 max-w-2xl text-sm text-muted">{TIME_COPY[time].body}</p>
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Claims</CardTitle>
                  <Caption id="say">Definitions · checks · measurements</Caption>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(["all", "identity", "certificate", "empirical", "speculative"] as const).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant={klassFilter === k ? "default" : "secondary"}
                      onClick={() => setKlassFilter(k)}
                    >
                      {k === "all"
                        ? "all"
                        : k === "identity"
                          ? "definition"
                          : k === "certificate"
                            ? "check"
                            : k === "empirical"
                              ? "measurement"
                              : "excluded"}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {shown.map((c) => (
                <div key={c.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        c.status === "fail"
                          ? "danger"
                          : c.status === "excluded"
                            ? "warn"
                            : c.status === "pass"
                              ? "ok"
                              : "default"
                      }
                    >
                      {statusLabel(c.status)}
                    </Badge>
                    <span className="text-[11px] uppercase tracking-[0.12em] text-subtle">
                      {KLASS_HINT[c.klass]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{c.statement}</p>
                  <p className="mt-1 font-mono text-xs text-muted">{c.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Scope gate</CardTitle>
                <Caption id="neighbors">Cycles must close before we speak for the pad.</Caption>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  Closed loops <span className="font-mono">{audit.gate.triangles}</span>
                </p>
                <p>
                  Cycle residual{" "}
                  <span className="font-mono">{audit.gate.maxCycleResidual.toFixed(3)}</span>
                </p>
                <p className="text-muted">{audit.gate.reason}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="rounded-sm bg-elevated px-2 py-1 font-mono text-xs">input</span>
                  <span className="text-subtle">→</span>
                  <span className="rounded-sm bg-elevated px-2 py-1 font-mono text-xs">edges</span>
                  <span className="text-subtle">→</span>
                  <span
                    className={`rounded-sm px-2 py-1 font-mono text-xs ${audit.gate.compatible ? "bg-ok text-accent-fg" : "bg-elevated text-muted"}`}
                  >
                    {audit.gate.compatible ? "pad field" : "pairwise"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Certificates</CardTitle>
                <Caption id="say">Green only when the check passed.</Caption>
              </CardHeader>
              <CardContent className="space-y-2">
                {audit.certificates.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-xs">{certLabel(c.id)}</span>
                    <span className={c.pass ? "text-ok" : "text-danger"}>{c.pass ? "pass" : "fail"}</span>
                    <span className="flex-1 text-right text-xs text-muted">{c.note}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {audit.nulls.map((n) => (
              <Card key={n.name}>
                <CardHeader>
                  <CardTitle>Null test</CardTitle>
                  <Caption id="say">{n.name}</Caption>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>
                    How often a shuffle is at least as extreme:{" "}
                    <span className="font-mono">{n.pExact.toFixed(3)}</span>
                  </p>
                  <p className="font-mono text-xs text-muted">
                    observed {n.observed.toFixed(3)} · null {n.nullMean.toFixed(3)} · {n.B} shuffles
                  </p>
                  <p className="text-muted">{n.justification}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}
