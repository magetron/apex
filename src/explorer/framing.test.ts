import { describe, expect, it } from 'vitest';
import { getEngine, listVehicles } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive/layout';
import { VIEW_ANGLES } from './compare';
import {
  ALONG_OFFSET,
  engineView,
  ORBIT_FLOOR,
  showsLayout,
  SIDE_FLOOR,
  spotOf,
  stillSince,
} from './framing';

const dir = (az: number) => [Math.sin(az), Math.cos(az)];

describe('camera angles', () => {
  it('keeps a side-ish angle from above, not a head-on, rear, plan or worm’s-eye one', () => {
    expect(showsLayout(Math.PI * 0.2, Math.PI * 0.28)).toBe(true);
    expect(showsLayout(Math.PI * 1.1, Math.PI * 0.3)).toBe(true);
    expect(showsLayout(Math.PI * 0.5, Math.PI * 0.3)).toBe(false);
    expect(showsLayout(-Math.PI * 0.5, Math.PI * 0.3)).toBe(false);
    expect(showsLayout(Math.PI * 0.2, 0.02)).toBe(false);
    expect(showsLayout(Math.PI * 0.2, Math.PI * 0.49)).toBe(false);
  });

  it('looks along the crank of a flat or V engine and across an inline one', () => {
    for (const v of listVehicles()) {
      const pt = v.powertrain;
      if (pt.kind !== 'ice') continue;
      const e = getEngine(pt.engine);
      const part = layoutPowertrain(v).parts.find((p) => p.kind === 'engine')!;
      const yaw = (part.yawDeg * Math.PI) / 180;
      const crank = [Math.cos(yaw), -Math.sin(yaw)];
      const [x, z] = dir(engineView(e, part).azimuth);
      const along = x * crank[0] + z * crank[1];
      // across an inline; from the timing end (+crank), a little off its axis, for the rest
      if (e.family === 'inline') expect(Math.abs(along), v.id).toBeLessThan(1e-6);
      else expect(along, v.id).toBeCloseTo(Math.cos(ALONG_OFFSET), 6);
    }
  });
});

describe('how low the camera goes', () => {
  it('stops 12–15° above the ground', () => {
    const above = 90 - (ORBIT_FLOOR * 180) / Math.PI;
    expect(above).toBeGreaterThanOrEqual(12);
    expect(above).toBeLessThanOrEqual(15);
  });

  it('never fights an angle the explorer flies to itself', () => {
    for (const v of listVehicles()) {
      const pt = v.powertrain;
      if (pt.kind !== 'ice') continue;
      const part = layoutPowertrain(v).parts.find((p) => p.kind === 'engine')!;
      expect(engineView(getEngine(pt.engine), part).polar).toBeLessThanOrEqual(ORBIT_FLOOR);
    }
    expect(VIEW_ANGLES['3q'].polar).toBeLessThanOrEqual(ORBIT_FLOOR);
    expect(VIEW_ANGLES.top.polar).toBeLessThanOrEqual(ORBIT_FLOOR);
    // comparing from the side looks from lower: its own floor
    expect(VIEW_ANGLES.side.polar).toBeLessThanOrEqual(SIDE_FLOOR);
  });
});

describe('framing what has stopped moving', () => {
  const at = (x: number, k = 1): [number, number, number][] => [
    [x - k, 0, 0],
    [x + k, 0, 0],
  ];

  it('waits while the pieces slide or spread, not once they rest', () => {
    expect(stillSince(spotOf(at(0)), spotOf(at(0)))).toBe(true);
    // a new car's engine gliding to its place
    expect(stillSince(spotOf(at(0)), spotOf(at(0.05)))).toBe(false);
    // an explode spreading the pieces about the same middle
    expect(stillSince(spotOf(at(0, 1)), spotOf(at(0, 1.05)))).toBe(false);
    expect(stillSince(null, spotOf(at(0)))).toBe(false);
    expect(spotOf([])).toBeNull();
  });
});
