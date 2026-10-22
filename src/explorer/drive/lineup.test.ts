import { describe, expect, it } from 'vitest';
import { lateralLimit } from '../../sim/model';
import { HUB_ORDER, runHeadless, SCENARIOS } from '../../sim/scenarios';
import { getVehicle, listVehicles } from '../../spec/catalog';
import type { VehicleSpec } from '../../spec/types';
import { awdWords, buildLineup, laneOf, paramsOf } from './lineup';
import { familyOf, useDrive } from './state';
import { chooseRival, KINDS, REAR_GRIP, rivalOptions } from './versus';

const p911 = getVehicle('porsche-911-992');
const golf = getVehicle('vw-golf-gti-mk8');
const m340 = getVehicle('bmw-m340i-g20');
const front = (v: VehicleSpec) => {
  const p = paramsOf(v);
  return p.b / p.L;
};
const run = (v: VehicleSpec, id: keyof typeof SCENARIOS) =>
  runHeadless(paramsOf(v), SCENARIOS[id].plan(SCENARIOS[id].speed.def)).result;
const over = (
  r: { spun: boolean; values: { slipChange?: number } },
  id: keyof typeof SCENARIOS,
) => {
  const v = SCENARIOS[id].verdict?.(r as never);
  return r.spun || v === 'spin' || v === 'tail';
};

describe('two cars on the road, never more', () => {
  it('the visitor’s car and one comparison, for every question', () => {
    for (const v of [p911, golf, m340]) {
      for (const id of HUB_ORDER) {
        const lineup = buildLineup(v, { scenario: id, compare: 'auto' }, SCENARIOS[id].speed.def);
        expect(lineup.map((e) => e.info.kind)).toEqual(['main', 'rival']);
        expect(lineup[0].vehicle).toBe(v);
        expect(lineup[1].info.label).toBeTruthy();
      }
    }
  });

  it('every question offers its kinds of comparison, and a picked car leads', () => {
    for (const id of HUB_ORDER) {
      const kinds = rivalOptions(p911, id).map((r) => r.kind);
      expect([...kinds].sort()).toEqual([...KINDS[id]].sort());
      const withPick = rivalOptions(p911, id, golf);
      expect(withPick[0]).toMatchObject({ kind: 'car', vehicle: golf });
      // 'auto' drives against the picked car; any listed kind can be asked for by name
      expect(chooseRival(p911, id, 'auto', golf).vehicle).toBe(golf);
      for (const k of KINDS[id]) expect(chooseRival(p911, id, k, golf).kind).toBe(k);
    }
  });

  it('the comparison is the same at every speed (picked at the default, so it never flickers)', () => {
    const at = (kmh: number) =>
      buildLineup(p911, { scenario: 'lift-off', compare: 'auto' }, kmh)[1];
    expect(at(45).vehicle.id).toBe(at(75).vehicle.id);
  });

  it('car B chosen by the visitor stays put from question to question', () => {
    useDrive.setState({ compare: 'without' });
    useDrive.getState().setScenario('trail-brake');
    expect(useDrive.getState().compare).toBe('without');
    expect(chooseRival(p911, 'trail-brake', 'without').kind).toBe('without');
    // a question without that choice shows its own suggestion, and the choice comes back after
    expect(chooseRival(p911, 'braking', 'without').kind).toBe('contrast');
    useDrive.setState({ compare: 'auto' });
    useDrive.getState().setScenario('lift-off');
  });

  it('the car picker’s call in drive is harmless', () => {
    expect(() => useDrive.getState().keepStandIns(p911)).not.toThrow();
  });
});

describe('the comparison that makes each question’s point', () => {
  it('lift-off: the tail-heavy 911 meets a nose-heavy car, and only one of them steps out', () => {
    const r = chooseRival(p911, 'lift-off', 'auto');
    expect(r.kind).toBe('contrast');
    expect(familyOf(r.vehicle)).not.toBe(familyOf(p911));
    expect(front(r.vehicle)).toBeGreaterThan(front(p911) + 0.1);
    expect(r.why).toBe('nose-heavy');
    expect(over(run(p911, 'lift-off'), 'lift-off')).toBe(true);
    expect(over(run(r.vehicle, 'lift-off'), 'lift-off')).toBe(false);
  });

  it('power out: a car meets one whose other end goes, by where its weight sits or which wheels drive', () => {
    // the 911's light nose runs out first under power, rear-driven as it is: it meets a
    // rear-driven car with its engine at the front, whose rear steps out
    expect(over(run(p911, 'power-exit'), 'power-exit')).toBe(false);
    const r = chooseRival(p911, 'power-exit', 'auto');
    expect(r.vehicle.powertrain.driven).toBe('rear');
    expect(front(r.vehicle)).toBeGreaterThan(front(p911) + 0.05);
    expect(over(run(r.vehicle, 'power-exit'), 'power-exit')).toBe(true);
    // a front-driver, running wide, meets a car driven at the rear whose rear steps out
    const g = chooseRival(golf, 'power-exit', 'auto');
    expect(g.vehicle.powertrain.driven).not.toBe('front');
    expect(over(run(g.vehicle, 'power-exit'), 'power-exit')).toBe(true);
  });

  it('catch: the 911 against itself without the catch; a front-driver that never slides gets a car that does', () => {
    expect(chooseRival(p911, 'catch', 'auto').kind).toBe('without');
    expect(SCENARIOS.catch.verdict!(run(golf, 'catch'))).toBe('no-slide');
    const r = chooseRival(golf, 'catch', 'auto');
    expect(r.kind).toBe('contrast');
    expect(SCENARIOS.catch.verdict!(run(r.vehicle, 'catch'))).toBe('caught');
    // another car is still there to choose: for the 911, one that doesn't slide and get caught
    const c = chooseRival(p911, 'catch', 'contrast');
    expect(c.kind).toBe('contrast');
    expect(SCENARIOS.catch.verdict!(run(c.vehicle, 'catch'))).not.toBe('caught');
  });

  it('trail braking and left-foot braking: the same car without the brake; another car is a choice', () => {
    for (const v of [p911, golf, m340]) {
      for (const id of ['trail-brake', 'left-foot'] as const) {
        expect(chooseRival(v, id, 'auto').kind).toBe('without');
        const r = chooseRival(v, id, 'contrast');
        expect(r.kind).toBe('contrast');
        expect(r.vehicle).not.toBe(v);
      }
    }
    // left-foot braking is the front-driver's technique: a rear-driver meets one
    expect(chooseRival(p911, 'left-foot', 'contrast').vehicle.powertrain.driven).toBe('front');
  });

  it('where the lesson is the layout, car B is another car by default', () => {
    for (const v of [p911, golf, m340])
      for (const id of ['lift-off', 'power-exit', 'braking', 'lane-change'] as const)
        expect(chooseRival(v, id, 'auto').kind).toBe('contrast');
  });

  it('push wide: the same car with less rear grip, which lets go at the other end', () => {
    for (const v of [p911, golf, m340]) {
      const r = chooseRival(v, 'skidpad', 'auto');
      expect(r.kind).toBe('less-rear');
      expect(r.tuning?.rearGrip).toBe(REAR_GRIP['less-rear']);
    }
  });

  it('nose dive: a car whose centre of gravity sits higher or lower for its wheelbase', () => {
    const r = chooseRival(p911, 'braking', 'auto');
    const hl = (v: VehicleSpec) => paramsOf(v).h / paramsOf(v).L;
    expect(Math.abs(hl(r.vehicle) - hl(p911))).toBeGreaterThan(0.03);
  });

  it('the tuned twin drives the as-built car’s speeds', () => {
    const [main, twin] = buildLineup(p911, { scenario: 'skidpad', compare: 'auto' }, 64).map((e) =>
      laneOf(e),
    );
    expect(twin.p.rear.mu).toBeCloseTo(main.p.rear.mu * REAR_GRIP['less-rear'], 9);
    expect(lateralLimit(twin.p)).toBeLessThan(lateralLimit(main.p));
    expect(twin.run.ctl.vScale).toBeCloseTo(main.run.ctl.vScale, 9);
  });

  it('an all-wheel-drive car says its torque split, from the spec, as the sim uses it', () => {
    for (const v of listVehicles().filter((x) => familyOf(x) === 'AWD'))
      expect(awdWords(v)).toMatch(/\d+:\d+ front:rear|locked together/);
    expect(awdWords(p911)).toBeUndefined();
    // the GT-R: mainly rear-drive, 20:80, as its spec's device has it and the sim drives it
    const gtr = getVehicle('nissan-gtr-r35');
    expect(awdWords(gtr)).toMatch(/^mainly rear-drive \(20:80 front:rear\)/);
    expect(paramsOf(gtr).drive.frontShare).toBeCloseTo(0.2, 6);
  });

  it('every car gets a comparison for every question', () => {
    for (const v of listVehicles()
      .filter((x) => x.tires.kind !== 'slick' && x.tires.kind !== 'offroad')
      .slice(0, 12))
      for (const id of HUB_ORDER) expect(rivalOptions(v, id).length).toBeGreaterThan(0);
  });
});
