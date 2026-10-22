/**
 * What a visitor reads on the drive page at each moment of a watched run of one question (its
 * start, each stop at its key moment, its end), word for word, against the budget (words.ts):
 * the HUD as it renders (the rail, the question and its inset, the timeline), the cars' tags as
 * they read then, and the picture the run ends on. The run is the scene's own: the same cars,
 * the same key moment and verdicts, the same picture. For the test and the #/dev/drive sandbox.
 *
 * The HUD is rendered to static markup, which reads every store as it starts (zustand's server
 * snapshot): its words don't depend on the question (the title and car B's name are names), so
 * it is rendered once; what does depend on it (the tags, the picture, the ×5 chip) is added from
 * the run.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { HUB_ORDER, SCENARIOS, type ScenarioId } from '../../sim/scenarios';
import type { VehicleSpec } from '../../spec/types';
import { DriveControls } from './DriveControls';
import { DriveDash } from './DriveDash';
import { DriveInfo } from './DriveInfo';
import { freezeFrame, liveVerdict, tagWord, type FreezeFrame, type Verdict } from './freeze';
import { AXIS } from './Layouts';
import { findKey, type KeyMoment } from './key';
import type { Lane } from './lanes';
import { buildLineup, laneOf, laneResult } from './lineup';
import { PathDrawing } from './PathPicture';
import { buildPicture, type PathPicture } from './picture';
import { capKmh, FAMILIES, familyOf, representative, SHORT_NAME } from './state';
import { MATCHED, modelName, type Outcome } from './takeaway';
import { pairLanes } from './twin';
import { chooseRival, rivalOptions } from './versus';
import { visibleText, words } from './words';

/** the end picture's size for the count (its words don't depend on it) */
const PIC_W = 736;
const PIC_H = 560;

export interface QuestionRun {
  id: ScenarioId;
  lanes: Lane[];
  key: KeyMoment | null;
  /** the freeze frame at each stop */
  frames: FreezeFrame[];
  outcomes: Outcome[];
  twin: boolean;
  pic: PathPicture | null;
}

/** A question run for a car as the scene runs it, against the question's own car B. */
export function runQuestion(vehicle: VehicleSpec, id: ScenarioId): QuestionRun {
  const kmh = capKmh(id, SCENARIOS[id].speed.def);
  const entries = buildLineup(vehicle, { scenario: id, compare: 'auto' }, kmh);
  const lanes = entries.map((e) => {
    const l = laneOf(e);
    l.simTo(e.plan.duration + 1);
    return l;
  });
  pairLanes(lanes);
  const key = findKey(SCENARIOS[id], lanes);
  const frames = key ? key.freeze.map((f, i) => freezeFrame(id, lanes, key, f, key.labels[i])) : [];
  const outcomes = lanes.map((l, i) => laneResult(l, entries[i].asBuilt).outcome!);
  const twin = lanes[1].info.rival === 'without';
  const pic = buildPicture(id, lanes, key, outcomes, twin);
  return { id, lanes, key, frames, outcomes, twin, pic };
}

export interface Moment {
  /** "start", "stop" (one per stop at the key moment), "end" */
  moment: string;
  /** the words in sight, names aside */
  words: string[];
  /** and every word in sight, car names and question titles too (for the record) */
  all: number;
}

/** Every name a question title or a car may show under (taken out of the count). */
function names(vehicle: VehicleSpec): string[] {
  const out = [vehicle.name, modelName(vehicle.name)];
  HUB_ORDER.forEach((id, i) => {
    const q = SCENARIOS[id].question;
    // a numbered title: the number is the title's (the card's, and the rail's short one)
    out.push(`${i + 1} ${q}`, q, `${i + 1} ${SHORT_NAME[id]}`, SHORT_NAME[id]);
    for (const r of rivalOptions(vehicle, id)) out.push(r.label, r.vehicle.name);
    const r = chooseRival(vehicle, id, 'auto');
    out.push(r.label, r.vehicle.name, modelName(r.vehicle.name));
    for (const f of FAMILIES) {
      const v = representative(f, vehicle);
      if (v) out.push(modelName(v.name));
    }
  });
  return out;
}

/** The HUD's own words (the rail, the question card, the timeline), as a watched run starts. */
export function hudText(vehicle: VehicleSpec): string {
  return visibleText(
    renderToStaticMarkup(
      <>
        <DriveControls vehicle={vehicle} />
        <DriveInfo vehicle={vehicle} />
        <DriveDash />
      </>,
    ),
  );
}

/** What a car's tag says at time t of the run (as CarLabel says it). */
function tagAt(run: QuestionRun, i: number, t: number, pathOnly: boolean): string {
  const { id, lanes, frames } = run;
  // (braking into a turn beside the same car at its speed, car B is only a path: no tag)
  if (pathOnly && i === 1) return '';
  const lane = lanes[i];
  lane.show(t);
  let atStop: Verdict | null = null;
  for (const f of frames) if (f.t <= t + 1e-6) atStop = f.cars[i].verdict;
  return tagWord(id, liveVerdict(id, lane, lane.view, t, atStop));
}

/** The words in sight at each moment of a watched run of `run`. */
export function budget(vehicle: VehicleSpec, run: QuestionRun, hud = hudText(vehicle)): Moment[] {
  const { id, lanes, frames, pic } = run;
  const skip = names(vehicle).concat(lanes.map((l) => l.info.label ?? l.info.name));
  const pathOnly = MATCHED.includes(id) && run.twin;
  const moment = (name: string, ...parts: string[]): Moment => {
    const text = parts.join(' ');
    return { moment: name, words: words(text, skip), all: words(text).length };
  };
  const moments: Moment[] = [moment('start', hud)];
  frames.forEach((f, k) => {
    const tags = lanes.map((_, i) => tagAt(run, i, f.t, pathOnly));
    moments.push(moment(frames.length > 1 ? `stop ${k + 1}` : 'stop', hud, ...tags));
  });
  // the end: the tags as the run leaves them, the picture the card grows into, its replay and
  // next buttons (the next question's number), and every layout's row with its axis cue under
  // the timeline (each named by its model)
  const end = Math.max(...lanes.map((l) => l.plan.duration));
  const tags = lanes.map((_, i) => tagAt(run, i, end, pathOnly));
  const drawn = pic
    ? visibleText(renderToStaticMarkup(<PathDrawing pic={pic} w={PIC_W} h={PIC_H} />))
    : '';
  const next = String(((HUB_ORDER.indexOf(id) + 1) % HUB_ORDER.length) + 1);
  const row = FAMILIES.flatMap((f) => {
    const v = f === familyOf(vehicle) ? vehicle : representative(f, vehicle);
    return v ? [modelName(v.name)] : [];
  });
  moments.push(moment('end', hud, ...tags, drawn, next, ...row, ...AXIS));
  return moments;
}
