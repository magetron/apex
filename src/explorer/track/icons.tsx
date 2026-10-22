/**
 * The hot lap's small pictures, so the panels can show rather than say: the three kinds of road
 * a lap is cut into (corner, straight, brake), the playback buttons, the finish flag, and each
 * car's driven wheels seen from above (front to the right, as in the car picker's glyphs).
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Phase } from '../../sim/track';
import type { Driven } from '../../spec/types';

const Svg = ({ children, label }: { children: ReactNode; label?: string }) => (
  <svg
    className="apx-trk-icon"
    viewBox="0 0 14 14"
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  >
    {label && <title>{label}</title>}
    {children}
  </svg>
);

const PHASE_LABEL: Record<Phase, string> = {
  corner: 'Corners',
  straight: 'Straights',
  brake: 'Braking',
};

const PHASE_PATHS: Record<Phase, ReactNode> = {
  // a turn
  corner: (
    <>
      <path d="M3 12.5V8Q3 3.5 7.5 3.5H11.5" />
      <path d="M9 1 11.5 3.5 9 6" />
    </>
  ),
  // straight on
  straight: (
    <>
      <path d="M1.5 7H12" />
      <path d="M9.5 4.5 12 7 9.5 9.5" />
    </>
  ),
  // a brake disc and its caliper
  brake: (
    <>
      <circle cx="6.5" cy="7.5" r="4.6" />
      <circle cx="6.5" cy="7.5" r="1.2" className="is-fill" />
      <path d="M8.6 1.7A6.2 6.2 0 0 1 12.3 5.4" className="is-thick" />
    </>
  ),
};

export const PhaseIcon = ({ phase, label }: { phase: Phase; label?: boolean }) => (
  <Svg label={label ? PHASE_LABEL[phase] : undefined}>{PHASE_PATHS[phase]}</Svg>
);

export const PlayIcon = () => (
  <Svg>
    <path d="M4 2.5V11.5L11.5 7Z" className="is-fill" />
  </Svg>
);

export const PauseIcon = () => (
  <Svg>
    <path d="M4.5 3V11M9.5 3V11" className="is-thick" />
  </Svg>
);

/** back to the line */
export const RestartIcon = () => (
  <Svg>
    <path d="M3 3V11" className="is-thick" />
    <path d="M11.5 3V11L5 7Z" className="is-fill" />
  </Svg>
);

/** round again */
export const ReplayIcon = () => (
  <Svg>
    <path d="M2.5 7A4.5 4.5 0 1 0 3.82 3.82" />
    <path d="M3.82 1V3.82H6.6" />
  </Svg>
);

/** a chequered flag: the finish */
export const FlagIcon = () => (
  <svg className="apx-trk-flag" viewBox="0 0 16 12" aria-hidden="true">
    <rect x="0.5" y="0.5" width="15" height="11" rx="1" className="is-frame" />
    {[0, 1, 2].map((r) =>
      [0, 1, 2, 3].map((c) =>
        (r + c) % 2 ? null : (
          <rect key={`${r}${c}`} x={0.5 + c * 3.75} y={0.5 + r * 3.67} width={3.75} height={3.67} />
        ),
      ),
    )}
  </svg>
);

const DRIVE_WORDS: Record<Driven, string> = {
  front: 'Front-wheel drive',
  rear: 'Rear-wheel drive',
  all: 'All-wheel drive',
};

/** wheel x (left edge) per axle, front to the right */
const WHEEL_X = { rear: 4.5, front: 17.5 } as const;

/**
 * The car from above in its own colour: four wheels, the driven ones filled and joined by their
 * axle, so the board ties each lap to the layout that drove it.
 */
export function DrivenWheels({ driven, color }: { driven: Driven; color: string }) {
  return (
    <svg
      className="apx-trk-wheels"
      viewBox="0 0 28 16"
      role="img"
      aria-label={DRIVE_WORDS[driven]}
      style={{ '--c': color } as CSSProperties}
    >
      <title>{DRIVE_WORDS[driven]}</title>
      <path
        className="apx-trk-wheels__body"
        d="M3 5Q3 3.5 4.5 3.5H20Q25 3.9 25.5 8Q25 12.1 20 12.5H4.5Q3 12.5 3 11Z"
      />
      {(['rear', 'front'] as const).map((a) => {
        const x = WHEEL_X[a];
        const on = driven === 'all' || driven === a;
        return (
          <g key={a} className={on ? 'is-driven' : undefined}>
            {on && <path className="apx-trk-wheels__axle" d={`M${x + 3} 3.5V12.5`} />}
            <rect x={x} y={0.8} width={6} height={3} rx={1} />
            <rect x={x} y={12.2} width={6} height={3} rx={1} />
          </g>
        );
      })}
    </svg>
  );
}
