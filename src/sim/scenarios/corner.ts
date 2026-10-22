/**
 * The shape the technique scenarios share. The car drives a whole corner the way a test driver
 * would: accelerate up the entry straight, brake to the corner speed, turn in and settle on the
 * circle; then, at the marker, do one thing with the pedals while holding the steering still for
 * a moment (ISO 9816 / 7975 style), so what the car does next is the car's own doing; then the
 * driver steers again, and accelerates away down the exit straight. Every car gets the same
 * request (in g, or a time), never per-car tuning.
 */
import { speedOf, type CarState, type Inputs } from '../model/car';
import { G, type CarParams } from '../model/params';
import { edgeCones } from './cones';
import { Path } from './path';
import { DEG_PER_RAD, eventTime, maxOver, meanOver, type Trace } from './trace';
import type { Ctl, Mark, MetricId, Plan, ScenarioId, ScenarioResult } from './types';

export interface CornerSpec {
  id: ScenarioId;
  /** corner radius (m) and how far round it goes, and where the event happens (deg) */
  radius: number;
  arcDeg: number;
  eventDeg: number;
  /** the straight after the corner (m) */
  exit: number;
  /** what the event is, for its marker on the road ("Lift", "Throttle"…) */
  event?: string;
  /** steering held still for this long after the event (s) */
  holdS: number;
  duration?: number;
  /** the number the scenario leads with */
  headline?: MetricId;
  /** the pedals through the event (the steering is held by the plan); t = time since it */
  pedals(c: Ctl, p: CarParams, st: CarState, u: Inputs, t: number, dt: number): void;
}

const D2R = Math.PI / 180;
/** Run-up: start at `start` × the corner speed, accelerate (g) up to `peak` × it, then brake
 *  (g) to the corner speed `settle` metres before turn-in. */
export const RUN_UP = { start: 0.6, peak: 1.15, accel: 0.35, brake: 0.5, settle: 6 };
/** the entry straight (m): room for the run-up of the grippiest cars */
export const ENTRY = 60;
/** pulling away on the exit straight (g) */
const EXIT_ACCEL = 0.3;

/**
 * Target speed (m/s) and feed-forward acceleration (m/s²) at arc length s of a run-up that must
 * reach `vC` at `sTurn`. Writes into `out`.
 */
export function runUp(s: number, sTurn: number, vC: number, out: { v: number; a: number }) {
  const { start, peak, accel, brake, settle } = RUN_UP;
  const up = Math.sqrt((start * vC) ** 2 + 2 * accel * G * Math.max(0, s));
  const room = sTurn - settle - s;
  const down = Math.sqrt(vC * vC + 2 * brake * G * Math.max(0, room));
  const top = peak * vC;
  if (up <= down && up < top) {
    out.v = up;
    out.a = accel * G;
  } else if (down < top) {
    out.v = down;
    out.a = room > 0 ? -brake * G : 0;
  } else {
    out.v = top;
    out.a = 0;
  }
  return out;
}

/** Where a car with corner speed vC starts braking on the run-up (arc length, m). */
export function brakePoint(sTurn: number, vC: number): number {
  const { start, peak, accel, brake, settle } = RUN_UP;
  const ab = accel * G;
  const bb = brake * G;
  // the accelerating and braking curves cross here, unless the top speed comes first
  const cross =
    ((start * vC) ** 2 * bb + vC * vC * ab + 2 * ab * bb * (sTurn - settle)) / (ab + bb);
  const top = Math.min((peak * vC) ** 2, cross);
  return sTurn - settle - (top - vC * vC) / (2 * bb);
}

const target = { v: 0, a: 0 };

/** Straight-line tests pull away from this share of the test speed at this (g)… */
export const PULL_AWAY = { start: 0.7, accel: 0.4 };
/** …which takes this far (m) to reach speed v (m/s), plus a few metres to settle. */
export const pullAwayLen = (v: number) =>
  (v * v * (1 - PULL_AWAY.start ** 2)) / (2 * PULL_AWAY.accel * G) + 12;
/** Target speed and feed-forward on the pull-away at arc length s. */
export function pullAway(s: number, v: number, out: { v: number; a: number }) {
  const up = Math.sqrt((PULL_AWAY.start * v) ** 2 + 2 * PULL_AWAY.accel * G * Math.max(0, s));
  out.v = Math.min(v, up);
  out.a = up < v ? PULL_AWAY.accel * G : 0;
  return out;
}

/** The baseline twin: the same held steering through the window, the pedals left as they were
 *  (holding the speed it had). */
export function withoutTechnique(spec: CornerSpec): CornerSpec {
  return {
    ...spec,
    pedals(c, p, st, u, t, dt) {
      if (t === 0) c.memo = speedOf(st);
      c.driver.speed(p, st, u, c.memo, 0, dt);
    },
  };
}

export function cornerPlan(spec: CornerSpec, kmh: number): Plan {
  const { radius: R, holdS } = spec;
  const v = kmh / 3.6;
  const path = Path.build([
    { kind: 'line', len: ENTRY },
    { kind: 'arc', radius: R, angle: spec.arcDeg * D2R },
    { kind: 'line', len: spec.exit },
  ]);
  const eventS = ENTRY + R * spec.eventDeg * D2R;
  const arcEnd = ENTRY + R * spec.arcDeg * D2R;
  // the run-up, the corner, then a few seconds pulling away
  const duration = ENTRY / (((1 + RUN_UP.start) / 2) * v) + (R * spec.arcDeg * D2R) / v + 2.5;
  return {
    id: spec.id,
    kmh,
    path,
    road: path,
    roadWidth: 8,
    roadOffset: 0,
    lanes: [],
    cones: Float64Array.from(edgeCones(path, ENTRY - 10, arcEnd + 10, 6, 4.4)),
    eventS,
    // where the lines part: from just before the event to a little past the held window
    overview: [eventS - 10, Math.min(path.length, eventS + v * holdS + 18)],
    duration,
    startS: 0,
    startV: v * RUN_UP.start,
    gripScaled: true,
    marks(vScale) {
      const marks: Mark[] = [
        { s: 2, label: 'Accelerate', kind: 'drive' },
        { s: brakePoint(ENTRY, v * vScale), label: 'Brake', kind: 'brake' },
        { s: ENTRY, label: 'Turn in', kind: 'steer' },
        { s: eventS, label: spec.event ?? 'Event', kind: 'event', holdS },
        { s: arcEnd, label: 'Accelerate', kind: 'drive' },
      ];
      return marks;
    },
    control(c, p, st, u, dt) {
      const d = c.driver;
      if (c.phase === 0) {
        d.steer(p, st, u, dt);
        runUp(d.s, ENTRY, v * c.vScale, target);
        d.speed(p, st, u, target.v, target.a, dt);
        if (d.s >= eventS) {
          c.phase = 1;
          c.tEvent = st.t;
          c.hold = st.steer;
        }
      }
      if (c.phase === 1) {
        u.steer = c.hold;
        spec.pedals(c, p, st, u, st.t - c.tEvent, dt);
        if (st.t - c.tEvent >= holdS) {
          c.phase = 2;
          c.memo = speedOf(st);
        }
      } else if (c.phase === 2) {
        // the driver takes the wheel back, holds the speed it reached round the rest of the
        // corner, then pulls away down the exit straight
        d.steer(p, st, u, dt);
        if (d.s >= arcEnd) c.memo += EXIT_ACCEL * G * dt;
        d.speed(p, st, u, c.memo, d.s >= arcEnd ? EXIT_ACCEL * G : 0, dt);
      }
    },
    summarize(tr) {
      return cornerResult(tr, holdS, spec.headline);
    },
  };
}

/**
 * What the held-steering window did: the change in path curvature (r/V; < 0 runs wide, > 0
 * tightens), how far the tail swung out at most (body slip; + = tail out) and the yaw-rate
 * spike.
 */
export function cornerResult(
  tr: Trace,
  holdS: number,
  headline: MetricId = 'lineChange',
): ScenarioResult {
  const te = eventTime(tr);
  const k = (i: number) => tr.r[i] / Math.max(1, tr.v[i]);
  const k0 = meanOver(tr, te - 0.3, te, k);
  const k1 = meanOver(tr, te + holdS - 0.4, te + holdS, k);
  const b0 = meanOver(tr, te - 0.3, te, (i) => tr.beta[i]);
  const r0 = meanOver(tr, te - 0.3, te, (i) => tr.r[i]);
  return {
    values: {
      lineChange: 100 * (k1 / k0 - 1),
      // tail swinging out in a left turn is negative body slip; report it as positive
      slipChange: maxOver(tr, te, te + holdS, (i) => b0 - tr.beta[i]) * DEG_PER_RAD,
      yawSpike: maxOver(tr, te, te + holdS, (i) => tr.r[i] - r0) * DEG_PER_RAD,
    },
    headline,
    spun: tr.beta.some((b) => Math.abs(b) > 1.2),
  };
}

/** Line-change verdict: spun, tail out, tighter, wider or about the same. */
export function lineVerdict(r: ScenarioResult) {
  const { lineChange = 0, slipChange = 0 } = r.values;
  if (r.spun) return 'spin' as const;
  if (slipChange > 4) return 'tail' as const;
  if (lineChange > 10) return 'tight' as const;
  if (lineChange < -10) return 'wide' as const;
  return 'neutral' as const;
}
