/**
 * Both cars' paths from straight above (picture.ts), north-up: the road running bottom to top,
 * the line the driver aimed for fine-dashed, each car's path in its colour.
 *  - Live (`until`): the inset on the question's card, each path drawn as far as the playhead,
 *    each car a small icon where it is.
 *  - The ending (the same card, grown): the whole stretch, each car where it ended with its name
 *    and its outcome in a few words on its path, the gaps measured as on a drawing, and a scale
 *    bar whose sideways metre is drawn as long as it is drawn (×5).
 *  - Small (`mini`): one car's path alone, the car at its end drawn as its layout sketch
 *    (engine, driven wheels, the end that let go red): every layout's same test, in a row.
 */
import { useMemo, type CSSProperties } from 'react';
import { useTheme } from '../../scene/theme';
import { HUB_ORDER } from '../../sim/scenarios';
import { DRIVE_COLORS } from './colors';
import { SketchBody, type Sketch } from './LayoutSketch';
import { usePathPicture, type PathPicture, type PicDim, type PicMark } from './picture';
import { useDrive } from './state';

/** room round the drawing (px); across it, room for the cars' names too */
const PAD = 26;
const PAD_X = 104;
/** a name longer than this (characters) goes on two lines */
const NAME_LINE = 14;
/** the cars are drawn this long (px), whatever the scale: small, beside their lines */
const CAR_PX = 22;
const CAR_PX_LIVE = 14;
/** a small picture's car, drawn as its layout sketch, this long (px) */
const SKETCH_PX = 34;

export const replayRun = () => {
  usePathPicture.setState({ open: false });
  useDrive.getState().restart();
};
export const nextQuestion = () => {
  usePathPicture.setState({ open: false });
  const d = useDrive.getState();
  d.setScenario(HUB_ORDER[(HUB_ORDER.indexOf(d.scenario) + 1) % HUB_ORDER.length]);
};

/** The drawing fitted into w × h px: picture metres to px (y down); `side`, the room across
 *  for names (px). */
function fit(pic: PathPicture, w: number, h: number, side = PAD_X, pad = PAD) {
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  const add = (u: number, v: number) => {
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  };
  const pts = (a: readonly number[]) => {
    for (let i = 0; i + 1 < a.length; i += 2) add(a[i], a[i + 1]);
  };
  if (pic.planned) pts(pic.planned);
  for (const c of pic.cars) {
    pts(c.line);
    add(c.end.u, c.end.v);
  }
  for (const r of pic.refs) pts(r.line);
  for (const g of pic.dims) {
    add(g.a[0], g.a[1]);
    add(g.b[0], g.b[1]);
  }
  const padX = Math.min(side, w * 0.3);
  const k = Math.min((w - 2 * padX) / Math.max(1, u1 - u0), (h - 2 * pad) / Math.max(1, v1 - v0));
  // centred
  const ox = (w - k * (u1 - u0)) / 2 - k * u0;
  const oy = (h - k * (v1 - v0)) / 2 + k * v1;
  return { k, x: (u: number) => ox + k * u, y: (v: number) => oy - k * v };
}

type Fit = ReturnType<typeof fit>;

/** A car's name on one line, or two split at the space nearest its middle. */
function nameLines(name: string): string[] {
  if (name.length <= NAME_LINE) return [name];
  let at = -1;
  for (let i = 0; i < name.length; i++)
    if (
      name[i] === ' ' &&
      (at < 0 || Math.abs(i - name.length / 2) < Math.abs(at - name.length / 2))
    )
      at = i;
  return at < 0 ? [name] : [name.slice(0, at), name.slice(at + 1)];
}

const poly = (f: Fit, a: readonly number[], n = a.length / 2) => {
  let d = '';
  for (let i = 0; i < n; i++)
    d += `${i ? 'L' : 'M'}${f.x(a[2 * i]).toFixed(1)} ${f.y(a[2 * i + 1]).toFixed(1)}`;
  return d;
};

/** A car from above, nose up before it is turned: a rounded body and a windscreen line. */
function CarIcon({
  f,
  m,
  size,
  color,
  px = CAR_PX,
}: {
  f: Fit;
  m: PicMark;
  size: [number, number];
  color: string;
  px?: number;
}) {
  const l = px;
  const w = (px * size[1]) / size[0];
  return (
    <g
      transform={`translate(${f.x(m.u).toFixed(1)} ${f.y(m.v).toFixed(1)}) rotate(${(-m.deg).toFixed(1)})`}
    >
      <rect
        x={-w / 2}
        y={-l / 2}
        width={w}
        height={l}
        rx={Math.min(w, l) * 0.28}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
      <path
        d={`M ${-w * 0.36} ${-l * 0.18} H ${w * 0.36}`}
        stroke="var(--bg-solid)"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </g>
  );
}

/** A dimension, as on a drawing: extension lines from the points measured out to a dimension
 *  line between them, arrowheads at its ends. */
function Dim({ f, g, color }: { f: Fit; g: PicDim; color: string }) {
  const [ax, ay, bx, by] = [f.x(g.a[0]), f.y(g.a[1]), f.x(g.b[0]), f.y(g.b[1])];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  // along the dimension line, and square to it
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const head = Math.min(7, len / 2.5);
  const arrow = (x: number, y: number, s: number) =>
    `M${x + s * (ux * head - uy * head * 0.45)} ${y + s * (uy * head + ux * head * 0.45)}L${x} ${y}L${x + s * (ux * head + uy * head * 0.45)} ${y + s * (uy * head - ux * head * 0.45)}`;
  const ext = (p: [number, number], x: number, y: number) =>
    `M${f.x(p[0]).toFixed(1)} ${f.y(p[1]).toFixed(1)}L${(x + (x - f.x(p[0])) * 0.08).toFixed(1)} ${(y + (y - f.y(p[1])) * 0.08).toFixed(1)}`;
  return (
    <g stroke={color} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={`${ext(g.a0, ax, ay)}${ext(g.b0, bx, by)}`} strokeWidth={1} opacity={0.7} />
      <path d={`M${ax} ${ay}L${bx} ${by}${arrow(ax, ay, 1)}${arrow(bx, by, -1)}`} strokeWidth={2} />
    </g>
  );
}

/**
 * Where a car points (dashed, its nose) against where it goes (solid, its path), drawn large
 * from where it ended, with the angle between: a rear sliding out turns the nose in from the
 * path, a front pushing keeps it along the path.
 */
function Nose({ f, m, color, len = 58 }: { f: Fit; m: PicMark; color: string; len?: number }) {
  const x = f.x(m.u);
  const y = f.y(m.v);
  const end = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return [x - r * Math.sin(a), y - r * Math.cos(a)] as const;
  };
  const goes = m.course ?? m.deg;
  const [gx, gy] = end(goes, len);
  const [px, py] = end(m.deg, len);
  const [ax, ay] = end(goes, len * 0.6);
  const [bx, by] = end(m.deg, len * 0.6);
  const sweep = m.deg > goes ? 0 : 1;
  // the arrowhead on "goes", square to it
  const g = (goes * Math.PI) / 180;
  const hx = Math.sin(g);
  const hy = Math.cos(g);
  return (
    <g stroke={color} fill="none" strokeLinecap="round" className="apx-drive-pic__nose">
      <path d={`M${x} ${y}L${gx} ${gy}`} strokeWidth={2.5} />
      <path
        d={`M${gx + 7 * hx - 4 * hy} ${gy + 7 * hy + 4 * hx}L${gx} ${gy}L${gx + 7 * hx + 4 * hy} ${gy + 7 * hy - 4 * hx}`}
        strokeWidth={2.5}
      />
      <path d={`M${x} ${y}L${px} ${py}`} strokeWidth={2} strokeDasharray="5 4" />
      {Math.abs(m.deg - goes) >= 1 && (
        <path
          d={`M${ax} ${ay}A${len * 0.6} ${len * 0.6} 0 0 ${sweep} ${bx} ${by}`}
          strokeWidth={1.5}
        />
      )}
    </g>
  );
}

/**
 * The picture's scale, bottom left: 10 m along the road and 1 m across it, each bar as long as
 * that distance is drawn. Sideways is drawn larger than along (×n), so the metre across stands
 * out as long beside the ten along: the stretch is seen, not said.
 */
function Scale({ f, n, h }: { f: Fit; n: number; h: number }) {
  const along = 10 * f.k;
  const side = n * f.k;
  const x = 14;
  const y = h - 14;
  return (
    <g className="apx-drive-pic__scale">
      <path d={`M${x} ${y}V${y - along}M${x - 3} ${y}H${x + 3}M${x - 3} ${y - along}H${x + 3}`} />
      <text x={x + 6} y={y - along / 2 + 4}>
        10 m
      </text>
      {n > 1 && (
        <>
          <path
            d={`M${x} ${y + 6}H${x + side}M${x} ${y + 3}V${y + 9}M${x + side} ${y + 3}V${y + 9}`}
            className="is-side"
          />
          <text x={x + side + 5} y={y + 10}>
            1 m
          </text>
        </>
      )}
    </g>
  );
}

/** Where a car is at time t along its drawn path: how many of its points are behind it, and
 *  the point between the last of them and the next (not there yet: where its path starts). */
function along(c: PathPicture['cars'][number], t: number, out: PicMark): number {
  const ts = c.ts;
  let n = 0;
  while (n < ts.length && ts[n] <= t) n++;
  if (n === 0) {
    out.u = c.line[0];
    out.v = c.line[1];
    const du = c.line[2] - c.line[0];
    const dv = c.line[3] - c.line[1];
    out.deg = du || dv ? (Math.atan2(dv, du) * 180) / Math.PI - 90 : 0;
    return 0;
  }
  const i = n - 1;
  const j = Math.min(ts.length - 1, n);
  const w = j > i && ts[j] > ts[i] ? Math.min(1, (t - ts[i]) / (ts[j] - ts[i])) : 0;
  out.u = c.line[2 * i] + (c.line[2 * j] - c.line[2 * i]) * w;
  out.v = c.line[2 * i + 1] + (c.line[2 * j + 1] - c.line[2 * i + 1]) * w;
  // which way it goes, from the last stretch drawn
  const k = Math.max(0, i - 2);
  const du = out.u - c.line[2 * k];
  const dv = out.v - c.line[2 * k + 1];
  out.deg = du || dv ? (Math.atan2(dv, du) * 180) / Math.PI - 90 : 0;
  return n;
}

/**
 * The picture, w × h px (also on the #/dev/drive sandbox). `until`: live, the paths drawn as far
 * as that moment (s of sim time) with the cars where they are then, and no words. `mini`: one
 * car's path alone (car A's), small, no words, its car red if an end of it let go.
 */
export function PathDrawing({
  pic,
  w,
  h,
  until,
  mini = false,
  sketch,
  color: tint,
}: {
  pic: PathPicture;
  w: number;
  h: number;
  until?: number;
  mini?: boolean;
  /** small: the car drawn as this layout sketch (its engine in it) */
  sketch?: Sketch;
  /** the colour of car A's path (its own, by default) */
  color?: string;
}) {
  const theme = useTheme((s) => s.theme);
  const colors = DRIVE_COLORS[theme];
  const live = until !== undefined;
  // (live or small: no words, no measures)
  const plain = live || mini;
  const pad = plain ? 10 : PAD;
  const f = useMemo(() => fit(pic, w, h, plain ? pad : PAD_X, pad), [pic, w, h, plain, pad]);
  const color = (i: number) => (i === 0 ? (tint ?? colors.you) : colors.rival);
  const cars = mini ? [0] : [1, 0];
  // live: each car where it is now
  const now = pic.cars.map((c) => {
    const m: PicMark = { u: 0, v: 0, deg: 0 };
    const n = live ? along(c, until, m) : c.ts.length;
    return { m, n };
  });
  // each car's name and its outcome beside where it ended, out to the side away from the other
  const labels = pic.cars.map((c, i) => {
    const o = pic.cars[1 - i];
    // about how wide the label is (px), so it never runs off the drawing's edge
    const wide = 6.8 * Math.max(...nameLines(c.name).map((l) => l.length), c.word.length);
    let left = c.end.u < o.end.u || (Math.abs(c.end.u - o.end.u) < 1e-6 && i === 0);
    if (left && f.x(c.end.u) - 16 - wide < 4) left = false;
    else if (!left && f.x(c.end.u) + 16 + wide > w - 4) left = true;
    const x = f.x(c.end.u) + (left ? -1 : 1) * 16;
    const anchor: 'end' | 'start' = left ? 'end' : 'start';
    const lines = nameLines(c.name).length + (c.word ? 1 : 0);
    return { x, y: f.y(c.end.v), anchor, name: c.name, word: c.word, lines };
  });
  // the two labels on the same side and level: car B's moves below car A's
  const [la, lb] = labels;
  if (la && lb && la.anchor === lb.anchor && Math.abs(la.y - lb.y) < 16 * la.lines + 8)
    lb.y = la.y + 16 * la.lines + 8;
  const aimed = pic.plannedAt;
  return (
    <svg
      className={`apx-drive-pic__svg${plain ? ' is-live' : ''}`}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      role="img"
      aria-label="Both cars' paths from above"
      style={{ '--slide': colors.slide, '--steer': colors.steer } as CSSProperties}
    >
      {/* where the driver aimed, and which way the cars go */}
      {pic.planned && <path d={poly(f, pic.planned)} className="apx-drive-pic__planned" />}
      {aimed && !plain && (
        <text className="apx-drive-pic__aimed" x={f.x(aimed.u) + 10} y={f.y(aimed.v) + 4}>
          aimed
        </text>
      )}
      {!plain &&
        pic.arrows.map((m, i) => (
          <path
            key={i}
            className="apx-drive-pic__arrow"
            transform={`translate(${f.x(m.u).toFixed(1)} ${f.y(m.v).toFixed(1)}) rotate(${(-m.deg).toFixed(1)})`}
            d="M -6 5 L 0 -3 L 6 5"
          />
        ))}
      {pic.event && (
        <g
          className="apx-drive-pic__event"
          transform={`translate(${f.x(pic.event.u).toFixed(1)} ${f.y(pic.event.v).toFixed(1)}) rotate(${(-pic.event.deg).toFixed(1)})`}
        >
          <path d={plain ? 'M -8 0 H 8' : 'M -14 0 H 14'} />
          {!plain && (
            <text x={-18} y={4} textAnchor="end">
              {pic.event.label}
            </text>
          )}
        </g>
      )}
      {!plain &&
        pic.refs.map((r, i) => (
          <path
            key={`r${i}`}
            d={poly(f, r.line)}
            className="apx-drive-pic__ref"
            style={{ '--sys': color(r.car) } as CSSProperties}
          />
        ))}
      {/* car A's path over car B's: the two are one until the driver's action */}
      {cars.map((i) =>
        now[i].n > 1 ? (
          <path
            key={`l${i}`}
            d={
              live
                ? `${poly(f, pic.cars[i].line, now[i].n)}L${f.x(now[i].m.u).toFixed(1)} ${f.y(now[i].m.v).toFixed(1)}`
                : poly(f, pic.cars[i].line)
            }
            className="apx-drive-pic__line"
            stroke={color(i)}
            strokeWidth={mini ? 2 : i === 0 ? 3 : 2.5}
          />
        ) : null,
      )}
      {!plain && pic.dims.map((g, i) => <Dim key={`d${i}`} f={f} g={g} color={color(g.car)} />)}
      {!plain &&
        pic.spots.map((p, i) => (
          <circle key={`s${i}`} cx={f.x(p.u)} cy={f.y(p.v)} r={7} className="apx-drive-pic__spot" />
        ))}
      {cars.map((i) => {
        const c = pic.cars[i];
        if (live)
          return (
            // (not at the stretch yet: waiting, faint, where its path starts)
            <g key={`c${i}`} opacity={now[i].n > 0 ? 1 : 0.45}>
              <CarIcon f={f} m={now[i].m} size={c.size} color={color(i)} px={CAR_PX_LIVE} />
            </g>
          );
        if (mini)
          return sketch ? (
            // the car where it ended as its layout sketch: where its engine sits, the end of it
            // that let go red (all of it, spun)
            <g
              key={`c${i}`}
              transform={`translate(${f.x(c.end.u).toFixed(1)} ${f.y(c.end.v).toFixed(1)}) rotate(${(-c.end.deg).toFixed(1)})`}
            >
              <SketchBody
                s={sketch}
                k={SKETCH_PX / (sketch.nose - sketch.tail)}
                color={c.word === 'spun' ? colors.slide : color(i)}
                out={c.out}
                slide={colors.slide}
              />
            </g>
          ) : (
            <CarIcon
              key={`c${i}`}
              f={f}
              m={c.end}
              size={c.size}
              color={c.slid ? colors.slide : color(i)}
              px={CAR_PX_LIVE}
            />
          );
        return (
          <g key={`c${i}`}>
            {c.nose && <Nose f={f} m={c.end} color={color(i)} />}
            <CarIcon f={f} m={c.end} size={c.size} color={color(i)} />
          </g>
        );
      })}
      {!plain &&
        labels.map((l, i) => (
          <text
            key={`t${i}`}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor}
            className="apx-drive-pic__name"
            fill={color(i)}
          >
            {nameLines(l.name).map((line, k) => (
              <tspan key={k} x={l.x} dy={k ? '1.15em' : '0.3em'}>
                {line}
              </tspan>
            ))}
            {l.word && (
              <tspan x={l.x} dy="1.3em" className={`apx-drive-pic__word is-${pic.cars[i].tone}`}>
                {l.word}
              </tspan>
            )}
          </text>
        ))}
      {!plain && <Scale f={f} n={pic.n} h={h} />}
    </svg>
  );
}
