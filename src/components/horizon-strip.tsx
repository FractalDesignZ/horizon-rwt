import type { PipelineResult, Well } from "@/lib/rwt/types";

export function HorizonStrip({
  well,
  result,
  station,
  onStation,
}: {
  well: Well;
  result: PipelineResult;
  station: number;
  onStation?: (i: number) => void;
}) {
  const n = well.stations.length;
  const W = 920;
  const H = 132;
  const left = 52;
  const right = 16;
  const inner = W - left - right;
  const xOf = (i: number) => left + (i / Math.max(n - 1, 1)) * inner;
  const series = [
    { key: "|Γ|", vals: result.sheaf.smithPath.map((p) => p.mag), lo: 0, hi: 1, y0: 8, h: 36, stroke: "#d8d2c4" },
    { key: "h", vals: result.sheaf.smithPath.map((p) => p.hyp), lo: 0, hi: 4, y0: 50, h: 36, stroke: "#c4a35a" },
    {
      key: "rec",
      vals: result.sheaf.recoverability,
      lo: 0,
      hi: 1,
      y0: 92,
      h: 32,
      stroke: "#6b8f71",
    },
  ];
  const pathOf = (vals: number[], lo: number, hi: number, y0: number, h: number) =>
    vals
      .map((v, i) => {
        const y = y0 + (1 - (v - lo) / Math.max(hi - lo, 1e-6)) * h;
        return `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const onset = result.sheaf.horizonOnset;
  const ps = well.stations.findIndex((s) => s.isPredict);

  const handle = (ev: React.MouseEvent<SVGSVGElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const xi = ((ev.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((xi - left) / inner) * (n - 1));
    onStation?.(Math.max(0, Math.min(n - 1, idx)));
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" onClick={handle} role="img" aria-label="Bounce along the hole">
      <rect width={W} height={H} fill="#131411" />
      <rect x={left} y={4} width={inner} height={H - 8} fill="#0b0c0a" />
      {ps >= 0 && (
        <line x1={xOf(ps)} x2={xOf(ps)} y1={4} y2={H - 4} stroke="#2a4a52" strokeDasharray="3 3" />
      )}
      {onset != null && (
        <line x1={xOf(onset)} x2={xOf(onset)} y1={4} y2={H - 4} stroke="#b45a4a" strokeWidth={1.2} />
      )}
      {series.map((s) => (
        <g key={s.key}>
          <text x={8} y={s.y0 + 14} fill="#5c594e" fontSize={10} fontFamily="IBM Plex Mono, monospace">
            {s.key}
          </text>
          <path d={pathOf(s.vals, s.lo, s.hi, s.y0, s.h)} fill="none" stroke={s.stroke} strokeWidth={1.3} />
        </g>
      ))}
      <rect x={xOf(station) - 0.6} y={4} width={1.2} height={H - 8} fill="#ebe6d8" opacity={0.55} />
    </svg>
  );
}
