/**
 * Sim sandbox (#/dev/sim): run any cars through a scenario headless and compare — a table of
 * the scenario's numbers, the paths from above, a signal over time and, on the skidpad, the
 * understeer-gradient plot (extra steering vs lateral g).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Panel, Segmented, Slider, Toggle } from '../app/ui';
import { useTheme, type Theme } from '../scene/theme';
import { carParams, G, lateralLimit } from '../sim/model';
import {
  METRICS,
  runHeadless,
  SCENARIO_IDS,
  SCENARIOS,
  type MetricId,
  type Plan,
  type ScenarioResult,
  type Trace,
} from '../sim/scenarios';
import { findVehicle, listVehicles } from '../spec/catalog';
import { layoutCode } from '../spec/describe';
import type { VehicleSpec } from '../spec/types';
import type { DriveScenario } from '../content/types';

/** Categorical slots (validated palette), light and dark steps. A car keeps its slot. */
const SLOTS: Record<Theme, string[]> = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};
const DEFAULT_CARS = [
  'vw-golf-gti-mk8',
  'bmw-m340i-g20',
  'porsche-911-992',
  'audi-r8-v10-gen2',
  'tesla-model3-awd',
];

type Signal = 'r' | 'ay' | 'beta' | 'steer' | 'v' | 'useF' | 'useR';
const SIGNALS: {
  value: Signal;
  label: string;
  unit: string;
  f: (tr: Trace, i: number) => number;
}[] = [
  { value: 'r', label: 'Yaw rate', unit: '°/s', f: (tr, i) => (tr.r[i] * 180) / Math.PI },
  { value: 'ay', label: 'Lateral', unit: 'g', f: (tr, i) => tr.ay[i] },
  { value: 'beta', label: 'Body slip', unit: '°', f: (tr, i) => (tr.beta[i] * 180) / Math.PI },
  { value: 'steer', label: 'Steer', unit: '°', f: (tr, i) => (tr.steer[i] * 180) / Math.PI },
  { value: 'v', label: 'Speed', unit: 'km/h', f: (tr, i) => tr.v[i] * 3.6 },
  { value: 'useF', label: 'Front grip', unit: '', f: (tr, i) => tr.useF[i] },
  { value: 'useR', label: 'Rear grip', unit: '', f: (tr, i) => tr.useR[i] },
];

interface Run {
  v: VehicleSpec;
  slot: number;
  limitG: number;
  trace: Trace;
  result: ScenarioResult;
}

function niceTicks(lo: number, hi: number, n = 5): number[] {
  const span = hi - lo || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(+t.toFixed(10));
  return out;
}

interface Series {
  id: string;
  label: string;
  color: string;
  xs: number[];
  ys: number[];
}

/** Line chart with one y-axis, recessive grid, legend, and a crosshair tooltip (xs sorted). */
function LineChart({
  series,
  xLabel,
  yUnit,
  height = 220,
  hover = true,
}: {
  series: Series[];
  xLabel: string;
  yUnit: string;
  height?: number;
  hover?: boolean;
}) {
  const W = 640;
  const H = height;
  const m = { l: 44, r: 12, t: 10, b: 28 };
  const [hx, setHx] = useState<number | null>(null);
  const dom = useMemo(() => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const s of series)
      for (let i = 0; i < s.xs.length; i++) {
        if (!Number.isFinite(s.ys[i])) continue;
        x0 = Math.min(x0, s.xs[i]);
        x1 = Math.max(x1, s.xs[i]);
        y0 = Math.min(y0, s.ys[i]);
        y1 = Math.max(y1, s.ys[i]);
      }
    if (!Number.isFinite(x0)) return null;
    const pad = (y1 - y0) * 0.06 || 1;
    return { x0, x1, y0: y0 - pad, y1: y1 + pad };
  }, [series]);
  if (!dom) return <span className="apx-muted">No data</span>;
  const sx = (x: number) => m.l + ((x - dom.x0) / (dom.x1 - dom.x0 || 1)) * (W - m.l - m.r);
  const sy = (y: number) => H - m.b - ((y - dom.y0) / (dom.y1 - dom.y0 || 1)) * (H - m.t - m.b);
  const xt = niceTicks(dom.x0, dom.x1, 6);
  const yt = niceTicks(dom.y0, dom.y1, 4);
  const near = (s: Series, x: number) => {
    let lo = 0;
    let hi = s.xs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (s.xs[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`${xLabel} chart`}
        onMouseMove={
          hover
            ? (e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const px = ((e.clientX - r.left) / r.width) * W;
                setHx(dom.x0 + ((px - m.l) / (W - m.l - m.r)) * (dom.x1 - dom.x0));
              }
            : undefined
        }
        onMouseLeave={() => setHx(null)}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line
              x1={m.l}
              x2={W - m.r}
              y1={sy(t)}
              y2={sy(t)}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text x={m.l - 6} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-faint)">
              {t}
            </text>
          </g>
        ))}
        {xt.map((t) => (
          <text
            key={`x${t}`}
            x={sx(t)}
            y={H - m.b + 16}
            textAnchor="middle"
            fontSize={11}
            fill="var(--text-faint)"
          >
            {t}
          </text>
        ))}
        <text x={W - m.r} y={H - 2} textAnchor="end" fontSize={11} fill="var(--text-muted)">
          {xLabel}
        </text>
        <text x={4} y={m.t + 2} fontSize={11} fill="var(--text-muted)">
          {yUnit}
        </text>
        {series.map((s) => (
          <polyline
            key={s.id}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            points={s.xs
              .map((x, i) =>
                Number.isFinite(s.ys[i]) ? `${sx(x).toFixed(1)},${sy(s.ys[i]).toFixed(1)}` : '',
              )
              .join(' ')}
          />
        ))}
        {hx !== null && hx >= dom.x0 && hx <= dom.x1 && (
          <g>
            <line
              x1={sx(hx)}
              x2={sx(hx)}
              y1={m.t}
              y2={H - m.b}
              stroke="var(--text-faint)"
              strokeWidth={1}
            />
            {series.map((s) => {
              const i = near(s, hx);
              return Number.isFinite(s.ys[i]) ? (
                <circle
                  key={s.id}
                  cx={sx(s.xs[i])}
                  cy={sy(s.ys[i])}
                  r={4}
                  fill={s.color}
                  stroke="var(--bg-solid)"
                  strokeWidth={2}
                />
              ) : null;
            })}
          </g>
        )}
      </svg>
      {hx !== null && hx >= dom.x0 && hx <= dom.x1 && (
        <div
          className="apx-panel"
          style={{
            position: 'absolute',
            top: 4,
            left: `${(sx(hx) / W) * 100 > 60 ? 4 : 62}%`,
            padding: 8,
            gap: 2,
            fontSize: 12,
            pointerEvents: 'none',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            {xLabel} {hx.toFixed(2)}
          </span>
          {series.map((s) => {
            const i = near(s, hx);
            return (
              <span key={s.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <i style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                {s.label}
                <b style={{ marginLeft: 'auto', fontFamily: 'var(--mono)' }}>
                  {Number.isFinite(s.ys[i]) ? s.ys[i].toFixed(2) : '–'}
                </b>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Legend({ runs, colors }: { runs: Run[]; colors: string[] }) {
  return (
    <div className="apx-legend">
      {runs.map((r) => (
        <span key={r.v.id} style={{ '--sys': colors[r.slot] } as React.CSSProperties}>
          <i />
          {layoutCode(r.v)} · {r.v.name}
        </span>
      ))}
    </div>
  );
}

/** Paths from above, equal scale, x right and the car's left up. */
function PathPlot({ plan, runs, colors }: { plan: Plan; runs: Run[]; colors: string[] }) {
  const bounds = useMemo(() => {
    let x0 = Infinity;
    let x1 = -Infinity;
    let n0 = Infinity;
    let n1 = -Infinity;
    const add = (x: number, n: number) => {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      n0 = Math.min(n0, n);
      n1 = Math.max(n1, n);
    };
    for (let i = 0; i < plan.road.count; i += 4) add(plan.road.xs[i], plan.road.ns[i]);
    for (const r of runs)
      for (let i = 0; i < r.trace.x.length; i += 6) add(r.trace.x[i], r.trace.n[i]);
    const pad = 4;
    return { x0: x0 - pad, x1: x1 + pad, n0: n0 - pad, n1: n1 + pad };
  }, [plan, runs]);
  const w = bounds.x1 - bounds.x0;
  const h = bounds.n1 - bounds.n0;
  const pts = (xs: ArrayLike<number>, ns: ArrayLike<number>, step: number) => {
    const out: string[] = [];
    for (let i = 0; i < xs.length; i += step)
      out.push(`${xs[i].toFixed(2)},${(-ns[i]).toFixed(2)}`);
    return out.join(' ');
  };
  return (
    <svg
      viewBox={`${bounds.x0} ${-bounds.n1} ${w} ${h}`}
      width="100%"
      style={{ maxHeight: 320, display: 'block' }}
      role="img"
      aria-label="Paths seen from above"
    >
      <polyline
        fill="none"
        stroke="var(--line-strong)"
        strokeWidth={plan.roadWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts(plan.road.xs, plan.road.ns, 2)}
        opacity={0.5}
      />
      <polyline
        fill="none"
        stroke="var(--text-faint)"
        strokeWidth={0.15}
        strokeDasharray="1 1"
        points={pts(plan.path.xs, plan.path.ns, 2)}
      />
      {runs.map((r) => (
        <polyline
          key={r.v.id}
          fill="none"
          stroke={colors[r.slot]}
          strokeWidth={0.35}
          strokeLinejoin="round"
          points={pts(r.trace.x, r.trace.n, 3)}
        />
      ))}
    </svg>
  );
}

const fmt = (id: MetricId, x: number | undefined) => {
  if (x === undefined || !Number.isFinite(x)) return '–';
  if (id === 'limitAxle') return x > 0 ? 'front' : x < 0 ? 'rear' : '–';
  return x.toFixed(METRICS[id].digits);
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <Panel title={title}>{children}</Panel>;
}

export function Overlay() {
  const theme = useTheme((s) => s.theme);
  const colors = SLOTS[theme];
  const [scenario, setScenario] = useState<DriveScenario>('lift-off');
  const [kmh, setKmh] = useState<Record<DriveScenario, number>>(
    () =>
      Object.fromEntries(SCENARIO_IDS.map((id) => [id, SCENARIOS[id].speed.def])) as Record<
        DriveScenario,
        number
      >,
  );
  const [esc, setEsc] = useState(false);
  const [neutral, setNeutral] = useState(false);
  const [signal, setSignal] = useState<Signal>('r');
  // car id → palette slot; a car keeps its colour while others come and go
  const [picked, setPicked] = useState<Record<string, number>>(() =>
    Object.fromEntries(DEFAULT_CARS.filter((id) => findVehicle(id)).map((id, i) => [id, i])),
  );
  const [runs, setRuns] = useState<Run[] | null>(null);
  const def = SCENARIOS[scenario];
  const plan = useMemo(() => def.plan(kmh[scenario]), [def, kmh, scenario]);

  useEffect(() => {
    setRuns(null);
    const t = window.setTimeout(() => {
      const out: Run[] = [];
      for (const [id, slot] of Object.entries(picked)) {
        const base = findVehicle(id);
        if (!base) continue;
        // "layout only": a neutral chassis on one tyre width front and rear
        const w = (base.tires.widthFMm + base.tires.widthRMm) / 2;
        const v = neutral ? { ...base, tires: { ...base.tires, widthFMm: w, widthRMm: w } } : base;
        const p = carParams(v, { neutral });
        const { trace, result } = runHeadless(p, plan, { esc });
        out.push({ v: base, slot, limitG: lateralLimit(p) / G, trace, result });
      }
      setRuns(out);
    }, 120);
    return () => window.clearTimeout(t);
  }, [picked, plan, esc, neutral]);

  const toggle = (id: string) =>
    setPicked((cur) => {
      if (id in cur) {
        const next = { ...cur };
        delete next[id];
        return next;
      }
      const used = new Set(Object.values(cur));
      const slot = [...Array(SLOTS.light.length).keys()].find((k) => !used.has(k));
      return slot === undefined ? cur : { ...cur, [id]: slot };
    });

  const sig = SIGNALS.find((s) => s.value === signal)!;
  const metricIds = runs?.length ? (Object.keys(runs[0].result.values) as MetricId[]) : [];
  const L = (v: VehicleSpec) => v.dims.wheelbaseMm / 1000;

  return (
    <div
      className="apx-dock"
      style={{
        inset: 'var(--gutter)',
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 320px) 1fr',
        gap: 'var(--gap)',
        alignItems: 'start',
      }}
    >
      <Card title="Handling sim">
        <Segmented
          label="Scenario"
          value={scenario}
          onChange={setScenario}
          options={SCENARIO_IDS.map((id) => ({
            value: id,
            label: SCENARIOS[id].short,
            title: SCENARIOS[id].title,
          }))}
        />
        <Slider
          label={def.speed.label}
          value={kmh[scenario]}
          min={def.speed.min}
          max={def.speed.max}
          step={1}
          onChange={(x) => setKmh({ ...kmh, [scenario]: x })}
          format={(x) => `${Math.round(x)} km/h`}
        />
        <Toggle label="Stability control" checked={esc} onChange={setEsc} />
        <Toggle
          label="Layout only (neutral chassis, equal tyres)"
          checked={neutral}
          onChange={setNeutral}
        />
        <div className="apx-field">
          <span>Cars ({Object.keys(picked).length}/8)</span>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              maxHeight: 360,
              overflowY: 'auto',
            }}
          >
            {listVehicles().map((v) => (
              <label key={v.id} className="apx-toggle" style={{ justifyContent: 'flex-start' }}>
                <input type="checkbox" checked={v.id in picked} onChange={() => toggle(v.id)} />
                <i
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: v.id in picked ? colors[picked[v.id]] : 'transparent',
                  }}
                />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, minWidth: 48 }}>
                  {layoutCode(v)}
                </span>
                {v.name}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', minWidth: 0 }}>
        {!runs ? (
          <Card title={def.label}>
            <span className="apx-muted">Running…</span>
          </Card>
        ) : (
          <>
            <Card title={`${def.label} · ${kmh[scenario]} km/h`}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: 'var(--text-faint)', textAlign: 'right' }}>
                    <th style={{ textAlign: 'left', fontWeight: 500 }}>Car</th>
                    <th style={{ fontWeight: 500 }}>Limit g</th>
                    {metricIds.map((id) => (
                      <th key={id} style={{ fontWeight: id === def.headline ? 700 : 500 }}>
                        {METRICS[id].label}
                        {METRICS[id].unit ? ` (${METRICS[id].unit})` : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.v.id} style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      <td
                        style={{ textAlign: 'left', fontFamily: 'var(--font)', padding: '3px 0' }}
                      >
                        <i
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            marginRight: 6,
                            background: colors[r.slot],
                          }}
                        />
                        {layoutCode(r.v)} · {r.v.name}
                        {r.result.spun ? ' · spun' : ''}
                      </td>
                      <td>{r.limitG.toFixed(2)}</td>
                      {metricIds.map((id) => (
                        <td key={id}>{fmt(id, r.result.values[id])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="From above">
              <Legend runs={runs} colors={colors} />
              <PathPlot plan={plan} runs={runs} colors={colors} />
            </Card>
            <Card title={`${sig.label} over time`}>
              <Segmented
                label="Signal"
                value={signal}
                onChange={setSignal}
                options={SIGNALS.map((s) => ({ value: s.value, label: s.label }))}
              />
              <LineChart
                xLabel="t (s)"
                yUnit={sig.unit}
                series={runs.map((r) => ({
                  id: r.v.id,
                  label: layoutCode(r.v),
                  color: colors[r.slot],
                  xs: r.trace.t,
                  ys: r.trace.t.map((_, i) => sig.f(r.trace, i)),
                }))}
              />
            </Card>
            {scenario === 'skidpad' && (
              <Card title="Extra steering vs lateral g (slope = understeer gradient)">
                <LineChart
                  xLabel="lateral g"
                  yUnit="°"
                  series={runs.map((r) => {
                    // binned so the line reads left to right as the speed ramps up
                    const bins = new Map<number, number[]>();
                    const tr = r.trace;
                    for (let i = 0; i < tr.t.length; i++) {
                      if (tr.t[i] < 2 || tr.phase[i] !== 0 || tr.v[i] < 3) continue;
                      const b = Math.round(tr.ay[i] * 50) / 50;
                      const extra = ((tr.steer[i] - (L(r.v) * tr.r[i]) / tr.v[i]) * 180) / Math.PI;
                      const bin = bins.get(b);
                      if (bin) bin.push(extra);
                      else bins.set(b, [extra]);
                    }
                    const xs = [...bins.keys()].sort((a, b) => a - b);
                    return {
                      id: r.v.id,
                      label: layoutCode(r.v),
                      color: colors[r.slot],
                      xs,
                      ys: xs.map((x) => {
                        const v = bins.get(x)!;
                        return v.reduce((s, y) => s + y, 0) / v.length;
                      }),
                    };
                  })}
                />
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
