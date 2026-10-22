/**
 * Body profiles measured on the detailed models by scripts/models/profile.mjs (profiles/<model>.json):
 * mm, vehicle frame. The body shape takes them over its guessed/traced outline, so the cabin,
 * seats and luggage placed inside fit the real body.
 */
import { GLTF_CARS } from './manifest';

export interface MeasuredProfile {
  /** centre-line top [x, y] (roof, bonnet, deck; an antenna doesn't count) */
  top: [number, number][];
  /** side top edge [x, y]: the bottom of the side glass, else the top */
  belt: [number, number][];
  /** underside [x, y] */
  bottom: [number, number][];
  /** half width [x, fraction of the spec half width] (mirrors don't count) */
  plan: [number, number][];
  /** x range [rear, front] of the side glass */
  cabin: [number, number] | null;
  /** roof width over the cabin, as a share of the body's half width (tumblehome) */
  roofHalf?: number;
}

const PROFILES = new Map<string, MeasuredProfile>(
  Object.entries(
    import.meta.glob<MeasuredProfile>('./profiles/*.json', { eager: true, import: 'default' }),
  ).map(([path, p]) => [path.replace(/^.*\/|\.json$/g, ''), p]),
);

/** The profile of the model a car wears (cars sharing a model share its profile). */
export function measuredProfile(vehicleId: string): MeasuredProfile | null {
  const file = GLTF_CARS[vehicleId]?.file;
  return file ? (PROFILES.get(file.replace(/\.glb$/, '')) ?? null) : null;
}
