/**
 * The moment a scenario turns on, found in what the cars actually drove: the scripted event
 * (the lift, the brake, the throttle…) or, on the skidpad, the first axle running out of grip.
 * The scene slows down around it and rings, on each car, the axle to watch: the one that let go
 * near that moment, or, on the visitor's car if none did, the one whose slip grows most (in a
 * straight line, where nothing slips, the one that gains load).
 */
import { createState } from '../../sim/model';
import type { KeySpec, ScenarioDef } from '../../sim/scenarios';
import type { Lane, Watch } from './lanes';

export interface KeyMoment {
  /** the visitor's car's moment (the earliest car's if it has none yet) */
  t: number;
  /** the stretch shown slowed down: every car's moment with the scenario's margins */
  t0: number;
  t1: number;
  /** its name on the timeline ("Lift", "Front lets go") */
  label: string;
}

const DEG = Math.PI / 180;
/** slip-angle growth below which an axle's wedge hardly changes (rad) */
const SLIP_MOVE = 0.3 * DEG;
/** cars reach their moments a little apart: the slowed stretch may grow this much for it (s) */
const SPREAD = 1;
/** a let-go ring, from just before the moment to a while after (s) */
const RING_BEFORE = 0.3;
const RING_AFTER = 1.2;
/** a let-go this soon after the stretch still belongs to the event (s) */
const LATE = 0.5;
const SAMPLE = 0.02;

const st = createState();

/** First recorded time a lane was in its event phase, NaN if it never got there. */
export function laneEventTime(lane: Lane): number {
  const rec = lane.rec;
  for (let i = 0; i < rec.count; i++) if (rec.phaseAt(i) >= 1) return rec.get(i, 't');
  return NaN;
}

/** A lane's own key moment: its event, or when its first axle let go. */
export function laneKeyTime(lane: Lane, key: KeySpec): number {
  if (key.at === 'let-go') return lane.letGo?.t ?? laneEventTime(lane);
  return laneEventTime(lane);
}

/** What to ring on one car around its moment tKey (see the header); null for nothing. */
export function watchOf(lane: Lane, tKey: number, key: KeySpec, main: boolean): Watch | null {
  if (!Number.isFinite(tKey)) return null;
  const lg = lane.letGo;
  if (lg && (key.at === 'let-go' || (lg.t >= tKey - key.before && lg.t <= tKey + key.after + LATE)))
    return { axle: lg.axle, t0: lg.t - RING_BEFORE, t1: lg.t + RING_AFTER };
  if (!main) return null;
  lane.rec.sample(tKey - 0.1, st);
  const aF0 = Math.abs(st.alphaF);
  const aR0 = Math.abs(st.alphaR);
  const zF0 = st.fz[0] + st.fz[1];
  const zR0 = st.fz[2] + st.fz[3];
  let aF = aF0;
  let aR = aR0;
  let zF = zF0;
  let zR = zR0;
  for (let t = tKey; t <= tKey + key.after; t += SAMPLE) {
    lane.rec.sample(t, st);
    aF = Math.max(aF, Math.abs(st.alphaF));
    aR = Math.max(aR, Math.abs(st.alphaR));
    zF = Math.max(zF, st.fz[0] + st.fz[1]);
    zR = Math.max(zR, st.fz[2] + st.fz[3]);
  }
  const dF = aF - aF0;
  const dR = aR - aR0;
  const axle =
    Math.max(dF, dR) > SLIP_MOVE
      ? dR >= dF
        ? 'rear'
        : 'front'
      : zF - zF0 >= zR - zR0
        ? 'front'
        : 'rear';
  return { axle, t0: tKey, t1: tKey + key.after };
}

/**
 * The key moment across the lineup, writing each lane's ring to lane.watch. The visitor's car
 * is skipped while they drive it (nothing recorded ahead of the playhead yet).
 */
export function findKey(def: ScenarioDef, lanes: readonly Lane[], live = false): KeyMoment | null {
  const key = def.key;
  let lo = Infinity;
  let hi = -Infinity;
  let tMain = NaN;
  lanes.forEach((l, i) => {
    l.watch = null;
    if (i === 0 && live) return;
    const t = laneKeyTime(l, key);
    if (!Number.isFinite(t)) return;
    if (i === 0) tMain = t;
    lo = Math.min(lo, t);
    hi = Math.max(hi, t);
    l.watch = watchOf(l, t, key, i === 0);
  });
  if (!Number.isFinite(lo)) return null;
  const t0 = Math.max(0, lo - key.before);
  const t1 = Math.min(hi + key.after, t0 + key.before + key.after + SPREAD);
  return { t: Number.isFinite(tMain) ? tMain : lo, t0, t1, label: keyLabel(def, lanes, live) };
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

/** Playback rate at time t for automatic slow motion around the key moment. */
export function autoRate(key: KeyMoment | null, t: number): number {
  if (!key) return 1;
  const d = t < key.t0 ? key.t0 - t : t > key.t1 ? t - key.t1 : 0;
  const w = Math.min(1, d / EASE);
  return KEY_RATE + (1 - KEY_RATE) * w * w * (3 - 2 * w);
}
