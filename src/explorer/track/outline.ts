/**
 * A circuit's outline for the HUD (the track cards, the mini-map): its centreline turned the way
 * its usual map is drawn, in screen units (y down), fitted into a box.
 */
import type { TrackPath } from '../../sim/track';

export interface Outline {
  /** SVG path data of the closed centreline */
  d: string;
  /** a centreline sample's position in the box (y down) */
  at: (i: number, out: { x: number; y: number }) => { x: number; y: number };
  /** any ground point (sim frame, m) in the box */
  project: (x: number, y: number, out: { x: number; y: number }) => { x: number; y: number };
  w: number;
  h: number;
  /** box units per metre */
  scale: number;
}

/** Outline fitted into `size` units (the longer side), with `pad` units round it. */
export function outline(path: TrackPath, headingDeg: number, size = 100, pad = 4): Outline {
  const h = (headingDeg * Math.PI) / 180;
  const c = Math.cos(h);
  const s = Math.sin(h);
  const n = path.n;
  const u = new Float64Array(n);
  const v = new Float64Array(n);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (let i = 0; i < n; i++) {
    u[i] = path.x[i] * c - path.y[i] * s;
    // y down on screen
    v[i] = -(path.x[i] * s + path.y[i] * c);
    u0 = Math.min(u0, u[i]);
    u1 = Math.max(u1, u[i]);
    v0 = Math.min(v0, v[i]);
    v1 = Math.max(v1, v[i]);
  }
  const scale = (size - 2 * pad) / Math.max(u1 - u0, v1 - v0);
  const w = (u1 - u0) * scale + 2 * pad;
  const hh = (v1 - v0) * scale + 2 * pad;
  const X = (i: number) => (u[i] - u0) * scale + pad;
  const Y = (i: number) => (v[i] - v0) * scale + pad;
  const step = Math.max(1, Math.floor(n / 400));
  let d = `M${X(0).toFixed(1)} ${Y(0).toFixed(1)}`;
  for (let i = step; i < n; i += step) d += `L${X(i).toFixed(1)} ${Y(i).toFixed(1)}`;
  d += 'Z';
  return {
    d,
    w,
    h: hh,
    scale,
    project: (x, y, out) => {
      out.x = (x * c - y * s - u0) * scale + pad;
      out.y = (-(x * s + y * c) - v0) * scale + pad;
      return out;
    },
    at: (i, out) => {
      const j = ((Math.floor(i) % n) + n) % n;
      const k = (j + 1) % n;
      const f = i - Math.floor(i);
      out.x = X(j) + (X(k) - X(j)) * f;
      out.y = Y(j) + (Y(k) - Y(j)) * f;
      return out;
    },
  };
}

/** SVG path data for the stretch of an outline between two samples. */
export function stretch(o: Outline, from: number, to: number, n: number): string {
  const p = { x: 0, y: 0 };
  const step = Math.max(1, Math.floor(n / 400));
  o.at(from, p);
  let d = `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  for (let i = from + step; i < to; i += step) {
    o.at(i, p);
    d += `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  o.at(to % n, p);
  return `${d}L${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
}
