import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../../sim/scenarios';
import { getVehicle, listVehicles } from '../../spec/catalog';
import { carFacts, facets, searchCars } from './carFacts';
import { carLessons, compareLessons, layoutWords } from './lessons';

const f = (id: string) => carFacts(getVehicle(id));
const all = listVehicles().map(carFacts);

describe('why a layout matters', () => {
  it('every car gets a question for its weight and one for its driven wheels', () => {
    for (const c of all) {
      const ls = carLessons(c);
      expect(ls.map((l) => l.key)).toEqual(['split', 'drive']);
      for (const l of ls) {
        expect(l.question).toBe(SCENARIOS[l.scenario].question);
        expect(l.ask.length).toBeGreaterThan(3);
      }
      expect(ls[1].scenario).toBe('power-exit');
    }
    expect(carLessons(f('porsche-911-992'))[0].scenario).toBe('lift-off');
  });

  it('compares only what differs, naming the car each question is about', () => {
    const ls = compareLessons(f('porsche-911-992'), [f('vw-golf-gti-mk8')]);
    expect(ls.map((l) => l.key)).toEqual(['split', 'drive']);
    expect(ls.map((l) => l.scenario)).toEqual(['lift-off', 'power-exit']);
    expect(ls.every((l) => l.other === 'vw-golf-gti-mk8')).toBe(true);
    // the main car the tail-heavier one: the question is about the car it is compared with
    expect(compareLessons(f('vw-golf-gti-mk8'), [f('porsche-911-992')])[0].other).toBe(
      'porsche-911-992',
    );
    // two cars of one layout and a similar split: nothing to explain
    const same = compareLessons(f('vw-golf-gti-mk8'), [f('vw-golf-mk8')]);
    expect(same.filter((l) => l.key !== 'split')).toEqual([]);
  });

  it('spells the layout code out', () => {
    expect(layoutWords(f('porsche-911-992'))).toBe('Rear engine, rear-wheel drive');
    expect(layoutWords(f('vw-golf-gti-mk8'))).toBe('Front engine, front-wheel drive');
    expect(layoutWords(f('tesla-model3-awd'))).toBe('Motors front and rear, all-wheel drive');
  });
});

describe('car search', () => {
  it('a name match beats a mention elsewhere', () => {
    const golfs = searchCars(all, 'golf');
    expect(golfs.length).toBeGreaterThan(0);
    expect(golfs.every((c) => /golf/i.test(c.name))).toBe(true);
    // a word only mentioned elsewhere still finds cars
    expect(searchCars(all, 'turbo').length).toBeGreaterThan(0);
    expect(facets(all).length).toBeGreaterThan(0);
  });

  it('the card and the comparison agree on the mass: the published kerb weight', () => {
    for (const c of all) expect(c.kg).toBe(c.v.published.curbKg);
  });
});

describe('the questions hold for every car', () => {
  it('a nose-heavy car points at the push-wide question, a tail-heavy one at lifting', () => {
    for (const c of all) {
      const split = carLessons(c)[0];
      if (c.frontPct > 55) expect(split.scenario).toBe('skidpad');
      if (c.frontPct < 45) expect(split.scenario).toBe('lift-off');
    }
  });

  it('never points at how quickly a layout turns in', () => {
    for (const c of all) for (const l of carLessons(c)) expect(l.scenario).not.toBe('lane-change');
  });

  it('a button names an action, not a sentence: three words at most, no figures', () => {
    const asks = all.flatMap((c) => [
      ...carLessons(c),
      ...compareLessons(c, all.filter((o) => o.id !== c.id).slice(0, 2)),
    ]);
    for (const { ask } of asks) {
      expect(ask.split(' ').length).toBeLessThanOrEqual(3);
      expect(ask).not.toMatch(/[\d:?.]/);
    }
  });
});
