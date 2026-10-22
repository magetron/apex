/**
 * The drive rail (the hub's slot, left): the two cars as chips (A and B; click one to pick
 * another car), the eight questions by number and short name, who drives (the test driver or
 * you, as icons), the key, and behind the gear only what a run needs: how fast, slow motion,
 * stopping at the key moment, stability control, and the sound. (Esc, or the car's name in the
 * breadcrumb, leaves drive mode.)
 */
import type { ReactNode } from 'react';
import { Segmented, Slider, Toggle } from '../../app/ui';
import { lateralLimit, REF_LATERAL_LIMIT } from '../../sim/model';
import { HUB_ORDER, SCENARIOS, type ScenarioId } from '../../sim/scenarios';
import type { VehicleSpec } from '../../spec/types';
import type { Go, View } from '../view';
import { CarSlots } from './CarSlots';
import { KEY_RATE } from './key';
import { Legend, toggleLegend, useLegend } from './Legend';
import { paramsOf } from './lineup';
import {
  capKmh,
  RATES,
  SHORT_NAME,
  speedRange,
  useDrive,
  type DriveMode,
  type Rate,
} from './state';
import './drive.css';

const RATE_LABEL: Record<Rate, string> = { 1: '1×', 0.5: '½×', 0.25: '¼×', 0.125: '⅛×' };
/** the slow-motion rates on offer (real time is Auto away from the key moment), each its name */
const SLOW = RATES.filter((r) => r < 1);
const SLOW_NAME: Record<Rate, string> = {
  1: 'Real time',
  0.5: 'Half speed',
  0.25: 'Quarter speed',
  0.125: 'Eighth speed',
};
/** the automatic slow motion's rate, as its option's title names it */
const KEY_RATE_LABEL = RATE_LABEL[KEY_RATE as Rate] ?? `${KEY_RATE}×`;

const ICON = {
  /** the test driver drives: watch */
  watch: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  /** you drive: a steering wheel */
  drive: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 11h6M14.5 11h6M12 14.5V21" strokeLinecap="round" />
    </svg>
  ),
  key: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6" />
      <path d="M12 17h.01" strokeWidth="3" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </svg>
  ),
};

function Keys() {
  return (
    <div
      className="apx-drive-keys"
      aria-label="Keys: W or up for gas, S or down to brake, A and D or left and right to steer, R to restart"
    >
      <kbd>W</kbd>
      <kbd>A</kbd>
      <kbd>S</kbd>
      <kbd>D</kbd>
      <span>·</span>
      <kbd>↑</kbd>
      <kbd>←</kbd>
      <kbd>↓</kbd>
      <kbd>→</kbd>
      <span>·</span>
      <kbd>R</kbd>
    </div>
  );
}

/** How fast the visitor's own car takes the corner at a slider setting (km/h): grip-scaled
 *  scenarios run every car at the same share of its own limit. */
export function ownKmh(vehicle: VehicleSpec, id: ScenarioId, kmh: number): number {
  if (!SCENARIOS[id].radius) return kmh;
  return kmh * Math.sqrt(lateralLimit(paramsOf(vehicle)) / REF_LATERAL_LIMIT);
}

export function DriveControls({
  vehicle,
  view,
  go,
  sound,
}: {
  vehicle: VehicleSpec;
  /** the URL view: car A is its car, car B its `vs` */
  view?: View;
  go?: Go;
  /** the sound controls, behind the gear */
  sound?: ReactNode;
  /** leave drive mode (the Hud's; Esc and the breadcrumb do it, so nothing here) */
  onStop?: () => void;
}) {
  const d = useDrive();
  const def = SCENARIOS[d.scenario];
  const range = speedRange(d.scenario);
  const kmh = capKmh(d.scenario, d.speed[d.scenario]);
  const keyOpen = useLegend((s) => s.open);
  const who = (mode: DriveMode) => useDrive.setState({ mode, playing: mode === 'watch' });

  return (
    <div className="apx-drive-rail">
      <CarSlots vehicle={vehicle} view={view} go={go} />
      <ol className="apx-drive-qs" role="radiogroup" aria-label="Question">
        {HUB_ORDER.map((id, i) => (
          <li key={id}>
            <button
              type="button"
              role="radio"
              aria-checked={id === d.scenario}
              title={SCENARIOS[id].question}
              onClick={() => d.setScenario(id)}
            >
              <span className="apx-drive-qs__n" aria-hidden>
                {i + 1}
              </span>
              <span className="apx-drive-qs__q">{SHORT_NAME[id]}</span>
            </button>
          </li>
        ))}
      </ol>
      <select
        className="apx-select apx-drive-select"
        aria-label="Question"
        value={d.scenario}
        onChange={(e) => d.setScenario(e.target.value as ScenarioId)}
      >
        {HUB_ORDER.map((id, i) => (
          <option key={id} value={id}>
            {`${i + 1}. ${SHORT_NAME[id]}`}
          </option>
        ))}
      </select>
      <div className="apx-drive-rail__foot">
        <div className="apx-drive-who" role="radiogroup" aria-label="Who drives">
          {(['watch', 'drive'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={d.mode === m}
              aria-label={m === 'watch' ? 'Test driver' : 'You drive'}
              title={m === 'watch' ? 'Test driver' : 'You drive (keys or touch)'}
              onClick={() => who(m)}
            >
              {ICON[m]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="apx-drive-iconbtn apx-drive-keybtn"
          aria-label="Key"
          title="Key"
          aria-expanded={keyOpen}
          onClick={toggleLegend}
        >
          {ICON.key}
        </button>
        <button
          type="button"
          className="apx-drive-iconbtn"
          aria-label="Settings"
          title="Settings"
          aria-expanded={d.more}
          onClick={() => useDrive.setState({ more: !d.more })}
        >
          {ICON.gear}
        </button>
      </div>
      {d.mode === 'drive' && <Keys />}
      <Legend />
      {d.more && (
        <div className="apx-drive-extra">
          <Slider
            label={def.speed.label}
            value={kmh}
            min={range.min}
            max={range.max}
            step={1}
            onChange={d.setSpeed}
            format={(v) => `${Math.round(ownKmh(vehicle, d.scenario, v))} km/h`}
          />
          <Segmented<string>
            label="Slow motion"
            value={d.autoSlow ? 'auto' : String(d.rate)}
            onChange={(v) =>
              useDrive.setState(
                v === 'auto'
                  ? { autoSlow: true, rate: 1 }
                  : { autoSlow: false, rate: Number(v) as Rate },
              )
            }
            options={[
              {
                value: 'auto',
                label: 'Auto',
                title: `Real time, slowing to ${KEY_RATE_LABEL} round the moment that matters`,
              },
              ...SLOW.map((r) => ({ value: String(r), label: RATE_LABEL[r], title: SLOW_NAME[r] })),
            ]}
          />
          <Toggle
            label="Stop at the key moment"
            checked={d.autoPause}
            onChange={(autoPause) => useDrive.setState({ autoPause })}
          />
          <Toggle
            label="Stability control"
            checked={d.esc}
            onChange={(esc) => useDrive.setState({ esc })}
          />
          {sound}
        </div>
      )}
    </div>
  );
}
