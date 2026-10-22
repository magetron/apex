/**
 * Hot laps for the explorer, worked out off the main thread (sim/track/lap.worker.ts) and handed
 * to the sim's caches as they arrive, so adding a car or switching circuit never stalls the 3D
 * view. Without workers (tests) the same work runs a job at a time in idle moments.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import {
  cachedLap,
  hasLine,
  hotLap,
  setLap,
  setLine,
  trackLine,
  type Lap,
  type RaceLine,
} from '../../sim/track';
import type { LapJob } from '../../sim/track/lap.worker';
import { getVehicle } from '../../spec/catalog';

/** Bumped as each line or lap arrives: whoever reads the caches renders again. */
export const useLapVersion = create<{ v: number }>(() => ({ v: 0 }));
const bump = () => useLapVersion.setState((s) => ({ v: s.v + 1 }));

let worker: Worker | null | undefined;
let nextId = 0;
const asked = new Set<string>();
const queue: LapJob[] = [];
let idle = 0;

type Reply = { id: number; line?: RaceLine; lap?: Lap; error?: string };

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('../../sim/track/lap.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<Reply>) => {
      const { line, lap, error } = e.data;
      if (error) console.warn('[apex] hot lap:', error);
      const job = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (line && job) setLine(job.trackId, line);
      if (lap) setLap(lap);
      bump();
    };
  } catch {
    worker = null;
  }
  return worker;
}
const pending = new Map<number, LapJob>();

/** Without a worker: one job per idle moment, on the main thread. */
function drain() {
  idle = 0;
  const job = queue.shift();
  if (!job) return;
  if (job.vehicleId) hotLap(job.trackId, getVehicle(job.vehicleId));
  else trackLine(job.trackId);
  bump();
  if (queue.length) idle = window.setTimeout(drain, 0);
}

function ask(trackId: string, vehicleId?: string) {
  const key = `${trackId}|${vehicleId ?? ''}`;
  if (asked.has(key)) return;
  asked.add(key);
  const job: LapJob = { id: nextId++, trackId, vehicleId };
  const w = getWorker();
  if (w) {
    pending.set(job.id, job);
    w.postMessage(job);
  } else {
    queue.push(job);
    if (!idle) idle = window.setTimeout(drain, 0);
  }
}

/** The racing line and laps if all are in; asks for whatever is missing. */
export function useLaps(
  trackId: string | undefined,
  vehicleIds: readonly string[],
): { line: RaceLine | null; laps: Lap[] | null } {
  useLapVersion((s) => s.v);
  const key = vehicleIds.join(',');
  useEffect(() => {
    if (!trackId) return;
    if (!hasLine(trackId)) ask(trackId);
    for (const id of key.split(',').filter(Boolean)) if (!cachedLap(trackId, id)) ask(trackId, id);
  }, [trackId, key]);
  if (!trackId || !hasLine(trackId)) return { line: null, laps: null };
  const laps = vehicleIds.map((id) => cachedLap(trackId, id));
  return {
    line: trackLine(trackId),
    laps: laps.every((l): l is Lap => !!l) ? laps : null,
  };
}

/** One car's lap of a track, once it has been driven (for the circuit cards). */
export function useLap(trackId: string, vehicleId: string): Lap | null {
  return useLaps(trackId, [vehicleId]).laps?.[0] ?? null;
}
