/**
 * The circuit in 3D: an asphalt ribbon between the measured edges with white edge lines,
 * red-and-white kerbs through the corners, the start/finish line, a mark across each sector's start and,
 * optionally, the racing line. Flat (y = 0): the sim frame (x, y left) maps to the world as
 * (X = x, Z = −y). One geometry per kind, built once per track; unlit, so it reads the same
 * from the chase camera and from high above.
 */
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MeshBasicMaterial,
  type Material,
} from 'three';
import { useTheme } from '../../scene/theme';
import type { RaceLine, TrackPath } from '../../sim/track';
import { TRACK_COLORS } from './colors';
import { playback, useHotLap } from './state';

/** surface height (m): just above the floor grid, under the cars' shadow catcher */
const Y = 0.004;
const EDGE = 0.3;
const KERB = 1.1;
/** kerb stripes (m) and the curvature (1/m) that earns a kerb */
const STRIPE = 3;
const KERB_K = 1 / 160;
/** corner names show within this distance ahead of car A in the chase view (m) */
const LABEL_AHEAD = 320;

const HEX = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const rgb = (hex: string): [number, number, number] => {
  const m = HEX.exec(hex);
  return m
    ? ([1, 2, 3].map((i) => parseInt(m[i], 16) / 255) as [number, number, number])
    : [1, 1, 1];
};

/** An offset from the path (m, + left): the same all round, or per sample. */
export type Offset = number | ((j: number) => number);

/** A strip between two offsets from a path, as triangles, optionally coloured per quad. */
export function strip(
  xs: Float64Array,
  ys: Float64Array,
  psi: Float64Array,
  from: number,
  to: number,
  lo: Offset,
  hi: Offset,
  y = Y,
  color?: (i: number) => [number, number, number],
): { pos: number[]; col: number[] } {
  const n = xs.length;
  const pos: number[] = [];
  const col: number[] = [];
  const at = (i: number, off: Offset) => {
    const j = ((i % n) + n) % n;
    const o = typeof off === 'number' ? off : off(j);
    return [xs[j] - o * Math.sin(psi[j]), y, -(ys[j] + o * Math.cos(psi[j]))];
  };
  for (let i = from; i < to; i++) {
    const a = at(i, lo);
    const b = at(i, hi);
    const c = at(i + 1, lo);
    const d = at(i + 1, hi);
    pos.push(...a, ...c, ...b, ...b, ...c, ...d);
    if (color) {
      const k = color(i);
      for (let v = 0; v < 6; v++) col.push(...k);
    }
  }
  return { pos, col };
}

export function geometry(pos: number[], col?: number[]): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  if (col?.length) g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeBoundingSphere();
  return g;
}

/** The stretches that get kerbs: wherever the road curves tighter than KERB_K, a little longer. */
function kerbRuns(path: TrackPath): [number, number][] {
  const runs: [number, number][] = [];
  const pad = Math.round(8 / path.ds);
  let start = -1;
  for (let i = 0; i <= path.n; i++) {
    const tight = i < path.n && Math.abs(path.k[i]) > KERB_K;
    if (tight && start < 0) start = i;
    if (!tight && start >= 0) {
      runs.push([start - pad, i + pad]);
      start = -1;
    }
  }
  return runs;
}

function useRibbon(path: TrackPath, line: RaceLine, theme: 'dark' | 'light') {
  const c = TRACK_COLORS[theme];
  return useMemo(() => {
    const { n, x, y, psi, wl, wr } = path;
    // the measured edges, left (+) and right (−) of the centreline
    const L = (d: number) => (j: number) => wl[j] + d;
    const R = (d: number) => (j: number) => -wr[j] + d;
    const asphalt = strip(x, y, psi, 0, n, R(EDGE), L(-EDGE));
    const edges = [strip(x, y, psi, 0, n, L(-EDGE), L(0)), strip(x, y, psi, 0, n, R(0), R(EDGE))];
    const red = rgb(c.kerbRed);
    const white = rgb(c.kerbWhite);
    const stripe = (i: number) => (Math.floor((i * path.ds) / STRIPE) % 2 ? red : white);
    const kerbs = { pos: [] as number[], col: [] as number[] };
    for (const [a, b] of kerbRuns(path))
      for (const [lo, hi] of [
        [L(0), L(KERB)],
        [R(-KERB), R(0)],
      ]) {
        const s = strip(x, y, psi, a, b, lo, hi, Y, stripe);
        kerbs.pos.push(...s.pos);
        kerbs.col.push(...s.col);
      }
    // the start/finish line and the sector marks: short strips across the road
    const across = (s: number, len: number) => {
      const i = Math.round(s / path.ds) % n;
      const ux = Math.cos(psi[i]);
      const uy = Math.sin(psi[i]);
      const lx = -uy;
      const ly = ux;
      const p = (u: number, o: number) => [
        x[i] + u * ux + o * lx,
        Y + 0.001,
        -(y[i] + u * uy + o * ly),
      ];
      const a = p(-len / 2, -wr[i]);
      const b = p(-len / 2, wl[i]);
      const cc = p(len / 2, -wr[i]);
      const d = p(len / 2, wl[i]);
      return [...a, ...cc, ...b, ...b, ...cc, ...d];
    };
    const start = across(0, 1.2);
    const sectors = path.sectors.slice(1).flatMap((s) => across(s, 0.6));
    const racing = strip(line.x, line.y, line.psi, 0, n, -0.12, 0.12, Y + 0.002);
    const all = [...asphalt.pos, ...edges[0].pos, ...edges[1].pos];
    return {
      asphalt: geometry(asphalt.pos),
      edges: geometry([...edges[0].pos, ...edges[1].pos]),
      kerbs: geometry(kerbs.pos, kerbs.col),
      start: geometry(start),
      sectors: geometry(sectors),
      racing: geometry(racing.pos),
      count: all.length / 3,
    };
  }, [path, line, c]);
}

const flat = (color: string, extra: Partial<MeshBasicMaterial> = {}) =>
  Object.assign(new MeshBasicMaterial({ color, side: DoubleSide }), extra);

export function Ribbon({ path, line }: { path: TrackPath; line: RaceLine }) {
  const theme = useTheme((s) => s.theme);
  const c = TRACK_COLORS[theme];
  const geo = useRibbon(path, line, theme);
  const showLine = useHotLap((s) => s.line);
  const mats = useMemo(
    () => ({
      asphalt: flat(c.asphalt),
      edge: flat(c.edge),
      kerb: Object.assign(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })),
      start: flat(c.start, {
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -8,
      }),
      sector: flat(c.sector, {
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -8,
      }),
      line: flat(c.line, {
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -12,
      }),
    }),
    [c],
  );
  useEffect(() => () => Object.values(mats).forEach((m: Material) => m.dispose()), [mats]);
  useEffect(
    () => () => {
      for (const g of [geo.asphalt, geo.edges, geo.kerbs, geo.start, geo.sectors, geo.racing])
        g.dispose();
    },
    [geo],
  );
  return (
    <group>
      <mesh geometry={geo.asphalt} material={mats.asphalt} receiveShadow />
      <mesh geometry={geo.edges} material={mats.edge} />
      <mesh geometry={geo.kerbs} material={mats.kerb} />
      <mesh geometry={geo.start} material={mats.start} renderOrder={2} />
      <mesh geometry={geo.sectors} material={mats.sector} renderOrder={2} />
      <mesh geometry={geo.racing} material={mats.line} visible={showLine} renderOrder={3} />
      <CornerLabels path={path} />
    </group>
  );
}

/**
 * Each corner's name beside its apex, on the outside. From above all of them; in the chase view
 * only the next few, so the road ahead is labelled and the rest of the circuit isn't.
 */
function CornerLabels({ path }: { path: TrackPath }) {
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const camera = useHotLap((s) => s.camera);
  const spots = useMemo(
    () =>
      path.corners.map((c) => {
        const i = Math.round(c.apex / path.ds) % path.n;
        // on the outside of the corner, clear of the kerb
        const o = c.dir > 0 ? -(path.wr[i] + 6) : path.wl[i] + 6;
        return {
          name: c.name,
          s: c.apex,
          at: [
            path.x[i] - o * Math.sin(path.psi[i]),
            1,
            -(path.y[i] + o * Math.cos(path.psi[i])),
          ] as [number, number, number],
        };
      }),
    [path],
  );
  useFrame(() => {
    const here = playback.at * path.ds;
    for (let k = 0; k < spots.length; k++) {
      const el = refs.current[k];
      if (!el) continue;
      const ahead = (spots[k].s - here + path.length) % path.length;
      const show = camera === 'map' || ahead < LABEL_AHEAD;
      const want = show ? '' : 'none';
      if (el.style.display !== want) el.style.display = want;
    }
  });
  return (
    <>
      {spots.map((s, k) => (
        <Html
          key={`${s.name}${k}`}
          position={s.at}
          center
          zIndexRange={[0, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span
            className="apx-trk-corner"
            ref={(el) => {
              refs.current[k] = el;
            }}
          >
            {s.name}
          </span>
        </Html>
      ))}
    </>
  );
}
