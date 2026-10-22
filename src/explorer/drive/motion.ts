/**
 * Smooth motion for the moving scenes (drive and the hot lap): every clock steps by the display's
 * own frame interval, and followers trail a moving car by the same distance at any frame rate.
 *
 * Frame order inside one frame (useFrame priorities, lowest first), so that what is drawn, the
 * camera and the tags all show the same moment:
 *   CLOCK_PRIORITY  the scene's clock advances, the cars' poses are worked out (vehiclePose too);
 *   CAMERA_PRIORITY the camera aims at those poses;
 *   −1              camera-controls moves the camera (drei's CameraControls);
 *   0               everything drawn reads the poses (and the camera, for tags);
 *   1               the composer renders.
 */
import { addEffect } from '@react-three/fiber';

export const CLOCK_PRIORITY = -3;
export const CAMERA_PRIORITY = -2;

/**
 * The display's frame times (the animation frame's timestamp, ms), kept by a global effect that
 * runs before each frame's useFrame callbacks. useFrame's own delta is measured when the frame
 * loop happens to start, which wanders by a few ms from frame to frame (at 120 Hz, a quarter of a
 * frame or more): a car moved by it steps unevenly between frames the screen shows evenly, which
 * reads as judder, or a double image at speed.
 */
const frame = { t: NaN, dt: 0 };
const off = addEffect((t) => {
  frame.dt = Number.isFinite(frame.t) && t > frame.t ? (t - frame.t) / 1000 : 0;
  frame.t = t;
});
if (import.meta.hot) import.meta.hot.dispose(off);

/** This frame's step (s): between the display's frames, else `fallback` (useFrame's delta). */
export function frameDt(fallback: number): number {
  return frame.dt > 0 ? frame.dt : fallback;
}

/**
 * One step of a first-order follow (time constant `tau`, s) of a target that went from `from` to
 * `to` over this step of `dt` s: solved exactly for a target moving steadily through the step, so
 * it trails a steadily moving target by its speed × tau at any frame rate. (`x += (to − x)·k`
 * trails it by speed × (tau − dt/2): uneven frames, an uneven lag, a car shaking on screen.)
 */
export function follow(cur: number, from: number, to: number, dt: number, tau: number): number {
  const lag = from - cur;
  if (!(dt > 0)) return to - lag;
  const a = Math.exp(-dt / tau);
  const drift = ((to - from) / dt) * tau;
  return to - (drift + (lag - drift) * a);
}

/** The share of the way to a still target an exponential ease goes in `dt` (time constant tau). */
export const ease = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);
