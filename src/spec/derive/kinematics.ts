import type { EngineSpec } from '../types';
import { DEG, mod } from '../units';

/** Unit vector of cylinder i's axis in the engine YZ plane, as [y, z]. */
export function cylinderAxis(spec: EngineSpec, i: number): [number, number] {
  const t = spec.banks[spec.cylinders[i].bank].tiltDeg * DEG;
  return [Math.cos(t), Math.sin(t)];
}

/** Angle of cylinder i's crank pin from its own cylinder axis (deg); 0 = TDC. */
export function pinAngleFromAxisDeg(spec: EngineSpec, i: number, crankDeg: number): number {
  const c = spec.cylinders[i];
  return c.throwDeg - crankDeg - spec.banks[c.bank].tiltDeg;
}

export interface CylinderState {
  /** crank-pin centre in the engine YZ plane (mm), [y, z] */
  pinYZ: [number, number];
  /** piston (gudgeon) pin centre in the engine YZ plane (mm), [y, z] */
  pistonYZ: [number, number];
  /** piston travel below TDC (mm): 0 at TDC, stroke at BDC */
  travelMm: number;
  /** crank-pin angle from the cylinder axis (deg, 0 = TDC) */
  alphaDeg: number;
}

/** Exact slider-crank state of cylinder i at a crank angle (pistons; rotaries: see rotary.ts). */
export function cylinderState(spec: EngineSpec, i: number, crankDeg: number): CylinderState {
  const r = spec.strokeMm / 2;
  const l = spec.rodMm;
  const c = spec.cylinders[i];
  const psi = (c.throwDeg - crankDeg) * DEG;
  const alpha = (c.throwDeg - crankDeg - spec.banks[c.bank].tiltDeg) * DEG;
  const sinA = Math.sin(alpha);
  const s = r * Math.cos(alpha) + Math.sqrt(l * l - r * r * sinA * sinA);
  const [uy, uz] = cylinderAxis(spec, i);
  return {
    pinYZ: [r * Math.cos(psi), r * Math.sin(psi)],
    pistonYZ: [s * uy, s * uz],
    travelMm: r + l - s,
    alphaDeg: alpha / DEG,
  };
}

export type StrokeName = 'power' | 'exhaust' | 'intake' | 'compression';
const STROKES: StrokeName[] = ['power', 'exhaust', 'intake', 'compression'];

/** Which of the four strokes cylinder i is in at crankDeg (0..720), and progress 0..1 through it. */
export function strokeOf(
  spec: EngineSpec,
  i: number,
  crankDeg: number,
): { stroke: StrokeName; t: number } {
  const since = mod(crankDeg - spec.cylinders[i].fireDeg, 720);
  const k = Math.min(3, Math.floor(since / 180));
  return { stroke: STROKES[k], t: (since - k * 180) / 180 };
}
