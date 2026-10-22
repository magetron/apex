/**
 * Framing fits a car's outline into the part of the view the HUD leaves free: every corner of
 * its box lands inside that window, snugly, from the explorer's angles.
 */
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fitBox } from './CameraRig';

// L × H × W (m): a tall city car, a low roadster, a long saloon, an off-roader
const CARS: [string, number, number, number][] = [
  ['city', 3.55, 1.49, 1.63],
  ['roadster', 3.92, 1.24, 1.74],
  ['saloon', 5.18, 1.5, 1.92],
  ['offroader', 5.0, 1.97, 2.0],
];
const WINDOW = [-1, -0.61, 0.45, 0.84] as const;
const ASPECT = 1162 / 645;

function projected(box: Box3, az: number, polar: number, padding: number) {
  const { target, dist } = fitBox(box, az, polar, 35, ASPECT, { padding, window: WINDOW });
  const cam = new PerspectiveCamera(35, ASPECT, 0.1, 250);
  cam.position.set(
    target.x + dist * Math.sin(polar) * Math.sin(az),
    target.y + dist * Math.cos(polar),
    target.z + dist * Math.sin(polar) * Math.cos(az),
  );
  cam.lookAt(target);
  cam.updateMatrixWorld();
  const lo = new Vector3(Infinity, Infinity, 0);
  const hi = new Vector3(-Infinity, -Infinity, 0);
  for (let k = 0; k < 8; k++) {
    const p = new Vector3(
      k & 1 ? box.max.x : box.min.x,
      k & 2 ? box.max.y : box.min.y,
      k & 4 ? box.max.z : box.min.z,
    ).project(cam);
    lo.min(p);
    hi.max(p);
  }
  return { lo, hi };
}

describe('fitBox', () => {
  it.each(CARS)('%s: fills the free window from the car and inside angles', (_n, L, H, W) => {
    const box = new Box3(new Vector3(-L + 0.9, 0, -W / 2), new Vector3(0.9, H, W / 2));
    for (const [az, polar] of [
      [Math.PI * 0.3, Math.PI * 0.39],
      [Math.PI * 0.24, Math.PI * 0.3],
    ]) {
      const { lo, hi } = projected(box, az, polar, 0.1);
      const eps = 0.01;
      expect(lo.x).toBeGreaterThanOrEqual(WINDOW[0] - eps);
      expect(lo.y).toBeGreaterThanOrEqual(WINDOW[1] - eps);
      expect(hi.x).toBeLessThanOrEqual(WINDOW[2] + eps);
      expect(hi.y).toBeLessThanOrEqual(WINDOW[3] + eps);
      // snug: one axis spans the window less its padding
      const fill = Math.max(
        (hi.x - lo.x) / (WINDOW[2] - WINDOW[0]),
        (hi.y - lo.y) / (WINDOW[3] - WINDOW[1]),
      );
      expect(fill).toBeCloseTo(1 / 1.1, 1);
      // centred in the window
      expect((lo.x + hi.x) / 2).toBeCloseTo((WINDOW[0] + WINDOW[2]) / 2, 1);
      expect((lo.y + hi.y) / 2).toBeCloseTo((WINDOW[1] + WINDOW[3]) / 2, 1);
    }
  });
});
