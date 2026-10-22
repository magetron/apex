import { describe, expect, it } from 'vitest';
import { createState, type CarState } from '../../sim/model';
import { HUB_ORDER, SCENARIOS, type PathPoint } from '../../sim/scenarios';
import { getVehicle } from '../../spec/catalog';
import { AFTER_SPIN, AFTER_TEST, steerCaption, testEnd } from './hands';
import { slidAt } from './lanes';
import { buildLineup, laneOf } from './lineup';
import { pairLanes } from './twin';
import type { CompareKind } from './versus';

const st: CarState = createState();
const bend: PathPoint = { x: 0, n: 0, h: 0, k: 0 };
const DEG = 180 / Math.PI;

describe('the hands under each wheel never contradict the question', () => {
  it('held through the held wheel, a catch only where catching is the test, then "after the test"', () => {
    for (const v of ['porsche-911-992', 'vw-golf-gti-mk8', 'bmw-m340i-g20']) {
      for (const id of HUB_ORDER) {
        for (const compare of ['auto', 'without', 'contrast'] as CompareKind[]) {
          const def = SCENARIOS[id];
          const lineup = buildLineup(getVehicle(v), { scenario: id, compare }, def.speed.def);
          const lanes = lineup.map((e) => {
            const l = laneOf(e);
            l.simTo(e.plan.duration + 1);
            return l;
          });
          pairLanes(lanes);
          lanes.forEach((l) => {
            const twin = l.info.rival === 'without';
            const end = testEnd(id, l, twin);
            const slid = slidAt(l);
            const what = `${v} ${id} ${compare} ${l.info.label ?? l.info.name}`;
            const seen: string[] = [];
            for (let t = 0; t <= l.plan.duration; t += 0.02) {
              const phase = l.rec.sample(t, st);
              const k = l.plan.path.at(l.rec.sAtTime(t), bend).k;
              const words = steerCaption({
                id,
                twin,
                phase,
                t,
                over: end.t,
                spun: end.spun,
                slid: t >= slid,
                deg: st.steer * DEG,
                turn: Math.abs(k) < 1e-4 ? 0 : Math.sign(k),
              });
              seen.push(words);
              // a car meant to hold its wheel never "corrects", and nothing corrects into the turn
              if (words.startsWith('driver corrects')) {
                expect(twin, `${what} t=${t.toFixed(2)}: ${words}`).toBe(false);
                expect(id, what).toBe('catch');
                expect(words, what).toMatch(/opposite lock/);
              }
              // opposite lock only into a slide
              if (/opposite lock/.test(words))
                expect(t, `${what}: ${words}`).toBeGreaterThanOrEqual(slid);
              // through its held wheel, held
              if (phase === 1 && t < end.t)
                expect(words, `${what} t=${t.toFixed(2)}`).toMatch(/^held: /);
              // once its part of the test is over, it says so, and nothing else
              if (t >= end.t) expect([AFTER_TEST, AFTER_SPIN], what).toContain(words);
            }
            // a twin in the catch holds its wheel until its test is over
            if (id === 'catch' && twin)
              expect(
                seen.some((w) => w.startsWith('driver corrects')),
                what,
              ).toBe(false);
          });
        }
      }
    }
    // (every question, three cars, three car Bs: a while, under a full parallel run)
  }, 120_000);
});
