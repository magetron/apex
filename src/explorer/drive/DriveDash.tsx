/**
 * Drive-mode timeline (bottom centre): play/pause, the scrubber, restart. On the scrubber, the
 * stretch played slowed down round the key moment, what the driver does there (its input as a
 * glyph: the lift, the throttle, the brake, the wheel) and a pin at each stop of the key moment;
 * while the run waits at a stop, the play button pulses. One chip (a magnifier, ×5) says that
 * what is too small to see is drawn five times its size. While the visitor drives, their own wheel,
 * pedals and speed sit above it (and on a touch screen, the touch controls); once the run has
 * ended on its picture, every layout's same test in a row (Layouts.tsx). Live values are polled
 * from driveTelemetry/drivePlayback and written straight to the DOM (no React re-render per
 * frame). The stop's keys mount from here.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useFreeze } from './freeze';
import { FreezeKeys } from './FreezeCard';
import { EVENT_INPUT, InputGlyph, MAGNIFIER, WHEEL } from './glyphs';
import { held } from './input';
import type { KeyMoment } from './key';
import { EveryLayout } from './Layouts';
import { usePathPicture } from './picture';
import { DRIVE_COLORS } from './colors';
import { useTheme } from '../../scene/theme';
import { drivePlayback, driveTelemetry, PITCH_SHOWN, SHOWN, useDrive } from './state';
import './drive.css';

/** steering-wheel turns per road-wheel turn, for the picture of the wheel */
const STEER_RATIO = 15;

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

/** what is drawn ×SHOWN, for the chip's tooltip */
const SHOWN_ALL = `the bodies' pitch ×${PITCH_SHOWN}; a catch's wheel angles and the pictures' sideways distances ×${SHOWN}. The paths and the turning are as driven`;

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
          <InputGlyph input="brake" />
        </Hold>
        <Hold what="touchGas" value={1} label="Gas" className="is-gas">
          <InputGlyph input="gas" />
        </Hold>
      </div>
    </div>
  );
}

/** The visitor's own wheel, pedals and speed, while they drive (polled, written to the DOM). */
function Driver() {
  const wheel = useRef<HTMLSpanElement>(null);
  const brake = useRef<HTMLSpanElement>(null);
  const gas = useRef<HTMLSpanElement>(null);
  const speed = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = driveTelemetry;
      if (wheel.current)
        wheel.current.style.transform = `rotate(${Math.max(-540, Math.min(540, -t.steerDeg * STEER_RATIO)).toFixed(1)}deg)`;
      brake.current?.style.setProperty('--fill', t.brake.toFixed(3));
      gas.current?.style.setProperty('--fill', t.throttle.toFixed(3));
      const s = t.speedKmh.toFixed(0);
      if (speed.current && speed.current.textContent !== s) speed.current.textContent = s;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="apx-drive-driver" aria-label="Your wheel, pedals and speed">
      <span className="apx-drive-hands is-large" aria-hidden>
        <span className="apx-drive-hands__wheel">
          <span ref={wheel}>{WHEEL}</span>
        </span>
        <span ref={brake} className="apx-drive-pedal is-brake">
          <i />
        </span>
        <span ref={gas} className="apx-drive-pedal is-gas">
          <i />
        </span>
      </span>
      <span className="apx-drive-read">
        <span ref={speed}>0</span>
        <small>km/h</small>
      </span>
    </div>
  );
}

/** The key moment as the timeline marks it: the slowed stretch, the event, the stops. */
interface Marks {
  key: KeyMoment | null;
  duration: number;
  eventT: number;
}

/** a car chip's sheet that never opened (or is gone this long) is done with (ms) */
const SHEET_WAIT = 1500;

/**
 * The car picker, only while a car chip has asked for its sheet: the picker itself (its bar of
 * cars, nothing to do with the question) mounted out of sight and inert, its sheet (a dialog of
 * its own) open over the page; gone again once the sheet closes.
 */
function PickerHost({ car }: { car: ReactNode }) {
  useEffect(() => {
    let raf = 0;
    let seen = false;
    let since = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const open = !!document.querySelector('dialog.apx-cp');
      if (open) {
        seen = true;
        since = performance.now();
      } else if (performance.now() - since > (seen ? 100 : SHEET_WAIT))
        useDrive.setState({ picking: false });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="apx-drive-car" hidden inert>
      {car}
    </div>
  );
}

/** `car`: the car picker the Hud hands the timeline; only its sheet is used (PickerHost) */
export function DriveDash({ car }: { car?: ReactNode } = {}) {
  const picking = useDrive((s) => s.picking);
  const playing = useDrive((s) => s.playing);
  const mode = useDrive((s) => s.mode);
  const scenario = useDrive((s) => s.scenario);
  const waiting = useFreeze((s) => !!s.at) && !playing;
  const touch = useTouch();
  const scrub = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  const [marks, setMarks] = useState<Marks>({ key: null, duration: 1, eventT: NaN });
  // the run ended on its picture: every layout's same test, as wide as the bottom row allows
  const pic = usePathPicture((s) => s.pic);
  const open = usePathPicture((s) => s.open);
  const ran = usePathPicture((s) => s.car);
  const kmh = usePathPicture((s) => s.kmh);
  const theme = useTheme((s) => s.theme);
  const every = open && !!pic && !!ran && pic.id === scenario;
  const [rowW, setRowW] = useState(0);
  useLayoutEffect(() => {
    if (!every) return;
    const slot = document.querySelector('.apx-slot-center');
    setRowW(Math.min(900, (slot?.clientWidth ?? 600) - 24));
  }, [every]);

  useEffect(() => {
    let raf = 0;
    let last: Marks = { key: null, duration: 1, eventT: NaN };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const pb = drivePlayback;
      const dur = Math.max(0.1, pb.duration);
      if (scrub.current && !dragging.current) {
        scrub.current.max = dur.toFixed(2);
        scrub.current.value = pb.t.toFixed(2);
      }
      // the marks only change with the run
      if (pb.key !== last.key || dur !== last.duration || !Object.is(pb.eventT, last.eventT)) {
        last = { key: pb.key, duration: dur, eventT: pb.eventT };
        setMarks(last);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const seek = (v: number) => {
    drivePlayback.seek = v;
  };
  const at = (t: number) => `${(100 * Math.max(0, Math.min(t, marks.duration))) / marks.duration}%`;
  const k = marks.key;
  const input = EVENT_INPUT[scenario];
  const watch = mode === 'watch';

  return (
    <section
      className={`apx-panel apx-drive-dash${every ? ' is-end' : ''}`}
      aria-label="Timeline"
      style={every ? { width: rowW + 24 } : undefined}
    >
      {car && picking && <PickerHost car={car} />}
      <FreezeKeys />
      {every && rowW > 0 && (
        <EveryLayout
          vehicle={ran}
          id={pic.id}
          kmh={kmh}
          width={rowW}
          colors={DRIVE_COLORS[theme]}
        />
      )}
      {mode === 'drive' && <Driver />}
      {touch && mode === 'drive' && <TouchControls />}
      <div className="apx-drive-time">
        <button
          type="button"
          className={`apx-drive-iconbtn${waiting ? ' is-cue' : ''}`}
          aria-label={playing ? 'Pause' : 'Play (Space)'}
          title={playing ? 'Pause' : 'Play (Space)'}
          onClick={() => useDrive.setState({ playing: !playing })}
        >
          {playing ? ICON.pause : ICON.play}
        </button>
        <div className="apx-drive-scrub">
          <div className="apx-drive-scrub__marks" aria-hidden>
            {k && (
              <i
                className="apx-drive-scrub__key"
                style={{ left: at(k.t0), width: at(Math.max(0, k.t1 - k.t0)) }}
              />
            )}
            {watch && input && Number.isFinite(marks.eventT) && (
              <span className="apx-drive-scrub__event" style={{ left: at(marks.eventT) }}>
                <InputGlyph input={input} />
              </span>
            )}
            {watch &&
              k?.freeze.map((f) => (
                <i key={f} className="apx-drive-scrub__pin" style={{ left: at(f) }} />
              ))}
          </div>
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
        {/* the one cue for everything drawn larger than it is: the load moved between the
            axles (always, on the rings), a stop's nose dip, a catch's wheel angles, the
            pictures' sideways distances */}
        <span className="apx-drive-shown" title={`Marks drawn larger: ${SHOWN_ALL}`}>
          {MAGNIFIER}
        </span>
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
