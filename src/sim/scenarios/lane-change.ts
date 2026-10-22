/**
 * Double lane change (ISO 3888-1 shape) at a steady speed, closed loop: the same driver steers
 * every car through the cones, for the picture. How quickly a car answers the wheel is measured
 * the standard way (ISO 7401 step steer): from straight at the same speed, the wheel turned
 * quickly to a fixed angle; the time from half the wheel's turn to the car reaching 90% of the
 * turn rate it settles at. Yaw inertia, wheelbase, mass and the tyres' cornering stiffness all
 * set it, as the model has them.
 */
import { createState, DT, resetState, step, type Inputs } from '../model/car';
import { G, type CarParams } from '../model/params';
import { edgeCones } from './cones';
import { PULL_AWAY, pullAway, pullAwayLen } from './corner';
import { Driver } from './driver';
import { Path } from './path';
import { DEG_PER_RAD, type Trace } from './trace';
import type { ScenarioDef, ScenarioResult } from './types';

/** the step steer: the wheel turned over this long (s) to the angle that asks for this much
 *  lateral acceleration (g), from this long running straight (s), watched for this long (s) */
const STEP_RAMP_S = 0.1;
const STEP_G = 0.4;
const STEP_LEAD_S = 0.5;
const STEP_RUN_S = 3;
/** the response time is to this share of the settled turn rate */
export const STEP_SHARE = 0.9;
const STRAIGHT = Path.build([{ kind: 'line', len: 10 }]);
const sst = createState();
const su: Inputs = { steer: 0, throttle: 0, brake: 0, esc: false };

/** What sets a car's step-steer response that another car can differ in. */
export type ResponseFactor = 'weight split' | 'yaw inertia' | 'tyres' | 'mass' | 'wheelbase';

/**
 * Which differences make car `slow` answer later than car `fast`, as the model has it: give the
 * faster car one of the slower car's traits at a time (its weight split, its yaw inertia for its
 * size, its tyres, its mass, its wheelbase), run the step steer again, and keep how much each
 * moves the time (s; + = it makes the faster car slower). Largest first.
 */
export function responseFactors(
  fast: CarParams,
  slow: CarParams,
  v: number,
): { factor: ResponseFactor; dt: number }[] {
  const base = stepSteerResponse(fast, v);
  const k = (p: CarParams) => p.izz / (p.m * p.a * p.b);
  const split = () => {
    const a = fast.L * (slow.a / slow.L);
    const b = fast.L - a;
    return {
      ...fast,
      a,
      b,
      izz: k(fast) * fast.m * a * b,
      front: { ...fast.front, x: a },
      rear: { ...fast.rear, x: -b },
    };
  };
  const wheelbase = () => {
    const s = slow.L / fast.L;
    return {
      ...fast,
      L: slow.L,
      a: fast.a * s,
      b: fast.b * s,
      izz: fast.izz * s * s,
      front: { ...fast.front, x: fast.a * s },
      rear: { ...fast.rear, x: -fast.b * s },
    };
  };
  const tries: [ResponseFactor, CarParams][] = [
    ['weight split', split()],
    ['yaw inertia', { ...fast, izz: k(slow) * fast.m * fast.a * fast.b }],
    [
      'tyres',
      {
        ...fast,
        front: { ...fast.front, fz0: slow.front.fz0, mu: slow.front.mu },
        rear: { ...fast.rear, fz0: slow.rear.fz0, mu: slow.rear.mu },
      },
    ],
    ['mass', { ...fast, m: slow.m, izz: fast.izz * (slow.m / fast.m) }],
    ['wheelbase', wheelbase()],
  ];
  return tries
    .map(([factor, p]) => ({ factor, dt: stepSteerResponse(p, v) - base }))
    .sort((x, y) => y.dt - x.dt);
}

/**
 * ISO 7401-style step-steer response time at speed v (s): from half the steering input to the
 * yaw rate first reaching STEP_SHARE of where it settles (the mean over the last half second).
 */
export function stepSteerResponse(p: CarParams, v: number): number {
  resetState(sst, p, 0, 0, 0, v, 0);
  const d = new Driver(STRAIGHT);
  d.reset(0);
  const delta = (p.L * STEP_G * G) / (v * v);
  const steps = Math.round((STEP_LEAD_S + STEP_RUN_S) / DT);
  const r: number[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i * DT;
    const w = Math.min(1, Math.max(0, (t - STEP_LEAD_S) / STEP_RAMP_S));
    su.steer = delta * w;
    d.speed(p, sst, su, v, 0, DT);
    step(p, sst, su, DT);
    r.push(sst.r);
  }
  const tail = Math.round(0.5 / DT);
  let final = 0;
  for (let i = r.length - tail; i < r.length; i++) final += r[i] / tail;
  if (!(Math.abs(final) > 1e-4)) return NaN;
  const t50 = STEP_LEAD_S + STEP_RAMP_S / 2;
  for (let i = 0; i < r.length; i++)
    if (r[i] / final >= STEP_SHARE) {
      // between this step and the one before
      const a = r[i - 1] / final;
      const f = (STEP_SHARE - a) / Math.max(1e-9, r[i] / final - a);
      return (i - 1 + f) * DT - t50;
    }
  return NaN;
}

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
  headline: 'yawResponse',
  // the first swerve: the wheel turns, the tail follows a moment later
  // a lag of tens of milliseconds shows in motion, slowed down, not in a still frame
  key: { at: 'event', before: 0.1, after: 1.6, label: 'Swerve', freeze: null },
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
      summarize(tr, p) {
        const res = laneChangeResult(tr);
        res.values.yawResponse = 1000 * stepSteerResponse(p, v);
        // the speed it is timed at (km/h)
        res.values.speedIn = 3.6 * v;
        return res;
      },
    };
  },
};

/** Yaw-rate lag behind the steering (cross-correlation peak), peak body slip and path error. */
export function laneChangeResult(tr: Trace): ScenarioResult {
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
    headline: 'yawResponse',
    spun: tr.beta.some((b) => Math.abs(b) > 1.2),
  };
}
