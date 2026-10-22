/**
 * What a run showed, in words: one line per car and one lesson for the scenario, both derived
 * from the results, never written per car. The lesson names the cause the scenario is about
 * (where the load went, which tyres it asked for grip) and claims a pattern across the cars
 * only when their results show it; otherwise it says what they did show.
 */
import type { CarParams } from '../../sim/model';
import { VERDICTS, type MetricId, type ScenarioId, type Verdict } from '../../sim/scenarios';

export interface Outcome {
  /** layout code ("FR", "F-AWD") and the model without its make ("M340i") */
  code: string;
  model: string;
  /** what a twin is ("No lift"), named instead of its code */
  label?: string;
  driven: 'front' | 'rear' | 'all';
  /** static share of the weight on the front axle, and the most it carried in the run (0..1) */
  front: number;
  frontMax: number;
  /** the front's share of the load that moves across the car in a turn (roll stiffness) */
  rollF: number;
  /** yaw inertia over m·a·b: above 1, mass sits out beyond the axles */
  dynIndex: number;
  values: Partial<Record<MetricId, number>>;
  verdict: Verdict | null;
  spun: boolean;
  letGo: { axle: 'front' | 'rear'; g: number } | null;
}

export type Tone = 'under' | 'over' | 'spin' | 'calm';

/** Layout facts the lessons lean on, from a car's sim parameters. */
export function layoutFacts(
  p: CarParams,
): Pick<Outcome, 'driven' | 'front' | 'rollF' | 'dynIndex'> {
  return {
    driven: p.front.driven && p.rear.driven ? 'all' : p.front.driven ? 'front' : 'rear',
    front: p.b / p.L,
    rollF: p.front.rollShare,
    dynIndex: p.izz / (p.m * p.a * p.b),
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

const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x))}%`;
const share = (x: number) => `${Math.round(100 * x)}%`;
const join = (...parts: (string | false | null | undefined)[]) =>
  parts.filter((p): p is string => !!p).join(', ');
const letGoText = (o: Outcome) =>
  o.letGo && `${o.letGo.axle === 'rear' ? 'rears' : 'fronts'} let go at ${o.letGo.g.toFixed(2)} g`;

/** How a car came out of the run, as a clause ("rears let go at 0.94 g, spun"). */
export function carLine(id: ScenarioId, o: Outcome): string {
  const v = o.values;
  switch (id) {
    case 'braking':
      return join(
        Number.isFinite(v.stopDist) && `stopped in ${v.stopDist!.toFixed(1)} m`,
        `front load ${share(o.front)} → ${share(o.frontMax)}`,
      );
    case 'skidpad':
      return join(letGoText(o) || `held ${(v.maxAy ?? 0).toFixed(2)} g`, o.spun && 'then spun');
    case 'lane-change':
      return `turned ${Math.round(v.yawLag ?? NaN)} ms after the wheel`;
    case 'catch':
      if (o.spun) return join(letGoText(o), 'spun');
      if (o.verdict === 'caught')
        return `slid ${Math.round(v.maxSlip ?? 0)}°, caught with ${Math.round(v.counterDeg ?? 0)}° of opposite lock`;
      return 'never slid';
    default: {
      // the corner techniques: what the line did while the wheel was held still
      const lc = v.lineChange ?? 0;
      switch (o.verdict) {
        case 'spin':
          return join(letGoText(o), 'spun');
        case 'tail':
          return join(letGoText(o), `tail out ${Math.round(v.slipChange ?? 0)}°`);
        case 'tight':
          return `${id === 'lift-off' ? 'tucked in' : 'turned in'} ${Math.round(lc)}% tighter`;
        case 'wide':
          return join(letGoText(o), `ran wide (line ${pct(lc)})`);
        default:
          return `held its line (${pct(lc)})`;
      }
    }
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

/** "FF", "MR and RR", "FF, FR and RR": codes, or code + model where two cars share one. */
function names(cars: readonly Outcome[], all: readonly Outcome[]): string {
  const one = (o: Outcome) =>
    o.label ?? (all.filter((x) => x.code === o.code).length > 1 ? `${o.code} ${o.model}` : o.code);
  const list = cars.map(one);
  return list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

const by = (cars: readonly Outcome[], f: (o: Outcome) => number, max: boolean) =>
  cars
    .filter((o) => Number.isFinite(f(o)))
    .reduce<Outcome | null>((b, o) => (!b || (max ? f(o) > f(b) : f(o) < f(b)) ? o : b), null);

const over = (o: Outcome) => o.spun || o.verdict === 'spin' || o.verdict === 'tail';

/** What the technique itself does, for a car run with and without it. */
const CAUSE: Partial<Record<ScenarioId, string>> = {
  'lift-off': 'Lifting moves load onto the fronts and off the rears',
  'trail-brake': 'Braking moves load onto the fronts and off the rears',
  'power-exit': 'The throttle asks the driven tyres for drive on top of cornering',
  'left-foot': 'A touch of brake, throttle held, moves load forward and drags the rears',
  catch: 'Opposite lock points the fronts where the car is going',
};

/**
 * The scenario's one-line lesson from every car's outcome. `twin`: the cars are one car with
 * and without the technique (the second is the without), not different layouts.
 */
export function lesson(id: ScenarioId, cars: readonly Outcome[], twin = false): string {
  if (!cars.length) return '';
  if (twin && cars.length === 2 && CAUSE[id]) {
    const [on, off] = cars;
    const a = carLine(id, on);
    const b = carLine(id, off);
    return a === b
      ? `${CAUSE[id]}; at this speed the ${on.model} ${a} either way.`
      : `${CAUSE[id]}. With it: ${a}; without: ${b}.`;
  }
  const n = cars.length;
  const every = n > 1 ? 'every car' : 'the car';
  const nm = (list: readonly Outcome[]) => names(list, cars);
  switch (id) {
    case 'braking': {
      const best = by(cars, (o) => o.values.stopDist ?? NaN, false);
      const worst = by(cars, (o) => o.values.stopDist ?? NaN, true);
      const head = cars[0];
      const shift = `Braking moves load onto the fronts (${share(head.front)} → ${share(head.frontMax)} on the ${head.model})`;
      if (!best || !worst || n < 2) return `${shift}, so they do most of the stopping.`;
      const d = (o: Outcome) => `${o.values.stopDist!.toFixed(1)} m`;
      const rho = rankCorr(
        cars.map((o) => 1 - o.front),
        cars.map((o) => o.values.stopDist ?? NaN),
      );
      if (rho <= -TREND)
        return `${shift}; the more weight a car keeps at the back, the more its rears still help: ${nm([best])} stopped shortest, ${d(best)}.`;
      if (rho >= TREND)
        return `${shift}; here the nose-heavy cars stopped shortest: ${nm([best])}, ${d(best)}.`;
      return `${shift}, so they do most of the stopping; stops ran ${best.values.stopDist!.toFixed(1)}–${d(worst)}, in no order of weight split.`;
    }

    case 'skidpad': {
      const fronts = cars.filter((o) => o.letGo?.axle === 'front');
      const rears = cars.filter((o) => o.letGo?.axle === 'rear');
      const gs = [...fronts, ...rears].map((o) => o.letGo!.g);
      const range =
        gs.length > 1 && Math.max(...gs) - Math.min(...gs) >= 0.005
          ? `${Math.min(...gs).toFixed(2)}–${Math.max(...gs).toFixed(2)} g`
          : `${(gs[0] ?? 0).toFixed(2)} g`;
      if (!gs.length) return `No car reached its limit at this top speed.`;
      const whose = n > 1 ? "Every car's" : 'The';
      if (!rears.length && fronts.length === n)
        return cars.every((o) => o.rollF > o.front)
          ? `${whose} fronts let go first (${range}): road cars put more of the cornering load shift on the front tyres.`
          : `${whose} fronts let go first (${range}).`;
      if (!fronts.length && rears.length === n)
        return cars.every((o) => o.rollF < o.front)
          ? `${whose} rears let go first (${range}): these cars put more of the cornering load shift on the rear tyres.`
          : `${whose} rears let go first (${range}).`;
      const heavierEnd =
        Math.max(...rears.map((o) => o.front)) < Math.min(...fronts.map((o) => o.front));
      return `Fronts let go first on ${nm(fronts)}, rears on ${nm(rears)}${heavierEnd ? ': the heavier end runs out of grip first.' : '.'}`;
    }

    case 'lift-off': {
      const out = cars.filter(over);
      const held = cars.filter((o) => !over(o));
      if (!out.length)
        return held.every((o) => o.verdict === 'tight')
          ? `Lifting moves load onto the fronts: ${every} tucked its nose in; no rear let go at this speed.`
          : `Lifting moves load onto the fronts; no rear let go at this speed.`;
      if (!held.length)
        return `Lifting moves load off the rears: ${every} stepped out at this speed.`;
      const verb = out.every((o) => o.spun) ? 'spun' : 'stepped out';
      if (Math.max(...out.map((o) => o.front)) < Math.min(...held.map((o) => o.front)))
        return `Lifting moves load off the rears: the tail-heavier ${nm(out)} ${verb}, the nose-heavier cars tucked in.`;
      return `Lifting moves load off the rears: ${nm(out)} ${verb}, ${nm(held)} held on; weight split alone doesn't sort them.`;
    }

    case 'trail-brake':
    case 'left-foot': {
      const lc = (o: Outcome) => o.values.lineChange ?? NaN;
      const most = by(cars, lc, true);
      const least = by(cars, lc, false);
      const cause =
        id === 'trail-brake'
          ? 'Braking moves load onto the fronts and off the rears'
          : 'A touch of brake, throttle held, moves load forward and drags the rears';
      if (!most || !least) return `${cause}.`;
      if (n < 2) return `${cause}: the ${most.model} ${carLine(id, most)}.`;
      // a car that spun turned "in" by however far it went round: say it spun
      const amount = (o: Outcome) => (o.spun ? 'spun' : pct(lc(o)));
      const ends = `${nm([most])} ${amount(most)}, ${nm([least])} ${amount(least)}`;
      if (id === 'left-foot' && most.driven === 'front')
        return `${cause}: the front-driven ${nm([most])} turned in most (${amount(most)}).`;
      const rho = rankCorr(
        cars.map((o) => 1 - o.front),
        cars.map(lc),
      );
      if (rho >= TREND)
        return `${cause}: the more weight at the back, the more it turned in (${ends}).`;
      if (rho <= -TREND)
        return `${cause}: the more weight on the nose, the more it turned in (${ends}).`;
      return `${cause}: ${nm([most])} turned in most (${amount(most)}), ${nm([least])} least (${amount(least)}).`;
    }

    case 'power-exit': {
      const cause = 'The throttle asks the driven tyres for drive on top of cornering';
      const out = cars.filter((o) => over(o) || o.verdict === 'tight');
      const wide = cars.filter((o) => o.verdict === 'wide');
      const rwd = cars.filter((o) => o.driven === 'rear');
      const rest = cars.filter((o) => o.driven !== 'rear');
      if (
        rwd.length &&
        rest.length &&
        rwd.every((o) => out.includes(o)) &&
        rest.every((o) => wide.includes(o))
      )
        return `${cause}: the rear-driven ${nm(rwd)} stepped out, ${nm(rest)} ran wide.`;
      if (out.length === n) return `${cause}: ${every} stepped out.`;
      if (wide.length === n) return `${cause}: ${every} ran wide.`;
      return `${cause}: ${join(out.length > 0 && `${nm(out)} stepped out`, wide.length > 0 && `${nm(wide)} ran wide`) || `${every} held its line`}.`;
    }

    case 'catch': {
      const cause = 'Lifting near the limit takes load off the rears';
      const caught = cars.filter((o) => !o.spun && o.verdict === 'caught');
      const spun = cars.filter((o) => o.spun);
      const calm = cars.filter((o) => !o.spun && o.verdict !== 'caught');
      if (!caught.length && !spun.length)
        return `${cause}, but no car slid far enough to need opposite lock at this speed.`;
      if (!caught.length) return `${cause}: ${nm(spun)} spun before opposite lock could catch it.`;
      const lock = Math.round(Math.max(...caught.map((o) => o.values.counterDeg ?? 0)));
      return `${cause}: ${nm(caught)} slid and opposite lock caught ${caught.length > 1 ? 'them' : 'it'} (up to ${lock}°)${spun.length ? `; ${nm(spun)} spun` : ''}${calm.length ? '; the rest never slid' : ''}.`;
    }

    case 'lane-change': {
      const lag = (o: Outcome) => o.values.yawLag ?? NaN;
      const fast = by(cars, lag, false);
      const slow = by(cars, lag, true);
      if (!fast || !slow) return 'A car has to swing its mass round before it changes direction.';
      const ms = (o: Outcome) => `${Math.round(lag(o))} ms`;
      if (n < 2)
        return `A car has to swing its mass round first: the ${fast.model} turned ${ms(fast)} after the wheel.`;
      const lags = cars.map(lag);
      if (
        rankCorr(
          cars.map((o) => o.dynIndex),
          lags,
        ) >= TREND
      )
        return `The more mass sits out beyond the axles, the slower a car swings: ${nm([fast])} answered the wheel in ${ms(fast)}, ${nm([slow])} in ${ms(slow)}.`;
      if (
        rankCorr(
          cars.map((o) => 1 - o.front),
          lags,
        ) >= TREND
      )
        return `The more weight at the back, the longer the tail takes to follow: ${nm([fast])} ${ms(fast)}, ${nm([slow])} ${ms(slow)}.`;
      return `A car has to swing its mass round before it changes direction: ${nm([fast])} took ${ms(fast)}, ${nm([slow])} ${ms(slow)}.`;
    }
  }
}
