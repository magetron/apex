import { describe, expect, it } from 'vitest';
import { HOLD_S, SteadyGate } from './steady';

const DT = 1 / 60;

function run(g: SteadyGate, seconds: number, rpm: (t: number) => number, throttle = 0.3) {
  let on = true;
  for (let t = 0; t < seconds; t += DT) on = g.step(DT, rpm(t), throttle);
  return on;
}

describe('a held note fades, a change brings it back', () => {
  it('sounds at first, then falls silent once the revs hold', () => {
    const g = new SteadyGate();
    expect(g.step(DT, 4000, 0.3)).toBe(true);
    expect(run(g, HOLD_S * 0.5, () => 4000)).toBe(true);
    expect(run(g, HOLD_S, () => 4000)).toBe(false);
  });

  it('comes back the moment the revs or the throttle move', () => {
    const g = new SteadyGate();
    run(g, HOLD_S * 2, () => 4000);
    expect(g.step(DT, 3500, 0.3)).toBe(true);
    run(g, HOLD_S * 2, () => 3500);
    expect(g.step(DT, 3500, 0)).toBe(true);
  });

  it('keeps sounding while the revs climb, even slowly', () => {
    const g = new SteadyGate();
    // 3% a second: a long pull up a straight
    expect(run(g, 6, (t) => 4000 * (1 + 0.03 * t))).toBe(true);
  });

  it('ignores the flutter of a steady engine', () => {
    const g = new SteadyGate();
    expect(run(g, HOLD_S * 2, (t) => 4000 + 20 * Math.sin(t * 40))).toBe(false);
  });

  it('wakes on a visitor action', () => {
    const g = new SteadyGate();
    run(g, HOLD_S * 2, () => 900);
    g.wake();
    expect(g.step(DT, 900, 0)).toBe(true);
  });
});
