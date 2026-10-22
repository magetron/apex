import { describe, expect, it } from 'vitest';
import { getVehicle, listVehicles } from '../../spec/catalog';
import {
  applyFilters,
  carFacts,
  deltas,
  facetCounts,
  facets,
  matchesQuery,
  sortCars,
  type Filters,
} from './carFacts';

const all = listVehicles().map(carFacts);
const fs = facets(all);

describe('carFacts', () => {
  it('derives finite numbers and traits for every catalog car', () => {
    for (const f of all) {
      expect(f.places.length, f.id).toBeGreaterThan(0);
      expect(f.kw, f.id).toBeGreaterThan(0);
      expect(f.kg, f.id).toBeGreaterThan(400);
      expect(f.frontPct, f.id).toBeGreaterThan(20);
      expect(f.frontPct, f.id).toBeLessThan(80);
      expect(Number.isFinite(f.kwPerT), f.id).toBe(true);
      expect(f.unit, f.id).not.toBe('');
      expect(f.cyl === null, f.id).toBe(f.source === 'EV');
    }
  });

  it('tells the layouts apart trait by trait', () => {
    const p911 = carFacts(getVehicle('porsche-911-992'));
    expect(p911).toMatchObject({ places: ['rear'], drive: 'RWD', source: 'ICE', cyl: 'Flat-6' });
    expect(p911.unit).toMatch(/^Flat-6 \d\.\d twin-turbo$/);
    expect(p911.model).toBe('Porsche 911 Carrera S Cabriolet');
    expect(p911.variant).toBe('992');

    const golf = carFacts(getVehicle('vw-golf-gti-mk8'));
    expect(golf).toMatchObject({ places: ['front'], drive: 'FWD', cyl: 'I4' });

    const tesla = carFacts(getVehicle('tesla-model3-awd'));
    expect(tesla).toMatchObject({ places: ['front', 'rear'], drive: 'AWD', source: 'EV' });
    expect(tesla.unit).toMatch(/^2 motors · \d+ kWh$/);
    expect(tesla.kg).toBeCloseTo(getVehicle('tesla-model3-awd').published.curbKg, 0);
  });

  it('caches per spec object', () => {
    const v = getVehicle('bmw-m340i-g20');
    expect(carFacts(v)).toBe(carFacts(v));
    expect(carFacts({ ...v })).not.toBe(carFacts(v));
  });
});

describe('facets', () => {
  it('offers only values some car has, in a stable order', () => {
    const cyl = fs.find((f) => f.id === 'cyl')!;
    expect(cyl.order.indexOf('I3')).toBeLessThan(cyl.order.indexOf('I4'));
    expect(cyl.order.indexOf('V8')).toBeLessThan(cyl.order.indexOf('V10'));
    if (cyl.order.includes('VR6'))
      expect(cyl.order.indexOf('V12')).toBeLessThan(cyl.order.indexOf('VR6'));
  });

  it('combines with AND across facets and OR within one', () => {
    const filters: Filters = { source: ['EV'], drive: ['RWD', 'FWD'] };
    const got = applyFilters(all, fs, filters, '');
    expect(got.length).toBeGreaterThan(0);
    for (const f of got) {
      expect(f.source).toBe('EV');
      expect(['RWD', 'FWD']).toContain(f.drive);
    }
    const want = all.filter((f) => f.source === 'EV' && f.drive !== 'AWD');
    expect(got.map((f) => f.id)).toEqual(want.map((f) => f.id));
  });

  it('a dual-motor EV counts as front and rear', () => {
    const got = applyFilters(all, fs, { place: ['front'], source: ['EV'] }, '');
    expect(got.map((f) => f.id)).toContain('tesla-model3-awd');
    expect(got.map((f) => f.id)).not.toContain('tesla-model3-rwd');
  });

  it('counts each chip as if it were added to the other facets', () => {
    const filters: Filters = { drive: ['AWD'], place: ['front'] };
    const counts = facetCounts(all, fs, filters, '');
    for (const facet of fs) {
      for (const value of facet.order) {
        const n = counts[facet.id].get(value) ?? 0;
        const expected = applyFilters(all, fs, { ...filters, [facet.id]: [value] }, '').length;
        expect(n, `${facet.id}:${value}`).toBe(expected);
      }
    }
  });

  it('searches names, engines and layouts word by word', () => {
    const p911 = carFacts(getVehicle('porsche-911-992'));
    expect(matchesQuery(p911, 'porsche flat-6')).toBe(true);
    expect(matchesQuery(p911, '  ')).toBe(true);
    expect(matchesQuery(p911, 'porsche v8')).toBe(false);
  });
});

describe('sorting and deltas', () => {
  it('sorts numbers big first by default and names A–Z', () => {
    const kw = sortCars(all, 'kw', -1);
    for (let i = 1; i < kw.length; i++) expect(kw[i - 1].kw).toBeGreaterThanOrEqual(kw[i].kw);
    const names = sortCars(all, 'name', 1).map((f) => f.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('signs deltas against the current car', () => {
    const a = carFacts(getVehicle('porsche-911-992'));
    const b = carFacts(getVehicle('porsche-718-boxster-t-982'));
    const d = deltas(b, a);
    expect(d.front.sign).toBe(Math.sign(b.frontPct - a.frontPct));
    expect(d.kg.text).toMatch(/^([+−]\d+|=)$/);
    expect(d.front.text).toMatch(/^([+−]\d+\.\d pt|=)$/);
    expect(deltas(a, a).kw).toEqual({ text: '=', sign: 0 });
  });
});
