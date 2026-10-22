/**
 * The two cars as they really look, each picked out by a rim in its colour:
 *  - DetailedRival: the comparison car from its own detailed model (the explorer's glTF body and
 *    wheels, read-only here) in one violet tint (its own paint could be red, and red means only
 *    an end that let go): a see-through ghost when it shares car A's lane, nearly solid a lane
 *    over. Driven by its lane: placed, turned, rolled and pitched like the visitor's car (a
 *    stop's nose dive drawn deeper, as the card says), its wheels turning and steering. A violet
 *    rim round it too.
 *  - PoseRim: the same rim round the visitor's own car, following the explorer's pose, so a
 *    black car on a dark road still reads.
 * The rim is a line a few pixels wide round the car's silhouette. It is drawn from the model's
 * welded outline shell (the explorer's GhostCar outline, built once per model off the main
 * thread): a depth-only copy of the shell masks the car itself, windows included, and then the
 * shell again, every point pushed a few pixels out on screen from the car's middle and set a
 * little behind the car, so only the band just outside the silhouette shows. Pushing out on
 * screen rather than along the surface normals keeps it clean whichever way a model's faces
 * were wound.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  Vector2,
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
} from 'three';
import { vehiclePose } from '../../scene/runtime';
import type { VehicleSpec } from '../../spec/types';
import { useCarModel } from '../../vehicle3d/gltf/load';
import { gltfUrl } from '../../vehicle3d/gltf/manifest';
import { carOutline } from '../../vehicle3d/outline';
import { RoadSpin } from '../../vehicle3d/spin';
import { FADED, type Lane } from './lanes';
import { shownPitch, shownSteer } from './state';
import { poseOrigin, type Ground } from './world';

/** after the road's marks and the cars' wedges, before the let-go ring */
const RIM_ORDER = 8;
/** the comparison car's see-through body: before its rim */
const GHOST_ORDER = 6;
/** the rim's width (CSS px) */
const RIM_PX = 2.5;
/** how far behind the car the pushed-out shell sits (m), so it never shows on the car itself */
const RIM_BACK = 0.2;

const rimVert = /* glsl */ `
  uniform vec3 uCenter;
  uniform vec2 uView;
  uniform float uPx;
  uniform float uBack;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec4 clip = projectionMatrix * mv;
    vec4 mid = projectionMatrix * modelViewMatrix * vec4(uCenter, 1.0);
    // on screen, away from the car's middle by uPx
    vec2 p = clip.xy / clip.w;
    vec2 d = (p - mid.xy / mid.w) * uView;
    float l = length(d);
    p += (l > 1e-4 ? d / l : vec2(0.0)) * uPx * 2.0 / uView;
    // and a little further from the eye than the car's own surface
    mv.xyz += normalize(mv.xyz) * uBack;
    vec4 back = projectionMatrix * mv;
    gl_Position = vec4(p * back.w, back.z, back.w);
  }
`;
const rimFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity);
    #include <colorspace_fragment>
  }
`;

/** the car's own silhouette, depth only (after the opaque car, glass and all): the rim shows
 *  only outside it */
const mask = new MeshBasicMaterial({ colorWrite: false, transparent: true, side: DoubleSide });

/** The rim round a loaded model, in the model's own (vehicle) frame; faded with its lane's car
 *  (Lane.drawn) when given one. */
function Rim({ model, color, lane }: { model: Object3D; color: string; lane?: Lane }) {
  const [shell, setShell] = useState<BufferGeometry | null>(null);
  useEffect(() => {
    let live = true;
    void carOutline(model).then((o) => live && setShell(o.shell));
    return () => {
      live = false;
    };
  }, [model]);
  const size = useThree((s) => s.size);
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uColor: { value: new Color(color) },
          uCenter: { value: new Vector3() },
          uView: { value: new Vector2(1, 1) },
          uPx: { value: RIM_PX },
          uBack: { value: RIM_BACK },
          uOpacity: { value: 1 },
        },
        vertexShader: rimVert,
        fragmentShader: rimFrag,
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    [color],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => {
    (mat.uniforms.uView.value as Vector2).set(size.width, size.height);
  }, [mat, size]);
  useEffect(() => {
    if (!shell) return;
    if (!shell.boundingBox) shell.computeBoundingBox();
    shell.boundingBox!.getCenter(mat.uniforms.uCenter.value as Vector3);
  }, [mat, shell]);
  useFrame(() => {
    if (lane) mat.uniforms.uOpacity.value = lane.drawn;
  });
  if (!shell) return null;
  return (
    <>
      <mesh geometry={shell} material={mask} renderOrder={RIM_ORDER} />
      <mesh geometry={shell} material={mat} renderOrder={RIM_ORDER + 1} />
    </>
  );
}

/** Draws `fallback` while a model streams in, or if it fails, instead of nothing. */
class Guard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(e: unknown) {
    console.warn('[apex] drive: car model failed to load:', e);
  }

  render() {
    const { fallback, children } = this.props;
    return this.state.failed ? fallback : <Suspense fallback={fallback}>{children}</Suspense>;
  }
}

export const hasDetailed = (v: VehicleSpec) => !!gltfUrl(v.id);

// ── the comparison car ─────────────────────────────────────────────────────────────────────

const CORNERS = ['front-left', 'front-right', 'rear-left', 'rear-right'] as const;
const rubber = new MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.9 });
const roleOf = (m: Material) => /^apx:([a-z]+):/.exec(m.name)?.[1] ?? 'trim';
const pt: Ground = { x: 0, z: 0 };
/** A material faded to `k` (0..1) of its own `base` opacity: see-through only while it fades
 *  (`base` 1), so a solid one keeps its place in the draw order the rest of the time. */
export function fadeSolid(m: Material, k: number, base = 1) {
  const see = base < 1 || k < 0.999;
  if (m.transparent !== see) {
    m.transparent = see;
    m.needsUpdate = true;
  }
  m.opacity = base * k;
}

interface ModelWheel {
  wheel: Object3D;
  /** where the model has its hub (vehicle frame) */
  hub: Vector3;
  front: boolean;
  /** the calipers, which stay put while the wheel turns */
  fixed: Group;
}

/**
 * Many models carry a contact-shadow sheet a few mm above the road (see GltfBody): through a
 * see-through car it would show as a pane on the ground, so its triangles go. One copy per
 * source geometry.
 */
const noSheet = new WeakMap<BufferGeometry, BufferGeometry>();
function withoutGroundSheet(m: Mesh): BufferGeometry {
  const geo = m.geometry;
  let out = noSheet.get(geo);
  if (out) return out;
  const flat = geo.index ? geo.toNonIndexed() : geo;
  const pos = flat.attributes.position;
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

/** the ghost's own nearest surface, depth only, so it shades as one clean shell */
const ghostDepth = new MeshBasicMaterial({ colorWrite: false, transparent: true });

/**
 * The comparison car's body in one tint (its own paint could be red, and red means only an
 * end that let go): a depth-only copy first, then the tinted one at `opacity`, so a see-through
 * car shows its outer shell, not every panel behind it. Its interior and light cards go.
 */
function GhostBody({ model, mat }: { model: Object3D; mat: MeshStandardMaterial }) {
  const bodies = useMemo(() => {
    const src = model.getObjectByName('body');
    if (!src) return null;
    const make = (material: Material, order: number) => {
      const g = src.clone(true);
      g.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const own = m.material as Material;
        if (roleOf(own) === 'interior' || /glow|flare/i.test(own.name)) {
          m.visible = false;
          return;
        }
        m.geometry = withoutGroundSheet(m);
        m.material = material;
        m.renderOrder = order;
        m.castShadow = false;
        m.receiveShadow = false;
      });
      return g;
    };
    return [make(ghostDepth, GHOST_ORDER), make(mat, GHOST_ORDER + 1)];
  }, [model, mat]);
  if (!bodies) return null;
  return (
    <>
      <primitive object={bodies[0]} />
      <primitive object={bodies[1]} />
    </>
  );
}

/** The model's own wheels, cloned, each about its hub; in `tint` when given (the ghost). */
function useModelWheels(model: Object3D, tint?: Material): ModelWheel[] {
  const wheels = useMemo(() => {
    const out: ModelWheel[] = [];
    for (const corner of CORNERS) {
      const src = model.getObjectByName(`wheel-${corner}`);
      if (!src) continue;
      const wheel = src.clone(true);
      const hub = src.position.clone().add(src.parent?.position ?? new Vector3());
      wheel.position.set(0, 0, 0);
      const calipers = wheel.children.filter((c) =>
        /calip/i.test(((c as Mesh).material as Material | undefined)?.name ?? ''),
      );
      wheel.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.castShadow = !tint;
        const own = m.material as MeshStandardMaterial;
        if (tint) {
          m.material = tint;
          m.renderOrder = GHOST_ORDER + 1;
          return;
        }
        // a tyre whose texture didn't export shows its bare base colour (white): rubber is black
        if (roleOf(own) === 'tyre' && !own.map) m.material = rubber;
      });
      const fixed = new Group();
      if (calipers.length) fixed.add(...calipers);
      out.push({ wheel, hub, front: corner.startsWith('front'), fixed });
    }
    return out;
  }, [model, tint]);
  return wheels;
}

function RivalModel({
  lane,
  vehicle,
  color,
  ghost,
  steerScale,
}: {
  lane: Lane;
  vehicle: VehicleSpec;
  color: string;
  steerScale: number;
  /** how see-through its single tint is (the same lane: a ghost over car A's road) */
  ghost: number;
}) {
  const model = useCarModel(vehicle.id);
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color,
        roughness: 0.55,
        metalness: 0.1,
        transparent: true,
        opacity: ghost,
        depthWrite: false,
      }),
    [color, ghost],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const wheels = useModelWheels(model, mat);
  const pose = useRef<Group>(null);
  const sprung = useRef<Group>(null);
  const steer = useRef<(Group | null)[]>([]);
  const spin = useRef<(Group | null)[]>([]);
  // its wheels turn as the explorer's own car's do (RoadSpin)
  const road = useMemo(() => new RoadSpin(), []);
  const { p } = lane;
  const R = vehicle.tires.diameterMm / 2000;

  useFrame(() => {
    const g = pose.current;
    if (!g) return;
    const st = lane.view;
    poseOrigin(p, st, pt);
    g.position.set(pt.x, 0, pt.z);
    g.rotation.set(0, st.yaw, 0);
    // faded out while it is (nearly) on car A (Lane.drawn): its depth-only copies go with it
    g.visible = lane.drawn > FADED;
    mat.opacity = ghost * lane.drawn;
    // the sprung body only, about a pivot at axle height, as the explorer does
    sprung.current?.rotation.set(st.roll, 0, shownPitch(st.pitch), 'YXZ');
    const turned = road.update(pt.x, pt.z, st.yaw, R);
    for (let i = 0; i < wheels.length; i++) {
      const s = spin.current[i];
      if (s) s.rotation.z = -turned;
      const w = steer.current[i];
      if (w) w.rotation.y = wheels[i].front ? shownSteer(st.steer - st.twist, steerScale) : 0;
    }
  });

  return (
    <group ref={pose}>
      {/* the model's frame has the front axle at its origin; the pose is the wheelbase middle */}
      <group position={[0, R, 0]}>
        <group ref={sprung}>
          <group position={[p.L / 2, -R, 0]}>
            <GhostBody model={model} mat={mat} />
            <Rim model={model} color={color} lane={lane} />
          </group>
        </group>
      </group>
      <group position={[p.L / 2, 0, 0]}>
        {wheels.map((w, i) => (
          <group key={i} position={w.hub}>
            <group
              ref={(el) => {
                steer.current[i] = el;
              }}
            >
              <group
                ref={(el) => {
                  spin.current[i] = el;
                }}
              >
                <primitive object={w.wheel} />
              </group>
              <primitive object={w.fixed} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * The comparison car from its detailed model, in its own paint with a rim in its colour;
 * `fallback` (the look-alike shell) while the model streams in, or if the car has none.
 */
export function DetailedRival({
  lane,
  vehicle,
  color,
  ghost = GHOST_SAME_LANE,
  steerScale = 1,
  fallback,
}: {
  lane: Lane;
  vehicle: VehicleSpec;
  color: string;
  /** its front wheels' steering drawn this many times larger */
  steerScale?: number;
  /** its tint's opacity: see-through in car A's own lane, nearly solid a lane over */
  ghost?: number;
  fallback: ReactNode;
}) {
  if (!hasDetailed(vehicle)) return <>{fallback}</>;
  return (
    <Guard key={vehicle.id} fallback={fallback}>
      <RivalModel
        lane={lane}
        vehicle={vehicle}
        color={color}
        ghost={ghost}
        steerScale={steerScale}
      />
    </Guard>
  );
}

/** the comparison car's tint: a ghost in car A's lane, nearly solid a lane over */
export const GHOST_SAME_LANE = 0.38;
export const GHOST_SIDE_LANE = 0.9;

// ── the visitor's car ──────────────────────────────────────────────────────────────────────

function PoseRimModel({ vehicle, color }: { vehicle: VehicleSpec; color: string }) {
  const model = useCarModel(vehicle.id);
  const pose = useRef<Group>(null);
  const sprung = useRef<Group>(null);
  const L = vehicle.dims.wheelbaseMm / 1000;
  const R = vehicle.tires.diameterMm / 2000;
  useFrame(() => {
    const g = pose.current;
    if (!g) return;
    // as the explorer poses its car: the wheelbase middle and heading, then the sprung body
    g.position.set(vehiclePose.x, 0, vehiclePose.z);
    g.rotation.set(0, vehiclePose.yaw, 0);
    sprung.current?.rotation.set(vehiclePose.roll, 0, vehiclePose.pitch, 'YXZ');
  });
  return (
    <group ref={pose}>
      <group position={[0, R, 0]}>
        <group ref={sprung}>
          <group position={[L / 2, -R, 0]}>
            <Rim model={model} color={color} />
          </group>
        </group>
      </group>
    </group>
  );
}

/** A rim in `color` round the visitor's own car, wherever the drive puts it. */
export function PoseRim({ vehicle, color }: { vehicle: VehicleSpec; color: string }) {
  if (!hasDetailed(vehicle)) return null;
  return (
    <Guard key={vehicle.id} fallback={null}>
      <PoseRimModel vehicle={vehicle} color={color} />
    </Guard>
  );
}
