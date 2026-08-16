import type { PipelineResult, Well } from "@/lib/rwt/types";

export function TypewellBook({
  well,
  result,
  station,
}: {
  well: Well;
  result?: PipelineResult;
  station: number;
}) {
  const tw = well.typewell;
  const W = 420;
  const H = 280;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const tMin = tw.tvt[0] ?? 40;
  const tMax = tw.tvt[tw.tvt.length - 1] ?? 220;
  const gMin = Math.min(...tw.gr.filter(Number.isFinite), 20);
  const gMax = Math.max(...tw.gr.filter(Number.isFinite), 180);
  const xOf = (g: number) => padL + ((g - gMin) / Math.max(gMax - gMin, 1)) * (W - padL - padR);
  const yOf = (t: number) => padT + ((t - tMin) / Math.max(tMax - tMin, 1)) * (H - padT - padB);
  const book = tw.tvt
    .map((t, i) => {
      const g = tw.gr[i]!;
      if (!Number.isFinite(g)) return null;
      return `${i === 0 ? "M" : "L"} ${xOf(g).toFixed(1)} ${yOf(t).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  const hat = result?.selected;
  const curT = hat?.[station] ?? well.stations[station]?.tvtInput ?? well.stations[station]?.tvt;
  const curG = well.stations[station]?.gr;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="GR at TVT book">
      <rect width={W} height={H} fill="#0b0c0a" />
      <path d={book} fill="none" stroke="#5c594e" strokeWidth={1.2} />
      {well.stations.map((s, i) => {
        const t = hat?.[i] ?? s.tvtInput ?? s.tvt;
        if (t == null || !Number.isFinite(s.gr) || !Number.isFinite(t)) return null;
        return (
          <circle
            key={i}
            cx={xOf(s.gr).toFixed(1)}
            cy={yOf(t).toFixed(1)}
            r={i === station ? 3.4 : 1.6}
            fill={s.isPredict ? "#d8d2c4" : "#6b8f71"}
            opacity={i === station ? 1 : 0.55}
          />
        );
      })}
      {curT != null && Number.isFinite(curT) && Number.isFinite(curG) && (
        <circle cx={xOf(curG!).toFixed(1)} cy={yOf(curT).toFixed(1)} r={5} fill="none" stroke="#ebe6d8" />
      )}
      <text x={padL} y={H - 8} fill="#5c594e" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        GR {gMin.toFixed(0)}
      </text>
      <text x={W - padR} y={H - 8} textAnchor="end" fill="#5c594e" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        {gMax.toFixed(0)}
      </text>
      <text x={8} y={padT + 8} fill="#5c594e" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        TVT {tMin.toFixed(0)}
      </text>
    </svg>
  );
}
