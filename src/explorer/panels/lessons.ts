/**
 * Why a layout matters, as the drive question that shows it: where the weight sits (lift
 * mid-corner, or find the limit for a nose-heavy car) and which wheels drive (throttle on exit).
 * For one car, or what differs between cars being compared. The car view only names the
 * question on a button; the drive page shows what happens. Pure. Nothing here points at how
 * quickly a layout turns in, which the drive runs don't bear out (the yaw inertia doesn't rank
 * the cars' lane changes either).
 */
import { SCENARIOS, type ScenarioId } from '../../sim/scenarios';
import type { CarFacts, Drive, Place } from './carFacts';

export type LessonKey = 'split' | 'drive';

export interface Lesson {
  key: LessonKey;
  /** the drive question that shows it */
  scenario: ScenarioId;
  /** the button's words: what the driver does, three words at most */
  ask: string;
  /** the question in full (the button's tooltip) */
  question: string;
  /** the compared car the lesson is about (drive it against the main one) */
  other?: string;
}

/**
 * What the driver does in each question, as a button names it. The scenario's own question is a
 * sentence and its label names the technique, not the action; another question falls back to that
 * label.
 */
const ASK: Partial<Record<ScenarioId, string>> = {
  'lift-off': 'Lift mid-corner',
  'power-exit': 'Throttle on exit',
  skidpad: 'Find the limit',
};

/** "Rear engine, rear-wheel drive" for RR, in words (a tooltip, a screen reader) */
export function layoutWords(f: CarFacts): string {
  const where =
    f.source === 'EV'
      ? f.places.length > 1
        ? 'Motors front and rear'
        : `${PLACE_WORD[f.places[0]]} motor`
      : `${PLACE_WORD[f.places[0]]} engine`;
  return `${where}, ${DRIVE_WORD[f.drive]}`;
}

const PLACE_WORD: Record<Place, string> = { front: 'Front', mid: 'Mid', rear: 'Rear' };
const DRIVE_WORD: Record<Drive, string> = {
  FWD: 'front-wheel drive',
  RWD: 'rear-wheel drive',
  AWD: 'all-wheel drive',
};

type Split = 'tail' | 'nose' | 'even';
const splitOf = (f: CarFacts): Split =>
  f.frontPct < 45 ? 'tail' : f.frontPct > 55 ? 'nose' : 'even';

/** the question that shows a split: lifting mid-corner swings a tail, a nose pushes wide */
const SPLIT_Q: Record<Split, ScenarioId> = { tail: 'lift-off', nose: 'skidpad', even: 'lift-off' };

const lesson = (key: LessonKey, scenario: ScenarioId, other?: string): Lesson => ({
  key,
  scenario,
  ask: ASK[scenario] ?? SCENARIOS[scenario]?.label ?? '',
  question: SCENARIOS[scenario]?.question ?? '',
  other,
});

/** Why this one car's layout matters: its weight split, then its driven wheels. */
export function carLessons(f: CarFacts): Lesson[] {
  return [lesson('split', SPLIT_Q[splitOf(f)]), lesson('drive', 'power-exit')];
}

/** What the differences between the main car and those compared with it do (only those). */
export function compareLessons(main: CarFacts, others: CarFacts[]): Lesson[] {
  const out: Lesson[] = [];
  // weight split: the tail-heaviest against the nose-heaviest, when they differ by 3 points
  const byFront = [main, ...others].sort((a, b) => b.frontPct - a.frontPct);
  const nose = byFront[0];
  const tail = byFront[byFront.length - 1];
  if (nose.frontPct - tail.frontPct >= 3)
    out.push(lesson('split', 'lift-off', (tail.id === main.id ? nose : tail).id));
  const drives = others.find((o) => o.drive !== main.drive);
  if (drives) out.push(lesson('drive', 'power-exit', drives.id));
  return out;
}
