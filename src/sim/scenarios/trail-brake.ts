/**
 * Trail braking: brake while the car is turning (ISO 7975 "braking in a turn"), steering held.
 * Load moves onto the front tyres and off the rear ones, so the nose bites and the tail
 * lightens: the car turns in tighter. A light tail (front-engined cars) rotates readily; a heavy
 * one (rear-engined) barely does, which is why a 911 driver trails the brakes to get it turned.
 *
 * Slowing down alone tightens a line too (the same steering at a lower speed), so the lesson's
 * number is measured at matched speed: how much tighter the braked car turns than the same car
 * settles on at the speed it has slowed to, with the same steering and no brake.
 */
import {
  createState,
  DT,
  resetState,
  speedOf,
  step,
  type CarState,
  type Inputs,
} from '../model/car';
import { G, type CarParams } from '../model/params';
import {
  cornerPlan,
  cornerResult,
  LINE_M,
  sideways,
  withoutTechnique,
  type CornerSpec,
} from './corner';
import { Driver } from './driver';
import { Path, type PathPoint } from './path';
import { eventTime, meanOver, valueAt, type Trace } from './trace';
import type { ScenarioDef, ScenarioResult } from './types';

/** the same deceleration request for every car (g) */
export const TRAIL_DECEL = 0.3;
export const TRAIL_HOLD_S = 1.2;
/** how long the matched-speed reference settles (s), and the stretch it is averaged over */
const SETTLE_S = 3;
const AVG_S = 0.5;

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

const LINE = Path.build([{ kind: 'line', len: 10 }]);
const ref = createState();
const refU: Inputs = { steer: 0, throttle: 0, brake: 0, esc: false };

/**
 * The path curvature (1/m) the car settles on at speed v with its steering held at `steer` and
 * no brake (pedals just holding the speed): what speed and steering alone give.
 */
export function steadyCurvature(
  p: CarParams,
  v: number,
  steer: number,
  k0: number,
  /** the settled car itself (loads, slip, roll…), copied here when given */
  out?: CarState,
): number {
  resetState(ref, p, 0, 0, 0, v, k0);
  const d = new Driver(LINE);
  d.reset(0);
  let sum = 0;
  let n = 0;
  const steps = Math.round(SETTLE_S / DT);
  for (let i = 0; i < steps; i++) {
    refU.steer = steer;
    d.speed(p, ref, refU, v, 0, DT);
    step(p, ref, refU, DT);
    if (i >= steps - AVG_S / DT) {
      sum += ref.r / Math.max(1, speedOf(ref));
      n++;
    }
  }
  if (out) copyState(ref, out);
  return n ? sum / n : k0;
}

/** Copy one car state into another (its per-wheel arrays too). */
export function copyState(from: CarState, to: CarState): CarState {
  const { fz, fx, fy, cap } = to;
  Object.assign(to, from);
  to.fz = fz;
  to.fx = fx;
  to.fy = fy;
  to.cap = cap;
  fz.set(from.fz);
  fx.set(from.fx);
  fy.set(from.fy);
  cap.set(from.cap);
  return to;
}

/** speeds the matched-speed reference's curvature is worked out at, across the held window */
const REF_SPEEDS = 5;
const pp: PathPoint = { x: 0, n: 0, h: 0, k: 0 };

/** The ground path (x, n at each time) the same car would have driven through the held window
 *  without the brake, at the speed it actually had at each moment. */
export interface SameSpeedPath {
  t: number[];
  x: number[];
  n: number[];
  /** across the planned line at its end (m, + = inside the turn) */
  exitErr: number;
}

/**
 * The matched-speed reference as a path: from where the braked car was at the event, the line
 * it settles on at each moment's speed with the same steering and no brake (steadyCurvature),
 * driven at the braked car's own speed. Where the braked car ends up inside it is what the
 * brake did, beyond slowing down. Null without an event, or for a car that went round.
 */
export function sameSpeedPath(
  tr: Trace,
  p: CarParams,
  path: Path,
  /** up to this time, at most the end of the held wheel (where the summary measures it) */
  until = Infinity,
  /** how long the wheel is held (s): trail braking's, unless the question holds it otherwise */
  holdS = TRAIL_HOLD_S,
): SameSpeedPath | null {
  const te = eventTime(tr);
  if (!Number.isFinite(te) || tr.beta.some((b) => Math.abs(b) > 1.2)) return null;
  const t1 = Math.min(te + holdS, Math.max(te + 0.05, until));
  const at = (t: number, f: (i: number) => number) => valueAt(tr, t, f);
  const steer = meanOver(tr, te, te + 0.2, (i) => tr.steer[i]);
  const k0 = at(te, (i) => tr.r[i] / Math.max(1, tr.v[i]));
  // the curvature at a handful of speeds across the window, in between linearly
  let vLo = Infinity;
  let vHi = 0;
  for (let i = 0; i < tr.t.length; i++)
    if (tr.t[i] >= te && tr.t[i] <= t1) {
      vLo = Math.min(vLo, tr.v[i]);
      vHi = Math.max(vHi, tr.v[i]);
    }
  if (!(vHi > vLo)) vHi = vLo + 0.1;
  const ks: number[] = [];
  for (let j = 0; j < REF_SPEEDS; j++)
    ks.push(steadyCurvature(p, vLo + ((vHi - vLo) * j) / (REF_SPEEDS - 1), steer, k0));
  const kAt = (v: number) => {
    const f = Math.min(REF_SPEEDS - 1, Math.max(0, ((v - vLo) / (vHi - vLo)) * (REF_SPEEDS - 1)));
    const j = Math.min(REF_SPEEDS - 2, Math.floor(f));
    return ks[j] + (ks[j + 1] - ks[j]) * (f - j);
  };
  const out: SameSpeedPath = { t: [te], x: [], n: [], exitErr: NaN };
  let x = at(te, (i) => tr.x[i]);
  let n = at(te, (i) => tr.n[i]);
  // it sets off the way the braked car was going
  let h = at(te, (i) => tr.yaw[i] + tr.beta[i]);
  out.x.push(x);
  out.n.push(n);
  let t = te;
  for (let i = 0; i < tr.t.length && t < t1 - 1e-9; i++) {
    if (tr.t[i] <= t) continue;
    const tb = Math.min(t1, tr.t[i]);
    const dt = tb - t;
    const v = at((t + tb) / 2, (j) => tr.v[j]);
    const dh = kAt(v) * v * dt;
    h += dh / 2;
    x += Math.cos(h) * v * dt;
    n += Math.sin(h) * v * dt;
    h += dh / 2;
    t = tb;
    out.t.push(t);
    out.x.push(x);
    out.n.push(n);
  }
  const s = path.project(
    x,
    n,
    at(t1, (i) => tr.s[i]),
  );
  const side = Math.sign(meanOver(tr, te - 0.3, te, (i) => tr.r[i])) || 1;
  out.exitErr = side * path.lateral(x, n, s, pp);
  return out;
}

/**
 * The corner result, plus the brake's own effect: how much tighter (%) the line was at the end
 * of the held window than the same car's at that speed and steering without the brake, and (with
 * the plan's path) how far inside that matched-speed line it ended (m).
 */
export function trailResult(
  tr: Trace,
  p: CarParams,
  path?: Path,
  holdS = TRAIL_HOLD_S,
): ScenarioResult {
  const res = cornerResult(tr, holdS);
  const te = eventTime(tr);
  if (!Number.isFinite(te)) return res;
  const t1 = te + holdS;
  const k = (i: number) => tr.r[i] / Math.max(1, tr.v[i]);
  const k1 = meanOver(tr, t1 - 0.4, t1, k);
  const v1 = meanOver(tr, t1 - 0.4, t1, (i) => tr.v[i]);
  const steer = meanOver(tr, te, te + 0.2, (i) => tr.steer[i]);
  // a car that went round has no line to compare
  if (res.spun) return res;
  const kRef = steadyCurvature(p, v1, steer, k1);
  const tighter = 100 * (k1 / kRef - 1);
  if (Number.isFinite(tighter) && kRef > 0) res.values.sameSpeedTighter = tighter;
  const ref = path && sameSpeedPath(tr, p, path, Infinity, holdS);
  if (ref) res.values.sameSpeedShift = sideways(tr, te, t1).e1 - ref.exitErr;
  return res;
}

/** Tighter, wider or the same, by the matched-speed measure (the speed drop taken out): where
 *  the line ended against the same car's at that speed without the brake. */
export function trailVerdict(r: ScenarioResult) {
  const { sameSpeedShift = 0, slipChange = 0 } = r.values;
  if (r.spun) return 'spin' as const;
  if (slipChange > 4) return 'tail' as const;
  if (sameSpeedShift >= LINE_M) return 'tight' as const;
  if (sameSpeedShift <= -LINE_M) return 'wide' as const;
  return 'neutral' as const;
}

/** A corner plan whose line is judged at matched speed: against the same car at the speed it
 *  had at each moment, with the same steering and no brake (braking into a turn, left-foot
 *  braking: slowing down alone tightens a line). */
export const withMatchedSpeed = (spec: CornerSpec, kmh: number) => {
  const plan = cornerPlan(spec, kmh);
  plan.summarize = (tr, p) => trailResult(tr, p, plan.path, spec.holdS);
  return plan;
};
const withTrail = withMatchedSpeed;

export const trailBrake: ScenarioDef = {
  id: 'trail-brake',
  question: 'Can braking help you turn?',
  label: 'Trail braking',
  short: 'Trail',
  title: 'Braking in the turn, every car asks for the same deceleration, steering held',
  demand: `every car asks for the same ${TRAIL_DECEL} g of braking`,
  speed: { min: 45, max: 70, def: 60, label: 'Corner speed' },
  headline: 'sameSpeedTighter',
  // stopped as the held steering ends, where the summary measures the line: the two agree
  key: { at: 'event', before: 0.3, after: TRAIL_HOLD_S, freeze: TRAIL_HOLD_S - 0.02 },
  holdS: TRAIL_HOLD_S,
  event: 'Brake',
  radius: SPEC.radius,
  plan: (kmh) => withTrail(SPEC, kmh),
  // the same car at the braked car's speed, without the brake (the scene matches its speed:
  // explorer/drive/twin.ts); on its own, the same steering and no pedal action
  baseline: {
    label: "Car A's speed, no brake",
    plan: (kmh) => withTrail(withoutTechnique(SPEC), kmh),
  },
  verdict: trailVerdict,
};
