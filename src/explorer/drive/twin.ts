/**
 * Braking into a turn, car B by default is car A at car A's own speed without the brake: the
 * comparison the question's number is measured against, driven where you can see it. A real
 * car can't slow at the braked car's rate without braking, so through the held wheel car B is
 * the same car settled (steadyCurvature: the sim run to steady state) at each moment's speed
 * with the same steering and no brake, along the line that gives (sameSpeedPath, the very path
 * the number is measured to); before the brake it is car A's own run, and after the held wheel
 * its driver brings it back onto the line it aimed for, at car A's speed (car A's own steering
 * then answers car A's line, not this one's: copied, it would run car B off the road). Its loads,
 * slip and roll are the settled car's, never made up. Rebuilds car B's recording in place.
 */
import { betaOf, createState, speedOf, type CarState } from '../../sim/model';
import { offsetPoint, SCENARIOS, type PathPoint } from '../../sim/scenarios';
import { copyState, sameSpeedPath, steadyCurvature } from '../../sim/scenarios/trail-brake';
import { laneEventTime, type Lane } from './lanes';

/** speeds the settled car is worked out at across the held wheel */
const SPEEDS = 9;
/** after the held wheel, car B's driver takes it back to the planned line over about this long
 *  (s: the time constant of what is left of its offset) */
const SETTLE = 0.8;
const fa = createState();
const out = createState();
const pp: PathPoint = { x: 0, n: 0, h: 0, k: 0 };

/** Whether car B is the speed-matched twin (trail braking, B = car A without the brake). */
export const matchesSpeed = (lanes: readonly Lane[]) =>
  lanes.length === 2 &&
  (lanes[0].plan.id === 'trail-brake' || lanes[0].plan.id === 'left-foot') &&
  lanes[1].info.rival === 'without' &&
  !lanes[0].run.manual;

/** Make car B (b) the speed-matched twin of car A (a), both already driven. */
export function matchSpeedTwin(a: Lane, b: Lane): boolean {
  const ra = a.rec;
  const te = laneEventTime(a);
  if (!Number.isFinite(te) || ra.count < 2) return false;
  const tr = ra.toTrace(2);
  const ref = sameSpeedPath(tr, a.p, a.plan.path, Infinity, SCENARIOS[a.plan.id].holdS);
  if (!ref) return false;
  const t1 = ref.t[ref.t.length - 1];
  // the held steering, as the reference reads it
  let steer = 0;
  let ns = 0;
  for (let i = 0; i < tr.t.length; i++)
    if (tr.t[i] >= te && tr.t[i] < te + 0.2) {
      steer += tr.steer[i];
      ns++;
    }
  steer = ns ? steer / ns : 0;
  // the settled car at a handful of speeds across the window
  let vLo = Infinity;
  let vHi = 0;
  for (let i = ra.indexAt(te), m = ra.indexAt(t1); i <= m; i++) {
    ra.frame(i, fa);
    vLo = Math.min(vLo, speedOf(fa));
    vHi = Math.max(vHi, speedOf(fa));
  }
  if (!(vHi > vLo)) vHi = vLo + 0.1;
  ra.sample(te, fa);
  const k0 = fa.r / Math.max(1, speedOf(fa));
  const settled: { v: number; st: CarState }[] = [];
  for (let j = 0; j < SPEEDS; j++) {
    const v = vLo + ((vHi - vLo) * j) / (SPEEDS - 1);
    const st = createState();
    steadyCurvature(a.p, v, steer, k0, st);
    settled.push({ v, st });
  }
  const nearest = (v: number) =>
    settled.reduce((best, c) => (Math.abs(c.v - v) < Math.abs(best.v - v) ? c : best)).st;

  const path = a.plan.path;
  b.reset();
  b.rec.clear();
  let x = 0;
  let n = 0;
  let h: number;
  let tPrev = te;
  let s = 0;
  let started = false;
  /** after the held wheel: where it left the line it aimed for (m, + = left), and when */
  let e1 = NaN;
  let eLast = 0;
  for (let i = 0; i < ra.count; i++) {
    const t = ra.get(i, 't');
    ra.frame(i, fa);
    if (t <= te) {
      // before the brake: the same car, the same run
      b.rec.push(fa, ra.phaseAt(i), ra.sAt(i), ra.errAt(i));
      s = ra.sAt(i);
      continue;
    }
    const v = speedOf(fa);
    let phase: number;
    if (t <= t1) {
      // through the held wheel: on the matched-speed line, the settled car at this speed
      const k = Math.max(0, Math.min(ref.t.length - 2, upper(ref.t, t) - 1));
      const w = (t - ref.t[k]) / Math.max(1e-9, ref.t[k + 1] - ref.t[k]);
      const nx = ref.x[k] + (ref.x[k + 1] - ref.x[k]) * w;
      const nn = ref.n[k] + (ref.n[k + 1] - ref.n[k]) * w;
      h = started
        ? Math.atan2(nn - n, nx - x)
        : Math.atan2(ref.n[1] - ref.n[0], ref.x[1] - ref.x[0]);
      x = nx;
      n = nn;
      copyState(nearest(v), out);
      out.steer = steer;
      // a reference, not a driven car: no pedals (no car slows this fast without braking)
      out.brake = 0;
      out.throttle = 0;
      phase = 1;
    } else {
      // after it: along the planned line at car A's speed, what is left of its offset taken
      // back to nothing, as a driver would
      const dt = t - tPrev;
      if (!Number.isFinite(e1)) {
        e1 = path.lateral(x, n, s, pp);
        eLast = e1;
      }
      s += v * dt;
      const e = e1 * Math.exp(-(t - t1) / SETTLE);
      const [nx, nn] = offsetPoint(path, s, e, pp);
      h = pp.h + Math.atan2(e - eLast, Math.max(1e-3, v * dt));
      x = nx;
      n = nn;
      eLast = e;
      copyState(fa, out);
      phase = ra.phaseAt(i);
    }
    started = true;
    tPrev = t;
    const beta = betaOf(out);
    out.t = t;
    out.x = x;
    out.n = n;
    out.yaw = h - beta;
    out.vx = v * Math.cos(beta);
    out.vy = v * Math.sin(beta);
    // (after the held wheel: turning as the line does)
    out.r = phase === 1 ? out.r * (v / Math.max(1, speedOf(nearest(v)))) : path.at(s, pp).k * v;
    out.wheelSpin = fa.wheelSpin;
    out.dist = fa.dist;
    // (after the held wheel it is placed by its arc length: no need to find it)
    if (phase === 1) s = path.project(x, n, s);
    b.rec.push(out, phase, s, path.lateral(x, n, s, pp));
  }
  for (let i = 0; i < b.markT.length; i++) b.markT[i] = a.markT[i];
  b.show(0);
  return true;
}

/** Index of the first time in `ts` after t (ts ascending). */
function upper(ts: readonly number[], t: number): number {
  let lo = 0;
  let hi = ts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** After both cars have been driven: braking into a turn beside car A without the brake, make
 *  car B the speed-matched twin. */
export function pairLanes(lanes: readonly Lane[]): void {
  if (matchesSpeed(lanes)) matchSpeedTwin(lanes[0], lanes[1]);
}
