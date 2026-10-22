/** Shared unit geometries (scaled per mesh) and small placement helpers, metres. */
import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  LatheGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { Vec3 } from '../spec/types';

export const G = {
  box: new BoxGeometry(1, 1, 1),
  /** radius 1, height 1, axis +Y */
  cyl: new CylinderGeometry(1, 1, 1, 24),
  cylLo: new CylinderGeometry(1, 1, 1, 10),
  /** open tube (rim barrels, exhaust tips) */
  tube: new CylinderGeometry(1, 1, 1, 32, 1, true),
  sphere: new SphereGeometry(1, 20, 14),
  sphereLo: new SphereGeometry(1, 10, 8),
  capsule: new CapsuleGeometry(1, 1, 4, 10),
  torus: new TorusGeometry(1, 0.08, 8, 40),
};

const UP = new Vector3(0, 1, 0);

/** Position/rotation/length that stretch a +Y unit cylinder from a to b. */
export function span(a: Vec3, b: Vec3): { position: Vec3; quaternion: Quaternion; length: number } {
  const va = new Vector3(...a);
  const vb = new Vector3(...b);
  const d = vb.clone().sub(va);
  const length = d.length();
  const quaternion = new Quaternion().setFromUnitVectors(UP, length > 1e-9 ? d.normalize() : UP);
  const m = va.add(vb).multiplyScalar(0.5);
  return { position: [m.x, m.y, m.z], quaternion, length };
}

const lathes = new Map<string, LatheGeometry>();
/** Cached lathe (profile in [radius, y] pairs), axis +Y. */
export function lathe(key: string, profile: [number, number][], segments = 32): LatheGeometry {
  let g = lathes.get(key);
  if (!g) {
    g = new LatheGeometry(
      profile.map(([r, y]) => new Vector2(r, y)),
      segments,
    );
    lathes.set(key, g);
  }
  return g;
}

/** CV-joint boot: a short ribbed cone, unit length along +Y, radius ~1 at the wide end. */
export const cvBoot = lathe('cv', [
  [0.001, -0.5],
  [1, -0.5],
  [1, -0.32],
  [0.78, -0.22],
  [0.9, -0.12],
  [0.62, 0],
  [0.74, 0.1],
  [0.46, 0.22],
  [0.55, 0.32],
  [0.38, 0.5],
  [0.001, 0.5],
]);
