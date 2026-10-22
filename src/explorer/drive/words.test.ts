import { describe, expect, it } from 'vitest';
import { HUB_ORDER } from '../../sim/scenarios';
import { getVehicle } from '../../spec/catalog';
import { budget, hudText, runQuestion } from './budget';
import { BUDGET, visibleText, words } from './words';

describe('the text budget', () => {
  it('counts what is in sight: names, tooltips, menus and hidden things aside', () => {
    const html =
      '<p><span>1</span><span>What if?</span></p><svg><title>tip text</title><text>1.3 m tighter</text></svg>' +
      '<select><option>menu words</option></select><div hidden=""><b>gone</b></div><i>×5</i>';
    const text = visibleText(html);
    expect(text).toBe('1 What if? 1.3 m tighter ×5');
    expect(words(text, ['1 What if?'])).toEqual(['1.3', 'm', 'tighter', '×5']);
  });

  it(`at most ${BUDGET} words in sight at the start, each stop and the end of every question`, () => {
    const table: string[] = [];
    for (const v of ['porsche-911-992', 'vw-golf-gti-mk8']) {
      const vehicle = getVehicle(v);
      const hud = hudText(vehicle);
      for (const id of HUB_ORDER) {
        const moments = budget(vehicle, runQuestion(vehicle, id), hud);
        for (const m of moments) {
          expect(
            m.words.length,
            `${v} ${id} ${m.moment}: ${m.words.join(' ')}`,
          ).toBeLessThanOrEqual(BUDGET);
          if (v === 'porsche-911-992')
            table.push(
              `${id.padEnd(12)} ${m.moment.padEnd(7)} ${String(m.words.length).padStart(2)} (all ${String(m.all).padStart(2)})  ${m.words.join(' ')}`,
            );
        }
      }
    }
    // the counts, for the record (vitest prints them with the run)
    console.log(
      `words in sight, 911 Carrera S (names and question titles aside; all: with them):\n${table.join('\n')}`,
    );
  });
});
