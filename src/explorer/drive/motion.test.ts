import { describe, expect, it } from 'vitest';
import { ease, follow } from './motion';

/** A steady run of uneven frames (s): 120 Hz with dropped frames and the odd hitch. */
const UNEVEN = [1 / 120, 1 / 120, 1 / 60, 1 / 120, 0.03, 1 / 120, 1 / 60, 1 / 60, 1 / 120, 0.012];

describe('follow', () => {
  it('trails a steadily moving target by speed × tau, whatever the frames', () => {
    const v = 70;
    const tau = 0.15;
    for (const frames of [[1 / 60], [1 / 120], UNEVEN]) {
      let t = 0;
      let x = 0;
      let cur = 0;
      for (let i = 0; i < 400; i++) {
        const dt = frames[i % frames.length];
        const nx = x + v * dt;
        cur = follow(cur, x, nx, dt, tau);
        x = nx;
        t += dt;
        // the continuous follow from rest: lag = v·tau·(1 − e^(−t/tau)), at every frame
        expect(x - cur).toBeCloseTo(v * tau * (1 - Math.exp(-t / tau)), 9);
      }
      expect(x - cur).toBeCloseTo(v * tau, 6);
    }
  });

  it('eases onto a still target exponentially', () => {
    expect(follow(0, 10, 10, 0.1, 0.1)).toBeCloseTo(10 * (1 - Math.exp(-1)), 12);
    expect(follow(4, 10, 10, 0.05, 0.2)).toBeCloseTo(4 + 6 * ease(0.05, 0.2), 12);
  });

  it('keeps its lag through a step with no time (a jump moves it with the target)', () => {
    expect(follow(3, 5, 9, 0, 0.2)).toBe(7);
  });

  it('a lag that varied with the frame time is what the plain ease gives', () => {
    // the old way: x += (to − x)·(1 − e^(−dt/tau)), at 120 Hz and at 60 Hz, steady 70 m/s
    const lagAt = (dt: number) => {
      let x = 0;
      let cur = 0;
      for (let i = 0; i < 2000; i++) {
        x += 70 * dt;
        cur += (x - cur) * ease(dt, 0.15);
      }
      return x - cur;
    };
    // 0.29 m apart: a car jumping that far on screen whenever a frame is dropped
    expect(lagAt(1 / 120) - lagAt(1 / 60)).toBeGreaterThan(0.25);
  });
});
