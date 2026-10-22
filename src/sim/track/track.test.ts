import { describe, expect, it } from 'vitest';
import { carParams } from '../model';
import { getVehicle } from '../../spec/catalog';
import { massProps } from '../../spec/derive/mass';
import type { VehicleSpec } from '../../spec/types';
import {
  BRAKE,
  DRIVER,
  SHIFT_S,
  deltaTrace,
  fullPowerShare,
  hotLap,
  interval,
  keyMoments,
  limitTimes,
  POWER,
  raceOrder,
  sections,
  lapCar,
  listTracks,
  sectorBest,
  simulateLap,
  timeSplit,
  trackLine,
  trackPath,
  type Lap,
} from '.';

const tracks = listTracks();

describe('tracks', () => {
  it('has a handful of real circuits of different character', () => {
    expect(tracks.length).toBeGreaterThanOrEqual(4);
    const ids = tracks.map((t) => t.id);
    expect(ids).toContain('monza');
    expect(ids).toContain('monaco');
  });

  for (const spec of tracks) {
    describe(spec.id, () => {
      const path = trackPath(spec.id);

      it('is as long as the circuit: measured data, not rescaled', () => {
        // within 1.5% of the official length (Top Gear's 1.75 mi is a rounded figure)
        expect(Math.abs(path.length / spec.lengthM - 1)).toBeLessThan(0.015);
      });

      it('closes smoothly, from the line along +x', () => {
        expect(Math.abs(path.psi[0])).toBeLessThan(0.05);
        expect(Math.hypot(path.x[0], path.y[0])).toBeLessThan(0.5);
        // the last sample leads back onto the first
        const i = path.n - 1;
        const x = path.x[i] + path.ds * Math.cos(path.psi[i]);
        const y = path.y[i] + path.ds * Math.sin(path.psi[i]);
        expect(Math.hypot(x - path.x[0], y - path.y[0])).toBeLessThan(0.5);
        // round once (a figure of eight: no net turn)
        const turns = (path.psi[i] - path.psi[0]) / (2 * Math.PI);
        expect(Math.abs(turns - Math.round(turns))).toBeLessThan(0.02);
        expect(Math.abs(Math.round(turns))).toBeLessThanOrEqual(1);
      });

      it('has the track either side of the centreline', () => {
        for (let i = 0; i < path.n; i++) {
          expect(path.wl[i]).toBeGreaterThan(2);
          expect(path.wr[i]).toBeGreaterThan(2);
        }
        expect(path.width).toBeGreaterThan(6);
        expect(path.width).toBeLessThan(20);
      });

      it('names its corners in order and has three sectors', () => {
        expect(path.corners.length).toBeGreaterThanOrEqual(spec.turns / 3);
        for (let k = 1; k < path.corners.length; k++)
          expect(path.corners[k].apex).toBeGreaterThan(path.corners[k - 1].apex);
        for (const c of path.corners) {
          expect(c.s0).toBeLessThanOrEqual(c.apex);
          expect(c.apex).toBeLessThanOrEqual(c.s1);
          // a named corner is a real bend in the data
          expect(c.radius).toBeLessThan(400);
        }
        expect(path.sectors).toHaveLength(3);
        expect(path.sectors[1]).toBeGreaterThan(0);
        expect(path.sectors[2]).toBeGreaterThan(path.sectors[1]);
        expect(path.sectors[2]).toBeLessThan(path.length);
      });

      it('keeps the racing line on the track, shorter than the centreline', () => {
        const line = trackLine(spec.id);
        for (let i = 0; i < line.n; i++) {
          expect(line.offset[i]).toBeLessThan(path.wl[i]);
          expect(line.offset[i]).toBeGreaterThan(-path.wr[i]);
        }
        expect(line.length).toBeLessThan(path.length);
      });
    });
  }
});

const lap = (trackId: string, v: VehicleSpec) => hotLap(trackId, v);

/** The same car with ballast at its centre of gravity: same power and balance, more mass. */
function ballasted(v: VehicleSpec, kg: number): VehicleSpec {
  return {
    ...v,
    id: `${v.id}+${kg}`,
    // (the kerb weight is what massProps shares out: ballast adds to it)
    published: { ...v.published, curbKg: v.published.curbKg + kg },
    extraMasses: [
      ...(v.extraMasses ?? []),
      { id: 'ballast', label: 'Ballast', kg, posMm: massProps(v).cgMm },
    ],
  };
}

describe('the hot lap', () => {
  const chiron = getVehicle('bugatti-chiron');
  const fiat = getVehicle('fiat-500-1957');
  const gt3 = getVehicle('porsche-911-gt3-992');

  it('is deterministic', () => {
    const run = () =>
      simulateLap(trackPath('spa'), trackLine('spa'), lapCar(carParams(gt3)), 'spa');
    const a = run();
    const b = run();
    expect(a.time).toBe(b.time);
    expect(Array.from(a.v)).toEqual(Array.from(b.v));
    expect(Array.from(a.gear)).toEqual(Array.from(b.gear));
  });

  it('a Chiron beats a Fiat 500 everywhere', () => {
    for (const t of tracks) expect(lap(t.id, chiron).time).toBeLessThan(lap(t.id, fiat).time);
  });

  it('a light car beats a heavy one of the same power on a twisty track', () => {
    const golf = getVehicle('vw-golf-gti-mk8');
    expect(lap('monaco', golf).time).toBeLessThan(lap('monaco', ballasted(golf, 300)).time);
  });

  it('power matters more at Monza than at Monaco', () => {
    const p = carParams(gt3);
    // the same engine half as strong again: torque and power
    const strong = {
      ...p,
      drive: { ...p.drive, powerW: p.drive.powerW * 1.5, forceN: p.drive.forceN * 1.5 },
    };
    const gain = (id: string) => {
      const base = simulateLap(trackPath(id), trackLine(id), lapCar(p)).time;
      const more = simulateLap(trackPath(id), trackLine(id), lapCar(strong)).time;
      return (base - more) / base;
    };
    expect(gain('monza')).toBeGreaterThan(1.5 * gain('monaco'));
  });

  it('a real driver and gearbox are slower than an ideal lap', () => {
    const p = carParams(gt3);
    const run = (o: Parameters<typeof lapCar>[1]) =>
      simulateLap(trackPath('silverstone'), trackLine('silverstone'), lapCar(p, o)).time;
    const ideal = run({ induction: 'na', driver: 1, shift: 0 });
    expect(run({ induction: 'na', driver: 1, shift: SHIFT_S })).toBeGreaterThan(ideal);
    expect(run({ induction: 'na', driver: DRIVER, shift: 0 })).toBeGreaterThan(ideal);
  });

  it('adds up: sectors make the lap, the time split makes the gap', () => {
    const a = lap('silverstone', gt3);
    const b = lap('silverstone', fiat);
    expect(a.sectors.reduce((s, x) => s + x, 0)).toBeCloseTo(a.time, 6);
    const split = timeSplit([a, b]);
    const gap = split.reduce((s, x) => s + x.deltas[1], 0);
    expect(gap).toBeCloseTo(b.time - a.time, 6);
    expect(deltaTrace(a, b)[a.n]).toBeCloseTo(b.time - a.time, 6);
    expect(sectorBest([a, b])).toEqual([0, 0, 0]);
  });

  it('stays physical: speeds, pedals and gears', () => {
    const l: Lap = lap('monza', gt3);
    // a GT3 at Monza: well over 250 km/h on the straight, slow for the chicane
    expect(l.vMax * 3.6).toBeGreaterThan(250);
    expect(l.vMin * 3.6).toBeLessThan(80);
    for (let i = 0; i < l.n; i++) {
      expect(l.throttle[i] * l.brake[i]).toBe(0);
      expect(l.gear[i]).toBeGreaterThanOrEqual(1);
    }
    // never more than road tyres can do, whatever their exact grip
    const g = 9.81;
    for (let i = 0; i < l.n; i++) expect(Math.hypot(l.ax[i], l.ay[i])).toBeLessThan(2 * g);
  });

  it('drives a lap well under a second per car', () => {
    const t0 = performance.now();
    simulateLap(
      trackPath('spa'),
      trackLine('spa'),
      lapCar(carParams(getVehicle('nissan-gtr-r35'))),
    );
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it('orders cars like the published lap times (Top Gear power laps, dry)', () => {
    const tg = tracks.find((t) => t.id === 'top-gear')!;
    const dry = (tg.laps ?? []).filter((r) => !/wet|damp/.test(r.note));
    expect(dry.length).toBeGreaterThanOrEqual(8);
    const sim = dry.map((r) => lap('top-gear', getVehicle(r.vehicleId)).time);
    const rank = (xs: number[]) => {
      const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
      const r = new Array<number>(xs.length);
      order.forEach(([, i], k) => (r[i] = k));
      return r;
    };
    const ra = rank(dry.map((r) => r.time));
    const rb = rank(sim);
    const n = dry.length;
    const d2 = ra.reduce((s, r, i) => s + (r - rb[i]) ** 2, 0);
    const spearman = 1 - (6 * d2) / (n * (n * n - 1));
    // orderings and loose ranges only: the tyres' grip (spec μ) is still being calibrated
    expect(spearman).toBeGreaterThan(0.75);
    // an ideal driver on an ideal line: quicker than The Stig, never wildly off
    dry.forEach((r, i) => expect(Math.abs(sim[i] / r.time - 1)).toBeLessThan(0.25));
  });
});

describe('what holds a car back', () => {
  const gti = getVehicle('vw-golf-gti-mk8');
  const r = getVehicle('vw-golf-r-mk8');
  const gt3 = getVehicle('porsche-911-gt3-992');

  it('names a limit for every point of the lap', () => {
    const l = lap('monza', gt3);
    expect(l.limit).toHaveLength(l.n);
    const t = limitTimes(l);
    expect(t.grip + t.traction + t.power + t.brake).toBeCloseTo(l.time, 6);
    let flat = 0;
    for (let i = 0; i < l.n; i++) {
      if (l.limit[i] === BRAKE) expect(l.throttle[i]).toBeLessThan(1e-6);
      if (l.limit[i] === POWER) expect(l.brake[i]).toBeLessThan(1e-6);
      if (l.limit[i] === POWER && l.throttle[i] > 0.9) flat += l.t[i + 1] - l.t[i];
    }
    // on the power is flat out, but for the moment each upshift cuts the drive
    expect(flat / t.power).toBeGreaterThan(0.8);
  });

  it('a front-drive Golf is traction-limited longer than its all-wheel-drive sibling', () => {
    for (const t of ['monaco', 'top-gear'])
      expect(limitTimes(lap(t, gti)).traction).toBeGreaterThan(limitTimes(lap(t, r)).traction);
  });

  it('power counts for more at Monza than at Monaco', () => {
    expect(fullPowerShare(lap('monza', gt3))).toBeGreaterThan(fullPowerShare(lap('monaco', gt3)));
  });
});

describe('where the gaps change', () => {
  const cars = ['porsche-911-gt3-992', 'vw-golf-gti-mk8', 'bugatti-chiron'].map(getVehicle);
  const laps = cars.map((v) => lap('monza', v));
  const path = trackPath('monza');

  it('cuts the lap into corners and the runs between, end to end', () => {
    const secs = sections(path);
    for (let k = 1; k < secs.length; k++)
      expect(secs[k].s0).toBeGreaterThanOrEqual(secs[k - 1].s1 - 1e-6);
    expect(secs.at(-1)!.s1).toBeCloseTo(path.length, 6);
  });

  it('picks the biggest changes, at most two per car, never car A', () => {
    const ms = keyMoments(laps, path);
    expect(ms.length).toBeGreaterThan(0);
    expect(ms.length).toBeLessThanOrEqual(3);
    for (let k = 1; k < ms.length; k++)
      expect(Math.abs(ms[k].change)).toBeLessThanOrEqual(Math.abs(ms[k - 1].change));
    for (const m of ms) {
      expect(m.car).toBeGreaterThan(0);
      expect(ms.filter((x) => x.car === m.car).length).toBeLessThanOrEqual(2);
    }
  });

  it('gives live intervals that start level and end at the lap gaps', () => {
    for (const l of laps) expect(interval(laps[0], l, 0)).toBeCloseTo(0, 6);
    const end = Math.max(...laps.map((l) => l.time)) + 1;
    laps.forEach((l) => expect(interval(laps[0], l, end)).toBeCloseTo(l.time - laps[0].time, 6));
    // halfway round, the slower car is behind (+) and the faster one ahead (−)
    const mid = laps[0].time / 2;
    expect(interval(laps[0], laps[1], mid)).toBeGreaterThan(0);
    expect(interval(laps[0], laps[2], mid)).toBeLessThan(0);
  });

  it('orders the finish by lap time', () => {
    const end = Math.max(...laps.map((l) => l.time)) + 1;
    const order = raceOrder(laps, end);
    for (let k = 1; k < order.length; k++)
      expect(laps[order[k]].time).toBeGreaterThanOrEqual(laps[order[k - 1]].time);
  });
});
