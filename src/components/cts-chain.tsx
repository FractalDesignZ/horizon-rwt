import type { CtsReport } from "@/lib/rwt/types";

export function CtsChain({ cts }: { cts: CtsReport }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5">
      {cts.stages.map((s, i) => (
        <li key={s.id} className="relative rounded-xl border border-border bg-surface px-3 py-3">
          {i < cts.stages.length - 1 && (
            <span className="pointer-events-none absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-subtle sm:block">
              →
            </span>
          )}
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{s.id}</p>
          <p className="mt-1 font-display text-lg">{s.name}</p>
          <p className="mt-1 font-mono text-sm tabular-nums">{s.value}</p>
          <p className={`mt-1 text-xs ${s.ok ? "text-ok" : "text-warn"}`}>{s.note}</p>
        </li>
      ))}
    </ol>
  );
}