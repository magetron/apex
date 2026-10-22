/**
 * Constant-radius skidpad with a slow speed ramp (ISO 4138 style). The same driver holds every
 * car on the circle; the extra steering it needs as lateral g builds is the understeer gradient.
 * Near the limit it shows which axle lets go first.
 */
import { betaOf, speedOf } from '../model/car';
import { Path } from './path';
import { DEG_PER_RAD, linFit, type Trace } from './trace';
import type { ScenarioDef } from './types';

export const SKIDPAD_RADIUS = 30;
const START_KMH = 20;
const RAMP_S = 26;
const DURATION = 32;
/** fit range for the linear understeer gradient (g) */
const FIT_LO = 0.15;
const FIT_HI = 0.5;

function cones(): Float64Array {
  const out: number[] = [];
  for (const r of [SKIDPAD_RADIUS - 2.6, SKIDPAD_RADIUS + 2.6]) {
    const count = Math.round((2 * Math.PI * r) / 6);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * 2 * Math.PI;
      // circle centred to the left of the start point
      out.push(r * Math.sin(a), SKIDPAD_RADIUS - r * Math.cos(a));
    }
  }
  return Float64Array.from(out);
}

export const skidpad: ScenarioDef = {
  id: 'skidpad',
  label: 'Find the limit',
  short: 'Skidpad',
  title: 'Round a circle, speed rising until one end of the car slides',
  speed: { min: 45, max: 80, def: 64, label: 'Top speed' },
  headline: 'usGradient',
  event: 'Limit',
  radius: SKIDPAD_RADIUS,
  verdict: (r) =>
    r.values.limitAxle === 1 ? 'front-first' : r.values.limitAxle === -1 ? 'rear-first' : null,
  plan(kmh) {
    const v0 = START_KMH / 3.6;
    const v1 = Math.max(v0 + 1, kmh / 3.6);
    const path = Path.build([{ kind: 'arc', radius: SKIDPAD_RADIUS, angle: 2 * Math.PI * 7 }]);
    return {
      id: 'skidpad',
      kmh,
      path,
      // one lap is enough to draw
      road: Path.build([{ kind: 'arc', radius: SKIDPAD_RADIUS, angle: 2 * Math.PI }]),
      roadWidth: 4.4,
      roadOffset: 0,
      lanes: [],
      cones: cones(),
      eventS: NaN,
      overview: [0, 2 * Math.PI * SKIDPAD_RADIUS],
      marks: () => [{ s: 0.5, label: 'Speed rising', kind: 'drive' }],
      duration: DURATION,
      startS: 0,
      startV: v0,
      gripScaled: true,
      control(c, p, st, u, dt) {
        const d = c.driver;
        d.steer(p, st, u, dt);
        if (c.phase === 0) {
          const f = Math.min(1, st.t / RAMP_S);
          const vt = c.vScale * Math.sqrt(v0 * v0 + (v1 * v1 - v0 * v0) * f);
          const aFf = f < 1 ? (c.vScale * c.vScale * (v1 * v1 - v0 * v0)) / (2 * RAMP_S * vt) : 0;
          d.speed(p, st, u, vt, aFf, dt);
          // the car can't hold the circle any more: note the limit and ease off
          if (st.t > 2 && (Math.abs(d.err) > 1.2 || Math.abs(betaOf(st)) > 0.17)) {
            c.phase = 1;
            c.tEvent = st.t;
            c.memo = speedOf(st) - 1.5;
          }
        } else {
          d.speed(p, st, u, c.memo, 0, dt);
        }
      },
      summarize(tr, p) {
        return skidpadResult(tr, p.L);
      },
    };
  },
};

export function skidpadResult(tr: Trace, L: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  const hiX: number[] = [];
  const hiY: number[] = [];
  // sustained lateral g: 1 s moving average
  let maxAy = 0;
  const win = Math.max(1, Math.round(1 / ((tr.t[1] ?? 1) - tr.t[0] || 1)));
  let acc = 0;
  for (let i = 0; i < tr.t.length; i++) {
    acc += Math.abs(tr.ay[i]);
    if (i >= win) acc -= Math.abs(tr.ay[i - win]);
    if (i >= win && tr.phase[i] === 0) maxAy = Math.max(maxAy, acc / win);
  }
  let limitAxle = 0;
  for (let i = 0; i < tr.t.length; i++) {
    if (tr.t[i] < 2 || tr.phase[i] !== 0 || tr.v[i] < 3) continue;
    const ay = tr.ay[i];
    // steering beyond the geometric (Ackermann) angle for the curvature actually driven
    const extra = (tr.steer[i] - (L * tr.r[i]) / tr.v[i]) * DEG_PER_RAD;
    if (ay >= FIT_LO && ay <= FIT_HI) {
      xs.push(ay);
      ys.push(extra);
    }
    if (ay >= 0.6 * maxAy && ay <= 0.97 * maxAy) {
      hiX.push(ay);
      hiY.push(extra);
    }
    if (!limitAxle && Math.max(tr.useF[i], tr.useR[i]) > 0.97)
      limitAxle = tr.useF[i] >= tr.useR[i] ? 1 : -1;
  }
  return {
    values: {
      usGradient: linFit(xs, ys).slope,
      usGradientLimit: linFit(hiX, hiY).slope,
      maxAy,
      // +1 = the fronts let go first (limit understeer), −1 = the rears (limit oversteer)
      limitAxle,
    },
    headline: 'usGradient' as const,
    spun: false,
  };
}
