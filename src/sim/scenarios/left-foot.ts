/**
 * Left-foot braking: mid-corner, keep the throttle where it is and add a touch of brake with the
 * other foot, steering held. On a front-driven car the front brakes mostly cancel the drive
 * while the rear brakes take side grip from the rear tyres: the tail steps round and the car
 * tightens its line, the rally driver's way to turn a front-driver that pushes.
 */
import { G } from '../model/params';
import { withoutTechnique, type CornerSpec } from './corner';
import { trailVerdict, withMatchedSpeed } from './trail-brake';
import type { ScenarioDef } from './types';

/** the brake force every car gets (g of its own weight), throttle held */
export const LFB_G = 0.3;
export const LFB_HOLD_S = 1.2;

const SPEC: CornerSpec = {
  id: 'left-foot',
  radius: 30,
  arcDeg: 150,
  eventDeg: 60,
  exit: 100,
  event: 'Left-foot brake',
  holdS: LFB_HOLD_S,
  pedals(c, p, st, u, t) {
    // the right foot stays where it was at the event
    if (t === 0) c.memo = st.throttle;
    u.throttle = c.memo;
    u.brake = Math.min(1, (LFB_G * p.m * G) / p.brakeN);
  },
};

export const leftFoot: ScenarioDef = {
  id: 'left-foot',
  question: 'Why brake with the left foot?',
  label: 'Left-foot braking',
  short: 'Left foot',
  title: 'Throttle held, a touch of brake mid-corner, steering held',
  demand: `every car gets the same ${LFB_G} g of brake, its throttle held where it was`,
  speed: { min: 40, max: 60, def: 54, label: 'Corner speed' },
  // judged at matched speed, as trail braking: a touch of brake slows the car too, and slowing
  // down alone tightens a line
  headline: 'sameSpeedTighter',
  // stopped as the held steering ends, where the summary measures the line: the two agree
  key: { at: 'event', before: 0.3, after: LFB_HOLD_S, freeze: LFB_HOLD_S - 0.02 },
  holdS: LFB_HOLD_S,
  event: 'Brake',
  radius: SPEC.radius,
  plan: (kmh) => withMatchedSpeed(SPEC, kmh),
  // the same car at the braked car's speed, without the brake (the scene matches its speed:
  // explorer/drive/twin.ts)
  baseline: {
    label: "Car A's speed, no brake",
    plan: (kmh) => withMatchedSpeed(withoutTechnique(SPEC), kmh),
  },
  verdict: trailVerdict,
};
