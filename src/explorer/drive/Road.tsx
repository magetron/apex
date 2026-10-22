/**
 * The scenario's ground: road surface, edge and lane lines, each car's planned line, cones.
 * Two cars run side by side, so the road carries two lanes: the plan's own, and the same one
 * `offset` metres to the side (moved as a whole on a straight road, concentric on a curved one),
 * with the cones at the outer edges and any gates repeated for the second lane.
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

/** Whether a plan's road is one straight line (its second lane is then a plain translation). */
export const straightRoad = (plan: Plan) => plan.road.ks.every((k) => k === 0);

/** The road as drawn for two lanes: its middle, width, lane lines and cones. */
export interface RoadLayout {
  offset: number;
  width: number;
  /** sideways offset of the road's middle from the road path (m, + = left) */
  middle: number;
  /** dashed lines, as sideways offsets from the road path */
  lanes: number[];
  cones: Float64Array;
}

/**
 * Two lanes from one plan: the plan's lane and a second `offset` metres to the side. Cones at
 * the road's edges move out with the second lane; cones inside the road (gates to drive
 * through) are repeated for it.
 */
export function roadLayout(plan: Plan, offset: number): RoadLayout {
  const w = plan.roadWidth;
  const off = plan.roadOffset;
  const straight = straightRoad(plan);
  const cones: number[] = [];
  const path = plan.path;
  // the skidpad's path laps its one-lap road: the first lap is enough to place cones against
  const nodes = Math.min(path.count, plan.road.count + 2);
  const c = plan.cones;
  for (let i = 0; i < c.length; i += 2) {
    const x = c[i];
    const n = c[i + 1];
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < nodes; j++) {
      const d = (path.xs[j] - x) ** 2 + (path.ns[j] - n) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    const s = best * path.spacing;
    const lat = path.lateral(x, n, s, tmp);
    const gate = Math.abs(lat - off) < w / 2 - 0.3;
    const away = (x0: number, n0: number): [number, number] => {
      if (straight) return [x0, n0 + offset];
      path.at(s, tmp);
      return [x0 - Math.sin(tmp.h) * offset, n0 + Math.cos(tmp.h) * offset];
    };
    if (gate) cones.push(x, n, ...away(x, n));
    else if (offset && Math.sign(lat - off) === Math.sign(offset)) cones.push(...away(x, n));
    else cones.push(x, n);
  }
  return {
    offset,
    width: w + Math.abs(offset),
    middle: off + offset / 2,
    lanes: offset
      ? [...plan.lanes, ...plan.lanes.map((l) => l + offset), off + offset / 2]
      : plan.lanes,
    cones: Float64Array.from(cones),
  };
}

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
  layout,
  lineColors,
  planned = true,
  runIn = 0,
}: {
  plan: Plan;
  colors: DriveColors;
  /** two lanes (roadLayout); the plan's one lane without */
  layout?: RoadLayout;
  /** each lane's planned line in its car's colour (dashed), so the line it drove (solid, the
   *  same colour) reads against it: running wide or tightening shows as the two parting */
  lineColors?: readonly string[];
  /** draw the planned lines at all (off: only the road) */
  planned?: boolean;
  /** road behind the start (m): a car drawn a little behind another (lanes.ts `behind`) starts
   *  on tarmac, not off the road's end */
  runIn?: number;
}) {
  const { road, path } = plan;
  const lay = useMemo(() => layout ?? roadLayout(plan, 0), [layout, plan]);
  const straight = straightRoad(plan);
  const geo = useMemo(() => {
    const len = road.length;
    const { width: w, middle: mid } = lay;
    // the skidpad's road is a loop: it has no end to run in to
    const s0 = road.length < path.length ? 0 : -Math.max(0, runIn);
    const line = (off: number) =>
      // a straight road's second lane is the first moved over whole (a lane change keeps its
      // shape); a curved one's runs concentric
      straight
        ? strip(path, s0, Math.min(path.length, len), 0.06, 0, 0.005, [1.2, 1.2]).translate(
            0,
            0,
            -off,
          )
        : strip(path, s0, Math.min(path.length, len), 0.06, off, 0.005, [1.2, 1.2]);
    return {
      surface: strip(road, s0, len, w / 2, mid, 0.002),
      edges: [
        strip(road, s0, len, 0.07, mid + w / 2 - 0.25, 0.004),
        strip(road, s0, len, 0.07, mid - w / 2 + 0.25, 0.004),
      ],
      lanes: lay.lanes.map((l) => strip(road, s0, len, 0.07, l, 0.004, [3, 6])),
      // the line the test driver aims for in each lane: dashed, under the cars' own lines
      lines: lay.offset ? [line(0), line(lay.offset)] : [line(0)],
    };
  }, [road, path, lay, straight, runIn]);
  useLayoutEffect(
    () => () => {
      geo.surface.dispose();
      geo.edges.forEach((g) => g.dispose());
      geo.lanes.forEach((g) => g.dispose());
      geo.lines.forEach((g) => g.dispose());
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
      {planned &&
        geo.lines.map((g, i) => (
          <mesh key={`l${i}`} geometry={g}>
            <meshBasicMaterial
              color={lineColors?.[i] ?? colors.line}
              transparent
              opacity={lineColors ? 0.55 : 0.7}
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-3}
              polygonOffsetUnits={-15}
            />
          </mesh>
        ))}
      <Cones cones={lay.cones} color={colors.cone} />
    </group>
  );
}
