import { describe, expect, it } from 'vitest';
import { getEngine, listEngines, listMotors } from '../spec/catalog';
import { buildEngineGeometry, coreBoundsMm, disposeEngineGeometry } from './geometry';
import { motionTables, sampleBalance } from './motion';
import { gearAngles, motorLayout } from './motorLayout';
import { buildMotorGeometry, disposeMotorGeometry } from './motorGeometry';

describe('generated engine vs envelope()', () => {
  // rotaries: rotary.test.ts
  const pistons = listEngines().filter((e) => e.family !== 'rotary');
  it.each(pistons.map((e) => [e.id, e] as const))('%s: core bounds agree within 20 mm', (_, e) => {
    for (const lod of ['high', 'low'] as const) {
      const g = buildEngineGeometry(e, lod);
      const b = coreBoundsMm(g);
      const env = g.layout.env;
      const tol = 20;
      expect(Math.abs(b.min.x - env.min[0])).toBeLessThan(tol);
      expect(Math.abs(b.max.x - env.max[0])).toBeLessThan(tol);
      expect(Math.abs(b.min.y - env.min[1])).toBeLessThan(tol);
      expect(Math.abs(b.max.y - env.max[1])).toBeLessThan(tol);
      expect(Math.abs(b.min.z - env.min[2])).toBeLessThan(tol);
      expect(Math.abs(b.max.z - env.max[2])).toBeLessThan(tol);
      // the moving and instanced parts are real geometry
      for (const geo of [
        g.piston,
        g.rod,
        g.crankSteel,
        g.crankWebs,
        g.valve,
        ...g.cams.map((c) => c.geometry),
      ]) {
        expect(geo.attributes.position.count).toBeGreaterThan(0);
      }
      expect(g.heads).toHaveLength(g.layout.heads.length);
      expect(g.exhaust).toHaveLength(g.layout.exhaust.length);
      expect(g.turbos).toHaveLength(g.layout.turbos.length);
      expect(g.chainLink === null).toBe(lod === 'low');
      disposeEngineGeometry(g);
    }
  });
});

describe('block casting', () => {
  it('a vee keeps its open valley between the banks; an inline block is solid up the middle', () => {
    const v8 = buildEngineGeometry(getEngine('v8-cross'), 'low');
    const deck = v8.layout.dims.deckMm;
    // highest point of the casting straight above the crank (x mid, z ≈ 0)
    const pos = v8.block.attributes.position;
    let valleyTop = -Infinity;
    for (let i = 0; i < pos.count; i++)
      if (Math.abs(pos.getZ(i)) < 0.004) valleyTop = Math.max(valleyTop, pos.getY(i) * 1000);
    expect(valleyTop).toBeLessThan(deck * 0.75);
    const i4 = buildEngineGeometry(getEngine('i4'), 'low');
    let top = -Infinity;
    const p4 = i4.block.attributes.position;
    for (let i = 0; i < p4.count; i++)
      if (Math.abs(p4.getZ(i)) < 0.004) top = Math.max(top, p4.getY(i) * 1000);
    expect(top).toBeGreaterThan(i4.layout.dims.deckMm - 5);
    disposeEngineGeometry(v8);
    disposeEngineGeometry(i4);
  });
});

describe('balance shake inputs (the money shot)', () => {
  const peaks = (id: string) => {
    const t = motionTables(getEngine(id));
    const b = new Float32Array(8);
    const peak = { force: 0, forceZ: 0, couple: 0 };
    for (let d = 0; d < 360; d += 2) {
      sampleBalance(t, d, b);
      peak.force = Math.max(peak.force, Math.hypot(b[0] + b[2], b[1] + b[3]));
      peak.forceZ = Math.max(peak.forceZ, Math.abs(b[1] + b[3]));
      peak.couple = Math.max(peak.couple, Math.hypot(b[4] + b[6], b[5] + b[7]));
    }
    return peak;
  };
  it('I3 rocks, I4 buzzes vertically, I6 sits still', () => {
    const i3 = peaks('i3');
    expect(i3.force).toBeLessThan(1e-3);
    expect(i3.couple).toBeGreaterThan(1);
    const i4 = peaks('i4');
    expect(i4.force).toBeGreaterThan(3.9);
    expect(i4.forceZ).toBeLessThan(1e-3);
    expect(i4.couple).toBeLessThan(1e-3);
    const i6 = peaks('i6');
    expect(i6.force + i6.couple).toBeLessThan(1e-3);
  });
});

describe('EV drive unit', () => {
  it.each(listMotors().map((m) => [m.id, m] as const))(
    '%s: gears mesh and reduce by the spec ratio',
    (_, m) => {
      const l = motorLayout(m);
      const d = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      expect(l.pinion.radiusMm + l.inter1.radiusMm).toBeCloseTo(d(l.motorAxis, l.interAxis), 6);
      expect(l.inter2.radiusMm + l.ring.radiusMm).toBeCloseTo(d(l.interAxis, [0, 0]), 6);
      // same tooth pitch on meshing gears
      expect(l.pinion.radiusMm / l.pinion.teeth).toBeCloseTo(l.inter1.radiusMm / l.inter1.teeth, 6);
      expect(l.inter2.radiusMm / l.inter2.teeth).toBeCloseTo(l.ring.radiusMm / l.ring.teeth, 6);
      expect(Math.abs(l.ratio / m.reduction - 1)).toBeLessThan(0.03);
      const [rotor, , wheel] = gearAngles(l, 10);
      expect(rotor / wheel).toBeCloseTo(l.ratio, 6);
    },
  );

  it.each(listMotors().map((m) => [m.id, m] as const))('%s: fits its drive-unit box', (_, m) => {
    const g = buildMotorGeometry(m);
    const L = m.lengthMm;
    const D = m.diameterMm;
    const tol = 0.08;
    for (const [name, geo] of Object.entries(g)) {
      if (name === 'layout' || !geo || !('computeBoundingBox' in geo)) continue;
      geo.computeBoundingBox();
      const b = geo.boundingBox!;
      // rotor / intermediate parts are local to their own axes: offset them back
      const [oy, oz] =
        name.startsWith('rotor') || name.startsWith('magnets')
          ? g.layout.motorAxis
          : name === 'inter'
            ? g.layout.interAxis
            : [0, 0];
      expect(b.min.x * 1000, name).toBeGreaterThan(-L / 2 - tol * L);
      expect(b.max.x * 1000, name).toBeLessThan(L / 2 + tol * L);
      expect(b.min.y * 1000 + oy, name).toBeGreaterThan(-D / 2 - tol * D);
      expect(b.max.y * 1000 + oy, name).toBeLessThan(D / 2 + tol * D);
      expect(b.min.z * 1000 + oz, name).toBeGreaterThan(-D / 2 - tol * D);
      expect(b.max.z * 1000 + oz, name).toBeLessThan(D / 2 + tol * D);
    }
    disposeMotorGeometry(g);
  });
});
