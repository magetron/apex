/**
 * What the car picker knows about each car, all derived from the spec: independent traits that
 * combine (where the engine/motors sit, which wheels are driven, power source, body, cylinders),
 * a few numbers to sort and compare by, and the facet filter / sort / delta logic. Pure, so it is
 * tested without a DOM; cached per spec object (an engine swap is a new object).
 */
import { getEngine, getMotor } from '../../spec/catalog';
import { massProps } from '../../spec/derive/mass';
import { layoutCode } from '../../spec/describe';
import type { BodyStyle, EngineFamily, EngineSpec, Induction, VehicleSpec } from '../../spec/types';

export type Place = 'front' | 'mid' | 'rear';
export type Drive = 'FWD' | 'RWD' | 'AWD';
export type Source = 'ICE' | 'EV';

export interface CarFacts {
  v: VehicleSpec;
  id: string;
  name: string;
  /** the name without its trailing "(…)" and that bracket's content */
  model: string;
  variant: string | null;
  code: string;
  /** where the engine sits, or every axle with a motor */
  places: Place[];
  drive: Drive;
  source: Source;
  body: BodyStyle;
  /** "V8", "Flat-6", "I4", "2-rotor"; null for EVs */
  cyl: string | null;
  /** "V8 4.0 twin-turbo", "2 motors · 82 kWh" */
  unit: string;
  kw: number;
  kg: number;
  kwPerT: number;
  /** static front axle share, 0..100 */
  frontPct: number;
  lengthMm: number;
  wheelbaseMm: number;
  /** centre of gravity above the ground (mm); null when the spec has no mass model */
  cgMm: number | null;
}

const PLACE_OF = {
  'front-overhang': 'front',
  'front-mid': 'front',
  mid: 'mid',
  'rear-overhang': 'rear',
  'rear-underfloor': 'rear',
} as const;

const DRIVE_OF = { front: 'FWD', rear: 'RWD', all: 'AWD' } as const;

const CYL_PREFIX: Record<EngineFamily, (n: number) => string> = {
  inline: (n) => `I${n}`,
  flat: (n) => `Flat-${n}`,
  v: (n) => `V${n}`,
  vr: (n) => `VR${n}`,
  w: (n) => `W${n}`,
  rotary: (n) => `${n}-rotor`,
};

const INDUCTION: Record<Induction, string> = {
  na: '',
  turbo: 'turbo',
  'twin-turbo': 'twin-turbo',
  'quad-turbo': 'quad-turbo',
  supercharged: 'supercharged',
};

export const cylCode = (e: EngineSpec) => CYL_PREFIX[e.family](e.cylinders.length);

/** "V8 4.0 twin-turbo", "Flat-6 3.0 twin-turbo", "I2 0.5" */
export function engineShort(e: EngineSpec): string {
  return [cylCode(e), (e.displacementCc / 1000).toFixed(1), INDUCTION[e.induction]]
    .filter(Boolean)
    .join(' ');
}

const cache = new WeakMap<VehicleSpec, CarFacts>();

export function carFacts(v: VehicleSpec): CarFacts {
  const hit = cache.get(v);
  if (hit) return hit;
  const pt = v.powertrain;
  let mass: { kg: number; frontPct: number; cg: number | null };
  try {
    const m = massProps(v);
    mass = { kg: m.totalKg, frontPct: m.frontPct, cg: m.cgMm[1] };
  } catch {
    // a spec massProps rejects still has its published figures
    mass = { kg: v.published.curbKg, frontPct: v.published.frontPct, cg: null };
  }
  let places: Place[];
  let kw: number;
  let unit: string;
  let cyl: string | null = null;
  if (pt.kind === 'ev') {
    const axles = new Set(pt.motors.map((m) => m.axle));
    places = (['front', 'rear'] as const).filter((a) => axles.has(a));
    kw = pt.motors.reduce((s, m) => s + getMotor(m.motor).peakKw, 0);
    const n = pt.motors.length;
    unit = `${n} motor${n > 1 ? 's' : ''} · ${pt.battery.kWh} kWh`;
  } else {
    const e = getEngine(pt.engine);
    places = [PLACE_OF[pt.position]];
    kw = e.powerKw;
    unit = engineShort(e);
    cyl = cylCode(e);
  }
  const bracket = /\s*\(([^()]*)\)$/.exec(v.name);
  const f: CarFacts = {
    v,
    id: v.id,
    name: v.name,
    model: bracket ? v.name.slice(0, bracket.index) : v.name,
    variant: bracket ? bracket[1] : null,
    code: layoutCode(v),
    places,
    drive: DRIVE_OF[pt.driven],
    source: pt.kind === 'ev' ? 'EV' : 'ICE',
    body: v.body.style,
    cyl,
    unit,
    kw,
    // the published kerb mass, as the car's card shows it (the modelled mass only sets the split)
    kg: v.published.curbKg,
    kwPerT: (kw / v.published.curbKg) * 1000,
    frontPct: mass.frontPct,
    lengthMm: v.dims.lengthMm,
    wheelbaseMm: v.dims.wheelbaseMm,
    cgMm: mass.cg,
  };
  cache.set(v, f);
  return f;
}

// ── facets ─────────────────────────────────────────────────────────────────────────────

export type FacetId = 'place' | 'drive' | 'source' | 'body' | 'cyl';
export type Filters = Partial<Record<FacetId, string[]>>;

const BODY_LABEL: Record<BodyStyle, string> = {
  city: 'City',
  hatch: 'Hatch',
  saloon: 'Saloon',
  estate: 'Estate',
  fastback: 'Fastback',
  coupe: 'Coupé',
  roadster: 'Roadster',
  suv: 'SUV',
  offroader: 'Off-roader',
  supercar: 'Supercar',
};

export const PLACE_LABEL: Record<Place, string> = { front: 'Front', mid: 'Mid', rear: 'Rear' };

export interface Facet {
  id: FacetId;
  label: string;
  /** the car's values for this facet (a dual-motor EV sits both front and rear) */
  of: (f: CarFacts) => string[];
  /** every value in display order (only those some car has are offered) */
  order: string[];
  text: (value: string) => string;
}

// the catalog's engine-family order; "VR6" skips 'V' because "R6" is no count
const CYL_FAMILY = ['I', 'Flat-', 'V', 'VR', 'W'];
const cylRank = (c: string) => {
  if (c.endsWith('-rotor')) return [CYL_FAMILY.length, parseInt(c, 10)];
  const fam = CYL_FAMILY.findIndex((p) => c.startsWith(p) && /^\d+$/.test(c.slice(p.length)));
  return [fam, parseInt(c.replace(/^\D+/, ''), 10)];
};
const byCyl = (a: string, b: string) => {
  const [fa, na] = cylRank(a);
  const [fb, nb] = cylRank(b);
  return fa - fb || na - nb;
};

export function facets(all: CarFacts[]): Facet[] {
  const cyls = [...new Set(all.flatMap((f) => (f.cyl ? [f.cyl] : [])))].sort(byCyl);
  return [
    {
      id: 'place',
      label: 'Position',
      of: (f) => f.places,
      order: ['front', 'mid', 'rear'],
      text: (p) => PLACE_LABEL[p as Place],
    },
    {
      id: 'drive',
      label: 'Drive',
      of: (f) => [f.drive],
      order: ['FWD', 'RWD', 'AWD'],
      text: String,
    },
    { id: 'source', label: 'Power', of: (f) => [f.source], order: ['ICE', 'EV'], text: String },
    {
      id: 'body',
      label: 'Body',
      of: (f) => [f.body],
      order: Object.keys(BODY_LABEL),
      text: (b) => BODY_LABEL[b as BodyStyle],
    },
    { id: 'cyl', label: 'Cylinders', of: (f) => (f.cyl ? [f.cyl] : []), order: cyls, text: String },
  ];
}

const haystack = new WeakMap<CarFacts, string>();
const hay = (f: CarFacts) => {
  let h = haystack.get(f);
  if (h === undefined) {
    h = [f.name, f.unit, f.code, f.drive, f.source, BODY_LABEL[f.body], ...f.v.examples]
      .join(' ')
      .toLowerCase();
    haystack.set(f, h);
  }
  return h;
};

/** Every search word appears in the name, engine, layout, body or the sibling models. */
export function matchesQuery(f: CarFacts, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => hay(f).includes(w));
}

/** Every search word appears in the car's own name: a stronger match than a mention elsewhere. */
export function matchesName(f: CarFacts, query: string): boolean {
  const words = query.toLowerCase().split(/s+/).filter(Boolean);
  const name = f.name.toLowerCase();
  return words.every((w) => name.includes(w));
}

/**
 * The cars a search finds: those named by it if any are ("golf" finds the Golfs, not the cars
 * whose platform siblings include a Golf), else every car it mentions.
 */
export function searchCars(all: CarFacts[], query: string): CarFacts[] {
  if (!query.trim()) return all;
  const hits = all.filter((f) => matchesQuery(f, query));
  const named = hits.filter((f) => matchesName(f, query));
  return named.length ? named : hits;
}

/** AND across facets, OR within one; `skip` leaves one facet out (for its own chip counts). */
export function matchesFilters(
  f: CarFacts,
  fs: Facet[],
  filters: Filters,
  skip?: FacetId,
): boolean {
  for (const facet of fs) {
    const want = filters[facet.id];
    if (facet.id === skip || !want?.length) continue;
    const have = facet.of(f);
    if (!want.some((w) => have.includes(w))) return false;
  }
  return true;
}

/** How many cars each chip would show, given the search and every other facet's selection. */
export function facetCounts(
  all: CarFacts[],
  fs: Facet[],
  filters: Filters,
  query: string,
): Record<FacetId, Map<string, number>> {
  const searched = searchCars(all, query);
  const out = {} as Record<FacetId, Map<string, number>>;
  for (const facet of fs) {
    const counts = new Map<string, number>();
    for (const f of searched) {
      if (!matchesFilters(f, fs, filters, facet.id)) continue;
      for (const value of new Set(facet.of(f))) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    out[facet.id] = counts;
  }
  return out;
}

export function applyFilters(
  all: CarFacts[],
  fs: Facet[],
  filters: Filters,
  query: string,
): CarFacts[] {
  return searchCars(all, query).filter((f) => matchesFilters(f, fs, filters));
}

// ── sorting ────────────────────────────────────────────────────────────────────────────

export type SortKey = 'name' | 'kw' | 'kg' | 'kwPerT' | 'front' | 'length';

export const SORTS: { key: SortKey; label: string; title: string; get: (f: CarFacts) => number }[] =
  [
    { key: 'name', label: 'A–Z', title: 'Name', get: () => 0 },
    { key: 'kw', label: 'kW', title: 'Power', get: (f) => f.kw },
    { key: 'kg', label: 'kg', title: 'Mass', get: (f) => f.kg },
    { key: 'kwPerT', label: 'kW/t', title: 'Power to weight', get: (f) => f.kwPerT },
    { key: 'front', label: 'F/R', title: 'Weight on the front axle', get: (f) => f.frontPct },
    { key: 'length', label: 'Length', title: 'Length', get: (f) => f.lengthMm },
  ];

/** dir 1 = ascending (A–Z, small → big); numbers default to big first. */
export function sortCars(list: CarFacts[], key: SortKey, dir: 1 | -1): CarFacts[] {
  const get = SORTS.find((s) => s.key === key)!.get;
  return [...list].sort(
    (a, b) =>
      (key === 'name' ? a.name.localeCompare(b.name) : get(a) - get(b)) * dir ||
      a.name.localeCompare(b.name),
  );
}

// ── compared with the car on screen ────────────────────────────────────────────────────

export type DeltaKey = 'kw' | 'kg' | 'kwPerT' | 'length' | 'front';

export interface Delta {
  /** signed text with a true minus, or '=' when they match */
  text: string;
  sign: -1 | 0 | 1;
}

const MINUS = '−';

function delta(d: number, digits: number, unit: string): Delta {
  const r = Number(d.toFixed(digits));
  if (r === 0) return { text: '=', sign: 0 };
  const sign = r > 0 ? 1 : -1;
  return { text: `${sign > 0 ? '+' : MINUS}${Math.abs(r).toFixed(digits)}${unit}`, sign };
}

/** This car minus the current one. */
export function deltas(f: CarFacts, cur: CarFacts): Record<DeltaKey, Delta> {
  return {
    kw: delta(f.kw - cur.kw, 0, ''),
    kg: delta(f.kg - cur.kg, 0, ''),
    kwPerT: delta(f.kwPerT - cur.kwPerT, 0, ''),
    length: delta((f.lengthMm - cur.lengthMm) / 1000, 2, ''),
    front: delta(f.frontPct - cur.frontPct, 1, ' pt'),
  };
}

// ── a few cars side by side ────────────────────────────────────────────────────────────

export interface CompareRow {
  key: string;
  label: string;
  unit: string;
  title: string;
  /** the main car's value first, then each compared car's */
  values: string[];
  /** each compared car minus the main one; null for text rows (layout, engine) */
  deltas: (Delta | null)[];
  /** not about the layout (the engine, power, mass): folded away under the layout rows */
  more?: boolean;
}

interface NumRow {
  key: string;
  label: string;
  unit: string;
  title: string;
  get: (f: CarFacts) => number | null;
  digits: number;
  deltaUnit?: string;
  /** not about the layout: folded away under the table */
  more?: boolean;
}

/** the layout's numbers first (where the weight sits, how long the car is), then the rest */
const NUM_ROWS: NumRow[] = [
  {
    key: 'front',
    label: 'Front',
    unit: '%',
    title: 'Static load on the front axle',
    get: (f) => f.frontPct,
    digits: 1,
    deltaUnit: ' pt',
  },
  {
    key: 'cg',
    label: 'CG',
    unit: 'mm',
    title: 'Centre of gravity above the ground',
    get: (f) => f.cgMm,
    digits: 0,
  },
  {
    key: 'wheelbase',
    label: 'Wheelbase',
    unit: 'mm',
    title: 'Front to rear axle',
    get: (f) => f.wheelbaseMm,
    digits: 0,
  },
  {
    key: 'length',
    label: 'Length',
    unit: 'mm',
    title: 'Bumper to bumper',
    get: (f) => f.lengthMm,
    digits: 0,
  },
  {
    key: 'kw',
    label: 'Power',
    unit: 'kW',
    title: 'Peak power',
    get: (f) => f.kw,
    digits: 0,
    more: true,
  },
  {
    key: 'kg',
    label: 'Mass',
    unit: 'kg',
    title: 'Kerb mass',
    get: (f) => f.kg,
    digits: 0,
    more: true,
  },
  {
    key: 'kwPerT',
    label: 'kW/t',
    unit: '',
    title: 'Power to weight',
    get: (f) => f.kwPerT,
    digits: 0,
    more: true,
  },
];

/** "Flat-6", "2 motors": the power unit in a word or two */
const unitShort = (f: CarFacts) => f.cyl ?? f.unit.split(' · ')[0];

/** The main car and the cars it is compared with, row by row, with signed differences. */
export function compareRows(main: CarFacts, others: CarFacts[]): CompareRow[] {
  const all = [main, ...others];
  const text = (
    key: string,
    label: string,
    title: string,
    get: (f: CarFacts) => string,
    more = false,
  ): CompareRow => ({
    key,
    label,
    unit: '',
    title,
    values: all.map(get),
    deltas: others.map(() => null),
    more,
  });
  const nums = NUM_ROWS.map((r): CompareRow => {
    const m = r.get(main);
    return {
      key: r.key,
      label: r.label,
      unit: r.unit,
      title: r.title,
      values: all.map((f) => {
        const x = r.get(f);
        return x === null ? '–' : x.toFixed(r.digits);
      }),
      deltas: others.map((f) => {
        const x = r.get(f);
        return x === null || m === null ? null : delta(x - m, r.digits, r.deltaUnit ?? '');
      }),
      more: !!r.more,
    };
  });
  // the layout and its numbers first; the engine, power and mass after them
  return [
    text('layout', 'Layout', 'Where the engine sits and which wheels it drives', (f) => f.code),
    ...nums.filter((r) => !r.more),
    text('unit', 'Engine', 'Engine or motors', unitShort, true),
    ...nums.filter((r) => r.more),
  ];
}
