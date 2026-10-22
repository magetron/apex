/**
 * Comparing cars in the car view: the compared cars come from the URL (View.vs); how they are
 * shown, and from where, is the visitor's choice here. Both ways keep the front axles level, so
 * wheelbase and overhangs read at a glance:
 *  - side (default): each compared car parked beside the main one (to its left, away from the
 *    camera), the same model, with its own see-through and overlays
 *  - overlay: each compared car is a coloured outline over the main car, in the same place
 * The view presets look at them so sizes compare honestly: a long, narrow lens from three
 * quarters, straight down (every car at the same distance), or from the side (as an overlay:
 * side by side, one car would hide the other).
 */
import { create } from 'zustand';
import type { Theme } from '../scene/theme';
import { findVehicle } from '../spec/catalog';
import type { VehicleSpec } from '../spec/types';
import { mm } from '../spec/units';
import { colorSlots, DRIVE_COLORS, slotColor } from './drive/colors';
import { familyOf } from './drive/state';

export type CompareMode = 'overlay' | 'side';

export type CompareView = '3q' | 'top' | 'side';

/**
 * The view a comparison opens with: three quarters; from above on a phone, where cars side by
 * side are small from three quarters and stack neatly from above.
 */
export const firstView = (): CompareView =>
  typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches ? 'top' : '3q';

export const useCompare = create<{
  mode: CompareMode;
  view: CompareView;
  /** the mode the side view overrode, back when another view is picked */
  before: CompareMode | null;
}>(() => ({ mode: 'side', view: firstView(), before: null }));

/**
 * A view preset. The side view only works as an overlay (side by side, one car hides the other),
 * so it switches to one, and leaving it switches back.
 */
export function pickView(view: CompareView) {
  const { mode, before } = useCompare.getState();
  if (view === 'side')
    useCompare.setState({ view, mode: 'overlay', before: mode === 'overlay' ? before : mode });
  else useCompare.setState({ view, mode: before ?? mode, before: null });
}

/** Side by side or overlay; parking them side by side leaves the side view for three quarters. */
export function pickMode(mode: CompareMode) {
  const { view } = useCompare.getState();
  useCompare.setState(
    mode === 'side' && view === 'side'
      ? { mode, view: '3q', before: null }
      : { mode, before: null },
  );
}

/**
 * The camera angles of each preset (azimuth, polar; rad). Three quarters looks more from the
 * front and higher than the single-car view: the cars parked side by side are nearly the same
 * distance away. Top lays the cars across the screen, nose to the right, the main car lowest.
 */
export const VIEW_ANGLES: Record<CompareView, { azimuth: number; polar: number }> = {
  '3q': { azimuth: Math.PI * 0.39, polar: Math.PI * 0.3 },
  top: { azimuth: 0, polar: 0.02 },
  side: { azimuth: 0, polar: Math.PI * 0.47 },
};

/**
 * The lens while comparing (vertical field of view, deg): long, with the camera backed off to
 * match, so a car further away doesn't look smaller than it is.
 */
export const COMPARE_FOV = 18;

/** The lens for `cars` cars in all: a third and a fourth car stand further off, so it narrows. */
export const compareFov = (cars: number) => (cars <= 2 ? COMPARE_FOV : cars === 3 ? 15 : 13);

/** clear space between cars parked side by side (m) */
export const SIDE_GAP = 0.75;

export const vsCars = (ids: readonly string[] | undefined): VehicleSpec[] =>
  (ids ?? []).map((id) => findVehicle(id)).filter((v): v is VehicleSpec => !!v);

/**
 * The x shift that puts a car's front axle level with the main car's (each car is drawn with its
 * wheelbase centred on the origin).
 */
export const axleShift = (main: VehicleSpec, other: VehicleSpec) =>
  mm(main.dims.wheelbaseMm - other.dims.wheelbaseMm) / 2;

/** Side by side: each compared car's lateral position (m; −Z is the main car's left). */
export function sideOffsets(main: VehicleSpec, others: readonly VehicleSpec[]): number[] {
  let edge = -mm(main.dims.widthMm) / 2;
  return others.map((o) => {
    const w = mm(o.dims.widthMm);
    const z = edge - SIDE_GAP - w / 2;
    edge = z - w / 2;
    return z;
  });
}

/** Each compared car's colour (its layout family's, as on the drive road). */
export function compareColors(others: readonly VehicleSpec[], theme: Theme): string[] {
  const families = others.map(familyOf);
  const slots = colorSlots(families);
  return families.map((f, i) => slotColor(f, slots[i], theme));
}

/** The main car's own colour in a comparison (as "you" on the road). */
export const mainColor = (theme: Theme) => DRIVE_COLORS[theme].you;
