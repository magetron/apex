/**
 * The moment a scenario turns on, found in what the cars actually drove: the scripted event
 * (the lift, the brake, the throttle…) or, on the skidpad, an axle running out of grip. The
 * scene slows down into it and stops there (the freeze frame: cause next to effect):
 *  - a little after an end lets go, once it shows: a car whose rear goes has swung a few
 *    degrees from where it points to where it goes (or after a short while, whichever comes
 *    first), a car whose front goes has pushed on for a moment; if both cars let go close
 *    together, once both show;
 *  - on the skidpad, where the cars reach their limits seconds apart, at each car's;
 *  - or at the scenario's own `freeze` time (a catch needs the countersteer to have worked), or
 *    three quarters through the stretch when nothing lets go.
 */
import { betaOf, createState } from '../../sim/model';
import type { KeySpec, PathPoint, ScenarioDef } from '../../sim/scenarios';
import { laneEventTime, type Lane } from './lanes';

export { laneEventTime };

export interface KeyMoment {
  /** the visitor's car's moment (the earliest car's if it has none yet) */
  t: number;
  /** the stretch shown slowed down */
  t0: number;
  t1: number;
  /** its name on the timeline ("Lift", "Front lets go") */
  label: string;
  /** where to stop and show cause next to effect (s of sim time, ascending); may be empty */
  freeze: number[];
  /** the end of what the moment led to (the spin, the run wide, the catch), a little after the
   *  scenario's stretch and its last stop: until then both cars stay in frame */
  end: number;
  /** each stop's name ("Lift"; on the skidpad, the end that let go there) */
  labels: string[];
  /** the moment each car's cause began (its event; on the skidpad, a while before it let go),
   *  for the freeze frame's "before"; NaN for a car that never got there */
  before: number[];
}

/** cars reach their moments a little apart: the slowed stretch may grow this much for it (s) */
const SPREAD = 1;
/** a let-go this soon after the stretch still belongs to the event (s) */
const LATE = 0.5;
/** a car whose rear let go is stopped on once it has swung this far (deg), or this long after
 *  (s), whichever comes first; a car whose front let go, this long after */
const SWUNG = { deg: 4, within: 0.4 };
export const SHOW = 0.4;
/** never sooner than this after the let-go (s) */
const AT_LEAST = 0.1;
/** what a moment leads to plays out this long after its stretch and its last stop (s) */
const OUTCOME = 1;
/** how far back "before" reaches on the skidpad, where the cause builds up slowly (s) */
const RAMP_BEFORE = 3;

const st = createState();

/** A lane's own key moment: its event, or when its first axle let go. */
export function laneKeyTime(lane: Lane, key: KeySpec): number {
  if (key.at === 'let-go') return lane.letGo?.t ?? laneEventTime(lane);
  return laneEventTime(lane);
}

/** When a car's let-go shows: its body swung `swung.deg` (rear), or a moment later (front). */
export function shownAt(lane: Lane, swung: KeySpec['swung'] = SWUNG): number {
  const lg = lane.letGo;
  if (!lg) return NaN;
  if (lg.axle === 'front') return lg.t + SHOW;
  const rad = (swung.deg * Math.PI) / 180;
  for (let t = lg.t + AT_LEAST; t <= lg.t + swung.within; t += 0.02) {
    lane.rec.sample(t, st);
    if (Math.abs(betaOf(st)) >= rad) return t;
  }
  // never before the car shows it at all (lanes.ts SHOWN_DEG), if it does soon after
  const shown = lane.shownAt();
  return shown <= lg.t + 2 * swung.within
    ? Math.max(lg.t + swung.within, shown)
    : lg.t + swung.within;
}

const ends = (axle: 'front' | 'rear') => (axle === 'rear' ? 'Rear lets go' : 'Front lets go');

/** opposite lock that counts as catching a slide (rad of steering) */
const LOCK = (1 * Math.PI) / 180;
const bend: PathPoint = { x: 0, n: 0, h: 0, k: 0 };

/**
 * When the driver's opposite lock peaks (the steering out of the turn, into a slide), over the
 * cars that use any, within `within` s of each car's event: the most of them all. Null if no
 * driver steers into a slide.
 */
function peakLock(lanes: readonly Lane[], within: number): number | null {
  let best = LOCK;
  let at: number | null = null;
  for (const l of lanes) {
    const te = laneEventTime(l);
    if (!Number.isFinite(te)) continue;
    const rec = l.rec;
    for (let i = rec.indexAt(te), n = rec.indexAt(te + within); i <= n; i++) {
      const k = l.plan.path.at(rec.sAt(i), bend).k;
      if (Math.abs(k) < 1e-4) continue;
      const lock = -rec.get(i, 'steer') * Math.sign(k);
      if (lock > best) {
        best = lock;
        at = rec.get(i, 't');
      }
    }
  }
  return at;
}

/**
 * The key moment across the cars on the road. The visitor's car is skipped while they drive it
 * (nothing recorded ahead of the playhead yet).
 */
export function findKey(def: ScenarioDef, lanes: readonly Lane[], live = false): KeyMoment | null {
  const key = def.key;
  const used = lanes.filter((_, i) => !(i === 0 && live));
  const times = used.map((l) => laneKeyTime(l, key)).filter(Number.isFinite);
  if (!times.length) return null;
  const lo = Math.min(...times);
  const hi = Math.max(...times);
  const tMain = live ? NaN : laneKeyTime(lanes[0], key);
  const t = Number.isFinite(tMain) ? tMain : lo;
  const before = lanes.map((l, i) => (i === 0 && live ? NaN : laneEventTime(l)));

  let freeze: number[];
  let labels: string[] = [];
  let t0: number;
  let t1: number;
  if (key.at === 'let-go') {
    // every car's limit is its own moment: stop at each
    const stops = used
      .flatMap((l) => (l.letGo ? [{ t: shownAt(l, key.swung), label: ends(l.letGo.axle) }] : []))
      .sort((a, b) => a.t - b.t)
      .filter((f, i, all) => i === 0 || f.t - all[i - 1].t > 1);
    freeze = stops.map((f) => f.t);
    labels = stops.map((f) => f.label);
    // slowed round the first (the cars' limits can be seconds apart; the second still stops)
    t0 = Math.max(0, lo - key.before);
    t1 = (freeze[0] ?? lo) + key.after;
    // the cause builds up slowly here: "before" is a while ahead of each car's own let-go (its
    // event, the driver easing off, comes after it); a car that never lets go, a while ahead
    // of the first stop
    lanes.forEach((l, i) => {
      if (i === 0 && live) return;
      const at = l.letGo?.t ?? freeze[0];
      before[i] = Number.isFinite(at) ? Math.max(0, at - RAMP_BEFORE) : NaN;
    });
  } else {
    t0 = Math.max(0, lo - key.before);
    t1 = Math.min(hi + key.after, t0 + key.before + key.after + SPREAD);
    // where it stops is car A's moment alone: the same car A pauses at the same place whatever
    // it is compared with (its own run, unless the visitor is driving it)
    const own = live ? used : lanes.slice(0, 1);
    const lock = key.freezeAt === 'peak-lock' ? peakLock(own, key.after) : null;
    if (lock) freeze = [lock];
    else if (key.freeze === null) freeze = [];
    else if (key.freeze !== undefined) freeze = [t + key.freeze];
    else {
      const end = t + key.after + LATE;
      const lets = own
        .filter((l) => l.letGo && l.letGo.t >= t - 0.1 && l.letGo.t <= end)
        .sort((a, b) => a.letGo!.t - b.letGo!.t);
      if (!lets.length) freeze = [t + 0.75 * key.after];
      else {
        // once every car that let go shows it
        const f = Math.max(...lets.map((l) => shownAt(l, key.swung)));
        freeze = [Math.min(f, end + SHOW)];
      }
    }
  }
  // never after the held steering ends (bar a catch, which is what comes after it): from then
  // the test driver corrects, and the line says nothing more about the cause
  if (key.at === 'event' && def.holdS && !key.freezeAt) {
    let last = Infinity;
    for (const l of live ? used : lanes.slice(0, 1)) {
      const te = laneEventTime(l);
      if (Number.isFinite(te)) last = Math.min(last, te + def.holdS - 0.02);
    }
    freeze = freeze.map((f) => Math.min(f, last));
  }
  const label = keyLabel(def, lanes, live);
  if (labels.length !== freeze.length) labels = freeze.map(() => label);
  const end = Math.max(t1, freeze.at(-1) ?? t1, t + key.after) + OUTCOME;
  return { t, t0, t1, label, freeze, labels, before, end };
}

function keyLabel(def: ScenarioDef, lanes: readonly Lane[], live: boolean): string {
  if (def.key.at === 'let-go') {
    const lg = lanes.find((l, i) => !(i === 0 && live) && l.letGo)?.letGo;
    if (lg) return lg.axle === 'rear' ? 'Rear lets go' : 'Front lets go';
  }
  return def.key.label ?? def.event ?? 'Event';
}

/** slowest playback the key moment eases into, and how long the easing takes (s of sim) */
export const KEY_RATE = 0.25;
const EASE = 0.3;
/** a long wait for the key moment (the skidpad's slow ramp) plays faster, up to this rate */
const FAST = 3;
/** …from this far ahead of it (s of sim) */
const FAST_FROM = 6;

/** Playback rate at time t for automatic slow motion around the key moment. */
export function autoRate(key: KeyMoment | null, t: number): number {
  if (!key) return 1;
  const d = t < key.t0 ? key.t0 - t : t > key.t1 ? t - key.t1 : 0;
  if (t < key.t0 && d > FAST_FROM) {
    // ease from real time up to FAST over a couple of seconds, and back well before the moment
    const w = Math.min(1, (d - FAST_FROM) / 2);
    return 1 + (FAST - 1) * w * w * (3 - 2 * w);
  }
  const w = Math.min(1, d / EASE);
  return KEY_RATE + (1 - KEY_RATE) * w * w * (3 - 2 * w);
}
