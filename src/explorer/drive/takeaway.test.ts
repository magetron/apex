import { describe, expect, it } from 'vitest';
import { betaOf, createState } from '../../sim/model';
import { HUB_ORDER, SCENARIOS, type ScenarioId } from '../../sim/scenarios';
import { getVehicle } from '../../spec/catalog';
import { causeText, freezeAngle, freezeFrame, stateText } from './freeze';
import { autoRate, findKey, KEY_RATE } from './key';
import { laneEventTime } from './lanes';
import { buildLineup, laneOf, laneResult, layoutRow } from './lineup';
import { buildPicture, REPLAY_FIRST } from './picture';
import { pairLanes } from './twin';
import { familyOf } from './state';
import {
  carLine,
  carNumber,
  lesson,
  lineOff,
  modelName,
  PICTURED,
  rankCorr,
  rankOf,
  summaryLines,
  type Outcome,
} from './takeaway';
import type { CompareKind } from './versus';

/** A made-up car: only what a lesson reads. */
const car = (o: Partial<Outcome> & Pick<Outcome, 'code'>): Outcome => ({
  model: o.code,
  driven: 'rear',
  front: 0.5,
  frontMax: 0.5,
  rollF: 0.6,
  dynIndex: 0.9,
  cgOverL: 0.18,
  widerRear: false,
  tyreF: 245,
  tyreR: 245,
  rearGrip: 1,
  values: {},
  verdict: null,
  spun: false,
  letGo: null,
  ...o,
});

/** A cause line: no grip percentages, no arrows, no formula (those are behind "Why?"). */
const PLAIN_CAUSE = /^[^→·]*$/;

/** No layout codes, no units to look up, nothing unfinished (a model may be called "AWD"). */
const PLAIN = /\b(FF|FR|MR|RR|F-AWD)\b|°\/s|line [−+-]\d|% of grip|NaN|undefined|…/;

describe('takeaway lines', () => {
  it('say how each car came out, from its own numbers, in plain words', () => {
    const rr = car({
      code: 'RR',
      model: '911 Turbo',
      spun: true,
      verdict: 'spin',
      letGo: { axle: 'rear', g: 0.943 },
    });
    expect(carLine('lift-off', rr)).toBe('rear tyres let go, spun');
    // the line, in metres across the ground: where it ended against where the driver aimed
    const fr = car({ code: 'FR', verdict: 'tight', values: { lineChange: 18.6, exitErr: 1.27 } });
    expect(carLine('lift-off', fr)).toBe('turned tighter, 1.3 m inside where the driver aimed');
    // braking in a turn: against the same car at the same speed without the brake
    const tb = car({
      code: 'FR',
      verdict: 'tight',
      values: { lineChange: 30, sameSpeedTighter: 21.4, exitErr: 0.83, sameSpeedShift: 0.74 },
    });
    expect(carLine('trail-brake', tb)).toBe(
      'turned 0.7 m tighter than the same car at the same speed without brake',
    );
    const ff = car({
      code: 'FF',
      verdict: 'wide',
      values: { lineChange: -27.9, exitErr: -0.74 },
      letGo: { axle: 'front', g: 0.77 },
    });
    expect(carLine('power-exit', ff)).toBe(
      'front pushed: ran 0.7 m wide of where the driver aimed, nose along its path',
    );
    // power out leads with rotation: a rear sliding out turns the nose in from the path
    const rr2 = car({ code: 'RR', verdict: 'tail', values: { exitSwing: 5.7, exitErr: -0.5 } });
    expect(carLine('power-exit', rr2)).toBe('rear slid out: nose 6° inside its path');
    // a slide that didn't spin is said as one: slid (then gripped again), never "let go"
    expect(carLine('lift-off', ff)).toBe(
      'front tyres slid, ran 0.7 m wide of where the driver aimed',
    );
    // one meaning per phrase: the technique barely changing the line, against car B's normal one
    const same = car({ code: 'FF', verdict: 'neutral', values: { sameSpeedShift: 0.13 } });
    expect(carLine('trail-brake', same)).toBe('braking barely changed its line');
    expect(carLine('trail-brake', same, { twin: true })).toBe('no brake: normal line');
    const stop = car({ code: 'MR', front: 0.445, frontMax: 0.64, values: { stopDist: 38.75 } });
    // the load at rest (the layout chip's) to braking; no stopping distance: the spec's tyre grip
    // is too rough a figure to say how far a real car stops
    expect(carLine('braking', stop)).toBe('front load 45% at rest → 64% braking');
    // timed the standard way: step steer, to 90% of the turn rate it settles at
    expect(carLine('lane-change', car({ code: 'RR', values: { yawResponse: 198.2 } }))).toBe(
      'reached 90% of its turn rate 0.20 s after the wheel',
    );
    const caught = car({
      code: 'RR',
      verdict: 'caught',
      values: { maxSlip: 5.2, maxSwing: 6.4, counterDeg: 7.8 },
    });
    // "swung", as the freeze frame's angle: where it points against where it goes
    expect(carLine('catch', caught)).toBe('swung out 6° at most, caught with 8° of opposite lock');
    expect(carLine('catch', car({ code: 'FF', verdict: 'no-slide' }))).toBe('never slid');
    const pad = car({ code: 'FR', letGo: { axle: 'front', g: 0.918 } });
    expect(carLine('skidpad', pad)).toBe('front tyres let go first, at 0.92 g');
    for (const line of [carLine('lift-off', rr), carLine('power-exit', ff)])
      expect(line).not.toMatch(PLAIN);
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
  const nose = (code: string, model: string, front: number, o: Partial<Outcome> = {}) =>
    car({ code, model, front, ...o });

  it('lift-off: the tail-heavier car that let go is named when weight sorts them', () => {
    const cars = [
      nose('RR', '911', 0.39, { verdict: 'spin', spun: true }),
      nose('FF', 'Golf GTI', 0.62, { verdict: 'tight', driven: 'front' }),
    ];
    // two causes, both named: the load the lift moves, and engine braking on the driven tyres
    expect(lesson('lift-off', cars)).toBe(
      "It depends on the car: the 911's rear slid out and it spun; the Golf GTI turned tighter. Lifting takes load off the rear tyres, and engine braking pulls on the driven ones: on a rear-heavy, rear-drive car, both at the rear. Front-drive cars aren’t immune nearer the limit.",
    );
    // the weight split said as numbers, never as a line at 50%
    const split = [
      nose('RR', '911', 0.39, { verdict: 'spin', spun: true }),
      nose('FR', 'GT-R', 0.53, { verdict: 'tight' }),
    ];
    // the same verdict whichever car B is, never "rear-drive = spin", never a line at 50%
    expect(lesson('lift-off', split)).toMatch(
      /^It depends on the car: the 911's rear slid out and it spun; the GT-R turned tighter\./,
    );
    expect(lesson('lift-off', split)).not.toMatch(/nose-heavy|tail-heavy/);
    const odd = [
      nose('FF', 'Golf GTI', 0.62, { verdict: 'tail' }),
      nose('RR', '911', 0.39, { verdict: 'tight' }),
    ];
    expect(lesson('lift-off', odd)).toMatch(/the golf gti|the Golf GTI/);
    // each car's own outcome, whatever the pair: no claim about its layout it can't back
    expect(lesson('lift-off', odd)).toMatch(
      /^It depends on the car: the Golf GTI's rear slid out; the 911 turned tighter\./,
    );
    const calm = [
      nose('FF', 'A', 0.62, { verdict: 'tight' }),
      nose('RR', 'B', 0.39, { verdict: 'tight' }),
    ];
    // a pair that shows nothing says so, and what to change
    expect(lesson('lift-off', calm)).toBe(
      'Neither rear slid out at this speed, both turned tighter: raise the speed or pick a rear-engined car. Lifting takes load off the rear tyres, and engine braking pulls on the driven ones: on a rear-heavy, rear-drive car, both at the rear. Front-drive cars aren’t immune nearer the limit.',
    );
    const slid = [
      nose('RR', 'A', 0.39, { verdict: 'spin', spun: true }),
      nose('MR', 'B', 0.42, { verdict: 'tail' }),
    ];
    expect(lesson('lift-off', slid)).toMatch(
      /pick a car with less weight at the back to see one hold on\./,
    );
    expect(
      lesson('catch', [
        car({ code: 'FF', verdict: 'no-slide' }),
        car({ code: 'FR', verdict: 'no-slide' }),
      ]),
    ).toBe(
      'Not tested: neither car slid at this speed: raise the speed or pick a rear-engined car. Opposite lock points the front tyres where the car is going.',
    );
  });

  it('with and without the technique: what it changed on the one car', () => {
    const on = car({
      code: 'FR',
      model: 'M340i',
      verdict: 'tight',
      values: { lineChange: 19, exitErr: 1.6 },
    });
    const off = car({
      code: 'FR',
      model: 'M340i',
      label: 'No lift',
      verdict: 'neutral',
      values: { lineChange: 1 },
    });
    expect(lesson('lift-off', [on, off], true)).toBe(
      // each car's own result is on its row: the lesson is the cause
      'It turns tighter: lifting took the M340i 1.6 m inside where the driver aimed. Lifting takes load off the rear tyres, and engine braking pulls on the driven ones: on a rear-heavy, rear-drive car, both at the rear. Front-drive cars aren’t immune nearer the limit.',
    );
    const still = car({ code: 'FR', model: 'M340i', verdict: 'no-slide' });
    expect(lesson('catch', [still, { ...still, label: 'No catch' }], true)).toBe(
      'Not tested: the M340i never slid at this speed: raise the speed or pick a rear-engined car. Opposite lock points the front tyres where the car is going.',
    );
  });

  it('every layout ranks by what it did: a spin above a tail out above a tighter line', () => {
    const spin = car({ code: 'RR', spun: true, verdict: 'spin' });
    const tail = car({ code: 'MR', verdict: 'tail', values: { slipChange: 9 } });
    const tight = car({ code: 'FR', verdict: 'tight', values: { lineChange: 19 } });
    const wide = car({ code: 'FF', verdict: 'wide', values: { lineChange: -27 } });
    const order = [wide, tight, spin, tail]
      .map((o) => ({ o, r: rankOf('lift-off', o) }))
      .sort((a, b) => b.r - a.r)
      .map((x) => x.o.code);
    expect(order).toEqual(['RR', 'MR', 'FR', 'FF']);
  });

  it('power out: names where the weight sits and which wheels drive, as the two cars differ', () => {
    const why =
      'The throttle asks the driven tyres for drive on top of cornering, and moves load off the front tyres onto the rear ones.';
    const fr = car({
      code: 'FR',
      model: 'M3',
      driven: 'rear',
      front: 0.51,
      verdict: 'tail',
      values: { exitSwing: 4.2 },
    });
    const rr = car({
      code: 'RR',
      model: '911',
      driven: 'rear',
      front: 0.39,
      verdict: 'wide',
      values: { exitErr: -0.7, exitSwing: 0.5 },
    });
    const ff = car({
      code: 'FF',
      model: 'Golf GTI',
      driven: 'front',
      front: 0.61,
      verdict: 'wide',
      values: { exitErr: -0.8, exitSwing: -0.5 },
    });
    // both driven at the rear: where the weight sits decides it (a light nose runs wide)
    expect(lesson('power-exit', [rr, fr])).toBe(
      `It depends on where the weight sits: the rear-drive M3, with 51% of its weight on the front, slid its rear out; the rear-drive 911, with 39% on the front, pushed its front 0.7 m wide. ${why}`,
    );
    // differing in both
    expect(lesson('power-exit', [fr, ff])).toMatch(
      /^It depends on where the weight sits and which wheels drive: the rear-drive M3.*slid its rear out; the front-drive Golf GTI, with 61% on the front, pushed its front 0\.8 m wide\./,
    );
    // the same split, different drive
    expect(lesson('power-exit', [fr, { ...ff, front: 0.52 }])).toMatch(
      /^It depends on which wheels drive:/,
    );
  });

  it('catch: a car that never slid is said to need no catch, against one that did', () => {
    const cars = [
      car({ code: 'FF', model: 'Golf GTI', verdict: 'no-slide' }),
      car({ code: 'RR', model: '911', verdict: 'caught', values: { counterDeg: 7.6 } }),
    ];
    expect(lesson('catch', cars)).toBe(
      'Yes, when it slides: the Golf GTI never slid at this speed; the 911 did, and 8° of opposite lock caught it. Opposite lock points the front tyres where the car is going.',
    );
  });

  it('push wide: the set-up that keeps grip in hand at the back, shown by taking it away', () => {
    const built = car({
      code: 'RR',
      model: '911',
      front: 0.39,
      rollF: 0.44,
      widerRear: true,
      tyreF: 245,
      tyreR: 305,
      letGo: { axle: 'front', g: 0.98 },
    });
    const less = {
      ...built,
      label: '20% less rear grip',
      rearGrip: 0.8,
      letGo: { axle: 'rear' as const, g: 0.86 },
      spun: true,
    };
    expect(lesson('skidpad', [built, less])).toBe(
      "Because they're set up to: the 911's front tyres take a bigger share of the load moved across in a turn (44%) than of its weight (39%), and they go first; easing off gently brings it back (an abrupt lift can swing the rear, as in the lift-off question). With 20% less rear grip the rear tyres went first: that needs quick opposite lock.",
    );
    // and claims no tyres it can't see; never that the front carries more of the load when the
    // weight sits at the back
    const plain = { ...built, rollF: 0.39, widerRear: false, tyreR: 245 };
    const text = lesson('skidpad', [plain, { ...less, rollF: 0.39, widerRear: false }]);
    expect(text).not.toMatch(/mm/);
    expect(text).not.toMatch(/load on the front/);
    expect(text).toMatch(/than of its weight \(39%\)/);
    // and never reasons from tyre width: grip is μ times load
    expect(lesson('skidpad', [built, less])).not.toMatch(/mm/);
  });

  it('nose dive: the weight moving forward, and why more for one car only when it fits', () => {
    const low = car({ code: 'RR', model: '911', front: 0.39, frontMax: 0.58, cgOverL: 0.19 });
    const tall = car({ code: 'RR', model: 'ForTwo', front: 0.39, frontMax: 0.67, cgOverL: 0.28 });
    expect(lesson('braking', [low, tall])).toBe(
      'Onto the front tyres, more on the ForTwo: its CG sits higher for its wheelbase. Load moved = weight × braking × CG height ÷ wheelbase; the springs don’t change it, but they decide how far it dips the nose.',
    );
    const odd = { ...tall, cgOverL: 0.15 };
    expect(lesson('braking', [low, odd])).not.toMatch(/the higher the weight/);
  });

  it('trail braking: names how much each car turned in', () => {
    const cars = [
      car({
        code: 'RR',
        model: '911',
        front: 0.39,
        verdict: 'tight',
        values: { lineChange: 51, sameSpeedTighter: 43, sameSpeedShift: 0.74 },
      }),
      car({
        code: 'FF',
        model: 'Golf GTI',
        front: 0.62,
        verdict: 'neutral',
        values: { lineChange: 19, sameSpeedTighter: 4, sameSpeedShift: 0.13 },
      }),
    ];
    // the speed drop taken out: the numbers are against the same car at the same speed
    expect(lesson('trail-brake', cars)).toBe(
      'Yes, the 911 most: it turned in more than the Golf GTI. Braking moves load onto the front tyres and off the rear ones.',
    );
    // a pair where neither turns in says so, and what would show it
    const held = cars.map((o) => ({ ...o, verdict: 'neutral' as const }));
    expect(lesson('trail-brake', held)).toBe(
      'Hardly, at this speed: neither car turned in: raise the speed or pick a car with more weight at the back. Braking moves load onto the front tyres and off the rear ones.',
    );
  });
});

describe('real runs (each car against the comparison chosen for it)', () => {
  const st = createState();
  const runAll = (vehicle: string, id: ScenarioId, compare: CompareKind = 'auto') => {
    const def = SCENARIOS[id];
    const lineup = buildLineup(getVehicle(vehicle), { scenario: id, compare }, def.speed.def);
    const lanes = lineup.map((e) => {
      const l = laneOf(e);
      l.simTo(e.plan.duration + 1);
      return l;
    });
    // as the scene does: braking into a turn, car B at car A's speed
    pairLanes(lanes);
    const cars = lanes.map((l, i) => laneResult(l, lineup[i].asBuilt).outcome!);
    return { def, lanes, cars, twin: lineup[1].info.rival === 'without' };
  };

  it('every question writes a plain lesson and a line per car', () => {
    for (const v of ['porsche-911-992', 'vw-golf-gti-mk8', 'bmw-m340i-g20']) {
      for (const id of HUB_ORDER) {
        const { cars, twin } = runAll(v, id);
        const text = lesson(id, cars, twin);
        expect(text.length, `${v} ${id}`).toBeGreaterThan(30);
        expect(text.length, `${v} ${id}: ${text}`).toBeLessThan(id === 'skidpad' ? 400 : 360);
        // the question answered first: the cause comes after
        expect(text, `${v} ${id}`).toMatch(
          /^(Yes|No|Not|It |Its |Hardly|Neither|Both|Onto|Because|Only|The .* was quicker|About|In |To |Most|Too|They)/,
        );
        expect(text, `${v} ${id}`).not.toMatch(PLAIN);
        for (const o of cars) expect(carLine(id, o)).not.toMatch(PLAIN);
      }
    }
  });

  it('lift-off: the 911 spins, the nose-heavy car beside it tucks in; the lesson says why', () => {
    const { cars } = runAll('porsche-911-992', 'lift-off');
    expect(lesson('lift-off', cars)).toMatch(
      /^It depends on the car: the 911.*rear slid out.*; the John Cooper Works GP turned tighter\. Lifting takes load off the rear tyres, and engine braking pulls on the driven ones/,
    );
  });

  it('push wide: as built the front lets go first, with less rear grip the rear', () => {
    const { cars } = runAll('porsche-911-992', 'skidpad');
    expect(cars[0].letGo?.axle).toBe('front');
    expect(cars[1].letGo?.axle).toBe('rear');
    expect(lesson('skidpad', cars)).toMatch(
      /^Because they're set up to: .*bigger share of the load moved across in a turn.*easing off gently brings it back.*quick opposite lock/,
    );
  });

  it('the key moment: slowed round the lift, stopped once the 911’s rear has visibly gone', () => {
    const { def, lanes } = runAll('porsche-911-992', 'lift-off');
    const key = findKey(def, lanes)!;
    expect(key.label).toBe('Lift');
    expect(key.t0).toBeLessThan(key.t);
    expect(autoRate(key, (key.t0 + key.t1) / 2)).toBeCloseTo(KEY_RATE);
    expect(autoRate(key, key.t0 - 2)).toBe(1);
    expect(autoRate(null, 3)).toBe(1);
    expect(key.freeze).toHaveLength(1);
    const f = key.freeze[0];
    const lg = lanes[0].letGo!;
    expect(lg.axle).toBe('rear');
    expect(f).toBeGreaterThan(lg.t);
    // a little after the let-go, once the body has swung 4° from where it goes (or 0.4 s on)
    expect(f).toBeLessThanOrEqual(lg.t + 0.4 + 1e-9);
    lanes[0].rec.sample(f, st);
    const swung = Math.abs(betaOf(st)) * (180 / Math.PI);
    expect(swung >= 4 - 0.2 || f >= lg.t + 0.4 - 1e-6).toBe(true);
    expect(st.spun).toBe(false);
    const frame = freezeFrame('lift-off', lanes, key, f);
    const [p911, other] = frame.cars;
    expect(p911.verdict).toBe('rear');
    expect(p911.out).toBe('rear');
    expect(p911.pointsDeg).toBeGreaterThan(3.5);
    expect(['tighter', 'holding']).toContain(other.verdict);
    expect(other.out).toBeNull();
    // the cause: the 911's rear went from part of its grip to all of it; the other car's rear
    // kept grip in hand, though the load went forward on both
    expect(p911.useR0).toBeLessThan(0.95);
    expect(p911.useR).toBeGreaterThan(0.97);
    expect(p911.useR - p911.useR0).toBeGreaterThan(other.useR - other.useR0);
    expect(other.useR).toBeLessThan(0.9);
    for (const c of frame.cars) expect(c.frontNow).toBeGreaterThan(c.frontBefore);
  });

  it('catch: frozen at the catch itself, where the opposite lock peaks, beside the twin', () => {
    const { def, lanes } = runAll('porsche-911-992', 'catch', 'without');
    const key = findKey(def, lanes)!;
    const t = key.freeze[0];
    const frame = freezeFrame('catch', lanes, key, t);
    expect(frame.label).toBe('Slide');
    const [catching, slid] = frame.cars;
    expect(catching.verdict).toBe('catching');
    expect(slid.verdict).toBe('rear');
    // the stop is the peak of the driver's opposite lock
    expect(catching.lockMaxDeg).toBeGreaterThan(2);
    expect(-catching.steerDeg * catching.turnSign).toBeGreaterThan(0.8 * catching.lockMaxDeg);
    // the cards differ where the cars do: one steered out of the turn, one held into it
    expect(slid.lockMaxDeg).toBeLessThan(0.5);
    expect(slid.steerDeg * slid.turnSign).toBeGreaterThan(0);
    // and later the catch works and the twin keeps sliding
    const later = freezeFrame('catch', lanes, key, t + 0.8);
    expect(later.cars[1].pointsDeg).toBeGreaterThan(later.cars[0].pointsDeg + 5);
  });

  it('the freeze and the summary say the same about the line, whatever car B is', () => {
    const line = { tighter: 'tight', wider: 'wide', holding: 'neutral' } as const;
    const bs = [
      'ford-mustang-gt350-1965',
      'mini-jcw-gp-f56',
      'mazda-mx5-nd',
      'bmw-m3-e30',
      'vw-golf-gti-mk8',
    ];
    for (const id of ['trail-brake', 'lift-off', 'left-foot'] as const) {
      const def = SCENARIOS[id];
      for (const b of bs) {
        const lineup = buildLineup(
          getVehicle('porsche-911-992'),
          { scenario: id, compare: 'car' },
          def.speed.def,
          getVehicle(b),
        );
        const lanes = lineup.map((e) => {
          const l = laneOf(e);
          l.simTo(e.plan.duration + 1);
          return l;
        });
        const key = findKey(def, lanes)!;
        const frame = freezeFrame(id, lanes, key, key.freeze[0], key.labels[0]);
        frame.cars.forEach((c, i) => {
          if (!(c.verdict in line)) return;
          const o = laneResult(lanes[i]).outcome!;
          if (o.spun || o.verdict === 'tail' || o.verdict === 'spin') return;
          expect(o.verdict, `${id} B=${b} car ${i}: ${c.verdict}`).toBe(
            line[c.verdict as keyof typeof line],
          );
        });
      }
    }
  });

  it('a stop’s weight shift is the same number on the card and in the summary', () => {
    const { def, lanes } = runAll('porsche-911-992', 'braking');
    const key = findKey(def, lanes)!;
    const frame = freezeFrame('braking', lanes, key, key.freeze[0]);
    lanes.forEach((l, i) => {
      const o = laneResult(l).outcome!;
      // from the share at rest, the layout chip's, on both
      expect(Math.round(100 * frame.cars[i].frontBefore)).toBe(Math.round(100 * o.front));
      expect(Math.round(100 * frame.cars[i].frontNow)).toBe(Math.round(100 * o.frontMax));
    });
  });

  it('the freeze card says one angle, the one its drawing shows', () => {
    for (const id of ['lift-off', 'power-exit', 'catch', 'trail-brake', 'skidpad'] as const) {
      const { def, lanes } = runAll('porsche-911-992', id);
      const key = findKey(def, lanes)!;
      key.freeze.forEach((t, k) => {
        for (const c of freezeFrame(id, lanes, key, t, key.labels[k]).cars) {
          const { head, angle } = stateText(c);
          const shown = [head, angle].join(' ').match(/(\d+)°/g) ?? [];
          // at most one angle, and it is the icon's
          expect(shown.length, `${id} ${c.label}`).toBeLessThanOrEqual(1);
          if (shown.length) expect(shown[0]).toBe(`${freezeAngle(c)}°`);
          // no percentage at all: the run's own numbers are in the summary at the end
          expect(head + angle).not.toMatch(/%/);
        }
      });
    }
  });

  it('the cause beside each car is said the same way for both, from its own numbers', () => {
    for (const v of ['porsche-911-992', 'vw-golf-gti-mk8']) {
      for (const id of ['lift-off', 'power-exit', 'trail-brake', 'left-foot', 'skidpad'] as const) {
        const { def, lanes } = runAll(v, id);
        const key = findKey(def, lanes)!;
        const frame = freezeFrame(id, lanes, key, key.freeze[0], key.labels[0]);
        for (const c of frame.cars) {
          const text = causeText(c);
          const what = `${v} ${id} ${c.label}: ${text}`;
          expect(text, what).toBeTruthy();
          expect(text, what).toMatch(PLAIN_CAUSE);
          // one measure for every car, the card's own: the share of its weight moved
          const m = text.match(/(\d+)% of its weight/);
          if (m && !c.twin)
            expect(Number(m[1]), what).toBe(Math.round(100 * Math.abs(c.frontNow - c.frontBefore)));
          // a lift that slid a rear-driven car's rear names both causes
          if (
            id === 'lift-off' &&
            !c.twin &&
            c.driven === 'rear' &&
            /^(Rear|Spun)/.test(stateText(c).head)
          )
            expect(text, what).toMatch(/off the rear tyres, and engine braking pulls on them/);
        }
      }
    }
  });

  it('the weight moves the way the driver’s action moves it: forward lifting or braking, back on the throttle', () => {
    const forward: ScenarioId[] = ['lift-off', 'catch', 'trail-brake', 'left-foot', 'braking'];
    for (const v of ['porsche-911-992', 'vw-golf-gti-mk8', 'bmw-m340i-g20']) {
      for (const id of [...forward, 'power-exit' as const]) {
        const { def, lanes } = runAll(v, id);
        const key = findKey(def, lanes)!;
        const frame = freezeFrame(id, lanes, key, key.freeze[0], key.labels[0]);
        // car A always does the thing (car B may be car A without it)
        const a = frame.cars[0];
        const moved = a.frontNow - a.frontBefore;
        if (id === 'power-exit') expect(moved, `${v} ${id}`).toBeLessThan(-0.02);
        else expect(moved, `${v} ${id}`).toBeGreaterThan(0.004);
        // and any other car that does it too, the same way
        const b = frame.cars[1];
        if (lanes[1].info.rival !== 'without') {
          const mb = b.frontNow - b.frontBefore;
          if (id === 'power-exit') expect(mb, `${v} ${id} B`).toBeLessThan(-0.02);
          else expect(mb, `${v} ${id} B`).toBeGreaterThan(0.004);
        }
      }
    }
  });

  it('a number marked "let go" is always the end that held its limit, never a lower one', () => {
    for (const v of ['porsche-911-992', 'vw-golf-gti-mk8', 'bmw-m340i-g20']) {
      for (const id of ['lift-off', 'power-exit', 'catch', 'skidpad'] as const) {
        const { def, lanes } = runAll(v, id);
        const key = findKey(def, lanes)!;
        key.freeze.forEach((t, k) => {
          for (const c of freezeFrame(id, lanes, key, t, key.labels[k]).cars) {
            if (!c.out) {
              // nothing let go: no end held its limit for the let-go's window
              expect(Math.max(c.useF, c.useR), `${v} ${id}`).toBeLessThan(0.985);
              continue;
            }
            const [out, other] = c.out === 'front' ? [c.useF, c.useR] : [c.useR, c.useF];
            expect(out, `${v} ${id} ${c.label}`).toBeGreaterThanOrEqual(0.985);
            expect(Math.round(100 * out)).toBeGreaterThanOrEqual(Math.round(100 * other));
          }
        });
      }
    }
  });

  it('power out stops where it shows: the 911 pushed wide, the front-engined rear-driver stepped out', () => {
    // under power the 911's light nose runs out first, rear-driven as it is; a rear-driven car
    // with its engine at the front steps its rear out
    const { def, lanes } = runAll('porsche-911-992', 'power-exit');
    const key = findKey(def, lanes)!;
    const [p911, fr] = freezeFrame('power-exit', lanes, key, key.freeze[0]).cars;
    expect(stateText(p911).head).toBe('Front pushed wide');
    expect(stateText(fr).head).toBe('Rear slid out');
    expect(fr.frontRest!).toBeGreaterThan(p911.frontRest! + 0.05);
    // and the 911 well off its planned line, sideways, at the stop
    const i = lanes[0].rec.indexAt(key.freeze[0]);
    expect(Math.abs(lanes[0].rec.errAt(i))).toBeGreaterThan(0.4);
  });

  it('a car is "let go" (and ringed red) only once it shows: never beside "swung 0°"', () => {
    for (const v of ['porsche-911-992', 'vw-golf-gti-mk8', 'bmw-m340i-g20']) {
      for (const id of ['lift-off', 'power-exit', 'catch', 'skidpad'] as const) {
        const { def, lanes } = runAll(v, id);
        const key = findKey(def, lanes)!;
        key.freeze.forEach((t, k) => {
          for (const c of freezeFrame(id, lanes, key, t, key.labels[k]).cars)
            if (c.verdict === 'rear') expect(c.swungMaxDeg, `${v} ${id}`).toBeGreaterThanOrEqual(2);
        });
        // and the stretch both cars stay framed through reaches past every stop
        expect(key.end).toBeGreaterThan(Math.max(key.t1, ...key.freeze));
      }
    }
  });

  it('trail braking is measured at matched speed: slowing down alone doesn’t count', () => {
    const { cars } = runAll('porsche-911-992', 'trail-brake');
    const [braked, twin] = cars;
    const same = braked.values.sameSpeedTighter!;
    expect(same).toBeGreaterThan(10);
    // less than the raw change of line, part of which is just the lower speed
    expect(same).toBeLessThan(braked.values.lineChange!);
    // the same car without the brake, at its own speed, is its own reference
    expect(Math.abs(twin.values.sameSpeedTighter!)).toBeLessThan(3);
    expect(carLine('trail-brake', braked)).toMatch(
      /turned \d\.\d m tighter than the same car at the same speed without brake/,
    );
    // in metres too: inside its own matched-speed line, by less than inside its twin's (some of
    // that is only the slowing down)
    expect(braked.values.sameSpeedShift!).toBeGreaterThan(0.3);
    expect(braked.values.sameSpeedShift!).toBeLessThan(
      braked.values.exitErr! - twin.values.exitErr! + 0.05,
    );
  });

  it('one number per car, the same in its summary, the every-layout list and the picture', () => {
    for (const v of ['porsche-911-992', 'vw-golf-gti-mk8', 'bmw-m340i-g20']) {
      for (const id of HUB_ORDER) {
        for (const compare of ['auto', 'without'] as const) {
          const { def, lanes, cars, twin } = runAll(v, id, compare);
          const what = `${v} ${id} ${compare}`;
          const pic = buildPicture(id, lanes, findKey(def, lanes), cars, twin)!;
          expect(pic, what).not.toBeNull();
          const lines = summaryLines(id, cars, twin);
          pic.cars.forEach((c, i) => {
            const n = carNumber(id, cars[i]);
            // the picture labels each car with its number, and its summary line says it
            expect(c.label, what).toBe(n?.label ?? null);
            if (n) expect(lines[i], what).toContain(n.value);
            // and a line with no number never says a distance
            else if (PICTURED.includes(id)) expect(lines[i], what).not.toMatch(/\d\.\d m/);
          });
          // the corner questions: each dimension is drawn as long as its number (sideways ×n)
          for (const d of pic.dims) {
            const len = Math.hypot(d.a[0] - d.b[0], d.a[1] - d.b[1]);
            const m = id === 'braking' ? len : len / pic.n;
            const off = id === 'braking' ? cars[d.car].values.stopDist! : lineOff(id, cars[d.car])!;
            expect(Math.abs(m - Math.abs(off)), `${what}: drawn ${m} vs ${off}`).toBeLessThan(0.08);
          }
          // the every-layout list's row for car A's layout is car A, with car A's number
          const row = layoutRow(getVehicle(v), id, def.speed.def, familyOf(getVehicle(v)));
          const n0 = carNumber(id, cars[0]);
          if (row && n0 && compare === 'auto') expect(row.line, what).toContain(n0.value);
        }
      }
    }
  });

  it('every question ends on its picture, each after the same replay of its key moment', () => {
    for (const v of ['porsche-911-992', 'vw-golf-gti-mk8']) {
      for (const id of HUB_ORDER) {
        const { def, lanes, cars, twin } = runAll(v, id);
        const pic = buildPicture(id, lanes, findKey(def, lanes), cars, twin);
        expect(pic, `${v} ${id}`).not.toBeNull();
        // north-up: the stretch runs up the picture (the skidpad is a circle, either way)
        const [u0, v0] = pic!.cars[0].line;
        expect(Number.isFinite(u0), `${v} ${id}`).toBe(true);
        if (id !== 'skidpad') expect(pic!.cars[0].end.v, `${v} ${id}`).toBeGreaterThan(v0);
        // the picture so far, at the pause: both paths up to it, no numbers
        const key = findKey(def, lanes);
        const stop = key?.freeze[0];
        if (stop !== undefined && PICTURED.includes(id)) {
          const sofar = buildPicture(id, lanes, key, [], twin, stop);
          expect(sofar, `${v} ${id} so far`).not.toBeNull();
          expect(sofar!.cars.every((c) => c.label === null && c.key === null)).toBe(true);
          expect(sofar!.dims).toEqual([]);
        }
      }
    }
    expect([...REPLAY_FIRST].sort()).toEqual([...HUB_ORDER].sort());
  });

  it('the lesson ranks two cars only where their numbers differ, whatever car B is', () => {
    const bs = [
      'porsche-718-boxster-t-982',
      'ford-mustang-gt350-1965',
      'mini-jcw-gp-f56',
      'mazda-mx5-nd',
      'bmw-m3-e30',
      'vw-golf-gti-mk8',
    ];
    for (const id of ['trail-brake', 'left-foot'] as const) {
      const def = SCENARIOS[id];
      for (const b of bs) {
        const vb = getVehicle(b);
        const lineup = buildLineup(
          getVehicle('porsche-911-992'),
          { scenario: id, compare: 'car' },
          def.speed.def,
          vb,
        );
        const cars = lineup.map((e) => {
          const l = laneOf(e);
          l.simTo(e.plan.duration + 1);
          return laneResult(l).outcome!;
        });
        const text = lesson(id, cars);
        const shown = cars.map((o) => carNumber(id, o)?.value ?? '');
        // "X turned in more than Y" only when their rows show different numbers
        if (/turned in more than/.test(text))
          expect(shown[0], `${id} B=${b}: ${text}`).not.toBe(shown[1]);
        if (shown[0] && shown[0] === shown[1])
          expect(text, `${id} B=${b}`).not.toMatch(/more than/);
        // and the one it names as turning in more is the one whose number is bigger: named
        // before the other
        if (/turned in more than/.test(text)) {
          const most = cars.reduce((a, o) =>
            (lineOff(id, o) ?? -9) > (lineOff(id, a) ?? -9) ? o : a,
          );
          const least = cars.find((o) => o !== most)!;
          expect(text.indexOf(most.model), `${id} B=${b}: ${text}`).toBeLessThan(
            text.indexOf(`than the ${least.model}`) < 0
              ? text.indexOf(least.model)
              : text.indexOf(`than the ${least.model}`),
          );
        }
      }
    }
  });

  it('braking into a turn, car B is car A at the same speed without the brake, alongside it', () => {
    const { lanes, cars, twin } = runAll('porsche-911-992', 'trail-brake');
    expect(twin).toBe(true);
    const [a, b] = lanes;
    const te = laneEventTime(a);
    // it doesn't race ahead: through the held wheel, it is where car A is along the road
    for (let t = te; t <= te + 1.2; t += 0.1)
      expect(Math.abs(a.rec.sAtTime(t) - b.rec.sAtTime(t))).toBeLessThan(1);
    // the braked car's number is the gap between the two, as the picture draws it
    const gap = cars[0].values.exitErr! - cars[1].values.exitErr!;
    expect(Math.abs(gap - cars[0].values.sameSpeedShift!)).toBeLessThan(0.08);
    expect(lesson('trail-brake', cars, true)).toMatch(
      /^Yes: a light brake made the 911 .* turn \d\.\d m tighter than the same car at the same speed without it\./,
    );
  });

  it('nose dive: the weight moves forward on both cars', () => {
    const { def, lanes } = runAll('porsche-911-992', 'braking');
    const key = findKey(def, lanes)!;
    const frame = freezeFrame('braking', lanes, key, key.freeze[0]);
    for (const c of frame.cars) {
      expect(c.verdict).toBe('dive');
      expect(c.frontNow - c.frontBefore).toBeGreaterThan(0.1);
    }
  });

  it('push wide stops at each car’s limit; a lane change, where nothing lets go, never stops', () => {
    const pad = runAll('porsche-911-992', 'skidpad');
    const key = findKey(pad.def, pad.lanes)!;
    expect(key.freeze).toHaveLength(2);
    expect(key.labels).toEqual(['Rear lets go', 'Front lets go']);
    // the weakened car is stopped on once its step-out shows
    const weak = pad.lanes[1];
    weak.rec.sample(key.freeze[0], st);
    expect(Math.abs(betaOf(st)) * (180 / Math.PI)).toBeGreaterThan(9);
    const first = freezeFrame('skidpad', pad.lanes, key, key.freeze[0], key.labels[0]);
    expect(first.label).toBe('Rear lets go');
    expect(first.cars[1].verdict).toBe('rear');
    // "before" is a while ahead of the moment, never after it, on a car yet to get there too
    for (const c of first.cars) expect(c.useR0).toBeLessThanOrEqual(c.useR + 0.05);
    // at the second stop the weakened car, eased off long since, grips again: never "let go"
    // with its angle back at nothing
    const second = freezeFrame('skidpad', pad.lanes, key, key.freeze[1], key.labels[1]);
    expect(second.cars[0].verdict).toBe('front');
    expect(second.cars[1].verdict).toBe('back');
    expect(Math.abs(second.cars[1].pointsDeg)).toBeLessThan(3);
    const lane = runAll('porsche-911-992', 'lane-change');
    expect(findKey(lane.def, lane.lanes)!.freeze).toEqual([]);
  });
});
