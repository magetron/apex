/**
 * Single-track ("bicycle") handling model with per-wheel loads, after Marco Monster's car
 * physics tutorial (spacejack/carphysics2d, MIT) — extended with load transfer, load-sensitive
 * tyres, friction ellipses on the driven wheels, AWD torque split and a simple ESC.
 *
 * Frame (ISO 8855): body x forward, y LEFT, yaw counter-clockwise from above. Ground position
 * (x, n) is the CG, with n = −Z of the 3D world. Each axle has one slip angle (single track),
 * but its two tyres carry different loads (lateral load transfer), so the four friction ellipses
 * the explorer draws are real.
 *
 * Deterministic and allocation-free per step: fixed dt, no randomness, all scratch preallocated.
 */
import { awdOut, awdSplit } from './awd';
import { engineBraking } from './overrun';
import { G, type AxleParams, type CarParams } from './params';
import { LONG_GRIP, muAt, tyreForce, type TyreOut } from './tyre';

/** 240 Hz: fast enough for the stiffest tyre at low speed with explicit integration. */
export const DT = 1 / 240;

/** Wheel order in every per-wheel array. */
export const FL = 0;
export const FR = 1;
export const RL = 2;
export const RR = 3;

export interface Inputs {
  /** road-wheel angle (rad, + = left) */
  steer: number;
  /** 0..1 */
  throttle: number;
  /** 0..1 (1 = full pedal; ABS keeps the tyres just below locking) */
  brake: number;
  /** stability control on */
  esc: boolean;
}

export interface CarState {
  t: number;
  /** CG on the ground (m) and heading (rad) */
  x: number;
  n: number;
  yaw: number;
  /** body-frame velocity at the CG (m/s) and yaw rate (rad/s) */
  vx: number;
  vy: number;
  r: number;
  /** body-frame accelerations, lagged like the suspension (m/s²); they drive load transfer */
  ax: number;
  ay: number;
  /** body attitude for the 3D pose (rad): roll + = leaning right, pitch + = nose up */
  roll: number;
  rollRate: number;
  pitch: number;
  pitchRate: number;
  wheelSpin: number;
  /** driver's road-wheel angle and pedal positions after ESC (for readouts) */
  steer: number;
  /** steering wound back by compliance under side load (rad); wheels point at steer − twist */
  twist: number;
  throttle: number;
  brake: number;
  /** axle slip angles (rad) */
  alphaF: number;
  alphaR: number;
  /** per wheel [FL, FR, RL, RR]: load, tyre-frame forces, grip available (N) */
  fz: Float64Array;
  fx: Float64Array;
  fy: Float64Array;
  cap: Float64Array;
  /** ESC intervention: corrective yaw moment (N·m), 0 when idle */
  escMoment: number;
  /** AWD device: 0 free … 1 rigid / clutch fully closed, and its dead-time clock (s) */
  awdLock: number;
  awdWait: number;
  /** body slip angle beyond ~70°: the car has spun and slides to a halt */
  spun: boolean;
  dist: number;
}

export function createState(): CarState {
  return {
    t: 0,
    x: 0,
    n: 0,
    yaw: 0,
    vx: 0,
    vy: 0,
    r: 0,
    ax: 0,
    ay: 0,
    roll: 0,
    rollRate: 0,
    pitch: 0,
    pitchRate: 0,
    wheelSpin: 0,
    steer: 0,
    twist: 0,
    throttle: 0,
    brake: 0,
    alphaF: 0,
    alphaR: 0,
    fz: new Float64Array(4),
    fx: new Float64Array(4),
    fy: new Float64Array(4),
    cap: new Float64Array(4),
    escMoment: 0,
    awdLock: 0,
    awdWait: 0,
    spun: false,
    dist: 0,
  };
}

/** Place the car at (x, n) heading `yaw`, rolling at speed v on a path of curvature `k` (1/m). */
export function resetState(
  s: CarState,
  p: CarParams,
  x: number,
  n: number,
  yaw: number,
  v: number,
  k = 0,
) {
  s.t = 0;
  s.x = x;
  s.n = n;
  s.yaw = yaw;
  s.vx = v;
  s.vy = 0;
  s.r = v * k;
  s.ax = 0;
  s.ay = v * v * k;
  s.roll = p.rollGain * s.ay;
  s.rollRate = 0;
  s.pitch = 0;
  s.pitchRate = 0;
  s.wheelSpin = 0;
  s.steer = p.L * k;
  s.twist = 0;
  s.throttle = 0;
  s.brake = 0;
  s.alphaF = 0;
  s.alphaR = 0;
  s.escMoment = 0;
  s.awdLock = 0;
  s.awdWait = 0;
  s.spun = false;
  s.dist = 0;
  staticLoads(p, s);
}

function staticLoads(p: CarParams, s: CarState) {
  const w = p.m * G;
  s.fz[FL] = s.fz[FR] = (w * p.b) / p.L / 2;
  s.fz[RL] = s.fz[RR] = (w * p.a) / p.L / 2;
  for (let i = 0; i < 4; i++) {
    const ax = i < 2 ? p.front : p.rear;
    s.cap[i] = muAt(ax.mu, s.fz[i], ax.fz0) * s.fz[i];
    s.fx[i] = 0;
    s.fy[i] = 0;
  }
}

/** Force the drivetrain can put down at speed v with the throttle wide open (N). */
export function driveAvailable(p: CarParams, v: number): number {
  const d = p.drive;
  const vv = Math.max(v, 1);
  if (d.kind === 'ev') {
    let f = 0;
    if (p.front.driven) f += Math.min(p.front.motorForceN, p.front.motorKw / vv);
    if (p.rear.driven) f += Math.min(p.rear.motorForceN, p.rear.motorKw / vv);
    return f;
  }
  return Math.min(d.forceN, d.powerW / vv);
}

/** Closed-throttle overrun force (N, positive number): engine braking or lift-off regen
 *  (overrun.ts), fading out at walking pace. */
export function overrun(p: CarParams, v: number): number {
  return engineBraking(p, v) * Math.min(1, v / 3);
}

/** Road-load resistance at speed v (N): rolling + aero. */
export function roadLoad(p: CarParams, v: number): number {
  return p.crr * p.m * G * Math.tanh(v / 0.5) + p.drag * v * Math.abs(v);
}

/** Throttle that makes the drivetrain deliver `force` newtons at speed v (0..1). */
export function throttleFor(p: CarParams, v: number, force: number): number {
  const fo = overrun(p, v);
  const span = driveAvailable(p, v) + fo;
  return span > 0 ? Math.min(1, Math.max(0, (force + fo) / span)) : 0;
}

// ── scratch (module-level so step() never allocates) ─────────────────────────────────────
const tyre: TyreOut = { fx: 0, fy: 0, cap: 0 };
const demand = new Float64Array(4);
const capNow = new Float64Array(4);
const LONG_SAT = 0.98;
const ESC_GAIN = 10;
const V_CHAR = 22;
/** the share of a tyre's grip it can drive with before it spins (tyre.ts LONG_LIN) */
const LONG_LIN_AXLE = 0.9;

/** Split one axle's drive demand between its wheels through a (partly locking) differential. */
function splitDiff(drive: number, i0: number, lsd: number) {
  const half = drive / 2;
  const capL = LONG_SAT * LONG_GRIP * capNow[i0];
  const capR = LONG_SAT * LONG_GRIP * capNow[i0 + 1];
  const weak = Math.min(capL, capR);
  if (Math.abs(half) <= weak) {
    demand[i0] += half;
    demand[i0 + 1] += half;
    return;
  }
  // the lighter-loaded wheel spins; the diff passes only part of the rest to the other one
  const strong = Math.sign(drive) * (weak + lsd * (Math.abs(drive) - 2 * weak));
  if (capL <= capR) {
    demand[i0] += half;
    demand[i0 + 1] += strong;
  } else {
    demand[i0] += strong;
    demand[i0 + 1] += half;
  }
}

function axleCapacity(i0: number) {
  return 0.9 * LONG_GRIP * (capNow[i0] + capNow[i0 + 1]);
}

/** Drive force an axle can still put down while it makes its share `side` (N) of the cornering
 *  force: what its friction ellipses leave (from the force it needs, not the force it makes, so
 *  a spinning axle that has dropped its side grip doesn't look like it has room). */
function driveRoom(i0: number, side: number) {
  const c = LONG_LIN_AXLE * (capNow[i0] + capNow[i0 + 1]);
  // friction ellipse: fore-aft radius LONG_GRIP × the side one
  return LONG_GRIP * Math.sqrt(Math.max(0, c * c - side * side));
}

function wheelLoads(
  axle: AxleParams,
  total: number,
  ay: number,
  m: number,
  h: number,
  i0: number,
  s: CarState,
) {
  const t = Math.max(0, total);
  const dz = (axle.rollShare * m * ay * h) / axle.track;
  // ay > 0 is a left turn: load moves to the right (outside) wheel
  let left = t / 2 - dz;
  let right = t / 2 + dz;
  if (left < 0) {
    left = 0;
    right = t;
  } else if (right < 0) {
    right = 0;
    left = t;
  }
  s.fz[i0] = left;
  s.fz[i0 + 1] = right;
  capNow[i0] = muAt(axle.mu, left, axle.fz0) * left;
  capNow[i0 + 1] = muAt(axle.mu, right, axle.fz0) * right;
}

/** Advance the car by dt seconds. Mutates `s`. */
export function step(p: CarParams, s: CarState, u: Inputs, dt = DT) {
  const { m, a, b, L, h } = p;
  const v = Math.hypot(s.vx, s.vy);
  const steer = Math.max(-p.steerMax, Math.min(p.steerMax, u.steer));
  // compliance: the front tyres' side force twists the steering back a little (lagged a
  // few ms, which also keeps the loop explicit)
  s.twist += (p.front.compliance * (s.fy[FL] + s.fy[FR]) - s.twist) * Math.min(1, dt / 0.02);
  const delta = steer - s.twist;
  const cosD = Math.cos(delta);
  const sinD = Math.sin(delta);

  // ── loads: static + longitudinal transfer m·ax·h/L + lateral transfer per axle ──
  const dzLong = (m * s.ax * h) / L;
  wheelLoads(p.front, (m * G * b) / L - dzLong, s.ay, m, h, FL, s);
  wheelLoads(p.rear, (m * G * a) / L + dzLong, s.ay, m, h, RL, s);

  if (!s.spun && v > 1.5 && Math.abs(Math.atan2(s.vy, s.vx)) > 1.2) s.spun = true;

  let throttle = Math.min(1, Math.max(0, u.throttle));
  const brake = Math.min(1, Math.max(0, u.brake));
  // a spun car slides to rest; once it has, pulling away drives on again (the scripted driver
  // keeps both feet in after a spin, so in practice only a visitor at the wheel does this)
  if (s.spun && v < 0.5 && throttle > 0.05) s.spun = false;
  demand.fill(0);

  // ── ESC: compare yaw rate with what the steering asks for; brake one wheel to correct ──
  s.escMoment = 0;
  if (u.esc && v > 3 && !s.spun) {
    const mu = 0.5 * (p.front.mu + p.rear.mu);
    const rLim = (0.85 * mu * G) / v;
    const rRef = Math.max(-rLim, Math.min(rLim, (v * steer) / (L * (1 + (v / V_CHAR) ** 2))));
    const e = s.r - rRef;
    const dead = 0.035 + 0.1 * Math.abs(rRef);
    if (Math.abs(e) > dead) {
      const ee = e - Math.sign(e) * dead;
      const mz = -ESC_GAIN * p.izz * ee;
      // reducing yaw = oversteer → outer front wheel; adding yaw = understeer → inner rear
      const reduces = mz * s.r < 0;
      const wheel = (reduces ? FL : RL) + (mz > 0 ? 0 : 1);
      const track = wheel < 2 ? p.front.track : p.rear.track;
      const fb = Math.min(Math.abs(mz) / (track / 2), 0.8 * LONG_GRIP * capNow[wheel]);
      demand[wheel] -= fb;
      s.escMoment = mz;
      throttle *= Math.max(0, 1 - Math.abs(ee) / 0.15);
    }
  }

  // ── drive: throttle → force, split front/rear, AWD moves what one axle can't use ──
  const fo = overrun(p, v);
  const fAvail = driveAvailable(p, v);
  const total = throttle * (fAvail + fo) - fo;
  const share = p.drive.frontShare;
  let fF = p.front.driven ? total * share : 0;
  let fR = p.rear.driven ? total * (1 - share) : 0;
  if (p.drive.kind === 'ev' && total > 0) {
    // each motor has its own limit; the other one takes up the rest if it can
    const capF = p.front.driven
      ? Math.min(p.front.motorForceN, p.front.motorKw / Math.max(v, 1))
      : 0;
    const capR = p.rear.driven ? Math.min(p.rear.motorForceN, p.rear.motorKw / Math.max(v, 1)) : 0;
    if (fF > capF) {
      fR = Math.min(capR, fR + fF - capF);
      fF = capF;
    } else if (fR > capR) {
      fF = Math.min(capF, fF + fR - capR);
      fR = capR;
    }
  }
  if (p.drive.awd && total !== 0) {
    // what each axle can still put down (or hold back, on the overrun) after its share of the
    // cornering force. Engine braking goes through the same coupling as drive, mirrored: a
    // centre diff splits it at its ratio, a clutch passes the secondary axle its share, locked
    // shafts send it where the load is, two motors' controller moves what one axle can't take
    const dir = total > 0 ? 1 : -1;
    const side = m * Math.abs(s.ay);
    const kF = driveRoom(FL, (side * b) / L);
    const kR = driveRoom(RL, (side * a) / L);
    if (p.drive.device) {
      const zF = s.fz[FL] + s.fz[FR];
      const loadF = zF / Math.max(1, zF + s.fz[RL] + s.fz[RR]);
      awdSplit(p.drive.device, dir * total, kF, kR, loadF, s, dt);
      fF = dir * awdOut.front;
      fR = dir * awdOut.rear;
    } else {
      // two motors, one controller: what one axle can't use goes to the other at once
      const exF = dir * fF - kF;
      const exR = dir * fR - kR;
      if (exF > 0 && exR < 0) {
        const moved = dir * Math.min(exF, -exR);
        fF -= moved;
        fR += moved;
      } else if (exR > 0 && exF < 0) {
        const moved = dir * Math.min(exR, -exF);
        fR -= moved;
        fF += moved;
      }
    }
  }
  if (u.esc && throttle > 0) {
    // traction control: no wheelspin
    fF = Math.sign(fF) * Math.min(Math.abs(fF), 0.85 * axleCapacity(FL));
    fR = Math.sign(fR) * Math.min(Math.abs(fR), 0.85 * axleCapacity(RL));
  }
  if (fF !== 0) splitDiff(fF, FL, p.drive.lsd);
  if (fR !== 0) splitDiff(fR, RL, p.drive.lsd);

  // ── brakes, with ABS holding each tyre just under its limit ──
  if (brake > 0) {
    const fb = brake * p.brakeN;
    for (let i = 0; i < 4; i++) {
      const share = (i < 2 ? p.front.brakeShare : p.rear.brakeShare) / 2;
      demand[i] -= Math.min(fb * share, 0.9 * LONG_GRIP * capNow[i]);
    }
  }
  // brakes and engine braking never push a stopped car backwards
  const fwd = Math.min(1, Math.max(0, s.vx / 0.5));
  for (let i = 0; i < 4; i++) if (demand[i] < 0) demand[i] *= fwd;

  // ── tyre forces ──
  const vyF = s.vy + a * s.r;
  const vyR = s.vy - b * s.r;
  const vlF = s.vx * cosD + vyF * sinD;
  const vtF = -s.vx * sinD + vyF * cosD;
  const alphaF = Math.atan2(vtF, Math.abs(vlF));
  const alphaR = Math.atan2(vyR, Math.abs(s.vx));
  // below walking pace the slip angle is meaningless: fade side forces in with speed
  const lowF = Math.min(1, Math.hypot(vlF, vtF) / 0.5);
  const lowR = Math.min(1, Math.hypot(s.vx, vyR) / 0.5);
  s.alphaF = alphaF;
  s.alphaR = alphaR;

  let fxB = 0;
  let fyB = 0;
  let mz = 0;
  for (let i = 0; i < 4; i++) {
    const front = i < 2;
    const ax = front ? p.front : p.rear;
    const y = (i % 2 === 0 ? 0.5 : -0.5) * ax.track;
    let fxT: number;
    let fyT: number;
    if (s.spun) {
      // sliding sideways with the brakes on: kinetic friction against the patch velocity
      const vl = front ? vlF : s.vx;
      const vt = front ? vtF : vyR;
      const sp = Math.max(0.5, Math.hypot(vl, vt));
      const f = 0.85 * capNow[i];
      fxT = (-f * vl) / sp;
      fyT = (-f * vt) / sp;
      tyre.cap = capNow[i];
    } else {
      tyreForce(s.fz[i], front ? alphaF : alphaR, demand[i], ax.mu, ax.fz0, tyre);
      fxT = tyre.fx;
      fyT = tyre.fy * (front ? lowF : lowR);
    }
    s.fx[i] = fxT;
    s.fy[i] = fyT;
    s.cap[i] = tyre.cap;
    const fxb = front ? fxT * cosD - fyT * sinD : fxT;
    const fyb = front ? fxT * sinD + fyT * cosD : fyT;
    fxB += fxb;
    fyB += fyb;
    mz += ax.x * fyb - y * fxb;
  }
  fxB -= roadLoad(p, s.vx);

  // ── integrate (semi-implicit Euler) ──
  const axB = fxB / m;
  const ayB = fyB / m;
  s.vx += (axB + s.r * s.vy) * dt;
  s.vy += (ayB - s.r * s.vx) * dt;
  s.r += (mz / p.izz) * dt;
  if (Math.hypot(s.vx, s.vy) < 0.15 && throttle < 0.02 && (brake > 0 || s.spun || s.vx < 0.15)) {
    s.vx = 0;
    s.vy = 0;
    s.r = 0;
  }
  const cy = Math.cos(s.yaw);
  const sy = Math.sin(s.yaw);
  s.x += (s.vx * cy - s.vy * sy) * dt;
  s.n += (s.vx * sy + s.vy * cy) * dt;
  s.yaw += s.r * dt;

  // suspension lag on the load-transfer accelerations
  s.ax += (axB - s.ax) * Math.min(1, dt / 0.1);
  s.ay += (ayB - s.ay) * Math.min(1, dt / 0.12);

  // body attitude: damped springs toward the steady roll/pitch for these accelerations
  const wRoll = 2 * Math.PI * 1.6;
  const wPitch = 2 * Math.PI * 1.8;
  s.rollRate += (wRoll * wRoll * (p.rollGain * s.ay - s.roll) - 2 * 0.55 * wRoll * s.rollRate) * dt;
  s.roll += s.rollRate * dt;
  s.pitchRate +=
    (wPitch * wPitch * (p.pitchGain * s.ax - s.pitch) - 2 * 0.6 * wPitch * s.pitchRate) * dt;
  s.pitch += s.pitchRate * dt;

  s.wheelSpin = (s.wheelSpin + (s.vx / p.wheelRadius) * dt) % (2 * Math.PI);
  s.steer = steer;
  s.throttle = throttle;
  s.brake = brake;
  s.dist += Math.hypot(s.vx, s.vy) * dt;
  s.t += dt;
}

/** Lateral acceleration in g, yaw rate in deg/s and friends: readouts shared by HUD and tests. */
export const speedOf = (s: CarState) => Math.hypot(s.vx, s.vy);
export const betaOf = (s: CarState) => (Math.hypot(s.vx, s.vy) > 0.5 ? Math.atan2(s.vy, s.vx) : 0);
/** Share of the car's weight on the front axle right now (0..1). */
export const frontLoadOf = (s: CarState) =>
  (s.fz[FL] + s.fz[FR]) / (s.fz[FL] + s.fz[FR] + s.fz[RL] + s.fz[RR] || 1);
/** How much of an axle's grip is in use (0..1+), from its two friction ellipses (a tyre brakes
 *  and drives LONG_GRIP × harder than it corners, so fore-aft force counts for less). */
export function axleUse(s: CarState, i0: number): number {
  const c = s.cap[i0] + s.cap[i0 + 1];
  if (c <= 0) return 1;
  return (
    (Math.hypot(s.fx[i0] / LONG_GRIP, s.fy[i0]) +
      Math.hypot(s.fx[i0 + 1] / LONG_GRIP, s.fy[i0 + 1])) /
    c
  );
}
