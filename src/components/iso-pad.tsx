import { useHorizon } from "@/lib/store";

export function IsoPad() {
  const pad = useHorizon((s) => s.pad);
  const active = useHorizon((s) => s.activeWellId);
  const setWell = useHorizon((s) => s.setWell);
  const results = useHorizon((s) => s.results);

  const raw = pad.wells.flatMap((w) =>
    w.stations.map((s) => {
      const ix = (s.x - s.y) * 0.866;
      const iy = (s.x + s.y) * 0.5 - s.z * 1.8;
      return { ix, iy };
    }),
  );
  if (!raw.length) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted">No wells loaded.</div>
    );
  }
  const minX = Math.min(...raw.map((p) => p.ix));
  const maxX = Math.max(...raw.map((p) => p.ix));
  const minY = Math.min(...raw.map((p) => p.iy));
  const maxY = Math.max(...raw.map((p) => p.iy));
  const W = 640;
  const H = 360;
  const px = 32;
  const py = 28;
  const sx = (x: number) => px + ((x - minX) / Math.max(maxX - minX, 1)) * (W - px * 2);
  const sy = (y: number) => H - py - ((y - minY) / Math.max(maxY - minY, 1)) * (H - py * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Isometric pad">
      <rect width={W} height={H} fill="#0b0c0a" />
      <line x1={px} y1={H - py} x2={W - px} y2={H - py} stroke="#26261f" />
      <line x1={px} y1={py} x2={px} y2={H - py} stroke="#26261f" />
      {pad.wells.map((w) => {
        const on = w.id === active;
        const r = results[w.id];
        const onset = r?.sheaf.horizonOnset;
        const d = w.stations
          .map((s, i) => {
            const ix = (s.x - s.y) * 0.866;
            const iy = (s.x + s.y) * 0.5 - s.z * 1.8;
            return `${i === 0 ? "M" : "L"} ${sx(ix).toFixed(1)} ${sy(iy).toFixed(1)}`;
          })
          .join(" ");
        const toe = w.stations[w.stations.length - 1]!;
        const tix = (toe.x - toe.y) * 0.866;
        const tiy = (toe.x + toe.y) * 0.5 - toe.z * 1.8;
        return (
          <g key={w.id} className="cursor-pointer" onClick={() => setWell(w.id)}>
            <path
              d={d}
              fill="none"
              stroke={on ? "#d8d2c4" : onset != null ? "#b45a4a" : "#8a8678"}
              strokeWidth={on ? 2 : 1.2}
            />
            <circle cx={sx(tix)} cy={sy(tiy)} r={on ? 4 : 2.4} fill={on ? "#ebe6d8" : "#5c594e"} />
            <text
              x={sx(tix) + 6}
              y={sy(tiy) + 3}
              fill={on ? "#ebe6d8" : "#8a8678"}
              fontSize={10}
              fontFamily="IBM Plex Mono, monospace"
            >
              {w.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}