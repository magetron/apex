/**
 * Whoosh is a turbo's sound, and only a working turbo's. An NA engine's broadband 2–6 kHz energy
 * (with its own harmonic lines taken out) stays far below its firing line from idle to full
 * load; a turbo engine sounds like any other at idle and cruise, and its compressor joins in only
 * as throttle × rpm build boost.
 */
import { describe, expect, test } from 'vitest';
import { getEngine, listEngines } from '../spec/catalog';
import type { EngineSpec } from '../spec/types';
import { defaultAddons, engineVoiceConfig, firingOrder } from './config';
import { band, order, power, renderEngine, rms, type Rendered } from './test/harness';

type Point = 'idle' | 'cruise' | 'mid' | 'wot';
const at = (e: EngineSpec, p: Point) =>
  ({
    idle: { rpm: e.idleRpm, throttle: 0.1 },
    cruise: { rpm: 2500, throttle: 0.2 },
    mid: { rpm: 4000, throttle: 0.6 },
    wot: { rpm: 0.8 * e.redlineRpm, throttle: 1 },
  })[p];

const render = (e: EngineSpec, p: Point) => {
  const cfg = engineVoiceConfig(e);
  // well under the limiter, which would otherwise squash the firing line it is compared with
  return renderEngine(
    { ...cfg, gain: cfg.gain * 1e-3 },
    { ...at(e, p), seconds: 0.6, warmup: 0.4, addons: defaultAddons(e) },
  );
};

/**
 * The strongest of the firing line and its 2nd and 3rd harmonics: recordings put a low firing
 * line well under its harmonics (test/real.ts), so the comb's peak is the fair reference.
 */
function comb(e: EngineSpec, r: Rendered, rpm: number) {
  const F = firingOrder(e);
  return Math.max(...[1, 2, 3].map((m) => order(r.mono, m * F, rpm, r.start) ** 2 / 2));
}

/** dB of broadband 2–6 kHz power (harmonic lines removed) over the firing comb's peak. */
function broadband(e: EngineSpec, r: Rendered, rpm: number) {
  let lines = 0;
  for (let k = 0.5; (k * rpm) / 60 < 6000; k += 0.5)
    if ((k * rpm) / 60 > 2000) lines += order(r.mono, k, rpm, r.start) ** 2 / 2;
  const all = power(band(r.mono, 2000, 6000), r.start);
  return 10 * Math.log10(Math.max(all - lines, 1e-30) / comb(e, r, rpm));
}

describe('no whoosh without a turbo', () => {
  // dB re the firing comb's peak. Real NA engines (test/real.ts, measured the same way): a
  // Rover V8 idling -4.5, a slant-6 -10.7, a Ferrari 458 held at 3000 rpm -31; full load may
  // rasp, never hiss like a compressor
  const limit: Record<Point, number> = { idle: -10, cruise: -12, mid: -10, wot: -5 };
  const na = listEngines().filter((e) => e.induction === 'na');
  test.each(na.map((e) => [e.id, e] as const))(
    '%s: idle, cruise, mid load, full load',
    (_id, e) => {
      for (const p of ['idle', 'cruise', 'mid', 'wot'] as const)
        expect(broadband(e, render(e, p), at(e, p).rpm), p).toBeLessThan(limit[p]);
    },
  );
});

describe('the highs stay far under the engine note at full load', () => {
  // dB of the whole 2–6 kHz band over the firing comb's peak, summed over a full-load pull
  // (0.5–0.9 × red line), on every road engine (a rally car's anti-lag turbo is meant to be
  // heard). A real EA888 cruising: -34 dB (test/real.ts). Summed, because a header's
  // quarter-wave resonance can dip the comb at one rpm (a V12 at 0.8 × red line: -12) and a pull
  // sweeps straight through it, as it does through a real one.
  const road = listEngines().filter((e) => !e.sound.turbo?.antiLag);
  test.each(road.map((e) => [e.id, e] as const))('%s: 20 dB under over a pull', (_id, e) => {
    const cfg = engineVoiceConfig(e);
    let highs = 0;
    let note = 0;
    for (const frac of [0.5, 0.6, 0.7, 0.8, 0.9]) {
      const rpm = frac * e.redlineRpm;
      const r = renderEngine(
        { ...cfg, gain: cfg.gain * 1e-3 },
        { rpm, throttle: 1, seconds: 0.5, warmup: 0.3, addons: defaultAddons(e) },
      );
      highs += power(band(r.mono, 2000, 6000), r.start);
      note += comb(e, r, rpm);
    }
    expect(10 * Math.log10(highs / note)).toBeLessThan(-20);
  });
});

describe('a road turbo is heard only as a hint at full boost', () => {
  // BMW B58 (Z4 M40i) and S58, VW EA888 (GTI, Golf R), Audi 2.9 V6 and 4.0 V8 (RS 6) twin-turbo
  const ROAD = ['i6', 'i6-s58', 'i4', 'i4-ea888-evo4', 'v6-90', 'v8-ea825'];

  /** dB the turbo noises add to the 2–6 kHz band (they enter the centre mix: half each ear) */
  function added(e: EngineSpec, r: Rendered) {
    const g = engineVoiceConfig(e).gain * 1e-3 * Math.SQRT1_2;
    const without = r.mono.map((v, i) => v - g * r.turbo[i]);
    return (
      10 *
      Math.log10(
        power(band(r.mono, 2000, 6000), r.start) / power(band(without, 2000, 6000), r.start),
      )
    );
  }
  /** dB of the whole 2–6 kHz band over the firing comb's peak */
  function highs(e: EngineSpec, r: Rendered, rpm: number) {
    return 10 * Math.log10(power(band(r.mono, 2000, 6000), r.start) / comb(e, r, rpm));
  }

  test.each(ROAD)('%s, as delivered: nothing at idle or cruise, a hint at full load', (id) => {
    const e = getEngine(id);
    expect(defaultAddons(e).spool).toBe(false);
    for (const p of ['idle', 'cruise'] as const) expect(added(e, render(e, p))).toBeLessThan(0.05);
    // at full load the turbo adds no more than a hint, and the highs stay 20 dB under the comb
    // (a real EA888 cruising: -34 dB, test/real.ts)
    const wot = render(e, 'wot');
    expect(added(e, wot)).toBeLessThan(2);
    expect(highs(e, wot, at(e, 'wot').rpm)).toBeLessThan(-20);
  });

  test.each(['i6', 'v8-ea825'])(
    '%s with the spool chip on: the turbo is plain to hear, and only as it makes boost',
    (id) => {
      const e = getEngine(id);
      const spool = (p: Point) => {
        const cfg = engineVoiceConfig(e);
        return renderEngine(
          { ...cfg, gain: cfg.gain * 1e-3 },
          { ...at(e, p), seconds: 0.6, warmup: 0.4, addons: { ...defaultAddons(e), spool: true } },
        );
      };
      const [idle, cruise, mid, wot] = (['idle', 'cruise', 'mid', 'wot'] as const).map(spool);
      // (over an exhaust that already roars in the 2–6 kHz band, as real ones do)
      expect(added(e, wot)).toBeGreaterThan(2);
      expect(added(e, idle)).toBeLessThan(0.05);
      // and it grows with throttle × rpm
      const t = [idle, cruise, mid, wot].map((x) => rms(x.turbo, x.start));
      expect(t[0]).toBeLessThan(0.01 * t[2]);
      expect(t[1]).toBeLessThan(0.05 * t[2]);
      expect(t[3]).toBeGreaterThan(0.5 * t[2]);
    },
  );
});
