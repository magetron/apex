/**
 * Digital waveguide pipes and scattering junctions.
 *
 * A pipe is two delay lines (pressure waves travelling each way) with a little loss and
 * low-pass per traversal (wall friction, heat). Pipes meet at junctions that scatter the waves
 * by cross-sectional area, exactly as an N-port acoustic junction does:
 *   p_J = 2·Σ(A_k·p_k⁺)/ΣA_k,   p_k⁻ = p_J − p_k⁺
 * This is the structure of Baldan & Delle Monache (2015), "Physically informed car engine
 * sound synthesis for virtual and augmented environments", as ported (MIT) by
 * DasEtwas/enginesound (Rust) and Antonio-R1/engine-sound-generator (JS). Our junctions are
 * area-weighted N-ports rather than their fixed alpha/beta reflection factors, so header,
 * collector and muffler reflections follow from pipe sizes instead of hand-tuned constants.
 */
import { onePoleCoef } from './primitives';

/** Global write index wraps here; every rail size is a power of two that divides it. */
export const INDEX_MASK = 0x3fffffff;

/** Fixed fractional delay line (linear interpolation) indexed by a shared write counter. */
export class Rail {
  private readonly buf: Float32Array;
  private readonly mask: number;
  private readonly di: number;
  private readonly frac: number;
  constructor(delaySamples: number) {
    const d = Math.max(1, delaySamples);
    let size = 4;
    while (size < d + 3) size <<= 1;
    this.buf = new Float32Array(size);
    this.mask = size - 1;
    this.di = Math.floor(d);
    this.frac = d - this.di;
  }
  read(w: number): number {
    const i = (w - this.di) & this.mask;
    const a = this.buf[i];
    return a + this.frac * (this.buf[(i - 1) & this.mask] - a);
  }
  write(w: number, x: number) {
    this.buf[w & this.mask] = x;
  }
  clear() {
    this.buf.fill(0);
  }
}

export interface PipeOpts {
  /** physical length (mm) */
  mm: number;
  /** speed of sound in the gas (m/s) */
  c: number;
  /** relative cross-section (any consistent unit) */
  area: number;
  /** amplitude kept per traversal */
  gain: number;
  /** wall-loss low-pass cutoff (Hz) */
  lossHz: number;
}

export class Pipe {
  readonly fwd: Rail;
  readonly bwd: Rail;
  readonly area: number;
  readonly delay: number;
  private readonly g: number;
  private readonly a: number;
  private lp0 = 0;
  private lp1 = 0;
  /** wave arriving at end 0 (from the bwd rail) / end 1 (from the fwd rail) this sample */
  out0 = 0;
  out1 = 0;
  /** wave leaving end 0 into fwd / end 1 into bwd this sample */
  in0 = 0;
  in1 = 0;
  constructor(o: PipeOpts, fs: number) {
    this.delay = Math.max(1, (o.mm / 1000 / o.c) * fs);
    this.fwd = new Rail(this.delay);
    this.bwd = new Rail(this.delay);
    this.area = o.area;
    this.g = o.gain;
    this.a = onePoleCoef(o.lossHz, fs);
  }
  pop(w: number) {
    this.lp1 += this.a * (this.fwd.read(w) - this.lp1);
    this.lp0 += this.a * (this.bwd.read(w) - this.lp0);
    this.out1 = this.g * this.lp1;
    this.out0 = this.g * this.lp0;
  }
  push(w: number) {
    this.fwd.write(w, this.in0);
    this.bwd.write(w, this.in1);
  }
  clear() {
    this.fwd.clear();
    this.bwd.clear();
    this.lp0 = this.lp1 = this.out0 = this.out1 = this.in0 = this.in1 = 0;
  }
}

/** Lossless area-weighted N-port junction with an optional pressure source (afterfire, noise). */
export class Junction {
  private readonly pipes: Pipe[];
  private readonly ends: Uint8Array;
  private readonly w: Float64Array;
  /** extra pressure injected at the junction this sample */
  src = 0;
  /** junction pressure after the last scatter */
  p = 0;
  constructor(ports: [Pipe, 0 | 1][]) {
    this.pipes = ports.map((p) => p[0]);
    this.ends = Uint8Array.from(ports.map((p) => p[1]));
    const total = ports.reduce((s, p) => s + p[0].area, 0);
    this.w = Float64Array.from(ports.map((p) => (2 * p[0].area) / total));
  }
  scatter() {
    const { pipes, ends, w } = this;
    let p = this.src;
    for (let k = 0; k < pipes.length; k++) p += w[k] * (ends[k] ? pipes[k].out1 : pipes[k].out0);
    for (let k = 0; k < pipes.length; k++) {
      const pipe = pipes[k];
      if (ends[k]) pipe.in1 = p - pipe.out1;
      else pipe.in0 = p - pipe.out0;
    }
    this.p = p;
  }
}
