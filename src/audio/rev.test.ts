/** Throttle blip and rev sweep: they drive { rpm, throttle } and hand it back unchanged. */
import { describe, expect, test } from 'vitest';
import { getEngine, getMotor } from '../spec/catalog';
import { RevDriver, revLimits } from './rev';

function run(d: RevDriver, input: { rpm: number; throttle: number }, maxS = 10) {
  const trace: { rpm: number; throttle: number }[] = [];
  for (let t = 0; t < maxS; t += 1 / 60) {
    const going = d.step(1 / 60, input);
    trace.push({ ...input });
    if (!going) break;
  }
  return trace;
}

describe('RevDriver', () => {
  const v8 = getEngine('v8-flat');

  test('blip: a quick stab of throttle, then back to where it was', () => {
    const d = new RevDriver(revLimits(v8));
    const input = { rpm: 1500, throttle: 0.1 };
    d.start('blip', input);
    const trace = run(d, input);
    expect(Math.max(...trace.map((s) => s.rpm))).toBeGreaterThan(2500);
    expect(input).toEqual({ rpm: 1500, throttle: 0.1 });
    expect(d.manoeuvre).toBeNull();
    expect(trace.length / 60).toBeLessThan(3);
  });

  test('sweep: up to the limiter, bounce off the fuel cut, lift, back down', () => {
    const d = new RevDriver(revLimits(v8));
    const input = { rpm: v8.idleRpm, throttle: 0 };
    d.start('sweep', input);
    const trace = run(d, input);
    const top = Math.max(...trace.map((s) => s.rpm));
    expect(top).toBeGreaterThanOrEqual(v8.redlineRpm);
    expect(top).toBeLessThan(v8.redlineRpm * 1.02);
    // the limiter cuts drive several times while the pedal stays down (the fuel is cut, not
    // the throttle, so the voice hears no lift-off)
    const atTop = trace.filter((s) => s.rpm > v8.redlineRpm * 0.95);
    const cuts = atTop.filter(
      (s, i) => i > 1 && atTop[i - 1].rpm > s.rpm && atTop[i - 1].rpm >= atTop[i - 2].rpm,
    ).length;
    expect(cuts).toBeGreaterThanOrEqual(2);
    expect(atTop.slice(0, -10).every((s) => s.throttle === 1)).toBe(true);
    expect(input.rpm).toBe(v8.idleRpm);
  });

  test('pedal: revs climb while held, sit on the limiter, fall back on release', () => {
    const d = new RevDriver(revLimits(v8));
    const input = { rpm: v8.idleRpm, throttle: 0 };
    d.start('pedal', input);
    const held = run(d, input, 0.4);
    expect(held.at(-1)!.rpm).toBeGreaterThan(v8.idleRpm + 1000);
    expect(held.every((s) => s.throttle === 1)).toBe(true);
    // held long after it reached the limiter: still going, bouncing at the top
    const long = run(d, input, 6);
    expect(d.manoeuvre).toBe('pedal');
    expect(Math.min(...long.slice(-60).map((s) => s.rpm))).toBeGreaterThan(v8.redlineRpm * 0.9);
    d.release();
    const after = run(d, input);
    expect(after.every((s) => s.throttle === 0)).toBe(true);
    expect(d.manoeuvre).toBeNull();
    expect(input).toEqual({ rpm: v8.idleRpm, throttle: 0 });
  });

  test('a motor sweeps without a limiter bounce', () => {
    const m = getMotor('pmsm-rear');
    const d = new RevDriver(revLimits(m));
    const input = { rpm: 0, throttle: 0 };
    d.start('sweep', input);
    const trace = run(d, input, 30);
    const top = Math.max(...trace.map((s) => s.rpm));
    expect(top).toBeGreaterThan(0.85 * m.maxRpm);
    expect(top).toBeLessThanOrEqual(0.9 * m.maxRpm + 1e-6);
  });

  test('cancel restores the input', () => {
    const d = new RevDriver(revLimits(v8));
    const input = { rpm: 2000, throttle: 0.2 };
    d.start('sweep', input);
    for (let i = 0; i < 30; i++) d.step(1 / 60, input);
    d.cancel(input);
    expect(input).toEqual({ rpm: 2000, throttle: 0.2 });
  });
});
