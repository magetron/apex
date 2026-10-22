/**
 * Where the explorer's camera looks from, as pure functions (FocusCamera flies there):
 *  - whether the visitor's angle still shows a car's layout (engine and driven wheels), so a car
 *    swap or a step back from a part can keep it
 *  - where an engine's cylinder layout reads: from above at three quarters along the crank for a
 *    flat, V or rotary, from the timing end (the banks or rotors face the camera, the flywheel is
 *    behind), side-on for an inline (the row of cylinders)
 *  - how low the visitor may orbit (not down to the floor grid)
 *  - when what is framed has stopped sliding into place, so it is framed where it ends up
 */
import type { EngineSpec, PlacedPart } from '../spec/types';

/**
 * From the side, more or less, and from above but not straight down: the whole length of the car
 * shows, so wherever its engine sits and whichever wheels drive, they are in view. Head-on or
 * from behind, one end hides the other; from straight above or below, the drivetrain is a plan.
 */
export function showsLayout(azimuth: number, polar: number): boolean {
  return Math.abs(Math.cos(azimuth)) >= 0.45 && polar >= Math.PI * 0.15 && polar <= Math.PI * 0.42;
}

/** how far off the crank axis to look along it (rad): the crank and pistons, not just its end */
export const ALONG_OFFSET = Math.PI * 0.14;

/** Of an angle and the one opposite, the one from the front right (where the explorer looks). */
function frontRight(az: number): number {
  const b = az + Math.PI;
  return Math.sin(az) + Math.cos(az) >= Math.sin(b) + Math.cos(b) ? az : b;
}

/**
 * Where to look at an engine from (azimuth, polar; rad, the explorer's frame: +X forward, the
 * camera at +Z sees the car's right side). `part` is the engine as the layout placed it: its
 * local +X (the crank) turned by its yaw.
 */
export function engineView(
  engine: Pick<EngineSpec, 'family'>,
  part: Pick<PlacedPart, 'yawDeg'>,
): { azimuth: number; polar: number } {
  const yaw = (part.yawDeg * Math.PI) / 180;
  // the crank runs along (cos yaw, −sin yaw) on the ground; the camera's ground direction for
  // an azimuth is (sin az, cos az)
  const along = Math.atan2(Math.cos(yaw), -Math.sin(yaw));
  if (engine.family === 'inline')
    return { azimuth: frontRight(along + Math.PI / 2), polar: Math.PI * 0.38 };
  // from the timing end (the flywheel, a big disc, at the far end), a little to one side and
  // well above: a boxer's opposed pistons, a V's two banks, a rotary's rotors
  return { azimuth: along + ALONG_OFFSET, polar: Math.PI * 0.3 };
}

/**
 * The lowest the visitor orbits to in the car and engine views (polar angle, rad): ~13° above the
 * ground. Lower, a drag slid the camera down to the floor, where the car's layout reads flat.
 */
export const ORBIT_FLOOR = Math.PI * (0.5 - 13 / 180);

/** Comparing from the side: the preset looks from nearly level, so the floor sits just below it. */
export const SIDE_FLOOR = Math.PI * 0.48;

/** Where a framed thing stands: the middle of its pieces and how far they spread from it. */
export interface Spot {
  x: number;
  y: number;
  z: number;
  spread: number;
}

/** The spot of some pieces' positions (m): a slide moves the middle, an explode the spread. */
export function spotOf(pts: readonly (readonly [number, number, number])[]): Spot | null {
  if (!pts.length) return null;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  x /= pts.length;
  y /= pts.length;
  z /= pts.length;
  let spread = 0;
  for (const p of pts) spread += Math.hypot(p[0] - x, p[1] - y, p[2] - z);
  return { x, y, z, spread: spread / pts.length };
}

/** Whether a spot moved less than `tol` (m) from one frame to the next. */
export function stillSince(a: Spot | null, b: Spot | null, tol = 0.0015): boolean {
  return (
    !!a &&
    !!b &&
    Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < tol &&
    Math.abs(a.spread - b.spread) < tol
  );
}
