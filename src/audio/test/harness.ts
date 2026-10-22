/** Offline rendering and spectral helpers for the audio tests (Node only). */
import { EngineKernel, type KernelOptions } from '../dsp/engineKernel';
import { MotorKernel } from '../dsp/motorKernel';
import { Biquad } from '../dsp/primitives';
import type { EngineVoiceConfig, MotorVoiceConfig, Probe, Voice, VoiceEvent } from '../dsp/types';

export const FS = 48000;
const BLOCK = 128;

export interface Rendered {
  L: Float32Array;
  R: Float32Array;
  mono: Float32Array;
  groups: Float32Array[];
  source: Float32Array;
  mechanical: Float32Array;
  turbo: Float32Array;
  events: VoiceEvent[];
  /** sample index where the analysed part starts */
  start: number;
}

/** rpm/throttle as a function of time (s), sampled per block */
export type Schedule = (t: number) => { rpm: number; throttle: number };

export function renderVoice(
  voice: Voice,
  groupCount: number,
  seconds: number,
  schedule: Schedule,
  warmup = 0,
): Rendered {
  const total = Math.round((seconds + warmup) * FS);
  const L = new Float32Array(total);
  const R = new Float32Array(total);
  const groups = Array.from({ length: groupCount }, () => new Float32Array(total));
  const source = new Float32Array(total);
  const mechanical = new Float32Array(total);
  const turbo = new Float32Array(total);
  const bl = new Float32Array(BLOCK);
  const br = new Float32Array(BLOCK);
  const probe: Probe = {
    groups: groups.map(() => new Float32Array(BLOCK)),
    source: new Float32Array(BLOCK),
    mechanical: new Float32Array(BLOCK),
    turbo: new Float32Array(BLOCK),
  };
  for (let s = 0; s < total; s += BLOCK) {
    const n = Math.min(BLOCK, total - s);
    const { rpm, throttle } = schedule((s + n) / FS - warmup);
    voice.render(bl, br, n, rpm, throttle, probe);
    L.set(bl.subarray(0, n), s);
    R.set(br.subarray(0, n), s);
    groups.forEach((g, i) => g.set(probe.groups![i].subarray(0, n), s));
    source.set(probe.source!.subarray(0, n), s);
    mechanical.set(probe.mechanical!.subarray(0, n), s);
    turbo.set(probe.turbo!.subarray(0, n), s);
  }
  const mono = L.map((x, i) => 0.5 * (x + R[i]));
  return {
    L,
    R,
    mono,
    groups,
    source,
    mechanical,
    turbo,
    events: voice.events ?? [],
    start: Math.round(warmup * FS),
  };
}

export function renderEngine(
  cfg: EngineVoiceConfig,
  o: { rpm: number; throttle: number; seconds?: number; warmup?: number } & KernelOptions,
): Rendered {
  const k = new EngineKernel(cfg, FS, { recordEvents: true, ...o });
  return renderVoice(k, cfg.groupCount, o.seconds ?? 1, () => o, o.warmup ?? 0.5);
}

export function renderMotor(
  cfg: MotorVoiceConfig,
  o: { rpm: number; throttle: number; seconds?: number },
): Rendered {
  const k = new MotorKernel(cfg, FS, { seed: 1 });
  return renderVoice(k, 0, o.seconds ?? 1, () => o, 0.3);
}

const windows = new Map<number, Float64Array>();
const hann = (n: number) => {
  let w = windows.get(n);
  if (!w) {
    w = Float64Array.from(
      { length: n },
      (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)),
    );
    windows.set(n, w);
  }
  return w;
};

/** Hann-windowed single-frequency magnitude at `hz` (Goertzel; sine amplitude units). */
export function tone(x: Float32Array, hz: number, start = 0, end = x.length): number {
  const n = end - start;
  const win = hann(n);
  const c = 2 * Math.cos((2 * Math.PI * hz) / FS);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const s = x[start + i] * win[i] + c * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  const mag = Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2));
  return (2 * mag) / (n * 0.5);
}

/** Amplitude at a crank order (k × rpm/60). */
export const order = (x: Float32Array, k: number, rpm: number, start = 0) =>
  tone(x, (k * rpm) / 60, start);

/** Magnitude spectrum on a uniform grid (Hz) — slow, for tests only. */
export function spectrum(x: Float32Array, fromHz: number, toHz: number, stepHz: number, start = 0) {
  const out: { hz: number; mag: number }[] = [];
  for (let f = fromHz; f <= toHz; f += stepHz) out.push({ hz: f, mag: tone(x, f, start) });
  return out;
}

export const rms = (x: Float32Array, start = 0, end = x.length) => {
  let s = 0;
  for (let i = start; i < end; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, end - start));
};

export const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

/** Amplitudes at the half orders 0.5, 1, … upTo. */
export function orderProfile(x: Float32Array, rpm: number, start: number, upTo: number) {
  const ks = Array.from({ length: Math.round(upTo * 2) }, (_, i) => (i + 1) / 2);
  return ks.map((k) => ({ k, amp: order(x, k, rpm, start) }));
}

/** The strongest half order up to `upTo`. */
export function dominantOrder(x: Float32Array, rpm: number, start: number, upTo: number) {
  return orderProfile(x, rpm, start, upTo).reduce((a, b) => (b.amp > a.amp ? b : a)).k;
}

/** Power at the orders `pick` selects, relative to the power of order `ref`. */
export function orderPower(
  x: Float32Array,
  rpm: number,
  start: number,
  orders: number[],
  ref: number,
) {
  const r = order(x, ref, rpm, start) ** 2;
  return orders.reduce((s, k) => s + order(x, k, rpm, start) ** 2, 0) / r;
}

/**
 * How strongly the highs (> hz) pulse at crank order k: the envelope's order-k amplitude over its
 * mean. Steady hiss scores ~0; one burst of hiss per firing scores high.
 */
export function highsPulse(x: Float32Array, rpm: number, start: number, k: number, hz = 1000) {
  // 4th order, so the strong low lines don't leak into the envelope
  const hp = [0, 1].map(() => new Biquad(FS, 'highpass', hz, Math.SQRT1_2));
  const env = Float32Array.from(x, (v) => Math.abs(hp[1].run(hp[0].run(v))));
  let mean = 0;
  for (let i = start; i < env.length; i++) mean += env[i];
  mean /= env.length - start;
  return order(env, k, rpm, start) / mean;
}

/** Pulse-to-pulse spread (coefficient of variation) of the exhaust source's peak per firing. */
export function pulseSpread(r: Rendered) {
  const fires = r.events.filter((e) => e.kind === 'fire' && e.t > r.start).map((e) => e.t);
  const peaks = fires.slice(0, -1).map((t, j) => {
    let p = 0;
    for (let i = Math.ceil(t); i < fires[j + 1]; i++) p = Math.max(p, r.source[i]);
    return p;
  });
  const mean = peaks.reduce((s, p) => s + p, 0) / peaks.length;
  return Math.sqrt(peaks.reduce((s, p) => s + (p - mean) ** 2, 0) / peaks.length) / mean;
}

/** Signal through a 4th-order band-pass lo..hi Hz. */
export function band(x: Float32Array, lo: number, hi: number) {
  const f = [
    new Biquad(FS, 'highpass', lo, Math.SQRT1_2),
    new Biquad(FS, 'highpass', lo, Math.SQRT1_2),
    new Biquad(FS, 'lowpass', hi, Math.SQRT1_2),
    new Biquad(FS, 'lowpass', hi, Math.SQRT1_2),
  ];
  return Float32Array.from(x, (v) => f.reduce((y, b) => b.run(y), v));
}

/** Mean power of x from start (to end). */
export const power = (x: Float32Array, start = 0, end = x.length) => rms(x, start, end) ** 2;

/**
 * How much the loudness of the lo..hi Hz band swings at the given crank orders, over its mean:
 * below the firing order that is lope; at it, how distinctly each pulse stands out.
 */
export function envelopeSwing(
  x: Float32Array,
  rpm: number,
  start: number,
  orders: number[],
  lo = 80,
  hi = 2000,
) {
  const env = Float32Array.from(band(x, lo, hi), Math.abs);
  let mean = 0;
  for (let i = start; i < env.length; i++) mean += env[i];
  mean /= env.length - start;
  return Math.sqrt(orders.reduce((s, k) => s + order(env, k, rpm, start) ** 2, 0)) / mean;
}
