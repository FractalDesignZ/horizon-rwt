import type { RogueReport } from "@/lib/rwt/rogue";

const REGIME_INK: Record<string, string> = {
  normal: "#8a8678",
  "stick-slip": "#c4a35a",
  whirl: "#2a4a52",
  bounce: "#b45a4a",
};

export function RogueManifold({
  report,
  station,
}: {
  report: RogueReport;
  station: number;
}) {
  const W = 640;
  const H = 360;
  const pad = 36;
  const frames = report.frames;
  const i0 = Math.max(0, station - 70);
  const win = frames.slice(i0, station + 1);
  const xs = win.map((f) => (f.mech.wob - f.mech.rpm) * 0.866);
  const ys = win.map((f) => (f.mech.wob + f.mech.rpm) * 0.5 - f.mech.trq * 8);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const sx = (v: number) => pad + ((v - minX) / Math.max(maxX - minX, 1)) * (W - pad * 2);
  const sy = (v: number) => H - pad - ((v - minY) / Math.max(maxY - minY, 1)) * (H - pad * 2);
  const here = frames[Math.min(station, frames.length - 1)]!;
  const hx = (here.mech.wob - here.mech.rpm) * 0.866;
  const hy = (here.mech.wob + here.mech.rpm) * 0.5 - here.mech.trq * 8;
  const gx = (report.safe.wob - report.safe.rpm) * 0.866;
  const gy = (report.safe.wob + report.safe.rpm) * 0.5 - report.safe.trq * 8;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Drilling manifold">
      <rect width={W} height={H} fill="#0b0c0a" />
      <text x={pad} y={18} fill="#5c594e" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        WOB–RPM–TRQ
      </text>
      {win.slice(1).map((f, k) => {
        const a = win[k]!;
        const ax = (a.mech.wob - a.mech.rpm) * 0.866;
        const ay = (a.mech.wob + a.mech.rpm) * 0.5 - a.mech.trq * 8;
        const bx = (f.mech.wob - f.mech.rpm) * 0.866;
        const by = (f.mech.wob + f.mech.rpm) * 0.5 - f.mech.trq * 8;
        return (
          <line
            key={f.i}
            x1={sx(ax)}
            y1={sy(ay)}
            x2={sx(bx)}
            y2={sy(by)}
            stroke={REGIME_INK[f.regime] ?? "#8a8678"}
            strokeWidth={k > win.length - 8 ? 2.2 : 1.2}
            opacity={0.35 + (k / Math.max(win.length, 1)) * 0.65}
          />
        );
      })}
      <line
        x1={sx(hx)}
        y1={sy(hy)}
        x2={sx(gx)}
        y2={sy(gy)}
        stroke="#d8d2c4"
        strokeDasharray="5 4"
        strokeWidth={1.2}
      />
      <circle cx={sx(gx)} cy={sy(gy)} r={7} fill="none" stroke="#6b8f71" strokeWidth={1.4} />
      <circle cx={sx(hx)} cy={sy(hy)} r={5} fill="#ebe6d8" />
      <text x={W - pad} y={H - 12} textAnchor="end" fill="#5c594e" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        geodesic → safe
      </text>
    </svg>
  );
}