/**
 * The characters we cannot listen to, measured instead. Each one should fall out of the spec
 * (firing angles, collectors, header lengths, balance), not out of per-engine special cases.
 * "Order" = multiple of crank speed (rpm/60); a 4-stroke fires cylinders/2 times per rev.
 */
import { describe, expect, test } from 'vitest';
import { getEngine } from '../spec/catalog';
import type { EngineSoundParams } from '../spec/types';
import { engineVoiceConfig } from './config';
import { NO_ADDONS } from './dsp/types';
import { order, orderPower, renderEngine, tone, type Rendered } from './test/harness';

const render = (
  id: string,
  rpm: number,
  throttle = 0.6,
  override: Partial<EngineSoundParams> = {},
) =>
  renderEngine(engineVoiceConfig(getEngine(id), override), {
    rpm,
    throttle,
    seconds: 1,
    warmup: 0.5,
  });

/** Half-order grid 0.5 … upTo */
const grid = (upTo: number) => Array.from({ length: Math.round(upTo * 2) }, (_, i) => (i + 1) / 2);
const isHalf = (k: number) => k % 1 === 0.5;

/** Share of the line power (orders ≤ upTo) that sits on the orders `pick` selects. */
function share(
  x: Float32Array,
  r: Rendered,
  rpm: number,
  upTo: number,
  pick: (k: number) => boolean,
) {
  let part = 0;
  let all = 0;
  for (const k of grid(upTo)) {
    const a = order(x, k, rpm, r.start) ** 2;
    all += a;
    if (pick(k)) part += a;
  }
  return part / all;
}

describe('cross-plane V8 burble vs flat-plane V8 shriek', () => {
  // Per bank, a cross-plane fires 180-270-180-90°: that train repeats only every 720°, so each
  // bank's collector carries the odd half orders (0.5, 1.5, 2.5, 3.5) — the burble. A
  // flat-plane bank fires every 180° (an inline-4), so those orders are absent.
  // In the lows both pipes reach both ears alike, so there the two banks' half orders cancel
  // much as they do in the air (otherwise each ear would hear half an engine: a V12 as an I6).
  // What reaches the ears is what the uneven trains leave in the cylinders: one whose valve
  // overlap meets a bank-mate's fresh blowdown keeps more exhaust gas and fires weaker, and that
  // pattern repeats every revolution (orders 0.5 and 1 and their kin).
  test.each([2000, 3500, 5000])(
    '%i rpm: half orders per bank, sub-harmonics at each ear',
    (rpm) => {
      const cross = render('v8-cross', rpm);
      const flat = render('v8-flat', rpm);
      for (const g of [0, 1]) {
        // (> 0.2: unevenly filled cylinders, and the few % every real engine's cylinders differ
        // by, add whole orders per bank too)
        expect(share(cross.groups[g], cross, rpm, 8, isHalf)).toBeGreaterThan(0.2);
        expect(share(flat.groups[g], flat, rpm, 8, isHalf)).toBeLessThan(0.05);
      }
      // what is heard is the firing line flanked by sidebands (orders 0.5 and 1 themselves sit
      // below ~80 Hz, where a tailpipe hardly radiates; a real Rover V8's sidebands: -7 dB)
      const sub = (x: Float32Array, r: Rendered) =>
        orderPower(x, rpm, r.start, [2.5, 3, 3.5, 4.5, 5, 5.5], 4);
      // the burble reaches each ear…
      expect(sub(cross.L, cross)).toBeGreaterThan(1.2 * sub(flat.L, flat));
      expect(sub(cross.R, cross)).toBeGreaterThan(1.2 * sub(flat.R, flat));
      // …and survives a mono mix-down
      expect(sub(cross.mono, cross)).toBeGreaterThan(1.2 * sub(flat.mono, flat));
    },
  );

  test('an X-pipe (crossover) evens the banks out and trades burble for rasp', () => {
    const rpm = 3500;
    const dual = render('v8-cross', rpm);
    const x = render('v8-cross', rpm, 0.6, { collector: 'crossover' });
    // what the left tailpipe itself radiates (an ear also hears the right one in the lows)
    const s = (r: Rendered) => share(r.groups[0], r, rpm, 8, isHalf);
    expect(s(x)).toBeLessThan(0.5 * s(dual));
  });

  test('the flat-plane revs higher, so its firing line at the redline sits ~1.4× higher', () => {
    const cross = getEngine('v8-cross');
    const flat = getEngine('v8-flat');
    const hz = (e: typeof cross) => (e.redlineRpm / 60) * (e.cylinders.length / 2);
    expect(hz(flat) / hz(cross)).toBeGreaterThan(1.3);
    // and that line is what you hear at the top
    const r = render('v8-flat', 0.95 * flat.redlineRpm, 1);
    const f = (0.95 * flat.redlineRpm) / 60;
    const amps = grid(16).map((k) => tone(r.mono, k * f, r.start));
    expect(Math.max(...amps)).toBe(amps[grid(16).indexOf(4)]);
  });
});

describe('unequal-header boxer rumble', () => {
  // Same flat-4, same firing order: only the header lengths differ. Unequal primaries
  // (spec: 380/680/420/720 mm) make the pulses reach the collector unevenly.
  test.each([2000, 3500, 5000])(
    '%i rpm: off-firing lines around order 2 appear only with unequal headers',
    (rpm) => {
      const unequal = render('flat4', rpm);
      const equal = render('flat4', rpm, 0.6, { headerMm: 550 });
      // the half orders either side of the firing line (sub-firing ones below ~70 Hz barely
      // radiate from a tailpipe)
      const sub = (r: Rendered) =>
        share(r.mono, r, rpm, 4, (k) => k !== 2 && Math.abs(k - 2) <= 1.5);
      expect(sub(unequal)).toBeGreaterThan(3 * sub(equal));
      expect(sub(equal)).toBeLessThan(0.04);
    },
  );
});

describe('I5 warble, I6 smoothness, I3 thrum', () => {
  const rpm = 3500;
  test('I5: the firing line falls between crank harmonics (2.5 order) and beats against the block', () => {
    const i5 = render('i5', rpm);
    const i6 = render('i6', rpm);
    expect(share(i5.mono, i5, rpm, 5, isHalf)).toBeGreaterThan(0.4);
    expect(share(i6.mono, i6, rpm, 6, isHalf)).toBeLessThan(0.05);
    // the I5's free rocking couples shake the block at whole orders; the I6 has none
    expect(order(i5.mechanical, 2, rpm, i5.start)).toBeGreaterThan(
      100 * order(i6.mechanical, 2, rpm, i6.start),
    );
  });

  test('I6: no free forces or couples, and nothing but firing harmonics in the exhaust', () => {
    const i6 = render('i6', rpm);
    const i4 = render('i4', rpm);
    const block = (r: Rendered, k: number) => order(r.mechanical, k, rpm, r.start);
    expect(block(i6, 1)).toBeLessThan(1e-4);
    expect(block(i6, 2)).toBeLessThan(1e-4);
    // the I4's secondary shake is right there
    expect(block(i4, 2)).toBeGreaterThan(1e-2);
    expect(share(i6.mono, i6, rpm, 12, (k) => k % 3 !== 0)).toBeLessThan(0.05);
  });

  test('I3: a power stroke every 240° — its comb steps in 1.5 orders, with a rocking couple', () => {
    const i3 = render('i3', rpm);
    const i6 = render('i6', rpm);
    const amps = grid(6).map((k) => order(i3.mono, k, rpm, i3.start));
    // a firing harmonic leads (recordings put a low firing line under its harmonics)
    expect(grid(6)[amps.indexOf(Math.max(...amps))] % 1.5).toBe(0);
    expect(order(i3.mechanical, 1, rpm, i3.start)).toBeGreaterThan(
      100 * order(i6.mechanical, 1, rpm, i6.start),
    );
  });
});

describe('V10 / V12 howl', () => {
  test.each(['v10', 'v12'])(
    '%s near the redline: a firing line above 600 Hz at the head of its comb',
    (id) => {
      const spec = getEngine(id);
      const rpm = 0.95 * spec.redlineRpm;
      const F = spec.cylinders.length / 2;
      const r = render(id, rpm, 1);
      expect((rpm / 60) * F).toBeGreaterThan(600);
      const amps = grid(3 * F).map((k) => order(r.mono, k, rpm, r.start));
      const top = Math.max(...amps);
      expect(grid(3 * F)[amps.indexOf(top)] % F).toBe(0);
      // the firing line itself within 3 dB of the loudest
      expect(amps[grid(3 * F).indexOf(F)]).toBeGreaterThan(top / Math.SQRT2);
    },
  );

  test('a V12 is two smooth I6 banks; a 90° V10 is two I5 banks (2.5 order per bank)', () => {
    const rpm = 5000;
    const v12 = render('v12', rpm);
    const v10 = render('v10', rpm);
    expect(share(v12.groups[0], v12, rpm, 12, isHalf)).toBeLessThan(0.05);
    expect(share(v10.groups[0], v10, rpm, 10, isHalf)).toBeGreaterThan(0.2);
    expect(share(v10.groups[0], v10, rpm, 10, isHalf)).toBeGreaterThan(
      5 * share(v12.groups[0], v12, rpm, 12, isHalf),
    );
  });
});

describe('W16 whoosh', () => {
  // Sixteen pulses per two revs through four turbines. (No longer "the most broadband engine
  // of the catalog": calibrated against real recordings, every engine has its exhaust roar,
  // and a near-silent synth had made the turbos' rush stand out.)
  test('with its turbos audible, the W16 whooshes: well above the NA V12, and its turbos add it', () => {
    const floorShare = (id: string, spool = true) => {
      const spec = getEngine(id);
      const rpm = 0.6 * spec.redlineRpm;
      const r = renderEngine(engineVoiceConfig(spec), {
        rpm,
        throttle: 0.8,
        seconds: 1,
        warmup: 1,
        addons: { ...NO_ADDONS, spool },
      });
      let between = 0;
      let lines = 0;
      for (let k = 0.5; (k * rpm) / 60 < 3000; k += 0.5) {
        between += tone(r.mono, ((k + 0.25) * rpm) / 60, r.start);
        lines += order(r.mono, k, rpm, r.start);
      }
      return between / lines;
    };
    const w16 = floorShare('w16');
    expect(w16).toBeGreaterThan(1.5 * floorShare('v12'));
    expect(w16).toBeGreaterThan(1.2 * floorShare('w16', false));
  }, 60000);
});
