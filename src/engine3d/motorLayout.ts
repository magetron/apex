/**
 * EV drive unit layout (millimetres): motor, two-stage parallel-axis reduction, differential
 * and inverter packed into the spec's lengthMm × diameterMm × diameterMm box. Local frame:
 * +X along the output (half-shaft) axis through the origin — the box centre, which is where
 * layoutPowertrain() places a motor — and Y/Z across it.
 */
import type { MotorSpec } from '../spec/types';
import type { V3, YZ } from './prims';

export interface GearLayout {
  at: YZ;
  radiusMm: number;
  teeth: number;
  /** face centre along X */
  x: number;
  widthMm: number;
  /** angle of a tooth centre (deg) so meshing pairs interlock */
  phaseDeg: number;
}

export interface MotorLayout {
  spec: MotorSpec;
  lengthMm: number;
  diameterMm: number;
  /** motor (rotor) axis */
  motorAxis: YZ;
  /** intermediate shaft */
  interAxis: YZ;
  housingR: number;
  statorR: number;
  statorBoreR: number;
  rotorR: number;
  shaftR: number;
  motorX0: number;
  motorX1: number;
  statorX0: number;
  statorX1: number;
  pinion: GearLayout;
  inter1: GearLayout;
  inter2: GearLayout;
  ring: GearLayout;
  /** actual reduction from the tooth counts */
  ratio: number;
  diffX: number;
  diffR: number;
  caseX0: number;
  caseX1: number;
  inverter: { min: V3; max: V3 };
  poles: number;
  slots: number;
}

const DEGS = 180 / Math.PI;

export function motorLayout(spec: MotorSpec): MotorLayout {
  const L = spec.lengthMm;
  const D = spec.diameterMm;
  const M: YZ = [0.25 * D, 0];
  const I: YZ = [0.14 * D, -0.27 * D];
  const O: YZ = [0, 0];
  const dist = (a: YZ, b: YZ) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const ang = (a: YZ, b: YZ) => Math.atan2(b[1] - a[1], b[0] - a[0]) * DEGS;

  const g1 = Math.sqrt(spec.reduction);
  const za1 = 13;
  const zb1 = Math.max(za1 + 1, Math.round(za1 * g1));
  const za2 = 13;
  const zb2 = Math.max(za2 + 1, Math.round((za2 * spec.reduction * za1) / zb1));
  const dMI = dist(M, I);
  const dIO = dist(I, O);
  const fw = 0.05 * L;
  const x1 = L / 2 - 0.24 * L;
  const x2 = L / 2 - 0.13 * L;
  const phi = ang(M, I);
  const psi = ang(I, O);
  const pinion: GearLayout = {
    at: M,
    radiusMm: (dMI * za1) / (za1 + zb1),
    teeth: za1,
    x: x1,
    widthMm: fw,
    phaseDeg: phi,
  };
  const inter1: GearLayout = {
    at: I,
    radiusMm: (dMI * zb1) / (za1 + zb1),
    teeth: zb1,
    x: x1,
    widthMm: fw,
    phaseDeg: phi + 180 + 180 / zb1,
  };
  const inter2: GearLayout = {
    at: I,
    radiusMm: (dIO * za2) / (za2 + zb2),
    teeth: za2,
    x: x2,
    widthMm: fw * 1.2,
    phaseDeg: psi,
  };
  const ring: GearLayout = {
    at: O,
    radiusMm: (dIO * zb2) / (za2 + zb2),
    teeth: zb2,
    x: x2,
    widthMm: fw * 1.2,
    phaseDeg: psi + 180 + 180 / zb2,
  };

  const motorX0 = -L / 2 + 0.02 * L;
  const motorX1 = x1 - fw / 2 - 0.03 * L;
  const span = motorX1 - motorX0;
  const statorX0 = motorX0 + 0.14 * span;
  const statorX1 = motorX1 - 0.14 * span;
  return {
    spec,
    lengthMm: L,
    diameterMm: D,
    motorAxis: M,
    interAxis: I,
    housingR: 0.25 * D,
    statorR: 0.225 * D,
    statorBoreR: 0.135 * D,
    rotorR: 0.128 * D,
    shaftR: 0.035 * D,
    motorX0,
    motorX1,
    statorX0,
    statorX1,
    pinion,
    inter1,
    inter2,
    ring,
    ratio: (zb1 / za1) * (zb2 / za2),
    diffX: x2 + 0.075 * L,
    diffR: 0.12 * D,
    caseX0: x1 - fw / 2 - 0.015 * L,
    caseX1: L / 2 - 0.02 * L,
    inverter: {
      min: [motorX0 + 0.06 * L, -0.02 * D, 0.27 * D],
      max: [motorX1 - 0.04 * L, 0.42 * D, 0.49 * D],
    },
    poles: 2 * spec.sound.polePairs,
    slots: 12 * spec.sound.polePairs,
  };
}

/** Shaft angles (rad) for a rotor angle into out: [motor, intermediate, ring/diff/wheels]. */
export function gearAngles(l: MotorLayout, rotor: number, out: number[] = [0, 0, 0]): number[] {
  const inter = -rotor * (l.pinion.teeth / l.inter1.teeth);
  out[0] = rotor;
  out[1] = inter;
  out[2] = -inter * (l.inter2.teeth / l.ring.teeth);
  return out;
}
