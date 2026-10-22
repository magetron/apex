import { describe, expect, it } from 'vitest';
import { SEE_FADE_S, stepFade, type SeeFade } from './seeFade';

describe('the see-through crossfade', () => {
  it('eases to its target over SEE_FADE_S and stays there', () => {
    const f: SeeFade = { on: true, t: 0, k: 0 };
    const dt = 1 / 60;
    let frames = 0;
    while (f.t < 1 && frames < 1000) {
      const before = f.k;
      stepFade(f, dt);
      expect(f.k).toBeGreaterThanOrEqual(before);
      frames++;
    }
    expect(Math.abs(frames - SEE_FADE_S / dt)).toBeLessThanOrEqual(1);
    expect(f.k).toBe(1);
    stepFade(f, dt);
    expect(f.k).toBe(1);
  });

  it('turns back from wherever it is', () => {
    const f: SeeFade = { on: true, t: 0, k: 0 };
    stepFade(f, SEE_FADE_S / 2);
    expect(f.k).toBeCloseTo(0.5, 9);
    f.on = false;
    stepFade(f, SEE_FADE_S / 4);
    expect(f.t).toBeCloseTo(0.25, 9);
    expect(f.k).toBeLessThan(0.5);
    stepFade(f, SEE_FADE_S);
    expect(f.k).toBe(0);
  });
});
