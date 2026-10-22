/**
 * Trail braking: brake while the car is turning (ISO 7975 "braking in a turn"), steering held.
 * Load moves onto the front tyres and off the rear ones, so the nose bites and the tail
 * lightens: the car turns in tighter. A light tail (front-engined cars) rotates readily; a heavy
 * one (rear-engined) barely does, which is why a 911 driver trails the brakes to get it turned.
 */
import { G } from '../model/params';
import { cornerPlan, lineVerdict, withoutTechnique, type CornerSpec } from './corner';
import type { ScenarioDef } from './types';

/** the same deceleration request for every car (g) */
export const TRAIL_DECEL = 0.3;
export const TRAIL_HOLD_S = 1.2;

const SPEC: CornerSpec = {
  id: 'trail-brake',
  radius: 40,
  arcDeg: 150,
  eventDeg: 60,
  exit: 100,
  event: 'Brake',
  holdS: TRAIL_HOLD_S,
  pedals(c, p, st, u) {
    c.driver.accel(p, st, u, -TRAIL_DECEL * G);
  },
};

export const trailBrake: ScenarioDef = {
  id: 'trail-brake',
  question: 'Can braking help you turn?',
  label: 'Trail braking',
  short: 'Trail',
  title: 'Braking in the turn, the same pedal for every car, steering held',
  speed: { min: 45, max: 70, def: 60, label: 'Corner speed' },
  headline: 'lineChange',
  key: { at: 'event', before: 0.3, after: TRAIL_HOLD_S },
  event: 'Brake',
  radius: SPEC.radius,
  plan: (kmh) => cornerPlan(SPEC, kmh),
  baseline: { label: 'No brake', plan: (kmh) => cornerPlan(withoutTechnique(SPEC), kmh) },
  verdict: lineVerdict,
};
