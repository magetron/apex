import { describe, expect, it } from 'vitest';
import { getVehicle, listEngines, listVehicles } from '../spec/catalog';
import { envelope } from '../spec/derive/envelope';
import { massProps } from '../spec/derive/mass';
import { checkFit, withEngine } from './fit';

const golf = () => getVehicle('vw-golf-gti-mk8');

describe('bay fit check', () => {
  it.each(
    listVehicles()
      .filter((v) => v.powertrain.kind === 'ice')
      .map((v) => [v.id, v] as const),
  )('%s: its own engine fits its bay', (_id, v) => {
    const f = checkFit(v)!;
    expect(f.status).not.toBe('clash');
    expect(f.across.margin).toBeGreaterThanOrEqual(0);
    expect(f.along.margin).toBeGreaterThanOrEqual(0);
    expect(f.height.margin).toBeGreaterThanOrEqual(0);
  });

  it('transverse Golf bay: I4 fits, I5 is tight, I6 is too long, VR6 fits, V8 clashes', () => {
    expect(checkFit(golf(), 'i4')!.status).toBe('ok');
    expect(checkFit(golf(), 'i5')!.status).toBe('tight');
    const i6 = checkFit(golf(), 'i6')!;
    expect(i6.status).toBe('clash');
    expect(i6.across.status).toBe('clash');
    expect(checkFit(golf(), 'vr6')!.status).toBe('ok');
    const v8 = checkFit(golf(), 'v8-cross')!;
    expect(v8.status).toBe('clash');
    expect(v8.along.status).toBe('clash');
  });

  it('the same inline-6 is easy lengthwise in the BMW', () => {
    const f = checkFit(getVehicle('bmw-m340i-g20'), 'i6')!;
    expect(f.status).toBe('ok');
    // a longitudinal engine's length runs along the car, so its width is what limits it
    expect(f.across.need).toBeLessThan(f.along.need);
  });

  it('transverse: engine length + gearbox is what has to fit across the car', () => {
    const i4 = checkFit(golf(), 'i4')!;
    const i6 = checkFit(golf(), 'i6')!;
    const len = (id: string) => envelope(listEngines().find((e) => e.id === id)!).lengthMm;
    expect(i6.across.need - i4.across.need).toBeCloseTo(len('i6') - len('i4'), 6);
    expect(Math.abs(i4.along.need - i6.along.need)).toBeLessThan(2);
  });

  it('EVs have nothing to check', () => {
    expect(checkFit(getVehicle('tesla-model3-awd'))).toBeNull();
  });
});

describe('engine swap', () => {
  it('changes the engine and the kerb weight by the engine mass difference', () => {
    const g = golf();
    const s = withEngine(g, 'v8-cross');
    expect(s.powertrain.kind === 'ice' && s.powertrain.engine).toBe('v8-cross');
    expect(s.published.curbKg - g.published.curbKg).toBe(210 - 140);
    // heavier lump over the nose → more weight on the front axle
    expect(massProps(s).frontPct).toBeGreaterThan(massProps(g).frontPct);
  });

  it('is a no-op for EVs, the same engine, or no swap', () => {
    const t = getVehicle('tesla-model3-awd');
    expect(withEngine(t, 'i4')).toBe(t);
    expect(withEngine(golf(), 'i4')).toBe(golf());
    expect(withEngine(golf(), null)).toBe(golf());
  });

  it('every engine can be laid out in every ICE car', () => {
    for (const v of listVehicles().filter((x) => x.powertrain.kind === 'ice')) {
      for (const e of listEngines()) {
        const f = checkFit(v, e.id);
        expect(f).not.toBeNull();
        expect(Number.isFinite(f!.across.margin)).toBe(true);
      }
    }
  });
});
