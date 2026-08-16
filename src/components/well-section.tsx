import { useHorizon } from "@/lib/store";

export function WellSection() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const setWell = useHorizon((s) => s.setWell);
  const results = useHorizon((s) => s.results);

  const samples = pad.wells.flatMap((w) => {
    const x0 = w.stations[0]!.x;
    const y0 = w.stations[0]!.y;
    return w.stations.map((s) => ({
      dep: Math.hypot(s.x - x0, s.y - y0),
      tvd: -s.z,
    }));
  });
  if (!samples.length) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted">No wells loaded.</div>
    );
  }
  const deps = samples.map((s) => s.dep);
  const tvds = samples.map((s) => s.tvd);
  const minD = 0;
  const maxD = Math.max(...deps, 1);
  const minT = Math.min(...tvds);
  const maxT = Math.max(...tvds);
  const W = 640;
  const H = 360;
  const padX = 36;
  const padY = 24;
  const sx = (d: number) => padX + (d / Math.max(maxD - minD, 1)) * (W - padX * 2);
  const sy = (t: number) => padY + ((t - minT) / Math.max(maxT - minT, 1)) * (H - padY * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Section view">
      <rect width={W} height={H} fill="#0b0c0a" />
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={padX}
          x2={W - padX}
          y1={padY + ((H - padY * 2) * i) / 3}
          y2={padY + ((H - padY * 2) * i) / 3}
          stroke="#26261f"
        />
      ))}
      {pad.wells.map((w) => {
        const x0 = w.stations[0]!.x;
        const y0 = w.stations[0]!.y;
        const on = w.id === active;
        const d = w.stations
          .map((s, i) => {
            const dep = Math.hypot(s.x - x0, s.y - y0);
            return `${i === 0 ? "M" : "L"} ${sx(dep).toFixed(1)} ${sy(-s.z).toFixed(1)}`;
          })
          .join(" ");
        const last = w.stations[w.stations.length - 1]!;
        const lastDep = Math.hypot(last.x - x0, last.y - y0);
        const rmse = results[w.id]?.toeRmse;
        const onset = results[w.id]?.sheaf.horizonOnset;
        return (
          <g key={w.id}>
            <path d={d} fill="none" stroke={on ? "#d8d2c4" : "#5c594e"} strokeWidth={on ? 2.2 : 1.2} />
            {onset != null && w.stations[onset] && (
              <circle
                cx={sx(Math.hypot(w.stations[onset]!.x - x0, w.stations[onset]!.y - y0))}
                cy={sy(-w.stations[onset]!.z)}
                r={3.5}
                fill="#b45a4a"
              />
            )}
            <circle
              cx={sx(lastDep)}
              cy={sy(-last.z)}
              r={14}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => setWell(w.id)}
            />
            <circle
              cx={sx(lastDep)}
              cy={sy(-last.z)}
              r={on ? 5 : 3.5}
              fill={on ? "#ebe6d8" : "#8a8678"}
              className="pointer-events-none"
            />
            <text
              x={sx(lastDep) + 8}
              y={sy(-last.z) + 4}
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
      <text x={padX} y={H - 8} fill="#5c594e" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        departure 0
      </text>
      <text
        x={W - padX}
        y={H - 8}
        textAnchor="end"
        fill="#5c594e"
        fontSize={10}
        fontFamily="IBM Plex Mono, monospace"
      >
        {maxD.toFixed(0)} ft
      </text>
    </svg>
  );
}
