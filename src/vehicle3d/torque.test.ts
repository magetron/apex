import { describe, expect, it } from 'vitest';
import { getVehicle, listVehicles } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive/layout';
import { torqueFlow } from './torque';

describe('torque flow', () => {
  it.each(listVehicles().map((v) => [v.id, v] as const))(
    '%s: all torque reaches exactly the driven wheels',
    (_id, v) => {
      const f = torqueFlow(v);
      const driven = layoutPowertrain(v)
        .parts.filter((p) => p.kind === 'wheel' && p.driven)
        .map((p) => p.id)
        .sort();
      expect(f.wheels.map((w) => w.id).sort()).toEqual(driven);
      expect(f.wheels.reduce((s, w) => s + w.share, 0)).toBeCloseTo(1, 9);
      expect(f.axles.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1, 9);
      for (const s of f.segs) {
        expect(s.share).toBeGreaterThan(0);
        expect(s.share).toBeLessThanOrEqual(1);
        expect(Number.isFinite(s.d0)).toBe(true);
      }
    },
  );

  it('FF: everything goes to the front axle, no split', () => {
    const f = torqueFlow(getVehicle('vw-golf-gti-mk8'));
    expect(f.axles).toEqual([expect.objectContaining({ axle: 'front', share: 1 })]);
    expect(f.split).toBeNull();
  });

  it('R8: rear-biased split uses the spec share', () => {
    const f = torqueFlow(getVehicle('audi-r8-v10-gen2'));
    expect(f.split?.front).toBeCloseTo(0.3, 9);
    const front = f.axles.find((a) => a.axle === 'front')!;
    expect(front.share).toBeCloseTo(0.3, 9);
  });

  it('EV dual motor: each motor feeds only its own axle', () => {
    const f = torqueFlow(getVehicle('tesla-model3-awd'));
    expect(f.axles.map((a) => a.axle).sort()).toEqual(['front', 'rear']);
    // no shaft runs between the axles
    for (const s of f.segs) expect(Math.abs(s.a[0] - s.b[0])).toBeLessThan(5);
  });

  it('FR: the path runs from the engine down a prop shaft to the rear', () => {
    const f = torqueFlow(getVehicle('bmw-m340i-g20'));
    const longest = Math.max(...f.segs.map((s) => Math.abs(s.a[0] - s.b[0])));
    expect(longest).toBeGreaterThan(1000);
  });
});
