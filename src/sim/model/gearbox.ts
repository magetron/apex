/**
 * The gearbox, one rule for every car. The hot lap (track/lap.ts), engine braking (overrun.ts) and
 * the drive's dash and sound all use these ratios:
 *  - first gear tops out at the same road speed in every car (params.ts lowRatio), then even
 *    steps up to a top gear that just reaches the redline above the drag-limited top speed;
 *  - with the throttle closed the engine turns at LIFT_BAND of its redline (liftRatio);
 *  - otherwise the dash follows a generic automatic.
 * EVs have one reduction.
 */
import { G, type CarParams } from './params';

/** top gear reaches the redline this much above the drag-limited top speed */
const TOP_GEAR_MARGIN = 1.04;

export interface Gearing {
  /** overall ratios wheel → engine, first gear first (one for an EV) */
  ratios: number[];
  /** top speed the gearing allows (m/s) */
  vTop: number;
}

/** Rolling and aerodynamic resistance at speed v (N), as the hot lap counts it. */
const resistance = (p: CarParams, v: number) => p.crr * p.m * G + p.drag * v * v;

/** The car's gear ratios, worked out afresh (gearingOf() keeps one set per car). */
export function gearRatios(p: CarParams): Gearing {
  const d = p.drive;
  const redline = (d.redlineRpm * 2 * Math.PI) / 60;
  if (d.kind === 'ev')
    return { ratios: [d.lowRatio], vTop: (redline * p.wheelRadius) / d.lowRatio };
  // drag-limited top speed, then gears spaced evenly from first to a top gear that just
  // reaches the redline there: the same rule for every car
  let lo = 1;
  let hi = 200;
  for (let i = 0; i < 50; i++) {
    const v = (lo + hi) / 2;
    if (d.powerW / v > resistance(p, v)) lo = v;
    else hi = v;
  }
  const topRatio = (redline * p.wheelRadius) / (lo * TOP_GEAR_MARGIN);
  const step = Math.max(1.05, (d.lowRatio / topRatio) ** (1 / Math.max(1, d.gears - 1)));
  const ratios = Array.from({ length: d.gears }, (_, g) => d.lowRatio / step ** g);
  return { ratios, vTop: (redline * p.wheelRadius) / ratios[ratios.length - 1] };
}

const gearings = new WeakMap<CarParams, Readonly<Gearing>>();

/** The car's gear ratios, worked out once per CarParams (the sim steps read them every step). */
export function gearingOf(p: CarParams): Readonly<Gearing> {
  let g = gearings.get(p);
  if (!g) gearings.set(p, (g = gearRatios(p)));
  return g;
}

/**
 * Closed throttle, the engine turns at this share of its redline whatever the speed: the gear a
 * driver holds through a corner. 55% matches a 992 PDK in 2nd at about 65 km/h (~4,200 of
 * 7,500 rpm).
 */
export const LIFT_BAND = 0.55;

/**
 * The overall ratio the engine runs on with the throttle closed at speed v (m/s): the one that
 * holds it at LIFT_BAND of its redline, taken as continuous so engine braking varies smoothly with
 * speed (a discrete gear would change it by ~70% from one gear to the next, at one km/h); never
 * shorter than first gear nor taller than top.
 */
export function liftRatio(p: CarParams, v: number): number {
  const d = p.drive;
  if (d.kind === 'ev') return d.lowRatio;
  const { ratios } = gearingOf(p);
  const band = (LIFT_BAND * d.redlineRpm * 2 * Math.PI) / 60;
  const want = (band * p.wheelRadius) / Math.max(v, 0.1);
  return Math.min(ratios[0], Math.max(ratios[ratios.length - 1], want));
}

/** Throttle below this is a lift: the dash shows the engine on liftRatio(). */
const LIFTED = 0.05;
/** a gear change on the lift needs the new gear nearer by this share of a step (no flicker) */
const LIFT_HYSTERESIS = 0.1;

/** The gear (1-based) whose ratio is nearest r, in steps; stays in `now` unless another is
 *  clearly nearer. */
function nearestGear(ratios: readonly number[], r: number, now: number): number {
  let best = now;
  let dBest = Math.abs(Math.log(ratios[now - 1] / r));
  const dNow = dBest;
  for (let g = 1; g <= ratios.length; g++) {
    const dg = Math.abs(Math.log(ratios[g - 1] / r));
    if (dg < dBest) {
      best = g;
      dBest = dg;
    }
  }
  const step = ratios.length > 1 ? Math.log(ratios[0] / ratios[1]) : 1;
  return dNow - dBest > LIFT_HYSTERESIS * step ? best : now;
}

export interface GearState {
  gear: number;
}

/**
 * Engine (or motor) speed (rpm) at road speed `speed` (m/s), for the dash and the sound synth in
 * drive mode. On a lift it is what engine braking turns the engine at (liftRatio), in the gear
 * nearest that ratio; on the throttle a generic automatic picks the gear; EVs have one reduction.
 */
export function engineRpm(p: CarParams, speed: number, throttle: number, gs: GearState): number {
  const d = p.drive;
  const v = Math.max(0, speed);
  const wheelRpm = (v / p.wheelRadius) * (60 / (2 * Math.PI));
  if (d.kind === 'ev') return wheelRpm * d.lowRatio;
  const { ratios } = gearingOf(p);
  const n = ratios.length;
  gs.gear = Math.min(n, Math.max(1, Math.round(gs.gear) || 1));
  let ratio: number;
  if (throttle < LIFTED) {
    ratio = liftRatio(p, v);
    gs.gear = nearestGear(ratios, ratio, gs.gear);
  } else {
    // shift later the harder you push, like a real automatic
    const up = d.redlineRpm * (0.55 + 0.37 * throttle);
    const down = d.redlineRpm * 0.3;
    while (gs.gear < n && wheelRpm * ratios[gs.gear - 1] > up) gs.gear++;
    while (gs.gear > 1 && wheelRpm * ratios[gs.gear - 1] < down) gs.gear--;
    ratio = ratios[gs.gear - 1];
  }
  return Math.max(d.idleRpm, Math.min(d.redlineRpm, wheelRpm * ratio));
}
