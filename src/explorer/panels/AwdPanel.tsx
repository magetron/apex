/**
 * AWD explainer for the part that splits torque between the axles (centre diff, coupling, front
 * clutch): the grip control for the hub, and the live split for the info card. Everything shown
 * comes from the car's own spec through spec/derive/awd.ts.
 */
import { useEffect, useMemo, useState, type PointerEvent } from 'react';
import { Button, Chips, Toggle } from '../../app/ui';
import {
  awdResponse,
  awdSystem,
  awdTypeLabel,
  axleTorque,
  fmtSplit,
  TIGHT_TURN_M,
  type AwdSystem,
} from '../../spec/derive/awd';
import type { System } from '../../scene/palette';
import type { VehicleSpec } from '../../spec/types';
import {
  AWD_WINDOW_S,
  awdElapsed,
  gripFront,
  gripRear,
  useAwdExplainer,
} from '../../vehicle3d/awd/store';
import './awd.css';

/** Which axle to put on ice first: the one the device has to rescue. */
const firstIce = (sys: AwdSystem) => (sys.primary === 'rear' ? 1 : -1);

/** Hub control: grip under the front vs the rear axle, tight turn, the driver's lock. */
export function AwdControls({ vehicle }: { vehicle: VehicleSpec }) {
  const sys = useMemo(() => awdSystem(vehicle), [vehicle]);
  const { ice, turn, locked, set, replay } = useAwdExplainer();
  // start every car on the case its device exists for
  useEffect(() => {
    if (sys) useAwdExplainer.getState().set({ ice: firstIce(sys), locked: false });
  }, [sys]);
  if (!sys) return null;
  const mu = (g: number) => (g * sys.mu).toFixed(2);
  return (
    <div className="awd-ctl">
      <label className="apx-field">
        <span className="apx-field__row">
          <span>Grip</span>
          <span className="apx-field__value">
            μ F {mu(gripFront(ice))} · R {mu(gripRear(ice))}
          </span>
        </span>
        <input
          className="apx-slider"
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={ice}
          aria-label="Grip: front axle on ice to rear axle on ice"
          aria-valuetext={`front μ ${mu(gripFront(ice))}, rear μ ${mu(gripRear(ice))}`}
          onChange={(e) => set({ ice: Number(e.target.value) })}
        />
        <span className="awd-ctl__ends">
          <button type="button" onClick={() => set({ ice: -1 })}>
            Front on ice
          </button>
          <button type="button" onClick={() => set({ ice: 0 })}>
            Dry
          </button>
          <button type="button" onClick={() => set({ ice: 1 })}>
            Rear on ice
          </button>
        </span>
      </label>
      <Toggle
        label={`Tight turn (${TIGHT_TURN_M} m)`}
        checked={turn}
        onChange={(v) => set({ turn: v })}
      />
      {sys.lockable && (
        <Toggle label="Centre lock" checked={locked} onChange={(v) => set({ locked: v })} />
      )}
      <Button onClick={replay} title="Play the first second again">
        Replay
      </Button>
    </div>
  );
}

/** Model time (s) of the step response, running from 0 to the window end after each change. */
function usePlayhead(since: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = Math.min(AWD_WINDOW_S, awdElapsed(since));
      setT(el);
      if (el < AWD_WINDOW_S) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [since]);
  return t;
}

function Bar({
  label,
  kind,
  value,
  base,
  spin,
}: {
  label: string;
  kind: 'f' | 'r' | 'total' | 'bind';
  value: number;
  base?: number;
  spin?: boolean;
}) {
  const pct = (x: number) => `${Math.max(0, Math.min(1, x)) * 100}%`;
  return (
    <div className={`awd-bar awd-bar--${kind}${spin ? ' is-spin' : ''}`}>
      <span className="awd-bar__label">{label}</span>
      <span className="awd-bar__track">
        <i style={{ width: pct(value) }} />
        {base !== undefined && <b style={{ left: pct(base) }} />}
      </span>
      <span className="awd-bar__value">
        {Math.round(value * 100)}
        <small>%</small>
      </span>
      <span className="awd-bar__spin">{spin ? '⟳ spin' : ''}</span>
    </div>
  );
}

const W = 272;
const H = 92;
const X0 = 6;
const X1 = W - 18;
const Y0 = 8;
const Y1 = H - 18;
const xOf = (t: number) => X0 + (t / AWD_WINDOW_S) * (X1 - X0);
const yOf = (v: number) => Y1 - Math.max(0, Math.min(1, v)) * (Y1 - Y0);

/** Torque to each axle over the first second after the grip changed; hover to scrub. */
function Response({
  t,
  front,
  rear,
  now,
  onScrub,
}: {
  t: number[];
  front: number[];
  rear: number[];
  now: number;
  onScrub: (t: number | null) => void;
}) {
  const path = (ys: number[]) =>
    ys.map((y, i) => `${i ? 'L' : 'M'}${xOf(t[i]).toFixed(1)},${yOf(y).toFixed(1)}`).join('');
  // direct labels at the line ends, nudged apart when the lines meet
  let yf = yOf(front[front.length - 1]);
  let yr = yOf(rear[rear.length - 1]);
  if (Math.abs(yf - yr) < 10) {
    const mid = (yf + yr) / 2;
    const up = yf <= yr ? -5 : 5;
    yf = mid + up;
    yr = mid - up;
  }
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    onScrub(Math.max(0, Math.min(AWD_WINDOW_S, ((x - X0) / (X1 - X0)) * AWD_WINDOW_S)));
  };
  return (
    <svg
      className="awd-plot"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Torque to the front and rear axle over the first second"
      onPointerMove={move}
      onPointerLeave={() => onScrub(null)}
    >
      <line className="awd-plot__grid" x1={X0} x2={X1} y1={yOf(0.5)} y2={yOf(0.5)} />
      <line className="awd-plot__axis" x1={X0} x2={X1} y1={Y1} y2={Y1} />
      <path className="awd-plot__line awd-plot__line--r" d={path(rear)} />
      <path className="awd-plot__line awd-plot__line--f" d={path(front)} />
      <line className="awd-plot__cursor" x1={xOf(now)} x2={xOf(now)} y1={Y0 - 4} y2={Y1} />
      <text className="awd-plot__end awd-plot__end--f" x={X1 + 4} y={yf + 3.5}>
        F
      </text>
      <text className="awd-plot__end awd-plot__end--r" x={X1 + 4} y={yr + 3.5}>
        R
      </text>
      <text className="awd-plot__tick" x={X0} y={H - 4}>
        0
      </text>
      <text className="awd-plot__tick" x={X1} y={H - 4} textAnchor="end">
        {AWD_WINDOW_S} s
      </text>
      <text className="awd-plot__tick" x={X0 + 2} y={yOf(0.5) - 3}>
        50%
      </text>
    </svg>
  );
}

type Chip = { label: string; system?: System; title?: string };

/** Info card section: the device as chips, then the live split and its first second. */
export function AwdReadout({
  vehicle,
  chips: lead = [],
}: {
  vehicle: VehicleSpec;
  /** the part's own chips, shown first in the same row */
  chips?: Chip[];
}) {
  const sys = useMemo(() => awdSystem(vehicle), [vehicle]);
  const { ice, turn, locked, since, scrub, setScrub } = useAwdExplainer();
  const playhead = usePlayhead(since);
  const gF = gripFront(ice);
  const gR = gripRear(ice);
  const opts = useMemo(() => ({ turn, locked }), [turn, locked]);
  const resp = useMemo(
    () => (sys ? awdResponse(sys, gF, gR, opts, AWD_WINDOW_S) : null),
    [sys, gF, gR, opts],
  );
  if (!sys || !resp) return null;
  const now = scrub ?? playhead;
  const st = axleTorque(sys, gF, gR, now, opts);
  const rigid = sys.type === 'locked' || (locked && sys.lockable);

  const chips: Chip[] = [...lead];
  chips.push({ label: sys.name ?? awdTypeLabel(sys), system: 'coupling' });
  if (sys.name) chips.push({ label: awdTypeLabel(sys) });
  if (rigid) chips.push({ label: 'Locked', title: 'front and rear shafts turn together' });
  else
    chips.push({
      label: fmtSplit(sys.base),
      title: sys.type === 'motors' ? 'motor torque, front:rear' : 'nominal split, front:rear',
    });
  const [lo, hi] = sys.range;
  if (!rigid && (sys.type === 'torque-sensing' || sys.type === 'clutch') && hi - lo > 1e-6)
    chips.push({
      label: `${fmtSplit(hi)} … ${fmtSplit(lo)}`,
      title:
        sys.type === 'clutch' ? 'how far the clutch can shift torque' : 'bias limits, front:rear',
    });

  return (
    <div className="awd-readout">
      <Chips items={chips} />
      <div className="awd-bars">
        <Bar
          label="Front"
          kind="f"
          value={st.front}
          base={rigid ? undefined : sys.base}
          spin={st.spinFront}
        />
        <Bar
          label="Rear"
          kind="r"
          value={st.rear}
          base={rigid ? undefined : 1 - sys.base}
          spin={st.spinRear}
        />
        <Bar label="Total" kind="total" value={st.front + st.rear} />
        {turn && <Bar label="Wind-up" kind="bind" value={st.bind} />}
      </div>
      <Response t={resp.t} front={resp.front} rear={resp.rear} now={now} onScrub={setScrub} />
    </div>
  );
}
