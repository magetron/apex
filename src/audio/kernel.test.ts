/**
 * Objective checks of the engine kernel, rendered offline in Node: timing, pitch, bounds,
 * determinism, rev limiter.
 */
import { describe, expect, test } from 'vitest';
import { sound, vee } from '../spec/builders';
import { getEngine, listEngines } from '../spec/catalog';
import { bankCylinders, firingEvents, firingIntervals } from '../spec/derive/firing';
import type { EngineSpec } from '../spec/types';
import { engineVoiceConfig, firingOrder } from './config';
import { EngineKernel } from './dsp/engineKernel';
import type { Addons } from './dsp/types';
import { FS, order, renderEngine, renderVoice, rms } from './test/harness';

const ALL_ON: Addons = {
  spool: true,
  wastegate: true,
  bov: true,
  antiLag: true,
  crackle: true,
  avas: false,
};

/** samples per crank degree at a steady rpm */
const samplesPerDeg = (rpm: number) => FS / (rpm * 6);

/** A 90° V6 with the old Buick odd-fire crank: power strokes alternate 90° and 150° apart. */
const oddFireV6: EngineSpec = vee(6, 90, {
  id: 'test-v6-oddfire',
  name: 'Odd-fire V6 (test)',
  layoutLabel: '90° V6, shared pins',
  examples: [],
  boreMm: 96.5,
  strokeMm: 86.4,
  rodMm: 150,
  borePitchMm: 112,
  numbering: 'alternating',
  firstBank: 'left',
  pins: 'shared',
  firingOrder: [1, 6, 5, 4, 3, 2],
  fireIntervalsDeg: [90, 150, 90, 150, 90, 150],
  valvetrain: { type: 'ohv', valvesPerCyl: 2 },
  induction: 'na',
  idleRpm: 700,
  redlineRpm: 5500,
  massKg: 180,
  powerKw: 130,
  torqueNm: 300,
  sound: sound({ character: 'burble' }),
});

describe('firing pulses', () => {
  test.each(['v8-cross', 'v8-flat', 'i5', 'flat4', 'v10', 'w16'])(
    '%s: combustion events follow firingEvents() at the live rpm, sample-exact',
    (id) => {
      const spec = getEngine(id);
      const rpm = 3000;
      const r = renderEngine(engineVoiceConfig(spec), {
        rpm,
        throttle: 0.5,
        seconds: 0.5,
        warmup: 0.2,
      });
      const fires = r.events.filter((e) => e.kind === 'fire' && e.t > FS * 0.1);
      const order = firingEvents(spec).map((e) => e.cyl);
      const gaps = firingIntervals(spec);
      const k0 = order.indexOf(fires[0].cyl);
      expect(fires.length).toBeGreaterThan(2 * order.length);
      for (let j = 1; j < fires.length; j++) {
        const k = (k0 + j - 1) % order.length;
        expect(fires[j].cyl).toBe(order[(k + 1) % order.length]);
        expect(fires[j].t - fires[j - 1].t).toBeCloseTo(gaps[k] * samplesPerDeg(rpm), 3);
      }
      // per bank too: this unevenness is what a per-bank collector hears
      for (const bank of [0, 1].filter((b) => bankCylinders(spec, b).length)) {
        const cyls = bankCylinders(spec, bank);
        const bankFires = fires.filter((e) => cyls.includes(e.cyl));
        const bankGaps = firingIntervals(spec, cyls);
        const first = firingEvents(spec)
          .filter((e) => cyls.includes(e.cyl))
          .findIndex((e) => e.cyl === bankFires[0].cyl);
        for (let j = 1; j < bankFires.length; j++) {
          const gap = bankGaps[(first + j - 1) % bankGaps.length];
          expect(bankFires[j].t - bankFires[j - 1].t).toBeCloseTo(gap * samplesPerDeg(rpm), 3);
        }
      }
    },
  );

  test('the exhaust pulses in the signal are spaced like the firing intervals (odd-fire V6: 90°/150°)', () => {
    const rpm = 1200;
    const r = renderEngine(engineVoiceConfig(oddFireV6), {
      rpm,
      throttle: 0.6,
      seconds: 0.6,
      warmup: 0.3,
      jitter: 0,
    });
    const x = r.source;
    let max = 0;
    for (let i = r.start; i < x.length; i++) max = Math.max(max, x[i]);
    // onsets: rising through 30% of the peak, re-armed below 10% (not armed mid-pulse at the start)
    const onsets: number[] = [];
    let armed = false;
    for (let i = r.start; i < x.length; i++) {
      if (armed && x[i] > 0.3 * max) {
        onsets.push(i);
        armed = false;
      } else if (x[i] < 0.1 * max) armed = true;
    }
    const gaps = onsets.slice(1).map((t, i) => (t - onsets[i]) / samplesPerDeg(rpm));
    expect(gaps.length).toBeGreaterThan(8);
    for (const g of gaps) {
      const want = Math.abs(g - 90) < Math.abs(g - 150) ? 90 : 150;
      expect(Math.abs(g - want)).toBeLessThan(3);
    }
    // and they alternate, as the crank dictates
    for (let i = 1; i < gaps.length; i++)
      expect(Math.abs(gaps[i] - gaps[i - 1])).toBeGreaterThan(40);
  });
});

describe('pitch', () => {
  // Across the rev range the firing note, rpm/60 × cylinders/2 (× rotors for a rotary), sets
  // the comb: the strongest line is the firing line or one of its first harmonics. Recordings
  // put a low firing line (below ~100 Hz) under its harmonics (test/real.ts: a Scirocco R's 2nd
  // harmonic +21 dB, a Cayman S's +17 dB), so the firing line itself need not lead; and a pipe
  // resonance may push a sub-firing line up at the odd rpm, so we ask for most points.
  const fractions = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  test.each(listEngines().map((e) => [e.id, e] as const))(
    '%s: the strongest line is a firing harmonic',
    (_id, spec) => {
      const cfg = engineVoiceConfig(spec);
      const F = firingOrder(spec);
      const ks = Array.from({ length: 6 * F }, (_, i) => (i + 1) / 2);
      let wins = 0;
      let firingNear = 0;
      for (const frac of fractions) {
        const rpm = frac * spec.redlineRpm;
        const r = renderEngine(cfg, { rpm, throttle: 0.6, seconds: 0.5, warmup: 0.4 });
        const amps = ks.map((k) => order(r.mono, k, rpm, r.start));
        const top = Math.max(...amps);
        const k = ks[amps.indexOf(top)];
        // with dual exhausts each bank's own comb is heard too (a bank fires F / banks times a
        // revolution)
        const step = cfg.crossover ? F : F / cfg.groupCount;
        if (k % step === 0 && k <= 3 * F) wins++;
        // and the firing line is never lost: within 25 dB of the loudest line (a real Scirocco
        // R's sits 21 dB under its 2nd harmonic, test/real.ts)
        if (amps[ks.indexOf(F)] > 10 ** -1.25 * top) firingNear++;
      }
      expect(wins).toBeGreaterThanOrEqual(5);
      // (one point may sit in a pipe's notch)
      expect(firingNear).toBeGreaterThanOrEqual(fractions.length - 1);
    },
    30000,
  );
});

describe('safety', () => {
  test.each(listEngines().map((e) => [e.id, e] as const))(
    '%s: output stays finite and under the limiter ceiling, whatever the input does',
    (_id, spec) => {
      const k = new EngineKernel(engineVoiceConfig(spec), FS, { addons: ALL_ON, seed: 7 });
      // slam the throttle, bounce off the limiter, lift, stall, restart, jump around
      const r = renderVoice(k, 2, 3, (t) => {
        const s = (t * 4) % 4;
        if (s < 1) return { rpm: spec.redlineRpm * 1.2, throttle: 1 };
        if (s < 2) return { rpm: spec.redlineRpm * (2 - s), throttle: 0 };
        if (s < 2.2) return { rpm: 0, throttle: 0 };
        return {
          rpm: (Math.sin(t * 37) * 0.5 + 0.5) * spec.redlineRpm,
          throttle: (Math.sin(t * 11) + 1) / 2,
        };
      });
      let peak = 0;
      for (let i = 0; i < r.L.length; i++) {
        expect(Number.isFinite(r.L[i]) && Number.isFinite(r.R[i])).toBe(true);
        peak = Math.max(peak, Math.abs(r.L[i]), Math.abs(r.R[i]));
      }
      expect(peak).toBeLessThanOrEqual(0.9 + 1e-6);
      expect(peak).toBeGreaterThan(0.05);
    },
  );

  test('deterministic for a seed, different for another', () => {
    const cfg = engineVoiceConfig(getEngine('flat4'));
    const run = (seed: number) =>
      renderEngine(cfg, {
        rpm: 4200,
        throttle: 0.7,
        seconds: 0.3,
        warmup: 0.1,
        seed,
        addons: ALL_ON,
      }).L;
    const a = run(3);
    const b = run(3);
    const c = run(4);
    expect(a).toEqual(b);
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff = Math.max(diff, Math.abs(a[i] - c[i]));
    expect(diff).toBeGreaterThan(1e-3);
  });
});

describe('rev limiter', () => {
  test('pinned at the redline under throttle, the ECU cuts some combustion events', () => {
    const spec = getEngine('v8-flat');
    const r = renderEngine(engineVoiceConfig(spec), {
      rpm: spec.redlineRpm,
      throttle: 1,
      seconds: 1,
      warmup: 0.2,
    });
    const fire = r.events.filter((e) => e.kind === 'fire').length;
    const cut = r.events.filter((e) => e.kind === 'cut').length;
    expect(cut / (fire + cut)).toBeGreaterThan(0.3);
    expect(cut / (fire + cut)).toBeLessThan(0.7);
  });

  test('below the redline nothing is cut', () => {
    const spec = getEngine('v8-flat');
    const r = renderEngine(engineVoiceConfig(spec), {
      rpm: spec.redlineRpm * 0.9,
      throttle: 1,
      seconds: 0.5,
    });
    expect(r.events.filter((e) => e.kind === 'cut')).toHaveLength(0);
  });
});

test('a NaN from upstream is ignored rather than poisoning the pipes', () => {
  const k = new EngineKernel(engineVoiceConfig(getEngine('i6')), FS, { seed: 2 });
  const r = renderVoice(k, 1, 1, (t) =>
    t > 0.3 && t < 0.4 ? { rpm: NaN, throttle: NaN } : { rpm: 3000, throttle: 0.5 },
  );
  expect(r.L.every(Number.isFinite)).toBe(true);
  expect(rms(r.L, Math.round(0.6 * FS))).toBeGreaterThan(0.01);
});
