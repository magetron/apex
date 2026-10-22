/**
 * The cars lapping the circuit beyond the visitor's own (which the explorer draws, posed through
 * vehiclePose): each compared car as a see-through ghost of its real model in its comparison
 * colour (the look-alike shell while the model streams in, or for a car without one), its
 * wheels turning; a ghost close to the camera fades away so it never blocks the view. From
 * above every car is also a dot in its colour, a few pixels across whatever the height. (Their
 * name tags are the HUD's: TrackHud's RacerTags.)
 */
import { useFrame, useThree } from '@react-three/fiber';
import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Box3,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import type { RaceLine } from '../../sim/track';
import { markReady, useCarModel } from '../../vehicle3d/gltf/load';
import { gltfUrl } from '../../vehicle3d/gltf/manifest';
import { getShell } from '../../vehicle3d/shell/build';
import { RoadSpin } from '../../vehicle3d/spin';
import { newPose, poseAt } from './pose';
import { playback, useHotLap, type Racer } from './state';

const CORNERS = ['front-left', 'front-right', 'rear-left', 'rear-right'] as const;
const GHOST_OPACITY = 0.45;
/** draw order: after the road and the visitor's car, depth-only shell first */
const ORDER = 6;
/** a dot on the map: this many pixels across, never smaller than a car */
const DOT_PX = 11;
const roleOf = (m: Material) => /^apx:([a-z]+):/.exec(m.name)?.[1] ?? 'trim';

// (in the transparent pass, after the opaque scene: it shapes the ghost's own tint only and never
// hides the visitor's car behind a ghost)
const depthOnly = new MeshBasicMaterial({ colorWrite: false, transparent: true });
const disc = new CircleGeometry(0.5, 24).rotateX(-Math.PI / 2);
const ring = new RingGeometry(0.5, 0.68, 24).rotateX(-Math.PI / 2);

/** a ghost fades out between these distances from the camera (m) */
const FADE_FROM = 9;
const FADE_TO = 3.5;

/**
 * Moves its group along a racer's lap every frame; `spin` gets the wheels' roll angle, and a
 * ghost's tint (`fade`) thins out as the camera comes close.
 */
function useFollow(
  line: RaceLine,
  racer: Racer,
  spin?: (a: number) => void,
  fade?: MeshStandardMaterial,
) {
  const ref = useRef<Group>(null);
  const pose = useMemo(newPose, []);
  // its wheels turn as the visitor's car's do (RoadSpin: never strobing at speed)
  const road = useMemo(() => new RoadSpin(), []);
  const R = racer.vehicle.tires.diameterMm / 2000;
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    poseAt(line, racer.lap, playback.t, pose);
    g.position.set(pose.x, 0, pose.z);
    g.rotation.set(0, pose.yaw, 0);
    if (spin) spin(road.update(pose.x, pose.z, pose.yaw, R));
    if (fade) {
      const d = camera.position.distanceTo(g.position);
      const k = Math.min(1, Math.max(0, (d - FADE_TO) / (FADE_FROM - FADE_TO)));
      fade.opacity = GHOST_OPACITY * k;
      g.visible = k > 0.02;
    }
  });
  return ref;
}

/** The car's own model in one tint: a depth-only copy first, so it reads as one clean shell. */
function GhostModel({
  racer,
  line,
  mat,
}: {
  racer: Racer;
  line: RaceLine;
  mat: MeshStandardMaterial;
}) {
  const model = useCarModel(racer.vehicle.id);
  // the explorer's loading bar waits for every car on show
  useEffect(() => markReady(gltfUrl(racer.vehicle.id)!), [racer.vehicle.id]);
  const L = racer.vehicle.dims.wheelbaseMm / 1000;
  const parts = useMemo(() => {
    const src = model.getObjectByName('body');
    const make = (m: Material, order: number) => {
      if (!src) return null;
      const g = src.clone(true);
      g.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        const own = mesh.material as Material;
        // no cabin or lamp glow through the tint, and no contact-shadow sheet on the road
        const flat = new Box3().setFromObject(mesh).max.y < 0.03;
        if (roleOf(own) === 'interior' || /glow|flare/i.test(own.name) || flat) {
          mesh.visible = false;
          return;
        }
        mesh.material = m;
        mesh.renderOrder = order;
        mesh.castShadow = false;
      });
      return g;
    };
    const wheels = CORNERS.flatMap((corner) => {
      const w = model.getObjectByName(`wheel-${corner}`);
      if (!w) return [];
      const c = w.clone(true);
      const hub = w.position.clone().add(w.parent?.position ?? new Vector3());
      c.position.set(0, 0, 0);
      c.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        mesh.material = mat;
        mesh.renderOrder = ORDER + 1;
        mesh.castShadow = false;
      });
      return [{ obj: c as Object3D, hub }];
    });
    return { depth: make(depthOnly, ORDER), tint: make(mat, ORDER + 1), wheels };
  }, [model, mat]);
  const spins = useRef<(Group | null)[]>([]);
  const ref = useFollow(
    line,
    racer,
    (a) => {
      for (const s of spins.current) if (s) s.rotation.z = -a;
    },
    mat,
  );
  return (
    <group ref={ref}>
      {/* the model's frame has the front axle at its origin; the pose is the wheelbase middle */}
      <group position={[L / 2, 0, 0]}>
        {parts.depth && <primitive object={parts.depth} />}
        {parts.tint && <primitive object={parts.tint} />}
        {parts.wheels.map((w, i) => (
          <group key={i} position={w.hub}>
            <group
              ref={(el) => {
                spins.current[i] = el;
              }}
            >
              <primitive object={w.obj} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/** The look-alike shell in the tint, while the model streams in or for a car without one. */
function GhostShell({
  racer,
  line,
  mat,
}: {
  racer: Racer;
  line: RaceLine;
  mat: MeshStandardMaterial;
}) {
  const shell = useMemo(() => getShell(racer.vehicle), [racer.vehicle]);
  const L = racer.vehicle.dims.wheelbaseMm / 1000;
  const ref = useFollow(line, racer, undefined, mat);
  return (
    <group ref={ref}>
      <group position={[L / 2, 0, 0]}>
        <mesh geometry={shell.body} material={mat} renderOrder={ORDER + 1} />
        <mesh geometry={shell.wells} material={mat} renderOrder={ORDER + 1} />
      </group>
    </group>
  );
}

/** Falls back to the shell while a model loads, or if it fails. */
class Guard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    const { fallback, children } = this.props;
    return this.state.failed ? fallback : <Suspense fallback={fallback}>{children}</Suspense>;
  }
}

function Ghost({ racer, line }: { racer: Racer; line: RaceLine }) {
  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: racer.color,
        roughness: 0.5,
        metalness: 0.1,
        transparent: true,
        opacity: GHOST_OPACITY,
        depthWrite: false,
      }),
    [racer.color],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const shell = <GhostShell racer={racer} line={line} mat={mat} />;
  if (!gltfUrl(racer.vehicle.id)) return shell;
  return (
    <Guard key={racer.vehicle.id} fallback={shell}>
      <GhostModel racer={racer} line={line} mat={mat} />
    </Guard>
  );
}

/** A car's dot from above, following its lap. */
function Marker({ racer, line, dot }: { racer: Racer; line: RaceLine; dot: { m: number } }) {
  const ref = useFollow(line, racer);
  const scaled = useRef<Group>(null);
  const camera = useHotLap((s) => s.camera);
  const mats = useMemo(
    () => ({
      fill: new MeshBasicMaterial({ color: racer.color, depthTest: false, transparent: true }),
      rim: new MeshBasicMaterial({ color: '#0a0e13', depthTest: false, transparent: true }),
    }),
    [racer.color],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useFrame(() => scaled.current?.scale.setScalar(dot.m));
  return (
    <group ref={ref}>
      <group ref={scaled} visible={camera === 'map'} position={[0, 0.05, 0]}>
        <mesh geometry={ring} material={mats.rim} renderOrder={20} />
        <mesh geometry={disc} material={mats.fill} renderOrder={21} />
      </group>
    </group>
  );
}

export function Racers({ racers, line }: { racers: Racer[]; line: RaceLine }) {
  const camera = useThree((s) => s.camera) as { fov?: number; position: { y: number } };
  const size = useThree((s) => s.size);
  const dot = useMemo(() => ({ m: 4 }), []);
  useFrame(() => {
    // metres per pixel on the ground, seen from the camera's height
    const fov = ((camera.fov ?? 35) * Math.PI) / 180;
    const mPerPx = (2 * Math.max(1, camera.position.y) * Math.tan(fov / 2)) / size.height;
    dot.m = Math.max(4, DOT_PX * mPerPx);
  });
  return (
    <>
      {racers.slice(1).map((r) => (
        <Ghost key={r.vehicle.id} racer={r} line={line} />
      ))}
      {racers.map((r) => (
        <Marker key={r.vehicle.id} racer={r} line={line} dot={dot} />
      ))}
    </>
  );
}
