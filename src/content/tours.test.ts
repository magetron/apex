import { describe, expect, it } from 'vitest';
import { findEngine, findVehicle, getEngine } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive';
import type { VehicleSpec } from '../spec/types';
import { GLOSSARY } from './glossary';
import { listTours } from './index';
import type { CameraPreset, DriveScenario, OverlayKind, TourStep } from './types';

const SCENARIOS: DriveScenario[] = ['skidpad', 'power-exit', 'lift-off', 'lane-change', 'braking'];
const OVERLAYS: OverlayKind[] = [
  'cg',
  'axle-loads',
  'dimensions',
  'inertia',
  'floorplan',
  'bay-fit',
  'torque-flow',
];
const CAMERAS: CameraPreset[] = [
  'front-3q',
  'rear-3q',
  'side',
  'top',
  'front',
  'rear',
  'underside',
];
const MAX_CAPTION_WORDS = 60;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
/** A number with a unit is something the scene should show, not the caption. */
const QUANTITY =
  /\d[\d.,]*\s*(%|kg|mm|cm|m\b|kw|hp|ps|bhp|nm|lb|rpm|°|deg|km\/h|mph|kwh|l\b|litre|cc|sec)/i;

/** The vehicle as the step shows it, including an engine swap. */
function shown(step: TourStep): VehicleSpec {
  const v = findVehicle(step.scene.view.vehicleId);
  if (!v) throw new Error(`unknown vehicle "${step.scene.view.vehicleId}"`);
  const swap = step.scene.engine;
  if (!swap) return v;
  if (v.powertrain.kind !== 'ice') throw new Error(`engine swap on an EV (${v.id})`);
  return { ...v, powertrain: { ...v.powertrain, engine: swap } };
}

/** Ids a highlight may name: layout parts, shafts, the body, and engine sub-parts. */
function highlightIds(v: VehicleSpec): Set<string> {
  const layout = layoutPowertrain(v);
  const ids = new Set<string>([
    'body',
    ...layout.parts.map((p) => p.id),
    ...layout.shafts.map((s) => s.id),
  ]);
  if (v.powertrain.kind === 'ice') {
    for (const sub of ['crank', 'pistons', 'block']) ids.add(`engine/${sub}`);
    const heads = new Set(getEngine(v.powertrain.engine).banks.map((b) => b.head));
    for (const h of heads) ids.add(`engine/head-${h}`);
  }
  return ids;
}

const tours = listTours();
const steps = tours.flatMap((t) => t.steps.map((s) => [`${t.id} › ${s.id}`, s] as const));

describe('tours', () => {
  it('cover the launch questions', () => {
    expect(tours.length).toBeGreaterThanOrEqual(10);
  });

  it.each(tours.map((t) => [t.id, t] as const))('%s is well-formed', (_id, t) => {
    expect(t.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(t.question.trim().endsWith('?')).toBe(true);
    expect(words(t.teaser)).toBeLessThanOrEqual(12);
    expect(t.steps.length).toBeGreaterThanOrEqual(3);
    expect(new Set(t.steps.map((s) => s.id)).size).toBe(t.steps.length);
    expect(t.sources?.length ?? 0).toBeGreaterThan(0);
  });

  it.each(steps)('%s shows a valid explorer view', (_id, step) => {
    const { view, engine, explode, highlight, overlays, camera, drive } = step.scene;
    expect(findVehicle(view.vehicleId), `vehicle ${view.vehicleId}`).toBeTruthy();
    if (engine) expect(findEngine(engine), `engine ${engine}`).toBeTruthy();
    const v = shown(step);
    const parts = layoutPowertrain(v).parts.map((p) => p.id);

    if (view.level === 'part') expect(parts, `part in ${v.id}`).toContain(view.part);
    else expect(view.part).toBeUndefined();

    const ok = highlightIds(v);
    for (const h of highlight ?? []) expect(ok.has(h), `highlight "${h}" in ${v.id}`).toBe(true);
    for (const o of overlays ?? []) expect(OVERLAYS).toContain(o);
    if (typeof camera === 'string') expect(CAMERAS).toContain(camera);
    if (explode !== undefined) expect(explode >= 0 && explode <= 1).toBe(true);

    expect(view.level === 'drive', 'drive views need a scenario and vice versa').toBe(
      drive !== undefined,
    );
    if (drive) {
      expect(SCENARIOS).toContain(drive.scenario);
      for (const g of drive.ghosts ?? []) {
        expect(findVehicle(g), `ghost ${g}`).toBeTruthy();
        expect(g).not.toBe(view.vehicleId);
      }
    }
  });

  it.each(steps)('%s has a short caption about the scene', (_id, step) => {
    expect(step.title.trim().length).toBeGreaterThan(0);
    expect(words(step.title)).toBeLessThanOrEqual(6);
    expect(words(step.body)).toBeLessThanOrEqual(MAX_CAPTION_WORDS);
    expect(step.body, 'numbers come from the scene, not the caption').not.toMatch(QUANTITY);
  });
});

describe('glossary', () => {
  it('has one-sentence entries with resolvable cross-references', () => {
    const terms = new Set(GLOSSARY.map((g) => g.term.toLowerCase()));
    expect(terms.size).toBe(GLOSSARY.length);
    for (const g of GLOSSARY) {
      expect(g.short.trim().endsWith('.'), g.term).toBe(true);
      // one sentence: no full stop followed by another capitalised sentence
      expect(g.short.trim().slice(0, -1), g.term).not.toMatch(/[.!?]\s+[A-Z]/);
      expect(words(g.short), g.term).toBeLessThanOrEqual(40);
      for (const s of g.seeAlso ?? [])
        expect(terms.has(s.toLowerCase()), `${g.term} → ${s}`).toBe(true);
    }
  });
});
