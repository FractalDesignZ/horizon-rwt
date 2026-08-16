import type { BookMarker, FenceTrack } from "@/lib/rwt/fence";
import { bedLabel } from "@/lib/plain";

function rangeOf(vals: number[]) {
  const f = vals.filter(Number.isFinite);
  if (!f.length) return { min: 0, max: 1 };
  return { min: Math.min(...f), max: Math.max(...f) };
}

export function FenceView({
  tracks,
  markers,
  hang,
  active,
  onSelect,
}: {
  tracks: FenceTrack[];
  markers: BookMarker[];
  hang: "tvt" | "md";
  active?: string;
  onSelect?: (id: string) => void;
}) {
  const W = 760;
  const H = 420;
  const n = Math.max(tracks.length, 1);
  const padL = n === 1 ? 92 : 56;
  const padR = 20;
  const padT = 20;
  const padB = 36;
  const col = (W - padL - padR) / n;
  const grs = tracks.flatMap((t) => t.points.map((p) => p.gr).filter(Number.isFinite));
  const gMid = (Math.min(...grs) + Math.max(...grs)) / 2;
  const gSpan = Math.max(Math.max(...grs) - Math.min(...grs), 20);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Fence diagram">
      <rect width={W} height={H} fill="#0b0c0a" />
      {tracks.map((t, wi) => {
        const cx = padL + col * (wi + 0.5);
        const on = t.wellId === active;
        const axis = rangeOf(t.points.map((p) => (hang === "tvt" ? p.tvt : p.md)));
        const sy = (v: number) =>
          padT + ((v - axis.min) / Math.max(axis.max - axis.min, 1)) * (H - padT - padB);
        const spine = t.points
          .filter((p) => Number.isFinite(hang === "tvt" ? p.tvt : p.md) && Number.isFinite(p.gr))
          .map((p, i) => {
            const y = sy(hang === "tvt" ? p.tvt : p.md);
            const x = cx + ((p.gr - gMid) / gSpan) * (col * 0.38);
            return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(" ");
        return (
          <g key={t.wellId} className="cursor-pointer" onClick={() => onSelect?.(t.wellId)}>
            {on &&
              hang === "tvt" &&
              markers.map((mk) => {
                if (mk.tvt < axis.min || mk.tvt > axis.max) return null;
                const y = sy(mk.tvt);
                return (
                  <g key={mk.id}>
                    <line
                      x1={n === 1 ? padL : cx - col * 0.46}
                      x2={n === 1 ? W - padR : cx + col * 0.46}
                      y1={y}
                      y2={y}
                      stroke="#26261f"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={8}
                      y={y + 3}
                      fill="#8a8678"
                      fontSize={9}
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      {bedLabel(mk.name)}
                    </text>
                  </g>
                );
              })}
            <line x1={cx} x2={cx} y1={padT} y2={H - padB} stroke="#26261f" />
            <path d={spine} fill="none" stroke={on ? "#d8d2c4" : "#8a8678"} strokeWidth={on ? 1.7 : 1.1} />
            {t.points
              .filter((p) => p.horizon)
              .map((p) => (
                <circle
                  key={p.i}
                  cx={cx}
                  cy={sy(hang === "tvt" ? p.tvt : p.md)}
                  r={2.2}
                  fill="#b45a4a"
                />
              ))}
            {on &&
              t.hits.map((h) => (
                <circle
                  key={h.markerId}
                  cx={cx}
                  cy={sy(hang === "tvt" ? h.tvt : t.points[h.i]!.md)}
                  r={3}
                  fill="none"
                  stroke="#c4a35a"
                />
              ))}
            <text
              x={cx}
              y={H - 12}
              textAnchor="middle"
              fill={on ? "#ebe6d8" : "#8a8678"}
              fontSize={10}
              fontFamily="IBM Plex Mono, monospace"
            >
              {t.wellId}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
