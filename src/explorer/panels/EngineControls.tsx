/**
 * Hub controls when zoomed into the engine: speed, slow motion, pause, the
 * firing-order timeline (scrub it to turn the crank by hand) and the balance view toggle,
 * which is the explorer detail #/<car>/engine/balance.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Button, Slider, Toggle } from '../../app/ui';
import { STROKE_COLORS, STROKE_LABELS } from '../../engine3d/materials';
import { SYSTEM_COLORS } from '../../scene/palette';
import { engineRuntime } from '../../scene/runtime';
import { firingEvents, headCylinders } from '../../spec/derive/firing';
import { portWindows } from '../../spec/derive/rotary';
import type { EngineSpec } from '../../spec/types';
import { mod } from '../../spec/units';
import { useView } from '../view';
import '../../engine3d/panels.css';

const W = 272;
const X0 = 16;
const PLOT = W - X0 - 2;
const xOf = (deg: number) => X0 + (mod(deg, 720) / 720) * PLOT;

/**
 * One row per cylinder head (= exhaust manifold): each power stroke as a bar from its firing,
 * so gaps (I3), continuous torque (I4) and overlap (I6+) are visible, and uneven per-bank
 * firing (cross-plane V8) shows as uneven ticks. A rotor fires every turn and each face
 * expands for longer than a piston, so a two-rotor's bars overlap. The cursor follows the crank.
 */
export function FiringTimeline({ engine: e }: { engine: EngineSpec }) {
  const rows = useMemo(() => {
    const heads = [...new Set(e.banks.map((b) => b.head))].sort((a, b) => a - b);
    return heads.map((h) => {
      const cyls = headCylinders(e, h);
      const tilt = cyls.reduce((a, i) => a + e.banks[e.cylinders[i].bank].tiltDeg, 0) / cyls.length;
      return { label: heads.length === 1 ? '' : tilt < 0 ? 'L' : 'R', cyls };
    });
  }, [e]);
  const events = useMemo(() => firingEvents(e), [e]);
  const rowH = rows.length > 2 ? 14 : 18;
  const H = rows.length * (rowH + 3) + 12;

  const svg = useRef<SVGSVGElement>(null);
  const cursor = useRef<SVGLineElement>(null);
  const now = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ wasRunning: boolean } | null>(null);

  useEffect(() => {
    let raf = 0;
    let lastNum = -1;
    const tick = () => {
      const deg = engineRuntime.crankDeg;
      const x = xOf(deg).toFixed(2);
      cursor.current?.setAttribute('x1', x);
      cursor.current?.setAttribute('x2', x);
      let num = events[events.length - 1]?.cyl ?? 0;
      for (const ev of events) if (ev.deg <= deg) num = ev.cyl;
      if (num !== lastNum && now.current) {
        now.current.textContent = `#${e.cylinders[num].num}`;
        lastNum = num;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [e, events]);

  const scrub = (ev: PointerEvent<SVGSVGElement>) => {
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    engineRuntime.crankDeg = mod(((x - X0) / PLOT) * 720, 720);
  };
  const end = () => {
    if (drag.current) engineRuntime.running = drag.current.wasRunning;
    drag.current = null;
  };

  const power = SYSTEM_COLORS.combustion;
  // a rotor face burns and expands until its exhaust port opens (~220° of e-shaft on a RENESIS)
  const powerDeg = e.rotary ? portWindows(e.rotary).exhaust[0] : 180;
  return (
    <div className="apx-fire">
      <div className="apx-fire__head">
        {/* under its "Firing order" header: the order itself, numbers only */}
        <span className="apx-fire__order">{e.firingOrder.join('-')}</span>
        <span className="apx-fire__now" ref={now} title="last cylinder to fire" />
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="slider"
        aria-label="Crank angle"
        aria-valuemin={0}
        aria-valuemax={720}
        onPointerDown={(ev) => {
          ev.currentTarget.setPointerCapture(ev.pointerId);
          drag.current = { wasRunning: drag.current?.wasRunning ?? engineRuntime.running };
          engineRuntime.running = false;
          scrub(ev);
        }}
        onPointerMove={(ev) => drag.current && scrub(ev)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {rows.map((row, ri) => {
          const y = ri * (rowH + 3);
          return (
            <g key={ri}>
              <text className="apx-fire__lbl" x={2} y={y + rowH / 2 + 3}>
                {row.label}
              </text>
              <rect className="apx-fire__row" x={X0} y={y} width={PLOT} height={rowH} rx={3} />
              {events.map(({ cyl: i, deg: f }) => {
                if (!row.cyls.includes(i)) return null;
                const parts =
                  f + powerDeg <= 720
                    ? [[f, powerDeg]]
                    : [
                        [f, 720 - f],
                        [0, f + powerDeg - 720],
                      ];
                return (
                  <g key={`${i}@${f}`}>
                    {parts.map(([a, len], k) => (
                      <rect
                        key={k}
                        x={xOf(a)}
                        y={y + 2}
                        width={(len / 720) * PLOT}
                        height={rowH - 4}
                        rx={2}
                        style={{ fill: power, opacity: 0.32 }}
                      />
                    ))}
                    <line
                      className="apx-fire__tick"
                      x1={xOf(f)}
                      x2={xOf(f)}
                      y1={y + 1}
                      y2={y + rowH - 1}
                    />
                    <text className="apx-fire__num" x={xOf(f) + 2} y={y + rowH / 2 + 3}>
                      {e.cylinders[i].num}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
        {[0, 180, 360, 540, 720].map((d) => (
          <text
            key={d}
            className="apx-fire__axis"
            x={X0 + (d / 720) * PLOT}
            y={H - 2}
            textAnchor={d === 0 ? 'start' : d === 720 ? 'end' : 'middle'}
          >
            {d}°
          </text>
        ))}
        <line ref={cursor} className="apx-fire__cursor" x1={X0} x2={X0} y1={0} y2={H - 11} />
      </svg>
      {e.rotary && (
        // the colours the rotary's chambers are drawn in
        <div className="apx-legend">
          {(['intake', 'compression', 'power', 'exhaust'] as const).map((s) => (
            <span key={s} style={{ '--sys': STROKE_COLORS[s] } as CSSProperties}>
              <i />
              {STROKE_LABELS[s]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export interface EngineControlsProps {
  engine: EngineSpec;
  /** override the explorer's balance detail (the dev sandbox has no explorer URL) */
  balance?: boolean;
  onBalance?: (on: boolean) => void;
  /** shown right under the engine-speed slider (the hub puts the sound and gas pedal there) */
  sound?: ReactNode;
  /** the sound's extras (turbo spool, wastegate, blow-off, anti-lag, burble), folded away */
  soundMore?: ReactNode;
}

export function EngineControls({
  engine: e,
  balance,
  onBalance,
  sound,
  soundMore,
}: EngineControlsProps) {
  const [view, go] = useView();
  const [rpm, setRpm] = useState(engineRuntime.rpm);
  const [slow, setSlow] = useState(engineRuntime.timeScale);
  const [running, setRunning] = useState(engineRuntime.running);
  const balanceOn = balance ?? view.detail === 'balance';

  // keep the shared engine speed inside this engine's range when the engine changes
  useEffect(() => {
    const r = Math.min(e.redlineRpm, Math.max(e.idleRpm, engineRuntime.rpm));
    engineRuntime.rpm = r;
    setRpm(r);
  }, [e]);

  // follow revs set elsewhere (gas pedal, blip, sweep) so the slider shows what you hear
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setRpm((r) => (Math.abs(r - engineRuntime.rpm) > 25 ? engineRuntime.rpm : r));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <Slider
        label="Engine speed"
        value={rpm}
        min={e.idleRpm}
        max={e.redlineRpm}
        step={50}
        format={(x) => `${Math.round(x)} rpm`}
        onChange={(x) => {
          engineRuntime.rpm = x;
          setRpm(x);
        }}
      />
      {sound}
      {soundMore && (
        <details className="apx-more">
          <summary>Sound</summary>
          {soundMore}
        </details>
      )}
      <Slider
        label="Slow motion"
        value={slow}
        min={0.005}
        max={0.25}
        step={0.005}
        format={(x) => `${(x * 100).toFixed(1)}%`}
        onChange={(x) => {
          engineRuntime.timeScale = x;
          setSlow(x);
        }}
      />
      {/* folded: the engine runs and sounds without it; open it to scrub the crank by hand */}
      <details className="apx-more">
        <summary>Firing order</summary>
        <FiringTimeline engine={e} />
      </details>
      <div className="apx-row">
        <Button
          onClick={() => {
            engineRuntime.running = !engineRuntime.running;
            setRunning(engineRuntime.running);
          }}
        >
          {running ? 'Pause' : 'Play'}
        </Button>
      </div>
      <Toggle
        label="Balance"
        checked={balanceOn}
        onChange={(on) => {
          if (onBalance) onBalance(on);
          else go({ ...view, detail: on ? 'balance' : undefined });
        }}
      />
    </>
  );
}
