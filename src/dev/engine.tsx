/**
 * #/dev/engine — WP2 sandbox: every catalog engine and EV drive unit as <EngineModel> /
 * <MotorModel>, with the explorer's own engine panels. "Balance trio" lines up I3 · I4 · I6
 * with the shake on: the I3 rocks end to end, the I4 buzzes up and down, the I6 sits still.
 */
import { Html } from '@react-three/drei';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import type { Group } from 'three';
import { create } from 'zustand';
import {
  BottomBar,
  Dock,
  Legend,
  Panel,
  Segmented,
  Select,
  Slider,
  Stat,
  Stats,
  Tag,
  Toggle,
} from '../app/ui';
import { EngineModel, MotorModel, type Lod } from '../engine3d';
import { EngineControls } from '../explorer/panels/EngineControls';
import { EngineInfo } from '../explorer/panels/EngineInfo';
import { frameObject } from '../scene/CameraRig';
import { engineRuntime } from '../scene/runtime';
import { useScene, type LabelMode } from '../scene/store';
import { getEngine, getMotor, listEngines, listMotors } from '../spec/catalog';
import { envelope } from '../spec/derive/envelope';
import { balanceSummary } from '../spec/describe';
import { balance } from '../spec/derive/balance';
import type { EngineSpec, MotorSpec } from '../spec/types';

const TRIO = ['i3', 'i4', 'i6'];
const KEY = 'apex.dev.engine';

interface DevState {
  /** "engine:<id>", "motor:<id>" or "trio" */
  subject: string;
  balance: boolean;
  lod: Lod;
  motorRpm: number;
  set: (p: Partial<Omit<DevState, 'set'>>) => void;
}

function saved(): Partial<DevState> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<DevState>;
  } catch {
    return {};
  }
}

const useDev = create<DevState>()((set, get) => ({
  subject: 'engine:v8-cross',
  balance: false,
  lod: 'high',
  motorRpm: 3000,
  ...saved(),
  set: (p) => {
    set(p);
    const { subject, balance: b, lod, motorRpm } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ subject, balance: b, lod, motorRpm }));
    } catch {
      /* not persisted */
    }
  },
}));

type Picked =
  { kind: 'engine'; spec: EngineSpec } | { kind: 'motor'; spec: MotorSpec } | { kind: 'trio' };

function pick(subject: string): Picked {
  const [kind, id] = subject.split(':');
  try {
    if (kind === 'engine') return { kind, spec: getEngine(id) };
    if (kind === 'motor') return { kind, spec: getMotor(id) };
  } catch {
    /* stale saved id: fall back */
  }
  return subject === 'trio' ? { kind: 'trio' } : { kind: 'engine', spec: getEngine('v8-cross') };
}

/** Lift an engine so its sump clears the floor with room for the crank to drop on explode. */
const liftFor = (e: EngineSpec) => 0.35 - envelope(e).min[1] / 1000;

export function Scene() {
  const { subject, balance: showBalance, lod, motorRpm } = useDev();
  const picked = pick(subject);
  const ref = useRef<Group>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (ref.current)
        void frameObject(ref.current, {
          azimuth: Math.PI * 0.3,
          polar: Math.PI * 0.37,
          padding: 0.3,
        });
    }, 120);
    return () => window.clearTimeout(t);
  }, [subject, lod]);

  const trio = useMemo(() => TRIO.map((id) => getEngine(id)), []);

  return (
    <group ref={ref}>
      {picked.kind === 'engine' && (
        <group position={[0, liftFor(picked.spec), 0]}>
          <EngineModel
            key={picked.spec.id}
            spec={picked.spec}
            idPrefix="engine"
            lod={lod}
            showBalance={showBalance}
          />
        </group>
      )}
      {picked.kind === 'motor' && (
        <group position={[0, 0.3 + picked.spec.diameterMm / 2000, 0]}>
          <MotorModel
            key={picked.spec.id}
            spec={picked.spec}
            idPrefix="motor"
            lod={lod}
            rpm={motorRpm}
          />
        </group>
      )}
      {picked.kind === 'trio' &&
        trio.map((e, k) => (
          <group key={e.id} position={[0, liftFor(e), (k - 1) * 0.62]}>
            <EngineModel spec={e} idPrefix={`trio-${e.id}`} lod={lod} showBalance={showBalance} />
            <Html
              position={[0, envelope(e).max[1] / 1000 + 0.08, 0]}
              center
              style={{ pointerEvents: 'none' }}
            >
              <div
                className="apx-label"
                style={{ transform: 'translate(-50%, -100%)', '--sys': '#f4a261' } as CSSProperties}
              >
                <span className="apx-label__dot" />
                {e.name} · {balanceSummary(balance(e))}
              </div>
            </Html>
          </group>
        ))}
    </group>
  );
}

function MotorInfo({ m }: { m: MotorSpec }) {
  return (
    <Panel title={m.name} actions={<Tag>{m.kind.toUpperCase()}</Tag>}>
      <Stats>
        <Stat label="Peak" value={m.peakKw} unit="kW" />
        <Stat label="Torque" value={m.peakNm} unit="Nm" />
        <Stat label="Max" value={m.maxRpm} unit="rpm" />
        <Stat label="Reduction" value={`${m.reduction}:1`} />
        <Stat label="Mass" value={m.massKg} unit="kg" />
        <Stat label="Pole pairs" value={m.sound.polePairs} />
      </Stats>
      <span className="apx-muted">{m.examples.join(' · ')}</span>
    </Panel>
  );
}

const CHECKS = [
  'Explode 0→100 %: heads lift along their bank axes → cams & valves → pistons and rods slide out of the bores (sump drops) → crank and flywheel drop.',
  'Balance trio + Balance on: I3 rocks end to end, I4 buzzes vertically at 2× crank speed, I6 is dead still.',
  'VR6: one head over two staggered rows · W12/W16: two VR heads · v6-120: turbos in the vee.',
  'flat4: unequal header loops · v8-cross: one cam in the block with pushrods · Scrub the firing strip to turn the crank.',
];

export function Overlay() {
  const dev = useDev();
  const picked = pick(dev.subject);
  const { explode, setExplode, labels, setLabels, xray, setXray } = useScene();
  const options = [
    ...listEngines().map((e) => ({ value: `engine:${e.id}`, label: `${e.name} (${e.id})` })),
    ...listMotors().map((m) => ({ value: `motor:${m.id}`, label: `EV · ${m.name}` })),
    { value: 'trio', label: 'Balance trio: I3 · I4 · I6' },
  ];
  const engineForControls =
    picked.kind === 'engine' ? picked.spec : picked.kind === 'trio' ? getEngine('i4') : null;
  return (
    <>
      <Dock side="top-left">
        <Panel title="Engine lab · WP2" style={{ width: 320 }}>
          <Select
            label="Subject"
            value={dev.subject}
            options={options}
            onChange={(subject) => dev.set({ subject })}
          />
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
          <Toggle label="X-ray castings" checked={xray} onChange={setXray} />
          <Toggle
            label="Low detail (in-car LOD)"
            checked={dev.lod === 'low'}
            onChange={(on) => dev.set({ lod: on ? 'low' : 'high' })}
          />
          {picked.kind === 'motor' && (
            <Slider
              label="Motor speed"
              value={dev.motorRpm}
              min={0}
              max={picked.spec.maxRpm}
              step={100}
              format={(x) => `${Math.round(x)} rpm`}
              onChange={(motorRpm) => dev.set({ motorRpm })}
            />
          )}
          <Legend
            systems={[
              'engine',
              'combustion',
              'intake',
              'exhaust',
              'motor',
              'gearbox',
              'diff',
              'shaft',
            ]}
          />
          <ul className="apx-list" style={{ fontSize: 12 }}>
            {CHECKS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Panel>
      </Dock>
      <Dock side="top-right">
        {picked.kind === 'engine' && <EngineInfo engine={picked.spec} />}
        {picked.kind === 'trio' && <EngineInfo engine={getEngine('i3')} />}
        {picked.kind === 'motor' && <MotorInfo m={picked.spec} />}
      </Dock>
      <BottomBar
        left={
          <Panel>
            {engineForControls ? (
              <EngineControls
                engine={engineForControls}
                balance={dev.balance}
                onBalance={(on) => dev.set({ balance: on })}
              />
            ) : (
              <Slider
                label="Slow motion"
                value={engineRuntime.timeScale}
                min={0.005}
                max={0.25}
                step={0.005}
                format={(x) => `${(x * 100).toFixed(1)}%`}
                onChange={(x) => {
                  engineRuntime.timeScale = x;
                  dev.set({});
                }}
              />
            )}
          </Panel>
        }
      />
    </>
  );
}
