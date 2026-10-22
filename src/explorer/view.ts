/**
 * The explorer's state lives in the URL hash, so the back button zooms out and every view is a
 * deep link. One page, one car as the point of entry:
 *   #/<vehicle>                car exterior (entry)
 *   #/<vehicle>/internals      the same view, see-through: drivetrain, CG, torque flow
 *   #/<vehicle>/<part>[/<d>]   zoomed into one component (engine, gearbox, motor-rear…), optional detail
 *   #/<vehicle>/drive          the same car driving and cornering (handling), settings in a corner hub
 *   #/<vehicle>/track[/<t>]    hot laps of a real circuit (picked from the cards without one)
 * Any of them may end in ?vs=<id>,<id>: the cars it is compared with (side by side or as ghosts
 * in the car view, alongside on the road in drive, lapping the same circuit in track).
 */
import { useHashLocation } from 'wouter/use-hash-location';
import { findTrack } from '../sim/track/registry';
import { findVehicle, listVehicles } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive/layout';

export type Level = 'car' | 'internals' | 'part' | 'drive' | 'track';

export interface View {
  vehicleId: string;
  level: Level;
  /** layout part id when level === 'part' */
  part?: string;
  /** optional sub-view inside a part (owned by that part's panel, e.g. "balance") */
  detail?: string;
  /** the cars compared with this one (vehicle ids, never the car itself, at most MAX_VS) */
  vs?: string[];
  /** the circuit when level === 'track' (none: pick one) */
  track?: string;
}

export const DEFAULT_VEHICLE = 'porsche-911-992';

/** How many cars one can be compared with at once. */
export const MAX_VS = 3;

/** Valid, distinct vehicle ids other than the car itself, in order, at most MAX_VS. */
export function cleanVs(ids: readonly string[] | undefined, vehicleId: string): string[] {
  const out: string[] = [];
  for (const id of ids ?? [])
    if (id !== vehicleId && !out.includes(id) && findVehicle(id) && out.length < MAX_VS)
      out.push(id);
  return out;
}

const withVs = (v: View, vs: readonly string[] | undefined): View => {
  const ids = cleanVs(vs, v.vehicleId);
  return ids.length ? { ...v, vs: ids } : v;
};

export function parseView(path: string): View {
  const [route, query = ''] = path.split('?');
  const [vehicle, second, third] = route.split('/').filter(Boolean).map(decodeURIComponent);
  const vs = new URLSearchParams(query).get('vs')?.split(',').filter(Boolean);
  const vehicleId =
    vehicle && findVehicle(vehicle)
      ? vehicle
      : (findVehicle(DEFAULT_VEHICLE)?.id ?? listVehicles()[0].id);
  if (!second) return withVs({ vehicleId, level: 'car' }, vs);
  if (second === 'internals' || second === 'drive') return withVs({ vehicleId, level: second }, vs);
  if (second === 'track')
    return withVs(
      { vehicleId, level: 'track', ...(third && findTrack(third) ? { track: third } : {}) },
      vs,
    );
  const parts = partIds(vehicleId);
  if (parts.includes(second))
    return withVs({ vehicleId, level: 'part', part: second, detail: third }, vs);
  // a part this car doesn't have (a link from another car): an EV's "engine" is its motor
  const motor = second === 'engine' ? parts.find((p) => p.startsWith('motor')) : undefined;
  return withVs(
    motor ? { vehicleId, level: 'part', part: motor } : { vehicleId, level: 'internals' },
    vs,
  );
}

const partIdCache = new Map<string, string[]>();
function partIds(vehicleId: string): string[] {
  let ids = partIdCache.get(vehicleId);
  if (!ids) {
    ids = layoutPowertrain(findVehicle(vehicleId)!).parts.map((p) => p.id);
    partIdCache.set(vehicleId, ids);
  }
  return ids;
}

export function viewPath(v: View): string {
  const base = `/${v.vehicleId}`;
  const vs = cleanVs(v.vs, v.vehicleId);
  const q = vs.length ? `?vs=${vs.join(',')}` : '';
  switch (v.level) {
    case 'car':
      return base + q;
    case 'internals':
    case 'drive':
      return `${base}/${v.level}${q}`;
    case 'part':
      return `${base}/${v.part}${v.detail ? `/${v.detail}` : ''}${q}`;
    case 'track':
      return `${base}/track${v.track ? `/${v.track}` : ''}${q}`;
  }
}

/** See-through: the x-ray body with the drivetrain showing (inside, or zoomed into a part). */
export const isSeeThrough = (v: View) => v.level === 'internals' || v.level === 'part';

/** The car view with see-through on or off; switching it off backs out of a zoomed part. */
export const withSeeThrough = (v: View, on: boolean): View =>
  withVs({ vehicleId: v.vehicleId, level: on ? 'internals' : 'car' }, v.vs);

/**
 * Another car in the same mode: see-through stays on, a zoomed part stays zoomed if the new car
 * has it (else the car view), drive keeps driving. A car it was compared with trades places.
 */
export function withVehicle(v: View, id: string): View {
  if (id === v.vehicleId) return v;
  const vs = v.vs?.map((x) => (x === id ? v.vehicleId : x));
  return parseView(viewPath({ ...v, vehicleId: id, detail: undefined, vs }));
}

/** One step out (Esc, trail, back button): detail → part → internals → car; drive → car;
 *  a lap → the circuits → car. */
export function zoomOut(v: View): View | null {
  if (v.level === 'part')
    return v.detail
      ? { ...v, detail: undefined }
      : withVs({ vehicleId: v.vehicleId, level: 'internals' }, v.vs);
  if (v.level === 'track' && v.track) return { ...v, track: undefined };
  if (v.level === 'internals' || v.level === 'drive' || v.level === 'track')
    return withVs({ vehicleId: v.vehicleId, level: 'car' }, v.vs);
  return null;
}

/**
 * Hash navigation that keeps a ?query inside the hash (wouter's own navigate moves it into the
 * page's search string). `replace` for state that shouldn't pile up in the history.
 */
export function navigateHash(path: string, replace = false) {
  const oldURL = location.href;
  const url = new URL(oldURL);
  url.hash = path;
  const newURL = url.href;
  if (newURL === oldURL) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', newURL);
  dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL }));
}

export type Go = (next: View, opts?: { replace?: boolean }) => void;

export function useView(): [View, Go] {
  const [location] = useHashLocation();
  return [
    parseView(location),
    (next, opts) => navigateHash(viewPath(parseView(viewPath(next))), opts?.replace),
  ];
}

/** car ⇄ internals is the see-through switch, not a new view: it replaces the history entry */
const isToggle = (a: Level, b: Level) =>
  (a === 'car' && b === 'internals') || (a === 'internals' && b === 'car');

/** One step out, as Esc and the back-out click do it. */
export function backOut(view: View, go: Go) {
  const up = zoomOut(view);
  if (up) go(up, { replace: isToggle(view.level, up.level) });
}
