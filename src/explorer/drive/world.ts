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

/** A tyre-frame force of wheel i turned into a world (x, z) direction (unnormalised). */
export function wheelForce(st: CarState, i: number, out: Ground): Ground {
  const delta = i < 2 ? st.steer - st.twist : 0;
  const cd = Math.cos(delta);
  const sd = Math.sin(delta);
  const bx = st.fx[i] * cd - st.fy[i] * sd;
  const by = st.fx[i] * sd + st.fy[i] * cd;
  const c = Math.cos(st.yaw);
  const s = Math.sin(st.yaw);
  out.x = c * bx - s * by;
  out.z = -(s * bx + c * by);
  return out;
}

/** three.js rotation.y that points local +X along world direction (dx, dz). */
export const yawOf = (dx: number, dz: number) => Math.atan2(-dz, dx);
