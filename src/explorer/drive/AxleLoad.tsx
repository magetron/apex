/**
 * The load on each axle's tyres, seen: a bar over each axle of a car, in its colour, as tall as
 * that axle's share of the car's weight on the road (as it is, not magnified), with a faint tick
 * at its height at rest. Braking or lifting moves load onto the front tyres (the front bar grows,
 * the rear shrinks), the throttle the other way. The centre of mass doesn't move; only the split
 * of the tyre load between the axles does. Through the key moment (and at its pause), an arrow
 * between the bars points the way the driver's action moved the load. Kept a readable width on
 * screen however far the camera stands back. Read per frame from the lane's drawn state.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BoxGeometry, ConeGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { frontLoadOf } from '../../sim/model';
import { useFreeze } from './freeze';
import type { Lane } from './lanes';
import { driveCars, drivePlayback, useDrive } from './state';
import { groundScale } from './Tracks';

const box = new BoxGeometry(1, 1, 1);
/** a unit cone along +Y, its base at the origin (turned to point along the car) */
const cone = new ConeGeometry(1, 1, 16).translate(0, 0.5, 0);
/** the bars start this far above the roof (m), and are this tall for half the car's weight */
const LIFT = 0.15;
const HALF = 1.1;
/** the bars at least this many pixels wide on screen, and never thinner than this (m) */
const BAR_PX = 7;
const BAR_MIN = 0.16;
/** the pause's arrow: shown where the action moved at least this share of the weight, this
 *  long (share of the wheelbase): it says which way, the bars how much */
const ARROW_MIN = 0.005;
const ARROW_LEN = 0.6;

export function AxleLoad({
  lane,
  index,
  color,
  tickColor,
}: {
  lane: Lane;
  /** the lane's place in the freeze frame's cars */
  index: number;
  color: string;
  tickColor: string;
}) {
  const p = lane.p;
  const rest = p.b / p.L;
  const parts = useMemo(() => {
    // drawn over the car (whatever its model's roof height), never hidden in it
    const mat = (c: string, opacity: number) =>
      new MeshBasicMaterial({ color: c, transparent: true, opacity, depthTest: false });
    const solid = mat(color, 0.9);
    const tick = mat(tickColor, 0.95);
    const g = new Group();
    const front = new Mesh(box, solid);
    const rear = new Mesh(box, solid);
    const frontTick = new Mesh(box, tick);
    const rearTick = new Mesh(box, tick);
    front.position.x = frontTick.position.x = p.a;
    rear.position.x = rearTick.position.x = -p.b;
    front.renderOrder = rear.renderOrder = 5;
    frontTick.renderOrder = rearTick.renderOrder = 6;
    // the arrow, pointing forward (+X) before it is turned round for load moving back
    const arrow = new Group();
    const shaft = new Mesh(box, solid);
    const tip = new Mesh(cone, solid);
    tip.rotation.z = -Math.PI / 2;
    shaft.renderOrder = tip.renderOrder = 6;
    arrow.add(shaft, tip);
    arrow.position.x = (p.a - p.b) / 2;
    arrow.visible = false;
    g.add(front, rear, frontTick, rearTick, arrow);
    g.position.y = p.dims.height + LIFT;
    return { g, front, rear, frontTick, rearTick, arrow, shaft, tip, mats: [solid, tick] };
  }, [p, color, tickColor]);
  useEffect(() => () => parts.mats.forEach((m) => m.dispose()), [parts]);

  useFrame(() => {
    const st = lane.view;
    const { g, front, rear, frontTick, rearTick, arrow, shaft, tip } = parts;
    g.position.x = st.x;
    g.position.z = -st.n;
    // the car's forward, world +X turned by its yaw about +Y
    g.rotation.y = st.yaw;
    const w = Math.max(BAR_MIN, BAR_PX * groundScale.mPerPx);
    // each axle's share of the tyre load, as it is
    const f = frontLoadOf(st);
    const hF = Math.max(0.05, (HALF * f) / 0.5);
    const hR = Math.max(0.05, (HALF * (1 - f)) / 0.5);
    front.scale.set(w, hF, w);
    front.position.y = hF / 2;
    rear.scale.set(w, hR, w);
    rear.position.y = hR / 2;
    // where each stands at rest
    const t = Math.max(0.03, w * 0.25);
    frontTick.scale.set(w * 1.9, t, w * 1.9);
    frontTick.position.y = (HALF * rest) / 0.5;
    rearTick.scale.set(w * 1.9, t, w * 1.9);
    rearTick.position.y = (HALF * (1 - rest)) / 0.5;
    // which way the driver's action moved the load: through the key moment, from where it was
    // just before the action; at the pause, from the freeze frame's own numbers
    const at = useFreeze.getState().at;
    const c = at && !useDrive.getState().playing ? at.cars[index] : undefined;
    const before = driveCars[index]?.frontBefore ?? NaN;
    const d = c
      ? c.frontNow - c.frontBefore
      : drivePlayback.keyOn && Number.isFinite(before)
        ? f - before
        : 0;
    arrow.visible = Math.abs(d) >= ARROW_MIN;
    if (!arrow.visible) return;
    const len = ARROW_LEN * p.L;
    const head = Math.min(len * 0.45, w * 3.2);
    shaft.scale.set(len - head, w * 0.7, w * 0.7);
    shaft.position.x = -head / 2;
    tip.scale.set(w * 1.5, head, w * 1.5);
    tip.position.x = len / 2 - head;
    arrow.position.y = w;
    arrow.rotation.y = d > 0 ? 0 : Math.PI;
  });

  return <primitive object={parts.g} />;
}
