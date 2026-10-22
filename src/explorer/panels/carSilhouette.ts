/**
 * A car's side view for the picker, derived once per spec: the body outline (the detailed
 * model's measured profile, else the procedural shell's), wheels, the engine/motor, gearbox and
 * battery blocks from layoutPowertrain, prop shafts and the CG. SVG coordinates are vehicle
 * millimetres with y flipped (x = vehicle x, front to the right; y = −height), so every card can
 * share one viewBox and sizes compare honestly.
 */
import { listVehicles } from '../../spec/catalog';
import { layoutPowertrain } from '../../spec/derive/layout';
import { massProps } from '../../spec/derive/mass';
import type { PlacedPart, VehicleSpec } from '../../spec/types';
import { DEG } from '../../spec/units';
import { measuredProfile } from '../../vehicle3d/gltf/profile';
import { resolveBody } from '../../vehicle3d/shell/build';
import { makeShape } from '../../vehicle3d/shell/shape';

type P = [number, number];

export type SilPartKind = 'engine' | 'gearbox' | 'motor' | 'battery';

export interface Silhouette {
  /** closed body outline (path data) */
  body: string;
  /** one wheel per axle (the far side hides behind it) */
  wheels: { cx: number; cy: number; r: number; driven: boolean }[];
  /** drawn back to front: battery, gearbox, engine, motors */
  parts: { id: string; kind: SilPartKind; points: string }[];
  props: { x1: number; y1: number; x2: number; y2: number }[];
  cg: P | null;
  /** body outline and both wheels as one path: how this car overlays another */
  ghost: string;
  /** extents in vehicle mm */
  bounds: { x0: number; x1: number; top: number };
}

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const viewBox = (f: Frame) => `${f.x} ${f.y} ${f.w} ${f.h}`;

const r = Math.round;
const pt = ([x, y]: P) => `${r(x)},${r(-y)}`;

/** Top and underside lines, rear to front. */
function outline(v: VehicleSpec): { top: P[]; bottom: P[] } {
  const m = measuredProfile(v.id);
  if (m) return { top: m.top, bottom: m.bottom };
  const { c, p } = resolveBody(v);
  const s = makeShape(c, p);
  const n = Math.max(2, Math.ceil((c.xF - c.xR) / 50));
  const xs = Array.from({ length: n + 1 }, (_, i) => c.xR + ((c.xF - c.xR) * i) / n);
  return { top: xs.map((x) => [x, s.top(x)]), bottom: xs.map((x) => [x, s.bottom(x)]) };
}

/** Andrew's monotone chain. */
export function hull(points: P[]): P[] {
  const ps = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (ps.length < 3) return ps;
  const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: P[]) => {
    const h: P[] = [];
    for (const q of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();
    return h;
  };
  return [...half(ps), ...half([...ps].reverse())];
}

/** The part's box seen from the side: roll about its own X, then yaw (as <Part> applies them). */
export function sideOutline(p: PlacedPart): P[] {
  const half = p.sizeMm.map((s) => s / 2);
  const o = p.boxOffsetMm ?? [0, 0, 0];
  const cr = Math.cos(p.rollDeg * DEG);
  const sr = Math.sin(p.rollDeg * DEG);
  const cy = Math.cos(p.yawDeg * DEG);
  const sy = Math.sin(p.yawDeg * DEG);
  const corners: P[] = [];
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      for (const c of [-1, 1]) {
        const x = o[0] + a * half[0];
        const y = o[1] + b * half[1];
        const z = o[2] + c * half[2];
        const y1 = y * cr - z * sr;
        const z1 = y * sr + z * cr;
        corners.push([p.posMm[0] + x * cy + z1 * sy, p.posMm[1] + y1]);
      }
  return hull(corners);
}

const DRAW_ORDER: SilPartKind[] = ['battery', 'gearbox', 'engine', 'motor'];
const circle = (cx: number, cy: number, rad: number) =>
  `M${r(cx - rad)},${r(cy)}a${r(rad)},${r(rad)} 0 1 0 ${r(2 * rad)},0a${r(rad)},${r(rad)} 0 1 0 ${-r(2 * rad)},0`;

const cache = new WeakMap<VehicleSpec, Silhouette>();

export function silhouette(v: VehicleSpec): Silhouette {
  const hit = cache.get(v);
  if (hit) return hit;
  const { top, bottom } = outline(v);
  const body = `M${[...top, ...[...bottom].reverse()].map(pt).join('L')}Z`;
  const layout = layoutPowertrain(v);
  const wheels = layout.parts
    .filter((p) => p.kind === 'wheel' && p.id.endsWith('-left'))
    .map((p) => ({ cx: p.posMm[0], cy: -p.posMm[1], r: p.sizeMm[0] / 2, driven: !!p.driven }));
  const parts = layout.parts
    .filter((p): p is PlacedPart & { kind: SilPartKind } =>
      (DRAW_ORDER as string[]).includes(p.kind),
    )
    .sort((a, b) => DRAW_ORDER.indexOf(a.kind) - DRAW_ORDER.indexOf(b.kind))
    .map((p) => ({ id: p.id, kind: p.kind, points: sideOutline(p).map(pt).join(' ') }));
  const props = layout.shafts
    .filter((s) => s.kind === 'prop')
    .map((s) => ({
      x1: r(s.fromMm[0]),
      y1: r(-s.fromMm[1]),
      x2: r(s.toMm[0]),
      y2: r(-s.toMm[1]),
    }));
  let cg: P | null = null;
  try {
    const m = massProps(v, layout);
    cg = [r(m.cgMm[0]), r(-m.cgMm[1])];
  } catch {
    // no CG for a spec massProps rejects; the rest still draws
  }
  const xs = [...top, ...bottom].map((q) => q[0]);
  const s: Silhouette = {
    body,
    wheels,
    parts,
    props,
    cg,
    ghost: body + wheels.map((w) => circle(w.cx, w.cy, w.r)).join(''),
    bounds: {
      x0: Math.min(...xs, ...wheels.map((w) => w.cx - w.r)),
      x1: Math.max(...xs, ...wheels.map((w) => w.cx + w.r)),
      top: Math.max(...top.map((q) => q[1]), ...wheels.map((w) => 2 * w.r)),
    },
  };
  cache.set(v, s);
  return s;
}

/** A viewBox around some silhouettes (ground at y = 0 with a little room below for strokes). */
export function frameOf(sils: Silhouette[], pad = 60): Frame {
  const x0 = Math.min(...sils.map((s) => s.bounds.x0)) - pad;
  const x1 = Math.max(...sils.map((s) => s.bounds.x1)) + pad;
  const top = Math.max(...sils.map((s) => s.bounds.top)) + pad;
  return { x: r(x0), y: -r(top), w: r(x1 - x0), h: r(top + pad) };
}

let shared: Frame | null = null;

/** One frame for the whole catalog, front axles aligned: the longest and tallest cars fit. */
export function catalogFrame(): Frame {
  shared ??= frameOf(listVehicles().map(silhouette));
  return shared;
}
