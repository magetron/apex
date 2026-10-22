/**
 * The AWD device, step by step: how the drive force is shared between the axles while the grip
 * each one has left changes through a corner. Same devices and response times as the AWD
 * explainer (spec/derive/awd.ts), worked in newtons against what each axle can still put down
 * after its cornering force (the friction ellipse), so a clutch that closes a beat after the
 * front tyres saturate shows up as power-on understeer that then fades.
 *
 * Allocation-free: writes the result into module scratch and the car's own lock state.
 */
import { AWD_RESPONSE, awdSystem, type AwdModelType } from '../../spec/derive/awd';
import type { Axle, VehicleSpec } from '../../spec/types';

export interface AwdParams {
  type: AwdModelType;
  /** the axle a clutch system drives directly */
  primary: Axle | null;
  /** nominal front share of the drive force */
  base: number;
  /** front share the device can reach */
  lo: number;
  hi: number;
  /** reactive devices: dead time, lag and how far they go (1 = rigid / full range) */
  delayS: number;
  tauS: number;
  max: number;
}

/** The car's AWD device for the sim, or null if it isn't all-wheel drive (EVs: see car.ts). */
export function awdParams(v: VehicleSpec): AwdParams | null {
  if (v.powertrain.kind === 'ev') return null;
  const sys = awdSystem(v);
  if (!sys) return null;
  const r =
    sys.type === 'clutch' || sys.type === 'locking-clutch' || sys.type === 'viscous'
      ? AWD_RESPONSE[sys.type]
      : { delayS: 0, tauS: 0.02, max: 1 };
  return {
    type: sys.type,
    primary: sys.primary,
    base: sys.base,
    lo: sys.range[0],
    hi: sys.range[1],
    delayS: r.delayS,
    tauS: r.tauS,
    max: r.max,
  };
}

/** Lock state the device carries from step to step. */
export interface AwdState {
  /** 0 = free … 1 = rigid / clutch at its full range */
  awdLock: number;
  /** how long the device has been asked to close further (s): its dead time */
  awdWait: number;
}

/** Result of the last split (N): drive force to the front and rear axle. */
export const awdOut = { front: 0, rear: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Move the lock toward `want` after the dead time, with the device's lag. */
function react(d: AwdParams, s: AwdState, want: number, dt: number) {
  const w = Math.min(want, d.max);
  if (w > s.awdLock + 1e-3) {
    s.awdWait += dt;
    if (s.awdWait < d.delayS) return;
  } else s.awdWait = 0;
  s.awdLock += (w - s.awdLock) * Math.min(1, dt / d.tauS);
}

/** A diff at front share p: an axle asked for more than it can take spins, and the diff then
 *  passes the other one only its ratio of what the spinning axle holds. */
function diffAt(F: number, p: number, kF: number, kR: number) {
  let f = F * p;
  let r = F * (1 - p);
  if (f > kF && p < 1) r = Math.min(r, (kF * (1 - p)) / Math.max(p, 1e-6));
  if (r > kR && p > 0) f = Math.min(f, (kR * p) / Math.max(1 - p, 1e-6));
  awdOut.front = f;
  awdOut.rear = r;
}

/** Rigid shafts: the drive goes where the load is, until one axle has no more to give. */
function rigidAt(F: number, kF: number, kR: number, loadF: number) {
  let f = F * loadF;
  let r = F - f;
  if (f > kF) {
    f = kF;
    r = F - f;
  } else if (r > kR) {
    r = kR;
    f = F - r;
  }
  awdOut.front = f;
  awdOut.rear = r;
}

/**
 * Split drive force F (N, > 0) between the axles. kF/kR: drive force each axle can still put
 * down (N); loadF: front share of the axle loads right now.
 */
export function awdSplit(
  d: AwdParams,
  F: number,
  kF: number,
  kR: number,
  loadF: number,
  s: AwdState,
  dt: number,
) {
  const base = d.base;
  switch (d.type) {
    case 'open':
    case 'torque-sensing': {
      let p = base;
      if (F * base > kF || F * (1 - base) > kR) {
        // the share nearest nominal that keeps both axles gripping, else the bias limit
        const pLo = Math.max(d.lo, 1 - kR / F);
        const pHi = Math.min(d.hi, kF / F);
        p = pLo <= pHi ? clamp(base, pLo, pHi) : clamp(kF / Math.max(1e-6, kF + kR), d.lo, d.hi);
      }
      const room = p >= base ? d.hi - base : base - d.lo;
      s.awdLock = room > 1e-6 ? Math.abs(p - base) / room : 0;
      diffAt(F, p, kF, kR);
      return;
    }
    case 'clutch': {
      const front = d.primary === 'front';
      const kP = front ? kF : kR;
      const kS = front ? kR : kF;
      const c0 = front ? 1 - base : base;
      const cMax = front ? 1 - d.lo : d.hi;
      // the secondary axle's share that would stop the primary one spinning
      const target = clamp(1 - kP / F, c0, cMax);
      react(d, s, cMax > c0 ? (target - c0) / (cMax - c0) : 0, dt);
      // a clutch only passes torque from the faster side: the fed axle never spins
      const fS = Math.min(F * (c0 + (cMax - c0) * s.awdLock), kS);
      const fP = F - fS;
      awdOut.front = front ? fP : fS;
      awdOut.rear = front ? fS : fP;
      return;
    }
    case 'locking-clutch':
    case 'viscous': {
      const spinning = F * base > kF || F * (1 - base) > kR;
      react(d, s, spinning ? 1 : 0, dt);
      diffAt(F, base, kF, kR);
      const of = awdOut.front;
      const or = awdOut.rear;
      rigidAt(F, kF, kR, loadF);
      const l = s.awdLock;
      awdOut.front = (1 - l) * of + l * awdOut.front;
      awdOut.rear = (1 - l) * or + l * awdOut.rear;
      return;
    }
    case 'locked':
      s.awdLock = 1;
      rigidAt(F, kF, kR, loadF);
      return;
    case 'motors':
      diffAt(F, base, kF, kR);
      return;
  }
}
