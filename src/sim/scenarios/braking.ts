/**
 * Straight-line emergency stop: full pedal at the marker, ABS on. Load piles onto the front
 * axle; how well a car uses its rear tyres decides the distance.
 */
import { speedOf } from '../model/car';
import { G } from '../model/params';
import { edgeCones } from './cones';
import { PULL_AWAY, pullAway, pullAwayLen } from './corner';
import { Path } from './path';
import { DEG_PER_RAD, type Trace } from './trace';
import type { ScenarioDef } from './types';

const target = { v: 0, a: 0 };

export const braking: ScenarioDef = {
  id: 'braking',
  question: 'How short can it stop?',
  label: 'Emergency stop',
  short: 'Brake',
  title: 'Full brakes from speed, ABS on',
  speed: { min: 50, max: 140, def: 100, label: 'Speed' },
  headline: 'stopDist',
  // the load lands on the fronts within the first second
  key: { at: 'event', before: 0.3, after: 1.2 },
  event: 'Brake',
  plan(kmh) {
    const v = kmh / 3.6;
    const stop = (v * v) / (2 * 0.75 * G);
    // pull away up to the test speed, hold it a moment, then the stop
    const brakeAt = pullAwayLen(v) + 8;
    const path = Path.build([{ kind: 'line', len: brakeAt + stop + 80 }]);
    const cones: number[] = [];
    edgeCones(path, brakeAt, brakeAt, 1, 2, cones);
    edgeCones(path, brakeAt + 10, brakeAt + Math.ceil(stop / 10) * 10, 10, 2.4, cones);
    return {
      id: 'braking',
      kmh,
      path,
      road: path,
      roadWidth: 4.2,
      roadOffset: 0,
      lanes: [],
      cones: Float64Array.from(cones),
      eventS: brakeAt,
      overview: [brakeAt - 15, brakeAt + stop + 10],
      duration: brakeAt / (((1 + PULL_AWAY.start) / 2) * v) + v / (0.7 * G) + 2.5,
      startS: 0,
      startV: v * PULL_AWAY.start,
      gripScaled: false,
      marks: () => [
        { s: 2, label: 'Accelerate', kind: 'drive' },
        { s: brakeAt, label: 'Full brakes', kind: 'brake' },
      ],
      control(c, p, st, u, dt) {
        const d = c.driver;
        d.steer(p, st, u, dt);
        if (c.phase === 0) {
          pullAway(d.s, v, target);
          d.speed(p, st, u, target.v, target.a, dt);
          if (d.s >= brakeAt) {
            c.phase = 1;
            c.tEvent = st.t;
          }
        } else {
          u.throttle = 0;
          u.brake = 1;
          if (c.phase === 1 && speedOf(st) < 0.05) {
            c.phase = 2;
            c.memo = d.s;
          }
        }
      },
      summarize(tr) {
        return brakingResult(tr);
      },
    };
  },
};

export function brakingResult(tr: Trace) {
  const i0 = tr.phase.findIndex((ph) => ph >= 1);
  let iStop = tr.phase.findIndex((ph) => ph >= 2);
  if (iStop < 0) iStop = tr.t.length - 1;
  const dist = i0 < 0 ? NaN : tr.s[iStop] - tr.s[i0];
  const v0 = i0 < 0 ? NaN : tr.v[i0];
  let dive = 0;
  for (let i = Math.max(0, i0); i <= iStop; i++) dive = Math.max(dive, -tr.pitch[i]);
  return {
    values: {
      stopDist: dist,
      meanDecel: (v0 * v0) / (2 * dist) / G,
      diveDeg: dive * DEG_PER_RAD,
    },
    headline: 'stopDist' as const,
    spun: false,
  };
}
