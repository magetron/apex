/**
 * Where the driver does the thing the question is about (the lift, the throttle, the brake),
 * painted once across both lanes: the one key-moment cue on the road. No words on the road and
 * no other steps: the question says what happens, the freeze frame shows it.
 */
import { useLayoutEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { offsetPoint, type Mark, type Path, type PathPoint, type Plan } from '../../sim/scenarios';
import type { DriveColors } from './colors';
import type { Lane } from './lanes';

const tmp: PathPoint = { x: 0, n: 0, h: 0, k: 0 };

/** The scripted event, or the step where it happens (a stop's "Full brakes"). */
const isEvent = (plan: Plan, m: Mark) => m.kind === 'event' || Math.abs(m.s - plan.eventS) < 0.5;

/** A flat band along `path` from s0 to s1, from lateral offset l0 to l1 (m, + = left). */
function band(path: Path, s0: number, s1: number, l0: number, l1: number, y: number) {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = Math.max(1, Math.ceil((s1 - s0) / 0.5));
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const [ax, an] = offsetPoint(path, s, l1, tmp);
    const [bx, bn] = offsetPoint(path, s, l0, tmp);
    pos.push(ax, y, -an, bx, y, -bn);
    if (i > 0) {
      const v = i * 2;
      idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export function Marks({
  lane,
  colors,
  offset = 0,
}: {
  lane: Lane;
  /** (kept for callers: the stripe doesn't change as the run plays) */
  t?: { now: number };
  colors: DriveColors;
  /** the comparison car's lane (m to the side): the stripe reaches across it too */
  offset?: number;
}) {
  const { plan, marks } = lane;
  const half = plan.roadWidth / 2 - 0.3;
  const geo = useMemo(() => {
    const m = marks.find((x) => isEvent(plan, x));
    if (!m) return null;
    return band(
      plan.path,
      m.s - 0.15,
      m.s + 0.15,
      Math.min(0, offset) - half,
      Math.max(0, offset) + half,
      0.006,
    );
  }, [plan, marks, half, offset]);
  useLayoutEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} renderOrder={1}>
      <meshBasicMaterial
        color={colors.mark}
        transparent
        opacity={0.85}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-3}
        polygonOffsetUnits={-30}
      />
    </mesh>
  );
}
