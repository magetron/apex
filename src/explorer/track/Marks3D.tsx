/**
 * What the laps say, marked on the circuit itself:
 *  - LimitBands: beside the road, one band per car in its colour wherever it was
 *    traction-limited (its driven tyres at their limit with power to spare), so a front-drive
 *    car's long bands out of the slow corners show where its layout costs it; they fade out
 *    towards the camera, so right beside the chase camera they don't weigh on the view;
 *  - MomentLabels: where the gaps change most, a tag in the car's colour ("+2.5 s") at that
 *    stretch of road: all of them from above, the one ahead of car A in the chase.
 */
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { DoubleSide, MeshBasicMaterial } from 'three';
import { limitRuns, TRACTION, type Moment, type RaceLine, type TrackPath } from '../../sim/track';
import { geometry, strip } from './Ribbon';
import { momentSpots, playback, useHotLap, type Racer } from './state';

/** bands: width and gap (m), close to the road for the chase, wide enough to see from above */
const NEAR = { w: 0.9, gap: 0.35, from: 2.2 };
const FAR = { w: 7, gap: 2, from: 4 };
/** the bands fade in from this close to the camera to this far (m), from this share of their
 *  colour; from above the camera is far beyond, so the map shows them whole */
const FADE = { from: 5, to: 35, floor: 0.2 };
/** a moment's tag shows in the chase from this far before its stretch (m) */
const MOMENT_AHEAD = 260;
/** two cars' moments on one stretch: the second tag this far under the first (px) */
const STACK_PX = 24;

/** Fade a band's colour out towards the camera (view depth), in its fragment shader. */
function fadeNearCamera(m: MeshBasicMaterial): MeshBasicMaterial {
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vDepth;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n\tvDepth = -mvPosition.z;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vDepth;')
      .replace(
        '#include <opaque_fragment>',
        `\tdiffuseColor.a *= mix(${FADE.floor.toFixed(2)}, 1.0, smoothstep(${FADE.from.toFixed(1)}, ${FADE.to.toFixed(1)}, vDepth));\n#include <opaque_fragment>`,
      );
  };
  // the constants are baked into the shader: they belong in its cache key
  m.customProgramCacheKey = () => `apx-trk-band-fade-${FADE.from}-${FADE.to}-${FADE.floor}`;
  return m;
}

export function LimitBands({ racers, path }: { racers: Racer[]; line: RaceLine; path: TrackPath }) {
  const camera = useHotLap((s) => s.camera);
  const bands = useMemo(
    () =>
      racers.map((r, k) => {
        const runs = limitRuns(r.lap, TRACTION);
        const build = (o: typeof NEAR) => {
          // beside the left edge as measured
          const lo = (j: number) => path.wl[j] + o.from + k * (o.w + o.gap);
          const hi = (j: number) => lo(j) + o.w;
          const pos: number[] = [];
          for (const [a, b] of runs) pos.push(...strip(path.x, path.y, path.psi, a, b, lo, hi).pos);
          return geometry(pos);
        };
        return {
          near: build(NEAR),
          far: build(FAR),
          mat: fadeNearCamera(
            new MeshBasicMaterial({
              color: r.color,
              side: DoubleSide,
              transparent: true,
              opacity: 0.85,
              depthWrite: false,
            }),
          ),
        };
      }),
    [racers, path],
  );
  useEffect(
    () => () =>
      bands.forEach((b) => {
        b.near.dispose();
        b.far.dispose();
        b.mat.dispose();
      }),
    [bands],
  );
  return (
    <>
      {bands.map((b, k) => (
        <mesh
          key={k}
          geometry={camera === 'map' ? b.far : b.near}
          material={b.mat}
          renderOrder={2}
        />
      ))}
    </>
  );
}

export function MomentLabels({
  moments,
  racers,
  path,
}: {
  moments: Moment[];
  racers: Racer[];
  path: TrackPath;
}) {
  const camera = useHotLap((s) => s.camera);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const spots = useMemo(
    () =>
      moments.map((m, j) => {
        // two cars' moments on one stretch stack, one under the other
        const below = moments.slice(0, j).filter((q) => q.section === m.section).length;
        const mid = (m.section.s0 + m.section.s1) / 2;
        const i = Math.round(mid / path.ds) % path.n;
        // across the road from the bands
        const o = -(path.wr[i] + 14);
        return {
          below,
          s0: m.section.s0,
          s1: m.section.s1,
          color: racers[m.car].color,
          text: `${m.change < 0 ? '−' : '+'}${Math.abs(m.change).toFixed(1)} s`,
          at: [
            path.x[i] - o * Math.sin(path.psi[i]),
            1.5,
            -(path.y[i] + o * Math.cos(path.psi[i])),
          ] as [number, number, number],
        };
      }),
    [moments, racers, path],
  );
  // published for the name tags (state.ts), sized now and then, never read back every frame
  useEffect(() => {
    momentSpots.length = 0;
    for (const s of spots)
      momentSpots.push({
        x: s.at[0],
        y: s.at[1],
        z: s.at[2],
        dy: s.below * STACK_PX,
        w: 60,
        h: 20,
        on: false,
      });
    return () => {
      momentSpots.length = 0;
    };
  }, [spots]);
  const frame = useRef(0);
  useFrame(() => {
    const here = playback.at * path.ds;
    const measure = frame.current++ % 30 === 0;
    for (let k = 0; k < spots.length; k++) {
      const el = refs.current[k];
      if (!el) continue;
      const ahead = spots[k].s0 - here;
      const show =
        camera === 'map' || (ahead < MOMENT_AHEAD && here < spots[k].s1 + 40 && playback.t > 0);
      const want = show ? '' : 'none';
      if (el.style.display !== want) el.style.display = want;
      const m = momentSpots[k];
      if (!m) continue;
      m.on = show;
      if (show && measure) {
        m.w = el.offsetWidth;
        m.h = el.offsetHeight;
      }
    }
  });
  return (
    <>
      {spots.map((s, k) => (
        <Html key={k} position={s.at} center zIndexRange={[0, 0]} style={{ pointerEvents: 'none' }}>
          <span
            className="apx-trk-moment"
            style={
              { '--c': s.color, transform: `translateY(${s.below * STACK_PX}px)` } as CSSProperties
            }
            ref={(el) => {
              refs.current[k] = el;
            }}
          >
            {s.text}
          </span>
        </Html>
      ))}
    </>
  );
}
