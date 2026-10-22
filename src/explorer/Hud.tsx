/**
 * Minimal HUD around the 3D scene: trail (top-left), info card (top-right), settings hub
 * (bottom-left), car picker (bottom-centre). Text only where it's a label or derived data.
 */
import { useMemo, useRef } from 'react';
import { BottomBar, Button, Dock, Panel, Segmented, Slider } from '../app/ui';
import { useScene, type LabelMode } from '../scene/store';
import { SoundControls, useEngineAudio } from '../audio';
import { getMotor } from '../spec/catalog';
import { awdPartId } from '../spec/derive/awd';
import { layoutPowertrain } from '../spec/derive/layout';
import type { EngineSpec, VehicleSpec } from '../spec/types';
import { DriveControls } from './drive/DriveControls';
import { DriveDash } from './drive/DriveDash';
import { DriveInfo } from './drive/DriveInfo';
import { LoopFade } from './drive/LoopFade';
import { AwdControls } from './panels/AwdPanel';
import { CarInfo } from './panels/CarInfo';
import { CarPicker } from './panels/CarPicker';
import { EngineControls } from './panels/EngineControls';
import { EngineInfo } from './panels/EngineInfo';
import { PartInfo } from './panels/PartInfo';
import type { View } from './view';

interface HudProps {
  view: View;
  go: (v: View) => void;
  vehicle: VehicleSpec;
  engine: EngineSpec | null;
}

const HINT: Record<View['level'], string> = {
  car: 'Click the car to look inside',
  internals: 'Click a part to zoom in · Esc to back out',
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
  const steps: { label: string; to?: View }[] = [
    { label: vehicle.name, to: { vehicleId: vehicle.id, level: 'car' } },
  ];
  if (view.level === 'internals' || view.level === 'part')
    steps.push({ label: 'Inside', to: { vehicleId: vehicle.id, level: 'internals' } });
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

function Hub({ view, go, vehicle, engine }: HudProps) {
  const { explode, setExplode, labels, setLabels } = useScene();
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
  return (
    <Panel>
      {(view.level === 'internals' || view.level === 'part') && (
        <>
          <Slider
            label="Explode"
            value={explode}
            min={0}
            max={1}
            onChange={setExplode}
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
        </>
      )}
      {awdHere && <AwdControls vehicle={vehicle} />}
      {enginePart ? <EngineControls engine={engine} sound={sound} /> : sound}
      {view.level === 'drive' && <DriveControls vehicle={vehicle} />}
      <div className="apx-row">
        {view.level === 'car' && (
          <Button primary onClick={() => go({ vehicleId: vehicle.id, level: 'internals' })}>
            Look inside
          </Button>
        )}
        {view.level === 'drive' ? (
          <Button onClick={() => go({ vehicleId: vehicle.id, level: 'car' })}>Stop</Button>
        ) : (
          view.level !== 'part' && (
            <Button
              onClick={() => {
                go({ vehicleId: vehicle.id, level: 'drive' });
                if (!audio.playing && !switchedOff.current) audio.start();
              }}
            >
              Drive
            </Button>
          )
        )}
      </div>
    </Panel>
  );
}

function Info({ view, vehicle, engine }: Omit<HudProps, 'go'>) {
  if (view.level === 'drive') return <DriveInfo vehicle={vehicle} />;
  if (view.level === 'part' && view.part) {
    if (view.part === 'engine' && engine) return <EngineInfo engine={engine} />;
    return <PartInfo vehicle={vehicle} part={view.part} />;
  }
  return <CarInfo vehicle={vehicle} detailed={view.level === 'internals'} />;
}

export function Hud(props: HudProps) {
  const { view } = props;
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
          view.level === 'car' || view.level === 'internals' ? (
            <CarPicker view={view} go={props.go} vehicle={props.vehicle} />
          ) : view.level === 'drive' ? (
            <DriveDash />
          ) : null
        }
      />
    </>
  );
}
