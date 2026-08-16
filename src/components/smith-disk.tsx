import type { SheafReport } from "@/lib/rwt/types";

function toXY(re: number, im: number, cx: number, cy: number, R: number) {
  return [cx + re * R, cy - im * R] as const;
}

function rCircle(r: number, cx: number, cy: number, R: number) {
  const c = r / (r + 1);
  const rad = 1 / (r + 1);
  const [x, y] = toXY(c, 0, cx, cy, R);
  return { x, y, rad: rad * R };
}

function xArcPath(x: number, cx: number, cy: number, R: number) {
  const cIm = 1 / x;
  const rad = Math.abs(1 / x);
  const steps = 48;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI;
    const sign = x > 0 ? 1 : -1;
    const ang = sign > 0 ? Math.PI + t : -t;
    const re = 1 + rad * Math.cos(ang);
    const im = cIm + rad * Math.sin(ang);
    if (re * re + im * im > 1.002) continue;
    const [px, py] = toXY(re, im, cx, cy, R);
    pts.push(`${pts.length ? "L" : "M"} ${px.toFixed(1)} ${py.toFixed(1)}`);
  }
  return pts.join(" ");
}

export function SmithDisk({
  sheaf,
  index,
  onIndex,
}: {
  sheaf: SheafReport;
  index: number;
  onIndex?: (i: number) => void;
}) {
  const R = 118;
  const cx = 148;
  const cy = 140;
  const cur = sheaf.smithPath[Math.max(0, Math.min(index, sheaf.smithPath.length - 1))]!;
  const [px, py] = toXY(cur.re, cur.im, cx, cy, R);
  const ps = sheaf.horizonOnset;

  const heel: string[] = [];
  const toe: string[] = [];
  sheaf.smithPath.forEach((p, i) => {
    const [x, y] = toXY(p.re, p.im, cx, cy, R);
    const cut = ps ?? sheaf.smithPath.length;
    const bucket = i < cut ? heel : toe;
    const cmd = `${bucket.length === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    bucket.push(cmd);
  });
  if (ps != null && heel.length && sheaf.smithPath[ps]) {
    const p = sheaf.smithPath[ps]!;
    const [x, y] = toXY(p.re, p.im, cx, cy, R);
    heel.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  const handle = (ev: React.MouseEvent<SVGSVGElement>) => {
    if (!onIndex) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const sx = ((ev.clientX - rect.left) / rect.width) * 296;
    const sy = ((ev.clientY - rect.top) / rect.height) * 292;
    let best = 0;
    let bd = Infinity;
    sheaf.smithPath.forEach((p, i) => {
      const [x, y] = toXY(p.re, p.im, cx, cy, R);
      const d = (x - sx) ** 2 + (y - sy) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    onIndex(best);
  };

  return (
    <svg
      viewBox="0 0 296 292"
      className="h-auto w-full max-w-[360px]"
      aria-label="Bounce map"
      onClick={handle}
      role="img"
    >
      <rect width={296} height={292} fill="#0b0c0a" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#26261f" />
      {[0.2, 0.5, 1, 2, 5].map((r) => {
        const c = rCircle(r, cx, cy, R);
        return (
          <circle
            key={r}
            cx={c.x}
            cy={c.y}
            r={c.rad}
            fill="none"
            stroke="#1a1b17"
            strokeWidth={0.8}
          />
        );
      })}
      {[-5, -2, -1, -0.5, -0.2, 0.2, 0.5, 1, 2, 5].map((x) => (
        <path key={x} d={xArcPath(x, cx, cy, R)} fill="none" stroke="#1a1b17" strokeWidth={0.8} />
      ))}
      <line x1={cx - R} x2={cx + R} y1={cy} y2={cy} stroke="#26261f" />
      <circle cx={cx} cy={cy} r={R * 0.72} fill="none" stroke="#b45a4a" strokeDasharray="3 4" opacity={0.55} />
      <path d={heel.join(" ")} fill="none" stroke="#8a8678" strokeWidth={1.3} />
      {toe.length > 0 && <path d={toe.join(" ")} fill="none" stroke="#d8d2c4" strokeWidth={1.6} />}
      <circle cx={px} cy={py} r={5} fill="#ebe6d8" />
      <text x={cx} y={276} textAnchor="middle" fill="#5c594e" fontSize={10} fontFamily="IBM Plex Mono, monospace">
        |Γ| {cur.mag.toFixed(3)} · h {cur.hyp.toFixed(2)} · A {cur.amp.toFixed(1)}
      </text>
    </svg>
  );
}
