import { useHorizon } from "@/lib/store";

function strokeFor(rmse: number | null | undefined, on: boolean, horizon: boolean) {
  if (on) return "#d8d2c4";
  if (horizon) return "#b45a4a";
  if (rmse == null) return "#5c594e";
  if (rmse < 2) return "#6b8f71";
  if (rmse < 4) return "#8a8678";
  return "#c4a35a";
}

export function PadMap() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const setWell = useHorizon((s) => s.setWell);
  const results = useHorizon((s) => s.results);

  const pts = pad.wells.flatMap((w) => w.stations.map((s) => ({ x: s.x, y: s.y })));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const W = 640;
  const H = 360;
  const padX = 28;
  const padY = 24;
  const sx = (x: number) => padX + ((x - minX) / Math.max(maxX - minX, 1)) * (W - padX * 2);
  const sy = (y: number) => H - padY - ((y - minY) / Math.max(maxY - minY, 1)) * (H - padY * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Pad plan view">
      <rect width={W} height={H} fill="#0b0c0a" />
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={padX}
          x2={W - padX}
          y1={padY + ((H - padY * 2) * i) / 3}
          y2={padY + ((H - padY * 2) * i) / 3}
          stroke="#26261f"
          strokeWidth={1}
        />
      ))}
      {pad.wells.map((w) => {
        const d = w.stations
          .map((s, i) => `${i === 0 ? "M" : "L"} ${sx(s.x).toFixed(1)} ${sy(s.y).toFixed(1)}`)
          .join(" ");
        const on = w.id === active;
        const rmse = results[w.id]?.toeRmse;
        const last = w.stations[w.stations.length - 1]!;
        const heel = w.stations[0]!;
        const ps = w.stations.find((s) => s.isPredict) ?? last;
        const onset = results[w.id]?.sheaf.horizonOnset;
        return (
          <g key={w.id}>
            <path
              d={d}
              fill="none"
              stroke={strokeFor(rmse, on, onset != null)}
              strokeWidth={on ? 2.2 : 1.2}
            />
            <circle cx={sx(heel.x)} cy={sy(heel.y)} r={2.2} fill="#5c594e" />
            <circle cx={sx(ps.x)} cy={sy(ps.y)} r={2} fill="#2a4a52" />
            {onset != null && w.stations[onset] && (
              <circle
                cx={sx(w.stations[onset]!.x)}
                cy={sy(w.stations[onset]!.y)}
                r={3.2}
                fill="#b45a4a"
              />
            )}
            <circle
              cx={sx(last.x)}
              cy={sy(last.y)}
              r={14}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setWell(w.id)}
            />
            <circle
              cx={sx(last.x)}
              cy={sy(last.y)}
              r={on ? 5 : 3.5}
              fill={on ? "#ebe6d8" : "#8a8678"}
              className="pointer-events-none"
            />
            <text
              x={sx(last.x) + 8}
              y={sy(last.y) + 4}
              fill={on ? "#ebe6d8" : "#8a8678"}
              fontSize={11}
              fontFamily="IBM Plex Mono, monospace"
              className="cursor-pointer"
              onClick={() => setWell(w.id)}
            >
              {w.id}
              {rmse != null ? `  ${rmse.toFixed(1)}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
