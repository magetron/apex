/**
 * Hot-lap sandbox (#/dev/track): every circuit as built from its measured centreline (track,
 * racing line, corners and sector marks) with its length against the official one and where the
 * data come from; a grid of lap times for very different cars; and the simulator against the
 * published lap times.
 */
import { useMemo, useState } from 'react';
import { Panel } from '../app/ui';
import { hotLap, lapTime, listTracks, trackLine, trackPath, type TrackSpec } from '../sim/track';
import { findVehicle, getVehicle } from '../spec/catalog';
import { outline } from '../explorer/track/outline';
import '../explorer/track/track.css';

const CARS = [
  'bugatti-chiron',
  'porsche-911-gt3-992',
  'nissan-gtr-r35',
  'tesla-model3-awd',
  'lotus-elise-sprint-220-s3',
  'mazda-mx5-nd',
  'vw-golf-gti-mk8',
  'fiat-500-1957',
];

function Outline({ spec }: { spec: TrackSpec }) {
  const path = trackPath(spec.id);
  const line = trackLine(spec.id);
  const o = useMemo(() => outline(path, spec.mapHeadingDeg, 260, 10), [path, spec]);
  // the racing line, through the same transform
  const lineD = useMemo(() => {
    const q = { x: 0, y: 0 };
    let d = '';
    for (let i = 0; i < line.n; i += 2) {
      o.project(line.x[i], line.y[i], q);
      d += `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
    }
    return `${d}Z`;
  }, [line, o]);
  const p = { x: 0, y: 0 };
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${o.w} ${o.h}`} width={o.w} height={o.h}>
        <path
          d={o.d}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth={Math.max(1, path.width * o.scale)}
          strokeLinejoin="round"
        />
        <path d={lineD} fill="none" stroke="var(--accent)" strokeWidth={1} />
        {path.corners.map((k) => {
          o.at(k.apex / path.ds, p);
          return (
            <g key={k.name + k.apex}>
              <circle cx={p.x} cy={p.y} r={2.5} fill="var(--text)" />
              <text x={p.x + 4} y={p.y - 3} fontSize={8} fill="var(--text-muted)">
                {k.name}
              </text>
            </g>
          );
        })}
        {path.sectors.map((s) => {
          o.at(s / path.ds, p);
          return <circle key={s} cx={p.x} cy={p.y} r={3.5} fill="var(--warn)" />;
        })}
      </svg>
      <figcaption style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        <b style={{ color: 'var(--text)' }}>{spec.name}</b> {(path.length / 1000).toFixed(3)} km
        (official {(spec.lengthM / 1000).toFixed(3)},{' '}
        {(((path.length - spec.lengthM) / spec.lengthM) * 100).toFixed(2)}%) · width{' '}
        {path.width.toFixed(1)} m · line {(line.length / 1000).toFixed(3)} km
        <br />
        {spec.centreline.source}
      </figcaption>
    </figure>
  );
}

function Grid() {
  const tracks = listTracks();
  const [go, setGo] = useState(false);
  if (!go)
    return (
      <button type="button" className="apx-btn" onClick={() => setGo(true)}>
        Drive every car round every circuit
      </button>
    );
  return (
    <table className="apx-trk-board">
      <thead>
        <tr>
          <th />
          {tracks.map((t) => (
            <th key={t.id}>{t.name}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CARS.map((id) => (
          <tr key={id}>
            <th scope="row">{getVehicle(id).name}</th>
            {tracks.map((t) => (
              <td key={t.id}>{lapTime(hotLap(t.id, getVehicle(id)).time)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Published() {
  const rows = listTracks().flatMap((t) =>
    (t.laps ?? []).map((r) => {
      const v = findVehicle(r.vehicleId);
      const sim = v ? hotLap(t.id, v).time : NaN;
      return { t, r, v, sim };
    }),
  );
  return (
    <table className="apx-trk-board">
      <thead>
        <tr>
          <th>Car</th>
          <th>Circuit</th>
          <th>Published</th>
          <th>Simulated</th>
          <th>Gap</th>
          <th style={{ textAlign: 'left' }}>Note</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ t, r, v, sim }) => (
          <tr key={t.id + r.vehicleId}>
            <th scope="row">{v?.name ?? r.vehicleId}</th>
            <td>{t.name}</td>
            <td>{lapTime(r.time)}</td>
            <td>{lapTime(sim)}</td>
            <td>{(((sim - r.time) / r.time) * 100).toFixed(1)}%</td>
            <td style={{ textAlign: 'left' }}>{r.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Overlay() {
  const tracks = listTracks();
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'auto',
        padding: 16,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <Panel title="Circuits as built">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {tracks.map((t) => (
            <Outline key={t.id} spec={t} />
          ))}
        </div>
      </Panel>
      <Panel title="Hot laps">
        <Grid />
      </Panel>
      <Panel title="Against published lap times">
        <Published />
      </Panel>
    </div>
  );
}
