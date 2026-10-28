import type { DriveScenario } from '../../content/types';
import { braking } from './braking';
import { catchSlide } from './catch';
import { laneChange } from './lane-change';
import { leftFoot } from './left-foot';
import { liftOff } from './lift-off';
import { powerExit } from './power-exit';
import { skidpad } from './skidpad';
import { trailBrake } from './trail-brake';
import type { ScenarioDef, ScenarioId } from './types';

/** Every scripted scenario. */
export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  skidpad,
  'trail-brake': trailBrake,
  'lift-off': liftOff,
  'power-exit': powerExit,
  'left-foot': leftFoot,
  catch: catchSlide,
  'lane-change': laneChange,
  braking,
};

/** The content contract's scenarios (the ones a tour can name today). */
export const SCENARIO_IDS: DriveScenario[] = [
  'skidpad',
  'power-exit',
  'lift-off',
  'lane-change',
  'braking',
];

/**
 * The drive hub's list, clearest lessons first: the pedals mid-corner moving load by accident
 * (lift) and on purpose (throttle), what to do when the tail goes, and braking to turn; then
 * where the weight goes under braking, a technique built on all of it, why road cars are set
 * up to push wide, and last how fast a car answers the wheel.
 */
export const HUB_ORDER: ScenarioId[] = [
  'lift-off',
  'power-exit',
  'catch',
  'trail-brake',
  'braking',
  'left-foot',
  'skidpad',
  'lane-change',
];

export { ScenarioRun, runHeadless } from './run';
export { Recorder } from './replay';
export { offsetPoint, Path, type PathPoint } from './path';
export {
  METRICS,
  type Ctl,
  type KeySpec,
  type Mark,
  type MetricId,
  type Plan,
  type ScenarioDef,
  type ScenarioId,
  type ScenarioResult,
  type Verdict,
} from './types';
export type { Trace } from './trace';
