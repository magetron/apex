/**
 * #/dev/drive — every question at once, for one car and the question's own car B, in the rail's
 * order: the paths at the key moment's first stop (the live inset as it is then), the picture
 * the run ends on, each car's word at each stop, and the words in sight at the start, each stop
 * and the end, counted against the text budget (drive/words.ts, the same count as its test).
 * Click a question to open it in the explorer's drive mode.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { href } from '../app/routes';
import { Panel, Select } from '../app/ui';
import {
  budget,
  hudText,
  runQuestion,
  type Moment,
  type QuestionRun,
} from '../explorer/drive/budget';
import { DRIVE_COLORS } from '../explorer/drive/colors';
import { tagWord } from '../explorer/drive/freeze';
import { laneColor } from '../explorer/drive/lineup';
import { PathDrawing } from '../explorer/drive/PathPicture';
import { useDrive } from '../explorer/drive/state';
import { BUDGET } from '../explorer/drive/words';
import { viewPath } from '../explorer/view';
import { useTheme } from '../scene/theme';
import { HUB_ORDER, SCENARIOS } from '../sim/scenarios';
import { getVehicle, listVehicles } from '../spec/catalog';
import '../explorer/drive/drive.css';

interface Row {
  run: QuestionRun;
  moments: Moment[];
}

function Counts({ moments }: { moments: Moment[] }) {
  return (
    <table className="apx-dev-words">
      <tbody>
        {moments.map((m) => (
          <tr key={m.moment} className={m.words.length > BUDGET ? 'is-over' : undefined}>
            <th scope="row">{m.moment}</th>
            <td>{m.words.length}</td>
            <td title="every word, car names and question titles too">{m.all}</td>
            <td>{m.words.join(' ')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Overlay() {
  const [vehicleId, setVehicleId] = useState('porsche-911-992');
  const vehicle = getVehicle(vehicleId);
  const theme = useTheme((s) => s.theme);
  const colors = DRIVE_COLORS[theme];
  const [rows, setRows] = useState<Row[]>([]);
  const options = useMemo(() => listVehicles().map((v) => ({ value: v.id, label: v.name })), []);

  useEffect(() => {
    setRows([]);
    const hud = hudText(vehicle);
    let i = 0;
    let timer = 0;
    // one question per tick, so the page stays responsive
    const next = () => {
      const id = HUB_ORDER[i++];
      if (!id) return;
      const run = runQuestion(vehicle, id);
      setRows((r) => [...r, { run, moments: budget(vehicle, run, hud) }]);
      timer = window.setTimeout(next, 0);
    };
    timer = window.setTimeout(next, 0);
    return () => window.clearTimeout(timer);
  }, [vehicle]);

  const most = rows.length
    ? Math.max(...rows.flatMap((r) => r.moments.map((m) => m.words.length)))
    : 0;
  return (
    <div
      className="apx-dock"
      style={{
        inset: 'var(--gutter)',
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 'var(--gap)',
        alignItems: 'start',
      }}
    >
      <Panel title="Drive: words in sight per question">
        <Select label="Car" value={vehicleId} options={options} onChange={setVehicleId} />
        <p className="apx-muted" style={{ margin: 0, fontSize: 12 }}>
          Most at any moment: {most} of {BUDGET} (car names and question titles aside).
        </p>
      </Panel>
      {rows.map(({ run, moments }) => {
        const { id, lanes, frames, pic } = run;
        const def = SCENARIOS[id];
        const stop = frames[0]?.t;
        return (
          <Panel key={id} className="apx-drive-info">
            <h2 className="apx-drive-title">
              <span className="apx-drive-title__n">{HUB_ORDER.indexOf(id) + 1}</span>
              <a
                href={href(viewPath({ vehicleId, level: 'drive' }))}
                onClick={() => useDrive.getState().setScenario(id)}
              >
                {def.question}
              </a>
            </h2>
            <ul className="apx-dev-cars">
              {lanes.map((l, i) => (
                <li key={i} style={{ '--sys': laneColor(l.info, colors) } as CSSProperties}>
                  <b>{l.info.label ?? l.info.name}</b>
                  {frames.map((f, k) => (
                    <span key={k}>{tagWord(id, f.cars[i].verdict) || '—'}</span>
                  ))}
                </li>
              ))}
            </ul>
            {pic && stop !== undefined && (
              <div className="apx-drive-inset" title="The inset at the stop">
                <PathDrawing pic={pic} w={268} h={150} until={stop} />
              </div>
            )}
            {pic && (
              <div className="apx-drive-pic is-inline">
                <PathDrawing pic={pic} w={336} h={300} />
              </div>
            )}
            <Counts moments={moments} />
          </Panel>
        );
      })}
    </div>
  );
}
