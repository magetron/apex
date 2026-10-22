/**
 * The explorer's state lives in the URL hash, so the back button zooms out and every view is a
 * deep link. One page, one car as the point of entry:
 *   #/<vehicle>                car exterior (entry)
 *   #/<vehicle>/internals      see-through: drivetrain, CG, torque flow
 *   #/<vehicle>/<part>[/<d>]   zoomed into one component (engine, gearbox, motor-rear…), optional detail
 *   #/<vehicle>/drive          the same car driving and cornering (handling), settings in a corner hub
 */
import { useHashLocation } from 'wouter/use-hash-location';
import { findVehicle, listVehicles } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive/layout';

export type Level = 'car' | 'internals' | 'part' | 'drive';

export interface View {
  vehicleId: string;
  level: Level;
  /** layout part id when level === 'part' */
  part?: string;
  /** optional sub-view inside a part (owned by that part's panel, e.g. "balance") */
  detail?: string;
}

export const DEFAULT_VEHICLE = 'porsche-911-992';

export function parseView(path: string): View {
  const [vehicle, second, third] = path
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
  const vehicleId =
    vehicle && findVehicle(vehicle)
      ? vehicle
      : (findVehicle(DEFAULT_VEHICLE)?.id ?? listVehicles()[0].id);
  if (!second) return { vehicleId, level: 'car' };
  if (second === 'internals' || second === 'drive') return { vehicleId, level: second };
  const parts = partIds(vehicleId);
  if (parts.includes(second)) return { vehicleId, level: 'part', part: second, detail: third };
  // a part this car doesn't have (a link from another car): an EV's "engine" is its motor
  const motor = second === 'engine' ? parts.find((p) => p.startsWith('motor')) : undefined;
  return motor ? { vehicleId, level: 'part', part: motor } : { vehicleId, level: 'internals' };
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
  switch (v.level) {
    case 'car':
      return base;
    case 'internals':
    case 'drive':
      return `${base}/${v.level}`;
    case 'part':
      return `${base}/${v.part}${v.detail ? `/${v.detail}` : ''}`;
  }
}

/** One step out (Esc, trail, back button): detail → part → internals → car; drive → car. */
export function zoomOut(v: View): View | null {
  if (v.level === 'part')
    return v.detail ? { ...v, detail: undefined } : { vehicleId: v.vehicleId, level: 'internals' };
  if (v.level === 'internals' || v.level === 'drive')
    return { vehicleId: v.vehicleId, level: 'car' };
  return null;
}

export function useView(): [View, (next: View) => void] {
  const [location, navigate] = useHashLocation();
  return [parseView(location), (next) => navigate(viewPath(next))];
}
