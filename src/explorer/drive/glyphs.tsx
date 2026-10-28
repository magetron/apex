/**
 * The driver's inputs as small glyphs, drawn the same wherever they appear (the cars' tags, the
 * timeline, the key): the brake pedal wide and the gas pedal narrow, as in a car, each filled as
 * far as it is pressed (`--fill`, 0..1, drive.css); the foot lifted off the gas, an arrow up over
 * the empty pedal; the steering wheel, its top stripe marking straight ahead.
 */
import type { CSSProperties } from 'react';
import type { ScenarioId } from '../../sim/scenarios';

export type Input = 'gas' | 'brake' | 'lift' | 'wheel';

export const LIFT_ARROW = (
  <svg viewBox="0 0 10 10" aria-hidden className="apx-drive-pedal__lift">
    <path
      d="M5 9V2M2 4.5 5 1.5 8 4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const WHEEL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
    <circle cx="12" cy="12" r="9.5" strokeWidth="2.6" />
    <path d="M2.8 11h6.4M14.8 11h6.4M12 14.5v7" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M12 2.5v3.5" stroke="var(--accent)" strokeWidth="3" />
  </svg>
);

/** A magnifier over marks (a ring, a line): the marks are drawn larger than they are, not the
 *  cars (the timeline's chip and the key). */
export const MAGNIFIER = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    aria-hidden
    className="apx-drive-magnifier"
  >
    <circle cx="10.5" cy="10.5" r="7" />
    <path d="M15.8 15.8 21.5 21.5" />
    {/* under the lens, marks: a ring and a line (not the cars) */}
    <circle cx="9" cy="9.5" r="2.4" strokeWidth="1.6" />
    <path d="M7.5 14h6" strokeWidth="1.6" />
  </svg>
);

/** One input, still: a pedal pressed `fill` of the way (the lift: none), or the wheel. */
export function InputGlyph({
  input,
  fill = 0.8,
  off = false,
}: {
  input: Input;
  fill?: number;
  /** crossed out: never used (the speed-matched twin's brake) */
  off?: boolean;
}) {
  if (input === 'wheel')
    return (
      <span className="apx-drive-hands" aria-hidden>
        <span className={`apx-drive-hands__wheel${off ? ' is-off' : ''}`}>{WHEEL}</span>
      </span>
    );
  const lift = input === 'lift';
  return (
    <span className="apx-drive-hands" aria-hidden>
      <span
        className={`apx-drive-pedal ${input === 'brake' ? 'is-brake' : 'is-gas'}${lift ? ' is-lift' : ''}${off ? ' is-off' : ''}`}
        style={{ '--fill': lift ? 0 : fill } as CSSProperties}
      >
        <i />
        {lift && LIFT_ARROW}
      </span>
    </span>
  );
}

/** What car B leaves out where it is car A without the driver's action (its chip and tag show
 *  it crossed out): the lift, the throttle, the catch (the hands), the brake. */
export const TWIN_LEAVES: Partial<Record<ScenarioId, Input>> = {
  'lift-off': 'lift',
  'power-exit': 'gas',
  catch: 'wheel',
  'trail-brake': 'brake',
  'left-foot': 'brake',
};

/** What the driver does at a question's event (the timeline marks it with this). */
export const EVENT_INPUT: Partial<Record<ScenarioId, Input>> = {
  'lift-off': 'lift',
  catch: 'lift',
  'power-exit': 'gas',
  'trail-brake': 'brake',
  'left-foot': 'brake',
  braking: 'brake',
  'lane-change': 'wheel',
};

const PEDALS: readonly Input[] = ['lift', 'gas', 'brake'];
/** Whether a question's event is a pedal, which moves load between the axles (the body
 *  pitches): its key moment is watched from the side (camera.ts), against the level. */
export function movesLoad(id: ScenarioId): boolean {
  const act = EVENT_INPUT[id];
  return !!act && PEDALS.includes(act);
}
