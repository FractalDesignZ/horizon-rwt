import type { ProbabilityFrame } from "@/lib/rwt/types";

export function ProbabilityPanel({ frame }: { frame: ProbabilityFrame }) {
  const max = Math.max(...frame.mass, 1e-6);
  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Mode TVT</p>
          <p className="font-mono text-2xl tabular-nums text-fg">{frame.mode.toFixed(2)}</p>
          <p className="text-xs text-muted">
            σ {frame.std.toFixed(2)} · H {frame.entropy.toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Alert risk</p>
          <p className="font-mono text-lg tabular-nums text-fg">
            {(frame.horizonScore * 100).toFixed(0)}
            <span className="text-sm text-muted"> /100</span>
          </p>
          <p className="text-xs text-muted">{frame.horizon ? "lost lock" : "locked"}</p>
        </div>
      </div>
      <div className="flex h-28 items-end gap-px">
        {frame.mass.map((m, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 rounded-sm"
            style={{
              height: `${Math.max(4, (m / max) * 100)}%`,
              background: frame.horizon ? "#b45a4a" : "#d8d2c4",
              opacity: 0.35 + 0.65 * (m / max),
            }}
            title={`${frame.bins[i]!.toFixed(1)} · ${(m * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-subtle">
        <span>{frame.bins[0]!.toFixed(0)}</span>
        <span>{frame.bins[frame.bins.length - 1]!.toFixed(0)}</span>
      </div>
    </div>
  );
}
