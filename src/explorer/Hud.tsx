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
import { useLabelDeclutter } from './declutter';
import { DriveControls } from './drive/DriveControls';
import { DriveDash } from './drive/DriveDash';
import { DriveInfo } from './drive/DriveInfo';
import { LoopFade } from './drive/LoopFade';
import { AwdControls } from './panels/AwdPanel';
import { CarInfo, useMoreOverlaysReset } from './panels/CarInfo';
import { CarPicker } from './panels/CarPicker';
import { CompareBar } from './panels/CompareBar';
import { EngineControls } from './panels/EngineControls';
import { EngineInfo } from './panels/EngineInfo';
import { PartInfo } from './panels/PartInfo';
import {
  MiniMap,
  RacerTags,
  ResultCard,
  TrackControls,
  TrackDash,
  TrackInfo,
  TrackPicker,
} from './track/TrackHud';
import { findTrack } from '../sim/track/registry';
import { openTours } from './tour/state';
import { useTourSound } from './tour/TourPlayer';
import { isSeeThrough, withSeeThrough, type Go, type View } from './view';
import './explorer.css';

interface HudProps {
  view: View;
  go: Go;
  vehicle: VehicleSpec;
  engine: EngineSpec | null;
}

/** what to do next, four words at most (drive and the hot lap have their own controls on screen) */
const HINT: Record<View['level'], string> = {
  car: 'Click to see through',
  internals: 'Click a part',
  part: 'Esc to zoom out',
  drive: '',
  track: '',
};

function Trail({ view, go, vehicle }: Omit<HudProps, 'engine'>) {
  const partLabel = useMemo(
    () =>
      view.part
        ? (layoutPowertrain(vehicle).parts.find((p) => p.id === view.part)?.label ?? view.part)
        : '',
    [vehicle, view.part],
  );
  // the car is one view (see-through or not); a part, drive or a hot lap is a step away from it
  const steps: { label: string; to?: View }[] = [
    {
      label: vehicle.name,
      to:
        view.level === 'part'
          ? withSeeThrough(view, true)
          : view.level === 'drive' || view.level === 'track'
            ? withSeeThrough(view, false)
            : undefined,
    },
  ];
  if (view.level === 'part') steps.push({ label: partLabel });
  if (view.level === 'drive') steps.push({ label: 'Drive' });
  if (view.level === 'track') {
    steps.push({ label: 'Hot lap', to: view.track ? { ...view, track: undefined } : undefined });
    if (view.track) steps.push({ label: findTrack(view.track)?.name ?? view.track });
  }
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
      {/* the first step is easy to miss in faint grey: the painted car says it out loud, and the
          call itself does it (a pill that looked like a button and wasn't one) */}
      {view.level === 'car' ? (
        <button
          type="button"
          className="apx-hint is-call"
          aria-keyshortcuts="X"
          onClick={() => go(withSeeThrough(view, true), { replace: true })}
        >
          {HINT.car}
        </button>
      ) : (
        HINT[view.level] && <span className="apx-hint">{HINT[view.level]}</span>
      )}
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
      // the engine view folds the sound's extras away (soundMore): only the motor shows them here
      compact={!motor}
      // rev it from any view but drive and the hot lap, where the sim has the throttle
      pedalKeys={view.level !== 'drive' && view.level !== 'track'}
      onToggle={(on) => (switchedOff.current = !on)}
    />
  );
  const soundMore = enginePart && <SoundControls audio={audio} pedalKeys={false} />;
  useTourSound(audio);
  const setSee = (on: boolean) => go(withSeeThrough(view, on), { replace: view.level !== 'part' });
  const carView = view.level === 'car' || view.level === 'internals';
  const drive = () => {
    go({ ...withSeeThrough(view, false), level: 'drive' });
    if (!audio.playing && !switchedOff.current) audio.start();
  };
  const hotLap = () => {
    go({ ...withSeeThrough(view, false), level: 'track' });
    if (!audio.playing && !switchedOff.current) audio.start();
  };
  return (
    <Panel className={`apx-hub${carView ? ' is-foldable' : ''}${more ? ' is-open' : ''}`}>
      {view.level !== 'drive' && view.level !== 'track' && (
        <>
          <div className="apx-hub__top">
            <SeeThroughSwitch on={see} onChange={setSee} />
            {carView && <Button onClick={drive}>Drive</Button>}
            {carView && (
              <Button onClick={hotLap} title="Lap a real circuit, against the clock">
                Hot lap
              </Button>
            )}
            {carView && (
              <Button onClick={openTours} title="Guided questions">
                Tours
              </Button>
            )}
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
            <div className="apx-field apx-hub__labels">
              <span>Labels</span>
              <Segmented<LabelMode>
                label="Labels"
                value={labels}
                onChange={setLabels}
                options={[
                  { value: 'none', label: 'Off', title: 'No part names' },
                  { value: 'hover', label: 'Hover', title: 'Name a part when pointed at' },
                  { value: 'all', label: 'All', title: 'Name the main parts' },
                ]}
              />
            </div>
            {!enginePart && sound}
          </div>
        </>
      )}
      {awdHere && <AwdControls vehicle={vehicle} />}
      {enginePart && <EngineControls engine={engine} sound={sound} soundMore={soundMore} />}
      {view.level === 'drive' && (
        <DriveControls
          vehicle={vehicle}
          view={view}
          go={go}
          sound={sound}
          onStop={() => go(withSeeThrough(view, false))}
        />
      )}
      {view.level === 'track' && <TrackControls view={view} go={go} sound={sound} />}
    </Panel>
  );
}

function Info({ view, go, vehicle, engine }: HudProps) {
  const vsKey = view.vs?.join(',') ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const others = useMemo(() => vsCars(view.vs), [vsKey]);
  if (view.level === 'drive') return <DriveInfo vehicle={vehicle} view={view} go={go} />;
  if (view.level === 'track') return <TrackInfo view={view} />;
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
 * Publishes the HUD rows' heights on the HUD layer: the bottom row's (hub + picker) as
 * --apx-bottom-h, so on a phone the info card can sit on top of it rather than behind it, and
 * the top-left column's (breadcrumb, hint, mini-map) as --apx-top-h, so the hub below it stops
 * short of it however many folds are open.
 */
function useRowHeights() {
  useLayoutEffect(() => {
    const row = document.querySelector<HTMLElement>('.apx-overlay > .apx-dock--bottom');
    const layer = row?.parentElement;
    const top = layer?.querySelector<HTMLElement>(':scope > .apx-dock--top-left');
    if (!row || !layer || !top) return;
    const ro = new ResizeObserver(() => {
      layer.style.setProperty('--apx-bottom-h', `${Math.ceil(row.offsetHeight + 8)}px`);
      layer.style.setProperty('--apx-top-h', `${Math.ceil(top.offsetHeight)}px`);
    });
    ro.observe(row);
    ro.observe(top);
    return () => {
      ro.disconnect();
      layer.style.removeProperty('--apx-bottom-h');
      layer.style.removeProperty('--apx-top-h');
    };
  }, []);
}

export function Hud(props: HudProps) {
  const { view, go, vehicle } = props;
  useRowHeights();
  useLabelDeclutter();
  useMoreOverlaysReset(vehicle.id);
  const comparing = (view.level === 'car' || view.level === 'internals') && !!view.vs?.length;
  useCompareStart(!!view.vs?.length);
  return (
    <>
      {view.level === 'drive' && <LoopFade />}
      {/* (first: the HUD's panels sit over the cars' name tags) */}
      {view.level === 'track' && !!view.track && <RacerTags view={view} />}
      <Dock side="top-left">
        <Trail {...props} />
        {view.level === 'track' && <MiniMap view={view} />}
      </Dock>
      {view.level === 'track' && !view.track && <TrackPicker view={view} go={go} />}
      {view.level === 'track' && !!view.track && <ResultCard view={view} go={go} />}
      <Dock side="top-right">
        <Info {...props} />
      </Dock>
      <BottomBar
        left={<Hub {...props} />}
        center={
          view.level === 'drive' ? (
            <DriveDash car={<CarPicker view={view} go={go} vehicle={vehicle} slim />} />
          ) : view.level === 'track' ? (
            <TrackDash
              view={view}
              picker={<CarPicker view={view} go={go} vehicle={vehicle} slim={!!view.track} />}
            />
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
