import { offsetPoint, type Path, type PathPoint } from './path';

/** Cone pairs either side of `path` between arc lengths `from` and `to`, every `every` m. */
export function edgeCones(
  path: Path,
  from: number,
  to: number,
  every: number,
  halfWidth: number,
  out: number[] = [],
) {
  const tmp: PathPoint = { x: 0, n: 0, h: 0, k: 0 };
  for (let s = from; s <= to + 1e-6; s += every) {
    for (const side of [-1, 1]) out.push(...offsetPoint(path, s, side * halfWidth, tmp));
  }
  return out;
}
