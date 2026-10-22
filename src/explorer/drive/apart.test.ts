/**
 * Car B on car A's own line, drawn STAGGER lengths behind it, can still catch car A up (car A
 * slid, or spun and stopped): it then fades out rather than being drawn over car A, smoothly at
 * any frame rate, and comes back as the gap opens.
 */
import { describe, expect, it } from 'vitest';
import { SCENARIOS, type ScenarioId } from '../../sim/scenarios';
import { getVehicle } from '../../spec/catalog';
import { apartFade, FADED, STAGGER, type Lane } from './lanes';
import { buildLineup, laneOf } from './lineup';
import { capKmh } from './state';
import { pairLanes } from './twin';

/** both cars driven as the scene drives them, car B on car A's own line */
function sameLine(id: string, sc: ScenarioId): [Lane, Lane] {
  const kmh = capKmh(sc, SCENARIOS[sc].speed.def);
  const lanes = buildLineup(getVehicle(id), { scenario: sc, compare: 'auto' }, kmh, null).map((e) =>
    laneOf(e, false),
  );
  for (const l of lanes) {
    l.reset();
    l.simTo(l.plan.duration + 1);
  }
  pairLanes(lanes);
  const [main, rival] = lanes;
  rival.offset = 0;
  rival.behind = STAGGER * main.p.dims.length;
  return [main, rival];
}

/** 120 Hz with dropped frames and a hitch (s) */
const FRAMES = [1 / 120, 1 / 120, 1 / 60, 1 / 120, 0.03, 1 / 120, 1 / 60];

/** Play the run through as the scene does; how car B was drawn. */
function play(main: Lane, rival: Lane) {
  let t = 0;
  let min = 1;
  let minAt = 0;
  let step = 0;
  let turns = 0;
  let last = 0;
  const drawn: { t: number; v: number }[] = [];
  for (let i = 0; t < main.plan.duration; i++) {
    const dt = FRAMES[i % FRAMES.length];
    t += dt;
    main.show(t);
    rival.show(t);
    const was = rival.drawn;
    rival.fadeTo(apartFade(main, rival), dt);
    const d = rival.drawn - was;
    // a step is never more than an ease over that frame (no switching on and off)
    step = Math.max(step, Math.abs(d) / (1 - Math.exp(-dt / 0.06)));
    if (Math.abs(d) > 1e-4) {
      if (last && Math.sign(d) !== Math.sign(last)) turns++;
      last = d;
    }
    if (rival.drawn < min) {
      min = rival.drawn;
      minAt = t;
    }
    drawn.push({ t, v: rival.drawn });
  }
  return { min, minAt, step, turns, drawn };
}

describe('car B on car A’s own line', () => {
  it('fades out where it would sit on car A: an MX-5 and a 911 under power out of a turn', () => {
    // measured: their middles 1.6 m and 4.2 m apart at about 10 s and 12 s, under a car length
    for (const id of ['mazda-mx5-nd', 'porsche-911-992']) {
      const [main, rival] = sameLine(id, 'power-exit');
      const run = play(main, rival);
      expect(run.min, id).toBeLessThan(FADED);
      expect(run.minAt, id).toBeGreaterThan(8);
      // eased, never flickering on and off
      expect(run.step, id).toBeLessThan(1);
      expect(run.turns, id).toBeLessThan(6);
    }
    // the MX-5's car B drives on past it: drawn whole again once clear
    const [main, rival] = sameLine('mazda-mx5-nd', 'power-exit');
    const run = play(main, rival);
    expect(run.drawn.some((d) => d.t > run.minAt && d.v > 0.99)).toBe(true);
  });

  it('stays whole where the two keep their distance', () => {
    for (const [id, sc] of [
      ['porsche-911-992', 'lane-change'],
      ['porsche-911-992', 'braking'],
      ['vw-golf-gti-mk8', 'lift-off'],
      ['vw-golf-gti-mk8', 'braking'],
    ] as const) {
      const [main, rival] = sameLine(id, sc);
      expect(play(main, rival).min, `${id} ${sc}`).toBe(1);
    }
  });

  it('comes back once the gap opens, in about half a second, the same at any frame rate', () => {
    const [main, rival] = sameLine('mazda-mx5-nd', 'power-exit');
    main.show(0);
    rival.show(0);
    expect(apartFade(main, rival)).toBe(1);
    const back = (frames: number[]) => {
      // long gone
      rival.fadeTo(0, 10);
      rival.fadeTo(0, 10);
      expect(rival.drawn).toBeLessThan(FADED);
      let t = 0;
      for (let i = 0; t < 0.5 - 1e-9; i++) {
        const dt = frames[i % frames.length];
        t += dt;
        rival.fadeTo(apartFade(main, rival), dt);
      }
      return rival.drawn;
    };
    const even = back([1 / 120]);
    expect(even).toBeGreaterThan(0.98);
    expect(back([1 / 60, 1 / 120, 1 / 40])).toBeCloseTo(even, 2);
  });
});
