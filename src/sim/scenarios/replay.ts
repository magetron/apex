/**
 * A run's history, for scrubbing, slow motion and replays: every recorded sim step packed into
 * one growing Float32Array, and `sample(t, out)` to fill a CarState between two frames. The
 * live scene records as it simulates, so any moment already driven can be shown again exactly.
 */
import {
  axleUse,
  betaOf,
  createState,
  FL,
  frontLoadOf,
  RL,
  speedOf,
  type CarState,
} from '../model/car';
import { G } from '../model/params';
import { emptyTrace, type Trace } from './trace';

/** Scalar CarState fields kept per frame (the per-wheel arrays follow them). */
const SCALARS = [
  't',
  'x',
  'n',
  'yaw',
  'vx',
  'vy',
  'r',
  'ax',
  'ay',
  'roll',
  'pitch',
  'wheelSpin',
  'steer',
  'twist',
  'throttle',
  'brake',
  'alphaF',
  'alphaR',
  'escMoment',
  'awdLock',
  'dist',
] as const satisfies readonly (keyof CarState)[];
type Scalar = (typeof SCALARS)[number];

const IDX = Object.fromEntries(SCALARS.map((k, i) => [k, i])) as Record<Scalar, number>;
const WHEELS = ['fz', 'fx', 'fy', 'cap'] as const;
const W0 = SCALARS.length;
const SPUN = W0 + 4 * WHEELS.length;
const PHASE = SPUN + 1;
/** arc length along the plan's path and the offset from it (the driver's view of the run) */
const S = PHASE + 1;
const ERR = S + 1;
const STRIDE = ERR + 1;
const TAU = 2 * Math.PI;

export class Recorder {
  private data = new Float32Array(STRIDE * 1024);
  count = 0;
  /** bumped whenever frames are dropped, so whoever drew them knows to start over */
  epoch = 0;

  clear() {
    this.count = 0;
    this.epoch++;
  }

  /** Drop every frame after time t (a run re-driven from there). */
  truncate(t: number) {
    while (this.count > 0 && this.get(this.count - 1, 't') > t + 1e-9) this.count--;
    this.epoch++;
  }

  push(st: CarState, phase: number, s = 0, err = 0) {
    if ((this.count + 1) * STRIDE > this.data.length) {
      const grown = new Float32Array(this.data.length * 2);
      grown.set(this.data);
      this.data = grown;
    }
    const d = this.data;
    const o = this.count * STRIDE;
    for (let k = 0; k < W0; k++) d[o + k] = st[SCALARS[k]];
    for (let w = 0; w < WHEELS.length; w++) {
      const arr = st[WHEELS[w]];
      for (let i = 0; i < 4; i++) d[o + W0 + 4 * w + i] = arr[i];
    }
    d[o + SPUN] = st.spun ? 1 : 0;
    d[o + PHASE] = phase;
    d[o + S] = s;
    d[o + ERR] = err;
    this.count++;
  }

  get(i: number, k: Scalar): number {
    return this.data[i * STRIDE + IDX[k]];
  }

  /** Copy frame i into `out` (no interpolation). */
  frame(i: number, out: CarState): CarState {
    this.sample(this.data[i * STRIDE + IDX.t], out);
    return out;
  }

  /** Arc length along the plan's path at frame i. */
  sAt(i: number): number {
    return this.data[i * STRIDE + S];
  }

  /** Arc length along the plan's path at time t, between the two frames around it. */
  sAtTime(t: number): number {
    if (!this.count) return 0;
    const i = this.indexAt(t);
    const j = Math.min(this.count - 1, i + 1);
    const ta = this.get(i, 't');
    const tb = this.get(j, 't');
    const w = tb > ta ? Math.min(1, Math.max(0, (t - ta) / (tb - ta))) : 0;
    return this.sAt(i) + (this.sAt(j) - this.sAt(i)) * w;
  }

  /** How far frame i was off the plan's path, sideways (m, the driver's own error). */
  errAt(i: number): number {
    return this.data[i * STRIDE + ERR];
  }

  phaseAt(i: number): number {
    return this.data[i * STRIDE + PHASE];
  }

  /** Whether frame i had spun. */
  spunAt(i: number): boolean {
    return this.data[i * STRIDE + SPUN] > 0;
  }

  /** time of the first and last frame (s); 0 when empty */
  get t0() {
    return this.count ? this.data[IDX.t] : 0;
  }
  get tEnd() {
    return this.count ? this.data[(this.count - 1) * STRIDE + IDX.t] : 0;
  }

  /** Index of the last frame at or before t (0 if t is before the first). */
  indexAt(t: number): number {
    let lo = 0;
    let hi = this.count - 1;
    if (hi < 0) return 0;
    if (t >= this.get(hi, 't')) return hi;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.get(mid, 't') <= t) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /**
   * Fill `out` with the state at time t (clamped to what's recorded), linearly between the two
   * frames around it; flags (spun, phase) from the earlier one. Returns the phase.
   */
  sample(t: number, out: CarState): number {
    if (!this.count) return 0;
    const d = this.data;
    const i = this.indexAt(t);
    const j = Math.min(this.count - 1, i + 1);
    const a = i * STRIDE;
    const b = j * STRIDE;
    const ta = d[a + IDX.t];
    const tb = d[b + IDX.t];
    const w = tb > ta ? Math.min(1, Math.max(0, (t - ta) / (tb - ta))) : 0;
    for (let k = 0; k < W0; k++) out[SCALARS[k]] = d[a + k] + (d[b + k] - d[a + k]) * w;
    // the wheel angle wraps at a full turn: take the short way round
    let dw = d[b + IDX.wheelSpin] - d[a + IDX.wheelSpin];
    if (dw < -Math.PI) dw += TAU;
    else if (dw > Math.PI) dw -= TAU;
    out.wheelSpin = d[a + IDX.wheelSpin] + dw * w;
    for (let q = 0; q < WHEELS.length; q++) {
      const arr = out[WHEELS[q]];
      for (let n = 0; n < 4; n++) {
        const k = W0 + 4 * q + n;
        arr[n] = d[a + k] + (d[b + k] - d[a + k]) * w;
      }
    }
    out.spun = d[a + SPUN] > 0;
    return d[a + PHASE];
  }

  /** The recording as a Trace, every `every` frames, for the scenarios' summaries. */
  toTrace(every = 1): Trace {
    const tr = emptyTrace();
    const st = scratch;
    const d = this.data;
    for (let i = 0; i < this.count; i += every) {
      const o = i * STRIDE;
      this.sample(d[o + IDX.t], st);
      tr.t.push(st.t);
      tr.x.push(st.x);
      tr.n.push(st.n);
      tr.yaw.push(st.yaw);
      tr.v.push(speedOf(st));
      tr.r.push(st.r);
      tr.ay.push(st.ay / G);
      tr.ax.push(st.ax / G);
      tr.steer.push(st.steer);
      tr.throttle.push(st.throttle);
      tr.brake.push(st.brake);
      tr.beta.push(betaOf(st));
      tr.useF.push(axleUse(st, FL));
      tr.useR.push(axleUse(st, RL));
      tr.alphaF.push(st.alphaF);
      tr.alphaR.push(st.alphaR);
      tr.front.push(frontLoadOf(st));
      tr.s.push(d[o + S]);
      tr.err.push(d[o + ERR]);
      tr.roll.push(st.roll);
      tr.pitch.push(st.pitch);
      tr.phase.push(d[o + PHASE]);
    }
    return tr;
  }
}

const scratch = createState();
