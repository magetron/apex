/**
 * Drive-mode settings hub: who drives (the test driver or you), the technique, how fast, what
 * to compare against (other layouts, or the same car without the technique), the camera, and
 * stability control / tyre forces. On a phone the less-used settings fold away.
 */
import { useState, type CSSProperties } from 'react';
import { Segmented, Slider, Toggle } from '../../app/ui';
import { useTheme } from '../../scene/theme';
import { HUB_ORDER, SCENARIOS, type ScenarioId } from '../../sim/scenarios';
import type { VehicleSpec } from '../../spec/types';
import { GHOST_COLORS } from './colors';
import {
  FAMILIES,
  familyOf,
  gripShare,
  representative,
  resolveGhosts,
  useDrive,
  type CameraMode,
  type Compare,
  type DriveMode,
} from './state';
import './drive.css';

const GEAR = (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
  </svg>
);

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
      <span>or</span>
      <kbd>↑</kbd>
      <kbd>←</kbd>
      <kbd>↓</kbd>
      <kbd>→</kbd>
      <span>·</span>
      <kbd>R</kbd>
    </div>
  );
}

export function DriveControls({ vehicle }: { vehicle: VehicleSpec }) {
  const d = useDrive();
  const theme = useTheme((s) => s.theme);
  const [open, setOpen] = useState(false);
  const def = SCENARIOS[d.scenario];
  const kmh = d.speed[d.scenario];
  const share = gripShare(d.scenario, kmh);
  const own = familyOf(vehicle);
  const shown = resolveGhosts(vehicle, d.ghosts).map(familyOf);
  const families = FAMILIES.filter((f) => f !== own && representative(f, vehicle));

  return (
    <div className={`apx-drive-hub${open ? ' is-open' : ''}`}>
      <div className="apx-row" style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
        <div style={{ flex: '1 1 auto' }}>
          <Segmented<DriveMode>
            label="Who drives"
            value={d.mode}
            onChange={(mode) => useDrive.setState({ mode, playing: true })}
            options={[
              { value: 'watch', label: 'Test driver', title: 'Watch the scripted test driver' },
              { value: 'drive', label: 'You drive', title: 'Drive it yourself (keys or touch)' },
            ]}
          />
        </div>
        <button
          type="button"
          className="apx-drive-iconbtn apx-drive-gear"
          aria-label="More settings"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {GEAR}
        </button>
      </div>
      {d.mode === 'drive' && <Keys />}
      <div className="apx-drive-techs" role="radiogroup" aria-label="Technique">
        {HUB_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === d.scenario}
            title={SCENARIOS[id].title}
            onClick={() => d.setScenario(id)}
          >
            {SCENARIOS[id].label}
          </button>
        ))}
      </div>
      <select
        className="apx-select apx-drive-select"
        aria-label="Technique"
        value={d.scenario}
        onChange={(e) => d.setScenario(e.target.value as ScenarioId)}
      >
        {HUB_ORDER.map((id) => (
          <option key={id} value={id}>
            {SCENARIOS[id].label}
          </option>
        ))}
      </select>
      <div className="apx-drive-more">
        <Slider
          label={def.speed.label}
          value={kmh}
          min={def.speed.min}
          max={def.speed.max}
          step={1}
          onChange={d.setSpeed}
          format={(v) => {
            const g = gripShare(d.scenario, v);
            return g === null ? `${Math.round(v)} km/h` : `${Math.round(100 * g)}% of grip`;
          }}
        />
        {share !== null && def.baseline && (
          <Segmented<Compare>
            label="Compare with"
            value={d.compare}
            onChange={(compare) => useDrive.setState({ compare })}
            options={[
              { value: 'layouts', label: 'Other layouts' },
              { value: 'technique', label: def.baseline.label, title: 'The same car without it' },
            ]}
          />
        )}
        {(d.compare === 'layouts' || !def.baseline) && (
          <div className="apx-seg" role="group" aria-label="Layouts to compare">
            {families.map((f) => (
              <button
                key={f}
                type="button"
                role="checkbox"
                aria-checked={shown.includes(f)}
                title={representative(f, vehicle)!.name}
                onClick={() => d.toggleGhost(vehicle, f)}
              >
                <i
                  className="apx-drive-dot"
                  style={{ '--sys': GHOST_COLORS[theme][f] } as CSSProperties}
                  aria-hidden
                />
                {f}
              </button>
            ))}
          </div>
        )}
        <Segmented<CameraMode>
          label="Camera"
          value={d.camera}
          onChange={(camera) => useDrive.setState({ camera })}
          options={[
            { value: 'chase', label: 'Chase', title: 'Follow the car' },
            { value: 'top', label: 'From above', title: 'Compare the lines' },
          ]}
        />
        <Toggle
          label="Stability control"
          checked={d.esc}
          onChange={(esc) => useDrive.setState({ esc })}
        />
        <Toggle
          label="Tyre forces"
          checked={d.forces}
          onChange={(forces) => useDrive.setState({ forces })}
        />
      </div>
    </div>
  );
}
