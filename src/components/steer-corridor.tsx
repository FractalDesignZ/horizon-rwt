import type { SteerReport } from "@/lib/rwt/types";

export function SteerCorridor({
  steer,
  onBit,
}: {
  steer: SteerReport;
  onBit?: (i: number) => void;
}) {
  const W = 720;
  const H = 280;
  const padL = 44;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const mds = steer.samples.map((s) => s.md);
  const tvs = steer.samples.flatMap((s) => [s.lo, s.hi, s.geo, s.mean, steer.windowLo, steer.windowHi]);
  const minM = mds[0] ?? 0;
  const maxM = mds[mds.length - 1] ?? 1;
  const minT = Math.min(...tvs, steer.windowLo) - 2;
  const maxT = Math.max(...tvs, steer.windowHi) + 2;
  const sx = (md: number) => padL + ((md - minM) / Math.max(maxM - minM, 1)) * (W - padL - padR);
  const sy = (t: number) => padT + ((t - minT) / Math.max(maxT - minT, 1)) * (H - padT - padB);

  const ribbon = [
    ...steer.samples.map((s, i) => `${i === 0 ? "M" : "L"} ${sx(s.md).toFixed(1)} ${sy(s.hi).toFixed(1)}`),
    ...[...steer.samples].reverse().map((s) => `L ${sx(s.md).toFixed(1)} ${sy(s.lo).toFixed(1)}`),
    "Z",
  ].join(" ");
  const meanP = steer.samples
    .map((s, i) => `${i === 0 ? "M" : "L"} ${sx(s.md).toFixed(1)} ${sy(s.mean).toFixed(1)}`)
    .join(" ");
  const geoP = steer.samples
    .map((s, i) => `${i === 0 ? "M" : "L"} ${sx(s.md).toFixed(1)} ${sy(s.geo).toFixed(1)}`)
    .join(" ");
  const bookP = steer.samples
    .map((s, i) => `${i === 0 ? "M" : "L"} ${sx(s.md).toFixed(1)} ${sy(s.book).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Steer corridor"
      onClick={(e) => {
        if (!onBit || !steer.samples.length) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * W;
        const md = minM + ((x - padL) / Math.max(W - padL - padR, 1)) * (maxM - minM);
        let best = steer.samples[0]!;
        for (const s of steer.samples) {
          if (Math.abs(s.md - md) < Math.abs(best.md - md)) best = s;
        }
        onBit(best.i);
      }}
    >
      <rect width={W} height={H} fill="#0b0c0a" />
      <rect
        x={padL}
        y={sy(steer.windowLo)}
        width={W - padL - padR}
        height={Math.max(2, sy(steer.windowHi) - sy(steer.windowLo))}
        fill="#26261f"
        opacity={0.55}
      />
      <line x1={padL} x2={W - padR} y1={sy(steer.windowLo)} y2={sy(steer.windowLo)} stroke="#5c594e" strokeDasharray="4 3" />
      <line x1={padL} x2={W - padR} y1={sy(steer.windowHi)} y2={sy(steer.windowHi)} stroke="#5c594e" strokeDasharray="4 3" />
      <path d={ribbon} fill="#2a4a52" opacity={0.45} />
      <path d={bookP} fill="none" stroke="#5c594e" strokeDasharray="3 3" strokeWidth={1} />
      <path d={meanP} fill="none" stroke="#8a8678" strokeWidth={1.1} />
      <path d={geoP} fill="none" stroke="#d8d2c4" strokeWidth={2} />
      {steer.samples
        .filter((s) => s.horizon)
        .map((s) => (
          <line
            key={s.i}
            x1={sx(s.md)}
            x2={sx(s.md)}
            y1={padT}
            y2={H - padB}
            stroke="#b45a4a"
            strokeWidth={0.7}
            opacity={0.55}
          />
        ))}
      <circle cx={sx(steer.bitMd)} cy={sy(steer.bitTvt)} r={5} fill="#ebe6d8" />
      <text x={padL} y={H - 8} fill="#5c594e" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        MD {minM.toFixed(0)}
      </text>
      <text x={W - padR} y={H - 8} textAnchor="end" fill="#5c594e" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        {maxM.toFixed(0)}
      </text>
      <text x={8} y={padT + 8} fill="#5c594e" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        bed
      </text>
    </svg>
  );
}