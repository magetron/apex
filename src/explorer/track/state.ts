/**
 * Hot-lap mode's shared state: the visitor's settings (zustand, for the HUD) and the playback
 * clock (a plain mutable object: the scene advances it every frame, the HUD reads it in its own
 * animation frame; never mirrored into React state).
 */
import { useMemo } from 'react';
import { Matrix4 } from 'three';
import { create } from 'zustand';
import { useTheme } from '../../scene/theme';
import type { Lap, RaceLine } from '../../sim/track';
import { findVehicle } from '../../spec/catalog';
import type { VehicleSpec } from '../../spec/types';
import { compareColors, mainColor } from '../compare';
import { useLaps, useLapVersion } from './laps';

export type TrackCamera = 'chase' | 'map';

export const useHotLap = create<{
  camera: TrackCamera;
  playing: boolean;
  /** playback speed (× real time) */
  speed: number;
  /** the racing line drawn on the track */
  line: boolean;
  /** bumped to start the laps again */
  restart: number;
  /** every car is home: the result card holds until the visitor watches again */
  finished: boolean;
  /** the cars are loaded and drawn: the clock may run */
  ready: boolean;
}>(() => ({
  camera: 'chase',
  playing: true,
  speed: 1,
  line: true,
  restart: 0,
  finished: false,
  ready: false,
}));

/** Watch the laps again from the line. */
export const watchAgain = () =>
  useHotLap.setState((s) => ({ restart: s.restart + 1, playing: true, finished: false }));

/** Seconds into the laps (all cars leave the line together at 0). Written by the scene. */
export const playback = {
  t: 0,
  /** when the slowest car is home (s) */
  end: 0,
  /** car A's sample index (fractional, within its lap), for the charts' playhead */
  at: 0,
};

/** after the last car crosses the line, before the result card (s) */
export const FINISH_BEAT = 1.2;

/** Where each car is drawn this frame (world metres), for the HUD's name tags. */
export const racerSpots: { x: number; z: number; on: boolean }[] = [];

/**
 * Where each key moment's tag is pinned on the road (world metres), how far down its stack it
 * sits and its size on screen (px), and whether it shows: the name tags keep off them.
 */
export const momentSpots: {
  x: number;
  y: number;
  z: number;
  dy: number;
  w: number;
  h: number;
  on: boolean;
}[] = [];

/** The camera's view-projection, published every frame for the HUD's name tags. */
export const tagView = { m: new Matrix4(), ok: false };

export interface Racer {
  vehicle: VehicleSpec;
  lap: Lap;
  color: string;
}

/** The cars on the circuit, and the racing line they share (once known). */
export type Racers = Racer[] & { line?: RaceLine };

/**
 * The cars on the circuit: car A first, then the ones it is compared with, each with its hot lap
 * and its colour (the comparison colours of the car view). Empty until every lap has been driven
 * (off the main thread); `line` is the racing line once it is known.
 */
export function useRacers(
  trackId: string | undefined,
  a: VehicleSpec,
  vs?: readonly string[],
): Racers {
  const theme = useTheme((s) => s.theme);
  const key = vs?.join(',') ?? '';
  const others = useMemo(
    () => (key ? key.split(',') : []).map(findVehicle).filter((v): v is VehicleSpec => !!v),
    [key],
  );
  const ids = useMemo(() => [a.id, ...others.map((o) => o.id)], [a, others]);
  const { line, laps } = useLaps(trackId, ids);
  const version = useLapVersion((s) => s.v);
  return useMemo(() => {
    const out: Racers = [];
    if (!trackId || !laps || !line) return out;
    const colors = [mainColor(theme), ...compareColors(others, theme)];
    [a, ...others].forEach((vehicle, i) => out.push({ vehicle, lap: laps[i], color: colors[i] }));
    out.line = line;
    return out;
    // laps and line arrive with the version
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, a, others, theme, version]);
}
