/**
 * Quasi-static steady-state cornering limit: the highest lateral acceleration at which both
 * axles can still supply their share (m·ay·b/L front, m·ay·a/L rear) with the loads that
 * lateral transfer leaves them. Used to run every car at the same fraction of its own limit.
 */
import type { AxleParams, CarParams } from './params';
import { G } from './params';
import { tyreForce, type TyreOut } from './tyre';

const out: TyreOut = { fx: 0, fy: 0, cap: 0 };

/** Most side force an axle can make at lateral acceleration ay (m/s²) for this static load. */
function axleMax(axle: AxleParams, load: number, ay: number, m: number, h: number): number {
  const dz = (axle.rollShare * m * ay * h) / axle.track;
  const inner = Math.max(0, load / 2 - dz);
  const outer = load - inner;
  let best = 0;
  // both tyres share one slip angle (single track); a positive slip pushes to the right
  for (let a = 0.005; a < 0.3; a += 0.0025) {
    const fIn = tyreForce(inner, a, 0, axle.mu, axle.fz0, out).fy;
    const fOut = tyreForce(outer, a, 0, axle.mu, axle.fz0, out).fy;
    best = Math.max(best, -(fIn + fOut));
  }
  return best;
}

const cache = new WeakMap<CarParams, number>();

/** Steady-state lateral limit (m/s²). */
export function lateralLimit(p: CarParams): number {
  const hit = cache.get(p);
  if (hit !== undefined) return hit;
  const wF = (p.m * G * p.b) / p.L;
  const wR = (p.m * G * p.a) / p.L;
  let lo = 0;
  let hi = 2 * G;
  for (let i = 0; i < 32; i++) {
    const ay = (lo + hi) / 2;
    const ok =
      axleMax(p.front, wF, ay, p.m, p.h) >= (p.m * ay * p.b) / p.L &&
      axleMax(p.rear, wR, ay, p.m, p.h) >= (p.m * ay * p.a) / p.L;
    if (ok) lo = ay;
    else hi = ay;
  }
  cache.set(p, lo);
  return lo;
}

/** Lateral limit a grip-scaled plan's speeds are quoted for (m/s²): a typical road car. */
export const REF_LATERAL_LIMIT = 0.9 * G;
