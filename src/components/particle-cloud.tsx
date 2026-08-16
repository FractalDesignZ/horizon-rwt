import type { PipelineResult } from "@/lib/rwt/types";

export function ParticleCloud({
  result,
  station,
}: {
  result: PipelineResult;
  station: number;
}) {
  const cloud = result.priors.particlesAt[station] ?? [];
  const last = result.priors.lastKnown;
  const lo = last - 20;
  const hi = last + 20;
  const bins = 24;
  const counts = Array(bins).fill(0) as number[];
  for (const p of cloud) {
    const u = (p - lo) / Math.max(hi - lo, 1e-6);
    const i = Math.max(0, Math.min(bins - 1, Math.floor(u * bins)));
    counts[i]! += 1;
  }
  const max = Math.max(...counts, 1);
  const hat = result.selected[station];

  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted">The cloud</p>
        <p className="font-mono text-xs tabular-nums text-subtle">{cloud.length} guesses</p>
      </div>
      <div className="flex h-24 items-end gap-px">
        {counts.map((c, i) => {
          const mid = lo + ((i + 0.5) / bins) * (hi - lo);
          const near = hat != null && Math.abs(mid - hat) < (hi - lo) / bins;
          return (
            <div
              key={i}
              className="min-w-0 flex-1 rounded-sm"
              style={{
                height: `${Math.max(3, (c / max) * 100)}%`,
                background: near ? "#d8d2c4" : "#5c594e",
                opacity: 0.4 + 0.6 * (c / max),
              }}
              title={`${mid.toFixed(1)} · ${c}`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-subtle">
        <span>{lo.toFixed(0)}</span>
        <span>{hi.toFixed(0)}</span>
      </div>
    </div>
  );
}
