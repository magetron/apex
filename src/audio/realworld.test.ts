/**
 * Calibration against real engines: each freely licensed recording in test/real.ts (sources,
 * licences and recording conditions there) is matched by the closest catalog engine at the same
 * rpm, and both are measured with the same code (test/features.ts). Recording conditions vary
 * too much to demand equality, so these pin the direction and rough size of what we learned:
 * real engines are not pure tones, their spectrum sits in the 250–500 Hz bands rather than at
 * the bottom, a low firing line is heard mostly through its harmonics, and a cross-plane V8's
 * lope survives even a merged exhaust.
 *
 * Before calibration (same measurements): mean octave-band error 18.4 dB, tonal share 1.00 for
 * every engine, firing harmonics −8…0 dB, the Rover V8's sub-firing content −41 dB. After the
 * first calibration: 9.9 dB on average. Each catalog engine matched to a recording now carries
 * the silencer voicing that recording supports (its sound.muffler, with the source named).
 */
import { describe, expect, test } from 'vitest';
import { getEngine } from '../spec/catalog';
import { defaultAddons, engineVoiceConfig, firingOrder } from './config';
import { features, type Features } from './test/features';
import { FS, renderEngine } from './test/harness';
import { REAL, type RealRecording } from './test/real';

const ours = new Map<string, Features>();
function measure(key: string, r: RealRecording) {
  let f = ours.get(key);
  if (!f) {
    const e = getEngine(r.engine);
    const x = renderEngine(engineVoiceConfig(e), {
      rpm: r.rpm,
      throttle: r.throttle,
      seconds: 2,
      warmup: 0.5,
      addons: defaultAddons(e),
    });
    f = features(x.mono, FS, r.rpm, firingOrder(e), 0.5, 2.5);
    ours.set(key, f);
  }
  return f;
}
const bandError = (r: RealRecording, f: Features) =>
  r.bands.reduce((s, v, i) => s + Math.abs(v - f.bands[i]), 0) / r.bands.length;

const CASES = Object.entries(REAL);

describe('against real recordings (test/real.ts)', () => {
  test.each(CASES)('%s: not a pure tone, and its octave bands within 14 dB', (key, r) => {
    const f = measure(key, r);
    // real: 0.29–0.86 of the 100 Hz–3 kHz power on the half-order lines
    expect(f.tonal).toBeLessThan(0.96);
    expect(bandError(r, f)).toBeLessThan(14);
  });

  test('across all of them the octave bands are within 9 dB on average', () => {
    const mean = CASES.reduce((s, [k, r]) => s + bandError(r, measure(k, r)), 0) / CASES.length;
    expect(mean).toBeLessThan(9);
  });

  test.each([
    // the flat-plane V8's dull, firing-dominant pipe: back under its error before the first
    // calibration (6.7 dB), which had brightened it to 12.1
    ['458-launch', 6.7],
    // and no worse than the first calibration left them
    ['cayman-2000', 11.5],
    ['vq35hr-idle', 11.2],
  ] as const)('%s, voiced from its recording: octave bands within %s dB', (key, limit) => {
    expect(bandError(REAL[key], measure(key, REAL[key]))).toBeLessThan(limit);
  });

  test('a low firing line is heard through its harmonics, as in the recordings', () => {
    // where the real firing line sits under its own 2nd–4th harmonics (firing frequency below
    // ~100 Hz: slant-6, Cayman S, Scirocco R, Focus RS, VQ35HR), ours must not stand above them
    for (const [key, r] of CASES)
      if (r.harm > 0) expect(measure(key, r).harmonics, key).toBeGreaterThan(-3);
  });

  test("a cross-plane V8's lope survives its merged exhaust (Rover V8 idling)", () => {
    const key = 'rover-v8-idle';
    const r = REAL[key];
    const f = measure(key, r);
    // real −9 dB below the firing line, sidebands around it about −7 dB
    expect(f.sub).toBeGreaterThan(-20);
    const side = (orders: { k: number; db: number }[] | Record<string, number>) => {
      const get = (k: number) =>
        Array.isArray(orders) ? (orders.find((o) => o.k === k)?.db ?? -99) : (orders[k] ?? -99);
      return (
        10 * Math.log10([2.5, 3, 3.5, 4.5, 5, 5.5].reduce((s, k) => s + 10 ** (get(k) / 10), 0))
      );
    };
    expect(Math.abs(side(f.orders) - side(r.orders))).toBeLessThan(6);
  });

  test('a flat-plane V8 held at 3000 rpm stays clean below its firing line (Ferrari 458)', () => {
    // real −24 dB
    expect(measure('458-launch', REAL['458-launch']).sub).toBeLessThan(-15);
  });
});
