/**
 * A car model reduced to what its outline needs, built once per model and shared by every
 * outline of it: one welded, smooth-shaded shell (for the silhouette, drawn as an inverted hull)
 * and its feature lines (creases, window edges). The wheels are left out: GhostCar draws them as
 * rings. The triangles are gathered here; the welding and edge finding run in a worker, so
 * adding a car to compare never stalls the scene.
 */
import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Uint32BufferAttribute,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { buildOutline, FEATURE, WINDOW, type OutlineData } from './outlineBuild';

/** triangles wholly below this are the model's contact-shadow sheet, not the car (m) */
const GROUND = 0.02;

export interface CarOutline {
  /** welded body + wheels, positions and smooth normals, vehicle frame */
  shell: BufferGeometry;
  /** feature lines as segments, vehicle frame */
  edges: BufferGeometry;
}

const roleOf = (m: Material) => /^apx:([a-z]+):/.exec(m.name)?.[1] ?? 'trim';

/** wheel parts by material name ("koleso" is a wheel in the Russian-made models) */
const WHEELISH = /koleso|wheel|tyre|tire|brake|disc|calip/i;

/** The wheel node ("wheel-front-left"…) an object belongs to, if any. */
function wheelOf(o: Object3D, model: Object3D): Object3D | null {
  for (let p: Object3D | null = o; p && p !== model; p = p.parent)
    if (/^wheel-/.test(p.name)) return p;
  return null;
}

/** Every outer triangle of the model in the vehicle frame (flat), and what lines it may give. */
function gather(model: Object3D): { pos: Float32Array; kind: Uint8Array } {
  model.updateMatrixWorld(true);
  const toCar = new Matrix4().copy(model.matrixWorld).invert();
  // each wheel as a drum (car frame): a body triangle inside one is a wheel part the model
  // kept in its body (a rim under another name), not the body
  const drums: { x: number; y: number; z: number; r2: number; hw: number }[] = [];
  const box = new Box3();
  const c = new Vector3();
  for (const corner of ['front-left', 'front-right', 'rear-left', 'rear-right']) {
    const w = model.getObjectByName(`wheel-${corner}`);
    if (w) {
      box.setFromObject(w).applyMatrix4(toCar).getCenter(c);
      const r = (box.max.y - box.min.y) / 2;
      drums.push({ x: c.x, y: c.y, z: c.z, r2: r * r, hw: (box.max.z - box.min.z) / 2 + 0.03 });
    }
  }
  const inDrum = (x: number, y: number, z: number) =>
    drums.some((d) => (x - d.x) ** 2 + (y - d.y) ** 2 < d.r2 && Math.abs(z - d.z) < d.hw);
  const meshes: { mesh: Mesh; kind: number }[] = [];
  let tris = 0;
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as Material;
    const role = roleOf(mat);
    if (role === 'interior' || /glow|flare/i.test(mat.name)) return;
    // the wheels are drawn as rings from the spec (GhostCar): their spokes outline into a tangle
    // (some models keep wheel or brake parts in the body: those go too)
    if (wheelOf(mesh, model) || role === 'rim' || WHEELISH.test(mat.name)) return;
    meshes.push({ mesh, kind: role === 'glass' ? WINDOW : FEATURE });
    const g = mesh.geometry;
    tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  const pos = new Float32Array(tris * 9);
  const kind = new Uint8Array(tris);
  const m = new Matrix4();
  const v = new Vector3();
  let t = 0;
  for (const { mesh, kind: k } of meshes) {
    const at = mesh.geometry.getAttribute('position');
    const idx = mesh.geometry.getIndex();
    const count = idx ? idx.count : at.count;
    m.multiplyMatrices(toCar, mesh.matrixWorld);
    for (let i = 0; i < count; i += 3) {
      let low = true;
      for (let c = 0; c < 3; c++) {
        v.fromBufferAttribute(at, idx ? idx.getX(i + c) : i + c).applyMatrix4(m);
        pos[t * 9 + c * 3] = v.x;
        pos[t * 9 + c * 3 + 1] = v.y;
        pos[t * 9 + c * 3 + 2] = v.z;
        if (v.y > GROUND) low = false;
      }
      if (low) continue;
      const o = t * 9;
      if (
        inDrum(
          (pos[o] + pos[o + 3] + pos[o + 6]) / 3,
          (pos[o + 1] + pos[o + 4] + pos[o + 7]) / 3,
          (pos[o + 2] + pos[o + 5] + pos[o + 8]) / 3,
        )
      )
        continue;
      kind[t++] = k;
    }
  }
  return { pos: pos.slice(0, t * 9), kind: kind.slice(0, t) };
}

function toGeometry(o: OutlineData): CarOutline {
  const shell = new BufferGeometry();
  shell.setAttribute('position', new Float32BufferAttribute(o.positions, 3));
  shell.setAttribute('normal', new Float32BufferAttribute(o.normals, 3));
  shell.setIndex(new Uint32BufferAttribute(o.index, 1));
  shell.computeBoundingSphere();
  const edges = new BufferGeometry();
  edges.setAttribute('position', new Float32BufferAttribute(o.edges, 3));
  edges.computeBoundingSphere();
  return { shell, edges };
}

let worker: Worker | null | undefined;
let nextJob = 0;
const waiting = new Map<number, (o: OutlineData) => void>();

function build(pos: Float32Array, kind: Uint8Array): Promise<OutlineData> {
  if (worker === undefined) {
    try {
      worker = new Worker(new URL('./outline.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<OutlineData & { id: number }>) => {
        waiting.get(e.data.id)?.(e.data);
        waiting.delete(e.data.id);
      };
    } catch {
      worker = null;
    }
  }
  if (!worker) return Promise.resolve(buildOutline(pos, kind));
  const id = nextJob++;
  const w = worker;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    w.postMessage({ id, pos, kind }, [pos.buffer, kind.buffer]);
  });
}

const cache = new WeakMap<Object3D, Promise<CarOutline>>();

/** The outline geometry of a loaded car model (vehicle frame), built once per model. */
export function carOutline(model: Object3D): Promise<CarOutline> {
  let p = cache.get(model);
  if (!p) {
    const { pos, kind } = gather(model);
    p = build(pos, kind).then(toGeometry);
    cache.set(model, p);
  }
  return p;
}
