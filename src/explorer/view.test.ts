import { describe, expect, it } from 'vitest';
import { listVehicles } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive/layout';
import {
  cleanVs,
  isSeeThrough,
  MAX_VS,
  parseView,
  viewPath,
  withSeeThrough,
  withVehicle,
  zoomOut,
  type View,
} from './view';

const all = listVehicles();
const ice = all.filter((v) => v.powertrain.kind === 'ice');
const ev = all.find((v) => v.powertrain.kind === 'ev')!;
const [a, b, c, d, e] = ice;

describe('view URLs', () => {
  it('round-trips every level, with and without cars to compare', () => {
    const views: View[] = [
      { vehicleId: a.id, level: 'car' },
      { vehicleId: a.id, level: 'internals' },
      { vehicleId: a.id, level: 'drive' },
      { vehicleId: a.id, level: 'part', part: 'engine' },
      { vehicleId: a.id, level: 'part', part: 'engine', detail: 'balance' },
      { vehicleId: a.id, level: 'car', vs: [b.id] },
      { vehicleId: a.id, level: 'internals', vs: [b.id, c.id] },
      { vehicleId: a.id, level: 'drive', vs: [b.id] },
      { vehicleId: a.id, level: 'part', part: 'engine', vs: [b.id] },
    ];
    for (const v of views) expect(parseView(viewPath(v))).toEqual(v);
    expect(viewPath({ vehicleId: a.id, level: 'internals', vs: [b.id, c.id] })).toBe(
      `/${a.id}/internals?vs=${b.id},${c.id}`,
    );
  });

  it('keeps old links working', () => {
    expect(parseView(`/${a.id}/internals`)).toEqual({ vehicleId: a.id, level: 'internals' });
    expect(parseView(`/${a.id}`)).toEqual({ vehicleId: a.id, level: 'car' });
  });

  it('drops unknown, repeated and own ids from the comparison, and caps it', () => {
    expect(parseView(`/${a.id}?vs=nope,${b.id},${b.id},${a.id}`).vs).toEqual([b.id]);
    expect(parseView(`/${a.id}?vs=`).vs).toBeUndefined();
    expect(cleanVs([b.id, c.id, d.id, e.id], a.id)).toHaveLength(MAX_VS);
  });
});

describe('see-through', () => {
  it('is a switch on the car view: on, off, and off from a part backs out', () => {
    const car: View = { vehicleId: a.id, level: 'car', vs: [b.id] };
    const on = withSeeThrough(car, true);
    expect(on).toEqual({ vehicleId: a.id, level: 'internals', vs: [b.id] });
    expect(isSeeThrough(on)).toBe(true);
    expect(withSeeThrough(on, false)).toEqual(car);
    const part: View = { vehicleId: a.id, level: 'part', part: 'engine' };
    expect(isSeeThrough(part)).toBe(true);
    expect(withSeeThrough(part, false)).toEqual({ vehicleId: a.id, level: 'car' });
  });

  it('zooms out step by step, keeping the comparison', () => {
    const part: View = { vehicleId: a.id, level: 'part', part: 'engine', detail: 'x', vs: [b.id] };
    expect(zoomOut(part)).toEqual({ ...part, detail: undefined });
    expect(zoomOut({ ...part, detail: undefined })).toEqual({
      vehicleId: a.id,
      level: 'internals',
      vs: [b.id],
    });
    expect(zoomOut({ vehicleId: a.id, level: 'drive', vs: [b.id] })).toEqual({
      vehicleId: a.id,
      level: 'car',
      vs: [b.id],
    });
    expect(zoomOut({ vehicleId: a.id, level: 'car' })).toBeNull();
  });
});

describe('swapping cars keeps the mode', () => {
  it('see-through, drive and a part the new car has stay', () => {
    expect(withVehicle({ vehicleId: a.id, level: 'internals' }, b.id)).toEqual({
      vehicleId: b.id,
      level: 'internals',
    });
    expect(withVehicle({ vehicleId: a.id, level: 'drive' }, b.id).level).toBe('drive');
    expect(withVehicle({ vehicleId: a.id, level: 'part', part: 'engine' }, b.id)).toEqual({
      vehicleId: b.id,
      level: 'part',
      part: 'engine',
    });
  });

  it('a part the new car lacks: its motor for an engine, else the see-through car', () => {
    const toEv = withVehicle({ vehicleId: a.id, level: 'part', part: 'engine' }, ev.id);
    expect(toEv.level).toBe('part');
    expect(toEv.part).toMatch(/^motor/);
    const evOnly = layoutPowertrain(ev).parts.map((p) => p.id);
    const gearbox = layoutPowertrain(a).parts.find(
      (p) => p.id !== 'engine' && !evOnly.includes(p.id),
    )!;
    expect(withVehicle({ vehicleId: a.id, level: 'part', part: gearbox.id }, ev.id)).toEqual({
      vehicleId: ev.id,
      level: 'internals',
    });
  });

  it('a compared car trades places with the main one', () => {
    expect(withVehicle({ vehicleId: a.id, level: 'car', vs: [b.id, c.id] }, b.id)).toEqual({
      vehicleId: b.id,
      level: 'car',
      vs: [a.id, c.id],
    });
    // a car from outside the comparison replaces the main one only
    expect(withVehicle({ vehicleId: a.id, level: 'car', vs: [b.id] }, c.id).vs).toEqual([b.id]);
  });
});
