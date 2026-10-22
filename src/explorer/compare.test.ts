import { describe, expect, it } from 'vitest';
import { listVehicles } from '../spec/catalog';
import { mm } from '../spec/units';
import { axleShift, compareColors, sideOffsets, SIDE_GAP, vsCars } from './compare';
import { colorSlots, EXTRA_COLORS, GHOST_COLORS, slotColor } from './drive/colors';
import { familyOf } from './drive/state';

const all = listVehicles();

describe('comparing cars in the car view', () => {
  it('levels the front axles (each car is drawn centred on its wheelbase)', () => {
    for (const main of all.slice(0, 5))
      for (const o of all.slice(5, 10)) {
        const front = (v: typeof main, shift: number) => mm(v.dims.wheelbaseMm) / 2 + shift;
        expect(front(o, axleShift(main, o))).toBeCloseTo(front(main, 0), 9);
      }
  });

  it('parks compared cars side by side to the left, a gap apart', () => {
    const [main, ...others] = all.slice(0, 4);
    const zs = sideOffsets(main, others);
    let edge = -mm(main.dims.widthMm) / 2;
    others.forEach((o, i) => {
      const w = mm(o.dims.widthMm);
      expect(edge - (zs[i] + w / 2)).toBeCloseTo(SIDE_GAP, 9);
      edge = zs[i] - w / 2;
    });
  });

  it('skips unknown ids', () => {
    expect(vsCars([all[0].id, 'no-such-car']).map((v) => v.id)).toEqual([all[0].id]);
    expect(vsCars(undefined)).toEqual([]);
  });
});

describe('comparison colours', () => {
  it('a car wears its layout family colour; a second of a family takes an extra one', () => {
    expect(colorSlots(['MR', 'FF', 'MR', 'MR', 'FR'])).toEqual([0, 0, 1, 2, 0]);
    expect(slotColor('MR', 0, 'dark')).toBe(GHOST_COLORS.dark.MR);
    expect(slotColor('MR', 1, 'light')).toBe(EXTRA_COLORS.light[0]);
  });

  it('every colour in a comparison is distinct', () => {
    for (const theme of ['dark', 'light'] as const) {
      const mr = all.filter((v) => familyOf(v) === 'MR').slice(0, 3);
      const colors = compareColors(mr, theme);
      expect(new Set(colors).size).toBe(colors.length);
    }
  });
});

describe('comparison views', () => {
  it('the side view shows an overlay, and leaving it brings side by side back', async () => {
    const { pickMode, pickView, useCompare } = await import('./compare');
    useCompare.setState({ mode: 'side', view: '3q', before: null });
    pickView('side');
    expect(useCompare.getState()).toMatchObject({ view: 'side', mode: 'overlay' });
    pickView('top');
    expect(useCompare.getState()).toMatchObject({ view: 'top', mode: 'side' });
    // chosen as an overlay, it stays one
    pickMode('overlay');
    pickView('side');
    pickView('3q');
    expect(useCompare.getState()).toMatchObject({ view: '3q', mode: 'overlay' });
    // parking side by side from the side view looks from three quarters
    pickView('side');
    pickMode('side');
    expect(useCompare.getState()).toMatchObject({ view: '3q', mode: 'side' });
  });
});
