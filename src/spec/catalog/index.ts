/**
 * Catalog registry. Entries are discovered by file — add a file under engines/, motors/ or
 * vehicles/ that default-exports a spec; never edit this index to register one.
 */
import type { EngineFamily, EngineSpec, MotorSpec, VehicleSpec } from '../types';

function byId<T extends { id: string }>(mods: Record<string, T>, kind: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const [path, item] of Object.entries(mods)) {
    if (map.has(item.id)) throw new Error(`duplicate ${kind} id "${item.id}" (${path})`);
    map.set(item.id, item);
  }
  return map;
}

const engines = byId(
  import.meta.glob<EngineSpec>('./engines/*.ts', { eager: true, import: 'default' }),
  'engine',
);
const motors = byId(
  import.meta.glob<MotorSpec>('./motors/*.ts', { eager: true, import: 'default' }),
  'motor',
);
const vehicles = byId(
  import.meta.glob<VehicleSpec>('./vehicles/*.ts', { eager: true, import: 'default' }),
  'vehicle',
);

const FAMILY_ORDER: EngineFamily[] = ['inline', 'flat', 'v', 'vr', 'w', 'rotary'];
const ARCHETYPE_ORDER = [
  'city',
  'hatch',
  'hot-hatch',
  'saloon',
  'luxury',
  'suv',
  'offroader',
  'gt',
  'roadster',
  'sports',
  'supercar',
  'hypercar',
  'ev',
];

function need<T>(map: Map<string, T>, id: string, kind: string): T {
  const item = map.get(id);
  if (!item) throw new Error(`unknown ${kind} "${id}"`);
  return item;
}

export const getEngine = (id: string) => need(engines, id, 'engine');
export const getMotor = (id: string) => need(motors, id, 'motor');
export const getVehicle = (id: string) => need(vehicles, id, 'vehicle');
export const findEngine = (id: string) => engines.get(id);
export const findVehicle = (id: string) => vehicles.get(id);

/** Engines by cylinder count, then family. */
export const listEngines = (): EngineSpec[] =>
  [...engines.values()].sort(
    (a, b) =>
      a.cylinders.length - b.cylinders.length ||
      FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) ||
      a.id.localeCompare(b.id),
  );

export const listMotors = (): MotorSpec[] => [...motors.values()];

/** Vehicles from small city cars up to supercars, EVs last. */
export const listVehicles = (): VehicleSpec[] => {
  const rank = (v: VehicleSpec) => {
    const i = ARCHETYPE_ORDER.indexOf(v.archetype);
    return i < 0 ? ARCHETYPE_ORDER.length : i;
  };
  return [...vehicles.values()].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
};
