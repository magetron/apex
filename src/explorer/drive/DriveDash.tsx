/**
 * Drive-mode dashboard (bottom centre): what the driver of the visitor's car is doing right now
 * (steering wheel, brake and gas pedals, speed, gear, revs; "still" while the test driver holds
 * the wheel on purpose), and the timeline: play/pause, a scrubber with the manoeuvre's steps on
 * it, slow motion, restart. Live values are polled from driveTelemetry/drivePlayback and written
 * straight to the DOM (no React re-render per frame).
 */
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Segmented } from '../../app/ui';
import { held } from './input';
import { drivePlayback, driveTelemetry, RATES, useDrive, type Rate } from './state';
import './drive.css';

const RATE_LABEL: Record<Rate, string> = { 1: '1×', 0.5: '½×', 0.25: '¼×', 0.125: '⅛×' };
/** steering-wheel turns per road-wheel turn, for the picture of the wheel */
const STEER_RATIO = 15;

const KIND_VAR = {
  drive: 'var(--ok)',
  brake: 'var(--danger)',
  steer: 'var(--accent)',
  event: 'var(--warn)',
} as const;

const ICON = {
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 4.5v15l12.5-7.5z" />
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" />
    </svg>
  ),
  restart: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 3.5v4h4" />
    </svg>
  ),
};

/** A touch screen (coarse pointer), kept in sync if that changes. */
const coarse = typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)') : null;
const useTouch = () =>
  useSyncExternalStore(
    (cb) => {
      coarse?.addEventListener('change', cb);
      return () => coarse?.removeEventListener('change', cb);
    },
    () => !!coarse?.matches,
    () => false,
  );

type Held = 'touchGas' | 'touchBrake' | 'touchSteer';

/** A press-and-hold button for the touch controls (each finger is its own pointer). */
function Hold({
  what,
  value,
  label,
  className,
  children,
}: {
  what: Held;
  value: number;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const press = (el: HTMLElement, down: boolean) => {
    el.classList.toggle('is-down', down);
    if (down) {
      held[what] = value;
      if (useDrive.getState().mode !== 'drive' || !useDrive.getState().playing)
        useDrive.setState({ mode: 'drive', playing: true });
    } else if (held[what] === value) held[what] = 0;
  };
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        press(e.currentTarget, true);
      }}
      onPointerUp={(e) => press(e.currentTarget, false)}
      onPointerCancel={(e) => press(e.currentTarget, false)}
      onLostPointerCapture={(e) => press(e.currentTarget, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

const ARROW = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

/** On-screen wheel and pedals, for touch screens while the visitor drives. */
function TouchControls() {
  return (
    <div className="apx-drive-touch" aria-label="Touch controls">
      <div>
        <Hold what="touchSteer" value={1} label="Steer left">
          {ARROW('M15 5l-7 7 7 7')}
        </Hold>
        <Hold what="touchSteer" value={-1} label="Steer right">
          {ARROW('M9 5l7 7-7 7')}
        </Hold>
      </div>
      <div>
        <Hold what="touchBrake" value={1} label="Brake" className="is-brake">
          Brake
        </Hold>
        <Hold what="touchGas" value={1} label="Gas" className="is-gas">
          Gas
        </Hold>
      </div>
    </div>
  );
}

function Wheel() {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="24" cy="24" r="20" strokeWidth="4" />
      <circle cx="24" cy="24" r="4.5" strokeWidth="3" />
      <path d="M4.5 21h15M28.5 21h15M24 28.5v15" strokeWidth="4" strokeLinecap="round" />
      {/* the top-dead-centre stripe, so a turn of the wheel reads */}
      <path d="M24 4v6" stroke="var(--warn)" strokeWidth="4" />
    </svg>
  );
}

export function DriveDash() {
  const playing = useDrive((s) => s.playing);
  const rate = useDrive((s) => s.rate);
  const mode = useDrive((s) => s.mode);
  const touch = useTouch();

  const wheel = useRef<HTMLDivElement>(null);
  const wheelSvg = useRef<HTMLDivElement>(null);
  const gas = useRef<HTMLElement>(null);
  const brake = useRef<HTMLElement>(null);
  const speed = useRef<HTMLSpanElement>(null);
  const gear = useRef<HTMLSpanElement>(null);
  const rpm = useRef<HTMLSpanElement>(null);
  const scrub = useRef<HTMLInputElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const ticks = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let raf = 0;
    const last = { ticks: '' };
    const set = (el: HTMLElement | null, s: string) => {
      if (el && el.textContent !== s) el.textContent = s;
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = driveTelemetry;
      const pb = drivePlayback;
      if (wheelSvg.current)
        wheelSvg.current.style.transform = `rotate(${Math.max(-540, Math.min(540, -t.steerDeg * STEER_RATIO)).toFixed(1)}deg)`;
      wheel.current?.classList.toggle('is-still', t.handsStill);
      if (gas.current) gas.current.style.transform = `scaleY(${t.throttle.toFixed(3)})`;
      if (brake.current) brake.current.style.transform = `scaleY(${t.brake.toFixed(3)})`;
      set(speed.current, t.speedKmh.toFixed(0));
      set(gear.current, t.gear);
      set(rpm.current, (Math.round(t.rpm / 50) * 50).toFixed(0));
      const dur = Math.max(0.1, pb.duration);
      if (scrub.current && !dragging.current) {
        scrub.current.max = dur.toFixed(2);
        scrub.current.value = pb.t.toFixed(2);
      }
      set(clock.current, `${pb.t.toFixed(1)} s`);
      // the steps on the timeline, once their times are known
      const key = pb.marks.map((m) => `${m.t.toFixed(2)}${m.label}`).join('|') + `|${dur}`;
      if (key !== last.ticks && ticks.current) {
        last.ticks = key;
        const el = ticks.current;
        el.replaceChildren();
        for (const m of pb.marks) {
          if (!Number.isFinite(m.t)) continue;
          if (m.holdS) {
            const band = document.createElement('i');
            band.className = 'apx-drive-scrub__hold';
            band.style.left = `${(100 * m.t) / dur}%`;
            band.style.width = `${(100 * Math.min(m.holdS, dur - m.t)) / dur}%`;
            el.append(band);
          }
          const tk = document.createElement('i');
          tk.className = 'apx-drive-scrub__tick';
          tk.style.left = `${(100 * m.t) / dur}%`;
          tk.style.setProperty('--sys', KIND_VAR[m.kind]);
          // only the scripted event is named here; the info card lists every step
          if (m.kind === 'event') {
            const label = document.createElement('span');
            label.textContent = m.label;
            tk.append(label);
          }
          el.append(tk);
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seek = (v: number) => {
    drivePlayback.seek = v;
  };

  return (
    <section className="apx-panel apx-drive-dash" aria-label="Driver and timeline">
      <div className="apx-drive-driver">
        <div
          className="apx-drive-wheel"
          ref={wheel}
          title="Steering (the stripe marks straight ahead)"
        >
          <div ref={wheelSvg} style={{ width: '100%', height: '100%' }}>
            <Wheel />
          </div>
          <span className="apx-drive-wheel__still">Held still</span>
        </div>
        <div className="apx-drive-pedals">
          <span className="apx-drive-pedal apx-drive-pedal--brake" title="Brake pedal">
            <span className="apx-drive-pedal__bar">
              <i ref={brake} />
            </span>
            Brake
          </span>
          <span className="apx-drive-pedal" title="Gas pedal">
            <span className="apx-drive-pedal__bar">
              <i ref={gas} />
            </span>
            Gas
          </span>
        </div>
        <div className="apx-drive-read">
          <span>
            <small>km/h</small>
            <span ref={speed}>0</span>
          </span>
          <span>
            <small>Gear</small>
            <span ref={gear}>1</span>
          </span>
          <span>
            <small>rpm</small>
            <span ref={rpm}>0</span>
          </span>
        </div>
      </div>
      {touch && mode === 'drive' && <TouchControls />}
      <div className="apx-drive-time">
        <button
          type="button"
          className="apx-drive-iconbtn"
          aria-label={playing ? 'Pause' : 'Play'}
          title={playing ? 'Pause' : 'Play'}
          onClick={() => useDrive.setState({ playing: !playing })}
        >
          {playing ? ICON.pause : ICON.play}
        </button>
        <div className="apx-drive-scrub">
          <div className="apx-drive-scrub__ticks" ref={ticks} />
          <input
            ref={scrub}
            type="range"
            min={0}
            max={1}
            step={0.01}
            defaultValue={0}
            aria-label="Time"
            onPointerDown={() => (dragging.current = true)}
            onPointerUp={() => (dragging.current = false)}
            onBlur={() => (dragging.current = false)}
            onChange={(e) => seek(Number(e.target.value))}
          />
        </div>
        <span className="apx-drive-clock" ref={clock}>
          0.0 s
        </span>
        <div className="apx-drive-rate">
          <Segmented<string>
            label="Playback speed"
            value={String(rate)}
            onChange={(v) => useDrive.setState({ rate: Number(v) as Rate })}
            options={RATES.map((r) => ({
              value: String(r),
              label: RATE_LABEL[r],
              title: r === 1 ? 'Real time' : 'Slow motion',
            }))}
          />
        </div>
        <button
          type="button"
          className="apx-drive-iconbtn"
          aria-label="Restart (R)"
          title="Restart (R)"
          onClick={() => useDrive.getState().restart()}
        >
          {ICON.restart}
        </button>
      </div>
    </section>
  );
}
