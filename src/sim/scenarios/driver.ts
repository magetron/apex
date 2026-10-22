/**
 * The one test driver every car gets: a preview path follower that steers for yaw rate (with
 * an integral term, so it winds on whatever extra lock an understeering car needs and
 * counter-steers an oversteering one) and a speed controller working the pedals. Identical
 * gains for every car, so differences in what it has to do are the car's, not the driver's.
 */
import {
  betaOf,
  overrun,
  roadLoad,
  speedOf,
  throttleFor,
  type CarState,
  type Inputs,
} from '../model/car';
import type { CarParams } from '../model/params';
import type { Path, PathPoint } from './path';

const DRIVER = { preview: 0.55, previewMin: 5, kYaw: 1.4, kInt: 1.6 };
/** road-wheel steering rate limit (rad/s): a quick but human pair of hands */
const STEER_RATE = 0.8;
/** front slip angle the driver won't steer beyond (rad): just past the tyres' peak */
const FRONT_SLIP_MAX = 0.14;
const K_SPEED = 0.9;
const K_SPEED_I = 0.25;
/** body slip (rad) at which the driver treats it as a slide to catch */
const SLIDE_BETA = 0.08;

export class Driver {
  /** arc length of the car's projection on the path */
  s = 0;
  /** lateral offset from the path (m, + = left) */
  err = 0;
  private yawInt = 0;
  private speedInt = 0;
  private readonly pt: PathPoint = { x: 0, n: 0, h: 0, k: 0 };

  constructor(readonly path: Path) {}

  reset(s: number) {
    this.s = s;
    this.err = 0;
    this.yawInt = 0;
    this.speedInt = 0;
  }

  /** Keep track of where the car is along the path (call every step, steering or not). */
  track(st: CarState) {
    this.s = this.path.project(st.x, st.n, this.s);
    this.err = this.path.lateral(st.x, st.n, this.s, this.pt);
  }

  /** Steering that follows the path; writes u.steer (rate-limited from the current angle). */
  steer(p: CarParams, st: CarState, u: Inputs, dt: number) {
    const v = Math.max(3, speedOf(st));
    const look = Math.max(DRIVER.previewMin, DRIVER.preview * v);
    const pt = this.path.at(this.s + look, this.pt);
    const course = st.yaw + betaOf(st);
    const dx = pt.x - st.x;
    const dn = pt.n - st.n;
    const yc = -Math.sin(course) * dx + Math.cos(course) * dn;
    const kDes = (2 * yc) / Math.max(1, dx * dx + dn * dn);
    const er = v * kDes - st.r;
    this.yawInt = Math.max(-0.35, Math.min(0.35, this.yawInt + er * dt));
    const raw = p.L * kDes + (DRIVER.kYaw * p.L * er) / v + DRIVER.kInt * this.yawInt;
    let want = raw;
    if (v > 5) {
      // a driver feels the fronts wash out and stops adding lock past their peak slip
      const theta = Math.atan2(st.vy + p.a * st.r, st.vx) + st.twist;
      want = Math.max(theta - FRONT_SLIP_MAX, Math.min(theta + FRONT_SLIP_MAX, want));
    }
    want = Math.max(-p.steerMax, Math.min(p.steerMax, want));
    // no wind-up while the hands are at a limit
    if (want !== raw) this.yawInt -= er * dt;
    const maxStep = STEER_RATE * dt;
    u.steer = st.steer + Math.max(-maxStep, Math.min(maxStep, want - st.steer));
  }

  /** Pedals to track speed `target` (m/s) with feed-forward acceleration `aFf` (m/s²). */
  speed(p: CarParams, st: CarState, u: Inputs, target: number, aFf: number, dt: number) {
    if (st.spun) {
      // gone round: both feet in, and wait for it to stop
      u.throttle = 0;
      u.brake = 1;
      return;
    }
    const v = speedOf(st);
    const e = target - v;
    this.speedInt = Math.max(-1.5, Math.min(1.5, this.speedInt + e * dt));
    let aCmd = aFf + K_SPEED * e + K_SPEED_I * this.speedInt;
    // catching a slide: a balanced throttle (just holding speed), neither more power nor a lift
    // or a brake, either of which would throw more load off the rear tyres
    if (Math.abs(betaOf(st)) > SLIDE_BETA) {
      aCmd = 0;
      this.speedInt = Math.min(this.speedInt, 0);
    }
    this.accel(p, st, u, aCmd);
  }

  /** Pedals for a requested longitudinal acceleration (m/s²), same request for every car. */
  accel(p: CarParams, st: CarState, u: Inputs, aCmd: number) {
    const v = speedOf(st);
    const force = p.m * aCmd + roadLoad(p, v);
    const fo = overrun(p, v);
    if (force >= -fo) {
      u.throttle = throttleFor(p, v, force);
      u.brake = 0;
    } else {
      // closed throttle isn't enough: brake for the rest
      u.throttle = 0;
      u.brake = Math.min(1, (-force - fo) / p.brakeN);
    }
  }
}
