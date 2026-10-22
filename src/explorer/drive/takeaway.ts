/**
 * What a run showed, in plain words: one line per car and one lesson for the scenario, both
 * derived from the results, never written per car. The lesson names the cause the scenario is
 * about (where the load went, which tyres it asked for grip) and claims a pattern only when the
 * results show it; otherwise it says what the cars did show. No codes, no units a first-year
 * student would have to look up: "front-drive", "ran 27% wider", "turned 95 ms after the wheel".
 */
import type { CarParams } from '../../sim/model';
import { FZ0_PER_MM } from '../../sim/model/params';
import { LINE_M } from '../../sim/scenarios/corner';
import { responseFactors } from '../../sim/scenarios/lane-change';
import { VERDICTS, type MetricId, type ScenarioId, type Verdict } from '../../sim/scenarios';

export interface Outcome {
  /** layout code ("FR") and the model without its make ("M340i") */
  code: string;
  model: string;
  /** what a twin is ("No lift", "Less rear grip"), named instead of its model */
  label?: string;
  driven: 'front' | 'rear' | 'all';
  /** static share of the weight on the front axle, and the most it carried in the run (0..1) */
  front: number;
  frontMax: number;
  /** its share just before the scenario's event (the freeze frame's "before"); the static
   *  share where there is no event */
  frontBefore?: number;
  /** the front's share of the load that moves across the car in a turn (roll stiffness) */
  rollF: number;
  /** yaw inertia over m·a·b: above 1, mass sits out beyond the axles */
  dynIndex: number;
  /** CG height over wheelbase: how much load a stop can move */
  cgOverL: number;
  /** rear tyres wider than the fronts */
  widerRear: boolean;
  /** tyre widths, front and rear (mm, the spec's) */
  tyreF: number;
  tyreR: number;
  /** the rear tyres' grip relative to the car as built (the push-wide twins) */
  rearGrip: number;
  /** the car's sim parameters, for what-if runs (why one car answers the wheel later) */
  p?: CarParams;
  values: Partial<Record<MetricId, number>>;
  verdict: Verdict | null;
  spun: boolean;
  letGo: { axle: 'front' | 'rear'; g: number } | null;
}

export type Tone = 'under' | 'over' | 'spin' | 'calm';

/** Layout facts the lessons lean on, from a car's sim parameters (and the as-built car's,
 *  for a tuned twin). */
export function layoutFacts(
  p: CarParams,
  asBuilt: CarParams = p,
): Pick<
  Outcome,
  | 'driven'
  | 'front'
  | 'rollF'
  | 'dynIndex'
  | 'cgOverL'
  | 'widerRear'
  | 'tyreF'
  | 'tyreR'
  | 'rearGrip'
> {
  return {
    driven: p.front.driven && p.rear.driven ? 'all' : p.front.driven ? 'front' : 'rear',
    front: p.b / p.L,
    rollF: p.front.rollShare,
    dynIndex: p.izz / (p.m * p.a * p.b),
    cgOverL: p.h / p.L,
    widerRear: p.rear.fz0 > p.front.fz0 * 1.02,
    tyreF: Math.round(p.front.fz0 / FZ0_PER_MM),
    tyreR: Math.round(p.rear.fz0 / FZ0_PER_MM),
    rearGrip: p.rear.mu / asBuilt.rear.mu,
  };
}

const TWO_WORD_MAKES = ['Alfa Romeo', 'Aston Martin', 'Land Rover'];

/** "M340i", "718 Boxster T": the model without its make or generation. */
export function modelName(name: string): string {
  const short = name.replace(/\s*\(.*\)$/, '');
  const make = TWO_WORD_MAKES.find((m) => short.startsWith(`${m} `));
  if (make) return short.slice(make.length + 1);
  return short.split(' ').slice(1).join(' ') || short;
}

const share = (x: number) => `${Math.round(100 * x)}%`;
const join = (...parts: (string | false | null | undefined)[]) =>
  parts.filter((p): p is string => !!p).join(', ');
const letGoText = (o: Outcome) =>
  o.letGo && (o.spun ? `${o.letGo.axle} tyres let go` : `${o.letGo.axle} tyres slid`);

/** The corner questions, whose result is where each car's line ended up, in metres. */
export const PICTURED: readonly ScenarioId[] = [
  'lift-off',
  'power-exit',
  'catch',
  'trail-brake',
  'left-foot',
];

/** The questions whose line is judged at matched speed: against the same car at the speed it
 *  had at each moment, without the brake (slowing down alone tightens a line). */
export const MATCHED: readonly ScenarioId[] = ['trail-brake', 'left-foot'];

/** a line ending closer than this to its reference (m) is on it: no number, no gap marked
 *  (the same threshold that sorts "tighter" from "wider" from neither: corner.ts LINE_M) */
export const MIN_GAP = LINE_M;

/** A distance as written on the picture and in the summary, one decimal. */
export const metres = (m: number) => `${m.toFixed(1)} m`;

/**
 * Where a car's line ended against its reference (m, + = inside the turn), the one measure the
 * summary, the every-layout list and the picture all use: the line the driver aimed for; braking
 * into a turn, the car's own line at the same speed without the brake (slowing down alone
 * tightens a line, so that doesn't count). Undefined off the corner questions.
 */
export function lineOff(id: ScenarioId, o: Outcome): number | undefined {
  if (!PICTURED.includes(id)) return undefined;
  const d = MATCHED.includes(id) ? o.values.sameSpeedShift : o.values.exitErr;
  return d !== undefined && Number.isFinite(d) ? d : undefined;
}

/** What a car's line is measured against, in words. */
export const refWords = (id: ScenarioId) =>
  MATCHED.includes(id) ? 'its line at the same speed without brake' : 'where the driver aimed';

/**
 * The one number a car's summary line says, as the line writes it (`value`) and as the picture
 * labels the car with it (`label`): where its line ended against its reference, the distance it
 * moved onto its front tyres, the g its first end let go at, how soon it answered the wheel. Null where
 * the line says no number.
 */
export interface CarNumber {
  value: string;
  label: string;
  /** a distance off the line: which side of its reference it ended; or an angle, the nose
   *  turned in from its path */
  side?: 'inside' | 'wide' | 'nose';
}

export function carNumber(id: ScenarioId, o: Outcome): CarNumber | null {
  const v = o.values;
  switch (id) {
    case 'braking': {
      // the load moved, from its share at rest (the layout chip's) to the most braking put there;
      // no stopping distance: every car's tyres here are the spec's rough grip figure, so the
      // distances say little about the real cars
      const value = share(o.frontMax);
      return { value, label: `front load ${share(o.front)} at rest → ${value}` };
    }
    case 'skidpad': {
      if (o.letGo) {
        const value = `${o.letGo.g.toFixed(2)} g`;
        return { value, label: `${o.letGo.axle} tyres let go at ${value}` };
      }
      const value = `${(v.maxAy ?? 0).toFixed(2)} g`;
      return { value, label: `held to ${value}` };
    }
    case 'lane-change': {
      if (!Number.isFinite(v.yawResponse)) return null;
      const value = `${(v.yawResponse! / 1000).toFixed(2)} s`;
      return { value, label: `90% of its turn rate ${value} after the wheel` };
    }
    default: {
      // power out: a rear sliding out shows as the nose turned in from the path, not as metres
      // (its path can still run wide); the run-wide car says its metres, its nose along its path
      if (id === 'power-exit' && slidOut(o)) {
        const value = `${Math.round(Math.abs(v.exitSwing ?? 0))}°`;
        return {
          value,
          label: `nose ${value} inside its path: rear slid out${o.spun ? ', then spun' : ''}`,
          side: 'nose',
        };
      }
      const d = lineOff(id, o);
      if (d === undefined || Math.abs(d) < MIN_GAP) return null;
      const value = metres(Math.abs(d));
      const then = o.spun ? ', then spun' : '';
      if (id === 'power-exit' && d < 0)
        return {
          value,
          label: `${along(o) ? 'nose along its path, ' : ''}ran ${value} wide: front pushed`,
          side: 'wide',
        };
      if (MATCHED.includes(id))
        return d > 0
          ? { value, label: `${value} tighter`, side: 'inside' }
          : { value, label: `${value} wider`, side: 'wide' };
      return d > 0
        ? { value, label: `${value} inside${then}`, side: 'inside' }
        : { value, label: `${value} wide${then}`, side: 'wide' };
    }
  }
}

/**
 * A car's outcome in a few words, written on its path in the picture of both lines: its one
 * number (carNumber) said as the picture shows it ("1.3 m tighter", "rear out 12°", "spun").
 */
export function pathWord(id: ScenarioId, o: Outcome): string {
  if (o.spun) return 'spun';
  const v = o.values;
  switch (id) {
    case 'braking':
      return `front ${share(o.front)}→${share(o.frontMax)}`;
    case 'skidpad':
      return o.letGo
        ? `${o.letGo.axle} first, ${o.letGo.g.toFixed(2)} g`
        : `held ${(v.maxAy ?? 0).toFixed(2)} g`;
    case 'lane-change': {
      const n = carNumber(id, o);
      return n ? `turns in ${n.value}` : '';
    }
    case 'catch':
      if (o.verdict === 'caught') return 'caught';
      return carNumber(id, o) ? lineWords(id, o) : 'no slide';
    default:
      return lineWords(id, o);
  }
}

/**
 * The colour a car's outcome words take on the picture: red only where an end of it let go or
 * it spun (a rear out, a spin, the end that went first on the skidpad), the recovery colour for
 * a slide caught, plain for where its line went.
 */
export function pathTone(id: ScenarioId, o: Outcome): 'out' | 'caught' | 'plain' {
  if (o.spun) return 'out';
  if (id === 'skidpad') return o.letGo ? 'out' : 'plain';
  if (o.verdict === 'caught') return 'caught';
  return carNumber(id, o)?.side === 'nose' ? 'out' : 'plain';
}

/** Where a corner's line ended against its reference, in a few words. */
function lineWords(id: ScenarioId, o: Outcome): string {
  const n = carNumber(id, o);
  if (!n) return 'on line';
  if (n.side === 'nose') return `rear out ${n.value}`;
  return `${n.value} ${n.side === 'inside' ? 'tighter' : 'wider'}`;
}

/** power out: its rear slid out (the tail swung, or it spun), its nose turned in from its path */
const slidOut = (o: Outcome) =>
  o.verdict === 'tail' || o.verdict === 'spin' || o.spun || (o.values.exitSwing ?? 0) >= 2;
/** its nose still points along its path (under 2°) */
const along = (o: Outcome) => Math.abs(o.values.exitSwing ?? 0) < 2;

/** what the driver does, as the subject of "barely changed its line" */
const DOING: Partial<Record<ScenarioId, string>> = {
  'lift-off': 'lifting',
  'power-exit': 'the throttle',
  'trail-brake': 'braking',
  'left-foot': 'braking',
  catch: 'the lift',
};
/** car B, the same car without the technique: its line is the normal one */
const WITHOUT: Partial<Record<ScenarioId, string>> = {
  'lift-off': 'no lift',
  'power-exit': 'no throttle',
  'trail-brake': 'no brake',
  'left-foot': 'no brake',
  catch: 'no catch',
};

/**
 * Where a car's line ended, in words that follow its number: "turned tighter, 0.7 m inside where
 * the driver aimed", "ran 0.7 m wide of where the driver aimed"; on its reference, "braking
 * barely changed its line", or for car B without the technique, "no brake: normal line".
 * `always`: say the words even with no number.
 */
function lineClause(id: ScenarioId, o: Outcome, twin: boolean, always = true): string | null {
  const n = carNumber(id, o);
  if (!n) {
    if (!always) return null;
    if (twin && MATCHED.includes(id) && o.values.speedIn && o.values.speedOut)
      return `reference: car A's speed (${Math.round(o.values.speedIn)} → ${Math.round(o.values.speedOut)} km/h), no brake`;
    return twin
      ? `${WITHOUT[id] ?? 'without it'}: normal line`
      : `${DOING[id]} barely changed its line`;
  }
  if (MATCHED.includes(id))
    return n.side === 'inside'
      ? `turned ${n.value} tighter than the same car at the same speed without brake`
      : `ran ${n.value} wider than the same car at the same speed without brake`;
  return n.side === 'inside'
    ? `${o.spun ? 'slid' : 'turned tighter,'} ${n.value} inside ${refWords(id)}`
    : `ran ${n.value} wide of ${refWords(id)}`;
}

/**
 * How a car came out of the run, as a clause ("rear let go, spun"), with the one number the
 * picture labels it with. `twin`: this is car B, the same car without the technique.
 */
export function carLine(id: ScenarioId, o: Outcome, opts: { twin?: boolean } = {}): string {
  const v = o.values;
  const twin = !!opts.twin;
  switch (id) {
    case 'braking':
      return `front load ${share(o.front)} at rest → ${share(o.frontMax)} braking`;
    case 'skidpad':
      return join(
        o.letGo
          ? `${o.letGo.axle} tyres let go first, at ${carNumber(id, o)!.value}`
          : `held on to ${carNumber(id, o)!.value}`,
        o.spun && 'then spun',
      );
    case 'lane-change':
      return `reached 90% of its turn rate ${carNumber(id, o)?.value ?? '?'} after the wheel`;
    case 'catch':
      if (o.spun) return join(letGoText(o), 'spun', lineClause(id, o, twin, false));
      // "swung": where it points against where it goes, as the freeze frame draws it
      if (o.verdict === 'caught')
        return join(
          `swung out ${Math.round(v.maxSwing ?? 0)}° at most, caught with ${Math.round(v.counterDeg ?? 0)}° of opposite lock`,
          lineClause(id, o, twin, false),
        );
      return join('never slid', lineClause(id, o, twin, false));
    default: {
      // power out: rotation first (the rear sliding out turns the nose in), the metres for a car
      // that ran wide
      const n = carNumber(id, o);
      if (id === 'power-exit' && n?.side === 'nose')
        return `rear slid out: nose ${n.value} inside its path${o.spun ? ', then spun' : ''}`;
      if (id === 'power-exit' && n?.side === 'wide')
        return `front pushed: ran ${n.value} wide of where the driver aimed${along(o) ? ', nose along its path' : ''}`;
      // the corner techniques: where the line ended as the held wheel ended (the freeze frame
      // says "so far"), in metres against its reference
      switch (o.verdict) {
        case 'spin':
          return join(letGoText(o), 'spun', lineClause(id, o, twin, false));
        case 'tail':
          return join(
            letGoText(o),
            (v.swingRate ?? 0) > 1
              ? `swung out ${Math.round(v.maxSwing ?? 0)}° by the end of the held wheel and still going`
              : `swung out ${Math.round(v.maxSwing ?? 0)}° at most, then gripped again`,
            lineClause(id, o, twin, false),
          );
        case 'wide':
          return join(letGoText(o), lineClause(id, o, twin));
        default:
          return lineClause(id, o, twin) ?? '';
      }
    }
  }
}

/**
 * Each car's summary line at the end of a two-car run, as the info card writes it. `twin`:
 * car B is car A without the technique.
 */
export function summaryLines(id: ScenarioId, cars: readonly Outcome[], twin = false): string[] {
  return cars.map((o, i) => carLine(id, o, { twin: twin && i === 1 }));
}

/**
 * How far a car's outcome goes in what the question is about, to rank every layout by: a spin
 * or a tail swinging out above a line that tightened, above one that held or ran wide; the end
 * that let go on the skidpad (rear above front, then the g it held); the load moved in a stop;
 * the quickest answer to the wheel.
 */
export function rankOf(id: ScenarioId, o: Outcome): number {
  const v = o.values;
  switch (id) {
    case 'braking':
      return o.frontMax - o.front;
    case 'skidpad':
      return o.letGo ? (o.letGo.axle === 'rear' ? 10 : 5) - o.letGo.g : 0;
    case 'lane-change':
      return -(v.yawResponse ?? 0);
    case 'catch':
      return o.spun ? 1000 : o.verdict === 'caught' ? 100 + (v.maxSlip ?? 0) : 0;
    default:
      if (o.spun) return 1000;
      if (o.verdict === 'tail') return 500 + (v.slipChange ?? 0);
      return (MATCHED.includes(id) ? v.sameSpeedTighter : undefined) ?? v.lineChange ?? 0;
  }
}

/** The colour a car's line reads in: its verdict's, calm without one. */
export const toneOf = (o: Outcome): Tone =>
  o.spun ? 'spin' : o.verdict ? VERDICTS[o.verdict].tone : 'calm';

/** Spearman rank correlation (ties share their mean rank); NaN for fewer than 3 cars. */
export function rankCorr(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  if (n < 3 || ys.length !== n) return NaN;
  const rank = (a: readonly number[]) => {
    const order = a.map((_, i) => i).sort((i, j) => a[i] - a[j]);
    const r = new Array<number>(n);
    for (let i = 0; i < n;) {
      let j = i;
      while (j + 1 < n && a[order[j + 1]] === a[order[i]]) j++;
      for (let k = i; k <= j; k++) r[order[k]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const m = (n + 1) / 2;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (rx[i] - m) * (ry[i] - m);
    sxx += (rx[i] - m) ** 2;
    syy += (ry[i] - m) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** a rank correlation this strong counts as a pattern worth stating */
const TREND = 0.7;

/** "the M340i", "the 911 and the 718": cars by model, or by what a twin is. */
function names(cars: readonly Outcome[]): string {
  const one = (o: Outcome) => (o.label ? o.label.toLowerCase() : `the ${o.model}`);
  const list = cars.map(one);
  return list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

const best = (cars: readonly Outcome[], f: (o: Outcome) => number, max: boolean) =>
  cars
    .filter((o) => Number.isFinite(f(o)))
    .reduce<Outcome | null>((b, o) => (!b || (max ? f(o) > f(b) : f(o) < f(b)) ? o : b), null);

const over = (o: Outcome) => o.spun || o.verdict === 'spin' || o.verdict === 'tail';

const DRIVEN = { front: 'front-drive', rear: 'rear-drive', all: 'all-wheel drive' } as const;

/** What to change when the two cars chosen don't show the question's point. */
const HINT: Partial<Record<ScenarioId, string>> = {
  'lift-off': 'raise the speed or pick a rear-engined car',
  catch: 'raise the speed or pick a rear-engined car',
  'power-exit': 'raise the speed or pick a car with its weight or its drive at the other end',
  'trail-brake': 'raise the speed or pick a car with more weight at the back',
  'left-foot': 'raise the speed or pick a front-drive car',
};

/** Trying each of the slower car's traits on the faster one (lane-change.ts responseFactors):
 *  the ones that slow it most, in words, with how much. Cached per pair. */
const factorCache = new WeakMap<CarParams, WeakMap<CarParams, string>>();
function laneFactors(fast: Outcome, slow: Outcome): string {
  const pf = fast.p;
  const ps = slow.p;
  const v = (fast.values.speedIn ?? NaN) / 3.6;
  if (!pf || !ps || !Number.isFinite(v)) return '';
  const hit = factorCache.get(pf)?.get(ps);
  if (hit !== undefined) return hit;
  const all = responseFactors(pf, ps, v).filter((f) => f.dt > 0.003);
  const top = all.filter((f) => f.dt >= 0.35 * (all[0]?.dt ?? 0)).slice(0, 2);
  const k = (p: CarParams) => p.izz / (p.m * p.a * p.b);
  const words = (f: (typeof top)[number]) => {
    const ms = `${Math.round(1000 * f.dt)} ms`;
    switch (f.factor) {
      case 'weight split':
        return `its weight split (${share(ps.b / ps.L)} on the front tyres, against ${share(pf.b / pf.L)}) adds ${ms}`;
      case 'yaw inertia':
        return `its yaw inertia for its size (${k(ps).toFixed(2)} against ${k(pf).toFixed(2)}) adds ${ms}`;
      case 'tyres':
        return `its tyres add ${ms}`;
      case 'mass':
        return `its ${Math.round(ps.m)} kg against ${Math.round(pf.m)} kg adds ${ms}`;
      case 'wheelbase':
        return `its ${ps.L.toFixed(2)} m wheelbase against ${pf.L.toFixed(2)} m adds ${ms}`;
    }
  };
  const text = top.length
    ? `Given to the ${fast.model} one at a time, the ${slow.model}'s ${top.map((f, i) => (i ? words(f) : words(f).replace(/^its /, ''))).join('; ')}.`
    : '';
  let inner = factorCache.get(pf);
  if (!inner) factorCache.set(pf, (inner = new WeakMap()));
  inner.set(ps, text);
  return text;
}

/** "front", "rear", "all four": the tyres a car's engine braking slows it through */
const PAIR = { front: 'front', rear: 'rear', all: 'all four' } as const;

/**
 * Why a road car's front reaches its limit first: its set-up. Every car here gets the same rule a
 * road car is tuned by, more of the roll stiffness at the front than its share of the weight,
 * so in a turn the front tyres carry more of the load that moves across and run out first.
 * (Tyre width isn't it: grip is μ times load, and a wider tyre adds little.)
 */
function setupWords(o: Outcome): string {
  return `the ${o.model}'s front tyres take a bigger share of the load moved across in a turn (${share(o.rollF)}) than of its weight (${share(o.front)})`;
}

/**
 * A line under the every-layout list where its order would surprise: putting power down, the
 * rear-engined car swings out less than the front-engined rear-driver, though lifting showed it
 * the most tail-happy. The engine's weight over the driven wheels is grip to push with.
 */
export function tableNote(
  id: ScenarioId,
  rows: readonly {
    family: string;
    tail: boolean;
    swing: number;
    first?: 'front' | 'rear' | null;
  }[],
): string {
  // pushed to the limit, every layout lets go at the front first: understeer at the limit is
  // how road cars are set up (roll stiffness, alignment), not where their engine sits
  if (id === 'skidpad')
    return rows.length > 1 && rows.every((r) => r.first === 'front')
      ? 'Every layout here lets go at the front first: road cars are set up to (more roll stiffness at the front, the alignment). Where the engine sits decides how much of that set-up a car needs, like the 911’s much wider rear tyres.'
      : '';
  if (id !== 'power-exit') return '';
  const rr = rows.find((r) => r.family === 'RR');
  const fr = rows.find((r) => r.family === 'FR');
  if (!rr || !fr || !rr.tail || !fr.tail || !(rr.swing < fr.swing)) return '';
  return 'The rear-engined car swings out less: its engine’s weight over the driven rear wheels gives them grip to push with.';
}

/**
 * Where to look during the run, in a few words: the part of the scene that answers the
 * question, never the answer itself (that is for the cars to show).
 */
export function watchFor(id: ScenarioId): string {
  switch (id) {
    case 'lift-off':
      return "each car's rear tyres when the driver lifts";
    case 'power-exit':
      return "each car's nose against its path when the throttle goes on";
    case 'catch':
      return 'the front wheels once the rear starts to slide';
    case 'trail-brake':
      return 'the two lines once the brake goes on';
    case 'braking':
      return 'the bars over the axles as the cars brake';
    case 'left-foot':
      return 'the two lines once the brake goes on';
    case 'skidpad':
      return 'both ends of each car as the speed rises';
    case 'lane-change':
      return 'how soon each car turns after its wheel';
  }
}

/**
 * The scenario's lesson: the question answered plainly first ("Yes: …", "It depends on …: …"),
 * from the cars' outcomes and with the numbers their rows say, then its cause in one short
 * clause. The visitor's car first, then what it was compared with. `twin`: the second car is
 * the first without the technique.
 */
export function lesson(id: ScenarioId, cars: readonly Outcome[], twin = false): string {
  if (!cars.length) return '';
  const [main, other] = cars;
  const n = cars.length;
  const num = (o: Outcome) => carNumber(id, o)?.value ?? '';
  const say = (answer: string, why: string) => `${answer} ${why}`;
  const hint = (x: ScenarioId) => HINT[x] ?? 'raise the speed';
  switch (id) {
    case 'lift-off': {
      // two causes, for every car alike: the lift moves load off the rear tyres (most telling on
      // a car that carries most of its weight there), and engine braking pulls on the driven
      // tyres (on a rear-drive car, the same rear ones). The verdict reads the same whoever car
      // B is: each car's outcome, then the causes; and a car that turned tighter isn't immune
      const why =
        'Lifting takes load off the rear tyres, and engine braking pulls on the driven ones: on a rear-heavy, rear-drive car, both at the rear. Front-drive cars aren’t immune nearer the limit.';
      const what = (o: Outcome) =>
        over(o)
          ? `the ${o.model}'s rear slid out${o.spun ? ' and it spun' : ''}`
          : o.verdict === 'tight'
            ? `the ${o.model} turned tighter`
            : `the ${o.model} held its line`;
      if (twin && other)
        return say(
          over(main)
            ? `Its rear can slide out: ${what(main)}, where the same car without the lift held its line.`
            : main.verdict === 'tight'
              ? `It turns tighter: lifting took the ${main.model} ${num(main)} inside where the driver aimed.`
              : `Hardly anything at this speed: ${hint(id)}.`,
          why,
        );
      if (!cars.some(over)) {
        const tight = cars.every((o) => o.verdict === 'tight');
        return say(
          n > 1
            ? `Neither rear slid out at this speed${tight ? ', both turned tighter' : ''}: ${hint(id)}.`
            : `Its rear didn’t slide out at this speed${tight ? ', it turned tighter' : ''}: ${hint(id)}.`,
          why,
        );
      }
      if (cars.every(over))
        return say(
          `${n > 1 ? "Both cars' rears" : 'Its rear'} slid out at this speed${n > 1 ? ': pick a car with less weight at the back to see one hold on' : ''}.`,
          why,
        );
      return say(`It depends on the car: ${cars.map(what).join('; ')}.`, why);
    }

    case 'power-exit': {
      // two things, for every car alike: the throttle asks the driven tyres for drive on top of
      // cornering, and moves load off the front tyres onto the rear ones. Which end runs out
      // first depends on where the weight sits and which wheels drive: a light nose (an engine
      // at the back) can push wide even driven at the rear; a light tail driven at the rear
      // (an engine at the front) steps out. Each car named by both, from its own numbers
      const why =
        'The throttle asks the driven tyres for drive on top of cornering, and moves load off the front tyres onto the rear ones.';
      const who = (o: Outcome, first: boolean) =>
        `the ${DRIVEN[o.driven]} ${o.model}, with ${share(o.front)}${first ? ' of its weight' : ''} on the front,`;
      const what = (o: Outcome, first = true) => {
        const c = carNumber(id, o);
        return c?.side === 'nose'
          ? `${who(o, first)} slid its rear out${o.spun ? ' and spun' : ''}`
          : c?.side === 'wide'
            ? `${who(o, first)} pushed its front ${c.value} wide`
            : `${who(o, first)} held its line`;
      };
      const out = cars.filter((o) => carNumber(id, o)?.side === 'nose');
      const wide = cars.filter((o) => carNumber(id, o)?.side === 'wide');
      if (twin && other)
        return say(
          out.includes(main)
            ? `It can slide the rear out: ${what(main)} where the same car without it held its line.`
            : wide.includes(main)
              ? `It can push the front wide: ${what(main)} where the same car without it held its line.`
              : `Hardly anything at this speed: ${hint(id)}.`,
          why,
        );
      if (out.length && wide.length) {
        // what the two cars differ in, by their own numbers: where the weight sits, which
        // wheels drive, or both
        const drive = new Set(cars.map((o) => o.driven)).size > 1;
        const split =
          Math.max(...cars.map((o) => o.front)) - Math.min(...cars.map((o) => o.front)) >= 0.04;
        const head =
          drive && split
            ? 'where the weight sits and which wheels drive'
            : drive
              ? 'which wheels drive'
              : 'where the weight sits';
        const ordered = [...out, ...wide];
        return say(
          `It depends on ${head}: ${ordered.map((o, k) => what(o, k === 0)).join('; ')}.`,
          why,
        );
      }
      if (out.length === n)
        return say(
          `${n > 1 ? "Both cars' rears" : 'Its rear'} slid out${n > 1 ? ': pick a front-drive car, or one with its engine at the back, to see one run wide' : ''}.`,
          why,
        );
      if (wide.length === n)
        return say(
          `${n > 1 ? 'Both' : 'It'} ran wide${n > 1 ? ': pick a rear-drive car with its engine at the front to see a rear slide out' : ''}.`,
          why,
        );
      if (!out.length && !wide.length)
        return say(`Hardly anything at this speed: ${hint(id)}.`, why);
      return say(`It depends on the car: ${cars.map((o, k) => what(o, k === 0)).join('; ')}.`, why);
    }

    case 'catch': {
      const why = 'Opposite lock points the front tyres where the car is going.';
      const caught = cars.filter((o) => !o.spun && o.verdict === 'caught');
      const spun = cars.filter((o) => o.spun);
      const calm = cars.filter((o) => !o.spun && o.verdict !== 'caught');
      const lock = (o: Outcome) => `${Math.round(o.values.counterDeg ?? 0)}°`;
      if (twin && other) {
        if (caught.includes(main))
          return say(
            `Yes: ${lock(main)} of opposite lock caught the ${main.model}'s slide${other.spun ? '; the same car without it spun' : ''}.`,
            why,
          );
        if (main.spun)
          return say(
            `Not this time: the ${main.model} spun before opposite lock could catch it.`,
            why,
          );
        return say(`Not tested: the ${main.model} never slid at this speed: ${hint(id)}.`, why);
      }
      // the visitor's car never slid: the comparison was picked because it does
      if (calm.includes(main) && other && caught.includes(other))
        return say(
          `Yes, when it slides: the ${main.model} never slid at this speed; the ${other.model} did, and ${lock(other)} of opposite lock caught it.`,
          why,
        );
      if (!caught.length && !spun.length)
        return say(`Not tested: neither car slid at this speed: ${hint(id)}.`, why);
      if (!caught.length)
        return say(`Not here: ${names(spun)} spun before opposite lock could catch it.`, why);
      return say(
        `Yes: opposite lock caught ${names(caught)}${spun.length ? `; ${names(spun)} spun` : ''}${calm.length ? `; ${names(calm)} never slid` : ''}.`,
        why,
      );
    }

    case 'trail-brake':
    case 'left-foot': {
      const trail = id === 'trail-brake';
      // left-foot braking: brakes slow the car through all four tyres, a lift only through the
      // driven pair; the same deceleration moves the same load either way
      const why = trail
        ? 'Braking moves load onto the front tyres and off the rear ones.'
        : `Brakes slow the car through all four tyres, a lift only through its driven ${PAIR[main.driven]} tyres; the same deceleration moves the same load.`;
      // compared by the very numbers the rows show (rounded as written), so the lesson never
      // ranks two cars whose rows read the same; braking in a turn, against the same car at the
      // same speed, so slowing down alone doesn't count as turning in
      const lc = (o: Outcome) => {
        const d = lineOff(id, o);
        return d === undefined ? NaN : Math.round(10 * d) / 10;
      };
      const tight = (o: Outcome) => !o.spun && o.verdict === 'tight';
      if (twin && other) {
        if (main.spun) return say(`Too much for the ${main.model}: it spun.`, why);
        if (tight(main))
          return say(
            trail
              ? `Yes: a light brake made the ${main.model} turn ${num(main)} tighter than the same car at the same speed without it.`
              : `To tighten the line without lifting: a touch of brake made the ${main.model} turn ${num(main)} tighter than the same car at the same speed without it.`,
            why,
          );
        return say(
          `Hardly, at this speed: braking barely changed the ${main.model}'s line: ${hint(id)}.`,
          why,
        );
      }
      const spun = cars.filter((o) => o.spun);
      const ok = cars.filter((o) => !o.spun);
      // a car that spun is said first: never "yes" over it
      const spunWords = spun.length
        ? ` The ${spun.map((o) => o.model).join(' and ')} spun: braking in the turn took too much from ${spun.length > 1 ? 'their' : 'its'} rear tyres.`
        : '';
      const most = best(ok, lc, true);
      const least = best(ok, lc, false);
      if (!most || !least)
        return say(
          `Too much for ${names(spun)}: braking in the turn spun ${spun.length > 1 ? 'them' : 'it'}.`,
          why,
        );
      if (ok.every((o) => !tight(o)))
        return say(
          `Hardly, at this speed: ${n > 1 ? (spun.length ? 'the other car' : 'neither car') : 'the car'} turned in: ${hint(id)}.${spunWords}`,
          why,
        );
      if (ok.length < 2 || most === least)
        return say(`Yes for the ${most.model}: it ${carLine(id, most)}.${spunWords}`, why);
      // the same number on both rows: about the same
      if (lc(most) - lc(least) < 0.1 - 1e-9)
        return say(`Yes, by about the same on both: ${num(most)} each.`, why);
      if (!trail && most.driven === 'front' && least.driven !== 'front')
        return say(
          `Most on a front-drive car: the ${most.model} turned in more than the ${DRIVEN[least.driven]} ${least.model}.`,
          why,
        );
      const rho = rankCorr(
        ok.map((o) => 1 - o.front),
        ok.map(lc),
      );
      if (rho >= TREND)
        return say(
          `Yes, the more weight at the back the more: ${names([most])} turned in most.`,
          why,
        );
      return say(`Yes, ${names([most])} most: it turned in more than ${names([least])}.`, why);
    }

    case 'braking': {
      // the load moved, from its share at rest (the layout chip's): weight × deceleration × CG
      // height ÷ wheelbase, in plain words with the car's own numbers. The springs don't change
      // the load moved; they decide how far it dips the nose
      const moved = (o: Outcome) => `${share(o.front)} at rest to ${share(o.frontMax)}`;
      const sum = (o: Outcome) => {
        const d = o.values.meanDecel ?? NaN;
        if (!Number.isFinite(d)) return '';
        return ` For the ${o.model}: ${d.toFixed(2)} g of braking × CG height ÷ wheelbase (${o.cgOverL.toFixed(2)}) = ${share(d * o.cgOverL)} of its weight.`;
      };
      const why =
        'Load moved = weight × braking × CG height ÷ wheelbase; the springs don’t change it, but they decide how far it dips the nose.';
      if (!other)
        return (
          say(`Onto the front tyres: the ${main.model}'s went from ${moved(main)}.`, why) +
          sum(main)
        );
      const gain = (o: Outcome) => o.frontMax - o.front;
      const more =
        gain(other) > gain(main) + 0.01 ? other : gain(main) > gain(other) + 0.01 ? main : null;
      const fits = more && more.cgOverL > (more === main ? other : main).cgOverL;
      // (each car's own shift is on its row)
      return (
        (fits
          ? say(
              `Onto the front tyres, more on the ${more.model}: its CG sits higher for its wheelbase.`,
              why,
            )
          : say('Onto the front tyres, on both cars.', why)) + sum(main)
      );
    }

    case 'skidpad': {
      // the push-wide question: understeer at the limit is a set-up choice (roll stiffness,
      // alignment), not the engine's place; easing off gently brings a car running wide back,
      // an abrupt lift can swing the rear (the lift-off question)
      const gently =
        'easing off gently brings it back (an abrupt lift can swing the rear, as in the lift-off question)';
      if (other && other.rearGrip !== 1 && main.letGo && other.letGo) {
        const pct = Math.round(Math.abs(other.rearGrip - 1) * 100);
        const less = other.rearGrip < 1;
        const end = (o: Outcome) =>
          o.letGo!.axle === 'front' ? 'ran wide' : o.spun ? 'spun' : 'its rear slid out';
        if (main.letGo.axle === 'front' && other.letGo.axle === 'rear')
          return `Because they're set up to: ${setupWords(main)}, and they go first; ${gently}. With ${pct}% ${less ? 'less' : 'more'} rear grip the rear tyres went first: that needs quick opposite lock.`;
        return `It depends on the set-up: the ${main.model}'s ${main.letGo.axle} tyres let go first and it ${end(main)}; with ${pct}% ${less ? 'less' : 'more'} rear grip, its ${other.letGo.axle} tyres did and it ${end(other)}.`;
      }
      const fronts = cars.filter((o) => o.letGo?.axle === 'front');
      const rears = cars.filter((o) => o.letGo?.axle === 'rear');
      if (!fronts.length && !rears.length)
        return `Not reached: neither car reached its limit at this top speed: raise it.`;
      if (!rears.length && fronts.length === n)
        return n > 1
          ? `Because they're set up to: both let go at the front first, whatever their layout, as road cars are tuned (more roll stiffness at the front); ${gently}.`
          : `Because it's set up to: ${setupWords(main)}; ${gently}.`;
      if (!fronts.length && rears.length === n)
        return `Not these: ${n > 1 ? 'both cars' : `the ${main.model}`} let go at the rear first.`;
      if (!fronts.length || !rears.length)
        return `Only one reached its limit: the ${(fronts[0] ?? rears[0]).model} let go at the ${fronts.length ? 'front' : 'rear'} first; the other held on.`;
      return `It depends on the set-up: the front tyres let go first on ${names(fronts)}, the rear tyres on ${names(rears)}.`;
    }

    case 'lane-change': {
      // timed the standard way (step steer, to 90% of the turn rate it settles at); why one car
      // is slower is found the same way: each of the slower car's traits tried on the faster
      // car alone, named only if it moves the time that way, with how much
      const t = (o: Outcome) => o.values.yawResponse ?? NaN;
      const fast = best(cars, t, false);
      const slow = best(cars, t, true);
      const why =
        'A car has to build its turn: its front tyres start it, its yaw inertia resists it.';
      if (!fast || !slow) return why;
      const sec = (o: Outcome) => `${(t(o) / 1000).toFixed(2)} s`;
      if (n < 2 || fast === slow)
        return say(
          `In ${sec(fast)}: the ${fast.model} reached 90% of its turn rate that long after the wheel.`,
          why,
        );
      if (Math.abs(t(fast) - t(slow)) < 5)
        return say(
          `About as quickly: both reached 90% of their turn rate ${sec(fast)} after the wheel.`,
          why,
        );
      const head = `The ${fast.model} was quicker: it reached 90% of its turn rate ${sec(fast)} after the wheel, the ${slow.model} ${sec(slow)}.`;
      const found = laneFactors(fast, slow);
      return found ? `${head} ${found}` : say(head, why);
    }
  }
}
