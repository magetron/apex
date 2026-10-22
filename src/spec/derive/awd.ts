/**
 * How an AWD car splits drive torque between its axles when the grip under them differs, and how
 * quickly it reacts: the model behind the AWD explainer (part view of the centre diff/coupling).
 *
 * Torque is a share of what goes into the device at full throttle (1 = all of it). An axle can put
 * down at most grip × tyre μ × its load (static split, less the load that moves rearward as the
 * car accelerates), measured against one fixed demand (THRUST_G) for every car, so differences
 * come from the device and the weight split, not from the engine.
 *
 *   open            fixed split; the axle that runs out of grip caps the other one too
 *   torque-sensing  the split may move within its bias limits (Torsen), instantly
 *   locking-clutch  open split; a clutch locks it toward rigid once an axle spins (DCCD)
 *   viscous         the same, but the coupling only stiffens as slip builds, and never fully
 *   clutch          one axle driven directly; a clutch feeds the other its preload share, and
 *                   more (up to its range) a beat after the primary axle spins (Haldex, xDrive)
 *   locked          rigid shafts: torque goes where load and grip are; binds in tight turns
 *   motors          one motor per axle: neither can borrow the other's torque
 *
 * `t` is the time since the grip changed from dry (both axles 1) to the given grip, so a call is
 * one point of the step response; t = Infinity is the steady state.
 */
import { LONG_GRIP } from '../../sim/model/tyre';
import { getMotor } from '../catalog';
import type { AwdDevice, AwdDeviceType, AwdKind, Axle, VehicleSpec } from '../types';
import { layoutPowertrain } from './layout';
import { massProps } from './mass';

/** Nominal front torque share when the spec gives none. */
export const AWD_FRONT: Record<AwdKind, number> = {
  'clutch-on-demand': 0.9,
  'center-diff': 0.4,
  'rear-biased-clutch': 0.2,
  'dual-motor': 0.5,
  'transfer-case': 0.5,
};

/** What each AWD kind uses when the spec doesn't say (clutches: fully variable, as VW and Audi
 *  quote for Haldex 5 and the R8's front clutch). */
const DEFAULT_DEVICE: Record<Exclude<AwdKind, 'dual-motor'>, AwdDevice> = {
  'clutch-on-demand': { type: 'clutch', frontRange: [0, 1] },
  'rear-biased-clutch': { type: 'clutch', frontRange: [0, 1] },
  'center-diff': { type: 'open' },
  'transfer-case': { type: 'locked' },
};

/** ~ typical Torsen torque bias ratio (2.5–4:1), for a torque-sensing diff without limits. */
const DEFAULT_TBR = 3;

/** The traction the engine asks for (g); about what a quick AWD car manages off the line. */
export const THRUST_G = 0.5;
/** ~ tyre slip ratio at peak longitudinal grip: sets how stiffly locked shafts wind up. */
const KAPPA_PEAK = 0.1;
/** Rear-axle radius of the "tight turn" (m): a car-park manoeuvre at full lock. */
export const TIGHT_TURN_M = 6;

/** ~ How the reactive devices respond to wheelspin: dead time, time constant, and how far they
 *  go (1 = rigid or the clutch's full range). Electro-hydraulic clutches need a beat to build
 *  pressure; DCCD's electromagnetic clutch (with its mechanical LSD) is quicker; a viscous
 *  coupling stiffens only as the speed difference shears its fluid. */
export const AWD_RESPONSE = {
  clutch: { delayS: 0.12, tauS: 0.1, max: 1 },
  'locking-clutch': { delayS: 0.03, tauS: 0.08, max: 1 },
  viscous: { delayS: 0, tauS: 0.35, max: 0.8 },
} as const;

export type AwdModelType = AwdDeviceType | 'motors';

export interface AwdSystem {
  kind: AwdKind;
  type: AwdModelType;
  /** trade name from the spec ("DCCD", "GR-Four") */
  name?: string;
  /** the axle a clutch system drives directly */
  primary: Axle | null;
  /** nominal front share (no wheelspin) */
  base: number;
  /** front share the device can reach [min, max] */
  range: [number, number];
  lockable: boolean;
  /** static front axle load (0..1) */
  frontLoad: number;
  /** CG height / wheelbase: load moved rearward per g of acceleration */
  hOverL: number;
  /** the tyres' fore-aft peak grip (drive force per unit load): LONG_GRIP × spec μ */
  mu: number;
  wheelbaseMm: number;
}

export interface AwdOptions {
  /** driving round a tight turn: the front axle travels further than the rear */
  turn?: boolean;
  /** the driver's lock (centre-diff lock, DCCD manual), if the device has one */
  locked?: boolean;
}

export interface AwdState {
  /** drive torque each axle puts on the road, share of the device's input; negative = that axle
   *  is being dragged (wind-up) */
  front: number;
  rear: number;
  /** the axle's tyres are past their grip: its wheels spin (or scrub, when bound up) */
  spinFront: boolean;
  spinRear: boolean;
  /** 0 = free … 1 = rigid, clutch fully engaged, or a torque-sensing diff at its bias limit */
  lock: number;
  /** torque circulating between the axles in a turn (pushes the rear, drags the front) */
  bind: number;
}

export const newAwdState = (): AwdState => ({
  front: 0,
  rear: 0,
  spinFront: false,
  spinRear: false,
  lock: 0,
  bind: 0,
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The AWD system of a car, or null if it doesn't drive all four wheels. */
export function awdSystem(v: VehicleSpec): AwdSystem | null {
  const pt = v.powertrain;
  if (pt.driven !== 'all') return null;
  const L = v.dims.wheelbaseMm;
  let frontPct = v.published.frontPct ?? 50;
  let cgY = 0.35 * v.dims.heightMm;
  try {
    const mass = massProps(v);
    frontPct = mass.frontPct;
    cgY = mass.cgMm[1];
  } catch {
    // an engine swap can leave too little mass for the body: use the published split
  }
  const common = {
    lockable: false,
    frontLoad: frontPct / 100,
    hOverL: cgY / L,
    mu: LONG_GRIP * v.tires.mu,
    wheelbaseMm: L,
  };

  if (pt.kind === 'ev') {
    // each motor's peak wheel torque: the split the hardware gives at full throttle
    const wheelNm = (axle: Axle) =>
      pt.motors
        .filter((m) => m.axle === axle)
        .map((m) => getMotor(m.motor))
        .reduce((s, m) => s + m.peakNm * m.reduction, 0);
    const f = wheelNm('front');
    const share = f / Math.max(1e-9, f + wheelNm('rear'));
    return {
      ...common,
      kind: 'dual-motor',
      type: 'motors',
      primary: null,
      base: share,
      range: [share, share],
    };
  }

  // same default as layoutPowertrain(): the gearbox's own axle is the primary one
  const main: Axle =
    pt.gearbox === 'transverse-endon' && pt.position.startsWith('front') ? 'front' : 'rear';
  const kind: AwdKind = pt.awd ?? (main === 'front' ? 'clutch-on-demand' : 'rear-biased-clutch');
  const dev: AwdDevice =
    pt.awdDevice ?? DEFAULT_DEVICE[kind === 'dual-motor' ? 'center-diff' : kind];
  const base = pt.frontTorqueShare ?? AWD_FRONT[kind];
  let range: [number, number];
  switch (dev.type) {
    case 'open':
      range = [base, base];
      break;
    case 'torque-sensing': {
      // bias ratio applies to the torque ratio either way from the nominal split
      const r0 = base / (1 - base);
      const at = (ratio: number) => ratio / (1 + ratio);
      range = dev.frontRange ?? [at(r0 / DEFAULT_TBR), at(r0 * DEFAULT_TBR)];
      break;
    }
    case 'clutch':
      range = dev.frontRange ?? [0, 1];
      break;
    default:
      range = [0, 1];
  }
  const primary: Axle | null =
    dev.type === 'clutch' ? (kind === 'clutch-on-demand' ? 'front' : 'rear') : null;
  return {
    ...common,
    kind,
    type: dev.type,
    name: dev.name,
    primary,
    base,
    range: [Math.min(range[0], base), Math.max(range[1], base)],
    lockable: !!dev.lockable,
  };
}

/** The layout part that does the splitting: the centre diff/coupling, or for a rear-biased
 *  clutch the front differential that houses it. */
export function awdPartId(v: VehicleSpec): string | null {
  const pt = v.powertrain;
  if (pt.driven !== 'all' || pt.kind === 'ev') return null;
  const ids = layoutPowertrain(v).parts.map((p) => p.id);
  if (ids.includes('coupling')) return 'coupling';
  return ids.includes('diff-front') ? 'diff-front' : null;
}

// Scratch results of the helpers below: the model runs every frame, so it allocates nothing.
let sf = 0;
let sr = 0;

/** A diff that keeps the front share within [lo, hi]: the nominal split while both axles hold
 *  it, else the share nearest to it that puts the most torque down. */
function split(capF: number, capR: number, s: number, lo: number, hi: number) {
  if (s <= capF && 1 - s <= capR) {
    sf = s;
    sr = 1 - s;
    return;
  }
  const best = capF + capR > 0 ? clamp(capF / (capF + capR), lo, hi) : s;
  const total = Math.min(1, capF / best, capR / (1 - best));
  if (total >= 1) {
    const p = clamp(s, Math.max(lo, 1 - capR), Math.min(hi, capF));
    sf = p;
    sr = 1 - p;
  } else {
    sf = best * total;
    sr = (1 - best) * total;
  }
}

/** Rigidly coupled axles: equal slip, so torque follows tyre load until one axle saturates. */
function rigid(capF: number, capR: number, loadF: number) {
  let f = loadF;
  let r = 1 - loadF;
  if (f > capF) {
    f = capF;
    r = Math.min(capR, 1 - f);
  } else if (r > capR) {
    r = capR;
    f = Math.min(capF, 1 - r);
  }
  sf = f;
  sr = r;
}

const ramp = (t: number, r: { delayS: number; tauS: number; max: number }) =>
  t <= r.delayS ? 0 : r.max * (1 - Math.exp(-(t - r.delayS) / r.tauS));

const EPS = 1e-9;
const SPIN_LOSS = 0.005;

function solve(
  sys: AwdSystem,
  capF: number,
  capR: number,
  loadF: number,
  t: number,
  opts: AwdOptions,
  out: AwdState,
) {
  const s = sys.base;
  const type = opts.locked && sys.lockable ? 'locked' : sys.type;
  let f = 0;
  let r = 0;
  let lock = 0;
  /** how rigidly the shafts are tied together (wind-up in turns) */
  let rigidity = 0;
  switch (type) {
    case 'open':
    case 'torque-sensing': {
      split(capF, capR, s, sys.range[0], sys.range[1]);
      f = sf;
      r = sr;
      if (type === 'torque-sensing' && f + r > EPS) {
        const share = f / (f + r);
        const room = share >= s ? sys.range[1] - s : s - sys.range[0];
        lock = room > EPS ? Math.abs(share - s) / room : 0;
      }
      break;
    }
    case 'locking-clutch':
    case 'viscous': {
      split(capF, capR, s, s, s);
      const of = sf;
      const or = sr;
      const slipping = of + or < 1 - EPS;
      lock = slipping ? ramp(t, AWD_RESPONSE[type]) : 0;
      rigid(capF, capR, loadF);
      f = (1 - lock) * of + lock * sf;
      r = (1 - lock) * or + lock * sr;
      rigidity = lock;
      break;
    }
    case 'clutch': {
      const front = sys.primary === 'front';
      const capP = front ? capF : capR;
      const capS = front ? capR : capF;
      // the other axle's share: its preload, up to what the clutch may send
      const c0 = front ? 1 - s : s;
      const cMax = front ? 1 - sys.range[0] : sys.range[1];
      const slipping = 1 - Math.min(c0, capS) > capP + EPS;
      lock = slipping ? ramp(t, AWD_RESPONSE.clutch) : 0;
      // the controller clamps just enough to stop the primary axle spinning, within its range;
      // a clutch only passes torque from the faster side, so the fed axle never spins
      const target = clamp(1 - capP, c0, cMax);
      const toS = Math.min(c0 + (target - c0) * lock, capS);
      const toP = Math.min(capP, 1 - toS);
      f = front ? toP : toS;
      r = front ? toS : toP;
      break;
    }
    case 'locked':
      rigid(capF, capR, loadF);
      f = sf;
      r = sr;
      lock = 1;
      rigidity = 1;
      break;
    case 'motors':
      f = Math.min(capF, s);
      r = Math.min(capR, 1 - s);
      break;
  }

  const lost = 1 - f - r;
  let bind = 0;
  if (opts.turn && rigidity > 0) {
    // In a turn the front axle runs a wider arc than the rear. Tied shafts can't allow that, so
    // the front tyres are dragged and the rear ones pushed until the tyres slip: torque that
    // circulates through the shafts (tyre stiffness ~ load / peak slip, in series).
    const k = sys.mu / THRUST_G / KAPPA_PEAK;
    const kF = k * loadF;
    const kR = k * (1 - loadF);
    const L = sys.wheelbaseMm / 1000;
    const mismatch = Math.sqrt(1 + (L / TIGHT_TURN_M) ** 2) - 1;
    const want = (rigidity * mismatch * kF * kR) / (kF + kR);
    bind = Math.max(0, Math.min(want, f + capF, capR - r));
    f -= bind;
    r += bind;
  }
  out.front = f;
  out.rear = r;
  // an axle spins when it is at its grip limit and torque is going to waste (a clutch closing
  // exponentially counts as done once less than half a percent is still lost)
  const wasting = lost > SPIN_LOSS || bind > 0;
  out.spinFront = f > 0 && f >= capF - 1e-6 && wasting;
  out.spinRear = r > 0 && r >= capR - 1e-6 && wasting;
  out.lock = lock;
  out.bind = bind;
}

/**
 * Torque to each axle `t` seconds after the grip changed from dry to (gripF, gripR) — multiples
 * of the tyres' dry μ, 0..1. Pass `out` to reuse one state object (per-frame callers).
 */
export function axleTorque(
  car: VehicleSpec | AwdSystem,
  gripF: number,
  gripR: number,
  t = Infinity,
  opts: AwdOptions = {},
  out: AwdState = newAwdState(),
): AwdState {
  const sys = 'powertrain' in car ? awdSystem(car) : car;
  if (!sys) throw new Error(`${'id' in car ? car.id : 'car'}: not all-wheel drive`);
  const gF = clamp(gripF, 0, 1);
  const gR = clamp(gripR, 0, 1);
  // load moves rearward with the acceleration the car actually achieves: iterate to agree
  let accel = THRUST_G;
  for (let i = 0; i < 3; i++) {
    const loadF = clamp(sys.frontLoad - accel * sys.hOverL, 0.05, 0.95);
    const capF = (gF * sys.mu * loadF) / THRUST_G;
    const capR = (gR * sys.mu * (1 - loadF)) / THRUST_G;
    solve(sys, capF, capR, loadF, t, opts, out);
    accel = THRUST_G * Math.max(0, out.front + out.rear);
  }
  return out;
}

export interface AwdResponse {
  t: number[];
  front: number[];
  rear: number[];
}

/** The step response over the first `tMaxS` seconds, for plots. */
export function awdResponse(
  sys: AwdSystem,
  gripF: number,
  gripR: number,
  opts: AwdOptions = {},
  tMaxS = 1,
  n = 61,
): AwdResponse {
  const res: AwdResponse = { t: [], front: [], rear: [] };
  const st = newAwdState();
  for (let i = 0; i < n; i++) {
    const t = (tMaxS * i) / (n - 1);
    axleTorque(sys, gripF, gripR, t, opts, st);
    res.t.push(t);
    res.front.push(st.front);
    res.rear.push(st.rear);
  }
  return res;
}

/** "40:60" */
export const fmtSplit = (front: number) => {
  const f = Math.round(clamp(front, 0, 1) * 100);
  return `${f}:${100 - f}`;
};

/** What to call the device when the spec gives no trade name. */
export function awdTypeLabel(sys: AwdSystem): string {
  switch (sys.type) {
    case 'open':
      return 'Open centre diff';
    case 'torque-sensing':
      return 'Torsen';
    case 'locking-clutch':
      return 'Locking centre diff';
    case 'viscous':
      return 'Viscous coupling';
    case 'clutch':
      return sys.primary === 'front' ? 'Haldex-type clutch' : 'Rear-biased clutch';
    case 'locked':
      return 'Part-time 4WD';
    case 'motors':
      return 'Motor per axle';
  }
}
