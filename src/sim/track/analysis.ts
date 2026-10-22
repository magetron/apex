/**
 * Comparing hot laps: where each car gains or loses against car A, and in what kind of road.
 * All laps of one track share the same samples, so comparisons are sample by sample.
 */
import { PHASES, type Lap, type Phase } from './lap';
import type { TrackPath } from './types';

/** Time gap to `ref` at every sample (s, + = behind it); n + 1 values, the last the lap gap. */
export function deltaTrace(ref: Lap, lap: Lap): Float64Array {
  const out = new Float64Array(ref.n + 1);
  for (let i = 0; i <= ref.n; i++) out[i] = lap.t[i] - ref.t[i];
  return out;
}

export interface Split {
  phase: Phase;
  /** how long car A spends in this kind of road (s), and its share of the lap */
  time: number;
  share: number;
  /** each lap's time over the same stretches minus car A's (s, + = slower), in lap order */
  deltas: number[];
}

/**
 * Where the time goes: the lap cut into the stretches where car A brakes, corners and is on the
 * power, each car timed over exactly those stretches. The deltas of the three add up to the gap.
 */
export function timeSplit(laps: Lap[]): Split[] {
  const ref = laps[0];
  return PHASES.map((phase, k) => {
    let time = 0;
    const deltas = laps.map(() => 0);
    for (let i = 0; i < ref.n; i++) {
      if (ref.phase[i] !== k) continue;
      const dt = ref.t[i + 1] - ref.t[i];
      time += dt;
      laps.forEach((l, j) => (deltas[j] += l.t[i + 1] - l.t[i] - dt));
    }
    return { phase, time, share: time / ref.time, deltas };
  });
}

/** Which lap is fastest in each sector (index into `laps`). */
export function sectorBest(laps: Lap[]): number[] {
  if (!laps.length) return [];
  return laps[0].sectors.map((_, s) =>
    laps.reduce((best, l, j) => (l.sectors[s] < laps[best].sectors[s] ? j : best), 0),
  );
}

/** Sample index a car has reached at time t into its lap (fractional), wrapping onto the
 *  next lap: a binary search in its time trace. */
export function sampleAt(lap: Lap, t: number): number {
  const laps = Math.floor(t / lap.time);
  const tt = t - laps * lap.time;
  let lo = 0;
  let hi = lap.n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lap.t[mid] <= tt) lo = mid;
    else hi = mid;
  }
  const span = lap.t[hi] - lap.t[lo];
  return laps * lap.n + lo + (span > 0 ? (tt - lap.t[lo]) / span : 0);
}

/** "1:23.45" */
export function lapTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return m ? `${m}:${sec.toFixed(2).padStart(5, '0')}` : sec.toFixed(2);
}

/** "+1.23" / "−0.45" */
export const gapText = (s: number) =>
  `${s >= 0 ? '+' : '−'}${Math.abs(s).toFixed(Math.abs(s) < 10 ? 2 : 1)}`;

// ── where the gap changes ────────────────────────────────────────────────────────────────

export interface Section {
  /** "Parabolica", or the straight before it */
  name: string;
  kind: 'corner' | 'run';
  /** centreline distance (m) */
  s0: number;
  s1: number;
}

/** shortest straight worth naming as its own section (m) */
const MIN_RUN = 80;

/** The lap cut into its named corners and the runs between them (the last run is to the line). */
export function sections(path: TrackPath): Section[] {
  const out: Section[] = [];
  let at = 0;
  const run = (to: number, next: string) => {
    if (to - at >= MIN_RUN) out.push({ name: next, kind: 'run', s0: at, s1: to });
  };
  for (const c of path.corners) {
    run(c.s0, c.name);
    out.push({ name: c.name, kind: 'corner', s0: Math.max(at, c.s0), s1: c.s1 });
    at = c.s1;
  }
  run(path.length, '');
  return out;
}

export interface Moment {
  /** which lap (index into the laps compared; never car A's) */
  car: number;
  section: Section;
  /** gap change over the section (s, + = loses time to car A) */
  change: number;
}

const gapAt = (ref: Lap, lap: Lap, s: number, ds: number) => {
  const i = Math.min(ref.n, Math.max(0, Math.round(s / ds)));
  return lap.t[i] - ref.t[i];
};

/**
 * Where the gaps to car A change most: every compared car's gap change over each section, the
 * biggest few (at most two per car, none too small to matter).
 */
export function keyMoments(laps: Lap[], path: TrackPath, most = 3): Moment[] {
  const ref = laps[0];
  const secs = sections(path);
  const all: Moment[] = [];
  laps.forEach((lap, car) => {
    if (!car) return;
    const floor = Math.max(0.25, 0.08 * Math.abs(lap.time - ref.time));
    for (const section of secs) {
      const change = gapAt(ref, lap, section.s1, path.ds) - gapAt(ref, lap, section.s0, path.ds);
      if (Math.abs(change) >= floor) all.push({ car, section, change });
    }
  });
  all.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const out: Moment[] = [];
  const per = new Map<number, number>();
  for (const m of all) {
    if ((per.get(m.car) ?? 0) >= 2) continue;
    per.set(m.car, (per.get(m.car) ?? 0) + 1);
    out.push(m);
    if (out.length >= most) break;
  }
  return out;
}

// ── the race as it runs ──────────────────────────────────────────────────────────────────

/** Time car `lap` was at fractional sample f of its lap (s). */
function timeAt(lap: Lap, f: number): number {
  const i = Math.max(0, Math.min(lap.n - 1, Math.floor(f)));
  return lap.t[i] + (lap.t[i + 1] - lap.t[i]) * Math.max(0, Math.min(1, f - i));
}

/** How far round its lap a car has got at time t (fractional samples; n once home). */
export const progressAt = (lap: Lap, t: number) =>
  t >= lap.time ? lap.n + (t - lap.time) : sampleAt(lap, Math.max(0, t));

/**
 * The live interval between a car and car A at time t, as a commentator gives it (s; + = behind
 * car A): how long ago the car in front passed the point where the other one is now.
 */
export function interval(ref: Lap, lap: Lap, t: number): number {
  const fr = Math.min(ref.n, progressAt(ref, t));
  const fl = Math.min(lap.n, progressAt(lap, t));
  if (fl <= fr) return fl >= lap.n ? lap.time - ref.time : t - timeAt(ref, fl);
  return fr >= ref.n ? lap.time - ref.time : -(t - timeAt(lap, fr));
}

/** Lap indexes in race order at time t: finished first by time, then the furthest round. */
export function raceOrder(laps: Lap[], t: number): number[] {
  return laps
    .map((l, k) => ({ k, done: t >= l.time, time: l.time, f: progressAt(l, t) / l.n }))
    .sort((a, b) => (a.done && b.done ? a.time - b.time : a.done ? -1 : b.done ? 1 : b.f - a.f))
    .map((x) => x.k);
}
