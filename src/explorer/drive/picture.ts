/**
 * The end-of-run picture every question ends on: both cars' paths through the key stretch,
 * still, from straight above, north-up (the stretch running bottom to top), each driven from the
 * same start (no stagger); the line the driver aimed for, faint and labelled; each car where the
 * key moment caught it and where it ended; and each car's one number, the one its summary line
 * says (takeaway.ts carNumber), drawn as what it measures:
 *  - a corner: how far its line ended inside or wide of where the driver aimed (braking into a
 *    turn: of its own line at the same speed without the brake, drawn too), a dimension line;
 *  - a stop: how far it took from the brake mark, a dimension along the road;
 *  - push wide: where its first end let go, and at what g;
 *  - a lane change: how long it took to answer the wheel, by where it ended.
 * Sideways distances are drawn SIDEWAYS (state.ts SHOWN: 5) times their size in every picture, with scale bars
 * that say so.
 */
import { create } from 'zustand';
import { betaOf, createState } from '../../sim/model';
import { SCENARIOS, type Path, type PathPoint, type ScenarioId } from '../../sim/scenarios';
import { CATCH_SHOWN_S } from '../../sim/scenarios/catch';
import { sameSpeedPath } from '../../sim/scenarios/trail-brake';
import type { VehicleSpec } from '../../spec/types';
import type { KeyMoment } from './key';
import { laneEventTime, type Lane } from './lanes';
import { SHOWN } from './state';
import { carNumber, MATCHED, PICTURED, pathTone, pathWord, type Outcome } from './takeaway';

/** A car (or an arrow) on the picture: where (m) and which way it points (deg, 0 = up, + =
 *  to the left). */
export interface PicMark {
  u: number;
  v: number;
  deg: number;
  /** a car: which way it goes (deg, as `deg`), against which way it points (`deg`) */
  course?: number;
}

export interface PicCar {
  name: string;
  /** the path it drove, as u, v pairs (m; u to the right, v up), and when it was at each
   *  point (s of sim time), so a live picture can draw it as far as the playhead */
  line: number[];
  ts: number[];
  /** where it ended (the end of the held wheel; of the catch; its stop…), and where the key
   *  moment stopped it (null when that is where it ended, near enough) */
  end: PicMark;
  key: PicMark | null;
  /** its length and width (m) */
  size: [number, number];
  /** its one number, as the picture labels it (its summary line says the same), if any */
  label: string | null;
  /** its outcome in a few words, written on its path (takeaway.ts pathWord), in its colour
   *  (pathTone: red only for a let-go or a spin); and whether an end of it let go (and wasn't
   *  caught) or it spun, for the small pictures of every layout */
  word: string;
  tone: 'out' | 'caught' | 'plain';
  slid: boolean;
  /** the end of it that let go (and wasn't caught), if one did */
  out: 'front' | 'rear' | null;
  /** power out: where its nose points against where it goes, drawn large at its end */
  nose: boolean;
}

/** A dimension: from the reference (b0) to what is measured (a0), drawn as a dimension line
 *  a → b with extension lines out to it. */
export interface PicDim {
  car: 0 | 1;
  a0: [number, number];
  b0: [number, number];
  a: [number, number];
  b: [number, number];
}

/** A marked spot on a car's path (where its first end let go on the skidpad). */
export interface PicSpot {
  car: 0 | 1;
  u: number;
  v: number;
}

export interface PathPicture {
  id: ScenarioId;
  /** sideways distances drawn this many times their size */
  n: number;
  /** the line the driver aimed for, faint (u, v pairs), and where its label goes; none where
   *  it says nothing (a straight stop; braking into a turn, where the same-speed line is the
   *  reference) */
  planned: number[] | null;
  plannedAt: PicMark | null;
  /** which way the cars go, along the planned line */
  arrows: PicMark[];
  /** where the driver did the thing (lifted, braked…), across the planned line, and its name */
  event: (PicMark & { label: string }) | null;
  cars: PicCar[];
  /** braking into a turn: a braked car's line at the same speed without the brake */
  refs: { car: 0 | 1; line: number[]; end: [number, number] }[];
  dims: PicDim[];
  spots: PicSpot[];
}

/** every picture draws sideways distances this many times their size (one scale for all, so
 *  pictures compare: a metre across looks the same in each; the factor everything too small to
 *  see is drawn at, state.ts SHOWN) */
export const SIDEWAYS = SHOWN;
/** a path drawn further off its line than this share of the circle's radius would fold over
 *  its middle: on the skidpad, a path ends there */
const FOLD = 0.6;
/** the stretch: from this far before the event to this far past the furthest end (m) */
const BEFORE_M = 10;
const AFTER_M = 4;
/** the key moment's car is drawn only this many car lengths clear of where it ended */
const APART = 1.2;
/** arrows along the planned line, this far apart (m) */
const ARROW_EVERY = 10;
/** a car's course is read across this much time either side (s) */
const DT_COURSE = 0.04;
/** each car's dimension stands this many car lengths on past its end (car B's a little
 *  further, so the two never sit on each other) */
const DIM_ON = [0.8, 1.6];
/** push wide: each car's path from this long before its first end let go to this long after */
const PAD_BEFORE = 2;
const PAD_AFTER = 2.5;

const pp: PathPoint = { x: 0, n: 0, h: 0, k: 0 };
const st = createState();

/**
 * Where a ground point is along the planned line and off it (s, e; e + = left), starting from a
 * guess at s. The driver's own projection sticks at the line's nodes for a car off a curve, half
 * a metre at a time: harmless for steering, a zigzag drawn at this scale; a few steps square to
 * the line settle it.
 */
function onLine(path: Path, x: number, n: number, s0: number, out: [number, number]) {
  let s = s0;
  for (let k = 0; k < 3; k++) {
    path.at(s, pp);
    s += Math.cos(pp.h) * (x - pp.x) + Math.sin(pp.h) * (n - pp.n);
  }
  path.at(s, pp);
  out[0] = s;
  out[1] = -Math.sin(pp.h) * (x - pp.x) + Math.cos(pp.h) * (n - pp.n);
  return out;
}

/** A lane's car at time t along a line (its planned one, by default) and off it (s, e). */
function laneAt(lane: Lane, t: number, out: [number, number], line = lane.plan.path) {
  lane.rec.sample(t, st);
  return onLine(line, st.x, st.n, lane.rec.sAtTime(t), out);
}

/** When a lane's car came to rest (a stop), or its recording ends. */
function stopTime(lane: Lane): number {
  const rec = lane.rec;
  for (let i = 0; i < rec.count; i++) if (rec.phaseAt(i) >= 2) return rec.get(i, 't');
  return rec.tEnd;
}

/** The stretch of each car's run the picture shows: [from, to] (s of sim time). */
function stretchOf(
  id: ScenarioId,
  lane: Lane,
  te: number,
  key: KeyMoment | null,
): [number, number] {
  const def = SCENARIOS[id];
  switch (id) {
    case 'braking':
      return [NaN, stopTime(lane)];
    case 'skidpad': {
      // round its first end letting go (or, holding on, the end of the speed ramp)
      const t = lane.letGo?.t ?? Math.max(0, lane.rec.tEnd - PAD_AFTER);
      return [Math.max(0, t - PAD_BEFORE), Math.min(lane.rec.tEnd, t + PAD_AFTER)];
    }
    case 'lane-change':
      return [NaN, te + (key ? key.end - key.t : def.key.after)];
    case 'catch':
      return [NaN, te + CATCH_SHOWN_S];
    default:
      return [NaN, te + (def.holdS ?? 1)];
  }
}

/**
 * The picture for a run that has played out, from both cars' recordings and outcomes (the
 * outcomes' values give each number; the recordings, where to draw it). Null when a car never
 * reached its event. With `until`, the picture so far, at a paused moment: the paths up to it,
 * no numbers (the outcomes aren't needed).
 */
export function buildPicture(
  id: ScenarioId,
  lanes: readonly Lane[],
  key: KeyMoment | null,
  cars: readonly Outcome[],
  twin: boolean,
  until?: number,
): PathPicture | null {
  const sofar = until !== undefined;
  if (lanes.length < 2 || (!sofar && cars.length < 2)) return null;
  // so far: the corner questions, where the paths parting is the story (a stop runs straight;
  // on the circle the cars get to their limits at different times)
  if (sofar && !PICTURED.includes(id)) return null;
  const def = SCENARIOS[id];
  const plan = lanes[0].plan;
  // what sideways is measured from: the planned line; a swerve, the straight road, so the
  // swerve itself is drawn as wide as the cars' paths round it
  const swerve = id === 'lane-change';
  const path = swerve ? plan.road : plan.path;
  const pad = id === 'skidpad';
  const te = lanes.map(laneEventTime);
  if (!pad && !te.every(Number.isFinite)) return null;
  const spans = lanes.map((l, i) => stretchOf(id, l, te[i], key));
  const exitT = spans.map((s) => (sofar ? Math.min(s[1], until) : s[1]));
  if (sofar && exitT.some((t, i) => !(t > (pad ? spans[i][0] : te[i])))) return null;
  const n = SIDEWAYS;
  // the skidpad: a path that slides far off the circle ends where it would fold over
  if (pad) {
    const lim = (FOLD * (def.radius ?? 30)) / n;
    const at: [number, number] = [0, 0];
    lanes.forEach((l, i) => {
      for (let t = spans[i][0]; t < exitT[i]; t += 0.05)
        if (Math.abs(laneAt(l, t, at, plan.path)[1]) > lim) {
          exitT[i] = t;
          break;
        }
    });
  }
  const ends = lanes.map((l, i) => laneAt(l, exitT[i], [0, 0], path));
  const sEnd = ends.map((e) => e[0]);
  const eEnd = ends.map((e) => e[1]);
  const lens = lanes.map((l) => l.p.dims.length);
  const longest = Math.max(...lens);
  const startS = lanes.map((l, i) =>
    Number.isFinite(spans[i][0]) ? l.rec.sAtTime(spans[i][0]) : NaN,
  );
  // (a swerve has no single event spot: its stretch starts where its overview does)
  const s0 = pad
    ? Math.min(...startS)
    : Number.isFinite(plan.eventS)
      ? Math.max(0, plan.eventS - BEFORE_M)
      : plan.overview[0];
  const s1 = Math.min(path.length, Math.max(...sEnd) + AFTER_M + DIM_ON[1] * longest);
  const nums = sofar ? [null, null] : cars.map((o) => carNumber(id, o));

  // each path as (s, e) samples: arc length along the planned line, and off it (+ = left)
  const se: [number, number] = [0, 0];
  const times: number[][] = lanes.map(() => []);
  const raw = lanes.map((l, i) => {
    const out: number[] = [];
    const ts = times[i];
    const rec = l.rec;
    const from = spans[i][0];
    for (let k = 0; k < rec.count; k++) {
      const t = rec.get(k, 't');
      if (t >= exitT[i]) break;
      if (Number.isFinite(from) ? t < from : rec.sAt(k) < s0 - 1) continue;
      onLine(path, rec.get(k, 'x'), rec.get(k, 'n'), rec.sAt(k), se);
      if (pad || se[0] >= s0) {
        out.push(se[0], se[1]);
        ts.push(t);
      }
    }
    out.push(sEnd[i], eEnd[i]);
    ts.push(exitT[i]);
    return out;
  });
  // braking into a turn beside another car: each braked car's line at the same speed without
  // the brake, faint (beside car A without the brake, car B is that line, driven)
  const matched = MATCHED.includes(id);
  const refs =
    matched && !twin
      ? lanes.flatMap((l, i) => {
          if (cars[i]?.spun) return [];
          const ref = sameSpeedPath(
            l.rec.toTrace(2),
            l.p,
            path,
            sofar ? exitT[i] : Infinity,
            def.holdS,
          );
          if (!ref) return [];
          const pts: number[] = [];
          let hint = l.rec.sAtTime(te[i]);
          for (let k = 0; k < ref.x.length; k++) {
            hint = onLine(path, ref.x[k], ref.n[k], path.project(ref.x[k], ref.n[k], hint), se)[0];
            pts.push(se[0], se[1]);
          }
          return [{ car: i as 0 | 1, se: pts }];
        })
      : [];

  // north-up: the stretch from its start to its end runs up the picture (the skidpad's circle
  // the way it starts)
  const a = path.at(pad ? 0 : s0, { ...pp });
  const b = path.at(s1, { ...pp });
  const rot = pad ? Math.PI / 2 - a.h : Math.PI / 2 - Math.atan2(b.n - a.n, b.x - a.x);

  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  const map = (s: number, e: number): [number, number] => {
    path.at(s, pp);
    const x = pp.x - Math.sin(pp.h) * n * e - a.x;
    const y = pp.n + Math.cos(pp.h) * n * e - a.n;
    return [cr * x - sr * y, sr * x + cr * y];
  };
  const line = (p: readonly number[]) => {
    const out: number[] = [];
    for (let k = 0; k + 1 < p.length; k += 2) out.push(...map(p[k], p[k + 1]));
    return out;
  };
  const heading = (s: number) => {
    const [u, v] = map(s, 0);
    const [u1, v1] = map(s + 0.5, 0);
    return ((Math.atan2(v1 - v, u1 - u) - Math.PI / 2) * 180) / Math.PI;
  };
  /** a car at time t: where, and which way it points (its course on the picture, less the
   *  angle between where it points and where it goes) */
  const mark = (l: Lane, t: number): PicMark => {
    const [u, v] = map(...laneAt(l, t, se, path));
    const [u0, v0] = map(...laneAt(l, t - DT_COURSE, se, path));
    const [u1, v1] = map(...laneAt(l, t + DT_COURSE, se, path));
    l.rec.sample(t, st);
    const moving = Math.hypot(st.vx, st.vy) > 0.5;
    // at rest it points the way the road runs
    const course = moving
      ? Math.atan2(v1 - v0, u1 - u0)
      : Math.PI / 2 + (heading(l.rec.sAtTime(t)) * Math.PI) / 180;
    return {
      u,
      v,
      deg: ((course - (moving ? betaOf(st) : 0) - Math.PI / 2) * 180) / Math.PI,
      course: ((course - Math.PI / 2) * 180) / Math.PI,
    };
  };

  // the line the driver aimed for: on the corner questions and the swerve (a straight stop and
  // a circle say nothing with it, and braking into a turn has its own reference)
  const aimed = id !== 'braking' && !matched;
  const planned: number[] = [];
  // the planned path on the picture (a swerve: off the straight road)
  const at = (s: number) =>
    swerve ? map(...onLine(path, plan.path.at(s, pp).x, pp.n, s, se)) : map(s, 0);
  if (aimed) {
    const lo = pad ? 0 : s0;
    const hi = pad ? 2 * Math.PI * (def.radius ?? 30) : s1;
    for (let s = lo; s < hi; s += 1) planned.push(...at(s));
    planned.push(...at(hi));
  }
  const arrows: PicMark[] = [];
  if (!pad)
    for (let s = s0 + 3; s < s1 - 2; s += ARROW_EVERY) {
      const [u, v] = at(s);
      const [u1, v1] = at(s + 0.5);
      arrows.push({ u, v, deg: ((Math.atan2(v1 - v, u1 - u) - Math.PI / 2) * 180) / Math.PI });
    }
  const plannedAt = aimed
    ? (() => {
        // low down, where both paths still run on it
        const s = pad ? Math.PI * (def.radius ?? 30) : Math.min(s1, s0 + 3);
        const [u, v] = map(s, 0);
        return { u, v, deg: heading(s) };
      })()
    : null;

  // (the picture so far ends where the run is paused)
  const stop = sofar ? undefined : key?.freeze[0];
  const picCars = lanes.map((l, i): PicCar => {
    const end = mark(l, exitT[i]);
    let km: PicMark | null = null;
    const from = pad ? spans[i][0] : te[i];
    if (stop !== undefined && stop >= from && stop < exitT[i]) {
      const k = mark(l, stop);
      if (Math.hypot(k.u - end.u, k.v - end.v) > APART * lens[i]) km = k;
    }
    return {
      name: l.info.label ?? l.info.name,
      line: line(raw[i]),
      ts: times[i],
      end,
      key: km,
      size: [l.p.dims.length, l.p.dims.width],
      label: nums[i]?.label ?? null,
      word: sofar ? '' : pathWord(id, cars[i]),
      tone: sofar ? 'plain' : pathTone(id, cars[i]),
      slid: !sofar && (cars[i].spun || (!!cars[i].letGo && cars[i].verdict !== 'caught')),
      out: !sofar && cars[i].letGo && cars[i].verdict !== 'caught' ? cars[i].letGo!.axle : null,
      nose: id === 'power-exit',
    };
  });

  const picRefs = refs.map((r) => {
    const ln = line(r.se);
    return {
      car: r.car,
      line: ln,
      end: [ln[ln.length - 2], ln[ln.length - 1]] as [number, number],
    };
  });

  const dims: PicDim[] = [];
  const spots: PicSpot[] = [];
  lanes.forEach((l, i) => {
    const c = i as 0 | 1;
    // (power out: a rear sliding out is its nose against its path, drawn at the car, not metres;
    // a car that spun is said so, its metres meaning little beside that)
    if (!nums[i] || nums[i]!.side === 'nose' || cars[i]?.spun) return;
    // a stop: its number is the load moved, said by the car; no distance is drawn (the spec's tyre
    // grip is too rough a figure for the distance to be the car's own)
    if (id === 'braking') return;
    if (id === 'skidpad') {
      if (l.letGo) {
        const [u, v] = map(...laneAt(l, l.letGo.t, se, path));
        spots.push({ car: c, u, v });
      }
    } else if (PICTURED.includes(id)) {
      // across the road: from its reference to where its path ended, on past both (braking
      // into a turn beside car A without the brake: car B, where it ended, is the reference)
      const r = refs.find((x) => x.car === i);
      const pair = matched && twin && i === 0;
      const [sb, eb] = r
        ? [r.se[r.se.length - 2], r.se[r.se.length - 1]]
        : pair
          ? [sEnd[1], eEnd[1]]
          : [sEnd[i], 0];
      const on = Math.max(sEnd[i], sb) + DIM_ON[i] * lens[i];
      dims.push({
        car: c,
        a0: map(sEnd[i], eEnd[i]),
        b0: r || pair ? map(sb, eb) : map(on, 0),
        a: map(on, eEnd[i]),
        b: map(on, eb),
      });
    }
  });

  let event: PathPicture['event'] = null;
  if (Number.isFinite(plan.eventS)) {
    const [u, v] = map(plan.eventS, 0);
    event = { u, v, deg: heading(plan.eventS), label: def.event ?? '' };
  }
  return {
    id,
    n,
    planned: aimed ? planned : null,
    plannedAt,
    arrows,
    event,
    cars: picCars,
    refs: picRefs,
    dims,
    spots,
  };
}

/** The picture of the run just driven (null until there is one), whether it is showing, and
 *  the car and speed it was driven with (every layout's same test is like it). */
export const usePathPicture = create<{
  pic: PathPicture | null;
  open: boolean;
  car: VehicleSpec | null;
  kmh: number;
}>()(() => ({
  pic: null,
  open: false,
  car: null,
  kmh: 0,
}));

/** How each question ends: every one plays its key moment again first, from above (the same
 *  way whatever happened: a spin, a slide that gripped again, or nothing at all), then ends on
 *  its picture. */
export const REPLAY_FIRST: readonly ScenarioId[] = Object.keys(SCENARIOS) as ScenarioId[];
