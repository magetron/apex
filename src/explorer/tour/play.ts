/**
 * Playing a tour through the explorer's own state: each step navigates the hash to its view and
 * sets what that view shows (explode, highlighted parts, overlays, an engine swap, the drive
 * question and car B, engine speed, a camera angle). Starting a tour remembers where the visitor
 * was; leaving it puts all of that back.
 */
import { Vector3 } from 'three';
import { findTour } from '../../content';
import type { OverlayKind, TourScene } from '../../content/types';
import { engineRuntime } from '../../scene/runtime';
import { useScene, type CameraShot } from '../../scene/store';
import type { ScenarioId } from '../../sim/scenarios';
import { DEFAULT_OVERLAYS, useVehicleOverrides } from '../../vehicle3d/store';
import { useDrive, type DriveMode } from '../drive/state';
import type { CompareKind } from '../drive/versus';
import { parseView, type Level } from '../view';
import { normalPath, stepAngles, stepPath } from './scene';
import { askCamera, closeTours, setStage, touring, useTour } from './state';
import { writeTour } from './url';

interface Snapshot {
  path: string;
  level: Level;
  explode: number;
  overlays: OverlayKind[];
  engineSwap: Record<string, string>;
  scenario: ScenarioId;
  compare: CompareKind;
  mode: DriveMode;
  rpm: number;
  timeScale: number;
  camera: CameraShot | null;
}

/** where the visitor was when the tour started (none: the tour was opened from a link) */
let snap: Snapshot | null = null;

const here = () => normalPath(location.hash.replace(/^#/, '') || '/');

function snapshot(): Snapshot {
  const path = here();
  const c = useScene.getState().controls;
  const d = useDrive.getState();
  return {
    path,
    level: parseView(path).level,
    explode: useScene.getState().explode,
    overlays: useVehicleOverrides.getState().overlays,
    engineSwap: useVehicleOverrides.getState().engineSwap,
    scenario: d.scenario,
    compare: d.compare,
    mode: d.mode,
    rpm: engineRuntime.rpm,
    timeScale: engineRuntime.timeScale,
    camera: c
      ? {
          position: c.getPosition(new Vector3()).toArray(),
          target: c.getTarget(new Vector3()).toArray(),
        }
      : null,
  };
}

/** Starts a tour at its first step (another tour while one plays keeps the way back). */
export function startTour(id: string) {
  const playing = touring();
  if (!playing) snap = snapshot();
  closeTours();
  writeTour({ id, step: 0 }, null, playing ? 'replace' : 'push');
}

/** Goes to a step of the tour playing (the one on screen again: plays it again). */
export function goStep(step: number) {
  const at = useTour.getState().at;
  const tour = at && findTour(at.id);
  if (!at || !tour || step < 0 || step >= tour.steps.length) return;
  if (step === at.step) useTour.setState((s) => ({ replay: s.replay + 1 }));
  else writeTour({ id: at.id, step }, null, 'replace');
}

/** Ends the tour playing, back where the visitor was; false if none was. */
export function leaveTour(): boolean {
  if (!touring()) return false;
  writeTour(null, snap?.path ?? null, 'replace');
  return true;
}

/** What to set once the view a step (or leaving) opens is on screen. */
export interface Pending {
  path: string;
  run: () => void;
}

/**
 * Sets what a step's view needs before it opens (the drive question and car B, the engine swap,
 * explode and highlight) and returns the path to open and what to set once it is open (the
 * overlays, which a car change resets; engine speed; the camera; sound).
 */
export function stageStep(scene: TourScene): Pending {
  const path = stepPath(scene);
  const { vehicleId } = scene.view;

  if (scene.drive) {
    const d = useDrive.getState();
    if (d.scenario !== scene.drive.scenario) d.setScenario(scene.drive.scenario);
    // car B: the URL's pick (the step's ghost), else the question's own
    useDrive.setState({ compare: 'auto', mode: 'watch' });
    d.restart();
  }

  // the step's own engine, or the car's (a swap the visitor made elsewhere stays theirs)
  const swaps = { ...(snap?.engineSwap ?? useVehicleOverrides.getState().engineSwap) };
  delete swaps[vehicleId];
  if (scene.engine) swaps[vehicleId] = scene.engine;
  useVehicleOverrides.setState({ engineSwap: swaps });

  const explode = scene.explode ?? 0;
  const highlight = scene.highlight ?? [];
  setStage({ path, explode, highlight });
  useScene.setState({ explode, highlight });

  // every car-view step frames its scene afresh (an explode spreads past the last frame)
  const look = typeof scene.camera === 'object' ? scene.camera : undefined;
  const angles = stepAngles(scene);

  return {
    path,
    run: () => {
      useVehicleOverrides.getState().setOverlays(scene.overlays ?? []);
      if (scene.rpm !== undefined) engineRuntime.rpm = scene.rpm;
      if (scene.timeScale !== undefined) engineRuntime.timeScale = scene.timeScale;
      if (look) askCamera({ look });
      else if (angles) askCamera({ angles });
      if (scene.sound) useTour.setState((s) => ({ sound: s.sound + 1 }));
    },
  };
}

/** Puts back what the tour changed (the URL is already back); what to set once it is open. */
export function restore(): Pending {
  const path = here();
  const s = snap;
  snap = null;
  const explode = s?.explode ?? 0;
  setStage({ path, explode, highlight: [] });
  useScene.setState({ explode, highlight: [] });
  useVehicleOverrides.setState({ engineSwap: s?.engineSwap ?? {} });
  if (s) {
    const d = useDrive.getState();
    if (d.scenario !== s.scenario) d.setScenario(s.scenario);
    useDrive.setState({ compare: s.compare, mode: s.mode });
    engineRuntime.rpm = s.rpm;
    engineRuntime.timeScale = s.timeScale;
  }
  return {
    path,
    run: () => {
      useVehicleOverrides.getState().setOverlays(s?.overlays ?? DEFAULT_OVERLAYS);
      // the camera as it was, where it was (drive and the hot lap keep their own cameras)
      const own = s && s.path === path && s.level !== 'drive' && s.level !== 'track';
      if (own && s.camera) askCamera({ look: s.camera });
      useTour.setState({ sound: 0 });
    },
  };
}
