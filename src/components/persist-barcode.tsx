import type { PersistReport } from "@/lib/rwt/types";

export function PersistBarcode({ report }: { report: PersistReport }) {
  const finite = report.bars.filter((b) => Number.isFinite(b.death));
  const maxD = Math.max(0.01, ...finite.map((b) => b.death), report.mergeScale ?? 0);
  const rows = [...report.bars].sort((a, b) => a.dim - b.dim || a.death - b.death);
  const H = Math.max(120, 16 + rows.length * 14);
  const left = 52;
  const inner = 504;

  return (
    <svg viewBox={`0 0 580 ${H}`} className="h-auto w-full" role="img" aria-label="Persistence barcode">
      <rect width={580} height={H} fill="#0b0c0a" />
      {rows.map((b, i) => {
        const y = 12 + i * 14;
        const x0 = left + (b.birth / maxD) * inner;
        const death = Number.isFinite(b.death) ? b.death : maxD * 1.02;
        const x1 = left + (death / maxD) * inner;
        return (
          <g key={`${b.dim}-${i}`}>
            <text x={4} y={y + 4} fill="#5c594e" fontSize={9} fontFamily="IBM Plex Mono, monospace">
              {b.dim === 0 ? "β₀" : "β₁"}
            </text>
            <line
              x1={x0}
              x2={Math.max(x0 + 2, x1)}
              y1={y}
              y2={y}
              stroke={b.dim === 0 ? "#8a8678" : "#d8d2c4"}
              strokeWidth={3}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}