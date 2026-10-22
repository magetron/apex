/** The scenario's ground: road surface, edge and lane lines, the planned line, cones. */
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

/**
 * A flat strip along `path` (world y up, Z = −n), between arc lengths from..to, `half` either
 * side of a line `offset` from the path. `dash` = [on, off] metres for dashed markings.
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
    const [lx, ln] = offsetPoint(path, s, offset + half, tmp);
    const [rx, rn] = offsetPoint(path, s, offset - half, tmp);
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

export function Road({ plan, colors }: { plan: Plan; colors: DriveColors; event?: string }) {
  const { road, path, roadWidth: w, roadOffset: off } = plan;
  const geo = useMemo(() => {
    const len = road.length;
    return {
      surface: strip(road, 0, len, w / 2, off, 0.002),
      edges: [
        strip(road, 0, len, 0.07, off + w / 2 - 0.25, 0.004),
        strip(road, 0, len, 0.07, off - w / 2 + 0.25, 0.004),
      ],
      lanes: plan.lanes.map((l) => strip(road, 0, len, 0.07, off + l, 0.004, [3, 6])),
      // the line the test driver aims for: dashed, under every car's own line
      line: strip(path, 0, Math.min(path.length, len), 0.05, 0, 0.005, [1.2, 1.2]),
    };
  }, [plan, road, path, w, off]);
  useLayoutEffect(
    () => () => {
      geo.surface.dispose();
      geo.edges.forEach((g) => g.dispose());
      geo.lanes.forEach((g) => g.dispose());
      geo.line.dispose();
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
      <mesh geometry={geo.line}>
        <meshBasicMaterial
          color={colors.line}
          transparent
          opacity={0.7}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-15}
        />
      </mesh>
      <Cones cones={plan.cones} color={colors.cone} />
    </group>
  );
}
