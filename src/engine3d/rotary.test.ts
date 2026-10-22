import { describe, expect, it } from 'vitest';
import { listEngines } from '../spec/catalog';
import { envelope } from '../spec/derive/envelope';
import { rotaryDims } from '../spec/derive/rotary';
import { balanceTable, sampleBalance } from './motion';
import {
  buildRotaryGeometry,
  disposeRotaryGeometry,
  FLANK_SEGS,
  rotaryCoreBoundsMm,
} from './rotaryGeometry';

const rotaries = listEngines().filter((e) => e.family === 'rotary');

describe('rotary model', () => {
  it('the catalog has a rotary to draw', () => expect(rotaries.length).toBeGreaterThan(0));

  it.each(rotaries.map((e) => [e.id, e] as const))(
    '%s: drawn core agrees with envelope() within 20 mm',
    (_, e) => {
      for (const lod of ['high', 'low'] as const) {
        const g = buildRotaryGeometry(e, lod);
        const b = rotaryCoreBoundsMm(g);
        const env = envelope(e);
        expect(Math.abs(b.min.x - env.min[0])).toBeLessThan(20);
        expect(Math.abs(b.max.x - env.max[0])).toBeLessThan(20);
        expect(Math.abs(b.min.y - env.min[1])).toBeLessThan(20);
        expect(Math.abs(b.max.y - env.max[1])).toBeLessThan(20);
        expect(Math.abs(b.min.z - env.min[2])).toBeLessThan(20);
        expect(Math.abs(b.max.z - env.max[2])).toBeLessThan(20);
        for (const geo of [
          g.rotor.front,
          g.rotor.rear,
          g.rotorGear.front,
          g.seals,
          g.eshaft,
          g.rotorHousing,
          g.intake,
          g.exhaust,
        ])
          expect(geo.attributes.position.count).toBeGreaterThan(0);
        expect(g.plates).toHaveLength(e.cylinders.length + 1);
        expect(g.flank).toHaveLength(FLANK_SEGS + 1);
        disposeRotaryGeometry(g);
      }
    },
  );

  it.each(rotaries.map((e) => [e.id, e] as const))(
    '%s: side ports on the side housings, one fixed gear per rotor',
    (_, e) => {
      const g = buildRotaryGeometry(e, 'low');
      const side = (k: 'intake' | 'exhaust') =>
        e.rotary!.ports.some((p) => p.kind === k && p.location === 'side');
      expect(g.plates.some((p) => p.intake)).toBe(side('intake'));
      expect(g.plates.some((p) => p.exhaust)).toBe(side('exhaust'));
      expect(g.plates.filter((p) => p.gear)).toHaveLength(e.cylinders.length);
      disposeRotaryGeometry(g);
    },
  );

  it.each(rotaries.map((e) => [e.id, e] as const))(
    '%s: the 3:2 phasing gears mesh around the lobe, which fits the rotor bore',
    (_, e) => {
      const d = rotaryDims(e);
      // internal gear on 3e about the rotor centre, fixed gear on 2e about the shaft: the centres
      // are e apart, so the pitch circles touch
      expect(3 * d.e - 2 * d.e).toBeCloseTo(d.e, 9);
      // the rotor bore (around the lobe) stays inside the internal gear's teeth
      expect(d.lobeMm + 2).toBeLessThan(3 * d.e - 1.3);
      // the main journal passes through the fixed gear
      expect(d.journalMm + 3).toBeLessThan(2 * d.e - 1.3);
    },
  );

  it.each(rotaries.map((e) => [e.id, e] as const))(
    '%s: balance view shows only the rotating couple of the eccentric rotors',
    (_, e) => {
      const t = balanceTable(e);
      const b = new Float32Array(8);
      let force = 0;
      let second = 0;
      const couple: number[] = [];
      for (let deg = 0; deg < 360; deg += 3) {
        sampleBalance(t, deg, b);
        force = Math.max(force, Math.hypot(b[0], b[1]));
        second = Math.max(second, Math.hypot(b[2], b[3], b[6], b[7]));
        couple.push(Math.hypot(b[4], b[5]));
      }
      expect(force).toBeLessThan(1e-3);
      expect(second).toBe(0);
      // rotating: constant magnitude all the way round
      expect(Math.max(...couple) - Math.min(...couple)).toBeLessThan(1e-3);
    },
  );
});
