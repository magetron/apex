import { describe, expect, it } from 'vitest';
import { hotLap, trackLine, trackPath } from '../../sim/track';
import { getVehicle, listVehicles } from '../../spec/catalog';
import { parseView, viewPath, withVehicle, zoomOut, type View } from '../view';
import { outline } from './outline';
import { newPose, poseAt } from './pose';

const [a, b, c] = listVehicles();

describe('hot-lap views', () => {
  it('round-trip, with and without a circuit and cars to compare', () => {
    const views: View[] = [
      { vehicleId: a.id, level: 'track' },
      { vehicleId: a.id, level: 'track', track: 'monza' },
      { vehicleId: a.id, level: 'track', track: 'spa', vs: [b.id, c.id] },
    ];
    for (const v of views) expect(parseView(viewPath(v))).toEqual(v);
    expect(viewPath(views[2])).toBe(`/${a.id}/track/spa?vs=${b.id},${c.id}`);
  });

  it('ignore a circuit that does not exist', () => {
    expect(parseView(`/${a.id}/track/nowhere`)).toEqual({ vehicleId: a.id, level: 'track' });
  });

  it('back out a step at a time: the lap, the circuits, the car', () => {
    const lap: View = { vehicleId: a.id, level: 'track', track: 'monaco', vs: [b.id] };
    const cards = zoomOut(lap)!;
    expect(cards).toEqual({ vehicleId: a.id, level: 'track', vs: [b.id] });
    expect(zoomOut(cards)).toEqual({ vehicleId: a.id, level: 'car', vs: [b.id] });
  });

  it('keep the circuit when the car changes', () => {
    const v = withVehicle({ vehicleId: a.id, level: 'track', track: 'monza' }, b.id);
    expect(v).toEqual({ vehicleId: b.id, level: 'track', track: 'monza' });
  });
});

describe('a car on its lap', () => {
  const v = getVehicle('porsche-911-gt3-992');
  const lap = hotLap('silverstone', v);
  const line = trackLine('silverstone');

  it('starts on the line and is back on it after a lap', () => {
    const p = poseAt(line, lap, 0, newPose());
    expect(p.at).toBeCloseTo(0, 6);
    expect(p.x).toBeCloseTo(line.x[0], 6);
    const q = poseAt(line, lap, lap.time + 0.001, newPose());
    expect(q.laps).toBe(1);
    expect(q.at).toBeLessThan(1);
  });

  it('rolls on past the line once home and comes to rest', () => {
    const p = poseAt(line, lap, lap.time + 2, newPose());
    const q = poseAt(line, lap, lap.time + 4, newPose());
    const rest = poseAt(line, lap, lap.time + 600, newPose());
    expect(p.at).toBeGreaterThan(0);
    expect(q.at).toBeGreaterThan(p.at);
    expect(q.v).toBeLessThan(p.v);
    expect(rest.v).toBe(0);
    expect(rest.at).toBeLessThan(line.n / 2);
  });

  it('moves the way the line points, at the lap speed', () => {
    const p = poseAt(line, lap, 20, newPose());
    const q = poseAt(line, lap, 20.05, newPose());
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    // heading yaw points +X towards −Z (the world's Z is the sim's −y)
    expect(Math.hypot(dx, dz) / 0.05).toBeCloseTo(p.v, 0);
    expect(Math.atan2(-dz, dx)).toBeCloseTo(Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw)), 1);
  });
});

describe('outline', () => {
  it('fits a circuit into its box, turned like its map', () => {
    const o = outline(trackPath('monza'), 180, 100, 4);
    expect(Math.max(o.w, o.h)).toBeCloseTo(100, 6);
    // Monza's map has the start straight running to the left
    const p0 = o.at(0, { x: 0, y: 0 });
    const p1 = o.at(50, { x: 0, y: 0 });
    expect(p1.x).toBeLessThan(p0.x);
  });
});
