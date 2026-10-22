/**
 * What each driver's hands are doing, in the words under its steering wheel, kept true to the
 * question: "held: 4° into the turn" through the held wheel; "driver corrects: opposite lock
 * 6°" only where catching a slide is the test (car A in the catch, or another car doing it),
 * only once that car has slid, and only while the wheel points out of the turn; after a car's
 * part of the test is over (its held wheel ended, its catch played out, or it spun), "after the
 * test". Car B without the technique never "corrects": its wheel is held for its whole test.
 */
import type { ScenarioId } from '../../sim/scenarios';
import { CATCH_SHOWN_S } from '../../sim/scenarios/catch';
import { laneEventTime, type Lane } from './lanes';

/** What the wheel is doing, in words: opposite lock when it points out of the turn into a
 *  slide (`slid`); out of the turn, plainly, when nothing slid. */
export function steerWords(deg: number, turn: number, slid: boolean): string {
  // the angle is the front wheels' (the road wheels), not the steering wheel's
  const d = Math.round(Math.abs(deg));
  if (d < 1) return 'front wheels straight';
  if (turn !== 0 && deg * turn < 0)
    return slid ? `front wheels at opposite lock ${d}°` : `front wheels ${d}° out of the turn`;
  if (turn !== 0) return `front wheels ${d}° into the turn`;
  return `front wheels ${d}° ${deg > 0 ? 'left' : 'right'}`;
}

/** what the hands say once a car's part of the test is over */
export const AFTER_TEST = 'after the test';
export const AFTER_SPIN = 'spun: after the test';

export interface Caption {
  id: ScenarioId;
  /** car B, the same car without the technique */
  twin: boolean;
  /** where its driver is in the script: 0 before the action, 1 wheel held, 2 after it; −1 the
   *  visitor's own car */
  phase: number;
  /** now, and when its part of the test is over (testEnd), and whether it ended in a spin */
  t: number;
  over: number;
  spun: boolean;
  /** it has slid (lanes.ts slidAt) */
  slid: boolean;
  /** the wheel (road-wheel deg, + = left) and which way the road turns (+1 left, −1 right) */
  deg: number;
  turn: number;
}

/** The words under a driver's wheel (see the module comment). */
export function steerCaption(c: Caption): string {
  const words = steerWords(c.deg, c.turn, c.slid);
  if (c.phase < 0) return words;
  if (c.t >= c.over) return c.spun ? AFTER_SPIN : AFTER_TEST;
  if (c.phase === 1) return `held: ${words}`;
  // after the held wheel, still in the test: only catching a slide, by a car meant to
  const lock = c.slid && c.turn !== 0 && c.deg * c.turn < 0 && Math.round(Math.abs(c.deg)) >= 1;
  if (c.phase >= 2 && c.id === 'catch' && !c.twin && lock) return `driver corrects: ${words}`;
  return words;
}

/**
 * When a lane's part of the test is over (s of sim time): the end of its held wheel (its first
 * frame after the event in which the driver has the wheel again); in the catch, for a car meant
 * to catch, the end of the catch the question measures; or the moment it spun, if sooner.
 * Infinity for a car that never reached its event. Also whether it ends in a spin.
 */
export function testEnd(id: ScenarioId, lane: Lane, twin: boolean): { t: number; spun: boolean } {
  const rec = lane.rec;
  const te = laneEventTime(lane);
  if (!Number.isFinite(te)) return { t: Infinity, spun: false };
  let held = Infinity;
  let spun = Infinity;
  for (let i = rec.indexAt(te); i < rec.count; i++) {
    const t = rec.get(i, 't');
    if (held === Infinity && t > te && rec.phaseAt(i) >= 2) held = t;
    if (spun === Infinity && rec.spunAt(i)) spun = t;
    if (held < Infinity && spun < Infinity) break;
  }
  const end = id === 'catch' && !twin ? te + CATCH_SHOWN_S : held;
  return spun < end ? { t: spun, spun: true } : { t: end, spun: false };
}
