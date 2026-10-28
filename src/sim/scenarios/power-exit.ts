/**
 * Power on mid-corner: settle on a circle at a steady speed, then ask every car for the same
 * forward acceleration with the steering held still (ISO 9816-style, open loop for 1 s).
 * A front-driven car runs wide (power understeer); rear-driven cars tighten and step out; an AWD
 * car pushes until its coupling sends drive to the rear.
 */
import { G } from '../model/params';
import { cornerPlan, lineVerdict, SWING_EARLY, withoutTechnique, type CornerSpec } from './corner';
import type { ScenarioDef } from './types';

/** the same forward-acceleration request for every car (g) */
export const POWER_ACCEL = 0.5;
export const OPEN_LOOP_S = 1;

const SPEC: CornerSpec = {
  id: 'power-exit',
  radius: 30,
  arcDeg: 130,
  eventDeg: 70,
  exit: 120,
  event: 'Throttle',
  holdS: OPEN_LOOP_S,
  pedals(_c, p, st, u) {
    _c.driver.accel(p, st, u, POWER_ACCEL * G);
  },
};

export const powerExit: ScenarioDef = {
  id: 'power-exit',
  question: 'What does the throttle do on exit?',
  label: 'Power out',
  short: 'Power',
  title: 'Mid-corner, every car asks for the same acceleration, steering held',
  demand: `every car asks for the same ${POWER_ACCEL} g of acceleration (as much as it has, if less)`,
  speed: { min: 30, max: 60, def: 46, label: 'Corner speed' },
  headline: 'lineChange',
  // stopped as the held second of throttle ends, where it shows most: a rear-driven car has
  // stepped out, a front-driven one has run wide of the line; after it the driver takes the
  // wheel back
  key: { at: 'event', before: 0.3, after: 1.3, freeze: OPEN_LOOP_S - SWING_EARLY },
  holdS: OPEN_LOOP_S,
  event: 'Throttle',
  radius: SPEC.radius,
  plan: (kmh) => cornerPlan(SPEC, kmh),
  baseline: { label: 'No throttle', plan: (kmh) => cornerPlan(withoutTechnique(SPEC), kmh) },
  verdict: lineVerdict,
};
