/**
 * Visual-only parameters of the procedural body shell. Nothing here is a contract: the spec's
 * dims (length, width, height, wheelbase, overhangs, track, tyres) are always respected, and
 * these values only shape the surface in between. Vehicle frame, millimetres throughout.
 */
import type { VehicleSpec } from '../../spec/types';
import type { Pt } from './curves';

export type DecalMat =
  | 'glass'
  | 'lamp'
  | 'lampRed'
  | 'lampAmber'
  | 'drl'
  | 'black'
  | 'grille'
  | 'chrome'
  | 'accent'
  | 'fabric'
  | 'paint';

/**
 * Which way a decal is projected onto the shell: 'side' = (u x, v y) onto the right flank,
 * 'top' = (u x, v z) down onto the top, 'front'/'rear' = (u z, v y) onto the nose/tail.
 */
export type DecalView = 'side' | 'top' | 'front' | 'rear';

/** A conformal patch (glass, lamp, grille, trim) laid on the shell. x-monotone in (u, v). */
export interface Decal {
  tag?: string;
  view: DecalView;
  u0: number;
  u1: number;
  lo: (u: number) => number;
  hi: (u: number) => number;
  mat: DecalMat;
  /** add the mirror image across the centre plane (z → −z) */
  mirror?: boolean;
  /** mm off the surface (later layers sit higher) */
  offset?: number;
  nu?: number;
  nv?: number;
  /** include its outline in the x-ray edge lines (default true for glass/lamps) */
  outline?: boolean;
  /** front/rear views: how far back from the tip a hit still counts (mm, default 420) */
  depth?: number;
}

export interface ExhaustTip {
  /** lateral position (mm, right +) */
  z: number;
  y: number;
  /** radius (mm); w stretches it sideways into an oval/trapezoid */
  r: number;
  w?: number;
}

export interface WheelArch {
  axle: 'front' | 'rear';
  x: number;
  y: number;
  tyreR: number;
  archR: number;
  /** inner wall of the wheel well (mm from the centre line) */
  zInner: number;
  /** tyre outer face */
  zOuter: number;
}

/** Everything a tuning file may need about the car, derived from the spec. */
export interface BodyContext {
  v: VehicleSpec;
  /** nose and tail x (front bumper = overhangF, tail = overhangF − length) */
  xF: number;
  xR: number;
  L: number;
  W: number;
  H: number;
  WB: number;
  /** tyre radius */
  R: number;
  /** nominal ground clearance under the floor */
  clear: number;
  wheels: WheelArch[];
}

export interface BodyParams {
  /** centre-line top: nose, bonnet, windscreen, roof, rear glass, deck, tail — [x, y] */
  top: Pt[];
  /** the side's top edge: wing tops, beltline, rear deck edge — [x, y] */
  belt: Pt[];
  /** underside: bumper bottoms, floor — [x, y] */
  bottom: Pt[];
  /** plan-view taper as a fraction of the half width — [x, f] */
  plan: Pt[];
  /** plan-view rounding of the nose/tail: length (mm) and superellipse exponent */
  nose: { len: number; p: number };
  tail: { len: number; p: number };
  /** x range [rear, front] where the greenhouse may rise above the belt */
  cabin: [number, number];
  /** height of the widest point, as a fraction from floor to belt */
  shoulder: number;
  /** lower body corner radius (mm) */
  cornerR: number;
  /** inward tuck from shoulder to belt (mm) */
  tuck: number;
  /** inward tuck from shoulder down to the sill (mm): curved doors vs. slab sides */
  tuckUnder: number;
  /** greenhouse width at the roof, as a fraction of the body half width (tumblehome) */
  roofHalf: number;
  /** roof crown (mm): how much lower the roof edge is than the roof centre */
  crown: number;
  /** cross-section exponent of the top surfaces: 2 round … 5 flat with tight edges */
  topExp: number;
  /** wing humps above the bonnet/deck line (911 wings, R8 haunches) — [x, mm] */
  wing: Pt[];
  /** where across the half width the wing peaks (0 centre … 1 edge) */
  wingAt: number;
  /** crisp shoulder crease at the belt (modern cars) vs. a rounded flank */
  beltCrease: boolean;
  /** tyre-to-arch gap (mm) */
  archGap: number;
  /** extra width over each axle (mm): fender flares / haunches */
  flare: [number, number];
  /** share of the flare still present at the belt (0 = only low down) */
  flareTop: number;
  /** wheel-arch lip radius (mm), 0 = none */
  lip: number;
  lipMat: 'paint' | 'black';
  /** colour of 'accent' decals (Smart tridion, R8 side blade) */
  accent: string;
  mirrors: { x: number; dy: number; mat: 'paint' | 'black' } | null;
  exhaust: ExhaustTip[];
  /** spare wheel on the tailgate (off-roaders) */
  spare: boolean;
  /** roof rails (SUVs) */
  rails: boolean;
  /** glass, lamps, grilles, trims; gets the generated defaults to keep, filter or extend */
  decals: (s: BodyShapeApi, defaults: Decal[]) => Decal[];
}

/** The subset of the evaluated shape that decal builders use. */
export interface BodyShapeApi {
  c: BodyContext;
  p: BodyParams;
  top(x: number): number;
  belt(x: number): number;
  bottom(x: number): number;
  roofEdge(x: number): number;
  /** half width at the shoulder (no flare) */
  halfW(x: number): number;
  /** greenhouse half width at the roof edge */
  ghHalfW(x: number): number;
  /** outermost z of the shell at (x, y), −1 if none */
  outerZ(x: number, y: number): number;
  /** topmost y of the shell at (x, z), −Infinity if none */
  topY(x: number, z: number): number;
  /** x where a ray along X first meets the shell at (y, z), from the front or the rear */
  endX(y: number, z: number, end: 'front' | 'rear', hint?: number | null): number | null;
}

/** Per-car tuning file (src/vehicle3d/bodies/<vehicle-id>.ts): visual overrides only. */
export type BodyTuning = (c: BodyContext, base: BodyParams) => Partial<BodyParams>;
