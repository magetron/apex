/**
 * The circuits: one file per track under tracks/, discovered automatically (like the catalog);
 * never edit this file to register one.
 */
import type { TrackSpec } from './types';

const specs = new Map<string, TrackSpec>();
for (const [path, spec] of Object.entries(
  import.meta.glob<TrackSpec>('./tracks/*.ts', { eager: true, import: 'default' }),
)) {
  if (specs.has(spec.id)) throw new Error(`duplicate track id "${spec.id}" (${path})`);
  specs.set(spec.id, spec);
}

/** Shortest first. */
export const listTracks = (): TrackSpec[] =>
  [...specs.values()].sort((a, b) => a.lengthM - b.lengthM);
export const findTrack = (id: string) => specs.get(id);
export function getTrack(id: string): TrackSpec {
  const t = specs.get(id);
  if (!t) throw new Error(`unknown track "${id}"`);
  return t;
}
