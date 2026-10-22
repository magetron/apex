/**
 * The laps against distance, one line per car, sharing one x-axis named by the corners:
 *  - speed (km/h): where each car is quicker, and how slow each corner is;
 *  - under it, a strip per car marking where it was traction-limited (its driven tyres at their
 *    limit with power to spare): the layout's cost, out of the corners;
 *  - gap to car A (s; its zero line in car A's colour), scaled to the gaps themselves, with the
 *    biggest changes shaded and tagged in the car's colour ("+2.5 s") where they happen.
 * The playhead follows car A round; hovering reads every car at that point; pressing (and
 * dragging) sends the playback there.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import {
  deltaTrace,
  gapText,
  keyMoments,
  limitRuns,
  LIMITS,
  TRACTION,
  type TrackPath,
} from '../../sim/track';
import { carFacts } from '../panels/carFacts';
import { playback, useHotLap, type Racer } from './state';

const SPEED_H = 104;
const STRIP_H = 5;
const STRIP_GAP = 2;
const GAP_H = 66;
const AXIS_H = 18;
const TOP = 22;
const LEFT = 40;
const RIGHT = 50;
const KMH = 3.6;
/** a key moment's tag on the gap trace: height, and width per character (px, 10 px mono) */
const TAG_H = 13;
const TAG_CHAR = 6.1;
const LIMIT_WORD: Record<(typeof LIMITS)[number], string> = {
  grip: 'grip',
  traction: 'traction',
  power: 'power',
  brake: 'braking',
};

interface Props {
  racers: Racer[];
  path: TrackPath;
}

const niceStep = (span: number, ticks: number) => {
  const raw = span / ticks;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw;
};
const name = (r: Racer) => carFacts(r.vehicle).model;

export function LapCharts({ racers, path }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setW(Math.max(320, Math.round(el.clientWidth)));
    // measured before the first paint too: drawn at the default width until the observer's
    // first call, the traces ran past the panel's right edge
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const plotW = w - LEFT - RIGHT;
  const n = path.n;
  const L = path.length;
  const x = (s: number) => LEFT + (s / L) * plotW;

  const data = useMemo(() => {
    const ref = racers[0].lap;
    const vTop = Math.max(...racers.map((r) => r.lap.vMax)) * KMH;
    const vStep = niceStep(vTop, 3);
    const vMax = Math.ceil(vTop / vStep) * vStep;
    const deltas = racers.map((r) => deltaTrace(ref, r.lap));
    let d0 = 0;
    let d1 = 0;
    for (const d of deltas)
      for (let i = 0; i <= n; i++) {
        d0 = Math.min(d0, d[i]);
        d1 = Math.max(d1, d[i]);
      }
    // fitted to the gaps themselves (a little room either side), ticks at a round step
    const pad = Math.max(0.1, (d1 - d0) * 0.08);
    const dLo = d0 < 0 ? d0 - pad : 0;
    const dHi = d1 > 0 ? d1 + pad : pad;
    const dStep = niceStep(dHi - dLo, 3);
    const moments = keyMoments(
      racers.map((r) => r.lap),
      path,
    );
    const traction = racers.map((r) => limitRuns(r.lap, TRACTION));
    return { vMax, vStep, deltas, dLo, dHi, dStep, moments, traction };
  }, [racers, n, path]);

  const ySpeed = (kmh: number) => TOP + SPEED_H * (1 - kmh / data.vMax);
  const stripTop = TOP + SPEED_H + 6;
  const stripsH = racers.length * (STRIP_H + STRIP_GAP);
  const gapTop = stripTop + stripsH + 16;
  const yGap = (s: number) => gapTop + (GAP_H * (data.dHi - s)) / (data.dHi - data.dLo);

  const lines = useMemo(() => {
    const stride = Math.max(1, Math.floor(n / Math.max(200, plotW)));
    return racers.map((r, k) => {
      let sp = '';
      let gp = '';
      for (let i = 0; i <= n; i += stride) {
        const j = i % n;
        const px = x(i * path.ds).toFixed(1);
        sp += `${i ? 'L' : 'M'}${px} ${ySpeed(r.lap.v[j] * KMH).toFixed(1)}`;
        gp += `${i ? 'L' : 'M'}${px} ${yGap(data.deltas[k][i]).toFixed(1)}`;
      }
      return { speed: sp, gap: gp };
    });
    // x/y follow w and data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [racers, data, w, n, path.ds]);

  // the key moments' tags over their stretches, a row lower where two would touch
  const moments = useMemo(() => {
    const rows: number[] = [];
    return data.moments
      .map((m, j) => {
        const x0 = x(m.section.s0);
        const x1 = x(m.section.s1);
        const text = `${m.change < 0 ? '−' : '+'}${Math.abs(m.change).toFixed(1)} s`;
        const tw = text.length * TAG_CHAR + 10;
        const cx = Math.min(w - RIGHT - tw / 2, Math.max(LEFT + tw / 2, (x0 + x1) / 2));
        return { key: j, car: m.car, x0, x1, text, w: tw, cx, row: 0 };
      })
      .sort((p, q) => p.cx - q.cx)
      .map((m) => {
        let row = rows.findIndex((right) => right + 3 < m.cx - m.w / 2);
        if (row < 0) row = rows.push(0) - 1;
        rows[row] = m.cx + m.w / 2;
        return { ...m, row };
      });
    // x follows w
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, w]);

  // corner names on the axis, as many as fit without touching
  const labels = useMemo(() => {
    const out: { name: string; at: number }[] = [];
    let right = -Infinity;
    for (const c of path.corners) {
      const px = x(c.apex);
      const half = c.name.length * 2.9 + 3;
      if (px - half < right) continue;
      out.push({ name: c.name, at: px });
      right = px + half;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, w]);

  // the playhead, moved in its own animation frame (no React state per frame)
  const head = useRef<SVGLineElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = head.current;
      if (el) {
        const px = x(Math.min(playback.at, n) * path.ds).toFixed(1);
        if (el.getAttribute('x1') !== px) {
          el.setAttribute('x1', px);
          el.setAttribute('x2', px);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, path]);

  const [hover, setHover] = useState<number | null>(null);
  const scrubbing = useRef(false);
  const sampleOf = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const s = ((e.clientX - r.left - LEFT) / plotW) * L;
    return s < 0 || s > L ? null : Math.min(n - 1, Math.max(0, Math.round(s / path.ds)));
  };
  /** send the playback to the moment car A passed sample i */
  const seek = (i: number | null) => {
    if (i === null) return;
    playback.t = racers[0].lap.t[i];
    // from the result card: watch on from there
    if (useHotLap.getState().finished) useHotLap.setState({ finished: false, playing: true });
  };

  const H = gapTop + GAP_H + AXIS_H + 4;
  const vTicks = [];
  for (let v = data.vStep; v <= data.vMax; v += data.vStep) vTicks.push(v);
  const gTicks = [];
  for (let g = Math.ceil(data.dLo / data.dStep) * data.dStep; g <= data.dHi; g += data.dStep)
    gTicks.push(g);
  const sectorX = path.sectors.slice(1).map(x);
  const hx = hover === null ? 0 : x(hover * path.ds);
  // the final gaps beside their lines' ends, nudged apart where lines end close together
  const ends = racers
    .slice(1)
    .map((r, k) => ({
      id: r.vehicle.id,
      y: yGap(data.deltas[k + 1][n]),
      text: gapText(data.deltas[k + 1][n]),
    }))
    .sort((p, q) => p.y - q.y);
  for (let k = 1; k < ends.length; k++) ends[k].y = Math.max(ends[k].y, ends[k - 1].y + 11);

  return (
    <div className="apx-trk-charts" ref={box}>
      <svg
        width={w}
        height={H}
        role="img"
        aria-label="Speed, traction limit and gap to the first car over the lap"
        onPointerDown={(e) => {
          // the jump first: capturing the pointer (for a drag) may be refused
          seek(sampleOf(e));
          scrubbing.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* no drag, the jump stands */
          }
        }}
        onPointerMove={(e) => {
          const i = sampleOf(e);
          setHover(i);
          if (scrubbing.current) seek(i);
        }}
        onPointerUp={() => (scrubbing.current = false)}
        onPointerCancel={() => (scrubbing.current = false)}
        onPointerLeave={() => setHover(null)}
      >
        {/* speed */}
        {vTicks.map((v) => (
          <g key={v}>
            <line className="apx-trk-grid" x1={LEFT} x2={w - RIGHT} y1={ySpeed(v)} y2={ySpeed(v)} />
            <text className="apx-trk-tick" x={LEFT - 4} y={ySpeed(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        <text className="apx-trk-unit" x={LEFT - 4} y={TOP - 12} textAnchor="end">
          km/h
        </text>
        {sectorX.map((sx, k) => (
          <line key={k} className="apx-trk-sector" x1={sx} x2={sx} y1={TOP} y2={gapTop + GAP_H} />
        ))}
        {['S1', 'S2', 'S3'].map((label, k) => {
          const from = k ? sectorX[k - 1] : LEFT;
          const to = k < 2 ? sectorX[k] : w - RIGHT;
          return (
            <text
              key={label}
              className="apx-trk-tick"
              x={(from + to) / 2}
              y={TOP - 6}
              textAnchor="middle"
            >
              {label}
            </text>
          );
        })}
        {lines
          .map((l, k) => ({ l, k }))
          .reverse()
          .map(({ l, k }) => (
            <path
              key={racers[k].vehicle.id}
              className="apx-trk-trace"
              d={l.speed}
              style={{ color: racers[k].color }}
            />
          ))}

        {/* traction-limited, one strip per car */}
        <text className="apx-trk-unit" x={LEFT - 4} y={stripTop + stripsH / 2 + 3} textAnchor="end">
          traction
        </text>
        {data.traction.map((runs, k) => {
          const y = stripTop + k * (STRIP_H + STRIP_GAP);
          return (
            <g key={racers[k].vehicle.id} style={{ color: racers[k].color }}>
              <rect className="apx-trk-strip" x={LEFT} y={y} width={plotW} height={STRIP_H} />
              {runs.map(([a, b]) => (
                <rect
                  key={a}
                  className="apx-trk-strip__on"
                  x={x(a * path.ds)}
                  y={y}
                  width={Math.max(1.5, x(b * path.ds) - x(a * path.ds))}
                  height={STRIP_H}
                />
              ))}
            </g>
          );
        })}

        {/* gap to car A */}
        {/* the zero line is car A itself: in its colour */}
        {gTicks.map((g) => {
          const zero = Math.abs(g) < 1e-9;
          return (
            <g key={g}>
              <line
                className={zero ? 'apx-trk-zero' : 'apx-trk-grid'}
                style={zero ? { stroke: racers[0].color } : undefined}
                x1={LEFT}
                x2={w - RIGHT}
                y1={yGap(g)}
                y2={yGap(g)}
              />
              <text className="apx-trk-tick" x={LEFT - 4} y={yGap(g) + 3} textAnchor="end">
                {zero ? '0' : gapText(g).replace(/\.?0+$/, '')}
              </text>
            </g>
          );
        })}
        <text className="apx-trk-unit" x={LEFT - 4} y={gapTop - 6} textAnchor="end">
          s
        </text>
        {/* where the gaps change most: the stretch shaded (its tag goes over the traces) */}
        {moments.map((m) => (
          <rect
            key={m.key}
            className="apx-trk-moment-band"
            style={{ color: racers[m.car].color }}
            x={m.x0}
            y={gapTop}
            width={Math.max(2, m.x1 - m.x0)}
            height={GAP_H}
          />
        ))}
        {lines
          .map((l, k) => ({ l, k }))
          .slice(1)
          .reverse()
          .map(({ l, k }) => (
            <path
              key={racers[k].vehicle.id}
              className="apx-trk-trace"
              d={l.gap}
              style={{ color: racers[k].color }}
            />
          ))}
        {moments.map((m) => (
          <g key={m.key} style={{ color: racers[m.car].color }}>
            <rect
              className="apx-trk-moment-tag"
              x={m.cx - m.w / 2}
              y={gapTop + 2 + m.row * (TAG_H + 2)}
              width={m.w}
              height={TAG_H}
              rx={3}
            />
            <text
              className="apx-trk-moment-text"
              x={m.cx}
              y={gapTop + 2 + m.row * (TAG_H + 2) + TAG_H - 3.5}
              textAnchor="middle"
            >
              {m.text}
            </text>
          </g>
        ))}
        {ends.map((e) => (
          <text key={e.id} className="apx-trk-end" x={w - RIGHT + 4} y={e.y + 3}>
            {e.text} s
          </text>
        ))}
        {/* corner names along the axis */}
        {labels.map((c) => (
          <g key={`${c.name}${c.at}`}>
            <line
              className="apx-trk-grid"
              x1={c.at}
              x2={c.at}
              y1={gapTop + GAP_H}
              y2={gapTop + GAP_H + 3}
            />
            <text
              className="apx-trk-corner-tick"
              x={c.at}
              y={gapTop + GAP_H + 13}
              textAnchor="middle"
            >
              {c.name}
            </text>
          </g>
        ))}
        <line
          ref={head}
          className="apx-trk-head"
          x1={LEFT}
          x2={LEFT}
          y1={TOP}
          y2={gapTop + GAP_H}
        />
        {hover !== null && (
          <line className="apx-trk-cross" x1={hx} x2={hx} y1={TOP} y2={gapTop + GAP_H} />
        )}
      </svg>
      {hover !== null && (
        <div
          className="apx-trk-tip"
          // beside the cursor on the side with the room: it is as wide as the names in it, and
          // held at a fixed 200 px from the right edge it ran out past the panel
          style={hx > w / 2 ? { right: w - hx + 10, top: TOP } : { left: hx + 10, top: TOP }}
          role="status"
        >
          <div className="apx-trk-tip__at">{((hover * path.ds) / 1000).toFixed(2)} km</div>
          {racers.map((r, k) => (
            <div key={r.vehicle.id} className="apx-trk-tip__row">
              <i style={{ background: r.color }} />
              <b>{Math.round(r.lap.v[hover] * KMH)}</b>
              <span>km/h</span>
              {k > 0 && <b>{gapText(data.deltas[k][hover])} s</b>}
              <span className="apx-trk-tip__limit">{LIMIT_WORD[LIMITS[r.lap.limit[hover]]]}</span>
              <span className="apx-trk-tip__name">{name(r)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
