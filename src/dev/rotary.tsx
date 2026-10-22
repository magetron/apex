/**
 * #/dev/rotary — the Wankel on its own: every catalog rotary as <EngineModel> (which hands it to
 * <RotaryModel>), with the explorer's engine panels. "Open the front" explodes the front cover
 * and end housings away and looks down the e-shaft, so the rotors, their phasing gears and the
 * phase-coloured chambers can be watched in slow motion.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { BottomBar, Button, Dock, Legend, Panel, Select, Slider, Toggle } from '../app/ui';
import { EngineModel } from '../engine3d';
import { EngineControls } from '../explorer/panels/EngineControls';
import { EngineInfo } from '../explorer/panels/EngineInfo';
import { frameObject } from '../scene/CameraRig';
import { getPartObject } from '../scene/registry';
import { engineRuntime } from '../scene/runtime';
import { useScene } from '../scene/store';
import { listEngines } from '../spec/catalog';
import { envelope } from '../spec/derive/envelope';

const rotaries = () => listEngines().filter((e) => e.family === 'rotary');

const useLab = create<{ id: string; balance: boolean }>()(() => ({
  id: rotaries()[0]?.id ?? '',
  balance: false,
}));
const usePicked = () => {
  const id = useLab((s) => s.id);
  return rotaries().find((e) => e.id === id) ?? rotaries()[0];
};

/** Explode that clears the front cover and both end housings but keeps every rotor housed. */
const OPEN = 0.5;

function look(open: boolean) {
  const target = getPartObject('engine/block');
  if (!target) return;
  // down the e-shaft from the front, a little off-axis so the exploded front parts don't block it
  void frameObject(target, {
    azimuth: Math.PI * (open ? 0.33 : 0.3),
    polar: Math.PI * (open ? 0.42 : 0.37),
    padding: open ? 0.15 : 0.45,
  });
}

export function Scene() {
  const e = usePicked();
  const balance = useLab((s) => s.balance);
  useEffect(() => {
    const t = window.setTimeout(() => look(useScene.getState().explode > 0.25), 150);
    return () => window.clearTimeout(t);
  }, [e]);
  if (!e) return null;
  return (
    <group position={[0, 0.35 - envelope(e).min[1] / 1000, 0]}>
      <EngineModel key={e.id} spec={e} idPrefix="engine" showBalance={balance} />
    </group>
  );
}

const CHECKS = [
  'Slow motion 0.5 %: each rotor centre circles the shaft once per shaft turn while the rotor turns a third as fast; its three apexes stay on the peanut-shaped housing.',
  'The internal gear on the rotor rolls round the fixed gear on the side housing (3:2).',
  'Chambers: intake green → compression yellow → combustion flash at the spark plugs → exhaust brown. Rotor 2 fires 180° after rotor 1: a burn every 180° on the firing strip.',
  'Explode: intake/exhaust, front cover and flywheel → end housings → rotor housings slide off → rotors slide off their lobes.',
];

export function Overlay() {
  const e = usePicked();
  const balance = useLab((s) => s.balance);
  const { explode, setExplode, xray, setXray } = useScene();
  const [slow, setSlow] = useState(engineRuntime.timeScale);
  if (!e) {
    return (
      <Dock side="center">
        <Panel title="No rotary in the catalog" />
      </Dock>
    );
  }
  const open = explode > 0.25;
  return (
    <>
      <Dock side="top-left">
        <Panel title="Rotary lab" style={{ width: 320 }}>
          <Select
            label="Engine"
            value={e.id}
            options={rotaries().map((x) => ({ value: x.id, label: x.name }))}
            onChange={(id) => useLab.setState({ id })}
          />
          <div className="apx-row">
            <Button
              onClick={() => {
                setExplode(open ? 0 : OPEN);
                window.setTimeout(() => look(!open), 400);
              }}
            >
              {open ? 'Close it up' : 'Open the front'}
            </Button>
            <Button onClick={() => look(open)}>Reframe</Button>
          </div>
          <Slider
            label="Explode"
            value={explode}
            min={0}
            max={1}
            onChange={setExplode}
            format={(x) => `${Math.round(x * 100)}%`}
          />
          <Slider
            label="Slow motion"
            value={slow}
            min={0.002}
            max={0.25}
            step={0.002}
            format={(x) => `${(x * 100).toFixed(1)}%`}
            onChange={(x) => {
              engineRuntime.timeScale = x;
              setSlow(x);
            }}
          />
          <Toggle label="X-ray castings" checked={xray} onChange={setXray} />
          <Legend systems={['engine', 'intake', 'exhaust', 'combustion']} />
          <ul className="apx-list" style={{ fontSize: 12 }}>
            {CHECKS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Panel>
      </Dock>
      <Dock side="top-right">
        <EngineInfo engine={e} />
      </Dock>
      <BottomBar
        left={
          <Panel>
            <EngineControls
              engine={e}
              balance={balance}
              onBalance={(on) => useLab.setState({ balance: on })}
            />
          </Panel>
        }
      />
    </>
  );
}
