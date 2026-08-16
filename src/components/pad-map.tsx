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
  if (!pts.length) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted">No wells loaded.</div>
    );
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const W = 640;
  const H = 360;
  const padX = 36;
  const padY = 28;
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const sx = (x: number) => padX + ((x - minX) / spanX) * (W - padX * 2);
  const sy = (y: number) => H - padY - ((y - minY) / spanY) * (H - padY * 2);
  const ftPerPx = spanX / (W - padX * 2);
  const nice = [500, 1000, 2000, 5000, 10000, 20000, 50000];
  const barFt = nice.find((v) => v / ftPerPx >= 48 && v / ftPerPx <= 140) ?? 10000;
  const barW = barFt / ftPerPx;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Field plan view">
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
              strokeWidth={on ? 2.4 : 1.6}
            />
            <circle cx={sx(heel.x)} cy={sy(heel.y)} r={2.4} fill="#5c594e" />
            <circle cx={sx(ps.x)} cy={sy(ps.y)} r={2.2} fill="#2a4a52" />
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
              r={16}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setWell(w.id)}
            />
            <text
              x={sx(last.x) + 6}
              y={sy(last.y) - 6}
              fill={on ? "#ebe6d8" : "#8a8678"}
              fontSize={10}
              fontFamily="IBM Plex Mono, monospace"
              className="cursor-pointer"
              onClick={() => setWell(w.id)}
            >
              {w.name}
            </text>
          </g>
        );
      })}
      <g>
        <line x1={padX} y1={H - 12} x2={padX + barW} y2={H - 12} stroke="#5c594e" strokeWidth={1.4} />
        <line x1={padX} y1={H - 15} x2={padX} y2={H - 9} stroke="#5c594e" />
        <line x1={padX + barW} y1={H - 15} x2={padX + barW} y2={H - 9} stroke="#5c594e" />
        <text x={padX + barW + 6} y={H - 9} fill="#5c594e" fontSize={9} fontFamily="IBM Plex Mono, monospace">
          {barFt >= 1000 ? `${barFt / 1000}k ft` : `${barFt} ft`}
        </text>
      </g>
    </svg>
  );
}
