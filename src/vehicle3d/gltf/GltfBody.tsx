/**
 * Detailed glTF body + wheels (see manifest.ts). The converter already put the model in the
 * vehicle frame (front axle x = 0, ground y = 0) and named its materials "apx:<role>:…", so:
 *  - car/drive: the model as its artist made it. The one exception is a body paint the export
 *    left untextured: its colour lived in the original game and comes out black, so it takes the
 *    car's own colour from the spec. Textured paint and everything else stay native.
 *  - inside: every body mesh in the shared x-ray ghost (the interior hidden), so the drivetrain
 *    shows through exactly as it does with the procedural shell
 */
import { useEffect, useMemo, useRef } from 'react';
import {
  MeshStandardMaterial,
  BufferAttribute,
  BufferGeometry,
  Group,
  Vector3,
  type Material,
  type Mesh,
} from 'three';
import type { Vec3 } from '../../spec/types';
import { sysMat } from '../../scene/materials';
import { bodyGhost, drivenMat } from '../materials';
import { useSpin } from '../spin';
import { markReady, useCarModel } from './load';
import { gltfUrl } from './manifest';

const roleOf = (m: Material) => /^apx:([a-z]+):/.exec(m.name)?.[1] ?? 'trim';

/** Lamp lenses: the converter tints all glass like the windows, which blacks out the lamps. */
const LENS = /^apx:glass:.*(light|lamp|lens|head|tail|indicator|fog)/i;
const lenses = new WeakMap<Material, Material>();
function lensOf(mat: MeshStandardMaterial): Material {
  let l = lenses.get(mat);
  if (!l) {
    const c = mat.clone();
    c.color.set('#eef3f6');
    c.opacity = 0.12;
    lenses.set(mat, (l = c));
  }
  return l;
}

/**
 * Many models carry a contact-shadow sheet a few mm above the road. Our sun casts the car's
 * shadow, and the sheet z-fights the road (flicker, worst from the drive camera), so drop every
 * triangle lying wholly within 20 mm of the ground. One copy per source geometry.
 */
const noSheet = new WeakMap<BufferGeometry, BufferGeometry>();
function withoutGroundSheet(m: Mesh): BufferGeometry {
  const geo = m.geometry;
  let out = noSheet.get(geo);
  if (out) return out;
  const flat = geo.index ? geo.toNonIndexed() : geo;
  const pos = flat.attributes.position;
  // positions are quantised: the mesh's own transform turns them back into metres
  m.updateMatrix();
  const e = m.matrix.elements;
  const y = (i: number) => e[1] * pos.getX(i) + e[5] * pos.getY(i) + e[9] * pos.getZ(i) + e[13];
  const keep: number[] = [];
  for (let t = 0; t < pos.count; t += 3)
    if (Math.max(y(t), y(t + 1), y(t + 2)) > 0.02) keep.push(t);
  if (keep.length * 3 === pos.count) out = geo;
  else {
    out = new BufferGeometry();
    for (const [k, attr] of Object.entries(flat.attributes)) {
      const n = attr.itemSize;
      const src = attr.array as Float32Array;
      const arr = new (src.constructor as Float32ArrayConstructor)(keep.length * 3 * n);
      keep.forEach((t, i) => arr.set(src.subarray(t * n, (t + 3) * n), i * 3 * n));
      out.setAttribute(k, new BufferAttribute(arr, n, attr.normalized));
    }
  }
  noSheet.set(geo, out);
  return out;
}

const rubber = new MeshStandardMaterial({
  name: 'apx:tyre:rubber',
  color: '#1c1c1e',
  roughness: 0.9,
});

/** Number plates carry the source game's branding: show them blank. */
const blankPlate = new MeshStandardMaterial({
  name: 'apx:badge:plate',
  color: '#e9e9e4',
  roughness: 0.5,
});

/** the untextured body paint whose colour the export lost ('Paint_Material', 'Kuzov…') */
const LOST_PAINT = /^apx:paint:.*(paint|body|kuzov|colou?r)/i;
/** …but a paint named for its own finish keeps it (satin-black trim, piano black, a cloth top) */
const OWN_FINISH = /black|trim|satin|piano|opaque|cloth|chrome/i;
/** a light-glow card: a halo on black (with its texture), meant to be added over the lamp */
const GLOW_CARD = /glow|flare/i;

export function GltfBody({
  id,
  paint,
  exterior,
}: {
  id: string;
  /** the car's colour (spec), for a body paint the model lost */
  paint: string;
  exterior: boolean;
}) {
  const model = useCarModel(id);
  const body = useMemo(() => {
    const src = model.getObjectByName('body');
    if (!src) return null;
    const g = src.clone(true);
    const painted = new Map<Material, Material>();
    g.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.geometry = withoutGroundSheet(m);
      const role = roleOf(m.material as Material);
      // a game's light-glow cards (a halo on black, meant to be added on top): lamps off here
      if (
        GLOW_CARD.test((m.material as Material).name) &&
        (m.material as MeshStandardMaterial).map
      ) {
        m.visible = false;
        return;
      }
      if (!exterior) {
        m.material = bodyGhost;
        m.visible = role !== 'interior';
        m.renderOrder = 5;
        m.castShadow = false;
        return;
      }
      m.castShadow = role !== 'glass';
      m.receiveShadow = role !== 'glass';
      const mat = m.material as MeshStandardMaterial;
      if (LENS.test(mat.name)) m.material = lensOf(mat);
      else if (role === 'badge' && /plate/i.test(mat.name)) m.material = blankPlate;
      else if (LOST_PAINT.test(mat.name) && !OWN_FINISH.test(mat.name) && !mat.map) {
        // per instance: two cars sharing a model may wear different colours
        let p = painted.get(mat);
        if (!p) {
          const c = mat.clone();
          c.color.set(paint);
          painted.set(mat, (p = c));
        }
        m.material = p;
      }
    });
    return g;
  }, [model, paint, exterior]);
  // the explorer's progress bar and camera wait for this
  useEffect(() => markReady(gltfUrl(id)!), [id]);
  return body ? <primitive object={body} /> : null;
}

/**
 * The model's own wheel for one corner, spinning like the procedural one (axle along Z). It sits
 * where the model has it, not at the spec's track and tyre size: a wide-body kit or a look-alike
 * keeps its wheels in its own arches and on the ground.
 */
export function GltfWheel({
  id,
  corner,
  at,
  driven,
  xray,
  spin,
}: {
  id: string;
  /** e.g. "front-left" */
  corner: string;
  /** where the layout puts this wheel (m, vehicle frame) */
  at: Vec3;
  driven: boolean;
  xray: boolean;
  spin: boolean;
}) {
  const model = useCarModel(id);
  const rot = useRef<Group>(null);
  // the model's wheels are not mirrored per side, so one rolling direction fits all four
  useSpin(rot, 'z', spin ? 'half' : 'road', -1);
  const wheel = useMemo(() => {
    const src = model.getObjectByName(`wheel-${corner}`);
    if (!src) return null;
    const g = src.clone(true);
    // the model's hub, relative to where the layout put the wheel
    const hub = src.position.clone().add(src.parent?.position ?? new Vector3());
    g.userData.offset = [hub.x - at[0], hub.y - at[1], hub.z - at[2]];
    g.position.set(0, 0, 0);
    // (found before the x-ray materials replace their names)
    const calipers = g.children.filter((c) =>
      /calip/i.test(((c as Mesh).material as Material | undefined)?.name ?? ''),
    );
    g.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const own = m.material as MeshStandardMaterial;
      // a tyre whose texture didn't export shows its bare base colour (white): rubber is black
      if (!xray && roleOf(own) === 'tyre' && !own.map) m.material = rubber;
      if (xray) {
        const role = roleOf(m.material as Material);
        m.material =
          role === 'tyre'
            ? driven
              ? drivenMat()
              : sysMat('wheel', 'rubber')
            : sysMat('chassis', 'metal');
      }
    });
    // calipers hang on the upright: they stay put while the wheel turns
    const fixed = new Group();
    fixed.add(...calipers);
    g.userData.fixed = fixed;
    return g;
    // the layout position only matters when the model or car changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, corner, driven, xray]);
  return wheel ? (
    <group position={wheel.userData.offset as Vec3}>
      <group ref={rot}>
        <primitive object={wheel} />
      </group>
      <primitive object={wheel.userData.fixed as Group} />
    </group>
  ) : null;
}
