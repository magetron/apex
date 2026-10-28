/**
 * Sim ground frame → three.js world. The sim works in (x, n) with n to the LEFT (ISO); the
 * world has +Z to the right, so Z = −n and a heading ψ is exactly the world yaw about +Y.
 * The 3D car's origin (the explorer's pose point) is the wheelbase midpoint on the ground.
 */
import type { CarParams, CarState } from '../../sim/model';

export interface Ground {
  x: number;
  z: number;
}

/** Pose origin (wheelbase midpoint) of a car, world metres. */
export function poseOrigin(p: CarParams, st: CarState, out: Ground): Ground {
  const c = Math.cos(st.yaw);
  const s = Math.sin(st.yaw);
  out.x = st.x + c * p.poseOffset;
  out.z = -(st.n + s * p.poseOffset);
  return out;
}

/** Contact patch of wheel i ([FL, FR, RL, RR]), world metres. */
export function wheelPoint(p: CarParams, st: CarState, i: number, out: Ground): Ground {
  const front = i < 2;
  const ax = front ? p.front : p.rear;
  const bx = ax.x;
  // even indices are left wheels, and the sim's lateral axis points left
  const by = (i % 2 === 0 ? 0.5 : -0.5) * ax.track;
  const c = Math.cos(st.yaw);
  const s = Math.sin(st.yaw);
  out.x = st.x + c * bx - s * by;
  out.z = -(st.n + s * bx + c * by);
  return out;
}
