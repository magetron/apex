/**
 * Reference paths on the ground (x, n): built from straights, arcs and smooth lane shifts,
 * stored as a dense polyline so the driver can project onto any shape cheaply.
 */

export type Piece =
  | { kind: 'line'; len: number }
  /** angle > 0 turns left */
  | { kind: 'arc'; radius: number; angle: number }
  /** sideways shift by `offset` (m, + = left) over `len`, cycloid profile (smooth curvature) */
  | { kind: 'shift'; len: number; offset: number };

export interface PathPoint {
  x: number;
  n: number;
  /** heading (rad) */
  h: number;
  /** curvature (1/m, + = left) */
  k: number;
}

export class Path {
  readonly xs: Float64Array;
  readonly ns: Float64Array;
  readonly hs: Float64Array;
  readonly ks: Float64Array;
  readonly count: number;
  readonly spacing: number;
  readonly length: number;

  private constructor(xs: number[], ns: number[], hs: number[], ks: number[], spacing: number) {
    this.xs = Float64Array.from(xs);
    this.ns = Float64Array.from(ns);
    this.hs = Float64Array.from(hs);
    this.ks = Float64Array.from(ks);
    this.count = xs.length;
    this.spacing = spacing;
    this.length = (xs.length - 1) * spacing;
  }

  static build(pieces: Piece[], start = { x: 0, n: 0, h: 0 }, spacing = 0.5): Path {
    const xs = [start.x];
    const ns = [start.n];
    const hs = [start.h];
    const ks = [0];
    let x = start.x;
    let n = start.n;
    let h = start.h;
    const push = (k: number) => {
      x += Math.cos(h) * spacing;
      n += Math.sin(h) * spacing;
      xs.push(x);
      ns.push(n);
      hs.push(h);
      ks.push(k);
    };
    for (const pc of pieces) {
      if (pc.kind === 'line') {
        for (let i = 0, c = Math.round(pc.len / spacing); i < c; i++) push(0);
      } else if (pc.kind === 'arc') {
        const k = Math.sign(pc.angle) / pc.radius;
        const c = Math.round((pc.radius * Math.abs(pc.angle)) / spacing);
        for (let i = 0; i < c; i++) {
          // midpoint heading keeps the polyline on the true arc
          h += (k * spacing) / 2;
          push(k);
          h += (k * spacing) / 2;
        }
      } else {
        // cycloid y(u) = d·(u/l − sin(2πu/l)/2π): zero slope AND zero curvature at both ends
        const c = Math.round(pc.len / spacing);
        const h0 = h;
        const w = (2 * Math.PI) / pc.len;
        for (let i = 0; i < c; i++) {
          const u = (i + 0.5) * (pc.len / c);
          const slope = (pc.offset / pc.len) * (1 - Math.cos(w * u));
          const curv = ((pc.offset / pc.len) * w * Math.sin(w * u)) / (1 + slope * slope) ** 1.5;
          h = h0 + Math.atan(slope);
          push(curv);
        }
        h = h0;
      }
    }
    return new Path(xs, ns, hs, ks, spacing);
  }

  /** Point at arc length s (clamped to the path), interpolated. Writes into `out`. */
  at(s: number, out: PathPoint): PathPoint {
    const f = Math.min(this.count - 1.000001, Math.max(0, s / this.spacing));
    const i = Math.floor(f);
    const w = f - i;
    out.x = this.xs[i] + (this.xs[i + 1] - this.xs[i]) * w;
    out.n = this.ns[i] + (this.ns[i + 1] - this.ns[i]) * w;
    out.h = this.hs[i] + (this.hs[i + 1] - this.hs[i]) * w;
    out.k = this.ks[i + 1];
    return out;
  }

  /** Arc length of the path point nearest (x, n), searching forward from `hint` (paths may loop). */
  project(x: number, n: number, hint: number): number {
    let i = Math.min(this.count - 2, Math.max(0, Math.round(hint / this.spacing)));
    const d2 = (j: number) => (this.xs[j] - x) ** 2 + (this.ns[j] - n) ** 2;
    // walk downhill on distance; a car never moves more than a few nodes per step
    for (let guard = 0; guard < 400; guard++) {
      if (i + 1 < this.count && d2(i + 1) < d2(i)) i++;
      else if (i > 0 && d2(i - 1) < d2(i)) i--;
      else break;
    }
    // refine on the neighbouring segment
    const j = i + 1 < this.count ? i : i - 1;
    const sx = this.xs[j + 1] - this.xs[j];
    const sn = this.ns[j + 1] - this.ns[j];
    const t = Math.min(
      1,
      Math.max(0, ((x - this.xs[j]) * sx + (n - this.ns[j]) * sn) / (sx * sx + sn * sn)),
    );
    return (j + t) * this.spacing;
  }

  /** Signed lateral distance of (x, n) from the path at arc length s (+ = left of the path). */
  lateral(x: number, n: number, s: number, tmp: PathPoint): number {
    this.at(s, tmp);
    return -Math.sin(tmp.h) * (x - tmp.x) + Math.cos(tmp.h) * (n - tmp.n);
  }
}

/** Ground point offset sideways from the path (+ = left), e.g. for cones. */
export function offsetPoint(
  path: Path,
  s: number,
  lateral: number,
  tmp: PathPoint,
): [number, number] {
  path.at(s, tmp);
  return [tmp.x - Math.sin(tmp.h) * lateral, tmp.n + Math.cos(tmp.h) * lateral];
}
