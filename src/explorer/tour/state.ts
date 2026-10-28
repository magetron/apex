/**
 * The tour being played, as the URL has it (url.ts), and what the player hands the explorer for
 * the step on screen:
 *  - `stage`: the explode and highlighted parts a step's view opens with (the explorer would
 *    otherwise reset both as the level changes; index.tsx asks for them);
 *  - `camera`: an angle to frame from, or a camera to put back (FocusCamera takes it);
 *  - `sound`: a step that wants the engine heard (the hub's voice starts).
 */
import { create } from 'zustand';
import type { FrameOptions } from '../../scene/CameraRig';
import type { CameraShot } from '../../scene/store';
import { viewPath, type View } from '../view';
import { parseTour, TOUR_EVENT, type TourAt } from './url';

export interface CameraAsk {
  /** bumps on every ask, so the same angle asked again frames again */
  seq: number;
  angles?: FrameOptions;
  /** put the camera exactly here (leaving a tour) instead of framing */
  look?: CameraShot;
}

interface TourState {
  at: TourAt | null;
  /** bumps when the visitor asks for the step on screen again (its dot), to replay it */
  replay: number;
  /** the picker's sheet is open */
  picking: boolean;
  camera: CameraAsk | null;
  /** bumps each time a step asks for sound; 0 none */
  sound: number;
}

const read = () => (typeof location === 'undefined' ? null : parseTour(location.search));

export const useTour = create<TourState>()(() => ({
  at: read(),
  replay: 0,
  picking: false,
  camera: null,
  sound: 0,
}));

// the URL changed: back/forward, a tour step, the explorer's own hash navigation
if (typeof window !== 'undefined') {
  const sync = () => {
    const at = read();
    const cur = useTour.getState().at;
    if (at?.id !== cur?.id || at?.step !== cur?.step) useTour.setState({ at });
  };
  for (const e of ['popstate', 'hashchange', TOUR_EVENT]) window.addEventListener(e, sync);
}

export const openTours = () => useTour.setState({ picking: true });
export const closeTours = () => useTour.setState({ picking: false });

let cameraSeq = 0;
export function askCamera(ask: Omit<CameraAsk, 'seq'>) {
  useTour.setState({ camera: { ...ask, seq: ++cameraSeq } });
}

// ── the stage ───────────────────────────────────────────────────────────────────────────

export interface Stage {
  /** the view's hash path (view.ts viewPath) */
  path: string;
  explode: number;
  highlight: string[];
}

let stage: Stage | null = null;
export const setStage = (s: Stage | null) => (stage = s);
export const currentStage = () => stage;

/** The explode and highlight a tour step (or leaving one) opens this view with, if any. */
export function stagedFor(view: View): Stage | null {
  return stage && stage.path === viewPath(view) ? stage : null;
}

/** A tour is playing. */
export const touring = () => !!useTour.getState().at;
