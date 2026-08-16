import type { CellKind, EvolveReport, WorldFrame } from "@/lib/rwt/evolve";
import { ACTIONS } from "@/lib/rwt/evolve";
import type { SteerCall } from "@/lib/rwt/types";

const CELL_FILL: Record<CellKind, string> = {
  empty: "#131411",
  zone: "#2a4a52",
  threat: "#b45a4a",
  bit: "#d8d2c4",
  labeled: "#6b8f71",
};

export function WorldGrid({ world, title }: { world: WorldFrame; title?: string }) {
  const R = world.grid.length;
  const C = world.grid[0]?.length ?? 0;
  const cell = 18;
  const W = C * cell + 2;
  const H = R * cell + 2;
  return (
    <div>
      {title && <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted">{title}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-sm" role="img" aria-label="World grid">
        <rect width={W} height={H} fill="#0b0c0a" />
        {world.kinds.map((row, r) =>
          row.map((k, c) => (
            <rect
              key={`${r}-${c}`}
              x={1 + c * cell}
              y={1 + (R - 1 - r) * cell}
              width={cell - 1}
              height={cell - 1}
              fill={CELL_FILL[k]}
            />
          )),
        )}
      </svg>
      <ul className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 bg-track" /> zone
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 bg-danger" /> threat
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 bg-ok" /> labeled
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 bg-accent" /> bit
        </li>
      </ul>
    </div>
  );
}

export function ActionBars({
  scores,
  action,
  rule,
}: {
  scores: number[];
  action: SteerCall;
  rule: SteerCall;
}) {
  return (
    <ul className="space-y-2">
      {ACTIONS.map((name, i) => {
        const v = scores[i] ?? 0;
        const on = name === action;
        return (
          <li key={name}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className={on ? "text-fg" : "text-muted"}>{name}</span>
              <span className="font-mono tabular-nums text-subtle">{(v * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-elevated">
              <div
                className={`h-full ${on ? "bg-accent" : "bg-subtle"}`}
                style={{ width: `${Math.max(2, v * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
      <li className="pt-1 text-xs text-subtle">Rule call {rule}</li>
    </ul>
  );
}

export function FitnessChart({ report }: { report: EvolveReport }) {
  const hist = report.history;
  if (!hist.length) return null;
  const W = 420;
  const H = 140;
  const pad = 16;
  const xs = hist.map((h) => h.gen);
  const ys = hist.flatMap((h) => [h.best, h.mean, h.holdout]);
  const minX = 0;
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX)) * (W - pad * 2);
  const sy = (y: number) => H - pad - ((y - minY) / Math.max(maxY - minY, 1e-6)) * (H - pad * 2);
  const path = (key: "best" | "mean" | "holdout") =>
    hist
      .map((h, i) => `${i === 0 ? "M" : "L"} ${sx(h.gen).toFixed(1)} ${sy(h[key]).toFixed(1)}`)
      .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Fitness by generation">
      <rect width={W} height={H} fill="#0b0c0a" />
      <path d={path("mean")} fill="none" stroke="#5c594e" strokeWidth={1.2} />
      <path d={path("holdout")} fill="none" stroke="#c4a35a" strokeWidth={1.4} />
      <path d={path("best")} fill="none" stroke="#d8d2c4" strokeWidth={1.6} />
    </svg>
  );
}
