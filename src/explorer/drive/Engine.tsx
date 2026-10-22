/**
 * Where a car's mass sits, seen through its body: its engine (an electric car's motors, and its
 * battery in the floor) as a block in the system colours (scene/palette), x-rayed over the body
 * as the car view's see-through shows it, posed with the car as it drives, rolls and pitches. A
 * 911's engine hangs behind its rear axle while its rear rings go red: the why beside the what.
 * Its place and size are the spec's (layoutPowertrain). Shared geometry, each car its own copies
 * of the materials (car B's blocks fade with it, Lane.drawn), nothing allocated per frame.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
} from 'three';
import { SYSTEM_COLORS } from '../../scene/palette';
import { layoutPowertrain, partBounds } from '../../spec/derive/layout';
import type { VehicleSpec } from '../../spec/types';
import { fadeSolid } from './DetailedCar';
import { FADED, type Lane } from './lanes';
import { shownPitch } from './state';
import { poseOrigin, type Ground } from './world';

const box = new BoxGeometry(1, 1, 1);
const edges = new EdgesGeometry(box);
type Kind = 'engine' | 'motor' | 'battery';
/** drawn over the body (x-ray), the battery fainter: it is a floor, not a lump */
const mat = (kind: Kind, opacity: number) =>
  new MeshBasicMaterial({
    color: SYSTEM_COLORS[kind],
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
const FILL: Record<Kind, MeshBasicMaterial> = {
  engine: mat('engine', 0.82),
  motor: mat('motor', 0.82),
  battery: mat('battery', 0.4),
};
const EDGE: Record<Kind, LineBasicMaterial> = {
  engine: new LineBasicMaterial({
    color: SYSTEM_COLORS.engine,
    depthTest: false,
    toneMapped: false,
  }),
  motor: new LineBasicMaterial({ color: SYSTEM_COLORS.motor, depthTest: false, toneMapped: false }),
  battery: new LineBasicMaterial({
    color: SYSTEM_COLORS.battery,
    depthTest: false,
    toneMapped: false,
    transparent: true,
    opacity: 0.6,
  }),
};
/** over the rings and the lines on the road, under nothing else */
const ORDER = 20;
const M = 0.001;
const pt: Ground = { x: 0, z: 0 };

/** The blocks to draw for a car: each its kind, middle and size in its own frame (m; x forward
 *  from the wheelbase middle, y up, z right). */
function blocksOf(v: VehicleSpec) {
  const L = v.dims.wheelbaseMm * M;
  return layoutPowertrain(v)
    .parts.filter(
      (p): p is typeof p & { kind: Kind } =>
        p.kind === 'engine' || p.kind === 'motor' || p.kind === 'battery',
    )
    .map((p) => {
      const [lo, hi] = partBounds(p);
      return {
        kind: p.kind,
        // the spec's frame has the front axle at its origin: the middle is half a wheelbase back
        at: [
          ((lo[0] + hi[0]) / 2) * M + L / 2,
          ((lo[1] + hi[1]) / 2) * M,
          ((lo[2] + hi[2]) / 2) * M,
        ],
        size: [(hi[0] - lo[0]) * M, (hi[1] - lo[1]) * M, (hi[2] - lo[2]) * M],
      };
    });
}

export function EngineBlocks({ lane, vehicle }: { lane: Lane; vehicle: VehicleSpec }) {
  const pose = useRef<Group>(null);
  const sprung = useRef<Group>(null);
  const blocks = useMemo(() => blocksOf(vehicle), [vehicle]);
  const parts = useMemo(
    () =>
      blocks.map((b) => {
        const g = new Group();
        const fill = new MeshBasicMaterial().copy(FILL[b.kind]);
        const line = new LineBasicMaterial().copy(EDGE[b.kind]);
        const solid = new Mesh(box, fill);
        const lines = new LineSegments(edges, line);
        solid.renderOrder = ORDER;
        lines.renderOrder = ORDER + 1;
        g.add(solid, lines);
        g.position.set(b.at[0], b.at[1], b.at[2]);
        g.scale.set(b.size[0], b.size[1], b.size[2]);
        g.traverse((o) => (o.frustumCulled = false));
        return { g, fill, line, kind: b.kind };
      }),
    [blocks],
  );
  useEffect(
    () => () =>
      parts.forEach((p) => {
        p.fill.dispose();
        p.line.dispose();
      }),
    [parts],
  );
  // how far the blocks are faded (fresh blocks start whole)
  const faded = useMemo(() => ({ k: 1, parts }), [parts]);
  // the body pitches and rolls about the wheels' centres, as the explorer poses its own car
  const R = vehicle.tires.diameterMm * M * 0.5;

  useFrame(() => {
    const g = pose.current;
    if (!g) return;
    const st = lane.view;
    poseOrigin(lane.p, st, pt);
    g.position.set(pt.x, 0, pt.z);
    g.rotation.set(0, st.yaw, 0);
    sprung.current?.rotation.set(st.roll, 0, shownPitch(st.pitch), 'YXZ');
    const k = lane.drawn;
    if (k !== faded.k) {
      faded.k = k;
      g.visible = k > FADED;
      for (const b of faded.parts) {
        fadeSolid(b.fill, k, FILL[b.kind].opacity);
        fadeSolid(b.line, k, EDGE[b.kind].opacity);
      }
    }
  });

  return (
    <group ref={pose}>
      <group position={[0, R, 0]}>
        <group ref={sprung}>
          <group position={[0, -R, 0]}>
            {parts.map((p, i) => (
              <primitive key={i} object={p.g} />
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}
