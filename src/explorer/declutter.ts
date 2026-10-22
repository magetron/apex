/**
 * Keeps the 3D part labels and the see-through data tags (CG, torque split, axle loads) from
 * piling up: a few times a second, any label that overlaps one already placed moves to the
 * nearest free spot (to either side first, then up: parts on one axis, like an engine's crank,
 * flywheel and intake, fan out instead of stacking into a column), and a part label repeating one
 * already shown hides. The data tags are placed first (a hovered part's name steps aside for the
 * CG, not the other way round) and never hide: two cars side by side both show their "100%
 * rear". The compared cars' name tags never move: the rest keep clear of them. The labels' own
 * positions (drei <Html>) stay untouched; this only nudges each label within its wrapper. It also makes each part label a button for its part: a click on "Flat-6
 * (boxer) twin-turbo" opens the engine, as a click on it does.
 */
import { useEffect } from 'react';
import { useScene } from '../scene/store';
import { partOfLabel } from './labelIds';

interface Box {
  el: HTMLElement;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  text: string;
  /** a data tag (a number pinned where it is measured): placed first, never hidden */
  tag?: boolean;
  /** never moves (a compared car's name tag): the others keep clear of it */
  pin?: boolean;
}

/** gap kept between labels (px) */
const GAP = 3;

type Rect = { x0: number; x1: number; y0: number; y1: number };

/** what is placed first: pinned boxes, then data tags, then part labels */
const rank = (b: { tag?: boolean; pin?: boolean }) => (b.pin ? 0 : b.tag ? 1 : 2);

const overlaps = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/**
 * Where each label goes: pinned boxes stay, then data tags, then part labels, each lowest first
 * (nearest its part), each to the free spot nearest where drei put it, sideways before upward; a
 * part label repeating another's text hides. Pure on rectangles (y grows downward), for the hook
 * and tests.
 */
export function declutter<T extends Omit<Box, 'el'>>(
  boxes: T[],
): { box: T; dx: number; dy: number; hidden: boolean }[] {
  const placed: Rect[] = [];
  const seen = new Set<string>();
  return [...boxes]
    .sort((a, b) => rank(a) - rank(b) || b.y1 - a.y1)
    .map((box) => {
      if (box.pin) {
        placed.push(box);
        return { box, dx: 0, dy: 0, hidden: false };
      }
      if (!box.tag && seen.has(box.text)) return { box, dx: 0, dy: 0, hidden: true };
      if (!box.tag) seen.add(box.text);
      const w = box.x1 - box.x0 + GAP;
      const h = box.y1 - box.y0 + GAP;
      // spots on a grid round the label, nearest first (a sideways step counts a little less
      // than a step up: a fan reads better than a column)
      const spots: [number, number][] = [];
      for (let j = 0; j <= 6; j++)
        for (const i of [0, 1, -1, 2, -2]) spots.push([i * w * 0.6, -j * h]);
      spots.sort(
        (a, b) =>
          Math.abs(a[0]) / w + Math.abs(a[1]) / h - (Math.abs(b[0]) / w + Math.abs(b[1]) / h),
      );
      const at = (dx: number, dy: number): Rect => ({
        x0: box.x0 + dx,
        x1: box.x1 + dx,
        y0: box.y0 + dy,
        y1: box.y1 + dy,
      });
      let [dx, dy] = spots.find(([x, y]) => !placed.some((p) => overlaps(at(x, y), p))) ?? [0, 0];
      // nowhere near is free: above everything it would touch, as a column
      if (placed.some((p) => overlaps(at(dx, dy), p))) {
        dx = 0;
        for (let k = 0; k < 12; k++) {
          const hit = placed.find((p) => overlaps(at(dx, dy), p));
          if (!hit) break;
          dy = hit.y0 - GAP - box.y1;
        }
      }
      placed.push(at(dx, dy));
      return { box, dx, dy, hidden: false };
    });
}

/** the overlays' data tags (vehicle3d/overlays/Tag) */
const TAG = 'veh-tag';
/** the compared cars' name tags (VehicleSlot) */
const PIN = 'apx-cmp-tags';

export function useLabelDeclutter() {
  useEffect(() => {
    const tick = () => {
      const boxes: Box[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(`.apx-label, .${TAG}, .${PIN}`)) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        // measured where drei put it, before this pass's own nudge
        const dx = Number(el.dataset.dx ?? 0);
        const dy = Number(el.dataset.dy ?? 0);
        boxes.push({
          el,
          x0: r.left - dx,
          x1: r.right - dx,
          y0: r.top - dy,
          y1: r.bottom - dy,
          text: el.textContent ?? '',
          tag: el.classList.contains(TAG),
          pin: el.classList.contains(PIN),
        });
      }
      for (const { box, dx, dy, hidden } of declutter(boxes)) {
        const el = box.el;
        if (box.pin) continue;
        if (!box.tag && !el.dataset.click) {
          el.dataset.click = '1';
          el.style.pointerEvents = 'auto';
          el.style.cursor = 'pointer';
          el.addEventListener('click', (e) => {
            const id = partOfLabel(el.textContent ?? '');
            if (!id) return;
            e.stopPropagation();
            useScene.getState().pick(id);
          });
        }
        if (Number(el.dataset.dx ?? 0) !== dx || Number(el.dataset.dy ?? 0) !== dy) {
          el.dataset.dx = String(dx);
          el.dataset.dy = String(dy);
          el.style.translate = dx || dy ? `${Math.round(dx)}px ${Math.round(dy)}px` : '';
        }
        const vis = hidden ? 'hidden' : '';
        if (el.style.visibility !== vis) el.style.visibility = vis;
      }
    };
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, []);
}
