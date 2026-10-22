/**
 * A tiny free-revving engine model for the panel's throttle blip, rev sweep and gas pedal. It writes the
 * same { rpm, throttle } object the synth reads (engineRuntime by default), so the 3D crank
 * follows the sound. Pure TS: no timers, the caller steps it.
 */
import { isMotor, type SoundSource } from './config';

export interface RevLimits {
  idle: number;
  max: number;
  /** rpm/s at full throttle, no load */
  accel: number;
  /** rpm/s with the throttle shut, at max rpm */
  decel: number;
  /** combustion engines bounce off a fuel-cut limiter */
  limiter: boolean;
}

export function revLimits(s: SoundSource): RevLimits {
  if (isMotor(s))
    return {
      idle: 0,
      max: s.maxRpm * 0.9,
      accel: s.maxRpm / 3.5,
      decel: s.maxRpm / 6,
      limiter: false,
    };
  // power-to-mass stands in for torque over crank inertia: light, powerful engines rev fastest
  const accel = Math.min(16000, Math.max(3500, 2500 + (14 * s.powerKw) / (s.massKg / 150)));
  return { idle: s.idleRpm, max: s.redlineRpm, accel, decel: accel * 0.6, limiter: true };
}

/** blip: a stab of throttle; sweep: idle → limiter → idle; pedal: floored for as long as it's held */
export type Manoeuvre = 'blip' | 'sweep' | 'pedal';

export interface RevInput {
  rpm: number;
  throttle: number;
}

const BLIP_S = 0.18;
const HOLD_S = 0.9;

export class RevDriver {
  manoeuvre: Manoeuvre | null = null;
  private base: RevInput = { rpm: 0, throttle: 0 };
  private rpm = 0;
  private t = 0;
  private held = 0;
  private cut = false;
  private lifted = false;
  private pressed = false;

  constructor(private limits: RevLimits) {}

  setLimits(l: RevLimits) {
    this.limits = l;
  }

  start(kind: Manoeuvre, from: RevInput) {
    if (!this.manoeuvre) this.base = { rpm: from.rpm, throttle: from.throttle };
    this.manoeuvre = kind;
    this.rpm = from.rpm;
    this.t = 0;
    this.held = 0;
    this.cut = false;
    this.lifted = false;
    this.pressed = kind === 'pedal';
  }

  /** Gas pedal let go: the revs fall back to where they started. */
  release() {
    this.pressed = false;
  }

  /** Advance by dt seconds and write rpm/throttle into `out`. Returns false once finished. */
  step(dt: number, out: RevInput): boolean {
    if (!this.manoeuvre) return false;
    const L = this.limits;
    this.t += dt;
    if (this.manoeuvre === 'sweep' && this.rpm >= L.max * 0.985) this.held += dt;
    const floored =
      this.manoeuvre === 'blip'
        ? this.t < BLIP_S
        : this.manoeuvre === 'pedal'
          ? this.pressed
          : this.held < HOLD_S && !this.lifted;
    const pedal = floored ? 1 : 0;
    if (pedal === 0) this.lifted = true;
    if (L.limiter) {
      if (this.rpm >= L.max) this.cut = true;
      else if (this.rpm < L.max * 0.97) this.cut = false;
    }
    // the limiter cuts fuel, not the pedal: the throttle stays open (no blow-off, no overrun
    // burble while bouncing off it); only the revs feel the cut
    const drive = this.cut ? 0 : pedal;
    const shape = 0.75 + 0.25 * Math.sin((Math.PI * Math.min(this.rpm, L.max)) / L.max);
    const drag = L.decel * (0.35 + (0.65 * this.rpm) / L.max);
    this.rpm += (drive * L.accel * shape - (1 - drive) * drag) * dt;
    this.rpm = Math.min(this.rpm, L.limiter ? L.max * 1.01 : L.max);
    out.throttle = pedal;
    if (this.lifted && this.rpm <= this.base.rpm + 20) {
      out.rpm = this.base.rpm;
      out.throttle = this.base.throttle;
      this.manoeuvre = null;
      return false;
    }
    out.rpm = Math.max(this.rpm, Math.min(this.base.rpm, L.idle));
    return true;
  }

  cancel(out: RevInput) {
    if (!this.manoeuvre) return;
    out.rpm = this.base.rpm;
    out.throttle = this.base.throttle;
    this.manoeuvre = null;
  }
}
