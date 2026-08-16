export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randn(rng: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function mean(a: number[]) {
  const f = a.filter(Number.isFinite);
  if (!f.length) return NaN;
  return f.reduce((s, x) => s + x, 0) / f.length;
}

export function median(a: number[]) {
  const f = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!f.length) return NaN;
  const m = Math.floor(f.length / 2);
  return f.length % 2 ? f[m]! : 0.5 * (f[m - 1]! + f[m]!);
}

export function std(a: number[]) {
  const f = a.filter(Number.isFinite);
  if (f.length < 2) return 0;
  const m = mean(f);
  return Math.sqrt(f.reduce((s, x) => s + (x - m) ** 2, 0) / f.length);
}

export function rmse(y: number[], p: number[]) {
  let s = 0;
  let n = 0;
  for (let i = 0; i < y.length; i++) {
    const a = y[i]!;
    const b = p[i]!;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    s += (a - b) ** 2;
    n++;
  }
  return n ? Math.sqrt(s / n) : NaN;
}

export function interp(xq: number, x: number[], y: number[]) {
  if (!x.length) return NaN;
  if (xq <= x[0]!) return y[0]!;
  if (xq >= x[x.length - 1]!) return y[y.length - 1]!;
  let lo = 0;
  let hi = x.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (x[mid]! <= xq) lo = mid;
    else hi = mid;
  }
  const t = (xq - x[lo]!) / Math.max(x[hi]! - x[lo]!, 1e-12);
  return y[lo]! + t * (y[hi]! - y[lo]!);
}

export function linspace(a: number, b: number, n: number) {
  if (n <= 1) return [a];
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = a + ((b - a) * i) / (n - 1);
  return out;
}

export function rollingMean(a: number[], w: number) {
  const n = a.length;
  const out = new Array<number>(n);
  const half = Math.max(1, Math.floor(w / 2));
  for (let i = 0; i < n; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      if (Number.isFinite(a[j]!)) {
        s += a[j]!;
        c++;
      }
    }
    out[i] = c ? s / c : NaN;
  }
  return out;
}

export function zscore(a: number[]) {
  const m = mean(a);
  const s = std(a);
  if (!Number.isFinite(s) || s < 1e-9) return a.map(() => 0);
  return a.map((v) => (Number.isFinite(v) ? (v - m) / s : 0));
}

export function ncc0(a: number[], b: number[]) {
  const za = zscore(a);
  const zb = zscore(b);
  const n = Math.min(za.length, zb.length);
  if (n < 3) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += za[i]! * zb[i]!;
  return s / n;
}

export function norm3(v: [number, number, number]) {
  return Math.hypot(v[0], v[1], v[2]);
}

export function dot3(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross3(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function unit3(v: [number, number, number]): [number, number, number] {
  const n = norm3(v) + 1e-15;
  return [v[0] / n, v[1] / n, v[2] / n];
}

export function solveSymmetric(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r]![i]!) > Math.abs(M[piv]![i]!)) piv = r;
    }
    [M[i], M[piv]] = [M[piv]!, M[i]!];
    const d = M[i]![i]!;
    if (Math.abs(d) < 1e-14) return b.map(() => 0);
    for (let c = i; c <= n; c++) M[i]![c]! /= d;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = M[r]![i]!;
      for (let c = i; c <= n; c++) M[r]![c]! -= f * M[i]![c]!;
    }
  }
  return M.map((row) => row[n]!);
}

export function jacobiEigen(Ain: number[][], maxIter = 48) {
  const n = Ain.length;
  const A = Ain.map((r) => r.slice());
  const V: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
  for (let it = 0; it < maxIter; it++) {
    let p = 0;
    let q = 1;
    let max = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const v = Math.abs(A[i]![j]!);
        if (v > max) {
          max = v;
          p = i;
          q = j;
        }
      }
    }
    if (max < 1e-10) break;
    const app = A[p]![p]!;
    const aqq = A[q]![q]!;
    const apq = A[p]![q]!;
    const tau = (aqq - app) / (2 * apq);
    const t = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;
    for (let k = 0; k < n; k++) {
      const aik = A[p]![k]!;
      const aqk = A[q]![k]!;
      A[p]![k] = c * aik - s * aqk;
      A[q]![k] = s * aik + c * aqk;
    }
    for (let k = 0; k < n; k++) {
      const akp = A[k]![p]!;
      const akq = A[k]![q]!;
      A[k]![p] = c * akp - s * akq;
      A[k]![q] = s * akp + c * akq;
    }
    A[p]![q] = 0;
    A[q]![p] = 0;
    A[p]![p] = app - t * apq;
    A[q]![q] = aqq + t * apq;
    for (let k = 0; k < n; k++) {
      const vip = V[k]![p]!;
      const viq = V[k]![q]!;
      V[k]![p] = c * vip - s * viq;
      V[k]![q] = s * vip + c * viq;
    }
  }
  const evals = A.map((r, i) => r[i]!);
  const order = evals.map((v, i) => i).sort((i, j) => evals[i]! - evals[j]!);
  return {
    values: order.map((i) => evals[i]!),
    vectors: order.map((i) => V.map((row) => row[i]!)),
  };
}

export function entropy(p: number[]) {
  let h = 0;
  for (const v of p) {
    if (v > 1e-12) h -= v * Math.log(v);
  }
  return h;
}

export function isLasNull(v: number) {
  if (!Number.isFinite(v)) return true;
  for (const s of [-999.25, -999, -9999, -9999.25, -999.99]) {
    if (Math.abs(v - s) < 1e-6) return true;
  }
  return false;
}
