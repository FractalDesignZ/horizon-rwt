import { useEffect, useState } from "react";
import { channelAt } from "@/lib/rwt/cts";
import type { Well } from "@/lib/rwt/types";

export function ChannelRaster({
  well,
  names,
  station,
  onStation,
}: {
  well: Well;
  names: string[];
  station: number;
  onStation?: (i: number) => void;
}) {
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);

  const n = well.stations.length;
  const rows = names.filter((name) => well.stations.some((s, i) => Number.isFinite(channelAt(well, name, i))));
  const W = 720;
  const rowH = 28;
  const left = 52;
  const H = 18 + rows.length * rowH;
  const step = Math.max(1, Math.floor(n / 120));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Channel raster"
      onClick={(e) => {
        if (!onStation) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * W;
        const i = Math.round(((x - left) / (W - left - 16)) * (n - 1));
        onStation(Math.max(0, Math.min(n - 1, i)));
      }}
    >
      <rect width={W} height={H} fill="#0b0c0a" />
      {live &&
        rows.map((name, r) => {
          const vals = well.stations.map((_, i) => channelAt(well, name, i));
          const finite = vals.filter(Number.isFinite);
          const lo = Math.min(...finite);
          const hi = Math.max(...finite);
          const y = 10 + r * rowH;
          const cells = [];
          for (let i = 0; i < n; i += step) {
            const v = vals[i]!;
            if (!Number.isFinite(v)) continue;
            const t = (v - lo) / Math.max(hi - lo, 1e-6);
            const x = left + (i / Math.max(n - 1, 1)) * (W - left - 16);
            const w = Math.max(2, ((W - left - 16) * step) / n + 0.2);
            const rr = Math.round(72 + t * 150);
            const gg = Math.round(74 + t * 110);
            const bb = Math.round(64 + t * 50);
            cells.push(
              <rect
                key={i}
                x={Math.round(x)}
                y={y}
                width={Math.round(w)}
                height={16}
                fill={`rgb(${rr},${gg},${bb})`}
              />,
            );
          }
          return (
            <g key={name}>
              <text x={6} y={y + 11} fill="#8a8678" fontSize={10} fontFamily="IBM Plex Mono, monospace">
                {name}
              </text>
              {cells}
            </g>
          );
        })}
      {rows.map((name, r) => (
        <text key={name} x={6} y={10 + r * rowH + 11} fill="#8a8678" fontSize={10} fontFamily="IBM Plex Mono, monospace">
          {live ? "" : name}
        </text>
      ))}
      <line
        x1={left + (station / Math.max(n - 1, 1)) * (W - left - 16)}
        x2={left + (station / Math.max(n - 1, 1)) * (W - left - 16)}
        y1={6}
        y2={H - 4}
        stroke="#ebe6d8"
        strokeWidth={1}
        opacity={0.7}
      />
    </svg>
  );
}