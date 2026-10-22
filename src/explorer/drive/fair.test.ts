/**
 * Fair comparisons: every car asked for the same thing in g, so power-to-weight
 * doesn't sort the results; the pause is car A's own; a car B that spun is never talked over;
 * the lane change timed the standard way.
 */
import { describe, expect, it } from 'vitest';
import type { CarParams } from '../../sim/model';
import { SCENARIOS, type ScenarioId } from '../../sim/scenarios';
import { getVehicle } from '../../spec/catalog';
import { findKey } from './key';
import { Lane } from './lanes';
import { buildLineup, laneOf, laneResult, paramsOf } from './lineup';
import { carLine, lesson, type Outcome } from './takeaway';

/** The same car with its engine this many times as strong. */
const withPower = (p: CarParams, k: number): CarParams => ({
  ...p,
  drive: { ...p.drive, powerW: p.drive.powerW * k, forceN: p.drive.forceN * k },
});

function run(p: CarParams, id: ScenarioId): Outcome {
  const def = SCENARIOS[id];
  const l = new Lane(p, def.plan(def.speed.def), false, { kind: 'main', code: '', name: p.name });
  l.simTo(l.plan.duration + 1);
  return laneResult(l).outcome!;
}

describe('a fair comparison', () => {
  it('power out: every car asks for the same g, so a stronger engine changes nothing', () => {
    const cars = ['porsche-911-992', 'mazda-mx5-nd', 'bmw-m340i-g20', 'vw-golf-gti-mk8'];
    const swing = (o: Outcome) => o.values.exitSwing ?? 0;
    const as = cars.map((id) => run(paramsOf(getVehicle(id)), 'power-exit'));
    const doubled = cars.map((id) => run(withPower(paramsOf(getVehicle(id)), 2), 'power-exit'));
    as.forEach((o, i) => {
      // the same request, met either way: the same outcome, to the degree
      expect(doubled[i].verdict, cars[i]).toBe(o.verdict);
      expect(Math.abs(swing(doubled[i]) - swing(o)), cars[i]).toBeLessThan(0.5);
    });
    // so the ranking is the layouts', not the engines': the same order with every engine doubled
    const order = (os: Outcome[]) =>
      os
        .map((o, i) => [swing(o), i] as const)
        .sort((a, b) => b[0] - a[0])
        .map((x) => x[1]);
    expect(order(doubled)).toEqual(order(as));
    // and the MX-5 (119 kW) slides out more than the 911 (291 kW): its rear tyres carry less of
    // its weight for the same 0.5 g of drive, not because it has more power
    expect(swing(as[1])).toBeGreaterThan(swing(as[0]));
  });

  it('where a demand in g decides it, the question says every car asks for the same', () => {
    for (const id of ['power-exit', 'trail-brake', 'left-foot'] as ScenarioId[])
      expect(SCENARIOS[id].demand, id).toMatch(/every car/);
    // and nowhere else, where it would read as "every car behaves the same"
    for (const id of ['lift-off', 'catch'] as ScenarioId[])
      expect(SCENARIOS[id].demand).toBeUndefined();
    expect(SCENARIOS['power-exit'].demand).toMatch(/same 0\.5 g/);
    expect(SCENARIOS['trail-brake'].demand).toMatch(/same 0\.3 g/);
  });
});

describe('the pause is car A’s own moment', () => {
  it('the same 911 pauses at the same instant whatever car B is', () => {
    for (const id of ['lift-off', 'power-exit', 'trail-brake', 'left-foot', 'catch'] as const) {
      const def = SCENARIOS[id];
      const stops = ['mini-jcw-gp-f56', 'mazda-mx5-nd', 'bmw-m340i-g20'].map((b) => {
        const lanes = buildLineup(
          getVehicle('porsche-911-992'),
          { scenario: id, compare: 'car' },
          def.speed.def,
          getVehicle(b),
        ).map((e) => {
          const l = laneOf(e);
          l.simTo(e.plan.duration + 1);
          return l;
        });
        return findKey(def, lanes)!.freeze[0];
      });
      expect(stops[1], id).toBeCloseTo(stops[0], 6);
      expect(stops[2], id).toBeCloseTo(stops[0], 6);
    }
  });
});

describe('a car B that spun is never talked over', () => {
  it('braking into a turn: "yes" for one car says the other spun', () => {
    const base = {
      model: '911',
      code: 'RR',
      driven: 'rear' as const,
      front: 0.39,
      frontMax: 0.4,
      rollF: 0.44,
      dynIndex: 1,
      cgOverL: 0.18,
      widerRear: true,
      tyreF: 245,
      tyreR: 305,
      rearGrip: 1,
      letGo: null,
    };
    const braked: Outcome = {
      ...base,
      verdict: 'tight',
      spun: false,
      values: { sameSpeedShift: 0.74 },
    };
    const spun: Outcome = {
      ...base,
      model: 'MX-5',
      front: 0.5,
      verdict: 'spin',
      spun: true,
      values: {},
    };
    const text = lesson('trail-brake', [braked, spun]);
    expect(text).toMatch(/MX-5 spun/);
    expect(text).toMatch(/^Yes for the 911/);
  });
});

describe('a lift-off slide that was still growing is said so', () => {
  it('never "swung out N° at most" for a tail still swinging as the held wheel ended', () => {
    const def = SCENARIOS['lift-off'];
    const lane = laneOf(
      buildLineup(
        getVehicle('mazda-mx5-nd'),
        { scenario: 'lift-off', compare: 'auto' },
        def.speed.def,
      )[0],
    );
    lane.simTo(lane.plan.duration + 1);
    const o = laneResult(lane).outcome!;
    if (o.verdict === 'tail' && (o.values.swingRate ?? 0) > 1)
      expect(carLine('lift-off', o)).toMatch(/by the end of the held wheel and still going/);
  });
});

describe('the lane change, timed the standard way', () => {
  it('a step steer, to 90% of the turn rate it settles at: tenths of a second, as cars do', () => {
    for (const id of ['mini-jcw-gp-f56', 'porsche-718-boxster-t-982', 'porsche-911-992']) {
      const lane = laneOf(
        buildLineup(getVehicle(id), { scenario: 'lane-change', compare: 'auto' }, 80)[0],
      );
      lane.simTo(lane.plan.duration + 1);
      const t = laneResult(lane).outcome!.values.yawResponse!;
      expect(t, id).toBeGreaterThan(100);
      expect(t, id).toBeLessThan(350);
    }
  });
});
