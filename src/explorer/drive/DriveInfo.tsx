/**
 * Drive-mode info card (top right): what this scenario is (its steps, the current one lit), the
 * visitor's car's balance right now (front vs rear slip angle, grip in use, load on each axle),
 * and how every car came out of it: the scenario's headline number, a one-word verdict and
 * which axle let go first. Live values are polled from driveTelemetry and written straight to the
 * DOM (no React re-render per frame).
 */
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { Panel } from '../../app/ui';
import { useTheme } from '../../scene/theme';
import { METRICS, SCENARIOS, VERDICTS } from '../../sim/scenarios';
import type { VehicleSpec } from '../../spec/types';
import { DRIVE_COLORS } from './colors';
import { laneColor, useDriveResults } from './lineup';
import { drivePlayback, driveTelemetry, useDrive } from './state';
import './drive.css';

/** slip angle that fills a bar (deg) */
const SLIP_FULL = 10;

const STEP_VAR = {
  drive: 'var(--ok)',
  brake: 'var(--danger)',
  steer: 'var(--accent)',
  event: 'var(--warn)',
} as const;

const BALANCE = [
  { label: 'Oversteer', color: 'var(--warn)' },
  { label: 'Neutral', color: 'var(--text-faint)' },
  { label: 'Understeer', color: 'var(--accent)' },
  { label: 'Spun', color: 'var(--danger)' },
];

const setText = (r: RefObject<HTMLElement | null>, s: string) => {
  const el = r.current;
  if (el && el.textContent !== s) el.textContent = s;
};

function Steps() {
  const scenario = useDrive((s) => s.scenario);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let lit = -2;
    let shown = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el) return;
      const marks = drivePlayback.marks;
      const key = marks.map((m) => m.label).join('|');
      if (key !== shown) {
        // the list itself only changes with the scenario
        shown = key;
        lit = -2;
        el.replaceChildren();
        marks.forEach((m, i) => {
          if (i > 0) {
            const arrow = document.createElement('b');
            arrow.textContent = '›';
            el.append(arrow);
          }
          const chip = document.createElement('span');
          chip.style.setProperty('--sys', STEP_VAR[m.kind]);
          chip.textContent = m.holdS ? `${m.label} · wheel still ${m.holdS} s` : m.label;
          el.append(chip);
        });
      }
      let now = -1;
      for (let i = 0; i < marks.length; i++) if (marks[i].t <= drivePlayback.t) now = i;
      if (now !== lit) {
        lit = now;
        el.querySelectorAll('span').forEach((s, i) => s.classList.toggle('is-now', i === now));
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scenario]);
  return <div className="apx-drive-steps" ref={ref} aria-label="Steps" />;
}

function Live() {
  const lat = useRef<HTMLSpanElement>(null);
  const yaw = useRef<HTMLSpanElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const dot = useRef<HTMLElement>(null);
  const aF = useRef<HTMLSpanElement>(null);
  const aR = useRef<HTMLSpanElement>(null);
  const barF = useRef<HTMLElement>(null);
  const barR = useRef<HTMLElement>(null);
  const front = useRef<HTMLSpanElement>(null);
  const rear = useRef<HTMLSpanElement>(null);
  const load = useRef<HTMLDivElement>(null);
  const theme = useTheme((s) => s.theme);
  const colors = DRIVE_COLORS[theme];

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const bar = (el: HTMLElement | null, deg: number, use: number) => {
      if (!el) return;
      el.style.transform = `scaleX(${Math.min(1, deg / SLIP_FULL).toFixed(3)})`;
      // grip in use: quiet, amber at the limit, red sliding (as on the road)
      el.style.background =
        use > 0.98 ? colors.slide : use > 0.9 ? colors.limit : 'var(--text-faint)';
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 66) return;
      last = now;
      const t = driveTelemetry;
      setText(lat, Math.abs(t.latG).toFixed(2));
      setText(yaw, Math.abs(t.yawDeg).toFixed(0));
      setText(aF, `${t.alphaF.toFixed(1)}°`);
      setText(aR, `${t.alphaR.toFixed(1)}°`);
      bar(barF.current, t.alphaF, t.useF);
      bar(barR.current, t.alphaR, t.useR);
      const b = t.spun ? 3 : t.balance > 0.35 ? 2 : t.balance < -0.35 ? 0 : 1;
      setText(chip, BALANCE[b].label);
      if (dot.current) dot.current.style.background = BALANCE[b].color;
      const f = Math.round(100 * t.front);
      setText(front, `${f}`);
      setText(rear, `${100 - f}`);
      if (load.current) load.current.style.width = `${f}%`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [colors]);

  const dotStyle: CSSProperties = {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
  };
  return (
    <>
      <div className="apx-drive-slips" title="Slip angle at each axle: the bigger one slides first">
        <span>Front slip</span>
        <span className="apx-drive-slips__bar">
          <i ref={barF} />
        </span>
        <span className="apx-drive-slips__val" ref={aF}>
          0°
        </span>
        <span>Rear slip</span>
        <span className="apx-drive-slips__bar">
          <i ref={barR} />
        </span>
        <span className="apx-drive-slips__val" ref={aR}>
          0°
        </span>
      </div>
      <div className="apx-chips apx-drive-live">
        <span className="apx-chip" title="From the front vs rear slip angles">
          <i ref={dot} style={dotStyle} />
          <span ref={chip}>Neutral</span>
        </span>
        <span className="apx-chip" title="Sideways acceleration">
          <span ref={lat}>0.00</span> g
        </span>
        <span className="apx-chip" title="Yaw rate: how fast the car is turning">
          <span ref={yaw}>0</span> °/s
        </span>
      </div>
      <div className="apx-field apx-drive-live" title="Share of the weight on each axle right now">
        <span className="apx-field__row">
          <span>
            Front{' '}
            <span className="apx-field__value" ref={front}>
              50
            </span>
            %
          </span>
          <span>
            <span className="apx-field__value" ref={rear}>
              50
            </span>
            % Rear
          </span>
        </span>
        <div
          style={{
            height: 6,
            borderRadius: 3,
            background: 'var(--well-bg)',
            border: '1px solid var(--line)',
            overflow: 'hidden',
          }}
        >
          <div ref={load} style={{ height: '100%', width: '50%', background: 'var(--accent)' }} />
        </div>
      </div>
    </>
  );
}

export function DriveInfo({ vehicle }: { vehicle: VehicleSpec }) {
  const scenario = useDrive((s) => s.scenario);
  const mode = useDrive((s) => s.mode);
  const def = SCENARIOS[scenario];
  const { rows, metric: metricId } = useDriveResults();
  const metric = METRICS[metricId];
  const theme = useTheme((s) => s.theme);
  const colors = DRIVE_COLORS[theme];

  return (
    <Panel title={def.label} className="apx-drive-info">
      <Steps />
      <Live />
      <div className="apx-field">
        <span>{metric.label}</span>
        {rows ? (
          <table className="apx-drive-table">
            <tbody>
              {rows.map((r, i) => {
                const color = laneColor(r.info, colors, theme);
                const v = VERDICTS[r.verdict ?? 'neutral'];
                const you = i === 0 && mode === 'drive';
                return (
                  <tr
                    key={r.key}
                    style={{ color: i === 0 ? 'var(--text)' : 'var(--text-muted)' }}
                    title={
                      r.letGo
                        ? `${r.letGo.axle === 'rear' ? 'Rear' : 'Front'} axle let go first, at ${r.letGo.g.toFixed(2)} g`
                        : undefined
                    }
                  >
                    <td>
                      <i className="apx-drive-dot" style={{ '--sys': color } as CSSProperties} />
                      {r.label ?? r.info.code}
                    </td>
                    <td className="is-name">{you ? 'You' : r.info.name || vehicle.name}</td>
                    <td className="is-num">
                      {r.spun || !Number.isFinite(r.value)
                        ? '–'
                        : `${r.value > 0 && metric.unit === '%' ? '+' : ''}${r.value.toFixed(metric.digits)}${metric.unit ? ` ${metric.unit}` : ''}`}
                    </td>
                    <td>
                      {r.verdict && (
                        <span className="apx-drive-verdict" data-tone={v.tone}>
                          {v.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <span className="apx-muted">…</span>
        )}
      </div>
    </Panel>
  );
}
