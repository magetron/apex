/**
 * The Wankel voice, from an inline two-rotor spec (the voice must cope before, and however, the
 * catalog lists one). Each rotor has three faces and turns at a third of e-shaft speed, so it
 * fires once per e-shaft turn; two rotors 180° apart fire every 180°, as often as an I4 at the
 * same rpm, through ports a rotor flank uncovers (no valves) and from a block with nothing
 * reciprocating.
 */
import { describe, expect, test } from 'vitest';
import { sound } from '../spec/builders';
import { getEngine, listEngines } from '../spec/catalog';
import type { EngineSpec } from '../spec/types';
import { engineVoiceConfig, firingOrder } from './config';
import { EngineKernel } from './dsp/engineKernel';
import { dominantOrder, FS, order, pulseSpread, renderEngine, renderVoice } from './test/harness';

const rotary: EngineSpec = {
  id: 'test-rotary-2',
  name: 'Two-rotor Wankel (test)',
  family: 'rotary',
  layoutLabel: '2-rotor Wankel',
  examples: [],
  // a rotary has no bore, stroke or rod; the voice never reads them
  boreMm: 0,
  strokeMm: 0,
  rodMm: 0,
  borePitchMm: 80,
  bankAngleDeg: 0,
  banks: [{ tiltDeg: 0, head: 0 }],
  cylinders: [
    { num: 1, bank: 0, axialMm: -40, pin: 0, throwDeg: 0, fireDeg: 0 },
    { num: 2, bank: 0, axialMm: 40, pin: 1, throwDeg: 180, fireDeg: 180 },
  ],
  firingOrder: [1, 2],
  displacementCc: 1308,
  valvetrain: { type: 'dohc', valvesPerCyl: 0 },
  induction: 'na',
  idleRpm: 800,
  redlineRpm: 9000,
  massKg: 120,
  powerKw: 170,
  torqueNm: 211,
  geometry: {},
  sound: sound({ character: 'shriek', headerMm: 500 }),
};

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const samplesPerDeg = (rpm: number) => FS / (rpm * 6);

describe('rotary voice config', () => {
  // the inline spec, plus whatever rotaries the catalog has by now
  const rotaries = [rotary, ...listEngines().filter((e) => e.family === 'rotary')];
  test.each(rotaries.map((e) => [e.id, e] as const))(
    '%s: every rotor fires once per e-shaft turn, through ports',
    (_id, e) => {
      const cfg = engineVoiceConfig(e);
      const rotors = cfg.fireDeg.length / 2;
      expect(firingOrder(e)).toBe(rotors);
      // two events a cycle per rotor, 360° apart, rotors evenly between
      const deg = sorted(cfg.fireDeg);
      deg.forEach((d, i) => expect(d).toBeCloseTo((i * 360) / rotors, 6));
      expect(cfg.ports.valves).toBe(false);
      expect(cfg.ports.openDeg).toBeGreaterThan(0);
      expect(cfg.orders).toEqual([]);
      expect(cfg.ohv).toBe(false);
      expect(cfg.headerMm).toHaveLength(cfg.fireDeg.length);
      expect(cfg.gain).toBeGreaterThan(0);
    },
  );

  test('one chamber per event: the 13B-style 1308 cc is two 654 cc chambers', () => {
    expect(engineVoiceConfig(rotary).cylCc).toBe(654);
  });

  test('copes with however the rotors are listed', () => {
    const fire = (spec: EngineSpec) => sorted(engineVoiceConfig(spec).fireDeg);
    // no usable phase between the rotors: spread evenly
    const samePhase: EngineSpec = {
      ...rotary,
      cylinders: rotary.cylinders.map((c) => ({ ...c, fireDeg: 0 })),
    };
    expect(fire(samePhase)).toEqual([0, 180, 360, 540]);
    // listed face by face, three per rotor (eccentric = pin)
    const byFace: EngineSpec = {
      ...rotary,
      cylinders: [0, 1, 2, 3, 4, 5].map((i) => ({
        num: i + 1,
        bank: 0,
        axialMm: i < 3 ? -40 : 40,
        pin: i < 3 ? 0 : 1,
        throwDeg: 0,
        fireDeg: (i < 3 ? 0 : 180) + 360 * (i % 3),
      })),
    };
    expect(fire(byFace)).toEqual([0, 180, 360, 540]);
    // no bank data at all
    expect(() => engineVoiceConfig({ ...rotary, banks: [] })).not.toThrow();
  });
});

describe('rotary sound', () => {
  const rpm = 3000;
  const cfg = engineVoiceConfig(rotary);
  const r = renderEngine(cfg, { rpm, throttle: 0.6, seconds: 1, warmup: 0.5 });

  test('each rotor fires every 360° of e-shaft, the two 180° apart', () => {
    const fires = r.events.filter((e) => e.kind === 'fire');
    expect(fires.length).toBeGreaterThan(40);
    for (let j = 1; j < fires.length; j++)
      expect(fires[j].t - fires[j - 1].t).toBeCloseTo(180 * samplesPerDeg(rpm), 3);
    // events 0/1 belong to rotor 1, 2/3 to rotor 2: each rotor alternates its two slots
    const rotor1 = fires.filter((e) => e.cyl < 2);
    for (let j = 1; j < rotor1.length; j++)
      expect(rotor1[j].t - rotor1[j - 1].t).toBeCloseTo(360 * samplesPerDeg(rpm), 3);
  });

  test('its comb steps in order 2, in each ear and across the rev range up to its 9000 rpm wail', () => {
    // the loudest line is order 2 or a harmonic of it (a low firing line sits under its
    // harmonics in real recordings, test/real.ts)
    const comb = (x: Float32Array, at: number, start: number) => {
      const k = dominantOrder(x, at, start, 8);
      return k % 2 === 0 && k <= 6;
    };
    for (const x of [r.mono, r.L, r.R]) expect(comb(x, rpm, r.start)).toBe(true);
    for (const frac of [0.3, 0.6, 0.95]) {
      const at = frac * rotary.redlineRpm;
      const top = renderEngine(cfg, { rpm: at, throttle: 1, seconds: 0.5, warmup: 0.4 });
      expect(comb(top.mono, at, top.start)).toBe(true);
    }
  });

  test('beside an I4: a smooth block, and it revs higher', () => {
    const spec = getEngine('i4');
    const i4 = renderEngine(engineVoiceConfig(spec), {
      rpm,
      throttle: 0.6,
      seconds: 1,
      warmup: 0.5,
    });
    // the I4's pistons shake the block at order 2 on top of its torque pulses
    expect(order(r.mechanical, 2, rpm, r.start)).toBeLessThan(
      0.5 * order(i4.mechanical, 2, rpm, i4.start),
    );
    // the same firing order, but at the redline its line sits ~1.3× higher: the wail
    const top = (e: EngineSpec) => (firingOrder(e) * e.redlineRpm) / 60;
    expect(top(rotary) / top(spec)).toBeGreaterThan(1.25);
  });

  test('at idle its big port overlap makes every burn different (the brap)', () => {
    // (over 2 s of burns: a 1 s count of an I4's ~25 is too few to pin its spread)
    const spread = (cfgOf: typeof cfg, idleRpm: number) =>
      pulseSpread(renderEngine(cfgOf, { rpm: idleRpm, throttle: 0.1, seconds: 2, warmup: 0.5 }));
    const i4 = getEngine('i4');
    expect(spread(cfg, rotary.idleRpm)).toBeGreaterThan(
      1.5 * spread(engineVoiceConfig(i4), i4.idleRpm),
    );
  });

  test('stays finite and under the limiter, whatever the input does', () => {
    const k = new EngineKernel(cfg, FS, { seed: 5 });
    const out = renderVoice(k, cfg.groupCount, 2, (t) =>
      t % 1 < 0.5
        ? { rpm: rotary.redlineRpm * 1.2, throttle: 1 }
        : { rpm: rotary.redlineRpm * (1 - (t % 1)), throttle: 0 },
    );
    let peak = 0;
    for (let i = 0; i < out.L.length; i++) {
      expect(Number.isFinite(out.L[i]) && Number.isFinite(out.R[i])).toBe(true);
      peak = Math.max(peak, Math.abs(out.L[i]), Math.abs(out.R[i]));
    }
    expect(peak).toBeLessThanOrEqual(0.9 + 1e-6);
    expect(peak).toBeGreaterThan(0.05);
  });
});
