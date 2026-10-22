import { describe, expect, it } from 'vitest';
import { getVehicle, listVehicles } from '../catalog';
import { layoutPowertrain, massProps } from './index';

describe('massProps', () => {
  it.each(listVehicles().map((v) => [v.id, v] as const))(
    '%s: derived front weight within ±3 pts of published',
    (_id, v) => {
      expect(v.bodyCgFrac).toBeGreaterThanOrEqual(0.4);
      expect(v.bodyCgFrac).toBeLessThanOrEqual(0.6);
      const m = massProps(v);
      expect(m.totalKg).toBeCloseTo(v.published.curbKg, 6);
      expect(Math.abs(m.frontPct - v.published.frontPct)).toBeLessThanOrEqual(3);
      expect(m.cgMm[1]).toBeGreaterThan(300);
      // tall SUVs and ladder-frame off-roaders legitimately sit higher
      expect(m.cgMm[1]).toBeLessThan(
        v.archetype === 'offroader' || v.archetype === 'suv' ? 850 : 650,
      );
    },
  );

  it('layout order of front weight: FF > FR > MR > RR', () => {
    const f = (id: string) => massProps(getVehicle(id)).frontPct;
    expect(f('vw-golf-gti-mk8')).toBeGreaterThan(f('bmw-m340i-g20'));
    expect(f('bmw-m340i-g20')).toBeGreaterThan(f('audi-r8-v10-gen2'));
    expect(f('audi-r8-v10-gen2')).toBeGreaterThan(f('porsche-911-992'));
  });

  it('mid-engine has the lowest yaw inertia per kg of the sports cars', () => {
    const k2 = (id: string) => {
      const m = massProps(getVehicle(id));
      return m.izzKgM2 / m.totalKg;
    };
    expect(k2('audi-r8-v10-gen2')).toBeLessThan(k2('porsche-911-992'));
    expect(k2('audi-r8-v10-gen2')).toBeLessThan(k2('bmw-m340i-g20'));
  });
});

describe('layoutPowertrain', () => {
  const part = (vid: string, pid: string) => {
    const p = layoutPowertrain(getVehicle(vid)).parts.find((x) => x.id === pid);
    if (!p) throw new Error(`${vid} has no ${pid}`);
    return p;
  };

  it('driven wheels follow the drivetrain', () => {
    const driven = (id: string) =>
      layoutPowertrain(getVehicle(id))
        .parts.filter((p) => p.kind === 'wheel' && p.driven)
        .map((p) => p.axle);
    expect(new Set(driven('vw-golf-gti-mk8'))).toEqual(new Set(['front']));
    expect(new Set(driven('bmw-m340i-g20'))).toEqual(new Set(['rear']));
    expect(new Set(driven('audi-r8-v10-gen2'))).toEqual(new Set(['front', 'rear']));
    expect(new Set(driven('tesla-model3-awd'))).toEqual(new Set(['front', 'rear']));
  });

  it('911: engine hangs behind the rear axle, gearbox ahead of it', () => {
    const v = getVehicle('porsche-911-992');
    expect(part('porsche-911-992', 'engine').posMm[0]).toBeLessThan(-v.dims.wheelbaseMm);
    expect(part('porsche-911-992', 'gearbox').posMm[0]).toBeGreaterThan(
      part('porsche-911-992', 'engine').posMm[0],
    );
    expect(part('porsche-911-992', 'engine').yawDeg).toBe(180);
  });

  it('mid-engine: engine between the axles, gearbox behind it', () => {
    const v = getVehicle('audi-r8-v10-gen2');
    const e = part('audi-r8-v10-gen2', 'engine');
    expect(e.posMm[0]).toBeLessThan(0);
    expect(e.posMm[0]).toBeGreaterThan(-v.dims.wheelbaseMm);
    expect(part('audi-r8-v10-gen2', 'gearbox').posMm[0]).toBeLessThan(e.posMm[0]);
  });

  it('transverse FF: engine and gearbox sit side by side, straddling the centre line', () => {
    const e = part('vw-golf-gti-mk8', 'engine');
    const g = part('vw-golf-gti-mk8', 'gearbox');
    expect(e.yawDeg).toBe(-90);
    expect(e.posMm[2]).toBeGreaterThan(0);
    expect(g.posMm[2]).toBeLessThan(0);
  });

  it('FR has a prop shaft; FF does not', () => {
    const props = (id: string) =>
      layoutPowertrain(getVehicle(id)).shafts.filter((s) => s.kind === 'prop');
    expect(props('bmw-m340i-g20')).toHaveLength(1);
    expect(props('vw-golf-gti-mk8')).toHaveLength(0);
  });
});
