import { PersistBarcode } from "@/components/persist-barcode";
import { RogueManifold } from "@/components/rogue-manifold";
import { Badge } from "@/components/ui/badge";
import type { RogueFrame, RogueReport, Regime } from "@/lib/rwt/rogue";

const LABELS: Record<Regime, string> = {
  normal: "Normal",
  "stick-slip": "Stick-slip",
  whirl: "Whirl",
  bounce: "Bit bounce",
};

export function RogueStudio({ report, station }: { report: RogueReport; station: number }) {
  const frame = report.frames[Math.min(station, report.frames.length - 1)]!;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <RogueManifold report={report} station={station} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Regime</p>
          <p className="mt-1 font-display text-3xl tracking-tight">{LABELS[frame.regime]}</p>
          <p className="mt-1 font-mono text-xs text-subtle">
            β0 {frame.beta0} · β1 {frame.beta1} · {(frame.confidence * 100).toFixed(0)}%
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Light on={frame.hard} label="A3.1" tone="danger" />
            <Light on={frame.soft} label="A3.2" tone="warn" />
            <Light on={frame.warn} label="A3.3" tone="ok" invert />
          </div>
        </div>
        <Experts frame={frame} />
      </div>
      <SensorStrip report={report} station={station} />
      <div className="rounded-xl border border-border bg-surface p-3">
        <p className="mb-2 px-1 text-[11px] uppercase tracking-[0.12em] text-muted">Persistence</p>
        <PersistBarcode
          report={{
            bars: frame.bars,
            beta0: frame.beta0,
            beta1: frame.beta1,
            mergeScale: 2.4,
          }}
        />
      </div>
    </div>
  );
}

function Light({
  on,
  label,
  tone,
  invert,
}: {
  on: boolean;
  label: string;
  tone: "ok" | "warn" | "danger";
  invert?: boolean;
}) {
  const lit = invert ? !on : on;
  const cls =
    tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : "bg-ok";
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs">
      <span className={`h-2.5 w-2.5 rounded-full ${lit ? cls : "bg-elevated"}`} />
      {label}
    </span>
  );
}

function Experts({ frame }: { frame: RogueFrame }) {
  const keys: Regime[] = ["normal", "stick-slip", "whirl", "bounce"];
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Experts</p>
      <ul className="mt-3 space-y-2">
        {keys.map((k) => (
          <li key={k}>
            <div className="mb-1 flex justify-between font-mono text-[11px] text-subtle">
              <span>{LABELS[k]}</span>
              <span>{(frame.experts[k] * 100).toFixed(0)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
              <div
                className="h-full bg-accent"
                style={{ width: `${Math.max(2, frame.experts[k] * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{frame.recNote}</p>
      <div className="mt-2 flex gap-2">
        <Badge>WOB {frame.recWob.toFixed(0)}</Badge>
        <Badge>RPM {frame.recRpm.toFixed(0)}</Badge>
      </div>
    </div>
  );
}

function SensorStrip({ report, station }: { report: RogueReport; station: number }) {
  const chans: { key: "wob" | "rpm" | "trq" | "rop"; label: string }[] = [
    { key: "wob", label: "WOB" },
    { key: "rpm", label: "RPM" },
    { key: "trq", label: "TRQ" },
    { key: "rop", label: "ROP" },
  ];
  const W = 640;
  const h = 44;
  const pad = 8;
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="mb-2 px-1 text-[11px] uppercase tracking-[0.12em] text-muted">Sensors</p>
      <svg viewBox={`0 0 ${W} ${chans.length * (h + 6)}`} className="h-auto w-full">
        {chans.map((c, row) => {
          const vals = report.samples.map((s) => s[c.key]);
          const lo = Math.min(...vals);
          const hi = Math.max(...vals);
          const y0 = row * (h + 6);
          const d = vals
            .map((v, i) => {
              const x = pad + (i / Math.max(vals.length - 1, 1)) * (W - pad * 2);
              const y = y0 + h - 6 - ((v - lo) / Math.max(hi - lo, 1e-6)) * (h - 12);
              return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" ");
          const xNow = pad + (station / Math.max(vals.length - 1, 1)) * (W - pad * 2);
          return (
            <g key={c.key}>
              <text x={4} y={y0 + 12} fill="#5c594e" fontSize={9} fontFamily="IBM Plex Mono, monospace">
                {c.label}
              </text>
              <path d={d} fill="none" stroke="#8a8678" strokeWidth={1.1} />
              <line x1={xNow} x2={xNow} y1={y0 + 2} y2={y0 + h - 2} stroke="#d8d2c4" strokeWidth={1} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}