/**
 * Shared measures for what the drive draws on and over the road: the colour of a tyre or axle
 * by the grip it is using, and how big a screen pixel is on the ground where the camera looks
 * (so lines and rims stay a few pixels wide however far it stands back).
 */
import type { Color } from 'three';

/** grip in use from which a tyre or axle reads as letting go: red from here… */
const SLIDE_FROM = 0.96;
/** …fully red here (the let-go threshold of lanes.ts) */
const SLIDE_AT = 0.985;

/** Colour for a tyre or axle using `use` (0..1+) of its grip: grey, then red as it lets go. */
export function gripColor(out: Color, use: number, c: { grip: Color; slide: Color }): Color {
  if (use < SLIDE_FROM) return out.copy(c.grip);
  return out.lerpColors(c.grip, c.slide, Math.min(1, (use - SLIDE_FROM) / (SLIDE_AT - SLIDE_FROM)));
}

/** How big a screen pixel is on the ground where the camera looks (m), from the camera hook. */
export const groundScale = { mPerPx: 0.01 };
