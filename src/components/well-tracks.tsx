import type { PipelineResult, Well } from "@/lib/rwt/types";

export type TrackOverlay = "served" | "truth" | "last" | "stack" | "pf" | "ncc";

interface Props {
  well: Well;
  result?: PipelineResult;
  station: number;
  onStation?: (i: number) => void;
  overlays?: TrackOverlay[];
}

export function WellTracks({ well, result, station, onStation, overlays }: Props) {
  const show = overlays ?? (["served", "truth", "last"] as TrackOverlay[]);
  const n = well.stations.length;
  const W = 920;
  const trackH = 148;
  const gap = 16;
  const tracks = 3;
  const H = trackH * tracks + gap * (tracks - 1) + 28;
  const left = 52;
  const right = 16;
  const inner = W - left - right;

  const md0 = well.stations[0]!.md;
  const md1 = well.stations[n - 1]!.md;
  const xOf = (i: number) => left + (i / Math.max(n - 1, 1)) * inner;
  const mdOf = (i: number) => well.stations[i]!.md;

  const gr = well.stations.map((s) => s.gr);
  const grMin = Math.min(...gr.filter(Number.isFinite), 20);
  const grMax = Math.max(...gr.filter(Number.isFinite), 160);
  const z = well.stations.map((s) => s.z);
  const zMin = Math.min(...z);
  const zMax = Math.max(...z);

  const yIn = (v: number, a: number, b: number, top: number) =>
    top + (1 - (v - a) / Math.max(b - a, 1e-6)) * trackH;

  const pathOf = (vals: number[], a: number, b: number, top: number) =>
    vals
      .map((v, i) => {
        if (!Number.isFinite(v)) return null;
        return `${i === 0 || !Number.isFinite(vals[i - 1]!) ? "M" : "L"} ${xOf(i).toFixed(1)} ${yIn(v, a, b, top).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");

  const ps = well.stations.findIndex((s) => s.isPredict);
  const psX = ps >= 0 ? xOf(ps) : xOf(n - 1);
  const tvtSeries = result?.selected ?? well.stations.map((s) => s.tvt ?? s.tvtInput ?? NaN);
  const truth = well.stations.map((s) => s.tvtTrue ?? s.tvt ?? NaN);
  const extraSeries: number[] = [];
  if (result && show.includes("stack")) extraSeries.push(...result.priors.priorStack);
  if (result && show.includes("pf")) extraSeries.push(...result.priors.priorPfBlend);
  if (result && show.includes("ncc")) extraSeries.push(...result.priors.priorNcc);
  const tVals = [...tvtSeries, ...truth, ...extraSeries].filter(Number.isFinite);
  const tMin = (tVals.length ? Math.min(...tVals) : 80) - 4;
  const tMax = (tVals.length ? Math.max(...tVals) : 160) + 4;
  const onset = result?.sheaf.horizonOnset;
  const tvtTop = trackH + gap;

  const handle = (ev: React.MouseEvent<SVGSVGElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const xi = ((ev.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((xi - left) / inner) * (n - 1));
    onStation?.(Math.max(0, Math.min(n - 1, idx)));
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      onClick={handle}
      role="img"
      aria-label="Well tracks"
    >
      <rect width={W} height={H} fill="#131411" />
      {[0, 1, 2].map((t) => {
        const top = t * (trackH + gap);
        return (
          <g key={t}>
            <rect x={left} y={top} width={inner} height={trackH} fill="#0b0c0a" />
            <line x1={psX} x2={psX} y1={top} y2={top + trackH} stroke="#2a4a52" strokeDasharray="3 3" />
            {onset != null && (
              <line
                x1={xOf(onset)}
                x2={xOf(onset)}
                y1={top}
                y2={top + trackH}
                stroke="#b45a4a"
                strokeWidth={1}
                opacity={0.7}
              />
            )}
            <rect
              x={xOf(station) - 0.6}
              y={top}
              width={1.2}
              height={trackH}
              fill="#d8d2c4"
              opacity={0.55}
            />
          </g>
        );
      })}

      <text x={8} y={16} fill="#8a8678" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        GR
      </text>
      <path d={pathOf(gr, grMin, grMax, 0)} fill="none" stroke="#8a9a7b" strokeWidth={1.4} />

      <text x={8} y={trackH + gap + 16} fill="#8a8678" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        TVT
      </text>
      {show.includes("truth") && (
        <path
          d={pathOf(truth, tMin, tMax, tvtTop)}
          fill="none"
          stroke="#5c594e"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
      {show.includes("served") && (
        <path
          d={pathOf(tvtSeries, tMin, tMax, tvtTop)}
          fill="none"
          stroke="#d8d2c4"
          strokeWidth={1.6}
        />
      )}
      {result && show.includes("last") && (
        <path
          d={pathOf(result.priors.priorLast, tMin, tMax, tvtTop)}
          fill="none"
          stroke="#c4a35a"
          strokeWidth={1}
          opacity={0.7}
        />
      )}
      {result && show.includes("stack") && (
        <path
          d={pathOf(result.priors.priorStack, tMin, tMax, tvtTop)}
          fill="none"
          stroke="#6b8f71"
          strokeWidth={1}
          opacity={0.8}
        />
      )}
      {result && show.includes("pf") && (
        <path
          d={pathOf(result.priors.priorPfBlend, tMin, tMax, tvtTop)}
          fill="none"
          stroke="#8a8678"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      )}
      {result && show.includes("ncc") && (
        <path
          d={pathOf(result.priors.priorNcc, tMin, tMax, tvtTop)}
          fill="none"
          stroke="#2a4a52"
          strokeWidth={1.1}
        />
      )}
      {result &&
        result.residual.fire.map((f, i) =>
          f ? (
            <rect
              key={`f${i}`}
              x={xOf(i) - 0.7}
              y={tvtTop}
              width={1.4}
              height={5}
              fill="#6b8f71"
            />
          ) : null,
        )}

      <text x={8} y={2 * (trackH + gap) + 16} fill="#8a8678" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        TVD
      </text>
      <path
        d={pathOf(z, zMin, zMax, 2 * (trackH + gap))}
        fill="none"
        stroke="#8a8678"
        strokeWidth={1.3}
      />

      <text
        x={left}
        y={H - 4}
        fill="#5c594e"
        fontSize={10}
        fontFamily="IBM Plex Mono, monospace"
      >
        MD {md0.toFixed(0)}
      </text>
      <text
        x={W - right - 70}
        y={H - 4}
        fill="#5c594e"
        fontSize={10}
        fontFamily="IBM Plex Mono, monospace"
        textAnchor="end"
      >
        {md1.toFixed(0)} · {mdOf(station).toFixed(0)}
      </text>
    </svg>
  );
}
