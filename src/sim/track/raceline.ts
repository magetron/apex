/**
 * The racing line: the minimum-curvature line within the track's edges, the standard
 * approximation of the fastest line (as in TUM's global race trajectory optimisation): a car's
 * cornering speed grows with the radius it can use, so the line straightens every corner as far
 * as the edges allow, out-in-out.
 *
 * Each centreline sample moves across the track by α (+ left) along its normal; the line
 * minimises the sum of squared second differences of its points, each weighted by its spacing
 * so that the sum is ∫κ² ds (re-weighted a few times as the line settles), a quadratic in α
 * with a cyclic pentadiagonal matrix, subject to the track's edges at each sample (the measured
 * width to the left and to the right of the centreline) less a margin. Solved by
 * projected Newton steps (Bertsekas 1982), each a banded solve for the samples no edge holds.
 * One line per track, for every car.
 */
import type { RaceLine, TrackPath } from './types';

/** how close the car's centre may come to the edge (m): half a car and a little room */
const EDGE_MARGIN = 1.25;
const MAX_ROUNDS = 60;
/** re-weighting passes: the weights follow the line's own spacing */
const PASSES = 6;

/**
 * Solve the cyclic SPD system restricted to `free` (sorted indices), with bandwidth 2 in that
 * order: entry(a, b) gives A[free[a]][free[b]]. Bordered: the last two unknowns are split off,
 * the rest is a plain banded LDLᵀ.
 */
function solveCyclic(
  m: number,
  entry: (a: number, b: number) => number,
  rhs: Float64Array,
): Float64Array {
  const out = new Float64Array(m);
  if (m <= 6) {
    // tiny: dense
    const A = Array.from({ length: m }, (_, a) => Array.from({ length: m }, (_, b) => entry(a, b)));
    const r = Array.from(rhs);
    for (let c = 0; c < m; c++) {
      for (let row = c + 1; row < m; row++) {
        const f = A[row][c] / A[c][c];
        for (let k = c; k < m; k++) A[row][k] -= f * A[c][k];
        r[row] -= f * r[c];
      }
    }
    for (let c = m - 1; c >= 0; c--) {
      let v = r[c];
      for (let k = c + 1; k < m; k++) v -= A[c][k] * out[k];
      out[c] = v / A[c][c];
    }
    return out;
  }
  const nb = m - 2;
  // banded LDLᵀ of B (nb × nb, bandwidth 2): L has two sub-diagonals
  const d = new Float64Array(nb);
  const l1 = new Float64Array(nb);
  const l2 = new Float64Array(nb);
  for (let i = 0; i < nb; i++) {
    const a2 = i >= 2 ? entry(i, i - 2) : 0;
    const a1 = i >= 1 ? entry(i, i - 1) : 0;
    // L[i][i-2], L[i][i-1]
    const li2 = i >= 2 ? a2 / d[i - 2] : 0;
    const li1 = i >= 1 ? (a1 - (i >= 2 ? li2 * d[i - 2] * l1[i - 1] : 0)) / d[i - 1] : 0;
    l2[i] = li2;
    l1[i] = li1;
    d[i] = entry(i, i) - li1 * li1 * (i >= 1 ? d[i - 1] : 0) - li2 * li2 * (i >= 2 ? d[i - 2] : 0);
  }
  const solveB = (b: Float64Array) => {
    const z = new Float64Array(nb);
    for (let i = 0; i < nb; i++)
      z[i] = b[i] - (i >= 1 ? l1[i] * z[i - 1] : 0) - (i >= 2 ? l2[i] * z[i - 2] : 0);
    for (let i = 0; i < nb; i++) z[i] /= d[i];
    for (let i = nb - 1; i >= 0; i--)
      z[i] -= (i + 1 < nb ? l1[i + 1] * z[i + 1] : 0) + (i + 2 < nb ? l2[i + 2] * z[i + 2] : 0);
    return z;
  };
  // C: the coupling of the first nb unknowns with the last two (only near both ends)
  const col = (c: number) => {
    const v = new Float64Array(nb);
    for (let i = 0; i < nb; i++) if (i < 2 || i >= nb - 2) v[i] = entry(i, nb + c);
    return v;
  };
  const c0 = col(0);
  const c1 = col(1);
  const x0 = solveB(c0);
  const x1 = solveB(c1);
  const y = solveB(rhs.subarray(0, nb));
  const dot = (a: Float64Array, b: Float64Array) => {
    let s = 0;
    for (let i = 0; i < nb; i++) s += a[i] * b[i];
    return s;
  };
  // Schur complement (2 × 2)
  const s00 = entry(nb, nb) - dot(c0, x0);
  const s01 = entry(nb, nb + 1) - dot(c0, x1);
  const s11 = entry(nb + 1, nb + 1) - dot(c1, x1);
  const r0 = rhs[nb] - dot(c0, y);
  const r1 = rhs[nb + 1] - dot(c1, y);
  const det = s00 * s11 - s01 * s01;
  const z0 = (r0 * s11 - r1 * s01) / det;
  const z1 = (s00 * r1 - s01 * r0) / det;
  for (let i = 0; i < nb; i++) out[i] = y[i] - x0[i] * z0 - x1[i] * z1;
  out[nb] = z0;
  out[nb + 1] = z1;
  return out;
}

/** The minimum-curvature line within the track (see the header). */
export function raceLine(path: TrackPath, margin = EDGE_MARGIN): RaceLine {
  const { n, x: cx, y: cy, psi } = path;
  const nx = new Float64Array(n);
  const ny = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    nx[i] = -Math.sin(psi[i]);
    ny[i] = Math.cos(psi[i]);
  }
  const at = (i: number) => ((i % n) + n) % n;
  // how far the line may move to the left (+) and the right (−) at each sample
  const hi = new Float64Array(n);
  const lo = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    hi[i] = Math.max(0, path.wl[i] - margin);
    lo[i] = -Math.max(0, path.wr[i] - margin);
  }
  const clampTo = (i: number, v: number) => Math.max(lo[i], Math.min(hi[i], v));
  /** weight of each second difference: 1 / (its spacing)³, so the sum is ∫κ² ds */
  const w = new Float64Array(n).fill(1);
  /** (MᵀWM) by rows: mw[5i + 2 + o] */
  const mw = new Float64Array(5 * n);
  /** H by rows: hh[5i + 2 + o] = H[i][i + o] = (MᵀWM)_{i,i+o} (n_i · n_{i+o}) */
  const hh = new Float64Array(5 * n);
  const g = new Float64Array(n);
  const h = (i: number, j: number) => {
    let o = j - i;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o < -2 || o > 2 ? 0 : hh[5 * i + 2 + o];
  };
  const alpha = new Float64Array(n);
  const grad = new Float64Array(n);
  const step = new Float64Array(n);
  const trial = new Float64Array(n);
  const free = new Int32Array(n);
  /** f(α) = αᵀHα + 2gᵀα, and the half-gradient Hα + g into `into` when asked */
  const cost = (v: Float64Array, into?: Float64Array) => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      let q = 0;
      for (let o = -2; o <= 2; o++) q += hh[5 * i + 2 + o] * v[at(i + o)];
      if (into) into[i] = q + g[i];
      sum += v[i] * (q + 2 * g[i]);
    }
    return sum;
  };

  for (let pass = 0; pass < PASSES; pass++) {
    // the line's spacing as it stands sets the weights (uniform to begin with): a second
    // difference over shorter steps is a tighter curve than the same one over longer steps
    if (pass > 0) {
      for (let i = 0; i < n; i++) {
        const a0 = at(i - 1);
        const b0 = at(i + 1);
        const px = (k: number) => cx[k] + alpha[k] * nx[k];
        const py = (k: number) => cy[k] + alpha[k] * ny[k];
        const l =
          (Math.hypot(px(i) - px(a0), py(i) - py(a0)) +
            Math.hypot(px(b0) - px(i), py(b0) - py(i))) /
          2;
        w[i] = (path.ds / Math.max(1e-3, l)) ** 3;
      }
    }
    for (let i = 0; i < n; i++) {
      const wm = w[at(i - 1)];
      const w0 = w[i];
      const wp = w[at(i + 1)];
      mw[5 * i] = wm;
      mw[5 * i + 1] = -2 * (wm + w0);
      mw[5 * i + 2] = wm + 4 * w0 + wp;
      mw[5 * i + 3] = -2 * (w0 + wp);
      mw[5 * i + 4] = wp;
    }
    for (let i = 0; i < n; i++) {
      let ax = 0;
      let ay = 0;
      for (let o = -2; o <= 2; o++) {
        const j = at(i + o);
        const m = mw[5 * i + 2 + o];
        hh[5 * i + 2 + o] = m * (nx[i] * nx[j] + ny[i] * ny[j]);
        ax += m * cx[j];
        ay += m * cy[j];
      }
      // (a whisker on the diagonal: nearly uniform shifts of a smooth loop are almost free)
      hh[5 * i + 2] += 1e-10;
      g[i] = nx[i] * ax + ny[i] * ay;
    }

    // projected Newton (Bertsekas): a Newton step on the samples no edge holds, a scaled
    // gradient step on the ones held, then a search along the projection onto the track
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const f0 = cost(alpha, grad);
      let gap = 0;
      for (let i = 0; i < n; i++)
        gap = Math.max(gap, Math.abs(clampTo(i, alpha[i] - grad[i]) - alpha[i]));
      if (gap < 1e-6) break;
      const eps = Math.min(0.05, gap);
      let m = 0;
      for (let i = 0; i < n; i++) {
        const bound =
          (alpha[i] <= lo[i] + eps && grad[i] > 0) || (alpha[i] >= hi[i] - eps && grad[i] < 0);
        if (bound) step[i] = -grad[i] / hh[5 * i + 2];
        else free[m++] = i;
      }
      if (m) {
        const rhs = new Float64Array(m);
        for (let k = 0; k < m; k++) rhs[k] = -grad[free[k]];
        const d = solveCyclic(m, (p, q) => h(free[p], free[q]), rhs);
        for (let k = 0; k < m; k++) step[free[k]] = d[k];
      }
      let t = 1;
      for (let ls = 0; ls < 40; ls++, t /= 2) {
        let slope = 0;
        for (let i = 0; i < n; i++) {
          trial[i] = clampTo(i, alpha[i] + t * step[i]);
          slope += grad[i] * (trial[i] - alpha[i]);
        }
        if (cost(trial) <= f0 + 2e-4 * slope) break;
      }
      alpha.set(trial);
    }
  }

  // the line itself, its heading and curvature
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = cx[i] + alpha[i] * nx[i];
    y[i] = cy[i] + alpha[i] * ny[i];
  }
  const seg = new Float64Array(n);
  let length = 0;
  for (let i = 0; i < n; i++) {
    const j = at(i + 1);
    seg[i] = Math.hypot(x[j] - x[i], y[j] - y[i]);
    length += seg[i];
  }
  const rawK = new Float64Array(n);
  const heading = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = at(i - 1);
    const b = at(i + 1);
    const ux = x[i] - x[a];
    const uy = y[i] - y[a];
    const vx = x[b] - x[i];
    const vy = y[b] - y[i];
    // Menger curvature of three points: 2·sin(turn) / chord
    const cross = ux * vy - uy * vx;
    const la = Math.hypot(ux, uy);
    const lb = Math.hypot(vx, vy);
    const lc = Math.hypot(x[b] - x[a], y[b] - y[a]);
    rawK[i] = la * lb * lc > 0 ? (2 * cross) / (la * lb * lc) : 0;
    heading[i] = Math.atan2(y[b] - y[a], x[b] - x[a]);
  }
  // a light binomial smoothing: the active set leaves small kinks where the edge lets go
  const k = new Float64Array(n);
  for (let i = 0; i < n; i++)
    k[i] =
      (rawK[at(i - 2)] +
        4 * rawK[at(i - 1)] +
        6 * rawK[i] +
        4 * rawK[at(i + 1)] +
        rawK[at(i + 2)]) /
      16;
  // unwrap the heading so it follows the centreline's
  for (let i = 0; i < n; i++) {
    const d = heading[i] - psi[i];
    heading[i] -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  }
  return { n, x, y, psi: heading, k, offset: alpha, seg, length };
}
