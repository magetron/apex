/**
 * Info card when zoomed into the engine: what it is, its firing order, and how smooth it runs (a
 * front view of the crank throws against the bank axes beside the free forces and couples), all
 * derived from the spec. The rest of the numbers fold under Specs.
 */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Chips, Panel, Stat, Stats, Tag } from '../../app/ui';
import { findTerm } from '../../content/glossary';
import { ORDER_COLORS } from '../../engine3d/materials';
import { balance } from '../../spec/derive/balance';
import { envelope } from '../../spec/derive/envelope';
import { firingIntervals } from '../../spec/derive/firing';
import { portWindows, trochoid } from '../../spec/derive/rotary';
import { balanceSummary } from '../../spec/describe';
import type {
  BalanceOrder,
  BalanceReport,
  EngineSpec,
  Induction,
  RotaryDef,
} from '../../spec/types';
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

/** the block shaking up and down: a free force (an up-down arrow over and under it) */
const SHAKE = (
  <svg className="apx-bal__icon is-shake" viewBox="0 0 26 22" aria-hidden="true">
    <path d="M13 1.5v5M10.6 3.9L13 1.5l2.4 2.4M13 15.5v5M10.6 18.1l2.4 2.4 2.4-2.4" />
    <rect className="apx-bal__block" x="6" y="8" width="14" height="6" rx="1.2" />
  </svg>
);
/** the block rocking end to end on its middle: a free couple (a rocking arrow over it) */
const ROCK = (
  <svg className="apx-bal__icon is-rock" viewBox="0 0 26 22" aria-hidden="true">
    <path d="M4.5 8.5Q13 0.5 21.5 8.5M4 5.6l.5 2.9 2.9-.3M22 5.6l-.5 2.9-2.9-.3" />
    <rect className="apx-bal__block" x="5" y="11" width="16" height="5" rx="1.2" />
    <path d="M13 16.5l-2 3.5h4z" />
  </svg>
);

/** a free force or couple this small is nothing (an even-firing flat-6, an I6) */
const NIL = 0.05;

/**
 * The free forces (shake) and couples (rock) before any balance shaft, once and twice a turn
 * (1st and 2nd order): a row per motion with its picture, which moves only when the engine does,
 * a column per order in its colour (the 3D arrows' colours), a bar each, 0 = smooth.
 */
function BalanceBars({ b }: { b: BalanceReport }) {
  const orders = [
    { key: 'primary', label: '1st', o: b.primary, color: ORDER_COLORS.primary },
    { key: 'secondary', label: '2nd', o: b.secondary, color: ORDER_COLORS.secondary },
  ] as const;
  const motions = [
    {
      key: 'shake',
      icon: SHAKE,
      name: 'Shake',
      v: (o: BalanceOrder) => o.force,
      rot: (o: BalanceOrder) => o.forceRotating,
    },
    {
      key: 'rock',
      icon: ROCK,
      name: 'Rock',
      v: (o: BalanceOrder) => o.couple,
      rot: (o: BalanceOrder) => o.coupleRotating,
    },
  ] as const;
  return (
    <div
      className="apx-bal"
      role="group"
      title="Free forces and couples, before balance shafts"
      aria-label={balanceSummary(b)}
    >
      <span aria-hidden />
      {orders.map((r) => (
        <span
          key={r.key}
          className="apx-bal__order"
          style={{ '--sys': r.color } as CSSProperties}
          title={r.key === 'primary' ? 'Once a turn' : 'Twice a turn'}
        >
          {r.label}
        </span>
      ))}
      {motions.map((m) => {
        const live = orders.some((r) => m.v(r.o) >= NIL);
        return (
          <span key={m.key} style={{ display: 'contents' }}>
            <span
              className={live ? 'apx-bal__key is-live' : 'apx-bal__key'}
              role="img"
              title={m.name}
              aria-label={m.name}
            >
              {m.icon}
            </span>
            {orders.map((r) => {
              const v = m.v(r.o);
              const rot = m.rot(r.o) && v >= NIL;
              return (
                <span
                  key={r.key}
                  className="apx-bal__cell"
                  style={{ '--sys': r.color } as CSSProperties}
                >
                  <span className="apx-bal__track">
                    <i
                      className="apx-bal__bar"
                      style={{ width: `${Math.min(100, (v / 6) * 100)}%` }}
                    />
                  </span>
                  <span
                    className="apx-bal__val"
                    title={rot ? 'Rotating: a counterweight cancels it' : undefined}
                  >
                    {v < NIL ? '0' : v.toFixed(1)}
                    {rot ? '↻' : ''}
                  </span>
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The layout as a chip, from the cylinders and banks: "Flat-6", "V8 90°", "Inline-4", "2-rotor".
 * The spec's own line runs to a sentence ("Inline-4, flat (180°) crank, twin balance shafts"):
 * it is the chip's tooltip, with the two meanings of "flat" kept apart (a flat-plane crank, an
 * inline-4's 180°, is not a flat engine). The crank itself is the picture under Smoothness.
 */
function layoutChip(e: EngineSpec): { label: string; title: string } {
  const n = e.cylinders.length;
  const tilts = e.banks.map((b) => b.tiltDeg);
  const vee = Math.round(Math.max(...tilts) - Math.min(...tilts));
  const label =
    e.family === 'inline'
      ? `Inline-${n}`
      : e.family === 'flat'
        ? `Flat-${n}`
        : e.family === 'v' || e.family === 'vr'
          ? `${e.family.toUpperCase()}${n} ${vee}°`
          : e.family === 'w'
            ? `W${n}`
            : `${n}-rotor`;
  return { label, title: e.layoutLabel.replace('flat (180°) crank', 'flat-plane (180°) crank') };
}

/** the valvetrain chip's tooltip */
const VALVETRAIN: Record<string, string> = {
  dohc: 'Twin overhead camshafts',
  sohc: 'Single overhead camshaft',
  ohv: 'Pushrods, cam in the block',
};

const PORT_PLACE = { side: 'Side', peripheral: 'Peripheral' } as const;

/** The firing gaps (°) once round their shortest repeating cycle: "120°", "90/150°". */
function firesEvery(e: EngineSpec): string {
  const gaps = firingIntervals(e).map((g) => Math.round(g));
  const n = gaps.findIndex(
    (_, p) => p > 0 && gaps.length % p === 0 && gaps.every((g, i) => g === gaps[i % p]),
  );
  return `${gaps.slice(0, n > 0 ? n : gaps.length).join('/')}°`;
}

/**
 * What the card shows first, for any engine: what it is (layout, induction), the order it fires
 * in and how often, and how smooth it runs (the crank or rotor picture beside the shake and rock
 * of each order). The rest of the numbers fold away under Specs.
 */
function EngineCard({
  engine: e,
  tag,
  chips,
  picture,
  specChips,
  specs,
}: {
  engine: EngineSpec;
  tag: string;
  chips: ChipItem[];
  picture: ReactNode;
  specChips: ChipItem[];
  specs: ReactNode;
}) {
  const b = useMemo(() => balance(e), [e]);
  return (
    <Panel title={e.name} actions={<Tag>{tag}</Tag>}>
      <Chips items={chips} />
      {/* (a V12's order runs long: it wraps, beside the gap) */}
      <div className="apx-stats apx-engine-firing">
        <Stat label="Firing order" value={e.firingOrder.join('-')} />
        <Stat label="Fires every" value={firesEvery(e)} />
      </div>
      <div className="apx-engine-viz" role="group" aria-label="Smoothness">
        {picture}
        <BalanceBars b={b} />
      </div>
      <details className="apx-more">
        <summary>Specs</summary>
        <div className="apx-more__body">
          {specChips.length > 0 && <Chips items={specChips} />}
          <Stats>{specs}</Stats>
        </div>
      </details>
    </Panel>
  );
}

type ChipItem = { label: string; system?: 'engine' | 'intake' | 'exhaust'; title?: string };

const induction = (e: EngineSpec): ChipItem => ({
  label: INDUCTION[e.induction],
  system: e.induction === 'na' ? 'intake' : 'exhaust',
});

const bareEngine = (e: EngineSpec, title: string) => {
  const env = envelope(e);
  return (
    <Stat
      label="Bare engine"
      value={`${Math.round(env.lengthMm)}×${Math.round(env.widthMm)}×${Math.round(env.heightMm)}`}
      unit="mm"
      title={title}
    />
  );
};

/** A rotary has no bore, stroke or valves: chamber size, trochoid geometry and ports instead. */
function RotaryInfo({ engine: e, r }: { engine: EngineSpec; r: RotaryDef }) {
  const where = (kind: 'intake' | 'exhaust') =>
    [...new Set(r.ports.filter((p) => p.kind === kind).map((p) => PORT_PLACE[p.location]))].join(
      ' + ',
    );
  const per = (kind: 'intake' | 'exhaust') =>
    r.ports.filter((p) => p.kind === kind).reduce((a, p) => a + p.perRotor, 0);
  const overlap = portWindows(r).overlapDeg;
  const n = e.cylinders.length;
  return (
    <EngineCard
      engine={e}
      tag={`${n} rotors`}
      chips={[{ ...layoutChip(e), system: 'engine' }, induction(e)]}
      picture={<RotorStar engine={e} r={r} />}
      specChips={[
        {
          label: `${where('intake')} intake ×${per('intake')}`,
          system: 'intake',
          title: 'Ports per rotor',
        },
        {
          label: `${where('exhaust')} exhaust ×${per('exhaust')}`,
          system: 'exhaust',
          title: 'Ports per rotor',
        },
        { label: `${overlap}° overlap`, system: 'exhaust', title: 'Port overlap, e-shaft degrees' },
      ]}
      specs={
        <>
          <Stat label="Displacement" value={(e.displacementCc / 1000).toFixed(1)} unit="L" />
          <Stat
            label="Chamber"
            value={Math.round(e.displacementCc / n)}
            unit="cc"
            title={`Per rotor face, ${r.compressionRatio}:1`}
          />
          <Stat label="Power" value={e.powerKw} unit="kW" />
          <Stat label="Torque" value={e.torqueNm} unit="Nm" />
          <Stat
            label="R × e × width"
            value={`${r.generatingRadiusMm}×${r.eccentricityMm}×${r.rotorWidthMm}`}
            unit="mm"
            title="Generating radius × eccentricity × width"
          />
          <Stat label="Redline" value={e.redlineRpm} unit="rpm" />
          <Stat label="Mass" value={e.massKg} unit="kg" />
          {bareEngine(e, 'Housings alone, L × W × H')}
        </>
      }
    />
  );
}

export function EngineInfo({ engine: e }: { engine: EngineSpec }) {
  return e.rotary ? <RotaryInfo engine={e} r={e.rotary} /> : <PistonInfo engine={e} />;
}

function PistonInfo({ engine: e }: { engine: EngineSpec }) {
  const vt = e.valvetrain;
  const specChips: ChipItem[] = [
    {
      label: `${vt.type.toUpperCase()} · ${vt.valvesPerCyl * e.cylinders.length} valves`,
      title: VALVETRAIN[vt.type],
    },
  ];
  if (e.geometry.drySump) specChips.push({ label: 'Dry sump', title: findTerm('Dry sump')?.short });
  const headers = e.sound.headerMm;
  if (Array.isArray(headers) && new Set(headers).size > 1)
    specChips.push({
      label: 'Unequal-length headers',
      system: 'exhaust',
      title: findTerm('Unequal-length headers')?.short,
    });
  const ratio = e.boreMm / e.strokeMm;
  return (
    <EngineCard
      engine={e}
      tag={`${e.cylinders.length} cyl`}
      chips={[{ ...layoutChip(e), system: 'engine' }, induction(e)]}
      picture={<CrankStar engine={e} />}
      specChips={specChips}
      specs={
        <>
          <Stat label="Displacement" value={(e.displacementCc / 1000).toFixed(1)} unit="L" />
          <Stat label="Power" value={e.powerKw} unit="kW" />
          <Stat label="Torque" value={e.torqueNm} unit="Nm" />
          <Stat
            label="Bore × stroke"
            value={`${e.boreMm}×${e.strokeMm}`}
            unit="mm"
            title={ratio > 1.02 ? 'Oversquare' : ratio < 0.98 ? 'Undersquare' : 'Square'}
          />
          <Stat label="Redline" value={e.redlineRpm} unit="rpm" />
          <Stat label="Mass" value={e.massKg} unit="kg" />
          {bareEngine(e, 'Block and heads, L × W × H')}
        </>
      }
    />
  );
}
