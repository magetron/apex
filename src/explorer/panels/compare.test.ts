import { describe, expect, it } from 'vitest';
import { listVehicles } from '../../spec/catalog';
import { carFacts, compareRows } from './carFacts';

const all = listVehicles().map(carFacts);

describe('the comparison table', () => {
  it('one value per car and one signed difference per compared car, in every row', () => {
    const [main, ...others] = all.slice(0, 4);
    const rows = compareRows(main, others);
    // the layout rows first, then the rest (folded away)
    expect(rows.map((r) => r.key)).toEqual([
      'layout',
      'front',
      'cg',
      'wheelbase',
      'length',
      'unit',
      'kw',
      'kg',
      'kwPerT',
    ]);
    expect(rows.filter((r) => !r.more).map((r) => r.key)).toEqual([
      'layout',
      'front',
      'cg',
      'wheelbase',
      'length',
    ]);
    for (const r of rows) {
      expect(r.values).toHaveLength(4);
      expect(r.deltas).toHaveLength(3);
    }
    expect(rows[0].values).toEqual([main, ...others].map((f) => f.code));
  });

  it('differences are the compared car minus the main one, from the spec', () => {
    const [main, other] = all;
    const rows = Object.fromEntries(compareRows(main, [other]).map((r) => [r.key, r]));
    const wb = other.wheelbaseMm - main.wheelbaseMm;
    expect(rows.wheelbase.deltas[0]?.sign).toBe(Math.sign(wb));
    expect(rows.wheelbase.values).toEqual([`${main.wheelbaseMm}`, `${other.wheelbaseMm}`]);
    expect(rows.layout.deltas).toEqual([null]);
    expect(rows.front.deltas[0]?.text).toMatch(/^(=|[+−]\d+\.\d pt)$/);
  });

  it('every car has a CG height and a wheelbase', () => {
    for (const f of all) {
      expect(f.cgMm).toBeGreaterThan(200);
      expect(f.wheelbaseMm).toBe(f.v.dims.wheelbaseMm);
    }
  });
});
