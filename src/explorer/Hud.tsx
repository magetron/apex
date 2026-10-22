/**
 * Minimal HUD around the 3D scene: trail (top-left), info card (top-right), settings hub
 * (bottom-left), car picker (bottom-centre). Text only where it's a label or derived data.
 * See-through is a switch in the hub, not a level of its own: switching it leaves the camera,
 * the card and the hub where they are; the card opens its detailed rows in place.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BottomBar, Button, Dock, Panel, Segmented, Slider } from '../app/ui';
import { useScene, type LabelMode } from '../scene/store';
import { SoundControls, useEngineAudio } from '../audio';
import { getMotor } from '../spec/catalog';
import { awdPartId } from '../spec/derive/awd';
import { layoutPowertrain } from '../spec/derive/layout';
import type { EngineSpec, VehicleSpec } from '../spec/types';
import { firstView, useCompare, vsCars } from './compare';
import { DriveControls } from './drive/DriveControls';
import { DriveDash } from './drive/DriveDash';
import { DriveInfo } from './drive/DriveInfo';
import { LoopFade } from './drive/LoopFade';
import { AwdControls } from './panels/AwdPanel';
import { CarInfo } from './panels/CarInfo';
import { CarPicker } from './panels/CarPicker';
import { CompareBar } from './panels/CompareBar';
import { EngineControls } from './panels/EngineControls';
import { EngineInfo } from './panels/EngineInfo';
import { PartInfo } from './panels/PartInfo';
import { isSeeThrough, withSeeThrough, type Go, type View } from './view';
import './explorer.css';

interface HudProps {
  view: View;
  go: Go;
  vehicle: VehicleSpec;
  engine: EngineSpec | null;
}

const HINT: Record<View['level'], string> = {
  car: 'Click the car to see through',
  internals: 'Click a part to zoom in',
  part: 'Esc or click empty space to zoom out',
  drive: 'Esc to stop',
};

function Trail({ view, go, vehicle }: Omit<HudProps, 'engine'>) {
  const partLabel = useMemo(
    () =>
      view.part
        ? (layoutPowertrain(vehicle).parts.find((p) => p.id === view.part)?.label ?? view.part)
        : '',
    [vehicle, view.part],
  );
  // the car is one view (see-through or not); a part or drive is a step away from it
  const steps: { label: string; to?: View }[] = [
    {
      label: vehicle.name,
      to:
        view.level === 'part'
          ? withSeeThrough(view, true)
          : view.level === 'drive'
            ? withSeeThrough(view, false)
            : undefined,
    },
  ];
  if (view.level === 'part') steps.push({ label: partLabel });
  if (view.level === 'drive') steps.push({ label: 'Drive' });
  return (
    <>
      <nav className="apx-trail" aria-label="Zoom level">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className="apx-trail__sep">›</span>}
              {last || !s.to ? (
                <span aria-current="page">{s.label}</span>
              ) : (
                <button type="button" onClick={() => go(s.to!)}>
                  {s.label}
                </button>
              )}
            </span>
          );
        })}
      </nav>
      <span className="apx-hint">{HINT[view.level]}</span>
    </>
  );
}

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

/** A car outline: solid when painted, the drivetrain line inside when see-through. */
const SEE_ICON = (
  <svg className="apx-see__icon" viewBox="0 0 30 16" aria-hidden="true">
    <path
      className="is-solid"
      d="M1.5 12.5V9.2Q1.5 7.6 3.2 7.4L8 6.6 11.5 3.2Q12.6 2.2 14.2 2.2H19Q20.6 2.2 21.6 3.3L24.2 6.4 27 7.1Q28.5 7.5 28.5 9V12.5Z"
    />
    <path className="is-inner" d="M6.5 10h17M19 7.5h4.5v3.6H19z" />
    <circle className="is-solid" cx="8" cy="12.6" r="2.4" />
    <circle className="is-solid" cx="22" cy="12.6" r="2.4" />
  </svg>
);

function SeeThroughSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      className="apx-see"
      aria-checked={on}
      aria-keyshortcuts="X"
      title="See-through (X)"
      onClick={() => onChange(!on)}
    >
      {SEE_ICON}
      <span className="apx-see__label">See-through</span>
      <span className="apx-see__track" aria-hidden />
    </button>
  );
}

function Hub({ view, go, vehicle, engine }: HudProps) {
  const { explode, setExplode, labels, setLabels } = useScene();
  // phones fold Explode, Labels and the sound away behind a gear
  const [more, setMore] = useState(false);
  const see = isSeeThrough(view);
  const enginePart = view.level === 'part' && view.part === 'engine' && engine;
  const awdPart = useMemo(() => awdPartId(vehicle), [vehicle]);
  const awdHere = view.level === 'part' && !!awdPart && view.part === awdPart;
  const pt = vehicle.powertrain;
  const motorEntry =
    view.level === 'part' && pt.kind === 'ev'
      ? pt.motors.find((m) => `motor-${m.axle}` === view.part)
      : undefined;
  const motor = motorEntry ? getMotor(motorEntry.motor) : null;
  // One voice for the whole visit: it keeps playing from the car to inside to drive (where the
  // sim drives its rpm), and crossfades when the car or a zoomed EV motor changes.
  const mainMotor =
    pt.kind === 'ev'
      ? getMotor((pt.motors.find((m) => m.axle === 'rear') ?? pt.motors[0]).motor)
      : null;
  const audio = useEngineAudio(motor ?? engine ?? mainMotor);
  // Drive starts the sound (a click may), unless the visitor switched it off this visit
  const switchedOff = useRef(false);
  const sound = (
    <SoundControls
      audio={audio}
      compact={!enginePart && !motor}
      // rev it from any view but drive, where the sim has the throttle
      pedalKeys={view.level !== 'drive'}
      onToggle={(on) => (switchedOff.current = !on)}
    />
  );
  const setSee = (on: boolean) => go(withSeeThrough(view, on), { replace: view.level !== 'part' });
  const carView = view.level === 'car' || view.level === 'internals';
  const drive = () => {
    go({ ...withSeeThrough(view, false), level: 'drive' });
    if (!audio.playing && !switchedOff.current) audio.start();
  };
  return (
    <Panel className={`apx-hub${carView ? ' is-foldable' : ''}${more ? ' is-open' : ''}`}>
      {view.level !== 'drive' && (
        <>
          <div className="apx-hub__top">
            <SeeThroughSwitch on={see} onChange={setSee} />
            {carView && <Button onClick={drive}>Drive</Button>}
            {carView && (
              <button
                type="button"
                className="apx-hub__gear"
                aria-label="More settings"
                aria-expanded={more}
                onClick={() => setMore(!more)}
              >
                {GEAR}
              </button>
            )}
          </div>
          <div className="apx-hub__more">
            <Slider
              label="Explode"
              value={explode}
              min={0}
              max={1}
              onChange={(v) => {
                // exploding needs the x-ray: dragging it on the painted car switches see-through on
                if (!see && v > 0) setSee(true);
                setExplode(v);
              }}
              format={(x) => `${Math.round(x * 100)}%`}
            />
            <Segmented<LabelMode>
              label="Labels"
              value={labels}
              onChange={setLabels}
              options={[
                { value: 'none', label: 'Off' },
                { value: 'hover', label: 'Hover' },
                { value: 'all', label: 'All' },
              ]}
            />
            {!enginePart && sound}
          </div>
        </>
      )}
      {awdHere && <AwdControls vehicle={vehicle} />}
      {enginePart && <EngineControls engine={engine} sound={sound} />}
      {view.level === 'drive' && sound}
      {view.level === 'drive' && <DriveControls vehicle={vehicle} view={view} go={go} />}
      {view.level === 'drive' && (
        <div className="apx-row">
          <Button onClick={() => go(withSeeThrough(view, false))}>Stop</Button>
        </div>
      )}
    </Panel>
  );
}

function Info({ view, go, vehicle, engine }: HudProps) {
  const vsKey = view.vs?.join(',') ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const others = useMemo(() => vsCars(view.vs), [vsKey]);
  if (view.level === 'drive') return <DriveInfo vehicle={vehicle} />;
  if (view.level === 'part' && view.part) {
    if (view.part === 'engine' && engine) return <EngineInfo engine={engine} />;
    return <PartInfo vehicle={vehicle} part={view.part} />;
  }
  return (
    <CarInfo
      vehicle={vehicle}
      detailed={view.level === 'internals'}
      view={view}
      go={go}
      others={others}
    />
  );
}

/** A comparison starting opens side by side, in its first view (firstView). */
function useCompareStart(on: boolean) {
  const was = useRef(on);
  useEffect(() => {
    if (on && !was.current)
      useCompare.setState({
        view: firstView(),
        mode: 'side',
        before: null,
      });
    was.current = on;
  }, [on]);
}

/**
 * Publishes the bottom row's height (hub + picker) as --apx-bottom-h on the HUD layer, so on a
 * phone the info card can sit on top of it rather than behind it.
 */
function useBottomRowHeight() {
  useLayoutEffect(() => {
    const row = document.querySelector<HTMLElement>('.apx-overlay > .apx-dock--bottom');
    const layer = row?.parentElement;
    if (!row || !layer) return;
    const ro = new ResizeObserver(() =>
      layer.style.setProperty('--apx-bottom-h', `${Math.ceil(row.offsetHeight + 8)}px`),
    );
    ro.observe(row);
    return () => {
      ro.disconnect();
      layer.style.removeProperty('--apx-bottom-h');
    };
  }, []);
}

export function Hud(props: HudProps) {
  const { view, go, vehicle } = props;
  useBottomRowHeight();
  const comparing = (view.level === 'car' || view.level === 'internals') && !!view.vs?.length;
  useCompareStart(!!view.vs?.length);
  return (
    <>
      {view.level === 'drive' && <LoopFade />}
      <Dock side="top-left">
        <Trail {...props} />
      </Dock>
      <Dock side="top-right">
        <Info {...props} />
      </Dock>
      <BottomBar
        left={<Hub {...props} />}
        center={
          view.level === 'drive' ? (
            <DriveDash car={<CarPicker view={view} go={go} vehicle={vehicle} slim />} />
          ) : (
            <div className="apx-center-stack">
              {comparing && <CompareBar />}
              <CarPicker view={view} go={go} vehicle={vehicle} />
            </div>
          )
        }
      />
    </>
  );
}
