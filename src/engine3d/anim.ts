/** Explode staging and shake constants shared by the piston and rotary engine models. */
import { DEG } from '../spec/units';

export const ENGINE_STAGES = 4;
/** metres of shake per unit free force, radians per unit free couple (exaggerated) */
export const SHAKE_FORCE = 0.0035;
export const SHAKE_COUPLE = 1.3 * DEG;

export const smooth = (t: number) => t * t * (3 - 2 * t);
export const damp = (cur: number, target: number, lambda: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-lambda * dt));

/** Eased, damped progress of each explode stage, exactly like <Part> (in place, no allocation). */
export function stepStages(prog: number[], explode: number, dt: number) {
  for (let k = 0; k < ENGINE_STAGES; k++) {
    const target = smooth(Math.min(1, Math.max(0, explode * ENGINE_STAGES - k)));
    const cur = prog[k];
    prog[k] = Math.abs(target - cur) < 1e-5 ? target : damp(cur, target, 9, dt);
  }
}
