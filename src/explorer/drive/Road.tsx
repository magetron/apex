/**
 * The scenario's ground: road surface, edge and lane lines, cones. Both cars drive the plan's
 * own line (car B drawn just behind car A), so the road is the plan's one road.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  BufferGeometry,
  ConeGeometry,
  Float32BufferAttribute,
  Matrix4,
  type InstancedMesh,
} from 'three';
import { offsetPoint, type Path, type PathPoint, type Plan } from '../../sim/scenarios';
import type { DriveColors } from './colors';

const tmp: PathPoint = { x: 0, n: 0, h: 0, k: 0 };

/** A ground point `lateral` to the side of the path at arc length s (+ = left); before the
 *  path's start, straight back along the way it starts (the run-in). */
function groundAt(path: Path, s: number, lateral: number): [number, number] {
  if (s >= 0) return offsetPoint(path, s, lateral, tmp);
  path.at(0, tmp);
  const c = Math.cos(tmp.h);
  const sn = Math.sin(tmp.h);
  return [tmp.x + s * c - sn * lateral, tmp.n + s * sn + c * lateral];
}

/**
 * A flat strip along `path` (world y up, Z = −n), between arc lengths from..to, `half` either
 * side of a line `offset` from the path. `dash` = [on, off] metres for dashed markings. `from`
 * may be negative: the strip then starts on the run-in behind the path's start.
 */
function strip(
  path: Path,
  from: number,
  to: number,
  half: number,
  offset: number,
  y: number,
  dash?: [number, number],
) {
  const pos: number[] = [];
  const idx: number[] = [];
  const stepLen = 0.5;
  const push = (s: number) => {
    const [lx, ln] = groundAt(path, s, offset + half);
    const [rx, rn] = groundAt(path, s, offset - half);
    pos.push(lx, y, -ln, rx, y, -rn);
  };
  const quad = () => {
    const v = pos.length / 3;
    // counter-clockwise seen from above, so the strip faces up
    idx.push(v - 4, v - 3, v - 2, v - 3, v - 1, v - 2);
  };
  if (dash) {
    for (let s = from; s < to; s += dash[0] + dash[1]) {
      push(s);
      push(Math.min(to, s + dash[0]));
      quad();
    }
  } else {
    push(from);
    for (let s = from + stepLen; s <= to + 1e-6; s += stepLen) {
      push(Math.min(s, to));
      quad();
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const cone = new ConeGeometry(0.12, 0.36, 14).translate(0, 0.18, 0);
const m4 = new Matrix4();

function Cones({ cones, color }: { cones: Float64Array; color: string }) {
  const ref = useRef<InstancedMesh>(null);
  const count = cones.length / 2;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++)
      mesh.setMatrixAt(i, m4.makeTranslation(cones[2 * i], 0, -cones[2 * i + 1]));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [cones, count]);
  return (
    <instancedMesh key={count} ref={ref} args={[cone, undefined, count]} castShadow>
      <meshStandardMaterial color={color} roughness={0.6} />
    </instancedMesh>
  );
}

export function Road({
  plan,
  colors,
  runIn = 0,
}: {
  plan: Plan;
  colors: DriveColors;
  /** road behind the start (m): a car drawn a little behind another (lanes.ts `behind`) starts
   *  on tarmac, not off the road's end */
  runIn?: number;
}) {
  const { road, path } = plan;
  const geo = useMemo(() => {
    const len = road.length;
    const w = plan.roadWidth;
    const mid = plan.roadOffset;
    // the skidpad's road is a loop: it has no end to run in to
    const s0 = road.length < path.length ? 0 : -Math.max(0, runIn);
    return {
      surface: strip(road, s0, len, w / 2, mid, 0.002),
      edges: [
        strip(road, s0, len, 0.07, mid + w / 2 - 0.25, 0.004),
        strip(road, s0, len, 0.07, mid - w / 2 + 0.25, 0.004),
      ],
      lanes: plan.lanes.map((l) => strip(road, s0, len, 0.07, l, 0.004, [3, 6])),
    };
  }, [plan, road, path, runIn]);
  useLayoutEffect(
    () => () => {
      geo.surface.dispose();
      geo.edges.forEach((g) => g.dispose());
      geo.lanes.forEach((g) => g.dispose());
    },
    [geo],
  );

  return (
    <group>
      <mesh geometry={geo.surface} receiveShadow>
        <meshStandardMaterial
          color={colors.road}
          roughness={0.95}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      {[...geo.edges, ...geo.lanes].map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial
            color={colors.roadEdge}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-10}
          />
        </mesh>
      ))}
      <Cones cones={plan.cones} color={colors.cone} />
    </group>
  );
}
