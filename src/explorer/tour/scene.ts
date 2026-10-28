/**
 * What a tour step shows, in the explorer's own terms: the view it opens (the balance view is the
 * engine's `balance` detail, drive's car B the URL's `vs`) and the angle it frames from. Pure,
 * for the player and its tests.
 */
import type { CameraPreset, TourScene } from '../../content/types';
import type { FrameOptions } from '../../scene/CameraRig';
import { CAMERA_PRESETS } from '../../vehicle3d/camera';
import { parseView, viewPath, type View } from '../view';

/** The explorer view a step opens. */
export function stepView(scene: TourScene): View {
  const v = scene.view;
  const balance = scene.balance && v.level === 'part' && v.part === 'engine';
  const rival = scene.drive?.ghosts?.[0];
  return {
    ...v,
    detail: balance ? 'balance' : v.detail,
    // drive: car B is the first ghost (none: the question's own pick)
    vs: v.level === 'drive' ? (rival ? [rival] : undefined) : v.vs,
  };
}

/** A view's hash path as the explorer itself writes it (so two paths compare equal). */
export const normalPath = (path: string) => viewPath(parseView(path));

/** The hash path a step opens. */
export const stepPath = (scene: TourScene) => normalPath(viewPath(stepView(scene)));

/** the car view's own arrival angle (FocusCamera): high on the right, mostly side-on */
const USUAL = { azimuth: Math.PI * 0.2, polar: Math.PI * 0.28 };

/**
 * The angle a step frames from: its preset's (the explorer frames the distance, clear of the
 * HUD), else the usual one for the car view; a zoomed part opens as the explorer opens it.
 */
export function stepAngles(scene: TourScene): FrameOptions | null {
  const preset: CameraPreset | undefined =
    typeof scene.camera === 'string' ? scene.camera : undefined;
  if (preset) {
    const { azimuth, polar } = CAMERA_PRESETS[preset];
    return { azimuth, polar };
  }
  const level = scene.view.level;
  return !scene.camera && (level === 'car' || level === 'internals') ? USUAL : null;
}
