/**
 * Hot-lap HUD: the circuit cards (no circuit picked yet); the settings, race clock and running
 * order in the hub; the timing board and where the time goes (info card); the speed and gap
 * traces (bottom); a live mini-map; name tags with live gaps; and the result card once every car
 * is home. Every number is the laps' own; the panels show with bars, glyphs and icons rather
 * than say it in sentences.
 */
import { addAfterEffect } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { Button, Chips, Dock, Panel, Segmented, Toggle } from '../../app/ui';
import {
  DRIVER,
  fullPowerShare,
  gapText,
  getTrack,
  interval,
  lapTime,
  limitRuns,
  limitTimes,
  listTracks,
  raceOrder,
  sectorBest,
  SHIFT_S,
  timeSplit,
  trackPath,
  TRACTION,
  type TrackSpec,
} from '../../sim/track';
import { getVehicle } from '../../spec/catalog';
import type { VehicleSpec } from '../../spec/types';
import { carFacts } from '../panels/carFacts';
import type { Go, View } from '../view';
import { LapCharts } from './Charts';
import {
  DrivenWheels,
  FlagIcon,
  PauseIcon,
  PhaseIcon,
  PlayIcon,
  ReplayIcon,
  RestartIcon,
} from './icons';
import { useLap } from './laps';
import { outline, stretch, type Outline } from './outline';
import { newPose, poseAt } from './pose';
import {
  momentSpots,
  playback,
  racerSpots,
  tagView,
  useHotLap,
  useRacers,
  watchAgain,
  type Racer,
  type Racers,
  type TrackCamera,
} from './state';
import './track.css';

const km = (m: number) => `${(m / 1000).toFixed(2)} km`;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const secs = (s: number) => `${s.toFixed(1)} s`;
/** "+3.2" / "−8.3" */
const delta1 = (s: number) => `${s >= 0 ? '+' : '−'}${Math.abs(s).toFixed(1)}`;
const name = (v: VehicleSpec) => carFacts(v).model;

const Key = ({ color }: { color: string }) => (
  <i className="apx-trk-key" style={{ '--c': color } as CSSProperties} />
);

/** The laps still being driven (off the main thread): a pulse, no words. */
const Driving = () => (
  <span className="apx-trk-wait" role="status" aria-label="Driving the laps">
    <i />
    <i />
    <i />
  </span>
);

/** "11" with a turn arrow: the circuit's number of turns. */
const Turns = ({ n }: { n: number }) => (
  <span className="apx-trk-turns" title={`${n} turns`}>
    <PhaseIcon phase="corner" />
    {n}
  </span>
);

// ── the circuit cards ────────────────────────────────────────────────────────────────────

function TrackCard({
  spec,
  vehicle,
  onPick,
}: {
  spec: TrackSpec;
  vehicle: VehicleSpec;
  onPick: () => void;
}) {
  const o = useMemo(() => outline(trackPath(spec.id), spec.mapHeadingDeg, 120, 6), [spec]);
  const start = useMemo(() => o.at(0, { x: 0, y: 0 }), [o]);
  const lap = useLap(spec.id, vehicle.id);
  const power = lap ? fullPowerShare(lap) : 0;
  return (
    <button type="button" className="apx-trk-card" onClick={onPick}>
      <svg viewBox={`0 0 ${o.w} ${o.h}`} className="apx-trk-card__map" aria-hidden="true">
        <path d={o.d} className="apx-trk-outline" />
        <circle cx={start.x} cy={start.y} r={3.2} className="apx-trk-startdot" />
      </svg>
      <span className="apx-trk-card__name">{spec.name}</span>
      <span className="apx-trk-card__facts">
        <span>{km(spec.lengthM)}</span>
        <Turns n={spec.turns} />
      </span>
      <span className="apx-trk-card__time" title={`${name(vehicle)}'s hot lap`}>
        {lap ? lapTime(lap.time) : '…'}
      </span>
      {/* the same 0–100% scale on every card: side by side they compare the circuits */}
      <span
        className="apx-trk-card__power"
        title={`${name(vehicle)}: share of the lap on full power`}
      >
        <span className="apx-trk-power">
          <span style={{ width: pct(power) }} />
        </span>
        <b>{lap ? pct(power) : ''}</b>
      </span>
    </button>
  );
}

/** Every circuit, each with this car's lap time and how much of it is on full power. */
export function TrackPicker({ view, go }: { view: View; go: Go }) {
  const tracks = useMemo(listTracks, []);
  const vehicle = getVehicle(view.vehicleId);
  return (
    <Dock side="center">
      <Panel
        className="apx-trk-picker"
        title="Hot lap"
        actions={
          <span className="apx-trk-legend">
            <i />
            full power
          </span>
        }
      >
        <div className="apx-trk-cards">
          {tracks.map((t) => (
            <TrackCard
              key={t.id}
              spec={t}
              vehicle={vehicle}
              onPick={() => go({ ...view, track: t.id })}
            />
          ))}
        </div>
      </Panel>
    </Dock>
  );
}

// ── the info card ────────────────────────────────────────────────────────────────────────

/**
 * The timing board: each car's driven wheels (in its colour), its lap and gap, its sectors, and
 * how long its lap was traction-limited. The column heads are said once, above the cars.
 */
function Board({ racers }: { racers: Racer[] }) {
  const best = useMemo(() => sectorBest(racers.map((r) => r.lap)), [racers]);
  const fastest = racers.reduce((b, r, k) => (r.lap.time < racers[b].lap.time ? k : b), 0);
  const ref = racers[0].lap;
  return (
    <div className="apx-trk-times">
      <span className="apx-trk-times__cols is-head" aria-hidden="true">
        {ref.sectors.map((_, j) => (
          <span key={j}>S{j + 1}</span>
        ))}
        <span title="Time traction-limited: the driven tyres at their limit, power to spare">
          <i className="apx-trk-swatch" />
          traction
        </span>
      </span>
      <ol>
        {racers.map((r, k) => (
          <li key={r.vehicle.id} className={k === fastest ? 'is-best' : undefined}>
            <span className="apx-trk-times__row">
              <DrivenWheels driven={r.vehicle.powertrain.driven} color={r.color} />
              <span className="apx-trk-times__name" title={r.vehicle.name}>
                {name(r.vehicle)}
              </span>
              <small>{k > 0 ? `${gapText(r.lap.time - ref.time)} s` : ''}</small>
              <b>{lapTime(r.lap.time)}</b>
            </span>
            <span className="apx-trk-times__cols">
              {r.lap.sectors.map((s, j) => (
                <span
                  key={j}
                  className={racers.length > 1 && best[j] === k ? 'is-sector-best' : undefined}
                  style={{ '--c': r.color } as CSSProperties}
                  title={`Sector ${j + 1}${best[j] === k ? ', fastest' : ''}`}
                >
                  {s.toFixed(2)}
                </span>
              ))}
              <span className="apx-trk-times__limit">{secs(limitTimes(r.lap).traction)}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Where the time goes: car A's lap cut into the stretches where it corners, is on the power and
 * brakes (the icons, over its bar), and every car timed over exactly those stretches, one
 * stacked bar each on one time scale. Under each piece: car A's seconds, the others' gain or
 * loss against them.
 */
function Split({ racers }: { racers: Racer[] }) {
  const split = useMemo(() => timeSplit(racers.map((r) => r.lap)), [racers]);
  const max = Math.max(...racers.map((r) => r.lap.time));
  const basis = (s: number) => ({ flexBasis: `${(100 * s) / max}%` });
  return (
    <div className="apx-trk-split">
      <span />
      <span className="apx-trk-split__icons">
        {split.map((s) => (
          <span key={s.phase} style={basis(s.time)}>
            <PhaseIcon phase={s.phase} label />
          </span>
        ))}
      </span>
      {racers.map((r, k) => (
        <div
          key={r.vehicle.id}
          className="apx-trk-split__car"
          style={{ '--c': r.color } as CSSProperties}
          title={r.vehicle.name}
        >
          <Key color={r.color} />
          <span className="apx-trk-split__bar">
            {split.map((s) => (
              <span key={s.phase} className={`is-${s.phase}`} style={basis(s.time + s.deltas[k])} />
            ))}
          </span>
          <span />
          <span className="apx-trk-split__nums">
            {split.map((s) => (
              <span key={s.phase} style={basis(s.time + s.deltas[k])}>
                {k ? delta1(s.deltas[k]) : s.time.toFixed(1)}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TrackInfo({ view }: { view: View }) {
  const racers = useRacers(view.track, getVehicle(view.vehicleId), view.vs);
  if (!view.track) return null;
  const spec = getTrack(view.track);
  return (
    <Panel className="apx-trk-info" title={spec.fullName}>
      <Chips
        items={[
          { label: km(spec.lengthM) },
          { label: <Turns n={spec.turns} /> },
          { label: spec.country },
          {
            label: `driver ${pct(DRIVER)}`,
            title: `The same test driver in every car: ${pct(DRIVER)} of the tyres' grip, ${SHIFT_S} s per upshift`,
          },
        ]}
      />
      {racers.length ? (
        <>
          <Board racers={racers} />
          <Split racers={racers} />
        </>
      ) : (
        <Driving />
      )}
    </Panel>
  );
}

// ── the hub ──────────────────────────────────────────────────────────────────────────────

const SPEEDS = [0.5, 1, 2, 4];

/** The race clock, car A's speed and gear, and the running order with live gaps, written
 *  straight into the DOM every frame. */
function Live({ racers }: { racers: Racers }) {
  const ready = useHotLap((s) => s.ready);
  const clock = useRef<HTMLSpanElement>(null);
  const speed = useRef<HTMLSpanElement>(null);
  const gear = useRef<HTMLSpanElement>(null);
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const gaps = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const line = racers.line;
    if (!line) return;
    const pose = newPose();
    const laps = racers.map((r) => r.lap);
    let raf = 0;
    const set = (el: Element | null | undefined, s: string) => {
      if (el && el.textContent !== s) el.textContent = s;
    };
    const tick = () => {
      const t = Math.min(playback.t, playback.end);
      poseAt(line, racers[0].lap, playback.t, pose);
      set(clock.current, lapTime(t));
      set(speed.current, `${Math.round(pose.v * 3.6)}`);
      set(gear.current, racers[0].vehicle.powertrain.kind === 'ev' ? '–' : `${pose.gear}`);
      const order = raceOrder(laps, playback.t);
      order.forEach((k, pos) => {
        const row = rows.current[k];
        if (row && row.style.order !== `${pos}`) row.style.order = `${pos}`;
        set(gaps.current[k], k === 0 ? '' : `${gapText(interval(laps[0], laps[k], playback.t))} s`);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [racers]);
  return (
    <>
      {/* until the cars are in, the clock waits on the line, dimmed */}
      <div className={`apx-trk-live${ready ? '' : ' is-wait'}`} aria-live="off" aria-busy={!ready}>
        <span className="apx-trk-live__clock" ref={clock} />
        <span>
          <b ref={speed} />
          <small>km/h</small>
        </span>
        <span>
          <b ref={gear} />
          <small>gear</small>
        </span>
      </div>
      {racers.length > 1 && (
        <ol className="apx-trk-order" aria-label="Running order">
          {racers.map((r, k) => (
            <li
              key={r.vehicle.id}
              ref={(el) => {
                rows.current[k] = el;
              }}
            >
              <Key color={r.color} />
              <span>{name(r.vehicle)}</span>
              <b
                ref={(el) => {
                  gaps.current[k] = el;
                }}
              />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function TrackControls({ view, go, sound }: { view: View; go: Go; sound: ReactNode }) {
  const { camera, playing, speed, line, finished } = useHotLap();
  const racers = useRacers(view.track, getVehicle(view.vehicleId), view.vs);
  if (!view.track) return <div className="apx-trk-controls">{sound}</div>;
  return (
    <div className="apx-trk-controls">
      {racers.length ? <Live racers={racers} /> : <Driving />}
      <div className="apx-trk-controls__row">
        {finished ? (
          <Button onClick={watchAgain} title="Watch again">
            <ReplayIcon />
          </Button>
        ) : (
          <>
            <Button
              onClick={() => useHotLap.setState({ playing: !playing })}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Button>
            <Button onClick={watchAgain} title="Restart">
              <RestartIcon />
            </Button>
          </>
        )}
        <Button onClick={() => go({ ...view, track: undefined })} title="Pick another circuit">
          Circuits
        </Button>
      </div>
      <Segmented<TrackCamera>
        label="Camera"
        value={camera}
        onChange={(v) => useHotLap.setState({ camera: v })}
        options={[
          { value: 'chase', label: 'Chase' },
          { value: 'map', label: 'Map' },
        ]}
      />
      <Segmented<string>
        label="Playback speed"
        value={String(speed)}
        onChange={(v) => useHotLap.setState({ speed: Number(v) })}
        options={SPEEDS.map((s) => ({ value: String(s), label: s === 0.5 ? '½×' : `${s}×` }))}
      />
      <Toggle
        label="Racing line"
        checked={line}
        onChange={(v) => useHotLap.setState({ line: v })}
      />
      {sound}
    </div>
  );
}

// ── the finish ───────────────────────────────────────────────────────────────────────────

/** Every car home: the finishing order, times and gaps, held until the visitor goes again
 *  (the hub keeps the way back to the circuits). */
export function ResultCard({ view }: { view: View; go: Go }) {
  const finished = useHotLap((s) => s.finished);
  const racers = useRacers(view.track, getVehicle(view.vehicleId), view.vs);
  if (!finished || !racers.length || !view.track) return null;
  const order = [...racers].sort((p, q) => p.lap.time - q.lap.time);
  const win = order[0].lap.time;
  return (
    <div className="apx-trk-result-dock">
      <Panel
        className="apx-trk-result"
        title={
          <>
            <FlagIcon />
            {getTrack(view.track).name}
          </>
        }
        actions={
          <Button primary onClick={watchAgain} title="Watch again">
            <ReplayIcon />
          </Button>
        }
      >
        <ol>
          {order.map((r) => (
            <li key={r.vehicle.id}>
              <Key color={r.color} />
              <span className="apx-trk-result__name">{name(r.vehicle)}</span>
              <small>{r.lap.time === win ? '' : `${gapText(r.lap.time - win)} s`}</small>
              <b>{lapTime(r.lap.time)}</b>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}

// ── name tags ────────────────────────────────────────────────────────────────────────────

/** tag height on screen (px), for keeping tags in a pack apart */
const TAG_H = 20;

/** a screen rectangle (px) */
interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}
const overlap = (p: Box, q: Box, pad: number) =>
  p.l < q.r + pad && q.l < p.r + pad && p.t < q.b && q.t < p.b;

/**
 * Each car's name over it, with its live gap to car A, placed in the HUD from where the scene
 * drew the car; in a pack the tags step apart rather than sit on each other, and a tag that
 * would cover a key moment's tag on the road steps up over it.
 */
export function RacerTags({ view }: { view: View }) {
  const racers = useRacers(view.track, getVehicle(view.vehicleId), view.vs);
  const map = useHotLap((s) => s.camera === 'map');
  const tags = useRef<(HTMLSpanElement | null)[]>([]);
  const gaps = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    if (!racers.length) return;
    const laps = racers.map((r) => r.lap);
    // one box per car and per moment, reused every frame
    const boxes = racers.map((_, k) => ({ l: 0, t: 0, r: 0, b: 0, k }));
    const placed: typeof boxes = [];
    const fixed: (Box & { on: boolean })[] = [];
    // layout reads (the canvas's place, the tags' widths) only now and then, never every frame
    const widths = racers.map(() => 120);
    let c: DOMRect | undefined;
    let frame = 0;
    const e = tagView.m.elements;
    /** where a world point lands in the page (px), or false when off screen */
    const at = { x: 0, y: 0 };
    const project = (x: number, y: number, z: number) => {
      if (!c) return false;
      const w = e[3] * x + e[7] * y + e[11] * z + e[15];
      const nx = (e[0] * x + e[4] * y + e[8] * z + e[12]) / w;
      const ny = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w;
      if (w <= 0.5 || Math.abs(nx) > 1.1 || Math.abs(ny) > 1.1) return false;
      at.x = c.left + ((nx + 1) / 2) * c.width;
      at.y = c.top + ((1 - ny) / 2) * c.height;
      return true;
    };
    const tick = () => {
      if (frame++ % 30 === 0) {
        c = document.querySelector('.apx-canvas canvas')?.getBoundingClientRect();
        tags.current.forEach((el, k) => {
          if (el && el.style.visibility === 'visible') widths[k] = el.offsetWidth;
        });
      }
      // the key moments' tags showing on the road (Marks3D pins and sizes them)
      while (fixed.length < momentSpots.length) fixed.push({ l: 0, t: 0, r: 0, b: 0, on: false });
      for (let j = 0; j < fixed.length; j++) {
        const m = momentSpots[j];
        const f = fixed[j];
        f.on = !!m && m.on && tagView.ok && project(m.x, m.y, m.z);
        if (!f.on) continue;
        f.l = at.x - m.w / 2;
        f.r = at.x + m.w / 2;
        f.t = at.y + m.dy - m.h / 2;
        f.b = at.y + m.dy + m.h / 2;
      }
      placed.length = 0;
      for (let k = 0; k < racers.length; k++) {
        const el = tags.current[k];
        const p = racerSpots[k];
        if (!el) continue;
        if (!tagView.ok || !p || !project(p.x, map ? 0 : 1.8, p.z)) {
          el.style.visibility = 'hidden';
          continue;
        }
        // from above beside the car's dot, in the chase centred over the car
        const q = boxes[k];
        q.l = map ? at.x + 12 : at.x - widths[k] / 2;
        q.r = q.l + widths[k];
        q.b = at.y;
        q.t = at.y - TAG_H;
        placed.push(q);
      }
      // nearest the bottom first; a tag that would sit on a moment's tag or on one already
      // placed moves up (a few rounds: moving up may land it on another)
      placed.sort((p, q) => q.b - p.b);
      for (let i = 0; i < placed.length; i++) {
        const a = placed[i];
        for (let round = 0; round < 4; round++) {
          let moved = false;
          for (let j = 0; j < fixed.length; j++)
            if (fixed[j].on && overlap(a, fixed[j], 2)) {
              a.b = fixed[j].t - 1;
              a.t = a.b - TAG_H;
              moved = true;
            }
          for (let j = 0; j < i; j++)
            if (overlap(a, placed[j], 4)) {
              a.b = placed[j].t;
              a.t = a.b - TAG_H;
              moved = true;
            }
          if (!moved) break;
        }
      }
      for (const q of placed) {
        const el = tags.current[q.k]!;
        el.style.visibility = 'visible';
        el.style.transform = `translate(${Math.round(q.l)}px, ${Math.round(q.t)}px)`;
        const g = gaps.current[q.k];
        if (g && q.k > 0) {
          const s = `${gapText(interval(laps[0], laps[q.k], playback.t))} s`;
          if (g.textContent !== s) g.textContent = s;
        }
      }
    };
    // right after the scene draws each frame: the tags where the cars are drawn, that same frame
    return addAfterEffect(tick);
  }, [racers, map]);
  if (!racers.length) return null;
  return (
    <div className="apx-trk-tags" aria-hidden="true">
      {racers.map((r, k) => (
        <span
          key={r.vehicle.id}
          className="apx-trk-tag"
          style={{ '--c': r.color } as CSSProperties}
          ref={(el) => {
            tags.current[k] = el;
          }}
        >
          <i />
          {name(r.vehicle)}
          {k > 0 && (
            <b
              ref={(el) => {
                gaps.current[k] = el;
              }}
            />
          )}
        </span>
      ))}
    </div>
  );
}

// ── the traces and the mini-map ──────────────────────────────────────────────────────────

export function TrackDash({ view, picker }: { view: View; picker: ReactNode }) {
  const racers = useRacers(view.track, getVehicle(view.vehicleId), view.vs);
  if (!view.track) return <>{picker}</>;
  return (
    <div className="apx-trk-dash">
      <Panel className="apx-trk-dash__charts">
        {racers.length ? <LapCharts racers={racers} path={trackPath(view.track)} /> : <Driving />}
      </Panel>
      {picker}
    </div>
  );
}

/** A stretch of the outline moved `px` across it (screen units), for side-by-side marks. */
function besideStretch(o: Outline, trackId: string, from: number, to: number, px: number) {
  const path = trackPath(trackId);
  const off = px / o.scale;
  const p = { x: 0, y: 0 };
  let d = '';
  const step = Math.max(1, Math.floor(path.n / 400));
  for (let i = from; i <= to; i += step) {
    const j = Math.min(i, path.n - 1);
    o.project(path.x[j] - off * Math.sin(path.psi[j]), path.y[j] + off * Math.cos(path.psi[j]), p);
    d += `${d ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return d;
}

/** The circuit from above: each sector in the colour of the car fastest through it, beside the
 *  road where each car was traction-limited, and every car a dot going round. */
export function MiniMap({ view }: { view: View }) {
  const from = useHotLap((s) => s.camera);
  const racers = useRacers(view.track, getVehicle(view.vehicleId), view.vs);
  const trackId = view.track;
  const o = useMemo(
    () => (trackId ? outline(trackPath(trackId), getTrack(trackId).mapHeadingDeg, 180, 12) : null),
    [trackId],
  );
  const best = useMemo(() => sectorBest(racers.map((r) => r.lap)), [racers]);
  const traction = useMemo(
    () =>
      o && trackId
        ? racers.map((r, k) =>
            limitRuns(r.lap, TRACTION).map(([a, b]) =>
              besideStretch(o, trackId, a, b, 4 + 3.2 * k),
            ),
          )
        : [],
    [o, racers, trackId],
  );
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  useEffect(() => {
    const line = racers.line;
    if (!o || !line) return;
    const pose = newPose();
    const p = { x: 0, y: 0 };
    let raf = 0;
    const tick = () => {
      racers.forEach((r, k) => {
        const el = dots.current[k];
        if (!el) return;
        poseAt(line, r.lap, playback.t, pose);
        o.project(pose.x, -pose.z, p);
        el.setAttribute('cx', p.x.toFixed(1));
        el.setAttribute('cy', p.y.toFixed(1));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [o, racers]);
  // from above, the view itself is the map
  if (!o || !trackId || !racers.length || from === 'map') return null;
  const path = trackPath(trackId);
  const at = path.sectors.map((s) => Math.round(s / path.ds));
  const start = o.at(0, { x: 0, y: 0 });
  return (
    <div className="apx-trk-mini">
      <svg viewBox={`0 0 ${o.w} ${o.h}`} role="img" aria-label="Circuit map">
        <path d={o.d} className="apx-trk-outline is-under" />
        {racers.length > 1 &&
          at.map((s0, k) => (
            <path
              key={k}
              d={stretch(o, s0, k < 2 ? at[k + 1] : path.n, path.n)}
              className="apx-trk-sectorline"
              style={{ stroke: racers[best[k]].color }}
            />
          ))}
        {traction.map((runs, k) =>
          runs.map((d, j) => (
            <path
              key={`${k}-${j}`}
              d={d}
              className="apx-trk-traction"
              style={{ stroke: racers[k].color }}
            />
          )),
        )}
        <circle cx={start.x} cy={start.y} r={3} className="apx-trk-startdot" />
        {racers
          .map((r, k) => ({ r, k }))
          .reverse()
          .map(({ r, k }) => (
            <circle
              key={r.vehicle.id}
              ref={(el) => {
                dots.current[k] = el;
              }}
              r={4.2}
              className="apx-trk-dot"
              style={{ fill: r.color }}
            />
          ))}
      </svg>
      <p className="apx-trk-mini__key" title="Beside the road: where each car is traction-limited">
        <span className="apx-trk-mini__band" />
        traction
      </p>
    </div>
  );
}
