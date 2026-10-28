/**
 * Content contract: tours are written as data and played by the tour player.
 * A tour is a sequence of explorer views (the same states a visitor reaches by clicking),
 * each with a title of a few words: the scene does the explaining, the player shows no prose.
 */
import type { View } from '../explorer/view';
import type { CameraShot } from '../scene/store';

/** Named camera framings every vehicle view understands (vehicle3d/camera.ts). */
export type CameraPreset = 'front-3q' | 'rear-3q' | 'side' | 'top' | 'front' | 'rear' | 'underside';

/** Overlays the vehicle view can draw. */
export type OverlayKind =
  | 'cg' // centre of gravity
  | 'axle-loads' // front/rear load bars
  | 'dimensions' // wheelbase, track, overhangs
  | 'inertia' // "dumbbell" yaw-inertia visual
  | 'floorplan' // top-down cabin vs drivetrain footprint
  | 'bay-fit' // engine + gearbox vs engine-bay envelope
  | 'torque-flow'; // animated drive path crank → wheels

/** Scripted drive-mode scenarios (the sim implements them with these ids). */
export type DriveScenario =
  | 'skidpad'
  | 'power-exit'
  | 'lift-off'
  | 'lane-change'
  | 'braking'
  | 'trail-brake'
  | 'left-foot'
  | 'catch';

export interface TourScene {
  /** where the explorer goes: vehicle + level (+ part/detail) */
  view: View;
  /** engine swap for this step (fit-check stories) */
  engine?: string;
  explode?: number;
  /** part ids from layoutPowertrain() ("engine", "gearbox", "prop-rear", "diff-front",
   *  "wheel-rear-left", "body"…) or engine sub-parts ("engine/crank", "engine/pistons",
   *  "engine/block", "engine/head-0") */
  highlight?: string[];
  overlays?: OverlayKind[];
  /** optional explicit framing; default: the car view from its front three-quarter, a part as
   *  it opens */
  camera?: CameraPreset | CameraShot;
  /** engine views */
  rpm?: number;
  timeScale?: number;
  sound?: boolean;
  /** the engine's balance view */
  balance?: boolean;
  /** drive views: the question, and car B as the one id in `ghosts` (none: the question's own
   *  pick, often the same car without the technique) */
  drive?: { scenario: DriveScenario; ghosts?: string[] };
}

export interface TourStep {
  id: string;
  /** five words at most: all the player shows of the step, so it must be true of the scene */
  title: string;
  /** authoring notes, ≤ ~60 words: what the scene shows and why. Never shown (the scene does
   *  the explaining); numbers come from the scene (stats, labels), not from this text. */
  body: string;
  scene: TourScene;
}

export interface Tour {
  id: string;
  /** The question as a student would ask it. */
  question: string;
  /** ≤ 12 words, shown on the tour card. */
  teaser: string;
  steps: TourStep[];
  /** Sources for the claims made, as URLs or citations. */
  sources?: string[];
}

export interface GlossaryEntry {
  term: string;
  /** one sentence */
  short: string;
  seeAlso?: string[];
}
