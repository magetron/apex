/**
 * Electric drive-unit voice. An EV has no combustion pulses, so its sound is a set of tones
 * locked to the shaft:
 *  - electromagnetic whine at multiples of the electrical frequency f_e = polePairs × shaft Hz
 *    (6th and 12th: three-phase torque ripple; slot harmonics), stronger with current;
 *  - inverter PWM whine at the switching frequency with ±2·f_e sidebands;
 *  - reduction-gear mesh whine (pinion teeth × shaft Hz, and the second stage);
 *  - bearing/wind noise, and an optional pedestrian-warning (AVAS) tone at low speed.
 */
import { Biquad, clamp, Limiter, OnePole, Rng, TAU } from './primitives';
import { NO_ADDONS, type Addons, type MotorVoiceConfig, type Probe, type Voice } from './types';

/** Tone table indices */
const T_E6 = 0;
const T_E12 = 1;
const T_SLOT = 2;
const T_INV = 3;
const T_INV_LO = 4;
const T_INV_HI = 5;
const T_MESH1 = 6;
const T_MESH1_2 = 7;
const T_MESH2 = 8;
const T_AVAS1 = 9;
const T_AVAS2 = 10;
const TONES = 11;

export interface MotorKernelOptions {
  seed?: number;
  addons?: Addons;
}

export class MotorKernel implements Voice {
  readonly events = null;
  private readonly cfg: MotorVoiceConfig;
  private readonly fs: number;
  private readonly rng: Rng;
  private addons: Addons;
  private readonly phase = new Float64Array(TONES);
  private readonly hz = new Float64Array(TONES);
  private readonly amp = new Float64Array(TONES);
  /** slow random wobble of the gear mesh (transmission error) */
  private readonly wobble: OnePole;
  private readonly wind: Biquad;
  private readonly dcL: OnePole;
  private readonly dcR: OnePole;
  private readonly limiter: Limiter;
  private rpm = 0;
  private slope = 0;

  constructor(cfg: MotorVoiceConfig, fs: number, opts: MotorKernelOptions = {}) {
    this.cfg = cfg;
    this.fs = fs;
    this.rng = new Rng(opts.seed ?? 1);
    this.addons = opts.addons ?? NO_ADDONS;
    this.wobble = new OnePole(6, fs);
    this.wind = new Biquad(fs, 'bandpass', 900, 0.7);
    this.dcL = new OnePole(18, fs);
    this.dcR = new OnePole(18, fs);
    this.limiter = new Limiter(fs, 0.9, 0.12);
  }

  setAddons(a: Addons) {
    this.addons = a;
  }

  /** Tone frequencies (Hz) at a shaft speed: exposed for tests and readouts. */
  static tones(cfg: MotorVoiceConfig, rpm: number, torque: number) {
    const shaft = rpm / 60;
    // an induction rotor slips behind the field, more so under torque
    const slip = cfg.induction ? 0.005 + 0.025 * Math.abs(torque) : 0;
    const fe = (cfg.polePairs * shaft) / (1 - slip);
    return {
      electrical: fe,
      e6: 6 * fe,
      e12: 12 * fe,
      slot: cfg.statorSlots * shaft,
      inverter: cfg.inverterHz,
      mesh1: cfg.pinionTeeth * shaft,
      mesh2: (cfg.stage2Teeth * shaft) / cfg.stage1Ratio,
    };
  }

  private plan(rpm: number, throttle: number) {
    const cfg = this.cfg;
    // regen when coasting down: current flows the other way, the whine stays
    const regen = throttle < 0.05 && this.slope < -200 ? 0.35 : 0;
    const torque = Math.max(throttle, regen);
    const f = MotorKernel.tones(cfg, rpm, torque);
    const speed = clamp(rpm / cfg.maxRpm, 0, 1.1);
    const current = 0.15 + 0.85 * torque;
    const fade = clamp(rpm / 300, 0, 1);
    const hz = this.hz;
    const amp = this.amp;
    hz[T_E6] = f.e6;
    amp[T_E6] = 0.05 * current * fade;
    hz[T_E12] = f.e12;
    amp[T_E12] = 0.025 * current * fade;
    hz[T_SLOT] = f.slot;
    amp[T_SLOT] = (cfg.induction ? 0.03 : 0.015) * (0.3 + 0.7 * current) * fade;
    hz[T_INV] = f.inverter;
    amp[T_INV] = 0.012 * current;
    hz[T_INV_LO] = f.inverter - 2 * f.electrical;
    hz[T_INV_HI] = f.inverter + 2 * f.electrical;
    amp[T_INV_LO] = amp[T_INV_HI] = 0.008 * current * fade;
    const mesh = cfg.gearWhine * (0.25 + 0.75 * torque) * Math.sqrt(speed);
    hz[T_MESH1] = f.mesh1;
    amp[T_MESH1] = 0.06 * mesh;
    hz[T_MESH1_2] = 2 * f.mesh1;
    amp[T_MESH1_2] = 0.02 * mesh;
    hz[T_MESH2] = f.mesh2;
    amp[T_MESH2] = 0.04 * mesh;
    // AVAS: a soft two-tone hum that rises with speed and fades out by ~30 km/h
    const avas = this.addons.avas ? clamp(1 - rpm / 2800, 0, 1) * clamp(rpm / 60, 0.4, 1) : 0;
    hz[T_AVAS1] = 220 + rpm * 0.12;
    hz[T_AVAS2] = 330 + rpm * 0.18;
    amp[T_AVAS1] = 0.05 * avas;
    amp[T_AVAS2] = 0.03 * avas;
    return speed;
  }

  render(
    L: Float32Array,
    R: Float32Array,
    len: number,
    rpmTarget: number,
    throttleTarget: number,
    probe?: Probe,
  ) {
    const fs = this.fs;
    const dt = len / fs;
    const r1 = Number.isFinite(rpmTarget) ? clamp(rpmTarget, 0, this.cfg.maxRpm * 1.05) : this.rpm;
    const t1 = Number.isFinite(throttleTarget) ? clamp(throttleTarget, 0, 1) : 0;
    this.slope += ((r1 - this.rpm) / dt - this.slope) * (1 - Math.exp(-dt / 0.1));
    this.rpm = r1;
    const speed = this.plan(r1, t1);
    const windAmp = 0.04 * speed * speed;
    const nyq = fs * 0.45;
    const gain = this.cfg.gain;
    for (let k = 0; k < len; k++) {
      const wob = 1 + 0.25 * this.wobble.lp(this.rng.bi() * 8);
      let y = 0;
      for (let i = 0; i < TONES; i++) {
        const f = this.hz[i];
        if (this.amp[i] <= 0 || f <= 0 || f >= nyq) continue;
        const ph = (this.phase[i] + f / fs) % 1;
        this.phase[i] = ph;
        const s = Math.sin(TAU * ph) * this.amp[i];
        y += i >= T_MESH1 && i <= T_MESH2 ? s * wob : s;
      }
      y += windAmp * this.wind.run(this.rng.bi());
      let yl = this.dcL.hp(y) * gain;
      let yr = this.dcR.hp(y) * gain;
      if (!Number.isFinite(yl + yr)) yl = yr = 0;
      const lim = this.limiter.gain(yl, yr);
      L[k] = yl * lim;
      R[k] = yr * lim;
      if (probe?.mechanical) probe.mechanical[k] = y;
    }
  }
}
