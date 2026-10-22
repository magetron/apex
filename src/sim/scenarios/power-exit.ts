/**
 * Power on mid-corner: settle on a circle at a steady speed, then ask every car for the same
 * forward acceleration with the steering held still (ISO 9816-style, open loop for 1 s).
 * A front-driven car runs wide (power understeer); rear-driven cars tighten and step out; an AWD
 * car pushes until its coupling sends drive to the rear.
 */
import { G } from '../model/params';
import { cornerPlan, cornerResult, lineVerdict, withoutTechnique, type CornerSpec } from './corner';
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
  label: 'Power out',
  short: 'Power',
  title: 'Mid-corner, the same throttle for every car, steering held',
  speed: { min: 30, max: 60, def: 46, label: 'Corner speed' },
  headline: 'lineChange',
  event: 'Throttle',
  radius: SPEC.radius,
  plan: (kmh) => cornerPlan(SPEC, kmh),
  baseline: { label: 'No throttle', plan: (kmh) => cornerPlan(withoutTechnique(SPEC), kmh) },
  verdict: lineVerdict,
};

export const powerExitResult = (tr: Parameters<typeof cornerResult>[0]) =>
  cornerResult(tr, OPEN_LOOP_S);
