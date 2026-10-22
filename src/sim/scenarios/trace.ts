/** Recorded time histories of a headless run, plus the small statistics the scenarios use. */
import { axleUse, betaOf, frontLoadOf, RL, speedOf, FL, type CarState } from '../model/car';
import { G } from '../model/params';

export const TRACE_KEYS = [
  't',
  'x',
  'n',
  'yaw',
  'v',
  'r',
  'ay',
  'ax',
  'steer',
  'throttle',
  'brake',
  'beta',
  'useF',
  'useR',
  'alphaF',
  'alphaR',
  'front',
  's',
  'err',
  'roll',
  'pitch',
  'phase',
] as const;
export type TraceKey = (typeof TRACE_KEYS)[number];
/** SI units and radians, except ay/ax in g and front in 0..1. */
export type Trace = Record<TraceKey, number[]>;

export function emptyTrace(): Trace {
  return Object.fromEntries(TRACE_KEYS.map((k) => [k, [] as number[]])) as unknown as Trace;
}

export function record(tr: Trace, st: CarState, s: number, err: number, phase: number) {
  tr.t.push(st.t);
  tr.x.push(st.x);
  tr.n.push(st.n);
  tr.yaw.push(st.yaw);
  tr.v.push(speedOf(st));
  tr.r.push(st.r);
  tr.ay.push(st.ay / G);
  tr.ax.push(st.ax / G);
  tr.steer.push(st.steer);
  tr.throttle.push(st.throttle);
  tr.brake.push(st.brake);
  tr.beta.push(betaOf(st));
  tr.useF.push(axleUse(st, FL));
  tr.useR.push(axleUse(st, RL));
  tr.alphaF.push(st.alphaF);
  tr.alphaR.push(st.alphaR);
  tr.front.push(frontLoadOf(st));
  tr.s.push(s);
  tr.err.push(err);
  tr.roll.push(st.roll);
  tr.pitch.push(st.pitch);
  tr.phase.push(phase);
}

/** Index of the first sample at or after time t (length if none). */
export function indexAt(tr: Trace, t: number): number {
  let lo = 0;
  let hi = tr.t.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (tr.t[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Mean of f(i) over samples with t in [t0, t1). */
export function meanOver(tr: Trace, t0: number, t1: number, f: (i: number) => number): number {
  let sum = 0;
  let c = 0;
  for (let i = indexAt(tr, t0); i < tr.t.length && tr.t[i] < t1; i++) {
    sum += f(i);
    c++;
  }
  return c ? sum / c : NaN;
}

/** Max of f(i) over samples with t in [t0, t1). */
export function maxOver(tr: Trace, t0: number, t1: number, f: (i: number) => number): number {
  let best = -Infinity;
  for (let i = indexAt(tr, t0); i < tr.t.length && tr.t[i] < t1; i++) best = Math.max(best, f(i));
  return best;
}

/** Least-squares slope and intercept of y over x. */
export function linFit(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length;
  if (n < 2) return { slope: NaN, intercept: NaN };
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
  }
  const d = n * sxx - sx * sx;
  if (Math.abs(d) < 1e-12) return { slope: NaN, intercept: NaN };
  const slope = (n * sxy - sx * sy) / d;
  return { slope, intercept: (sy - slope * sx) / n };
}

export const DEG_PER_RAD = 180 / Math.PI;

/** Time the scripted event fired (first sample in phase >= 1), NaN if it never did. */
export function eventTime(tr: Trace): number {
  const i = tr.phase.findIndex((ph) => ph >= 1);
  return i < 0 ? NaN : tr.t[i];
}
