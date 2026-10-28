/**
 * A circuit's measured centreline (data/…) → the closed centreline the simulator drives,
 * sampled at an even spacing: position, heading, curvature and the distance to each edge; with
 * the named corners and the timing sectors placed along it.
 *
 * The data are points an even ~5 m apart round the lap. A periodic cubic spline through them
 * (continuous curvature, no corner where two pieces meet) is resampled at even arc length
 * (about every 2 m); its heading and curvature come from the spline's own derivatives, the
 * curvature then lightly smoothed (the measured points carry a few centimetres of noise). The
 * widths follow linearly between points. Nothing is rescaled: the lap is as long as the data.
 */
import type { Centreline, Corner, CornerMark, TrackPath, TrackSpec } from './types';

/** "0,499,-3,…" (centimetres, the first absolute, each after it a step) → metres; a number is
 *  one value for every point */
export function decode(s: string | number, n: number): Float64Array {
  const out = new Float64Array(n);
  if (typeof s === 'number') return out.fill(s);
  let v = 0;
  let i = 0;
  for (const part of s.split(',')) {
    v += Number(part);
    if (i < n) out[i] = v / 100;
    i++;
  }
  if (i !== n) throw new Error(`centreline data: ${i} values for ${n} points`);
  return out;
}

/**
 * Second derivatives of the periodic cubic spline through p (knots h apart):
 * m[i−1] + 4 m[i] + m[i+1] = 6 (p[i+1] − 2 p[i] + p[i−1]) / h², a cyclic tridiagonal system,
 * solved by Sherman–Morrison on the plain tridiagonal one.
 */
function splineM(p: Float64Array, h: number): Float64Array {
  const n = p.length;
  const rhs = new Float64Array(n);
  for (let i = 0; i < n; i++)
    rhs[i] = (6 * (p[(i + 1) % n] - 2 * p[i] + p[(i - 1 + n) % n])) / (h * h);
  // A = T + u vᵀ with u = (γ, 0, …, 0, 1), v = (1, 0, …, 0, 1/γ); T's corners adjusted
  const gamma = -4;
  const diag = new Float64Array(n).fill(4);
  diag[0] -= gamma;
  diag[n - 1] -= 1 / gamma;
  const thomas = (d: Float64Array) => {
    // sub- and super-diagonals are 1
    const c = new Float64Array(n);
    const x = new Float64Array(n);
    c[0] = 1 / diag[0];
    x[0] = d[0] / diag[0];
    for (let i = 1; i < n; i++) {
      const den = diag[i] - c[i - 1];
      c[i] = 1 / den;
      x[i] = (d[i] - x[i - 1]) / den;
    }
    for (let i = n - 2; i >= 0; i--) x[i] -= c[i] * x[i + 1];
    return x;
  };
  const y = thomas(rhs);
  const u = new Float64Array(n);
  u[0] = gamma;
  u[n - 1] = 1;
  const z = thomas(u);
  const f = (y[0] + y[n - 1] / gamma) / (1 + z[0] + z[n - 1] / gamma);
  for (let i = 0; i < n; i++) y[i] -= f * z[i];
  return y;
}

/** Value, first and second derivative of the spline piece from knot i at t ∈ [0, h]. */
const piece = { v: 0, d1: 0, d2: 0 };

function evalSpline(p: Float64Array, m: Float64Array, h: number, i: number, t: number) {
  const n = p.length;
  const j = (i + 1) % n;
  const a = h - t;
  const ci = p[i] / h - (m[i] * h) / 6;
  const cj = p[j] / h - (m[j] * h) / 6;
  piece.v = (m[i] * a * a * a + m[j] * t * t * t) / (6 * h) + ci * a + cj * t;
  piece.d1 = (-m[i] * a * a + m[j] * t * t) / (2 * h) - ci + cj;
  piece.d2 = (m[i] * a + m[j] * t) / h;
}

/** Where to look for a corner's apex either side of the distance authored (m). */
const SNAP = 30;
/** A corner runs while the curve is at least this share of its apex curvature, and tighter
 *  than a 1 km radius. */
const EDGE_SHARE = 0.3;
const EDGE_K = 1 / 1000;

/** The named corners along the centreline (see CornerMark). */
function placeCorners(marks: CornerMark[], k: Float64Array, ds: number) {
  const n = k.length;
  const at = (s: number) => Math.min(n - 1, Math.max(0, Math.round(s / ds)));
  const apexes = marks.map((mark) =>
    mark.at.map((s) => {
      let best = at(s);
      for (let d = -SNAP; d <= SNAP; d += ds) {
        const i = at(s + d);
        if (Math.abs(k[i]) > Math.abs(k[best])) best = i;
      }
      return best;
    }),
  );
  // out from the first and last apexes while the road still turns the same way, hard enough,
  // never past halfway to the next corner's apex (nor round past the line)
  const edge = (i: number) => Math.max(EDGE_K, EDGE_SHARE * Math.abs(k[i]));
  const same = (h: number, i: number) => Math.sign(k[h]) === Math.sign(k[i]);
  return marks.map((mark, c): Corner => {
    const own = apexes[c];
    const first = own[0];
    const last = own[own.length - 1];
    const low = c > 0 ? Math.ceil((apexes[c - 1].at(-1)! + first) / 2) : 0;
    const high = c < marks.length - 1 ? Math.floor((last + apexes[c + 1][0]) / 2) : n - 1;
    let i0 = first;
    while (i0 > low && Math.abs(k[i0 - 1]) >= edge(first) && same(i0 - 1, first)) i0--;
    let i1 = last;
    while (i1 < high && Math.abs(k[i1 + 1]) >= edge(last) && same(i1 + 1, last)) i1++;
    const tight = own.reduce((b, i) => (Math.abs(k[i]) > Math.abs(k[b]) ? i : b));
    return {
      name: mark.name,
      s0: i0 * ds,
      apex: tight * ds,
      s1: i1 * ds,
      dir: k[tight] >= 0 ? 1 : -1,
      radius: 1 / Math.max(1e-9, Math.abs(k[tight])),
    };
  });
}

/** The closed centreline sampled about every `ds` metres. */
export function buildPath(spec: TrackSpec, ds = 2): TrackPath {
  const c: Centreline = spec.centreline;
  const m = c.n;
  const h = c.ds;
  const px = decode(c.x, m);
  const py = decode(c.y, m);
  const pl = decode(c.wl, m);
  const pr = decode(c.wr, m);
  const mx = splineM(px, h);
  const my = splineM(py, h);

  // arc length of each piece (Gauss–Legendre, three points), and where each one starts
  const G = [
    [0.5 - Math.sqrt(0.15), 5 / 18],
    [0.5, 8 / 18],
    [0.5 + Math.sqrt(0.15), 5 / 18],
  ];
  const speed = (i: number, t: number) => {
    evalSpline(px, mx, h, i, t);
    const dx = piece.d1;
    evalSpline(py, my, h, i, t);
    return Math.hypot(dx, piece.d1);
  };
  const cum = new Float64Array(m + 1);
  for (let i = 0; i < m; i++) {
    let len = 0;
    for (const [u, w] of G) len += w * speed(i, u * h) * h;
    cum[i + 1] = cum[i] + len;
  }
  const length = cum[m];
  const n = Math.max(8, Math.round(length / ds));
  const step = length / n;

  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const psi = new Float64Array(n);
  const rawK = new Float64Array(n);
  const wl = new Float64Array(n);
  const wr = new Float64Array(n);
  let i = 0;
  for (let k = 0; k < n; k++) {
    const s = k * step;
    while (i < m - 1 && cum[i + 1] <= s) i++;
    // the parameter within the piece: by its share of the piece's length, then one Newton step
    let t = ((s - cum[i]) / Math.max(1e-9, cum[i + 1] - cum[i])) * h;
    let part = 0;
    for (const [u, w] of G) part += w * speed(i, u * t) * t;
    t -= (part - (s - cum[i])) / Math.max(1e-9, speed(i, t));
    t = Math.max(0, Math.min(h, t));
    evalSpline(px, mx, h, i, t);
    const X = piece.v;
    const dx = piece.d1;
    const ddx = piece.d2;
    evalSpline(py, my, h, i, t);
    const Y = piece.v;
    const dy = piece.d1;
    const ddy = piece.d2;
    x[k] = X;
    y[k] = Y;
    psi[k] = Math.atan2(dy, dx);
    rawK[k] = (dx * ddy - dy * ddx) / Math.max(1e-12, Math.hypot(dx, dy) ** 3);
    const f = t / h;
    const j = (i + 1) % m;
    wl[k] = pl[i] + (pl[j] - pl[i]) * f;
    wr[k] = pr[i] + (pr[j] - pr[i]) * f;
  }
  // unwrap the heading
  for (let k = 1; k < n; k++)
    psi[k] -= Math.round((psi[k] - psi[k - 1]) / (2 * Math.PI)) * 2 * Math.PI;
  // a light binomial smoothing of the curvature over ±2 samples
  const at = (k: number) => rawK[((k % n) + n) % n];
  const curv = new Float64Array(n);
  for (let k = 0; k < n; k++)
    curv[k] = (at(k - 2) + 4 * at(k - 1) + 6 * at(k) + 4 * at(k + 1) + at(k + 2)) / 16;

  const full = Array.from(wl, (l, k) => l + wr[k]).sort((a, b) => a - b);
  return {
    id: spec.id,
    n,
    ds: step,
    length,
    x,
    y,
    psi,
    k: curv,
    wl,
    wr,
    width: full[Math.floor(n / 2)],
    corners: placeCorners(spec.corners, curv, step),
    sectors: [0, ...spec.sectors],
  };
}
