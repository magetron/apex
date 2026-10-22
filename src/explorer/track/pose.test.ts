import { describe, expect, it } from 'vitest';
import { hotLap, trackLine } from '../../sim/track';
import { getVehicle } from '../../spec/catalog';
import { newPose, poseAt } from './pose';

describe('a car between the line samples', () => {
  const line = trackLine('monza');
  const lap = hotLap('monza', getVehicle('porsche-911-992'));
  const p = newPose();
  /** world travel direction (rad, as yaw) from t0 to t1 */
  const travel = (t0: number, t1: number) => {
    poseAt(line, lap, t0, p);
    const x = p.x;
    const z = p.z;
    poseAt(line, lap, t1, p);
    return Math.atan2(-(p.z - z), p.x - x);
  };

  it('passes through the samples, heading along the line', () => {
    for (const i of [10, 400, 1500]) {
      poseAt(line, lap, lap.t[i], p);
      expect(p.x).toBeCloseTo(line.x[i], 6);
      expect(p.z).toBeCloseTo(-line.y[i], 6);
      expect(p.yaw).toBeCloseTo(line.psi[i], 6);
    }
  });

  it('turns smoothly through a sample in the tightest corner, without a kink there', () => {
    let i = 1;
    for (let k = 1; k < line.n - 1; k++) if (Math.abs(line.k[k]) > Math.abs(line.k[i])) i = k;
    const t = lap.t[i];
    const e = 1e-3;
    const turn = travel(t + e, t + 2 * e) - travel(t - 2 * e, t - e);
    // on the chords the direction jumps by the turn over a whole sample (κ × 2 m); here it turns
    // only by what 2 ms of travel turns it
    const kink = Math.abs(line.k[i]) * line.seg[i];
    expect(kink).toBeGreaterThan(0.05);
    expect(Math.abs(turn)).toBeLessThan(kink / 10);
  });

  it('pitches and steers from values between the samples, not the nearest one', () => {
    const i = 700;
    const t = (lap.t[i] + lap.t[i + 1]) / 2;
    poseAt(line, lap, t, p);
    expect(p.ax).toBeCloseTo((lap.ax[i] + lap.ax[i + 1]) / 2, 6);
    expect(p.k).toBeCloseTo((line.k[i] + line.k[i + 1]) / 2, 6);
  });
});
