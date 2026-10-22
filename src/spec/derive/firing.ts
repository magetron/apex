import type { EngineSpec, FiringEvent } from '../types';
import { mod } from '../units';

/**
 * Crank degrees between two firings of the same cylinder: 720 for a four-stroke piston, 360
 * for a rotor (one of its three faces reaches combustion TDC every e-shaft turn).
 */
export const firingPeriodDeg = (spec: EngineSpec) => (spec.family === 'rotary' ? 360 : 720);

/** Combustion events per crank (e-shaft) revolution: the firing frequency is rpm/60 × this. */
export const firesPerRev = (spec: EngineSpec) =>
  (spec.cylinders.length * 360) / firingPeriodDeg(spec);

/**
 * All power-stroke TDC events in one 720° cycle, sorted by crank angle. A rotor appears once
 * per 360°, so twice.
 */
export function firingEvents(spec: EngineSpec): FiringEvent[] {
  const period = firingPeriodDeg(spec);
  return spec.cylinders
    .flatMap((c, cyl) =>
      Array.from({ length: 720 / period }, (_, k) => ({
        cyl,
        deg: mod(c.fireDeg + k * period, 720),
      })),
    )
    .sort((a, b) => a.deg - b.deg);
}

/**
 * Gaps (deg) between consecutive firings, including the wrap back to the first.
 * Pass cylinder indices to look at a subset, e.g. one bank feeding one exhaust collector.
 */
export function firingIntervals(spec: EngineSpec, cylinders?: number[]): number[] {
  const events = firingEvents(spec).filter((e) => !cylinders || cylinders.includes(e.cyl));
  return events.map((e, k) => {
    const next = events[(k + 1) % events.length];
    return mod(next.deg - e.deg, 720) || 720;
  });
}

/** Indices of the cylinders on bank b. */
export const bankCylinders = (spec: EngineSpec, bank: number) =>
  spec.cylinders.flatMap((c, i) => (c.bank === bank ? [i] : []));

/** Indices of the cylinders under head h (VR banks share a head, so share an exhaust manifold). */
export const headCylinders = (spec: EngineSpec, head: number) =>
  spec.cylinders.flatMap((c, i) => (spec.banks[c.bank].head === head ? [i] : []));

/** Crank angle (0..360) at which cylinder i reaches TDC (it fires on every other one). */
export function tdcDeg(spec: EngineSpec, i: number): number {
  const c = spec.cylinders[i];
  return mod(c.throwDeg - spec.banks[c.bank].tiltDeg, 360);
}
