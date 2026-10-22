/**
 * Per-frame engine state shared by the 3D animation (WP2) and the sound synth (WP4).
 * Mutable on purpose: read it inside useFrame / audio callbacks; never mirror it into React
 * state (that would re-render 60×/s).
 */
import { mod } from '../spec/units';

export const engineRuntime = {
  /** real engine speed — what the audio plays */
  rpm: 900,
  /** 0..1 */
  throttle: 0,
  /** current crank angle 0..720 (4-stroke cycle) */
  crankDeg: 0,
  /** visual slow-motion factor applied to the crank animation only (audio stays real-time) */
  timeScale: 0.05,
  running: true,
};

/**
 * Where the explorer's car is on the ground in drive mode (WP5 writes it from the sim every
 * frame; the explorer applies it to the car). Metres / radians, world frame.
 */
export const vehiclePose = {
  active: false,
  x: 0,
  z: 0,
  /** heading about +Y (0 = facing +X) */
  yaw: 0,
  /** body roll about the car's X axis, + = leaning right */
  roll: 0,
  /** body pitch about the car's Z axis, + = nose up */
  pitch: 0,
  /** wheel spin angle (rad) for animating the wheels */
  wheelSpin: 0,
  /** front road-wheel angle (rad), + = steering left */
  steer: 0,
};

/** Advance the crank; called once per frame by <EngineClock/> in the Stage. */
export function advanceCrank(dtSeconds: number) {
  if (!engineRuntime.running) return;
  const degPerSec = (engineRuntime.rpm / 60) * 360;
  engineRuntime.crankDeg = mod(
    engineRuntime.crankDeg + degPerSec * dtSeconds * engineRuntime.timeScale,
    720,
  );
}
