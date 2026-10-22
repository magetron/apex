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
  let mass: { kg: number; frontPct: number };
  try {
    const m = massProps(v);
    mass = { kg: m.totalKg, frontPct: m.frontPct };
  } catch {
    // a spec massProps rejects still has its published figures
    mass = { kg: v.published.curbKg, frontPct: v.published.frontPct };
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
    kg: mass.kg,
    kwPerT: (kw / mass.kg) * 1000,
    frontPct: mass.frontPct,
    lengthMm: v.dims.lengthMm,
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
  const searched = query.trim() ? all.filter((f) => matchesQuery(f, query)) : all;
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
  return all.filter((f) => matchesFilters(f, fs, filters) && matchesQuery(f, query));
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
