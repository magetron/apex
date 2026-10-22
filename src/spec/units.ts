import type { Vec3 } from './types';

export const DEG = Math.PI / 180;

/** spec millimetres → scene metres */
export const mm = (v: number) => v / 1000;
export const mmVec = (v: Vec3): Vec3 => [v[0] / 1000, v[1] / 1000, v[2] / 1000];

/** positive modulo: mod(-90, 360) === 270 */
export const mod = (a: number, n: number) => ((a % n) + n) % n;

/** signed smallest difference a - b on a circle of size n, in (-n/2, n/2] */
export const angleDiff = (a: number, b: number, n = 360) => {
  const d = mod(a - b, n);
  return d > n / 2 ? d - n : d;
};
