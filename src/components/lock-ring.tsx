import type { LockReport } from "@/lib/rwt/types";

export function LockRing({ locks }: { locks: LockReport }) {
  const cx = 140;
  const cy = 140;
  const R = 92;
  const n = locks.tumblers.length;

  return (
    <svg viewBox="0 0 280 280" className="h-auto w-full max-w-[300px]" role="img" aria-label="Six gates">
      <rect width={280} height={280} fill="#0b0c0a" />
      <circle cx={cx} cy={cy} r={118} fill="none" stroke="#26261f" />
      <circle cx={cx} cy={cy} r={54} fill="#131411" stroke="#26261f" />
      {locks.tumblers.map((t, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const inner = 62;
        const outer = inner + 18 + t.value * 36;
        const x0 = cx + Math.cos(ang) * inner;
        const y0 = cy + Math.sin(ang) * inner;
        const x1 = cx + Math.cos(ang) * outer;
        const y1 = cy + Math.sin(ang) * outer;
        const lx = cx + Math.cos(ang) * (R + 28);
        const ly = cy + Math.sin(ang) * (R + 28);
        return (
          <g key={t.id}>
            <line
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              stroke={t.locked ? "#6b8f71" : "#c4a35a"}
              strokeWidth={8}
              strokeLinecap="round"
            />
            <circle cx={x1} cy={y1} r={4} fill={t.locked ? "#ebe6d8" : "#8a8678"} />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#8a8678"
              fontSize={9}
              fontFamily="IBM Plex Mono, monospace"
            >
              {t.name}
            </text>
          </g>
        );
      })}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fill="#ebe6d8"
        fontSize={22}
        fontFamily="IBM Plex Mono, monospace"
      >
        {(locks.keyFit * 100).toFixed(0)}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fill="#5c594e"
        fontSize={10}
        fontFamily="IBM Plex Mono, monospace"
      >
        {locks.fireReady ? "READY" : `${locks.turns}/6 PASS`}
      </text>
    </svg>
  );
}