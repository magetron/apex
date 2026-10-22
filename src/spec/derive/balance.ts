/**
 * Free forces and couples from the reciprocating masses, computed numerically so the same code
 * covers I3 through W16 with no lookup tables.
 *
 * Each piston's inertia force along its own axis is m·r·ω²·(cos α + λ·cos 2α), λ = r/l.
 * The cos α part is the primary (1st-order) term, cos 2α the secondary (2nd-order) term.
 * Results are normalised: forces in units of one cylinder's peak force of that order,
 * couples in units of (that force × bore pitch). Values are before any counterweighting.
 */
import type { BalanceOrder, BalanceReport, EngineSpec, Vec3 } from '../types';
import { DEG } from '../units';
import { cylinderAxis, pinAngleFromAxisDeg } from './kinematics';

export interface BalanceSample {
  f1: Vec3;
  f2: Vec3;
  m1: Vec3;
  m2: Vec3;
}

/**
 * A rotary has nothing reciprocating: each rotor is an eccentric mass whirling at radius e with
 * the shaft, a purely rotating 1st-order force along its lobe (in units of one rotor's m·e·ω²).
 * Two rotors 180° apart cancel as forces but, being a rotor pitch apart, leave a rotating
 * couple, which the counterweights on the front pulley and the flywheel cancel.
 */
function rotaryBalanceAt(spec: EngineSpec, crankDeg: number): BalanceSample {
  let fy = 0,
    fz = 0,
    my = 0,
    mz = 0;
  for (const c of spec.cylinders) {
    const a = (c.throwDeg - crankDeg) * DEG;
    const x = c.axialMm / spec.borePitchMm;
    fy += Math.cos(a);
    fz += Math.sin(a);
    my -= x * Math.sin(a);
    mz += x * Math.cos(a);
  }
  return { f1: [0, fy, fz], f2: [0, 0, 0], m1: [0, my, mz], m2: [0, 0, 0] };
}

/** Instantaneous primary/secondary force and couple vectors (engine frame) at a crank angle. */
export function balanceAt(spec: EngineSpec, crankDeg: number): BalanceSample {
  if (spec.family === 'rotary') return rotaryBalanceAt(spec, crankDeg);
  let f1y = 0,
    f1z = 0,
    f2y = 0,
    f2z = 0,
    m1y = 0,
    m1z = 0,
    m2y = 0,
    m2z = 0;
  spec.cylinders.forEach((c, i) => {
    const a = pinAngleFromAxisDeg(spec, i, crankDeg) * DEG;
    const [uy, uz] = cylinderAxis(spec, i);
    const x = c.axialMm / spec.borePitchMm;
    const c1 = Math.cos(a);
    const c2 = Math.cos(2 * a);
    f1y += c1 * uy;
    f1z += c1 * uz;
    f2y += c2 * uy;
    f2z += c2 * uz;
    // moment of F = (0, fy, fz) applied at (x, 0, 0): r × F = (0, -x·fz, x·fy)
    m1y -= x * c1 * uz;
    m1z += x * c1 * uy;
    m2y -= x * c2 * uz;
    m2z += x * c2 * uy;
  });
  return { f1: [0, f1y, f1z], f2: [0, f2y, f2z], m1: [0, m1y, m1z], m2: [0, m2y, m2z] };
}

const len = (v: Vec3) => Math.hypot(v[0], v[1], v[2]);

/** Below this a term counts as cancelled (numerical noise and tiny bank offsets). */
export const BALANCED_EPS = 1e-6;

export function balance(spec: EngineSpec, samples = 360): BalanceReport {
  const keys = ['f1', 'f2', 'm1', 'm2'] as const;
  const max = { f1: 0, f2: 0, m1: 0, m2: 0 };
  const min = { f1: Infinity, f2: Infinity, m1: Infinity, m2: Infinity };
  for (let k = 0; k < samples; k++) {
    const s = balanceAt(spec, (360 * k) / samples);
    for (const key of keys) {
      const m = len(s[key]);
      max[key] = Math.max(max[key], m);
      min[key] = Math.min(min[key], m);
    }
  }
  const rotating = (key: (typeof keys)[number]) => max[key] > 1e-3 && min[key] / max[key] > 0.9;
  const order = (f: 'f1' | 'f2', m: 'm1' | 'm2'): BalanceOrder => ({
    force: max[f] < BALANCED_EPS ? 0 : max[f],
    couple: max[m] < BALANCED_EPS ? 0 : max[m],
    forceRotating: rotating(f),
    coupleRotating: rotating(m),
  });
  return { primary: order('f1', 'm1'), secondary: order('f2', 'm2') };
}
