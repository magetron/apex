/**
 * Left-foot braking: mid-corner, keep the throttle where it is and add a touch of brake with the
 * other foot, steering held. On a front-driven car the front brakes mostly cancel the drive
 * while the rear brakes take side grip from the rear tyres: the tail steps round and the car
 * tightens its line, the rally driver's way to turn a front-driver that pushes.
 */
import { cornerPlan, lineVerdict, withoutTechnique, type CornerSpec } from './corner';
import type { ScenarioDef } from './types';

/** the brake pedal every car gets (share of full pedal) */
export const LFB_PEDAL = 0.25;
export const LFB_HOLD_S = 1.2;

const SPEC: CornerSpec = {
  id: 'left-foot',
  radius: 30,
  arcDeg: 150,
  eventDeg: 60,
  exit: 100,
  event: 'Left-foot brake',
  holdS: LFB_HOLD_S,
  pedals(c, _p, st, u, t) {
    // the right foot stays where it was at the event
    if (t === 0) c.memo = st.throttle;
    u.throttle = c.memo;
    u.brake = LFB_PEDAL;
  },
};

export const leftFoot: ScenarioDef = {
  id: 'left-foot',
  question: 'Why brake with the left foot?',
  label: 'Left-foot braking',
  short: 'Left foot',
  title: 'Throttle held, a touch of brake mid-corner, steering held',
  speed: { min: 40, max: 60, def: 54, label: 'Corner speed' },
  headline: 'lineChange',
  key: { at: 'event', before: 0.3, after: LFB_HOLD_S },
  event: 'Brake',
  radius: SPEC.radius,
  plan: (kmh) => cornerPlan(SPEC, kmh),
  baseline: { label: 'No brake', plan: (kmh) => cornerPlan(withoutTechnique(SPEC), kmh) },
  verdict: lineVerdict,
};
