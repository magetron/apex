/** Turbo, blow-off, wastegate, anti-lag and overrun-burble add-ons, rendered offline. */
import { describe, expect, test } from 'vitest';
import { getEngine } from '../spec/catalog';
import { defaultAddons, engineVoiceConfig } from './config';
import { EngineKernel } from './dsp/engineKernel';
import { NO_ADDONS, type Addons } from './dsp/types';
import { RevDriver, revLimits } from './rev';
import { band, FS, power, renderVoice, rms, tone, type Schedule } from './test/harness';

const BLOCK = 128;
const kernel = (id: string, addons: Partial<Addons>) =>
  new EngineKernel(engineVoiceConfig(getEngine(id)), FS, {
    recordEvents: true,
    addons: { ...NO_ADDONS, ...addons },
  });

/** Strongest frequency (Hz) in [lo, hi] on a 5 Hz grid. */
function peakHz(x: Float32Array, start: number, end: number, lo: number, hi: number) {
  let best = 0;
  let at = lo;
  for (let f = lo; f <= hi; f += 5) {
    const a = tone(x, f, start, end);
    if (a > best) [best, at] = [a, f];
  }
  return at;
}

describe('turbo spool', () => {
  test('shaft speed lags a throttle step, and the whine pitch follows the shaft', () => {
    const k = kernel('i4', { spool: true });
    const L = new Float32Array(BLOCK);
    const R = new Float32Array(BLOCK);
    const turbo = new Float32Array(BLOCK);
    const shaft: number[] = [];
    const whine = new Float32Array(Math.round(FS * 3));
    for (let i = 0; i < whine.length; i += BLOCK) {
      const t = i / FS;
      k.render(L, R, BLOCK, 4500, t < 0.5 ? 0.05 : 1, { turbo });
      whine.set(turbo.subarray(0, Math.min(BLOCK, whine.length - i)), i);
      shaft.push(k.turboState()!.shaft);
    }
    const at = (t: number) => shaft[Math.floor((t * FS) / BLOCK)];
    // lag: still far from spooled 0.15 s after the step, nearly there after 2 s
    const s0 = at(0.49);
    const s1 = at(2.9);
    expect(at(0.65) - s0).toBeLessThan(0.5 * (s1 - s0));
    expect(at(2.5) - s0).toBeGreaterThan(0.9 * (s1 - s0));
    for (let i = Math.floor((0.5 * FS) / BLOCK); i < shaft.length - 1; i++)
      expect(shaft[i + 1]).toBeGreaterThanOrEqual(shaft[i] - 1e-9);
    // pitch ∝ shaft speed: maxShaftKrpm × shaft / 60 kHz
    const hz = (s: number) => (s * getEngine('i4').sound.turbo!.maxShaftKrpm * 1000) / 60;
    const late = peakHz(whine, Math.round(2.4 * FS), Math.round(2.9 * FS), 500, 5000);
    expect(Math.abs(late - hz(at(2.65))) / hz(at(2.65))).toBeLessThan(0.03);
  });

  test('a naturally aspirated engine has no turbo at all', () => {
    expect(kernel('v12', { spool: true }).turboState()).toBeNull();
  });
});

/** Full throttle long enough to build boost, then a sharp lift. */
const liftOff: Schedule = (t) => ({ rpm: 5000, throttle: t < 2 ? 1 : 0 });

describe('blow-off valve and surge flutter', () => {
  // the turbo sound in the 0.25 s before and after the lift at 2 s
  const dump = (id: string) => {
    const r = renderVoice(kernel(id, { bov: true }), 1, 3, liftOff);
    const bov = r.events.filter((e) => e.kind === 'bov');
    expect(bov).toHaveLength(1);
    expect(bov[0].t / FS).toBeGreaterThan(1.95);
    return {
      before: rms(r.turbo, Math.round(1.7 * FS), Math.round(1.95 * FS)),
      after: rms(r.turbo, Math.round(2.0 * FS), Math.round(2.25 * FS)),
    };
  };

  test('a rally car lifting off boost vents its BOV to the air ("pssh")', () => {
    const { before, after } = dump('flat4');
    expect(after).toBeGreaterThan(5 * before);
  });

  test("a road car's BOV recirculates: only a sigh", () => {
    expect(dump('i4').after).toBeLessThan(0.1 * dump('flat4').after);
  });

  test('without a BOV the compressor surges ("stu-tu-tu") — if the gate add-on is on', () => {
    const flutter = renderVoice(kernel('i4', { wastegate: true }), 1, 3, liftOff);
    expect(flutter.events.filter((e) => e.kind === 'flutter')).toHaveLength(1);
    const neither = renderVoice(kernel('i4', {}), 1, 3, liftOff);
    expect(neither.events.filter((e) => e.kind === 'bov' || e.kind === 'flutter')).toHaveLength(0);
  });

  test('no lift, no dump', () => {
    const r = renderVoice(kernel('i4', { bov: true, wastegate: true }), 1, 2, () => ({
      rpm: 5000,
      throttle: 1,
    }));
    expect(r.events.filter((e) => e.kind === 'bov' || e.kind === 'flutter')).toHaveLength(0);
  });
});

describe('wastegate chatter', () => {
  test('at full boost the open gate rattles with every exhaust pulse', () => {
    const steady = () => ({ rpm: 5500, throttle: 1 });
    const on = renderVoice(kernel('i4', { wastegate: true }), 1, 2, steady, 1);
    const off = renderVoice(kernel('i4', {}), 1, 2, steady, 1);
    expect(rms(on.turbo, on.start)).toBeGreaterThan(1.5 * rms(off.turbo, off.start));
  });
});

describe('anti-lag', () => {
  // off throttle at speed: retarded ignition keeps the turbo lit with bangs in the collector
  const offThrottle = () => ({ rpm: 4500, throttle: 0 });
  test('bangs off throttle when on, silence when off', () => {
    // (well under the output limiter, which would otherwise squash the bangs it is judging)
    const quiet = (addons: Partial<Addons>) => {
      const cfg = engineVoiceConfig(getEngine('flat4'));
      return new EngineKernel({ ...cfg, gain: cfg.gain * 1e-3 }, FS, {
        recordEvents: true,
        addons: { ...NO_ADDONS, ...addons },
      });
    };
    const on = renderVoice(quiet({ antiLag: true }), 1, 1.5, offThrottle, 0.3);
    const off = renderVoice(quiet({}), 1, 1.5, offThrottle, 0.3);
    expect(on.events.filter((e) => e.kind === 'bang').length).toBeGreaterThan(10);
    expect(off.events.filter((e) => e.kind === 'bang')).toHaveLength(0);
    // and they are loud
    expect(rms(on.mono, on.start)).toBeGreaterThan(2 * rms(off.mono, off.start));
  });

  test('it also keeps the shaft spinning off throttle', () => {
    const on = kernel('flat4', { antiLag: true });
    const off = kernel('flat4', {});
    renderVoice(on, 1, 2, offThrottle);
    renderVoice(off, 1, 2, offThrottle);
    expect(on.turboState()!.shaft).toBeGreaterThan(2 * off.turboState()!.shaft);
  });
});

describe('overrun crackle', () => {
  // hot exhaust from a hard pull, then a closed throttle as the revs fall
  const pullThenCoast: Schedule = (t) =>
    t < 1 ? { rpm: 3000 + 3000 * t, throttle: 1 } : { rpm: 6000 - 2000 * (t - 1), throttle: 0 };
  test('pops on the overrun with crackle on, none with it off', () => {
    const on = renderVoice(kernel('v8-cross', { crackle: true }), 2, 2.5, pullThenCoast);
    const off = renderVoice(kernel('v8-cross', {}), 2, 2.5, pullThenCoast);
    const pops = on.events.filter((e) => e.kind === 'crackle');
    expect(pops.length).toBeGreaterThan(5);
    expect(pops.every((e) => e.t / FS > 1)).toBe(true);
    expect(off.events.filter((e) => e.kind === 'crackle')).toHaveLength(0);
    // the fuel really was cut on the overrun
    expect(on.events.filter((e) => e.kind === 'cut' && e.t / FS > 1.2).length).toBeGreaterThan(20);
  });

  test('performance engines burble out of the box; ordinary ones only if asked', () => {
    for (const id of ['v8-cross', 'v8-flat', 'i6', 'flat4', 'v12', 'v10'])
      expect(defaultAddons(getEngine(id)).crackle, id).toBe(true);
    // a city car, a family TSI, a diesel pickup, a Rolls-Royce V12
    for (const id of ['i4-fire', 'i4-ea211', 'i4-1gd-ftv', 'v12-n74'])
      expect(defaultAddons(getEngine(id)).crackle, id).toBe(false);
  });

  /** Hold the gas pedal 1.5 s, let go, coast back to idle (the explorer's W / Space). */
  function liftOff(id: string, burble: boolean) {
    const spec = getEngine(id);
    const cfg = engineVoiceConfig(spec);
    const driver = new RevDriver(revLimits(spec));
    const input = { rpm: spec.idleRpm, throttle: 0 };
    let pressed = false;
    let released = false;
    // well under the limiter, so loudness compares straight
    const k = new EngineKernel({ ...cfg, gain: cfg.gain * 1e-3 }, FS, {
      seed: 3,
      recordEvents: true,
      addons: { ...defaultAddons(spec), crackle: burble },
    });
    const r = renderVoice(
      k,
      cfg.groupCount,
      4.5,
      (t) => {
        if (t >= 0 && !pressed) {
          driver.start('pedal', input);
          pressed = true;
        }
        if (t >= 1.5 && !released) {
          driver.release();
          released = true;
        }
        if (pressed) driver.step(BLOCK / FS, input);
        return { ...input };
      },
      0.3,
    );
    return { r, lift: r.start + 1.5 * FS };
  }

  test('letting go of the pedal: irregular low pops on the falling note, gone by idle', () => {
    const on = liftOff('v8-cross', true);
    const off = liftOff('v8-cross', false);
    const pops = on.r.events.filter((e) => e.kind === 'crackle' && e.t > on.lift);
    const within = (a: number, b: number) =>
      pops.filter((e) => e.t >= on.lift + a * FS && e.t < on.lift + b * FS).length;
    // strongest just after lift-off, fading with the revs, none once back at idle
    expect(within(0, 0.5)).toBeGreaterThan(5);
    expect(within(0, 0.5)).toBeGreaterThan(2 * within(1, 1.5));
    expect(within(2.5, 3)).toBe(0);
    // irregular, not a machine gun
    const gaps = pops.slice(1).map((e, i) => (e.t - pops[i].t) / FS);
    const short = gaps.filter((g) => g < 0.3);
    const mean = short.reduce((s, g) => s + g, 0) / short.length;
    const sd = Math.sqrt(short.reduce((s, g) => s + (g - mean) ** 2, 0) / short.length);
    expect(sd / mean).toBeGreaterThan(0.5);
    // low pops: they lift the 40–400 Hz band, hardly the 2–6 kHz one
    const a = on.lift + 0.1 * FS;
    const b = on.lift + 1.1 * FS;
    const gain = (lo: number, hi: number) =>
      10 * Math.log10(power(band(on.r.mono, lo, hi), a, b) / power(band(off.r.mono, lo, hi), a, b));
    expect(gain(40, 400)).toBeGreaterThan(6);
    expect(gain(40, 400)).toBeGreaterThan(gain(2000, 6000) + 4);
    // riding on the note: louder than a dead fuel cut, quieter than the pull before it
    const level = (x: Float32Array, from: number, to: number) => rms(x, from, to);
    const pull = level(on.r.mono, on.lift - 0.5 * FS, on.lift);
    expect(level(on.r.mono, a, on.lift + 0.6 * FS)).toBeLessThan(pull);
    expect(level(on.r.mono, a, on.lift + 0.6 * FS)).toBeGreaterThan(
      1.6 * level(off.r.mono, a, on.lift + 0.6 * FS),
    );
  });

  test('held on the limiter (BMW Z4 M40i): no blow-off, no overrun, only low pops', () => {
    const on = liftOff('i6', true);
    const off = liftOff('i6', false);
    // the limiter cuts fuel, not the throttle: the BOV sighs once, on the real lift-off
    const bov = on.r.events.filter((e) => e.kind === 'bov');
    expect(bov).toHaveLength(1);
    // (within the render block that carried the release)
    expect(bov[0].t).toBeGreaterThanOrEqual(on.lift - BLOCK);
    // bouncing off the limiter (the last 0.3 s before lift-off): the afterfire stays low
    const a = on.lift - 0.3 * FS;
    const gain = (lo: number, hi: number) =>
      10 *
      Math.log10(
        power(band(on.r.mono, lo, hi), a, on.lift) / power(band(off.r.mono, lo, hi), a, on.lift),
      );
    expect(gain(2000, 6000)).toBeLessThan(3);
  });

  test('an ordinary engine just goes quiet on the overrun', () => {
    const { r, lift } = liftOff('i4-fire', defaultAddons(getEngine('i4-fire')).crackle);
    expect(r.events.filter((e) => e.kind === 'crackle' && e.t > lift)).toHaveLength(0);
  });
});
