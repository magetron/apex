/**
 * Small geometry toolkit for the procedural engine and motor. Everything is built in
 * millimetres in the engine-local frame and scaled to metres once per merged geometry.
 *
 * 2D outlines live in the engine YZ plane as [y, z] pairs (angles from +Y toward +Z, the crank
 * convention), and are extruded along +X.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Path,
  Shape,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type YZ = [number, number];
export type V3 = [number, number, number];

export const MM = 1e-3;

/** Merge geometries with mixed index/attribute layouts into one non-indexed geometry. */
export function merge(parts: BufferGeometry[]): BufferGeometry {
  if (parts.length === 0) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(0), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(0), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(0), 2));
    return g;
  }
  const list = parts.map((g) => {
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    for (const name of Object.keys(flat.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') flat.deleteAttribute(name);
    }
    if (!flat.attributes.normal) flat.computeVertexNormals();
    if (!flat.attributes.uv) {
      flat.setAttribute(
        'uv',
        new BufferAttribute(new Float32Array(flat.attributes.position.count * 2), 2),
      );
    }
    flat.morphAttributes = {};
    return flat;
  });
  const out = mergeGeometries(list, false);
  for (const g of list) g.dispose();
  if (!out) throw new Error('engine3d: geometry merge failed');
  return out;
}

/** Merge (mm) and scale to scene metres. */
export function mergeM(parts: BufferGeometry[]): BufferGeometry {
  const g = merge(parts);
  g.scale(MM, MM, MM);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** A cylinder along X from x0 to x1, centred on (y, z). */
export function cylX(
  r: number,
  x0: number,
  x1: number,
  segs = 20,
  y = 0,
  z = 0,
  open = false,
): BufferGeometry {
  const g = new CylinderGeometry(r, r, Math.max(1e-3, Math.abs(x1 - x0)), segs, 1, open);
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, z);
  return g;
}

/** A cylinder along +Y from y0 to y1 (local frames of pistons, valves, rods). */
export function cylY(
  r: number,
  y0: number,
  y1: number,
  segs = 16,
  open = false,
  rTop = r,
): BufferGeometry {
  const g = new CylinderGeometry(rTop, r, Math.max(1e-3, y1 - y0), segs, 1, open);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

function trace(pts: YZ[], s: Shape | Path) {
  pts.forEach(([y, z], k) => (k === 0 ? s.moveTo(-z, y) : s.lineTo(-z, y)));
  s.closePath();
}

export interface ExtrudeOpts {
  holes?: YZ[][];
  bevel?: number;
  bevelSegments?: number;
}

/**
 * Extrude a closed YZ outline along X between x0 and x1. The shape's (x, y) is (-z, y) so a
 * proper rotation (no mirroring, normals stay outward) carries the extrusion axis onto +X.
 */
export function extrudeYZ(
  outline: YZ[],
  x0: number,
  x1: number,
  o: ExtrudeOpts = {},
): BufferGeometry {
  const shape = new Shape();
  trace(outline, shape);
  for (const h of o.holes ?? []) {
    const p = new Path();
    trace(h, p);
    shape.holes.push(p);
  }
  const len = Math.abs(x1 - x0);
  const b = Math.min(o.bevel ?? 0, len * 0.3);
  const g = new ExtrudeGeometry(shape, {
    depth: Math.max(1e-3, len - 2 * b),
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelOffset: -b,
    bevelSegments: o.bevelSegments ?? 2,
    curveSegments: 1,
  });
  g.rotateY(Math.PI / 2);
  g.translate(Math.min(x0, x1) + b, 0, 0);
  return g;
}

/** Points on a circle in the YZ plane. */
export function circle(cy: number, cz: number, r: number, n = 24, phase = 0): YZ[] {
  return Array.from({ length: n }, (_, k) => {
    const a = phase + (2 * Math.PI * k) / n;
    return [cy + r * Math.cos(a), cz + r * Math.sin(a)] as YZ;
  });
}

const cross = (o: YZ, a: YZ, b: YZ) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Convex hull (Andrew's monotone chain), counter-clockwise in (y, z). */
export function hull(points: YZ[]): YZ[] {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lower: YZ[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0)
      lower.pop();
    lower.push(q);
  }
  const upper: YZ[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0)
      upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Signed area in (y, z); > 0 when the outline runs from +Y toward +Z (the crank's angle sense). */
export function signedArea(pts: YZ[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [y0, z0] = pts[i];
    const [y1, z1] = pts[(i + 1) % pts.length];
    a += y0 * z1 - y1 * z0;
  }
  return a / 2;
}

/** Spur-gear / sprocket outline around (cy, cz). */
export function gear(r: number, teeth: number, depth: number, phase = 0, cy = 0, cz = 0): YZ[] {
  const pts: YZ[] = [];
  const step = (2 * Math.PI) / teeth;
  const at = (a: number, rr: number): YZ => [cy + rr * Math.cos(a), cz + rr * Math.sin(a)];
  for (let k = 0; k < teeth; k++) {
    const a = phase + k * step;
    pts.push(at(a - step * 0.5, r - depth));
    pts.push(at(a - step * 0.22, r - depth));
    pts.push(at(a - step * 0.12, r));
    pts.push(at(a + step * 0.12, r));
    pts.push(at(a + step * 0.22, r - depth));
  }
  return pts;
}

/** Rounded rectangle centred on (cy, cz) in the YZ plane. */
export function roundedRect(
  cy: number,
  cz: number,
  hy: number,
  hz: number,
  rad: number,
  n = 4,
): YZ[] {
  const r = Math.min(rad, hy, hz);
  const pts: YZ[] = [];
  const corners: [number, number, number][] = [
    [cy + hy - r, cz + hz - r, 0],
    [cy - hy + r, cz + hz - r, 1],
    [cy - hy + r, cz - hz + r, 2],
    [cy + hy - r, cz - hz + r, 3],
  ];
  for (const [y, z, q] of corners) {
    for (let k = 0; k <= n; k++) {
      const a = (q + k / n) * (Math.PI / 2);
      pts.push([y + r * Math.cos(a), z + r * Math.sin(a)]);
    }
  }
  return pts;
}

export const v3add = (a: V3, b: V3, k = 1): V3 => [
  a[0] + b[0] * k,
  a[1] + b[1] * k,
  a[2] + b[2] * k,
];
export const v3sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const v3len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const v3norm = (a: V3): V3 => {
  const l = v3len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const yzNorm = (a: YZ): YZ => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
