import { describe, expect, it } from 'vitest';
import { betaOf, createState } from '../../sim/model';
import { HUB_ORDER, SCENARIOS, type ScenarioId } from '../../sim/scenarios';
import { getVehicle } from '../../spec/catalog';
import { freezeFrame } from './freeze';
import { autoRate, findKey, KEY_RATE } from './key';
import { laneEventTime } from './lanes';
import { buildLineup, laneOf, laneResult } from './lineup';
import { buildPicture, REPLAY_FIRST } from './picture';
import { pairLanes } from './twin';
import { carNumber, lineOff, modelName, PICTURED } from './takeaway';
import type { CompareKind } from './versus';

describe('takeaway lines', () => {
  it('name cars by model, without the make or generation', () => {
    expect(modelName('BMW M340i (G20)')).toBe('M340i');
    expect(modelName('Porsche 718 Boxster T')).toBe('718 Boxster T');
    expect(modelName('Alfa Romeo 4C (Type 960)')).toBe('4C');
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

  it('push wide: as built the front lets go first, with less rear grip the rear', () => {
    const { cars } = runAll('porsche-911-992', 'skidpad');
    expect(cars[0].letGo?.axle).toBe('front');
    expect(cars[1].letGo?.axle).toBe('rear');
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
    // a nose turned in from its path is the rear stepping out
    const rearOut = (c: typeof p911) =>
      c.verdict === 'rear' || (Math.abs(c.pointsDeg) >= 2 && c.pointsDeg * c.turnSign > 0);
    expect(['front', 'wider']).toContain(p911.verdict);
    expect(rearOut(p911)).toBe(false);
    expect(rearOut(fr)).toBe(true);
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
    // in metres too: inside its own matched-speed line, by less than inside its twin's (some of
    // that is only the slowing down)
    expect(braked.values.sameSpeedShift!).toBeGreaterThan(0.3);
    expect(braked.values.sameSpeedShift!).toBeLessThan(
      braked.values.exitErr! - twin.values.exitErr! + 0.05,
    );
  });

  it('one number per car, the one the picture labels it with', () => {
    for (const v of ['porsche-911-992', 'vw-golf-gti-mk8', 'bmw-m340i-g20']) {
      for (const id of HUB_ORDER) {
        for (const compare of ['auto', 'without'] as const) {
          const { def, lanes, cars, twin } = runAll(v, id, compare);
          const what = `${v} ${id} ${compare}`;
          const pic = buildPicture(id, lanes, findKey(def, lanes), cars, twin)!;
          expect(pic, what).not.toBeNull();
          pic.cars.forEach((c, i) => {
            // the picture labels each car with its number
            expect(c.label, what).toBe(carNumber(id, cars[i])?.label ?? null);
          });
          // the corner questions: each dimension is drawn as long as its number (sideways ×n)
          for (const d of pic.dims) {
            const len = Math.hypot(d.a[0] - d.b[0], d.a[1] - d.b[1]);
            const m = id === 'braking' ? len : len / pic.n;
            const off = id === 'braking' ? cars[d.car].values.stopDist! : lineOff(id, cars[d.car])!;
            expect(Math.abs(m - Math.abs(off)), `${what}: drawn ${m} vs ${off}`).toBeLessThan(0.08);
          }
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
