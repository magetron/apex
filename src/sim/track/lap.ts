/**
 * The test driver: a quasi-steady-state lap simulation, the standard method for lap time
 * estimates. Along the racing line, every point gets
 *  1. the highest speed the car can corner at there (its lateral grip, from lateralLimit() and
 *     the tyre model, with the drag it must still overcome);
 *  2. a forward pass: from each point the car accelerates as hard as it can to the next
 *     (engine power through a gearbox, traction of the driven wheels with load transfer, drag);
 *  3. a backward pass: the same for braking into every corner;
 * and drives the lower of the three. Grip is shared by each axle's friction ellipse (the car's
 * own tyre model: fore-aft LONG_GRIP × the side grip): what a corner takes from it is not there
 * to brake or accelerate with. Everything comes from the
 * car's spec through carParams(); no number is set per car.
 *
 * Three things keep it from being an idealised one, each the same for every car:
 *  - the driver: no one uses every last bit of the tyres at every point (turning from full
 *    braking to full cornering takes a real car time the quasi-steady model doesn't count), so
 *    the test driver uses DRIVER of the grip, said on screen;
 *  - the engine: a naturally aspirated engine's power falls away either side of its peak (the
 *    textbook full-load curve), a turbo's is near flat from its torque peak to the redline;
 *  - the gearbox: each upshift cuts the drive for SHIFT_S.
 *
 * Each point is also labelled with what held the car there (its `limit`): its grip in a corner,
 * its driven tyres (traction) or its engine (power) accelerating, its tyres braking.
 *
 * Deterministic: the same car on the same track gives the same lap to the last bit.
 */
import {
  G,
  gearRatios,
  lateralLimit,
  LONG_GRIP,
  muAt,
  type AxleParams,
  type CarParams,
} from '../model';
import type { Induction } from '../../spec/types';
import { BRAKE, GRIP, POWER, TRACTION } from './limits';
import type { RaceLine, TrackPath } from './types';

/** share of a tyre's grip it drives or brakes with before spinning or locking (tyre.ts) */
const LONG_USE = 0.9;
/** fixed-point rounds for longitudinal load transfer */
const ROUNDS = 4;
/**
 * Share of the tyres' grip the test driver uses, everywhere: a quasi-steady lap switches from
 * full braking to full cornering to full power instantly, a real car (and driver) can't, and a
 * driver on road tyres keeps a margin. One number for every car, said on screen.
 */
export const DRIVER = 0.95;
/** drive cut per upshift (s): between a twin-clutch box's ~0.1 s and a manual's ~0.4 s; the
 *  specs don't say which box a car has */
export const SHIFT_S = 0.2;
/**
 * A naturally aspirated engine's full-load power against speed, the textbook cubic
 * P/Pmax = x + x² − x³ (x = rpm over peak-power rpm): power peaks at x = 1, torque at x = ½ at
 * 1.25 Pmax/ω. The peak-power speed follows from the spec's torque and power (1.25 × their
 * ratio), never above 95% of the redline; torque never above the spec's.
 */
const naPower = (x: number) => Math.max(0, x + x * x - x * x * x);
const NA_PEAK_OF_REDLINE = 0.95;

/** Phase of a stretch of lap, as the time split counts it. */
export const PHASES = ['corner', 'straight', 'brake'] as const;
export type Phase = (typeof PHASES)[number];

export interface LapCar {
  p: CarParams;
  /** steady-state lateral limit (m/s²) */
  ayLim: number;
  /** how much of its friction circles an axle needs per newton of side force (≥ 1): the two
   *  tyres of an axle never peak at the same slip angle (calibrated to lateralLimit) */
  side: number;
  /** wheel-referenced engine: torque after the driveline (N·m), power (W), redline (rad/s) */
  torque: number;
  power: number;
  redline: number;
  idle: number;
  /** overall ratios, first gear first (one for an EV) */
  ratios: number[];
  /** top speed the gearing allows (m/s) */
  vTop: number;
  /** naturally aspirated: the full-load curve peaks at `peak` (rad/s); else flat power */
  na: boolean;
  peak: number;
  /** share of the grip used, and the drive cut per upshift (s) */
  driver: number;
  shift: number;
}

/** What the lap car is built with beyond CarParams (all optional: the model's own defaults). */
export interface LapOptions {
  induction?: Induction;
  driver?: number;
  shift?: number;
}

/** A hot lap: per sample of the track (n of them), plus the time at the line again (n + 1). */
export interface Lap {
  trackId: string;
  vehicleId: string;
  n: number;
  /** time at each sample (s); t[n] is the lap time */
  t: Float64Array;
  /** speed (m/s) */
  v: Float64Array;
  /** longitudinal and lateral acceleration (m/s²; ay + to the left) */
  ax: Float64Array;
  ay: Float64Array;
  /** 0..1 */
  throttle: Float64Array;
  brake: Float64Array;
  gear: Uint8Array;
  rpm: Float64Array;
  /** what the car is doing there (index into PHASES) */
  phase: Uint8Array;
  /** what holds it there (index into LIMITS: grip, traction, power, brake) */
  limit: Uint8Array;
  time: number;
  /** time per sector (s) */
  sectors: number[];
  /** where each sector starts (sample index) */
  sectorAt: number[];
  vMax: number;
  vMin: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Aerodynamic and rolling resistance at speed v (N). */
const resistance = (p: CarParams, v: number) => p.crr * p.m * G + p.drag * v * v;

// ── axles ────────────────────────────────────────────────────────────────────────────────

/** an axle's two tyres' side grip (N) after lateral load transfer: inner, outer */
const circle = { inner: 0, outer: 0 };

function axleCircles(p: CarParams, axle: AxleParams, load: number, ay: number) {
  const fz = Math.max(0, load);
  const dz = (axle.rollShare * p.m * Math.abs(ay) * p.h) / axle.track;
  const inner = Math.max(0, fz / 2 - dz);
  const outer = fz - inner;
  circle.inner = muAt(axle.mu, inner, axle.fz0) * inner * grip;
  circle.outer = muAt(axle.mu, outer, axle.fz0) * outer * grip;
}
/** the share of the grip in use (the driver's), set per lap */
let grip = 1;

/** Room left on an axle's two tyres for drive or braking force (N each), by friction ellipse. */
const room = { inner: 0, outer: 0 };

function axleRoom(car: LapCar, axle: AxleParams, load: number, ay: number, share: number) {
  const { p } = car;
  axleCircles(p, axle, load, ay);
  const cap = circle.inner + circle.outer;
  // the side force this axle carries, spread over its tyres by their grip
  const u = cap > 0 ? (car.side * p.m * Math.abs(ay) * share) / cap : 1;
  // the ellipse leaves √(1 − u²) of each tyre's fore-aft grip (LONG_GRIP × its side grip); ABS
  // and traction control use at most 90% of it
  const left = LONG_GRIP * Math.min(LONG_USE, Math.sqrt(Math.max(0, 1 - u * u)));
  room.inner = circle.inner * left;
  room.outer = circle.outer * left;
}

/**
 * Drive force an axle puts down when the engine sends it `f` newtons: the differential sends
 * half to each wheel; the inner one spins at its limit and a partly locking diff passes some of
 * the rest to the outer one.
 */
function throughDiff(f: number, lsd: number) {
  if (f / 2 <= room.inner) return f;
  return room.inner + Math.min(room.outer, room.inner + lsd * (f - 2 * room.inner));
}

// ── powertrain ───────────────────────────────────────────────────────────────────────────

/** Wheel force the engine can give at speed v in gear g (N); 0 past the redline. */
function gearForce(car: LapCar, v: number, g: number): number {
  const r = car.ratios[g];
  const w = (v / car.p.wheelRadius) * r;
  if (w > car.redline * 1.0001) return 0;
  // turbo: flat torque up to the power knee, then flat power; naturally aspirated: the
  // full-load curve (clutch slip below idle in first)
  const flat = car.power / Math.max(w, 1e-6);
  const curve = car.na ? (car.power * naPower(w / car.peak)) / Math.max(w, 1e-6) : flat;
  const torque = Math.min(car.torque, car.na && w > car.idle ? curve : flat);
  return (torque * r) / car.p.wheelRadius;
}

/** The best gear at speed v and the wheel force it gives. */
const pick = { gear: 0, force: 0 };

function bestGear(car: LapCar, v: number) {
  pick.gear = 0;
  pick.force = 0;
  for (let g = 0; g < car.ratios.length; g++) {
    const f = gearForce(car, v, g);
    if (f > pick.force) {
      pick.force = f;
      pick.gear = g;
    }
  }
  // past every gear's redline: the top one, at nothing
  if (pick.force === 0) pick.gear = car.ratios.length - 1;
}

/** The gear the forward pass has engaged (−1: free to use the best one at every speed). */
let engaged = -1;

/** Drive force available at speed v, before traction (N). EVs: per-axle motors. */
function engineForce(car: LapCar, v: number): number {
  const { p } = car;
  if (p.drive.kind === 'ev') {
    if (v > car.vTop) return 0;
    const vv = Math.max(v, 1);
    let f = 0;
    if (p.front.driven) f += Math.min(p.front.motorForceN, p.front.motorKw / vv);
    if (p.rear.driven) f += Math.min(p.rear.motorForceN, p.rear.motorKw / vv);
    return f;
  }
  if (engaged >= 0) return gearForce(car, v, engaged);
  bestGear(car, v);
  return pick.force;
}

export function lapCar(p: CarParams, o: LapOptions = {}): LapCar {
  const d = p.drive;
  const driver = o.driver ?? DRIVER;
  const ayLim = lateralLimit(p) * driver;
  const redline = (d.redlineRpm * 2 * Math.PI) / 60;
  const idle = (d.idleRpm * 2 * Math.PI) / 60;
  // engine torque after the driveline (carParams' launch force is torque × first gear)
  const torque = (d.forceN * p.wheelRadius) / d.lowRatio;
  // the model's one gearbox (sim/model/gearbox.ts), shared with the drive
  const { ratios, vTop } = gearRatios(p);
  const na = d.kind === 'ice' && o.induction === 'na';
  const peak = Math.min(NA_PEAK_OF_REDLINE * redline, (1.25 * d.powerW) / Math.max(1, torque));
  const car: LapCar = {
    p,
    ayLim,
    side: 1,
    torque,
    power: d.powerW,
    redline,
    idle,
    ratios,
    vTop,
    na,
    peak,
    driver,
    shift: d.kind === 'ev' ? 0 : (o.shift ?? SHIFT_S),
  };
  // calibrate the side-force share so that pure cornering peaks exactly at the driver's share
  // of lateralLimit()
  grip = driver;
  let lo = 0.8;
  let hi = 1.5;
  for (let i = 0; i < 30; i++) {
    car.side = (lo + hi) / 2;
    if (cornerOk(car, ayLim, 0)) lo = car.side;
    else hi = car.side;
  }
  car.side = lo;
  return car;
}

/** Can both axles hold lateral acceleration ay (m/s²) with longitudinal acceleration ax? */
function cornerOk(car: LapCar, ay: number, ax: number): boolean {
  const { p } = car;
  const dz = (p.m * ax * p.h) / p.L;
  const front = (p.m * G * p.b) / p.L - dz;
  const rear = (p.m * G * p.a) / p.L + dz;
  axleCircles(p, p.front, front, ay);
  if (car.side * p.m * Math.abs(ay) * (p.b / p.L) > circle.inner + circle.outer) return false;
  axleCircles(p, p.rear, rear, ay);
  return car.side * p.m * Math.abs(ay) * (p.a / p.L) <= circle.inner + circle.outer;
}

/** The most drive force the tyres put down at (v, ay, ax) (N), engine limits included. */
function traction(car: LapCar, v: number, ay: number, ax: number): number {
  const { p } = car;
  const dz = (p.m * ax * p.h) / p.L;
  const loadF = (p.m * G * p.b) / p.L - dz;
  const loadR = (p.m * G * p.a) / p.L + dz;
  const shareF = p.b / p.L;
  const shareR = p.a / p.L;
  const d = p.drive;
  if (d.kind === 'ev') {
    // a motor per driven axle; each puts down what its own tyres take
    const vv = Math.max(v, 1);
    let f = 0;
    if (p.front.driven) {
      axleRoom(car, p.front, loadF, ay, shareF);
      f += throughDiff(Math.min(p.front.motorForceN, p.front.motorKw / vv), d.lsd);
    }
    if (p.rear.driven) {
      axleRoom(car, p.rear, loadR, ay, shareR);
      f += throughDiff(Math.min(p.rear.motorForceN, p.rear.motorKw / vv), d.lsd);
    }
    return v > car.vTop ? 0 : f;
  }
  const engine = engineForce(car, v);
  if (!d.awd) {
    const axle = p.front.driven ? p.front : p.rear;
    axleRoom(car, axle, p.front.driven ? loadF : loadR, ay, p.front.driven ? shareF : shareR);
    return throughDiff(engine, d.lsd);
  }
  // all-wheel drive: the device's front share, within its range, set where it puts down most
  const lo = d.device?.lo ?? d.frontShare;
  const hi = d.device?.hi ?? d.frontShare;
  let best = 0;
  for (let k = 0; k <= 4; k++) {
    const s = lo + ((hi - lo) * k) / 4;
    axleRoom(car, p.front, loadF, ay, shareF);
    let f = throughDiff(engine * s, d.lsd);
    axleRoom(car, p.rear, loadR, ay, shareR);
    f += throughDiff(engine * (1 - s), d.lsd);
    best = Math.max(best, f);
  }
  return best;
}

/** The most braking force the tyres take at (v, ay, ax) (N): ABS on each wheel, fixed balance. */
function braking(car: LapCar, ay: number, ax: number): number {
  const { p } = car;
  const dz = (p.m * ax * p.h) / p.L;
  let f = 0;
  axleRoom(car, p.front, (p.m * G * p.b) / p.L - dz, ay, p.b / p.L);
  f += Math.min((p.brakeN * p.front.brakeShare) / 2, room.inner);
  f += Math.min((p.brakeN * p.front.brakeShare) / 2, room.outer);
  axleRoom(car, p.rear, (p.m * G * p.a) / p.L + dz, ay, p.a / p.L);
  f += Math.min((p.brakeN * p.rear.brakeShare) / 2, room.inner);
  f += Math.min((p.brakeN * p.rear.brakeShare) / 2, room.outer);
  return f;
}

/** Hardest acceleration at speed v on curvature k (m/s², may be negative: drag wins). */
function accel(car: LapCar, v: number, k: number): number {
  const { p } = car;
  const ay = v * v * k;
  let ax = 0;
  for (let i = 0; i < ROUNDS; i++) ax = (traction(car, v, ay, ax) - resistance(p, v)) / p.m;
  return ax;
}

/** Hardest deceleration at speed v on curvature k (m/s², positive). */
function decel(car: LapCar, v: number, k: number): number {
  const { p } = car;
  const ay = v * v * k;
  let ax = 0;
  for (let i = 0; i < ROUNDS; i++) ax = -(braking(car, ay, ax) + resistance(p, v)) / p.m;
  return -ax;
}

/** Highest speed the car can hold on curvature k: grip, and drive left to beat the drag. */
function cornerSpeed(car: LapCar, k: number): number {
  const ak = Math.abs(k);
  let hi = car.vTop;
  if (ak * hi * hi <= car.ayLim && traction(car, hi, ak * hi * hi, 0) >= resistance(car.p, hi))
    return hi;
  let lo = 0;
  for (let i = 0; i < 40; i++) {
    const v = (lo + hi) / 2;
    const ay = ak * v * v;
    if (cornerOk(car, ay, 0) && traction(car, v, ay, 0) >= resistance(car.p, v)) lo = v;
    else hi = v;
  }
  return lo;
}

/** Drive the line flat out (see the header). */
export function simulateLap(path: TrackPath, line: RaceLine, car: LapCar, trackId = path.id): Lap {
  const { p } = car;
  grip = car.driver;
  const n = line.n;
  const { k, seg } = line;
  const vmax = new Float64Array(n);
  let slow = 0;
  for (let i = 0; i < n; i++) {
    vmax[i] = cornerSpeed(car, k[i]);
    if (vmax[i] < vmax[slow]) slow = i;
  }
  // the slowest point is driven at its limit: start both passes there (a flying lap)
  const fwd = new Float64Array(n);
  const gear = new Uint8Array(n);
  /** where an upshift is cutting the drive in the forward pass */
  const shifting = new Uint8Array(n);
  fwd[slow] = vmax[slow];
  const ice = p.drive.kind === 'ice';
  bestGear(car, fwd[slow]);
  let gearNow = pick.gear;
  let cut = 0;
  /** the speed of the last upshift */
  let upAt = Infinity;
  for (let j = 1; j < n; j++) {
    const i = (slow + j) % n;
    const h = (i - 1 + n) % n;
    const v0 = fwd[h];
    if (ice) {
      // the gear stays in until the next one pulls harder (or the redline); an upshift under
      // power cuts the drive for a moment, a downshift is free (it happens on the brakes)
      const now = gearForce(car, v0, gearNow);
      // (down only once the car has slowed well below where it last went up, as on the
      // brakes into a corner: never back and forth across a shift point)
      if (v0 < 0.85 * upAt)
        while (gearNow > 0 && gearForce(car, v0, gearNow - 1) > now * 1.001) gearNow--;
      if (gearNow + 1 < car.ratios.length && gearForce(car, v0, gearNow + 1) > now) {
        gearNow++;
        upAt = v0;
        if (fwd[h] < vmax[h] * (1 - 1e-9)) cut = car.shift;
      }
      gear[i] = gearNow + 1;
    }
    if (cut > 0) {
      // rolling through the shift: only drag and rolling resistance
      const a = -resistance(p, v0) / p.m;
      fwd[i] = Math.min(vmax[i], Math.sqrt(Math.max(0, v0 * v0 + 2 * a * seg[h])));
      cut -= seg[h] / Math.max(1, v0);
      shifting[i] = 1;
      continue;
    }
    // two-stage (Heun) step in v², in the gear engaged
    engaged = ice ? gearNow : -1;
    const a0 = accel(car, v0, k[h]);
    const v1 = Math.sqrt(Math.max(0, v0 * v0 + 2 * a0 * seg[h]));
    const a1 = accel(car, Math.min(v1, vmax[i]), k[i]);
    engaged = -1;
    fwd[i] = Math.min(vmax[i], Math.sqrt(Math.max(0, v0 * v0 + (a0 + a1) * seg[h])));
  }
  const bwd = new Float64Array(n);
  bwd[slow] = vmax[slow];
  for (let j = 1; j < n; j++) {
    const i = (slow - j + n) % n;
    const h = (i + 1) % n;
    const v0 = bwd[h];
    const d0 = decel(car, v0, k[h]);
    const v1 = Math.sqrt(v0 * v0 + 2 * d0 * seg[i]);
    const d1 = decel(car, Math.min(v1, vmax[i]), k[i]);
    bwd[i] = Math.min(vmax[i], Math.sqrt(v0 * v0 + (d0 + d1) * seg[i]));
  }

  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.max(0.5, Math.min(fwd[i], bwd[i]));

  const t = new Float64Array(n + 1);
  const ax = new Float64Array(n);
  const ay = new Float64Array(n);
  const throttle = new Float64Array(n);
  const brake = new Float64Array(n);
  const rpm = new Float64Array(n);
  const phase = new Uint8Array(n);
  const limit = new Uint8Array(n);
  let vMax = 0;
  let vMin = Infinity;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const vi = v[i];
    t[i + 1] = t[i] + (2 * seg[i]) / (vi + v[j]);
    const a = (v[j] * v[j] - vi * vi) / (2 * seg[i]);
    ax[i] = a;
    ay[i] = vi * vi * k[i];
    // what the pedals do for that: drive force over what the engine has, or braking force
    // over what the tyres take
    const need = p.m * a + resistance(p, vi);
    if (p.drive.kind === 'ice' && gear[i]) engaged = gear[i] - 1;
    if (need >= 0) throttle[i] = clamp(need / Math.max(1, engineForce(car, vi)), 0, 1);
    else brake[i] = clamp(-need / Math.max(1, braking(car, ay[i], a)), 0, 1);
    if (p.drive.kind === 'ev') {
      gear[i] = 1;
      rpm[i] = ((vi / p.wheelRadius) * car.ratios[0] * 60) / (2 * Math.PI);
    } else {
      // braking, the box goes down through the gears as it would to pull away again
      if (bwd[i] < fwd[i] - 1e-9 || !gear[i]) {
        bestGear(car, vi);
        gear[i] = pick.gear + 1;
      }
      const w = (vi / p.wheelRadius) * car.ratios[gear[i] - 1];
      rpm[i] = (clamp(w, car.idle, car.redline) * 60) / (2 * Math.PI);
    }
    // what held it here: braking (any slowing beyond the drag); the cornering limit (riding the
    // highest speed the corner allows: grip, or on a straight the engine against the drag); or
    // accelerating as hard as the driven tyres or the engine allow, whichever gave out first
    const fv = fwd[i];
    if (brake[i] > 0) limit[i] = BRAKE;
    else if (fv >= vmax[i] * (1 - 1e-9)) {
      // the tyres if a little more speed would not hold the corner, else the engine
      const vv = vmax[i] * 1.01;
      limit[i] = cornerOk(car, Math.abs(k[i]) * vv * vv, 0) ? POWER : GRIP;
    } else if (shifting[i]) limit[i] = POWER;
    else
      limit[i] = traction(car, vi, ay[i], ax[i]) < 0.995 * engineForce(car, vi) ? TRACTION : POWER;
    engaged = -1;
    phase[i] =
      brake[i] > 0.05
        ? PHASES.indexOf('brake')
        : Math.abs(ay[i]) > 0.5 * car.ayLim
          ? PHASES.indexOf('corner')
          : PHASES.indexOf('straight');
    vMax = Math.max(vMax, vi);
    vMin = Math.min(vMin, vi);
  }
  const sectorAt = path.sectors.map((s) => Math.round(s / path.ds) % n);
  const ends = [...sectorAt.slice(1), n];
  const sectors = sectorAt.map((i0, s) => t[ends[s]] - t[i0]);
  return {
    trackId,
    vehicleId: p.id,
    n,
    t,
    v,
    ax,
    ay,
    throttle,
    brake,
    gear,
    rpm,
    phase,
    limit,
    time: t[n],
    sectors,
    sectorAt,
    vMax,
    vMin,
  };
}
