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
import { layoutCode } from '../../spec/describe';
import { openPicker } from '../panels/CarPicker';
import { MAX_VS, type Go, type View } from '../view';
import { colorSlots, GHOST_COLORS, slotColor } from './colors';
import { openLegend } from './Legend';
import {
  FAMILIES,
  familyOf,
  gripShare,
  lineupGhosts,
  representative,
  standInFamilies,
  useDrive,
  type Family,
  type CameraMode,
  type Compare,
  type DriveMode,
} from './state';
import './drive.css';

const NONE: readonly string[] = [];

const HELP = (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
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
);

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

/** "718", "F8": the model without its make */
const modelTag = (name: string) =>
  name
    .replace(/\s*\(.*\)$/, '')
    .split(' ')
    .slice(1)
    .join(' ');

export function DriveControls({
  vehicle,
  view,
  go,
}: {
  vehicle: VehicleSpec;
  /** the URL view: its `vs` are the cars the visitor picked to drive against */
  view?: View;
  go?: Go;
}) {
  const d = useDrive();
  const theme = useTheme((s) => s.theme);
  const [open, setOpen] = useState(false);
  const def = SCENARIOS[d.scenario];
  const kmh = d.speed[d.scenario];
  const share = gripShare(d.scenario, kmh);
  const own = familyOf(vehicle);
  const picked = view?.vs ?? NONE;
  // every car on the road, each in the colour its lane wears
  const lineup = lineupGhosts(vehicle, d.ghosts, picked);
  const slots = colorSlots(lineup.map(familyOf));
  const colorOf = (i: number) => slotColor(familyOf(lineup[i]), slots[i], theme);
  const shown = standInFamilies(vehicle, d.ghosts, picked);
  const standInColor = (f: Family) => {
    const i = lineup.findIndex((v) => !picked.includes(v.id) && familyOf(v) === f);
    return i < 0 ? GHOST_COLORS[theme][f] : colorOf(i);
  };
  const families = FAMILIES.filter((f) => f !== own && representative(f, vehicle));
  const drop = (id: string) => view && go?.({ ...view, vs: picked.filter((x) => x !== id) });

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
          className="apx-drive-iconbtn"
          aria-label="How to read this"
          title="How to read this"
          onClick={openLegend}
        >
          {HELP}
        </button>
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
      <div className="apx-drive-techs" role="radiogroup" aria-label="Question">
        {HUB_ORDER.map((id, i) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === d.scenario}
            title={`${SCENARIOS[id].label}: ${SCENARIOS[id].title}`}
            onClick={() => d.setScenario(id)}
          >
            <span className="apx-drive-techs__n" aria-hidden>
              {i + 1}
            </span>
            <span className="apx-drive-techs__q">{SCENARIOS[id].question}</span>
            {id === d.scenario && (
              <span className="apx-drive-techs__how">{SCENARIOS[id].label}</span>
            )}
          </button>
        ))}
      </div>
      <select
        className="apx-select apx-drive-select"
        aria-label="Question"
        value={d.scenario}
        onChange={(e) => d.setScenario(e.target.value as ScenarioId)}
      >
        {HUB_ORDER.map((id, i) => (
          <option key={id} value={id}>
            {`${i + 1}. ${SCENARIOS[id].question}`}
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
              { value: 'layouts', label: 'Other cars' },
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
                onClick={() => d.toggleGhost(vehicle, f, picked)}
              >
                <i
                  className="apx-drive-dot"
                  style={{ '--sys': standInColor(f) } as CSSProperties}
                  aria-hidden
                />
                {f}
              </button>
            ))}
          </div>
        )}
        {(d.compare === 'layouts' || !def.baseline) && view && (
          <div className="apx-drive-picks" role="group" aria-label="Cars picked to compare">
            {lineup.map((v, i) =>
              picked.includes(v.id) ? (
                <button
                  key={v.id}
                  type="button"
                  className="apx-drive-pick"
                  title={`${v.name} · click to remove`}
                  aria-label={`Remove ${v.name}`}
                  onClick={() => drop(v.id)}
                >
                  <i
                    className="apx-drive-dot"
                    style={{ '--sys': colorOf(i) } as CSSProperties}
                    aria-hidden
                  />
                  {layoutCode(v)} {modelTag(v.name)}
                  <span aria-hidden>×</span>
                </button>
              ) : null,
            )}
            <button
              type="button"
              className="apx-drive-pick is-add"
              disabled={picked.length >= MAX_VS}
              onClick={() => openPicker('vs')}
              title="Drive against a car of your choice"
            >
              + Car
            </button>
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
