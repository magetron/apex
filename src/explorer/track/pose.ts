/**
 * Where a car is on the racing line at a moment of its hot lap, allocation-free: the lap's time
 * trace says how far it has got, the line says where that is and which way it points. Past the
 * line a car eases off and rolls on down the road (so finishers don't pile up on the line).
 * World frame as the explorer's: X = x, Z = −y, yaw about +Y.
 */
import { sampleAt, type Lap, type RaceLine } from '../../sim/track';

export interface RacerPose {
  /** world position of the wheelbase middle (m) and heading (rad) */
  x: number;
  z: number;
  yaw: number;
  /** sample index along the line (fractional, within the lap) and whether the car is home */
  at: number;
  laps: number;
  /** what the car does there (interpolated) */
  v: number;
  ax: number;
  ay: number;
  rpm: number;
  throttle: number;
  brake: number;
  gear: number;
  /** the line's curvature there (1/m, + left; interpolated) */
  k: number;
}

export const newPose = (): RacerPose => ({
  x: 0,
  z: 0,
  yaw: 0,
  at: 0,
  laps: 0,
  v: 0,
  ax: 0,
  ay: 0,
  rpm: 0,
  throttle: 0,
  brake: 0,
  gear: 1,
  k: 0,
});

/** how hard a car slows once home (m/s²): off the power, a dab of brake */
const COAST = 3;

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** distance along the line to each sample (m), n + 1 values */
const along = new WeakMap<RaceLine, Float64Array>();
function distances(line: RaceLine): Float64Array {
  let d = along.get(line);
  if (!d) {
    d = new Float64Array(line.n + 1);
    for (let i = 0; i < line.n; i++) d[i + 1] = d[i] + line.seg[i];
    along.set(line, d);
  }
  return d;
}

/** fractional sample at distance s along the line from the start (s < the line's length) */
function sampleOfDistance(line: RaceLine, s: number): number {
  const d = distances(line);
  let lo = 0;
  let hi = line.n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (d[mid] <= s) lo = mid;
    else hi = mid;
  }
  return lo + (s - d[lo]) / Math.max(1e-9, d[lo + 1] - d[lo]);
}

/** where a sample index falls: the samples either side and how far between (reused) */
const between = { i: 0, j: 0, u: 0 };

/**
 * The car at a fractional sample along the line. Between two samples it follows the curve the
 * line's headings there describe (a cubic Hermite, each end's tangent along its heading), not the
 * straight chord: on chords a car (and the camera chasing it) changes direction in a kink at every
 * sample, several times a second through a corner.
 */
function place(line: RaceLine, at: number, out: RacerPose) {
  const n = line.n;
  const i = Math.floor(at) % n;
  const j = (i + 1) % n;
  const u = at - Math.floor(at);
  // the heading the shorter way round (the line's heading is unwrapped along the lap)
  const h0 = line.psi[i];
  let d = line.psi[j] - h0;
  d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
  const len = line.seg[i];
  const u2 = u * u;
  const u3 = u2 * u;
  const a1 = 3 * u2 - 2 * u3;
  const t0 = (u3 - 2 * u2 + u) * len;
  const t1 = (u3 - u2) * len;
  const h1 = h0 + d;
  out.x = line.x[i] + (line.x[j] - line.x[i]) * a1 + t0 * Math.cos(h0) + t1 * Math.cos(h1);
  out.z = -(line.y[i] + (line.y[j] - line.y[i]) * a1 + t0 * Math.sin(h0) + t1 * Math.sin(h1));
  out.yaw = h0 + d * u;
  out.k = lerp(line.k[i], line.k[j], u);
  between.i = i;
  between.j = j;
  between.u = u;
  return between;
}

/** The pose `t` seconds into the laps (all cars leave the line together at 0). */
export function poseAt(line: RaceLine, lap: Lap, t: number, out: RacerPose): RacerPose {
  if (t >= lap.time) {
    // home: easing off down the road from the line
    const v0 = lap.v[0];
    const tau = Math.min(t - lap.time, v0 / COAST);
    const s = Math.min(line.length * 0.9, v0 * tau - 0.5 * COAST * tau * tau);
    const at = sampleOfDistance(line, s);
    const { i } = place(line, at, out);
    out.at = at;
    out.laps = 1;
    out.v = Math.max(0, v0 - COAST * tau);
    out.ax = out.v > 0 ? -COAST : 0;
    out.ay = lap.ay[i] * (out.v / Math.max(1, lap.v[i])) ** 2;
    out.rpm = lap.rpm[0] * (out.v / Math.max(1, v0));
    out.throttle = 0;
    out.brake = out.v > 0 ? 0.25 : 0;
    out.gear = lap.gear[i];
    return out;
  }
  const f = sampleAt(lap, Math.max(0, t));
  const n = lap.n;
  out.laps = Math.floor(f / n);
  const at = f - out.laps * n;
  const { i, j, u } = place(line, at, out);
  out.at = at;
  out.v = lerp(lap.v[i], lap.v[j], u);
  out.ax = lerp(lap.ax[i], lap.ax[j], u);
  out.ay = lerp(lap.ay[i], lap.ay[j], u);
  out.rpm = lerp(lap.rpm[i], lap.rpm[j], u);
  out.throttle = lap.throttle[i];
  out.brake = lap.brake[i];
  out.gear = lap.gear[i];
  return out;
}

/** Distance along the line at a fractional sample (m), for the wheels' roll. */
export const distanceAt = (line: RaceLine, at: number) => {
  const d = distances(line);
  const i = Math.min(line.n - 1, Math.floor(at));
  return d[i] + (d[i + 1] - d[i]) * (at - i);
};
