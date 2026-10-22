/**
 * #/dev/drive — every scenario at once, for one car and the stand-ins of the other layouts, in
 * the hub's order: the question it answers, its corner from above with every car's line through
 * the event (the same picture as the drive mode's overhead view), the takeaway the drive mode
 * shows at the end of the run (the lesson and a line per car, derived from these results), and
 * the numbers behind it. Click a question to open it in the explorer's drive mode.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { href } from '../app/routes';
import { Panel, Select } from '../app/ui';
import { DRIVE_COLORS } from '../explorer/drive/colors';
import { Lane } from '../explorer/drive/lanes';
import { buildLineup, laneColor, laneResult } from '../explorer/drive/lineup';
import { useDrive } from '../explorer/drive/state';
import { carLine, lesson, toneOf } from '../explorer/drive/takeaway';
import { viewPath } from '../explorer/view';
import { useTheme } from '../scene/theme';
import { HUB_ORDER, METRICS, SCENARIOS, VERDICTS, type ScenarioId } from '../sim/scenarios';
import { getVehicle, listVehicles } from '../spec/catalog';
import '../explorer/drive/drive.css';

const W = 300;
const H = 200;

interface Row {
  id: ScenarioId;
  lanes: Lane[];
  labels: (string | undefined)[];
}

/** Every lane's CG line around the event, fitted into the SVG. */
function Lines({ row }: { row: Row }) {
  const theme = useTheme((s) => s.theme);
  const colors = DRIVE_COLORS[theme];
  const main = row.lanes[0];
  const plan = main.plan;
  const [s0, s1] = plan.overview;
  const pts = row.lanes.map((l) => {
    const out: [number, number][] = [];
    for (let i = 0; i < l.rec.count; i++) {
      const s = l.rec.sAt(i);
      if (s < s0 - 5 || s > s1 + 15) continue;
      out.push([l.rec.get(i, 'x'), l.rec.get(i, 'n')]);
    }
    return out;
  });
  const road: [number, number][] = [];
  for (let s = s0; s <= s1; s += 1) {
    const i = Math.min(plan.path.count - 1, Math.round(s / plan.path.spacing));
    road.push([plan.path.xs[i], plan.path.ns[i]]);
  }
  const all = [...road, ...pts.flat()];
  const xs = all.map((p) => p[0]);
  const ns = all.map((p) => p[1]);
  const [x0, x1, n0, n1] = [Math.min(...xs), Math.max(...xs), Math.min(...ns), Math.max(...ns)];
  const k = Math.min((W - 20) / (x1 - x0 || 1), (H - 20) / (n1 - n0 || 1));
  // sim (x, n): n points left, so it goes up the screen
  const P = (p: [number, number]) =>
    `${(10 + (p[0] - x0) * k).toFixed(1)},${(H - 10 - (p[1] - n0) * k).toFixed(1)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Lines from above">
      <polyline
        points={road.map(P).join(' ')}
        fill="none"
        stroke={colors.road}
        strokeWidth={plan.roadWidth * k}
        strokeLinejoin="round"
      />
      <polyline
        points={road.map(P).join(' ')}
        fill="none"
        stroke={colors.line}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      {pts.map((p, i) => (
        <polyline
          key={i}
          points={p.map(P).join(' ')}
          fill="none"
          stroke={laneColor(row.lanes[i].info, colors, theme)}
          strokeWidth={i === 0 ? 3 : 2}
          strokeLinejoin="round"
        />
      ))}
      {row.lanes.map((l, i) =>
        l.letGo ? (
          <circle
            key={`g${i}`}
            cx={10 + (l.letGo.x - x0) * k}
            cy={H - 10 - (l.letGo.n - n0) * k}
            r={4}
            fill={laneColor(l.info, colors, theme)}
          />
        ) : null,
      )}
    </svg>
  );
}

export function Overlay() {
  const [vehicleId, setVehicleId] = useState('porsche-911-992');
  const vehicle = getVehicle(vehicleId);
  const theme = useTheme((s) => s.theme);
  const colors = DRIVE_COLORS[theme];
  const compare = useDrive((s) => s.compare);
  const speed = useDrive((s) => s.speed);
  const [rows, setRows] = useState<Row[]>([]);
  const options = useMemo(() => listVehicles().map((v) => ({ value: v.id, label: v.name })), []);

  useEffect(() => {
    setRows([]);
    let i = 0;
    let timer = 0;
    // one technique per tick, so the page stays responsive
    const next = () => {
      const id = HUB_ORDER[i++];
      if (!id) return;
      const lineup = buildLineup(vehicle, { scenario: id, ghosts: null, compare }, speed[id]);
      const lanes = lineup.map((e) => {
        const l = new Lane(e.params, e.plan, false, e.info);
        l.simTo(e.plan.duration + 1);
        return l;
      });
      setRows((r) => [...r, { id, lanes, labels: lineup.map((e) => e.label) }]);
      timer = window.setTimeout(next, 0);
    };
    timer = window.setTimeout(next, 0);
    return () => window.clearTimeout(timer);
  }, [vehicle, compare, speed]);

  return (
    <div
      className="apx-dock"
      style={{
        inset: 'var(--gutter)',
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 'var(--gap)',
        alignItems: 'start',
      }}
    >
      <Panel title="Drive: questions and takeaways">
        <Select label="Car" value={vehicleId} options={options} onChange={setVehicleId} />
      </Panel>
      {rows.map((row) => {
        const def = SCENARIOS[row.id];
        const metric = METRICS[def.headline];
        const cars = row.lanes.map((l, i) => laneResult(l, row.labels[i]).outcome!);
        return (
          <Panel key={row.id} className="apx-drive-info">
            <header className="apx-drive-q">
              <h2>
                <a
                  href={href(viewPath({ vehicleId, level: 'drive' }))}
                  onClick={() => useDrive.getState().setScenario(row.id)}
                >
                  {HUB_ORDER.indexOf(row.id) + 1}. {def.question}
                </a>
              </h2>
              <span>{def.label}</span>
            </header>
            <Lines row={row} />
            <p className="apx-drive-lesson">{lesson(row.id, cars, compare === 'technique')}</p>
            <ul className="apx-drive-lines">
              {cars.map((o, i) => (
                <li key={i}>
                  <i
                    className="apx-drive-dot"
                    style={
                      { '--sys': laneColor(row.lanes[i].info, colors, theme) } as CSSProperties
                    }
                  />
                  <b>
                    {o.label ?? o.code} {o.model}
                  </b>
                  <span data-tone={toneOf(o)}>{carLine(row.id, o)}</span>
                </li>
              ))}
            </ul>
            <table className="apx-drive-table">
              <tbody>
                {row.lanes.map((l, i) => {
                  const res = l.plan.summarize(l.rec.toTrace(2), l.p);
                  const v = def.verdict?.(res);
                  const value = res.values[res.headline];
                  return (
                    <tr key={i}>
                      <td>
                        <i
                          className="apx-drive-dot"
                          style={{ '--sys': laneColor(l.info, colors, theme) } as CSSProperties}
                        />
                        {row.labels[i] ?? l.info.code}
                      </td>
                      <td className="is-name">{l.info.name}</td>
                      <td className="is-num">
                        {res.spun || value === undefined
                          ? '–'
                          : `${value.toFixed(metric.digits)} ${metric.unit}`}
                      </td>
                      <td>
                        {v && (
                          <span className="apx-drive-verdict" data-tone={VERDICTS[v].tone}>
                            {VERDICTS[v].label}
                          </span>
                        )}
                      </td>
                      <td className="is-name">
                        {l.letGo ? `${l.letGo.axle} ${l.letGo.g.toFixed(2)} g` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        );
      })}
    </div>
  );
}
