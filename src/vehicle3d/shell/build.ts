/**
 * Builds (and caches) everything the body shell needs for one vehicle: tuned params → shape →
 * geometry. Per-car tuning files in ../bodies/<vehicle-id>.ts are discovered automatically.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { Vec3, VehicleSpec } from '../../spec/types';
import { measuredProfile } from '../gltf/profile';
import { bodyContext, defaultParams } from './defaults';
import { defaultDecals } from './decals';
import { decalMeshes, lipMesh, shellMesh } from './mesh';
import { makeShape, type BodyShape } from './shape';
import type { BodyContext, BodyParams, BodyTuning, DecalMat } from './types';

const found = import.meta.glob<BodyTuning>('../bodies/*.ts', { eager: true, import: 'default' });
const TUNING = new Map<string, BodyTuning>(
  Object.entries(found).map(([path, t]) => [path.replace(/^.*\/|\.ts$/g, ''), t]),
);

export const hasTuning = (id: string) => TUNING.has(id);

export function resolveBody(v: VehicleSpec): { c: BodyContext; p: BodyParams } {
  const c = bodyContext(v);
  let p = defaultParams(c);
  const tune = TUNING.get(v.id);
  if (tune) p = { ...p, ...tune(c, p) };
  // a car wearing a detailed model takes that model's measured outline over any guess or trace
  const m = measuredProfile(v.id);
  if (m)
    p = {
      ...p,
      top: m.top,
      belt: m.belt,
      bottom: m.bottom,
      plan: m.plan,
      ...(m.cabin && { cabin: m.cabin }),
      ...(m.roofHalf && { roofHalf: m.roofHalf }),
    };
  c.wheels = c.wheels.map((w) => ({ ...w, archR: w.tyreR + p.archGap }));
  return { c, p };
}

export interface Shell {
  shape: BodyShape;
  body: BufferGeometry;
  wells: BufferGeometry;
  /** x-ray feature lines + glass/lamp outlines (LineSegments) */
  lines: BufferGeometry;
  decals: Map<DecalMat, BufferGeometry>;
  lips: BufferGeometry | null;
  /** metres, vehicle frame */
  mirrors: { pos: Vec3; scale: Vec3; root: Vec3 }[];
  tips: { pos: Vec3; r: number; w: number }[];
  spare: { pos: Vec3; r: number } | null;
  rails: { from: Vec3; to: Vec3 }[];
}

const cache = new Map<string, Shell>();

export function buildShell(v: VehicleSpec): Shell {
  const { c, p } = resolveBody(v);
  const s = makeShape(c, p);
  const { body, wells, lines } = shellMesh(s);
  const decals = decalMeshes(s, p.decals(s, defaultDecals(s)));
  const lineGeo = new BufferGeometry();
  const all = new Float32Array(lines.length + decals.outlines.length);
  all.set(lines, 0);
  all.set(decals.outlines, lines.length);
  lineGeo.setAttribute('position', new Float32BufferAttribute(all, 3));

  const M = 0.001;
  const mirrors: Shell['mirrors'] = [];
  if (p.mirrors) {
    const x = p.mirrors.x;
    const yb = s.belt(x);
    const zs = Math.max(0, s.outerZ(x, yb - 25));
    for (const sgn of [1, -1]) {
      mirrors.push({
        pos: [x * M, (yb + p.mirrors.dy) * M, sgn * (zs + 105) * M],
        scale: [0.06, 0.068, 0.105],
        root: [(x + 30) * M, (yb + 25) * M, sgn * (zs - 10) * M],
      });
    }
  }
  const tips = p.exhaust.map((t) => {
    const x = s.endX(t.y, t.z, 'rear') ?? c.xR;
    return { pos: [(x + 15) * M, t.y * M, t.z * M] as Vec3, r: t.r * M, w: t.w ?? 1 };
  });
  let spare: Shell['spare'] = null;
  if (p.spare) {
    const y = 0.56 * c.H;
    const x = s.endX(y, 0, 'rear') ?? c.xR;
    spare = { pos: [(x - c.R * 0.32) * M, y * M, 0], r: c.R * 0.98 * M };
  }
  const rails: Shell['rails'] = [];
  if (p.rails) {
    const x0 = p.cabin[1] - 0.18 * (p.cabin[1] - p.cabin[0]);
    const x1 = p.cabin[0] + 0.12 * (p.cabin[1] - p.cabin[0]);
    for (const sgn of [1, -1]) {
      const z0 = s.ghHalfW(x0) - 70;
      const z1 = s.ghHalfW(x1) - 70;
      rails.push({
        from: [x0 * M, (s.roofEdge(x0) + 45) * M, sgn * z0 * M],
        to: [x1 * M, (s.roofEdge(x1) + 45) * M, sgn * z1 * M],
      });
    }
  }
  return {
    shape: s,
    body,
    wells,
    lines: lineGeo,
    decals: decals.byMat,
    lips: lipMesh(s),
    mirrors,
    tips,
    spare,
    rails,
  };
}

/** Cached per vehicle id (shells are a few tens of ms to build; switching back is instant). */
export function getShell(v: VehicleSpec): Shell {
  const key = `${v.id}|${v.dims.lengthMm}|${v.dims.widthMm}|${v.dims.heightMm}|${v.dims.wheelbaseMm}`;
  let sh = cache.get(key);
  if (!sh) {
    sh = buildShell(v);
    cache.set(key, sh);
  }
  return sh;
}
