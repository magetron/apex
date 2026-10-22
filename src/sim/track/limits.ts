/**
 * What holds each car back at each point of its hot lap (the lap simulator labels every point),
 * the link to its layout:
 *  - grip: cornering as fast as the tyres allow;
 *  - traction: accelerating as hard as the DRIVEN tyres allow (the engine has more to give);
 *  - power: accelerating as hard as the engine allows (the tyres could take more), or at the
 *    top speed the engine holds against the drag;
 *  - brake: braking as hard as the tyres allow.
 */
import type { Lap } from './lap';

export const LIMITS = ['grip', 'traction', 'power', 'brake'] as const;
export type Limit = (typeof LIMITS)[number];
export const GRIP = 0;
export const TRACTION = 1;
export const POWER = 2;
export const BRAKE = 3;

/** Seconds of the lap spent at each limit. */
export function limitTimes(lap: Lap): Record<Limit, number> {
  const out: Record<Limit, number> = { grip: 0, traction: 0, power: 0, brake: 0 };
  for (let i = 0; i < lap.n; i++) out[LIMITS[lap.limit[i]]] += lap.t[i + 1] - lap.t[i];
  return out;
}

/** The stretches [from, to) of samples at one limit, at least `min` samples long. */
export function limitRuns(lap: Lap, which: number, min = 3): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= lap.n; i++) {
    const on = i < lap.n && lap.limit[i] === which;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      if (i - start >= min) runs.push([start, i]);
      start = -1;
    }
  }
  return runs;
}

/** Share of the lap time on full power (0..1). */
export function fullPowerShare(lap: Lap): number {
  return limitTimes(lap).power / lap.time;
}
