/**
 * Double lane change (ISO 3888-1 shape) at a steady speed, closed loop: the same driver steers
 * every car through the cones. A car with little yaw inertia answers the wheel sooner.
 */
import { edgeCones } from './cones';
import { PULL_AWAY, pullAway, pullAwayLen } from './corner';
import { Path } from './path';
import { DEG_PER_RAD, type Trace } from './trace';
import type { ScenarioDef } from './types';

const LANE = 3.5;
/** steady before the first gate (m), after the pull-away */
const STEADY = 40;
const SHIFT = 30;
const MID = 25;
const OUT = 120;
const GATE = 1.5;
const target = { v: 0, a: 0 };

export const laneChange: ScenarioDef = {
  id: 'lane-change',
  question: 'How fast does it change direction?',
  label: 'Lane change',
  short: 'Lane',
  title: 'Swerve into the next lane and back at a steady speed',
  speed: { min: 50, max: 100, def: 80, label: 'Speed' },
  headline: 'yawLag',
  // the first swerve: the wheel turns, the tail follows a moment later
  key: { at: 'event', before: 0.1, after: 1.6, label: 'Swerve' },
  plan(kmh) {
    const v = kmh / 3.6;
    const gateAt = pullAwayLen(v) + STEADY;
    const path = Path.build([
      { kind: 'line', len: gateAt },
      { kind: 'shift', len: SHIFT, offset: LANE },
      { kind: 'line', len: MID },
      { kind: 'shift', len: SHIFT, offset: -LANE },
      { kind: 'line', len: OUT },
    ]);
    const road = Path.build([{ kind: 'line', len: gateAt + 2 * SHIFT + MID + OUT }]);
    const cones: number[] = [];
    edgeCones(path, gateAt - 15, gateAt, 5, GATE, cones);
    edgeCones(path, gateAt + SHIFT, gateAt + SHIFT + MID, 6.25, GATE, cones);
    edgeCones(path, gateAt + 2 * SHIFT + MID, gateAt + 2 * SHIFT + MID + 20, 5, GATE, cones);
    const end = gateAt + 2 * SHIFT + MID + 45;
    return {
      id: 'lane-change',
      kmh,
      path,
      road,
      roadWidth: 2 * LANE + 1,
      roadOffset: LANE / 2,
      lanes: [0],
      cones: Float64Array.from(cones),
      eventS: NaN,
      overview: [gateAt - 15, gateAt + 2 * SHIFT + MID + 25],
      duration:
        (end - gateAt + STEADY) / v + pullAwayLen(v) / (((1 + PULL_AWAY.start) / 2) * v) + 1,
      startS: 0,
      startV: v * PULL_AWAY.start,
      gripScaled: false,
      marks: () => [
        { s: 2, label: 'Accelerate', kind: 'drive' },
        { s: gateAt, label: 'Swerve left', kind: 'steer' },
        { s: gateAt + SHIFT + MID, label: 'Swerve back', kind: 'steer' },
      ],
      control(c, p, st, u, dt) {
        c.driver.steer(p, st, u, dt);
        pullAway(c.driver.s, v, target);
        c.driver.speed(p, st, u, target.v, target.a, dt);
        // phase 1 = inside the manoeuvre (for the summary window)
        const s = c.driver.s;
        c.phase = s >= gateAt - 5 && s <= end ? 1 : s > end ? 2 : 0;
      },
      summarize(tr) {
        return laneChangeResult(tr);
      },
    };
  },
};

/** Yaw-rate lag behind the steering (cross-correlation peak), peak body slip and path error. */
export function laneChangeResult(tr: Trace) {
  const idx: number[] = [];
  for (let i = 0; i < tr.t.length; i++) if (tr.phase[i] === 1) idx.push(i);
  const dt = tr.t[1] - tr.t[0];
  let bestLag = 0;
  let best = -Infinity;
  const corr: number[] = [];
  for (let lag = 0; lag * dt <= 0.6; lag++) {
    let sum = 0;
    for (const i of idx) if (i + lag < tr.t.length) sum += tr.steer[i] * tr.r[i + lag];
    corr.push(sum);
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }
  // parabolic refinement of the correlation peak: sub-sample lag
  let frac = 0;
  if (bestLag > 0 && bestLag < corr.length - 1) {
    const [y0, y1, y2] = [corr[bestLag - 1], corr[bestLag], corr[bestLag + 1]];
    const den = y0 - 2 * y1 + y2;
    if (den < 0) frac = (0.5 * (y0 - y2)) / den;
  }
  let maxSlip = 0;
  let maxErr = 0;
  let maxAy = 0;
  for (const i of idx) {
    maxSlip = Math.max(maxSlip, Math.abs(tr.beta[i]));
    maxErr = Math.max(maxErr, Math.abs(tr.err[i]));
    maxAy = Math.max(maxAy, Math.abs(tr.ay[i]));
  }
  return {
    values: {
      yawLag: (bestLag + frac) * dt * 1000,
      maxSlip: maxSlip * DEG_PER_RAD,
      pathError: maxErr,
      maxAy,
    },
    headline: 'yawLag' as const,
    spun: tr.beta.some((b) => Math.abs(b) > 1.2),
  };
}
