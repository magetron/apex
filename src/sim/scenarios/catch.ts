/**
 * Catch a slide: lift off near the limit, hands still while the slide builds, then the driver
 * catches it. A car whose tail steps out needs opposite lock (countersteer: the front wheels
 * pointing out of the turn, where the car is actually going); how much and how quickly depends
 * on the layout. A car that only tucks its nose in needs none.
 */
import { cornerPlan, type CornerSpec } from './corner';
import { DEG_PER_RAD, eventTime, maxOver, meanOver, type Trace } from './trace';
import type { ScenarioDef, ScenarioResult } from './types';

/** steering held still after the lift while the slide builds (s) */
export const HANDS_S = 0.8;
/** how long after the event the catch is judged (s) */
const CATCH_S = 3;

const SPEC: CornerSpec = {
  id: 'catch',
  radius: 40,
  arcDeg: 170,
  eventDeg: 70,
  exit: 100,
  event: 'Lift',
  holdS: HANDS_S,
  headline: 'counterDeg',
  pedals(_c, _p, _st, u) {
    u.throttle = 0;
    u.brake = 0;
  },
};

const withCatch = (spec: CornerSpec, kmh: number) => {
  const plan = cornerPlan(spec, kmh);
  plan.summarize = (tr) => catchResult(tr);
  return plan;
};

export const catchSlide: ScenarioDef = {
  id: 'catch',
  label: 'Catch a slide',
  short: 'Catch',
  title: 'Lift near the limit, hands still, then the driver countersteers',
  speed: { min: 55, max: 68, def: 64, label: 'Corner speed' },
  headline: 'counterDeg',
  event: 'Lift',
  radius: SPEC.radius,
  plan: (kmh) => withCatch(SPEC, kmh),
  // the same lift with the hands kept still: what the countersteer saved
  baseline: { label: 'No catch', plan: (kmh) => withCatch({ ...SPEC, holdS: CATCH_S }, kmh) },
  verdict(r) {
    if (r.spun) return 'spin';
    return (r.values.maxSlip ?? 0) > 2 ? 'caught' : 'no-slide';
  },
};

/**
 * Opposite lock the driver needed after the event (road-wheel degrees past straight ahead, out
 * of the turn) and how far the tail swung out at most.
 */
export function catchResult(tr: Trace): ScenarioResult {
  const te = eventTime(tr);
  const b0 = meanOver(tr, te - 0.3, te, (i) => tr.beta[i]);
  return {
    values: {
      // every corner here turns left (steer > 0): opposite lock is steering to the right
      counterDeg:
        Math.max(
          0,
          maxOver(tr, te, te + CATCH_S, (i) => -tr.steer[i]),
        ) * DEG_PER_RAD,
      maxSlip:
        Math.max(
          0,
          maxOver(tr, te, te + CATCH_S, (i) => b0 - tr.beta[i]),
        ) * DEG_PER_RAD,
    },
    headline: 'counterDeg',
    spun: tr.beta.some((b) => Math.abs(b) > 1.2),
  };
}
