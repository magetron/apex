/**
 * Info card when zoomed into the engine: chips and numbers derived from the
 * spec, a front view of the crank throws against the bank axes, and the free forces/couples.
 */
import { useMemo, type CSSProperties } from 'react';
import { Chips, Panel, Stat, Stats, Tag } from '../../app/ui';
import { ORDER_COLORS } from '../../engine3d/materials';
import { balance } from '../../spec/derive/balance';
import { envelope } from '../../spec/derive/envelope';
import { firingIntervals } from '../../spec/derive/firing';
import { portWindows, trochoid } from '../../spec/derive/rotary';
import { balanceSummary } from '../../spec/describe';
import type { BalanceReport, EngineSpec, Induction, RotaryDef } from '../../spec/types';
import { DEG } from '../../spec/units';
import '../../engine3d/panels.css';

const INDUCTION: Record<Induction, string> = {
  na: 'Naturally aspirated',
  turbo: 'Turbo',
  'twin-turbo': 'Twin-turbo',
  'quad-turbo': 'Quad-turbo',
  supercharged: 'Supercharged',
};

/** Crank seen from the timing end with cylinder 1 at TDC: bank axes dashed, throws solid. */
function CrankStar({ engine: e }: { engine: EngineSpec }) {
  const c = 42;
  const R = 26;
  // +Z appears on the left when looking at the timing end
  const at = (deg: number, r: number) =>
    [c - r * Math.sin(deg * DEG), c - r * Math.cos(deg * DEG)] as const;
  const crank0 = e.cylinders[0].fireDeg;
  const pins = useMemo(() => {
    const m = new Map<number, { angle: number; nums: number[] }>();
    for (const cyl of e.cylinders) {
      const angle = Math.round((cyl.throwDeg - crank0 + 3600) % 360);
      const key = Math.round(angle / 2);
      const entry = m.get(key) ?? { angle, nums: [] };
      entry.nums.push(cyl.num);
      m.set(key, entry);
    }
    return [...m.values()];
  }, [e, crank0]);
  return (
    <svg className="apx-crank" viewBox="0 0 84 84" role="img" aria-label="Crank throws, front view">
      <title>Crank throws seen from the timing end, cylinder 1 at TDC</title>
      <circle className="apx-crank__ring" cx={c} cy={c} r={R} />
      {e.banks.map((b, i) => {
        const [x, y] = at(b.tiltDeg, 40);
        return <line key={i} className="apx-crank__bank" x1={c} y1={c} x2={x} y2={y} />;
      })}
      {pins.map((p) => {
        const [x, y] = at(p.angle, R - 4);
        const [tx, ty] = at(p.angle, R + 9);
        return (
          <g key={p.angle}>
            <line className="apx-crank__throw" x1={c} y1={c} x2={x} y2={y} />
            <text className="apx-crank__num" x={tx} y={ty}>
              {p.nums.join('·')}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * A rotary seen from the front with rotor 1 firing: the housing's epitrochoid, and the
 * eccentric lobes as throws (2 rotors: 180° apart), on the same axes as the crank star.
 */
function RotorStar({ engine: e, r }: { engine: EngineSpec; r: RotaryDef }) {
  const c = 42;
  const s = 34 / (r.generatingRadiusMm + r.eccentricityMm);
  const at = (y: number, z: number) => [c - z * s, c - y * s] as const;
  const outline = Array.from({ length: 96 }, (_, k) =>
    at(...trochoid(r, (2 * Math.PI * k) / 96)).join(','),
  ).join(' ');
  const crank0 = e.cylinders[0].fireDeg;
  const lobe = 2.2 * r.eccentricityMm;
  return (
    <svg
      className="apx-crank"
      viewBox="0 0 84 84"
      role="img"
      aria-label="Rotor housing and lobes, front view"
    >
      <title>Rotor housing and eccentric lobes seen from the front, rotor 1 firing</title>
      <polygon className="apx-crank__ring" points={outline} />
      {e.cylinders.map((cyl) => {
        const a = (cyl.throwDeg - crank0) * DEG;
        const [x, y] = at(lobe * Math.cos(a), lobe * Math.sin(a));
        const [tx, ty] = at(1.9 * lobe * Math.cos(a), 1.9 * lobe * Math.sin(a));
        return (
          <g key={cyl.num}>
            <line className="apx-crank__throw" x1={c} y1={c} x2={x} y2={y} />
            <text className="apx-crank__num" x={tx} y={ty}>
              {cyl.num}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function BalanceBars({ b }: { b: BalanceReport }) {
  const rows = [
    {
      label: '1st force',
      v: b.primary.force,
      rot: b.primary.forceRotating,
      color: ORDER_COLORS.primary,
    },
    {
      label: '1st rock',
      v: b.primary.couple,
      rot: b.primary.coupleRotating,
      color: ORDER_COLORS.primary,
    },
    {
      label: '2nd force',
      v: b.secondary.force,
      rot: b.secondary.forceRotating,
      color: ORDER_COLORS.secondary,
    },
    {
      label: '2nd rock',
      v: b.secondary.couple,
      rot: b.secondary.coupleRotating,
      color: ORDER_COLORS.secondary,
    },
  ];
  const balanced = rows.every((r) => r.v < 0.05);
  return (
    <div
      className="apx-bal"
      title="free forces (× one cylinder) and rocking couples (× force·bore pitch), before counterweights"
    >
      {rows.map((r) => (
        <span key={r.label} style={{ display: 'contents', '--sys': r.color } as CSSProperties}>
          <span>{r.label}</span>
          <span className="apx-bal__track">
            <i className="apx-bal__bar" style={{ width: `${Math.min(100, (r.v / 6) * 100)}%` }} />
          </span>
          <span
            className="apx-bal__val"
            title={
              r.rot && r.v > 0.05
                ? 'rotating: a counterweight or balance shaft can cancel it'
                : undefined
            }
          >
            {r.v < 0.05 ? '0' : r.v.toFixed(1)}
            {r.rot && r.v > 0.05 ? ' ↻' : ''}
          </span>
        </span>
      ))}
      {balanced && <span className="apx-bal__ok">{balanceSummary(b)}</span>}
    </div>
  );
}

const PORT_PLACE = { side: 'Side', peripheral: 'Peripheral' } as const;

/** The firing gaps (°) once round their shortest repeating cycle: "120°", "90/150°". */
function firesEvery(e: EngineSpec): string {
  const gaps = firingIntervals(e).map((g) => Math.round(g));
  const n = gaps.findIndex(
    (_, p) => p > 0 && gaps.length % p === 0 && gaps.every((g, i) => g === gaps[i % p]),
  );
  return `${gaps.slice(0, n > 0 ? n : gaps.length).join('/')}°`;
}

/** A rotary has no bore, stroke or valves: chamber size, trochoid geometry and ports instead. */
function RotaryInfo({ engine: e, r }: { engine: EngineSpec; r: RotaryDef }) {
  const b = useMemo(() => balance(e), [e]);
  const env = useMemo(() => envelope(e), [e]);
  const where = (kind: 'intake' | 'exhaust') =>
    [...new Set(r.ports.filter((p) => p.kind === kind).map((p) => PORT_PLACE[p.location]))].join(
      ' + ',
    );
  const per = (kind: 'intake' | 'exhaust') =>
    r.ports.filter((p) => p.kind === kind).reduce((a, p) => a + p.perRotor, 0);
  const overlap = portWindows(r).overlapDeg;
  const chips: { label: string; system?: 'engine' | 'intake' | 'exhaust'; title?: string }[] = [
    { label: e.layoutLabel, system: 'engine' },
    {
      label: `${where('intake')} intake ×${per('intake')} · ${where('exhaust')} exhaust ×${per('exhaust')} · no valves`,
      system: 'intake',
      title: 'ports per rotor; the rotor flanks open and close them',
    },
    {
      label: overlap > 0 ? `${overlap}° port overlap` : 'No port overlap',
      system: 'exhaust',
      title: 'e-shaft degrees with exhaust and intake open together',
    },
    { label: INDUCTION[e.induction], system: e.induction === 'na' ? 'intake' : 'exhaust' },
  ];
  const n = e.cylinders.length;
  return (
    <Panel title={e.name} actions={<Tag>{n} rotors</Tag>}>
      <Chips items={chips} />
      <Stats>
        <Stat label="Displacement" value={(e.displacementCc / 1000).toFixed(1)} unit="L" />
        <Stat
          label="Chamber"
          value={Math.round(e.displacementCc / n)}
          unit="cc"
          title={`swept by each of a rotor's 3 faces; compression ${r.compressionRatio}:1`}
        />
        <Stat label="Power" value={e.powerKw} unit="kW" />
        <Stat label="Torque" value={e.torqueNm} unit="Nm" />
        <Stat
          label="R × e × width"
          value={`${r.generatingRadiusMm}×${r.eccentricityMm}×${r.rotorWidthMm}`}
          unit="mm"
          title="generating radius (rotor centre to apex) × eccentricity × rotor width"
        />
        <Stat label="Fires every" value={firesEvery(e)} />
        <Stat label="Redline" value={e.redlineRpm} unit="rpm" />
        <Stat label="Mass" value={e.massKg} unit="kg" />
        <Stat
          label="L × W × H"
          value={`${Math.round(env.lengthMm / 10)}×${Math.round(env.widthMm / 10)}×${Math.round(env.heightMm / 10)}`}
          unit="cm"
          title="bare housings, front cover and pan (no intake/exhaust)"
        />
      </Stats>
      <div className="apx-engine-viz">
        <RotorStar engine={e} r={r} />
        <BalanceBars b={b} />
      </div>
      <span className="apx-muted">{e.examples.join(' · ')}</span>
    </Panel>
  );
}

export function EngineInfo({ engine: e }: { engine: EngineSpec }) {
  return e.rotary ? <RotaryInfo engine={e} r={e.rotary} /> : <PistonInfo engine={e} />;
}

function PistonInfo({ engine: e }: { engine: EngineSpec }) {
  const b = useMemo(() => balance(e), [e]);
  const env = useMemo(() => envelope(e), [e]);
  const vt = e.valvetrain;
  const chips: { label: string; system?: 'engine' | 'intake' | 'exhaust'; title?: string }[] = [
    { label: e.layoutLabel, system: 'engine' },
    { label: `${vt.type.toUpperCase()} · ${vt.valvesPerCyl * e.cylinders.length} valves` },
    { label: INDUCTION[e.induction], system: e.induction === 'na' ? 'intake' : 'exhaust' },
  ];
  if (e.geometry.drySump) chips.push({ label: 'Dry sump' });
  const headers = e.sound.headerMm;
  if (Array.isArray(headers) && new Set(headers).size > 1)
    chips.push({ label: 'Unequal-length headers', system: 'exhaust' });
  const ratio = e.boreMm / e.strokeMm;
  return (
    <Panel title={e.name} actions={<Tag>{e.cylinders.length} cyl</Tag>}>
      <Chips items={chips} />
      <Stats>
        <Stat label="Displacement" value={(e.displacementCc / 1000).toFixed(1)} unit="L" />
        <Stat label="Power" value={e.powerKw} unit="kW" />
        <Stat label="Torque" value={e.torqueNm} unit="Nm" />
        <Stat
          label="Bore × stroke"
          value={`${e.boreMm}×${e.strokeMm}`}
          unit="mm"
          title={
            ratio > 1.02
              ? 'oversquare: revs freely'
              : ratio < 0.98
                ? 'undersquare: long stroke, torquey'
                : 'square'
          }
        />
        <Stat label="Fires every" value={firesEvery(e)} />
        <Stat label="Redline" value={e.redlineRpm} unit="rpm" />
        <Stat label="Mass" value={e.massKg} unit="kg" />
        <Stat
          label="L × W × H"
          value={`${Math.round(env.lengthMm / 10)}×${Math.round(env.widthMm / 10)}×${Math.round(env.heightMm / 10)}`}
          unit="cm"
          title="bare block + heads (no intake/exhaust)"
        />
      </Stats>
      <div className="apx-engine-viz">
        <CrankStar engine={e} />
        <BalanceBars b={b} />
      </div>
      <span className="apx-muted">{e.examples.join(' · ')}</span>
    </Panel>
  );
}
