/**
 * Lift-off mid-corner (ISO 9816): settle on a circle, then snap the throttle shut with the
 * steering held still for 2 s. Load moves forward, the rear tyres lose grip and engine
 * braking eats into what's left: a tail-heavy car's yaw rate spikes.
 */
import { cornerPlan, cornerResult, withoutTechnique, type CornerSpec } from './corner';
import type { ScenarioDef, ScenarioResult } from './types';

export const LIFT_HOLD_S = 2;

const SPEC: CornerSpec = {
  id: 'lift-off',
  radius: 40,
  arcDeg: 170,
  eventDeg: 70,
  exit: 100,
  event: 'Lift',
  holdS: LIFT_HOLD_S,
  headline: 'yawSpike',
  pedals(_c, _p, _st, u) {
    u.throttle = 0;
    u.brake = 0;
  },
};

export const liftOff: ScenarioDef = {
  id: 'lift-off',
  label: 'Lift mid-corner',
  short: 'Lift',
  title: 'Throttle snapped shut mid-corner, steering held',
  speed: { min: 40, max: 75, def: 63, label: 'Corner speed' },
  headline: 'yawSpike',
  event: 'Lift',
  radius: SPEC.radius,
  plan: (kmh) => cornerPlan(SPEC, kmh),
  baseline: { label: 'No lift', plan: (kmh) => cornerPlan(withoutTechnique(SPEC), kmh) },
  verdict: liftVerdict,
};

export const liftOffResult = (tr: Parameters<typeof cornerResult>[0]): ScenarioResult =>
  cornerResult(tr, LIFT_HOLD_S, 'yawSpike');

/** The tail swinging out (or round) is the story here; a car that only tightens tucks in. */
export function liftVerdict(r: ScenarioResult) {
  const { lineChange = 0, slipChange = 0 } = r.values;
  if (r.spun) return 'spin' as const;
  if (slipChange > 2) return 'tail' as const;
  if (lineChange > 10) return 'tight' as const;
  if (lineChange < -10) return 'wide' as const;
  return 'neutral' as const;
}
