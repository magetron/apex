/** The part of the 3D view the HUD panels leave free, for the cameras to frame into. */

/** The HUD panels over the scene (the top-left breadcrumb is text, which may overlap the car). */
const HUD =
  '.apx-topbar, .apx-dock--top-right > *, .apx-slot-left > *, .apx-slot-center > *, .apx-slot-right > *, .apx-drive-touch > *';

/**
 * The largest rectangle of the canvas no HUD panel covers, for something `aspect` wide per unit
 * high, in normalized device coordinates [x0, y0, x1, y1]. None when the HUD leaves no good room
 * (less than `minShare` of what the whole view would give), as on a phone.
 */
export function freeWindow(
  canvas: HTMLElement,
  aspect: number,
  minShare = 0.4,
): [number, number, number, number] | undefined {
  const c = canvas.getBoundingClientRect();
  const boxes = [...document.querySelectorAll(HUD)]
    .map((e) => e.getBoundingClientRect())
    .filter((b) => b.width > 0 && b.height > 0);
  const edges = (lo: number, hi: number, of: (b: DOMRect) => number[]) =>
    [lo, hi, ...boxes.flatMap(of)].filter((v) => v >= lo && v <= hi).sort((a, b) => a - b);
  const xs = edges(c.left, c.right, (b) => [b.left, b.right]);
  const ys = edges(c.top, c.bottom, (b) => [b.top, b.bottom]);
  let best = 0;
  let win: [number, number, number, number] | undefined;
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++)
      for (let k = 0; k < ys.length; k++)
        for (let l = k + 1; l < ys.length; l++) {
          const [L, R, T, B] = [xs[i], xs[j], ys[k], ys[l]];
          const fit = Math.min((R - L) / aspect, B - T);
          if (fit <= best) continue;
          const hit = boxes.some(
            (b) =>
              Math.min(R, b.right) - Math.max(L, b.left) > 1 &&
              Math.min(B, b.bottom) - Math.max(T, b.top) > 1,
          );
          if (hit) continue;
          best = fit;
          win = [
            ((L - c.left) / c.width) * 2 - 1,
            ((c.bottom - B) / c.height) * 2 - 1,
            ((R - c.left) / c.width) * 2 - 1,
            ((c.bottom - T) / c.height) * 2 - 1,
          ];
        }
  return best > minShare * Math.min(c.width / aspect, c.height) ? win : undefined;
}
