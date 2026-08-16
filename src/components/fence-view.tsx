import type { BookMarker, FenceTrack } from "@/lib/rwt/fence";

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
  const padL = 48;
  const padR = 20;
  const padT = 20;
  const padB = 32;
  const vals = tracks.flatMap((t) => t.points.map((p) => (hang === "tvt" ? p.tvt : p.md)).filter(Number.isFinite));
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const n = Math.max(tracks.length, 1);
  const col = (W - padL - padR) / n;
  const sy = (v: number) => padT + ((v - minV) / Math.max(maxV - minV, 1)) * (H - padT - padB);
  const grs = tracks.flatMap((t) => t.points.map((p) => p.gr).filter(Number.isFinite));
  const gMid = (Math.min(...grs) + Math.max(...grs)) / 2;
  const gSpan = Math.max(Math.max(...grs) - Math.min(...grs), 20);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Fence diagram">
      <rect width={W} height={H} fill="#0b0c0a" />
      {markers.map((mk) => {
        const y = hang === "tvt" ? sy(mk.tvt) : null;
        if (y == null) return null;
        return (
          <g key={mk.id}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#26261f" strokeDasharray="4 3" />
            <text x={6} y={y + 3} fill="#5c594e" fontSize={9} fontFamily="IBM Plex Mono, monospace">
              {mk.name}
            </text>
          </g>
        );
      })}
      {tracks.map((t, wi) => {
        const cx = padL + col * (wi + 0.5);
        const on = t.wellId === active;
        const spine = t.points
          .filter((p) => Number.isFinite(hang === "tvt" ? p.tvt : p.md) && Number.isFinite(p.gr))
          .map((p, i) => {
            const y = sy(hang === "tvt" ? p.tvt : p.md);
            const x = cx + ((p.gr - gMid) / gSpan) * (col * 0.42);
            return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
          })
          .join(" ");
        return (
          <g key={t.wellId} className="cursor-pointer" onClick={() => onSelect?.(t.wellId)}>
            <line x1={cx} x2={cx} y1={padT} y2={H - padB} stroke="#26261f" />
            <path d={spine} fill="none" stroke={on ? "#d8d2c4" : "#8a8678"} strokeWidth={on ? 1.6 : 1} />
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
            {t.hits.map((h) => (
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
              y={H - 10}
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