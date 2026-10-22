import { describe, expect, it } from 'vitest';
import { ROAD_STEP_MAX, RoadSpin } from './spin';

describe('RoadSpin', () => {
  it('turns forward with the car, by its travel over the radius', () => {
    const s = new RoadSpin();
    s.update(0, 0, 0, 0.3);
    // 3 cm forward along +X
    expect(s.update(0.03, 0, 0, 0.3)).toBeCloseTo(0.1, 12);
    // heading 90° (facing −Z): forward is −Z
    const t = new RoadSpin();
    t.update(5, 5, Math.PI / 2, 0.3);
    expect(t.update(5, 4.97, Math.PI / 2, 0.3)).toBeCloseTo(0.1, 12);
  });

  it('never jerks backwards at speed, however long the frame', () => {
    const s = new RoadSpin();
    s.update(0, 0, 0, 0.33);
    let x = 0;
    let last = s.shown;
    // 83 m/s through 8 ms, 17 ms and 33 ms frames: a wheel turns 2, 4 and 8 rad in them
    for (const dt of [0.008, 0.017, 0.033, 0.008, 0.033]) {
      x += 83 * dt;
      const a = s.update(x, 0, 0, 0.33);
      const step = (a - last + 4 * Math.PI) % (2 * Math.PI);
      expect(step).toBeCloseTo(ROAD_STEP_MAX, 9);
      last = a;
    }
  });

  it('backwards when the car goes backwards; nothing on the first frame or after a reset', () => {
    const s = new RoadSpin();
    expect(s.update(10, 0, 0, 0.3)).toBe(0);
    expect(s.update(9.97, 0, 0, 0.3)).toBeCloseTo(-0.1, 12);
    s.reset();
    expect(s.shown).toBe(0);
    expect(s.update(50, 0, 0, 0.3)).toBe(0);
  });
});
