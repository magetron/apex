/**
 * Named framings for any vehicle (content/types CameraPreset), relative to the car's body so
 * they work for every size. The rig cannot go below the ground, so 'underside' is a low side view.
 */
import type { CameraPreset } from '../content/types';
import { frameObject, type FrameOptions } from '../scene/CameraRig';
import { getPartObject } from '../scene/registry';

export const CAMERA_PRESETS: Record<CameraPreset, FrameOptions> = {
  'front-3q': { azimuth: Math.PI * 0.3, polar: Math.PI * 0.4, padding: 0.08 },
  'rear-3q': { azimuth: -Math.PI * 0.72, polar: Math.PI * 0.4, padding: 0.08 },
  side: { azimuth: 0, polar: Math.PI * 0.495, padding: 0.3 },
  top: { azimuth: 0, polar: 0.001, padding: 0.3 },
  front: { azimuth: Math.PI / 2, polar: Math.PI * 0.48, padding: 0.3 },
  rear: { azimuth: -Math.PI / 2, polar: Math.PI * 0.48, padding: 0.3 },
  underside: { azimuth: Math.PI * 0.15, polar: Math.PI * 0.495, padding: 0.2 },
};

/** Fly the camera to a preset around the mounted car (or any part id). */
export function framePreset(preset: CameraPreset, partId = 'body') {
  const obj = getPartObject(partId);
  if (obj) void frameObject(obj, CAMERA_PRESETS[preset]);
}
