/**
 * Small allocation-free DSP building blocks. Everything here runs per sample inside the
 * AudioWorklet, so: plain classes with numeric fields, no closures, no arrays created in loops.
 */

export const TAU = Math.PI * 2;

/** Seeded PRNG (mulberry32): the whole synth is deterministic for a given seed. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  /** uniform 0..1 */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** uniform -1..1 (white noise) */
  bi(): number {
    return this.next() * 2 - 1;
  }
  /** ~N(0,1) (Irwin–Hall, cheap and bounded) */
  gauss(): number {
    return this.next() + this.next() + this.next() + this.next() - 2;
  }
}

/** One-pole coefficient for a cutoff (Hz). */
export const onePoleCoef = (hz: number, fs: number) =>
  1 - Math.exp((-TAU * Math.min(hz, fs * 0.45)) / fs);

/** Per-sample multiplier that decays by 1/e in `seconds`. */
export const decayCoef = (seconds: number, fs: number) =>
  Math.exp(-1 / Math.max(1e-6, seconds * fs));

export class OnePole {
  y = 0;
  a: number;
  constructor(hz: number, fs: number) {
    this.a = onePoleCoef(hz, fs);
  }
  lp(x: number): number {
    this.y += this.a * (x - this.y);
    return this.y;
  }
  /** complementary high-pass */
  hp(x: number): number {
    this.y += this.a * (x - this.y);
    return x - this.y;
  }
}

/** RBJ-cookbook biquad (transposed direct form II). */
export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private z1 = 0;
  private z2 = 0;
  constructor(
    private readonly fs: number,
    kind: 'bandpass' | 'lowpass' | 'highpass',
    hz: number,
    q: number,
  ) {
    this.set(kind, hz, q);
  }
  set(kind: 'bandpass' | 'lowpass' | 'highpass', hz: number, q: number) {
    const w = (TAU * Math.min(Math.max(hz, 5), this.fs * 0.45)) / this.fs;
    const cw = Math.cos(w);
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    let b0: number, b1: number, b2: number;
    if (kind === 'bandpass') {
      // constant 0 dB peak gain
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    } else if (kind === 'lowpass') {
      b0 = (1 - cw) / 2;
      b1 = 1 - cw;
      b2 = b0;
    } else {
      b0 = (1 + cw) / 2;
      b1 = -(1 + cw);
      b2 = b0;
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cw) / a0;
    this.a2 = (1 - alpha) / a0;
  }
  run(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
  reset() {
    this.z1 = this.z2 = 0;
  }
}

/**
 * A difference-of-exponentials pulse (fast rise, slower decay). Triggers superpose, so
 * overlapping pulses add like pressure waves do. Peak of one trigger = its amplitude.
 */
export class PulseEnv {
  private d = 0;
  private r = 0;
  private readonly kd: number;
  private readonly kr: number;
  private readonly norm: number;
  constructor(riseS: number, decayS: number, fs: number) {
    const tr = Math.min(riseS, decayS * 0.9);
    this.kd = decayCoef(decayS, fs);
    this.kr = decayCoef(tr, fs);
    const tPeak = (Math.log(decayS / tr) * decayS * tr) / (decayS - tr);
    this.norm = 1 / (Math.exp(-tPeak / decayS) - Math.exp(-tPeak / tr));
  }
  /** `late` = how many samples ago (0..1) the trigger really happened, for sub-sample timing. */
  trigger(amp: number, late = 0) {
    const a = amp * this.norm;
    this.d += a * Math.pow(this.kd, late);
    this.r += a * Math.pow(this.kr, late);
  }
  next(): number {
    const y = this.d - this.r;
    this.d *= this.kd;
    this.r *= this.kr;
    return y;
  }
}

/**
 * Stereo-linked peak limiter with instant attack: the gain is computed from the current sample
 * before it is applied, so the output can never exceed `ceiling`. Release is exponential.
 */
export class Limiter {
  private env = 0;
  private readonly rel: number;
  constructor(
    fs: number,
    readonly ceiling = 0.9,
    releaseS = 0.12,
  ) {
    this.rel = decayCoef(releaseS, fs);
  }
  /** returns the gain to apply to both channels for this sample */
  gain(l: number, r: number): number {
    const peak = Math.max(Math.abs(l), Math.abs(r));
    this.env = Math.max(peak, this.env * this.rel);
    return this.env > this.ceiling ? this.ceiling / this.env : 1;
  }
}

export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
