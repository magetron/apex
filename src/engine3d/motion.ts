/**
 * Per-cycle lookup tables so the animation can run every frame with zero allocation while
 * staying exact: the slider-crank comes from cylinderState(), the combustion glow from
 * strokeOf() and the shake from balanceAt(), sampled once per spec and interpolated.
 * (Half-degree linear interpolation of the slider-crank is good to ~0.001 mm.)
 */
import { balanceAt } from '../spec/derive/balance';
import { cylinderState, strokeOf } from '../spec/derive/kinematics';
import type { EngineSpec } from '../spec/types';
import { mod } from '../spec/units';

/** samples per 360° for the slider-crank and balance tables */
export const SLIDER_STEPS = 720;
/** samples per 720° for the glow table */
export const GLOW_STEPS = 720;
const BAL_STEPS = 720;

export interface BalanceTable {
  /** BAL_STEPS × (f1y f1z f2y f2z m1y m1z m2y m2z) */
  balance: Float32Array;
}

export interface MotionTables extends BalanceTable {
  n: number;
  /** per cylinder × SLIDER_STEPS: pinY, pinZ, pistonY, pistonZ (mm) */
  slider: Float32Array;
  /** per cylinder × GLOW_STEPS: combustion intensity 0..1 */
  glow: Float32Array;
}

/** Free forces/couples over one revolution (any engine, rotaries included). */
export function balanceTable(spec: EngineSpec): BalanceTable {
  const balance = new Float32Array(BAL_STEPS * 8);
  for (let k = 0; k < BAL_STEPS; k++) {
    const b = balanceAt(spec, (360 * k) / BAL_STEPS);
    balance.set([b.f1[1], b.f1[2], b.f2[1], b.f2[2], b.m1[1], b.m1[2], b.m2[1], b.m2[2]], k * 8);
  }
  return { balance };
}

/** Combustion light over the power stroke: a quick flash at ignition, then fading as it expands. */
export const glowCurve = (t: number) => (t < 0.04 ? t / 0.04 : (1 - t) ** 1.6);

export function motionTables(spec: EngineSpec): MotionTables {
  const n = spec.cylinders.length;
  const slider = new Float32Array(n * SLIDER_STEPS * 4);
  const glow = new Float32Array(n * GLOW_STEPS);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < SLIDER_STEPS; k++) {
      const s = cylinderState(spec, i, (360 * k) / SLIDER_STEPS);
      const o = (i * SLIDER_STEPS + k) * 4;
      slider[o] = s.pinYZ[0];
      slider[o + 1] = s.pinYZ[1];
      slider[o + 2] = s.pistonYZ[0];
      slider[o + 3] = s.pistonYZ[1];
    }
    for (let k = 0; k < GLOW_STEPS; k++) {
      const st = strokeOf(spec, i, (720 * k) / GLOW_STEPS);
      glow[i * GLOW_STEPS + k] = st.stroke === 'power' ? glowCurve(st.t) : 0;
    }
  }
  return { n, slider, glow, ...balanceTable(spec) };
}

/** Slider-crank state of cylinder i into out[0..3] = pinY, pinZ, pistonY, pistonZ (mm). */
export function sampleSlider(
  t: MotionTables,
  i: number,
  crankDeg: number,
  out: Float32Array | number[],
) {
  const f = (mod(crankDeg, 360) / 360) * SLIDER_STEPS;
  const k0 = Math.floor(f) % SLIDER_STEPS;
  const k1 = (k0 + 1) % SLIDER_STEPS;
  const w = f - Math.floor(f);
  const a = (i * SLIDER_STEPS + k0) * 4;
  const b = (i * SLIDER_STEPS + k1) * 4;
  const s = t.slider;
  out[0] = s[a] + (s[b] - s[a]) * w;
  out[1] = s[a + 1] + (s[b + 1] - s[a + 1]) * w;
  out[2] = s[a + 2] + (s[b + 2] - s[a + 2]) * w;
  out[3] = s[a + 3] + (s[b + 3] - s[a + 3]) * w;
}

/** Combustion glow 0..1 of cylinder i (nearest sample; it is only light). */
export function sampleGlow(t: MotionTables, i: number, crankDeg: number): number {
  const k = Math.round((mod(crankDeg, 720) / 720) * GLOW_STEPS) % GLOW_STEPS;
  return t.glow[i * GLOW_STEPS + k];
}

/** Free force/couple vectors at a crank angle into out[0..7] (see MotionTables.balance). */
export function sampleBalance(t: BalanceTable, crankDeg: number, out: Float32Array | number[]) {
  const f = (mod(crankDeg, 360) / 360) * BAL_STEPS;
  const k0 = Math.floor(f) % BAL_STEPS;
  const k1 = (k0 + 1) % BAL_STEPS;
  const w = f - Math.floor(f);
  const b = t.balance;
  for (let j = 0; j < 8; j++) out[j] = b[k0 * 8 + j] + (b[k1 * 8 + j] - b[k0 * 8 + j]) * w;
}

/** Unwrapped change of a 0..720 crank angle since the last frame (handles the wrap). */
export const crankDelta = (now: number, last: number) => {
  const d = mod(now - last, 720);
  return d > 360 ? d - 720 : d;
};
