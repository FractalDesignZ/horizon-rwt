import type { PadSheaf } from "@/lib/rwt/types";

export function PadCycle({
  sheaf,
  active,
  onSelect,
}: {
  sheaf: PadSheaf;
  active?: string;
  onSelect?: (id: string) => void;
}) {
  const xs = sheaf.nodes.map((n) => n.x);
  const ys = sheaf.nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const W = 640;
  const H = 340;
  const pad = 36;
  const sx = (x: number) => pad + ((x - minX) / Math.max(maxX - minX, 1)) * (W - pad * 2);
  const sy = (y: number) => H - pad - ((y - minY) / Math.max(maxY - minY, 1)) * (H - pad * 2);
  const byId = Object.fromEntries(sheaf.nodes.map((n) => [n.id, n]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="How the pad is linked">
      <rect width={W} height={H} fill="#0b0c0a" />
      {sheaf.edges.map((e) => {
        const a = byId[e.a];
        const b = byId[e.b];
        if (!a || !b) return null;
        return (
          <g key={`${e.a}-${e.b}`}>
            <line
              x1={sx(a.x)}
              y1={sy(a.y)}
              x2={sx(b.x)}
              y2={sy(b.y)}
              stroke={e.tension > 0.55 ? "#b45a4a" : "#5c594e"}
              strokeWidth={1.2 + e.stiffness * 2}
              opacity={0.85}
            />
          </g>
        );
      })}
      {sheaf.nodes.map((n) => {
        const on = n.id === active;
        return (
          <g key={n.id} className="cursor-pointer" onClick={() => onSelect?.(n.id)}>
            <circle
              cx={sx(n.x)}
              cy={sy(n.y)}
              r={on ? 8 : 6}
              fill={on ? "#d8d2c4" : "#1a1b17"}
              stroke={on ? "#ebe6d8" : "#8a8678"}
            />
            <text
              x={sx(n.x) + 10}
              y={sy(n.y) + 4}
              fill={on ? "#ebe6d8" : "#8a8678"}
              fontSize={11}
              fontFamily="IBM Plex Mono, monospace"
            >
              {n.id}
              {Number.isFinite(n.last) ? `  ${n.last.toFixed(0)}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}