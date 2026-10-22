/**
 * Every layout at one operating point, told apart by its spectrum alone. Each engine is rendered
 * offline (1 s after a 0.5 s warm-up) at the same rpm and throttle, and its voice is measured
 * where it lives: the dominant crank order, the sub-harmonics a lumpy collector leaves, how
 * strong the firing line's harmonics are, and whether the highs pulse with the firing or just
 * hiss. "Order" = multiple of crank speed (rpm/60).
 */
import { describe, expect, test } from 'vitest';
import { getEngine } from '../spec/catalog';
import { engineVoiceConfig, firingOrder } from './config';
import {
  band,
  dominantOrder,
  envelopeSwing,
  order,
  orderPower,
  power,
  pulseSpread,
  renderEngine,
  type Rendered,
} from './test/harness';

const RPM = 3000;
const THROTTLE = 0.6;

const cache = new Map<string, Rendered>();
/** idle: each engine at its own idle speed, nearly closed throttle */
function render(id: string, at: 'mid' | 'idle' = 'mid') {
  const key = `${id}@${at}`;
  let r = cache.get(key);
  if (!r) {
    const spec = getEngine(id);
    r = renderEngine(engineVoiceConfig(spec), {
      rpm: at === 'idle' ? spec.idleRpm : RPM,
      throttle: at === 'idle' ? 0.1 : THROTTLE,
      seconds: 1,
      warmup: 0.5,
    });
    cache.set(key, r);
  }
  return r;
}
const rpmOf = (id: string, at: 'mid' | 'idle') => (at === 'idle' ? getEngine(id).idleRpm : RPM);
/** power at `orders` relative to the firing line (cylinders / 2) */
const rel = (id: string, orders: number[], at: 'mid' | 'idle' = 'mid') => {
  const r = render(id, at);
  return orderPower(r.mono, rpmOf(id, at), r.start, orders, firingOrder(getEngine(id)));
};

/** The note each layout is known for, and the crank order that carries it. */
const LAYOUTS: [id: string, note: string, order: number][] = [
  ['i3', 'thrum', 1.5],
  ['i4', 'buzz', 2],
  ['flat4', 'rumble', 2],
  ['i5', 'warble', 2.5],
  ['i6', 'rasp', 3],
  ['flat6', 'howl', 3],
  ['v6-60', 'howl', 3],
  ['v8-cross', 'burble', 4],
  ['v8-flat', 'scream', 4],
  ['v10', 'wail', 5],
  ['v12', 'shriek', 6],
];

describe(`each layout has its own voice at ${RPM} rpm`, () => {
  test.each(LAYOUTS)('%s (%s): its comb steps in order %s, in each ear too', (id, _note, k) => {
    const r = render(id);
    // the loudest line is the firing line or its 2nd/3rd harmonic: recordings put a low firing
    // line under its harmonics (test/real.ts). Per-bank engines included: in the lows both
    // pipes reach both ears, so a V12 is never heard as two I6s (order 3), a flat-plane V8 as
    // two I4s (order 2), a V10 as two I5s
    for (const x of [r.mono, r.L, r.R]) {
      const top = dominantOrder(x, RPM, r.start, 4 * k);
      expect(top % k).toBe(0);
      expect(top).toBeLessThanOrEqual(4 * k);
    }
  });

  /** the half orders either side of the firing line (F ± 0.5, 1, 1.5), re it */
  const sidebands = (id: string, at: 'mid' | 'idle' = 'mid') => {
    const F = firingOrder(getEngine(id));
    return rel(id, [F - 1.5, F - 1, F - 0.5, F + 0.5, F + 1, F + 1.5], at);
  };

  test('cross-plane V8 burbles around its firing line, flat-plane V8 does not', () => {
    // each cross-plane bank fires 180-270-180-90°: the cylinders breathing against a
    // bank-mate's fresh blowdown fire weaker, a pattern that flanks the firing line with
    // sidebands. Real: a Rover V8 idling -7 dB, a Ferrari 458 at 3000 rpm -33 dB (test/real.ts)
    expect(sidebands('v8-cross', 'idle')).toBeGreaterThan(10 ** -1.3);
    expect(sidebands('v8-cross', 'idle')).toBeGreaterThan(10 * sidebands('v8-flat', 'idle'));
    expect(sidebands('v8-cross')).toBeGreaterThan(1.5 * sidebands('v8-flat'));
  });

  test('at idle the burble rides on the firing line as ±1-order sidebands', () => {
    // orders 0.5 and 1 sit below 15 Hz at idle; what is heard is the firing line and its
    // harmonic, each flanked by a revolution-long lope
    const side = (id: string) => rel(id, [3, 5, 7, 9], 'idle');
    expect(side('v8-cross')).toBeGreaterThan(10 ** -1.8);
    expect(side('v8-cross')).toBeGreaterThan(10 * side('v8-flat'));
  });

  test('unequal-length headers make the flat-4 rumble around its firing line; the I4 does not', () => {
    expect(sidebands('flat4')).toBeGreaterThan(10 * sidebands('i4'));
  });

  test("flat-6 and 60° V6 howl with each bank's three-cylinder beat (order 1.5); the I6 does not", () => {
    // over 2 s: what the I6 has on those orders is only the flow roar, which 1 s barely resolves
    const howl = (id: string) => {
      const e = getEngine(id);
      const r = renderEngine(engineVoiceConfig(e), {
        rpm: RPM,
        throttle: THROTTLE,
        seconds: 2,
        warmup: 0.5,
      });
      return orderPower(r.mono, RPM, r.start, [1.5, 4.5], firingOrder(e));
    };
    // (every real engine's cylinders differ by a few %, which gives the I6 some of it too)
    expect(howl('flat6')).toBeGreaterThan(2.5 * howl('i6'));
    expect(howl('v6-60')).toBeGreaterThan(2.5 * howl('i6'));
  });

  test("the I6 rasps (strong harmonics of order 3); the V12's order 6 shrieks almost alone", () => {
    const harmonics = (id: string) => {
      const F = firingOrder(getEngine(id));
      return rel(id, [2 * F, 3 * F, 4 * F]);
    };
    expect(harmonics('i6')).toBeGreaterThan(0.3);
    expect(harmonics('v12')).toBeLessThan(0.15);
    expect(harmonics('i6')).toBeGreaterThan(4 * harmonics('v12'));
  });
});

describe('idle: refinement and lope come from the layout, not a blanket character', () => {
  // every engine at 950 rpm, throttle nearly shut (a BMW Z4 M40i's B58 sits at ~1000 rpm)
  const IDLE = 950;
  const cache = new Map<string, Rendered>();
  const idle = (id: string) => {
    let r = cache.get(id);
    if (!r) {
      const spec = getEngine(id);
      r = renderEngine(engineVoiceConfig(spec), {
        rpm: IDLE,
        throttle: 0.1,
        seconds: 1,
        warmup: 0.5,
      });
      cache.set(id, r);
    }
    return r;
  };
  const F = (id: string) => firingOrder(getEngine(id));
  const below = (id: string) => Array.from({ length: 2 * F(id) - 1 }, (_, i) => (i + 1) / 2);
  /** how much the 80 Hz–2 kHz loudness swings below the firing order: lope */
  const lope = (id: string) => envelopeSwing(idle(id).mono, IDLE, idle(id).start, below(id));
  /** how distinctly each pulse stands out (the loudness swing at the firing order) */
  const pulsing = (id: string) => envelopeSwing(idle(id).mono, IDLE, idle(id).start, [F(id)]);

  test('the I6 hums: even pulses, no lope, nothing below order 3, no hiss on top', () => {
    const i6 = idle('i6');
    expect(pulseSpread(i6)).toBeLessThan(0.05);
    expect(pulseSpread(i6)).toBeLessThan(pulseSpread(idle('v8-cross')) / 3);
    expect(lope('i6')).toBeLessThan(lope('v8-cross') / 4);
    expect(lope('i6')).toBeLessThan(lope('flat4') / 3);
    // real even-firing engines: -13 (VQ35HR) to -24 dB (Ferrari 458) below the firing line
    expect(orderPower(i6.mono, IDLE, i6.start, below('i6'), 3)).toBeLessThan(10 ** -2.5);
    // highs at least 10 dB under the firing comb's peak (real idling engines measured the same
    // way: 4.5–11 dB, test/real.ts)
    const comb = Math.max(...[3, 6, 9].map((k) => order(i6.mono, k, IDLE, i6.start) ** 2 / 2));
    expect(power(band(i6.mono, 1000, 8000), i6.start)).toBeLessThan(0.1 * comb);
  });

  test('lumpy where the layout is: a cross-plane bank, unequal headers', () => {
    // each cross-plane bank fires 180-270-180-90°; the flat-4's pulses reach its collector unevenly
    expect(lope('v8-cross')).toBeGreaterThan(3 * lope('v8-flat'));
    expect(lope('flat4')).toBeGreaterThan(3 * lope('i4'));
  });

  test('the more cylinders share a collector, the more their pulses blend', () => {
    expect(pulsing('i3')).toBeGreaterThan(pulsing('i6'));
    expect(pulsing('i4')).toBeGreaterThan(1.4 * pulsing('i6'));
    expect(pulsing('i6')).toBeGreaterThan(1.4 * pulsing('v12'));
  });
});
