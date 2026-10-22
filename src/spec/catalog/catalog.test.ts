import { describe, expect, it } from 'vitest';
import { getEngine, getMotor, listEngines, listMotors, listVehicles } from './index';

describe('catalog integrity', () => {
  it('has the launch line-up', () => {
    const ids = listEngines().map((e) => e.id);
    for (const id of [
      'i3',
      'i4',
      'i5',
      'i6',
      'flat4',
      'flat6',
      'v6-60',
      'vr6',
      'v8-cross',
      'v8-flat',
      'v10',
      'v12',
      'w12',
      'w16',
    ])
      expect(ids).toContain(id);
    expect(listMotors().length).toBeGreaterThan(0);
  });

  it.each(listEngines().map((e) => [e.id, e] as const))('engine %s is well-formed', (_id, e) => {
    const n = e.cylinders.length;
    expect([...e.firingOrder].sort((a, b) => a - b)).toEqual(
      Array.from({ length: n }, (_, i) => i + 1),
    );
    e.cylinders.forEach((c, i) => expect(c.num).toBe(i + 1));
    expect(e.rodMm).toBeGreaterThan(1.3 * e.strokeMm);
    expect(e.borePitchMm).toBeGreaterThan(
      e.family === 'vr' || e.family === 'w' ? 0.6 * e.boreMm : e.boreMm,
    );
    expect(e.redlineRpm).toBeGreaterThan(e.idleRpm);
    // 300 cc floor: the 1957 Fiat 500's air-cooled twin is 479 cc
    expect(e.displacementCc).toBeGreaterThan(300);
    expect(e.examples.length).toBeGreaterThan(0);
    expect(e.source).toBeTruthy();
  });

  it.each(listVehicles().map((v) => [v.id, v] as const))(
    'vehicle %s references real parts',
    (_id, v) => {
      const pt = v.powertrain;
      if (pt.kind === 'ice') expect(() => getEngine(pt.engine)).not.toThrow();
      else for (const m of pt.motors) expect(() => getMotor(m.motor)).not.toThrow();
      const d = v.dims;
      expect(d.lengthMm).toBeGreaterThan(d.wheelbaseMm + d.overhangFMm);
      expect(v.published.source).toBeTruthy();
    },
  );
});
