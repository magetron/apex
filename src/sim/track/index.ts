/**
 * Real circuits and hot laps round them. Centrelines, racing lines and laps are worked out once
 * each and cached (lap.worker.ts works them out off the main thread and hands them over).
 */
import { carParams } from '../model';
import { getEngine } from '../../spec/catalog';
import type { VehicleSpec } from '../../spec/types';
import { buildPath } from './geometry';
import { lapCar, simulateLap, type Lap } from './lap';
import { raceLine } from './raceline';
import { getTrack } from './registry';
import type { RaceLine, TrackPath } from './types';

export type * from './types';
export { buildPath, indexAt } from './geometry';
export { raceLine } from './raceline';
export {
  DRIVER,
  lapCar,
  PHASES,
  SHIFT_S,
  simulateLap,
  type Lap,
  type LapCar,
  type LapOptions,
  type Phase,
} from './lap';
export * from './analysis';
export * from './limits';
export { findTrack, getTrack, listTracks } from './registry';

const paths = new Map<string, TrackPath>();
const lines = new Map<string, RaceLine>();
const laps = new Map<string, Lap>();

/** The track's centreline, built once. */
export function trackPath(id: string): TrackPath {
  let p = paths.get(id);
  if (!p) paths.set(id, (p = buildPath(getTrack(id))));
  return p;
}

/** The track's racing line, worked out once. */
export function trackLine(id: string): RaceLine {
  let l = lines.get(id);
  if (!l) lines.set(id, (l = raceLine(trackPath(id))));
  return l;
}

/** Whether the racing line is already known (no work to ask for it). */
export const hasLine = (id: string) => lines.has(id);

/** A racing line worked out elsewhere (the worker). */
export function setLine(id: string, line: RaceLine) {
  if (!lines.has(id)) lines.set(id, line);
}

const lapKey = (trackId: string, vehicleId: string) => `${trackId}|${vehicleId}`;

/** A lap already driven, if it has been. */
export const cachedLap = (trackId: string, vehicleId: string) =>
  laps.get(lapKey(trackId, vehicleId));

/** A lap driven elsewhere (the worker). */
export function setLap(lap: Lap) {
  const key = lapKey(lap.trackId, lap.vehicleId);
  if (!laps.has(key)) laps.set(key, lap);
}

/**
 * A car's hot lap of a track, driven once (from its spec: carParams and its engine's induction →
 * the lap simulator), with what limits it at every point.
 */
export function hotLap(trackId: string, vehicle: VehicleSpec): Lap {
  const key = lapKey(trackId, vehicle.id);
  let lap = laps.get(key);
  if (!lap) {
    const pt = vehicle.powertrain;
    const induction = pt.kind === 'ice' ? getEngine(pt.engine).induction : undefined;
    const car = lapCar(carParams(vehicle), { induction });
    lap = simulateLap(trackPath(trackId), trackLine(trackId), car, trackId);
    laps.set(key, lap);
  }
  return lap;
}
