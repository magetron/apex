import { describe, expect, it } from 'vitest';
import { getVehicle, listVehicles } from '../../spec/catalog';
import type { PlacedPart } from '../../spec/types';
import { carFacts } from './carFacts';
import { catalogFrame, hull, sideOutline, silhouette } from './carSilhouette';

const box = (over: Partial<PlacedPart>): PlacedPart => ({
  id: 'engine',
  kind: 'engine',
  label: 'Engine',
  posMm: [100, 500, 0],
  sizeMm: [600, 400, 300],
  yawDeg: 0,
  rollDeg: 0,
  kg: 150,
  ...over,
});

const xSpan = (pts: [number, number][]) =>
  Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));

describe('side outline', () => {
  it('hull drops interior points', () => {
    const h = hull([
      [0, 0],
      [2, 0],
      [1, 1],
      [2, 2],
      [0, 2],
    ]);
    expect(h).toHaveLength(4);
  });

  it('shows a longitudinal block at its length, a transverse one at its width', () => {
    expect(xSpan(sideOutline(box({})))).toBeCloseTo(600);
    expect(xSpan(sideOutline(box({ yawDeg: -90 })))).toBeCloseTo(300);
  });

  it('a transverse engine leaning back shows its tilt from the side', () => {
    const upright = sideOutline(box({ yawDeg: -90 }));
    const leaning = sideOutline(box({ yawDeg: -90, rollDeg: 12 }));
    expect(xSpan(leaning)).toBeGreaterThan(xSpan(upright) + 50);
    expect(leaning.length).toBeGreaterThan(4);
  });
});

describe('silhouette', () => {
  const frame = catalogFrame();

  it('draws every catalog car inside the shared frame', () => {
    for (const v of listVehicles()) {
      const s = silhouette(v);
      expect(s.body, v.id).toMatch(/^M-?\d+,-?\d+(L-?\d+,-?\d+)+Z$/);
      expect(s.wheels, v.id).toHaveLength(2);
      expect(
        s.parts.some((p) => p.kind === 'engine' || p.kind === 'motor'),
        v.id,
      ).toBe(true);
      expect(s.cg, v.id).not.toBeNull();
      expect(s.bounds.x0, v.id).toBeGreaterThanOrEqual(frame.x);
      expect(s.bounds.x1, v.id).toBeLessThanOrEqual(frame.x + frame.w);
      expect(-s.bounds.top, v.id).toBeGreaterThanOrEqual(frame.y);
    }
  });

  it('marks the driven axle', () => {
    for (const v of listVehicles()) {
      const { drive } = carFacts(v);
      const [front, rear] = [...silhouette(v).wheels].sort((a, b) => b.cx - a.cx);
      expect(front.driven, v.id).toBe(drive !== 'RWD');
      expect(rear.driven, v.id).toBe(drive !== 'FWD');
    }
  });

  it('puts a 911 engine behind the rear axle and a GTI one over the front', () => {
    const engX = (id: string) => {
      const pts = silhouette(getVehicle(id))
        .parts.find((p) => p.kind === 'engine')!
        .points.split(' ')
        .map((q) => Number(q.split(',')[0]));
      return (Math.min(...pts) + Math.max(...pts)) / 2;
    };
    expect(engX('porsche-911-992')).toBeLessThan(-getVehicle('porsche-911-992').dims.wheelbaseMm);
    expect(Math.abs(engX('vw-golf-gti-mk8'))).toBeLessThan(400);
  });
});
