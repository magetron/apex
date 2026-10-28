import { CameraControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Box3, Matrix4, Vector3, type InstancedMesh, type Mesh, type Object3D } from 'three';
import { useScene, type Controls } from './store';

/** Explicit shots are framed for a ~16:9 view; narrower (portrait/phone) views back off. */
const DESIGN_ASPECT = 1.6;

/** Orbit controls; publishes itself to the store and plays explicit camera shots. */
export function CameraRig() {
  const ref = useRef<Controls>(null);
  const shot = useScene((s) => s.shot);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));

  useEffect(() => {
    useScene.setState({ controls: ref.current });
    return () => useScene.setState({ controls: null });
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c || !shot) return;
    const k = Math.max(1, DESIGN_ASPECT / aspect) ** 0.8;
    const [px, py, pz] = shot.position;
    const [tx, ty, tz] = shot.target;
    void c.setLookAt(
      tx + (px - tx) * k,
      ty + (py - ty) * k,
      tz + (pz - tz) * k,
      tx,
      ty,
      tz,
      shot.animate ?? true,
    );
  }, [shot, aspect]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={0.25}
      maxDistance={60}
      maxPolarAngle={Math.PI * 0.495}
      smoothTime={0.45}
      dollySpeed={0.5}
    />
  );
}

export interface FrameOptions {
  /** horizontal angle around the target (rad); default keeps the current one */
  azimuth?: number;
  /** angle down from vertical (rad); default keeps the current one */
  polar?: number;
  /** extra room around the object, as a fraction of its size */
  padding?: number;
  /**
   * The part of the view to fill, in normalized device coordinates [x0, y0, x1, y1] (what the
   * HUD leaves free); the object's outline is fitted into it. Without it, the bounding sphere is
   * framed at the centre (a distance that holds whatever the angle, for the drive chase).
   */
  window?: readonly [number, number, number, number];
}

const UP = new Vector3(0, 1, 0);

const corners = (b: Box3) =>
  [0, 1, 2, 3, 4, 5, 6, 7].map(
    (k) =>
      new Vector3(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z),
  );

/**
 * Where to put the camera so `box` fills the view from (azimuth, polar): the orbit target and
 * the distance to it along that direction. With a window, the outline that is fitted is that of
 * `points` (the shape's own, e.g. sampled vertices) or else the box's corners, which from above
 * stand far outside a car's. Pure, for the rig and its tests.
 */
export function fitBox(
  box: Box3,
  az: number,
  polar: number,
  fovDeg: number,
  aspect: number,
  o: Pick<FrameOptions, 'padding' | 'window'> = {},
  points: Vector3[] = corners(box),
): { target: Vector3; dist: number } {
  const center = box.getCenter(new Vector3());
  // the sphere over-estimates elongated things like cars; 0.8 of it frames them snugly
  const radius = box.getSize(new Vector3()).length() * 0.5 * 0.8;
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const tanH = tanV * aspect;
  const pad = 1 + (o.padding ?? 0.2);
  const sphereDist = radius / Math.sin(Math.atan(Math.min(tanV, tanH)));
  let dist = o.window ? sphereDist : sphereDist * pad;
  const dir = new Vector3(
    Math.sin(polar) * Math.sin(az),
    Math.cos(polar),
    Math.sin(polar) * Math.cos(az),
  );
  if (o.window) {
    // fit the projected outline into the window: centre it there (move the target across the
    // view) and size it (the distance), a few rounds as perspective shifts both
    const [x0, y0, x1, y1] = o.window;
    const f = dir.clone().negate();
    const r = new Vector3().crossVectors(f, UP).normalize();
    const u = new Vector3().crossVectors(r, f);
    const p = new Vector3();
    for (let i = 0; i < 8; i++) {
      let lx = Infinity;
      let hx = -Infinity;
      let ly = Infinity;
      let hy = -Infinity;
      for (const q of points) {
        p.copy(q).sub(center).addScaledVector(dir, -dist);
        const z = Math.max(1e-3, p.dot(f));
        const sx = p.dot(r) / (z * tanH);
        const sy = p.dot(u) / (z * tanV);
        lx = Math.min(lx, sx);
        hx = Math.max(hx, sx);
        ly = Math.min(ly, sy);
        hy = Math.max(hy, sy);
      }
      center
        .addScaledVector(r, ((lx + hx - x0 - x1) / 2) * dist * tanH)
        .addScaledVector(u, ((ly + hy - y0 - y1) / 2) * dist * tanV);
      dist *= Math.max((hx - lx) / (x1 - x0), (hy - ly) / (y1 - y0)) * pad;
      dist = Math.max(dist, radius * 0.5);
    }
  }
  return { target: center, dist };
}

/** Up to ~20k world-space vertices of the visible meshes under `objs`, spread evenly. */
function outline(objs: Object3D[]): Vector3[] | undefined {
  const meshes: Mesh[] = [];
  let total = 0;
  for (const o of objs)
    o.traverseVisible((x) => {
      const m = x as Mesh;
      const pos = m.isMesh ? m.geometry.getAttribute('position') : undefined;
      if (!pos) return;
      meshes.push(m);
      total += pos.count * ((m as InstancedMesh).isInstancedMesh ? (m as InstancedMesh).count : 1);
    });
  if (!total) return undefined;
  const step = Math.max(1, Math.ceil(total / 20000));
  const out: Vector3[] = [];
  const M = new Matrix4();
  for (const m of meshes) {
    const pos = m.geometry.getAttribute('position');
    const inst = (m as InstancedMesh).isInstancedMesh ? (m as InstancedMesh) : null;
    // an instanced part (valves, pistons) is one geometry placed by each instance's matrix
    for (let k = 0; k < (inst ? inst.count : 1); k++) {
      if (inst) {
        inst.getMatrixAt(k, M);
        M.premultiply(m.matrixWorld);
      } else M.copy(m.matrixWorld);
      for (let i = 0; i < pos.count; i += step)
        out.push(new Vector3().fromBufferAttribute(pos, i).applyMatrix4(M));
    }
  }
  return out;
}

/**
 * Fly the camera so `obj` fills the view from a given angle (aspect-aware). Never camera-controls'
 * fitToBox, which snaps the view to the nearest box face.
 */
export async function frameObject(obj: Object3D | Object3D[], o: FrameOptions = {}) {
  const c = useScene.getState().controls;
  if (!c) return;
  const box = new Box3();
  for (const x of Array.isArray(obj) ? obj : [obj]) {
    // ancestors too: a parent moved since the last render (the car back from the drive road)
    x.updateWorldMatrix(true, true);
    box.union(new Box3().setFromObject(x));
  }
  if (box.isEmpty()) return;
  const cam = c.camera as { fov?: number; aspect?: number };
  const az = o.azimuth ?? c.azimuthAngle;
  const polar = o.polar ?? c.polarAngle;
  const { target: t, dist } = fitBox(
    box,
    az,
    polar,
    cam.fov ?? 35,
    cam.aspect ?? 1.6,
    o,
    o.window ? outline(Array.isArray(obj) ? obj : [obj]) : undefined,
  );
  await c.setLookAt(
    t.x + dist * Math.sin(polar) * Math.sin(az),
    t.y + dist * Math.cos(polar),
    t.z + dist * Math.sin(polar) * Math.cos(az),
    t.x,
    t.y,
    t.z,
    true,
  );
}
