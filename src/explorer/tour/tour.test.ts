import { describe, expect, it } from 'vitest';
import { findTour, listTours } from '../../content';
import type { TourScene } from '../../content/types';
import { parseView } from '../view';
import { normalPath, stepAngles, stepPath, stepView } from './scene';
import { parseTour, tourSearch } from './url';

describe('the tour in the URL', () => {
  it('reads a tour and its step (1-based), kept in range', () => {
    const t = listTours()[0];
    expect(parseTour(`?tour=${t.id}&step=2`)).toEqual({ id: t.id, step: 1 });
    expect(parseTour(`?tour=${t.id}`)).toEqual({ id: t.id, step: 0 });
    expect(parseTour(`?tour=${t.id}&step=99`)).toEqual({ id: t.id, step: t.steps.length - 1 });
    expect(parseTour(`?tour=${t.id}&step=0`)).toEqual({ id: t.id, step: 0 });
    expect(parseTour(`?tour=${t.id}&step=x`)).toEqual({ id: t.id, step: 0 });
  });

  it('ignores a tour that does not exist, and no tour at all', () => {
    expect(parseTour('?tour=no-such-tour&step=1')).toBeNull();
    expect(parseTour('')).toBeNull();
  });

  it('writes the tour beside any other parameter, and takes it out again', () => {
    expect(tourSearch('', { id: 'a-b', step: 2 })).toBe('?tour=a-b&step=3');
    expect(tourSearch('?x=1&tour=old&step=4', { id: 'a', step: 0 })).toBe('?x=1&tour=a&step=1');
    expect(tourSearch('?x=1&tour=old&step=4', null)).toBe('?x=1');
    expect(tourSearch('?tour=old&step=4', null)).toBe('');
  });
});

describe('a step as an explorer view', () => {
  const scene = (s: Partial<TourScene> & Pick<TourScene, 'view'>): TourScene => s;

  it('opens the balance view as the engine detail', () => {
    const s = scene({
      view: { vehicleId: 'bmw-m340i-g20', level: 'part', part: 'engine' },
      balance: true,
    });
    expect(stepView(s).detail).toBe('balance');
    expect(stepPath(s)).toBe('/bmw-m340i-g20/engine/balance');
  });

  it('puts drive’s car B in the URL’s vs, the first ghost only', () => {
    const s = scene({
      view: { vehicleId: 'porsche-911-992', level: 'drive' },
      drive: { scenario: 'lift-off', ghosts: ['bmw-m340i-g20', 'vw-golf-gti-mk8'] },
    });
    expect(stepPath(s)).toBe('/porsche-911-992/drive?vs=bmw-m340i-g20');
    // none: the question picks car B itself
    expect(stepPath({ ...s, drive: { scenario: 'catch' } })).toBe('/porsche-911-992/drive');
  });

  it('frames the car view from the usual angle unless it names one; a part opens as it opens', () => {
    const car = scene({ view: { vehicleId: 'porsche-911-992', level: 'internals' } });
    expect(stepAngles(car)).toEqual({ azimuth: expect.any(Number), polar: expect.any(Number) });
    expect(stepAngles({ ...car, camera: 'top' })?.polar).toBeLessThan(0.05);
    const part = scene({ view: { vehicleId: 'porsche-911-992', level: 'part', part: 'engine' } });
    expect(stepAngles(part)).toBeNull();
    expect(stepAngles({ ...part, camera: 'side' })).not.toBeNull();
    expect(stepAngles(scene({ view: { vehicleId: 'porsche-911-992', level: 'drive' } }))).toBe(
      null,
    );
  });

  it('opens every step at a path the explorer reads back as the same view', () => {
    for (const t of listTours())
      for (const s of t.steps) {
        const path = stepPath(s.scene);
        expect(normalPath(path), `${t.id} › ${s.id}`).toBe(path);
        const v = parseView(path);
        expect(v.vehicleId).toBe(s.scene.view.vehicleId);
        expect(v.level).toBe(s.scene.view.level);
        if (s.scene.view.part) expect(v.part).toBe(s.scene.view.part);
        if (s.scene.drive?.ghosts?.length) expect(v.vs).toEqual([s.scene.drive.ghosts[0]]);
      }
    expect(findTour('porsche-911-rr')).toBeTruthy();
  });
});
