import { describe, expect, it } from 'vitest';
import { relatedToFocus } from '../scene/store';
import { carParams } from '../sim/model';
import { runHeadless, SCENARIOS, type ScenarioId, type ScenarioResult } from '../sim/scenarios';
import { findEngine, findVehicle, getEngine, getVehicle } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive';
import { massProps } from '../spec/derive/mass';
import type { VehicleSpec } from '../spec/types';
import { CAMERA_PRESETS } from '../vehicle3d/camera';
import { capKmh } from '../explorer/drive/state';
import { GLOSSARY } from './glossary';
import { listTours } from './index';
import type { OverlayKind, TourStep } from './types';

/** every overlay the car view draws (vehicle3d/overlays/Overlays.tsx) */
const OVERLAYS: OverlayKind[] = [
  'cg',
  'axle-loads',
  'dimensions',
  'inertia',
  'floorplan',
  'bay-fit',
  'torque-flow',
];
const MAX_TITLE_WORDS = 5;
const MAX_TEASER_WORDS = 12;
const MAX_NOTE_WORDS = 60;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
/** A number with a unit is something the scene should show, not the words. */
const QUANTITY =
  /\d[\d.,]*\s*(%|kg|mm|cm|m\b|kw|hp|ps|bhp|nm|lb|rpm|°|deg|km\/h|mph|kwh|l\b|litre|cc|sec)/i;
/** what the site no longer calls things (the CG mark, the drive mode's car B, its readouts) */
const STALE = /roundel|ghost|yaw rate|friction circle/i;

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
    for (const sub of ['crank', 'pistons', 'block', 'cams', 'flywheel', 'exhaust'])
      ids.add(`engine/${sub}`);
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
    expect(words(t.teaser)).toBeLessThanOrEqual(MAX_TEASER_WORDS);
    expect(t.steps.length).toBeGreaterThanOrEqual(3);
    expect(new Set(t.steps.map((s) => s.id)).size).toBe(t.steps.length);
    expect(t.sources?.length ?? 0).toBeGreaterThan(0);
    // the card draws the layout of the car the tour starts on
    expect(t.steps[0].scene.view.level).not.toBe('drive');
  });

  it.each(steps)('%s references what exists', (_id, step) => {
    const { view, engine, explode, highlight, overlays, camera, drive } = step.scene;
    expect(findVehicle(view.vehicleId), `vehicle ${view.vehicleId}`).toBeTruthy();
    if (engine) expect(findEngine(engine), `engine ${engine}`).toBeTruthy();
    const v = shown(step);
    const parts = layoutPowertrain(v).parts.map((p) => p.id);

    if (view.level === 'part') expect(parts, `part in ${v.id}`).toContain(view.part);
    else expect(view.part).toBeUndefined();
    expect(view.level, 'a tour plays the car, its parts and drive').not.toBe('track');

    const ok = highlightIds(v);
    for (const h of highlight ?? []) expect(ok.has(h), `highlight "${h}" in ${v.id}`).toBe(true);
    for (const o of overlays ?? []) expect(OVERLAYS).toContain(o);
    if (typeof camera === 'string') expect(Object.keys(CAMERA_PRESETS)).toContain(camera);
    if (explode !== undefined) expect(explode >= 0 && explode <= 1).toBe(true);

    expect(view.level === 'drive', 'drive views need a scenario and vice versa').toBe(
      drive !== undefined,
    );
    if (drive) {
      expect(Object.keys(SCENARIOS)).toContain(drive.scenario);
      // drive puts one car B on the road
      expect(drive.ghosts?.length ?? 0).toBeLessThanOrEqual(1);
      for (const g of drive.ghosts ?? []) {
        expect(findVehicle(g), `car B ${g}`).toBeTruthy();
        expect(g).not.toBe(view.vehicleId);
      }
    }
  });

  it.each(steps)('%s asks only for what its view shows', (_id, step) => {
    const { view, highlight, overlays, rpm, timeScale, sound, balance, explode } = step.scene;
    // zoomed into a part, everything else is hidden
    if (view.level === 'part')
      for (const h of highlight ?? [])
        expect(relatedToFocus(h, view.part!), `highlight "${h}" in ${view.part}`).toBe(true);
    // overlays are drawn in the see-through car only
    if (overlays?.length) expect(view.level).toBe('internals');
    // the engine's own controls are there only when zoomed into it (or a motor, for its sound)
    const unit =
      view.level === 'part' && (view.part === 'engine' || !!view.part?.startsWith('motor'));
    if (rpm !== undefined || timeScale !== undefined || sound) expect(unit).toBe(true);
    if (balance) expect(view.level === 'part' && view.part === 'engine').toBe(true);
    // drive and the painted car don't explode
    if (explode) expect(['internals', 'part']).toContain(view.level);
  });

  it.each(steps)('%s has a short title and notes about the scene', (_id, step) => {
    expect(step.title.trim().length).toBeGreaterThan(0);
    expect(words(step.title)).toBeLessThanOrEqual(MAX_TITLE_WORDS);
    expect(step.title).not.toMatch(QUANTITY);
    expect(step.title).not.toMatch(STALE);
    expect(words(step.body)).toBeLessThanOrEqual(MAX_NOTE_WORDS);
    expect(step.body, 'numbers come from the scene, not the notes').not.toMatch(QUANTITY);
    expect(step.body).not.toMatch(STALE);
  });
});

/** What a car did, coarsely (as drive's car B is chosen, versus.ts): the tail went, it
 *  tightened, it ran wide, or it held on. */
const behaviour = (r: ScenarioResult & { verdict: string | null }) =>
  r.spun || r.verdict === 'spin' || r.verdict === 'tail' ? 'over' : (r.verdict ?? 'calm');

function run(v: VehicleSpec, id: ScenarioId, baseline = false) {
  const def = SCENARIOS[id];
  const kmh = capKmh(id, def.speed.def);
  const plan = baseline && def.baseline ? def.baseline.plan(kmh) : def.plan(kmh);
  const res = runHeadless(carParams(v), plan).result;
  return { ...res, verdict: def.verdict?.(res) ?? null };
}

const cgOverWheelbase = (v: VehicleSpec) => massProps(v).cgMm[1] / v.dims.wheelbaseMm;

const driveSteps = steps.filter(([, s]) => s.scene.drive);

describe('tour drive steps', () => {
  // the drive steps' titles name what car A does against car B; at the question's own speed the
  // two must at least do different things, or the step shows nothing
  it.each(driveSteps)('%s: car A and car B do different things', (_id, step) => {
    const { scenario, ghosts } = step.scene.drive!;
    const a = getVehicle(step.scene.view.vehicleId);
    const ra = run(a, scenario);
    const b = ghosts?.[0];
    if (!b) {
      // car B is car A without the technique
      expect(SCENARIOS[scenario].baseline, 'a question with a twin').toBeTruthy();
      expect(behaviour(run(a, scenario, true))).not.toBe(behaviour(ra));
      return;
    }
    const vb = getVehicle(b);
    if (scenario === 'lane-change') {
      const ta = ra.values.yawResponse ?? 0;
      const tb = run(vb, scenario).values.yawResponse ?? 0;
      expect(Math.abs(ta - tb), 'turn-in time apart (ms)').toBeGreaterThan(20);
    } else if (scenario === 'skidpad') {
      // both may let go at the front (road cars are set up to): then one lets go sooner
      const rb = run(vb, scenario);
      const apart = Math.abs((ra.values.maxAy ?? 0) - (rb.values.maxAy ?? 0));
      if (behaviour(ra) === behaviour(rb)) expect(apart, 'limit apart (g)').toBeGreaterThan(0.04);
    } else if (scenario === 'braking') {
      const k = cgOverWheelbase(a) / cgOverWheelbase(vb);
      expect(Math.abs(Math.log(k)), 'CG height for the wheelbase apart').toBeGreaterThan(0.1);
    } else expect(behaviour(run(vb, scenario))).not.toBe(behaviour(ra));
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
