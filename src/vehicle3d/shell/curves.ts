/** Small, allocation-free curve helpers for the procedural shell (pure TS, mm in / mm out). */

export type Pt = [number, number];

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-9), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Monotone cubic (Fritsch–Carlson) through control points: smooth like a spline but never
 * overshoots, so a roof peak stays flat and a bonnet never bulges above its control points.
 * Points may come in any x order; outside the range the end values hold.
 */
export function monotone(points: Pt[]): (x: number) => number {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  // merge duplicate x (keep the last given)
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [x, y] of pts) {
    if (xs.length && Math.abs(x - xs[xs.length - 1]) < 1e-6) ys[ys.length - 1] = y;
    else {
      xs.push(x);
      ys.push(y);
    }
  }
  const n = xs.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => ys[0];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] > x) hi = mid;
      else lo = mid;
    }
    const h = xs[hi] - xs[lo];
    const t = (x - xs[lo]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[lo] +
      (t3 - 2 * t2 + t) * h * m[lo] +
      (-2 * t3 + 3 * t2) * ys[hi] +
      (t3 - t2) * h * m[hi]
    );
  };
}

/** Tabulate f over [x0, x1] for fast linear-interpolated lookups (the shell evaluates a lot). */
export function tabulate(
  f: (x: number) => number,
  x0: number,
  x1: number,
  step = 2,
): (x: number) => number {
  const n = Math.max(2, Math.ceil((x1 - x0) / step) + 1);
  const dx = (x1 - x0) / (n - 1);
  const tab = new Float64Array(n);
  for (let i = 0; i < n; i++) tab[i] = f(x0 + i * dx);
  return (x: number) => {
    const u = (x - x0) / dx;
    if (u <= 0) return tab[0];
    if (u >= n - 1) return tab[n - 1];
    const i = Math.floor(u);
    const t = u - i;
    return tab[i] + (tab[i + 1] - tab[i]) * t;
  };
}

/** Piecewise-linear through points (x ascending after sort). */
export function linear(points: Pt[]): (x: number) => number {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  return (x: number) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        return x1 === x0 ? y1 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
    }
    return pts[pts.length - 1][1];
  };
}

/** Superellipse end rounding: 1 well inside, falling to 0 at the tip over `len` with exponent p. */
export function endRound(d: number, len: number, p: number): number {
  // d = distance from the tip (>= 0)
  if (d >= len) return 1;
  if (d <= 0) return 0;
  const u = 1 - d / len;
  return Math.pow(Math.max(0, 1 - Math.pow(u, p)), 1 / p);
}
