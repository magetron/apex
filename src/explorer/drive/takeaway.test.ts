import { describe, expect, it } from 'vitest';
import { getVehicle } from '../../spec/catalog';
import { SCENARIOS, type ScenarioId } from '../../sim/scenarios';
import { autoRate, findKey, KEY_RATE } from './key';
import { Lane } from './lanes';
import { buildLineup, laneResult } from './lineup';
import { carLine, lesson, modelName, rankCorr, type Outcome } from './takeaway';

/** A made-up car: only what a lesson reads. */
const car = (o: Partial<Outcome> & Pick<Outcome, 'code'>): Outcome => ({
  model: o.code,
  driven: 'rear',
  front: 0.5,
  frontMax: 0.5,
  rollF: 0.6,
  dynIndex: 0.9,
  values: {},
  verdict: null,
  spun: false,
  letGo: null,
  ...o,
});

describe('takeaway lines', () => {
  it('say how each car came out, from its own numbers', () => {
    const rr = car({
      code: 'RR',
      model: '911 Turbo',
      spun: true,
      verdict: 'spin',
      letGo: { axle: 'rear', g: 0.943 },
    });
    expect(carLine('lift-off', rr)).toBe('rears let go at 0.94 g, spun');
    const fr = car({ code: 'FR', verdict: 'tight', values: { lineChange: 18.6 } });
    expect(carLine('lift-off', fr)).toBe('tucked in 19% tighter');
    expect(carLine('trail-brake', fr)).toBe('turned in 19% tighter');
    const ff = car({
      code: 'FF',
      verdict: 'wide',
      values: { lineChange: -27.9 },
      letGo: { axle: 'front', g: 0.77 },
    });
    expect(carLine('power-exit', ff)).toBe('fronts let go at 0.77 g, ran wide (line −28%)');
    const stop = car({ code: 'MR', front: 0.445, frontMax: 0.64, values: { stopDist: 38.75 } });
    expect(carLine('braking', stop)).toBe('stopped in 38.8 m, front load 45% → 64%');
    expect(carLine('lane-change', car({ code: 'RR', values: { yawLag: 95.4 } }))).toBe(
      'turned 95 ms after the wheel',
    );
    const caught = car({
      code: 'RR',
      verdict: 'caught',
      values: { maxSlip: 5.2, counterDeg: 7.8 },
    });
    expect(carLine('catch', caught)).toBe('slid 5°, caught with 8° of opposite lock');
    expect(carLine('catch', car({ code: 'FF', verdict: 'no-slide' }))).toBe('never slid');
  });

  it('name cars by model, without the make or generation', () => {
    expect(modelName('BMW M340i (G20)')).toBe('M340i');
    expect(modelName('Porsche 718 Boxster T')).toBe('718 Boxster T');
    expect(modelName('Alfa Romeo 4C (Type 960)')).toBe('4C');
  });
});

describe('rank correlation', () => {
  it('is ±1 for a monotonic pattern, shares ranks between ties, and needs three cars', () => {
    expect(rankCorr([1, 2, 3, 4], [10, 20, 25, 90])).toBeCloseTo(1);
    expect(rankCorr([1, 2, 3, 4], [9, 7, 5, 1])).toBeCloseTo(-1);
    expect(rankCorr([1, 1, 2], [3, 3, 5])).toBeCloseTo(1);
    expect(rankCorr([1, 2], [1, 2])).toBeNaN();
  });
});

describe('lessons follow the results, not folklore', () => {
  const nose = (code: string, front: number, o: Partial<Outcome> = {}) =>
    car({ code, front, ...o });

  it('lift-off: the tail-heavy cars that let go are named when weight sorts them', () => {
    const cars = [
      nose('FR', 0.5, { verdict: 'tight' }),
      nose('FF', 0.62, { verdict: 'tight' }),
      nose('MR', 0.45, { verdict: 'spin', spun: true }),
      nose('RR', 0.39, { verdict: 'spin', spun: true }),
    ];
    expect(lesson('lift-off', cars)).toBe(
      'Lifting moves load off the rears: the tail-heavier MR and RR spun, the nose-heavier cars tucked in.',
    );
  });

  it('lift-off: says so when the weight split does not explain who let go', () => {
    const cars = [
      nose('FF', 0.62, { verdict: 'tail' }),
      nose('RR', 0.39, { verdict: 'tight' }),
      nose('FR', 0.5, { verdict: 'tight' }),
    ];
    expect(lesson('lift-off', cars)).toMatch(
      /FF stepped out, RR and FR held on; weight split alone/,
    );
    const calm = [nose('FF', 0.62, { verdict: 'tight' }), nose('RR', 0.39, { verdict: 'tight' })];
    expect(lesson('lift-off', calm)).toMatch(/every car tucked its nose in; no rear let go/);
  });

  it('trail braking: states the direction the cars actually show', () => {
    const tailHeavyMost = [
      nose('FF', 0.62, { values: { lineChange: 19 } }),
      nose('FR', 0.5, { values: { lineChange: 24 } }),
      nose('MR', 0.45, { values: { lineChange: 64 } }),
      nose('RR', 0.39, { values: { lineChange: 89 } }),
    ];
    expect(lesson('trail-brake', tailHeavyMost)).toBe(
      'Braking moves load onto the fronts and off the rears: the more weight at the back, the more it turned in (RR +89%, FF +19%).',
    );
    const noseHeavyMost = tailHeavyMost.map((o) => ({
      ...o,
      values: { lineChange: 100 - (o.values.lineChange ?? 0) },
    }));
    expect(lesson('trail-brake', noseHeavyMost)).toMatch(/the more weight on the nose, the more/);
    const mixed = [
      nose('FF', 0.62, { values: { lineChange: 40 } }),
      nose('FR', 0.5, { values: { lineChange: 10 } }),
      nose('RR', 0.39, { values: { lineChange: 35 } }),
    ];
    expect(lesson('trail-brake', mixed)).toMatch(
      /: FF turned in most \(\+40%\), FR least \(\+10%\)\.$/,
    );
    // a car that went round is said to have spun, not to have turned in by hundreds of percent
    const spun = [
      ...tailHeavyMost.slice(0, 3),
      nose('RR', 0.39, { spun: true, values: { lineChange: 554 } }),
    ];
    expect(lesson('trail-brake', spun)).toMatch(/\(RR spun, FF \+19%\)\.$/);
  });

  it('skidpad: the cause when every front lets go first, the heavier end when they split', () => {
    const fronts = [0.88, 0.93, 0.98].map((g, i) =>
      nose(['FF', 'FR', 'RR'][i], 0.6 - 0.1 * i, {
        letGo: { axle: 'front', g },
        rollF: 0.7 - 0.1 * i,
      }),
    );
    expect(lesson('skidpad', fronts)).toBe(
      "Every car's fronts let go first (0.88–0.98 g): road cars put more of the cornering load shift on the front tyres.",
    );
    const split = [
      nose('FF', 0.62, { letGo: { axle: 'front', g: 0.88 } }),
      nose('RR', 0.39, { letGo: { axle: 'rear', g: 0.95 } }),
    ];
    expect(lesson('skidpad', split)).toBe(
      'Fronts let go first on FF, rears on RR: the heavier end runs out of grip first.',
    );
  });

  it('power out: sorts by driven wheels only when every car fits', () => {
    const cars = [
      car({ code: 'FR', driven: 'rear', verdict: 'spin', spun: true }),
      car({ code: 'FF', driven: 'front', verdict: 'wide' }),
      car({ code: 'MR', driven: 'rear', verdict: 'tail' }),
      car({ code: 'F-AWD', driven: 'all', verdict: 'wide' }),
    ];
    expect(lesson('power-exit', cars)).toBe(
      'The throttle asks the driven tyres for drive on top of cornering: the rear-driven FR and MR stepped out, FF and F-AWD ran wide.',
    );
    cars[1] = { ...cars[1], verdict: 'tail' };
    expect(lesson('power-exit', cars)).toMatch(/: FR, FF and MR stepped out, F-AWD ran wide\.$/);
  });

  it('braking: claims no layout pattern the stops do not show', () => {
    const cars = [
      nose('FR', 0.5, { frontMax: 0.67, values: { stopDist: 42.25 } }),
      nose('FF', 0.62, { values: { stopDist: 41.42 } }),
      nose('MR', 0.45, { values: { stopDist: 38.75 } }),
      nose('RR', 0.39, { values: { stopDist: 40.75 } }),
    ];
    expect(lesson('braking', cars)).toMatch(
      /^Braking moves load onto the fronts \(50% → 67% on the FR\), so they do most of the stopping; stops ran 38\.8–42\.3 m, in no order of weight split\.$/,
    );
  });

  it('two cars of one layout are told apart by model', () => {
    const cars = [
      car({ code: 'MR', model: '718', verdict: 'spin', spun: true, front: 0.44 }),
      car({ code: 'MR', model: 'F8', verdict: 'tight', front: 0.42 }),
    ];
    expect(lesson('lift-off', cars)).toMatch(/MR 718 spun, MR F8 held on/);
  });

  it('with and without the technique: what it changed on the one car', () => {
    const on = car({ code: 'FR', model: 'M340i', verdict: 'tight', values: { lineChange: 19 } });
    const off = car({
      code: 'FR',
      model: 'M340i',
      label: 'No lift',
      verdict: 'neutral',
      values: { lineChange: 1 },
    });
    expect(lesson('lift-off', [on, off], true)).toBe(
      'Lifting moves load onto the fronts and off the rears. With it: tucked in 19% tighter; without: held its line (+1%).',
    );
    const still = car({ code: 'FR', model: 'M340i', verdict: 'no-slide' });
    expect(lesson('catch', [still, { ...still, label: 'No catch' }], true)).toBe(
      'Opposite lock points the fronts where the car is going; at this speed the M340i never slid either way.',
    );
  });
});

describe('real runs (the M340i against the other layouts)', () => {
  const runAll = (id: ScenarioId) => {
    const def = SCENARIOS[id];
    const lineup = buildLineup(
      getVehicle('bmw-m340i-g20'),
      { scenario: id, ghosts: null, compare: 'layouts' },
      def.speed.def,
    );
    const lanes = lineup.map((e) => {
      const l = new Lane(e.params, e.plan, false, e.info);
      l.simTo(e.plan.duration + 1);
      return l;
    });
    return { def, lanes, cars: lanes.map((l) => laneResult(l).outcome!) };
  };

  it('every scenario writes a lesson and a line per car', () => {
    for (const id of Object.keys(SCENARIOS) as ScenarioId[]) {
      const { cars } = runAll(id);
      const text = lesson(id, cars);
      expect(text.length).toBeGreaterThan(30);
      expect(text.length).toBeLessThan(180);
      for (const o of cars) expect(carLine(id, o)).not.toMatch(/NaN|undefined/);
    }
  });

  it('lift-off: the mid- and rear-engined cars let go; the lesson says why', () => {
    const { cars } = runAll('lift-off');
    expect(lesson('lift-off', cars)).toMatch(/off the rears: the tail-heavier MR and RR/);
  });

  it('the key moment: slowed round the lift, rings on the rear axles that let go', () => {
    const { def, lanes } = runAll('lift-off');
    const key = findKey(def, lanes)!;
    expect(key.label).toBe('Lift');
    expect(key.t0).toBeLessThan(key.t);
    expect(key.t1 - key.t0).toBeLessThanOrEqual(def.key.before + def.key.after + 1 + 1e-9);
    const rr = lanes.find((l) => l.info.code === 'RR')!;
    expect(rr.watch?.axle).toBe('rear');
    expect(rr.watch!.t0).toBeLessThan(rr.letGo!.t);
    // the visitor's car always gets something to watch
    expect(lanes[0].watch).not.toBeNull();
    expect(autoRate(key, (key.t0 + key.t1) / 2)).toBeCloseTo(KEY_RATE);
    expect(autoRate(key, key.t0 - 2)).toBe(1);
    expect(autoRate(null, 3)).toBe(1);
  });

  it('the key moment of a stop rings the front axle, where the load goes', () => {
    const { def, lanes } = runAll('braking');
    findKey(def, lanes);
    expect(lanes[0].watch?.axle).toBe('front');
  });

  it('the skidpad pins the moment the first axle lets go', () => {
    const { def, lanes } = runAll('skidpad');
    const key = findKey(def, lanes)!;
    expect(key.label).toBe('Front lets go');
    expect(key.t).toBeCloseTo(lanes[0].letGo!.t);
  });
});
