/**
 * #/dev/likeness — tune the look-alike bodies against real side-profile photos.
 *  - Overlay: the car side-on through a very narrow field of view (≈ orthographic) with the
 *    photo on top, scaled and levelled so the photo's wheel centres sit on the model's axles.
 *  - Measure: click the two wheel centres to calibrate, then click along a curve (roof line,
 *    belt, underside, window outline); the clicks come out as vehicle-frame mm, ready to paste
 *    into src/vehicle3d/bodies/<id>.ts.
 * Dev only: photos load from Wikimedia Commons at runtime and are never bundled.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  DoubleSide,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  type Group,
  type Mesh,
  type Texture,
} from 'three';
import { create } from 'zustand';
import { Button, Dock, Panel, Segmented, Select, Slider } from '../app/ui';
import { useScene } from '../scene/store';
import { getVehicle, listVehicles } from '../spec/catalog';
import type { VehicleSpec } from '../spec/types';
import { VehicleModel } from '../vehicle3d';
import { LIKENESS_REFS } from './likenessRefs';

type UV = [number, number];
type Curve = 'axles' | 'top' | 'belt' | 'bottom' | 'dlo';

interface LkState {
  vehicleId: string;
  url: string;
  facing: 'left' | 'right';
  aspect: number;
  front: UV | null;
  rear: UV | null;
  opacity: number;
  /** perspective depth ratio of the centre plane vs the side plane (see calib) */
  depth: number;
  /** overlay: scale the photo for centre-plane (roof, nose, tail) or side-plane features */
  plane: 'centre' | 'side';
  mode: 'overlay' | 'measure';
  curve: Curve;
  pts: Record<Exclude<Curve, 'axles'>, UV[]>;
}

const emptyPts = () => ({ top: [], belt: [], bottom: [], dlo: [] });

function fromRef(vehicleId: string): Partial<LkState> {
  const r = LIKENESS_REFS[vehicleId];
  return r
    ? {
        url: r.url,
        facing: r.facing,
        aspect: r.aspect,
        front: r.front,
        rear: r.rear,
        depth: r.depth ?? 1,
        pts: emptyPts(),
      }
    : { url: '', front: null, rear: null, pts: emptyPts() };
}

const first = Object.keys(LIKENESS_REFS)[0] ?? 'porsche-911-992';
const useLk = create<LkState>()(() => ({
  vehicleId: first,
  url: '',
  facing: 'right',
  aspect: 2,
  front: null,
  rear: null,
  opacity: 0.5,
  depth: 1,
  plane: 'centre',
  mode: 'overlay',
  curve: 'axles',
  pts: emptyPts(),
  ...fromRef(first),
}));

/**
 * Photo (u,v) → vehicle frame mm (front axle x = 0, ground y = 0), levelled on the axle line.
 * The axles calibrate the SIDE plane (where the wheels are). Close-range photos shrink things on
 * the car's CENTRE plane (roof line, nose and tail tips), which is ~half a width further from the
 * camera, towards the image centre; rho > 1 scales them back out about the image centre.
 */
function calib(s: LkState, v: VehicleSpec) {
  if (!s.front || !s.rear) return null;
  const flip = s.facing === 'left';
  const u = (p: UV) => (flip ? 1 - p[0] : p[0]);
  const fx = u(s.front) * s.aspect;
  const fy = -s.front[1];
  const rx = u(s.rear) * s.aspect;
  const ry = -s.rear[1];
  const theta = Math.atan2(fy - ry, fx - rx);
  const k = v.dims.wheelbaseMm / Math.hypot(fx - rx, fy - ry);
  const R = v.tires.diameterMm / 2;
  const cos = Math.cos(-theta);
  const sin = Math.sin(-theta);
  const side = (p: UV): [number, number] => {
    const dx = u(p) * s.aspect - fx;
    const dy = -p[1] - fy;
    return [(dx * cos - dy * sin) * k, R + (dx * sin + dy * cos) * k];
  };
  const c0 = side([0.5, 0.5]);
  const toMm = (p: UV, rho = 1): [number, number] => {
    const q = side(p);
    return [Math.round(c0[0] + (q[0] - c0[0]) * rho), Math.round(c0[1] + (q[1] - c0[1]) * rho)];
  };
  /** the depth ratio that makes the traced nose-to-tail length the car's real length */
  const autoDepth = (pts: UV[]) => {
    if (pts.length < 2) return null;
    const xs = pts.map((p) => side(p)[0]);
    return v.dims.lengthMm / (Math.max(...xs) - Math.min(...xs));
  };
  return { toMm, k, theta, flip, c0, autoDepth };
}

function PhotoPlane({ v }: { v: VehicleSpec }) {
  const s = useLk();
  const [tex, setTex] = useState<Texture | null>(null);
  useEffect(() => {
    if (!s.url) return setTex(null);
    const loader = new TextureLoader();
    loader.setCrossOrigin('anonymous');
    let live = true;
    loader.load(s.url, (t) => {
      t.colorSpace = SRGBColorSpace;
      if (live) {
        setTex(t);
        const img = t.image as HTMLImageElement;
        if (img?.naturalWidth) useLk.setState({ aspect: img.naturalWidth / img.naturalHeight });
      }
    });
    return () => {
      live = false;
    };
  }, [s.url]);
  // the photo is drawn first and opaque; the model goes over it as a translucent silhouette
  const mat = useMemo(
    () => new MeshBasicMaterial({ depthTest: false, depthWrite: false, side: DoubleSide }),
    [],
  );
  const geo = useMemo(() => new PlaneGeometry(1, 1), []);
  mat.map = tex;
  mat.needsUpdate = true;
  const c = calib(s, v);
  if (!c || !tex) return null;
  // image centre in vehicle mm, then into the scene (the car is centred on its wheelbase);
  // for centre-plane comparison the photo is scaled about that centre by the depth ratio
  const centre = c.c0;
  const rho = s.plane === 'centre' ? s.depth : 1;
  const M = 0.001;
  const wb = v.dims.wheelbaseMm;
  return (
    <mesh
      geometry={geo}
      material={mat}
      renderOrder={-10}
      position={[(centre[0] + wb / 2) * M, centre[1] * M, -3]}
      rotation={[0, 0, -c.theta]}
      scale={[(c.flip ? -1 : 1) * s.aspect * c.k * rho * M, c.k * rho * M, 1]}
    />
  );
}

/** Near-orthographic side view: tiny field of view from far away. */
function SideCamera({ v }: { v: VehicleSpec }) {
  const camera = useThree((st) => st.camera) as unknown as {
    fov: number;
    updateProjectionMatrix(): void;
  };
  const scene = useThree((st) => st.scene);
  const aspect = useThree((st) => st.size.width / st.size.height);
  const controls = useScene((st) => st.controls);
  useEffect(() => {
    const old = camera.fov;
    camera.fov = 4;
    camera.updateProjectionMatrix();
    // the stage fog (14–45 m) would swallow a camera ~100 m away
    const fog = scene.fog;
    scene.fog = null;
    const maxD = controls?.maxDistance;
    if (controls) controls.maxDistance = 400;
    return () => {
      camera.fov = old;
      camera.updateProjectionMatrix();
      scene.fog = fog;
      if (controls && maxD !== undefined) controls.maxDistance = maxD;
    };
  }, [camera, scene, controls]);
  useEffect(() => {
    if (!controls) return;
    const half = Math.tan((2 * Math.PI) / 180);
    const needW = (v.dims.lengthMm / 1000) * 0.62;
    const needH = (v.dims.heightMm / 1000) * 0.9;
    const d = Math.max(needW / (half * aspect), needH / half);
    const y = v.dims.heightMm / 2000;
    void controls.setLookAt(0, y, d, 0, y, 0, false);
  }, [controls, v, aspect]);
  return null;
}

const silhouette = new MeshBasicMaterial({
  color: '#ff2fb0',
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
});

/** Paints every mesh of the model as one flat translucent colour (re-applied as parts mount). */
function Silhouette({ children }: { children: ReactNode }) {
  const g = useRef<Group>(null);
  const opacity = useLk((s) => s.opacity);
  silhouette.opacity = opacity;
  useFrame(() => {
    g.current?.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh && m.material !== silhouette) m.material = silhouette;
    });
  });
  return <group ref={g}>{children}</group>;
}

export function Scene() {
  const id = useLk((s) => s.vehicleId);
  const v = getVehicle(id);
  return (
    <>
      <SideCamera v={v} />
      <PhotoPlane v={v} />
      <Silhouette>
        <VehicleModel key={v.id} vehicle={v} level="car" />
      </Silhouette>
    </>
  );
}

function Measure() {
  const s = useLk();
  const img = useRef<HTMLImageElement>(null);
  const v = getVehicle(s.vehicleId);
  const c = calib(s, v);
  const click = (e: MouseEvent<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p: UV = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    if (s.curve === 'axles') {
      if (!s.front || (s.front && s.rear)) useLk.setState({ front: p, rear: null });
      else useLk.setState({ rear: p });
    } else {
      useLk.setState({ pts: { ...s.pts, [s.curve]: [...s.pts[s.curve], p] } });
    }
  };
  const dots: { p: UV; c: string }[] = [
    ...(s.front ? [{ p: s.front, c: '#06d6a0' }] : []),
    ...(s.rear ? [{ p: s.rear, c: '#ef476f' }] : []),
    ...Object.entries(s.pts).flatMap(([k, list]) =>
      list.map((p) => ({ p, c: k === s.curve ? '#ffd166' : '#7fdbff' })),
    ),
  ];
  // centre-plane curves get the full depth correction, the side plane none, glass half
  const rhoOf = (k: keyof LkState['pts']) =>
    k === 'belt' ? 1 : k === 'dlo' ? (1 + s.depth) / 2 : s.depth;
  const auto = c?.autoDepth(s.pts.top) ?? null;
  const out = c
    ? `auto depth from length: ${auto ? auto.toFixed(3) : '- (trace nose and tail on Top)'}   using ${s.depth.toFixed(3)}\n` +
      (Object.keys(s.pts) as (keyof LkState['pts'])[])
        .filter((k) => s.pts[k].length)
        .map((k) => {
          const mm = s.pts[k].map((p) => c.toMm(p, rhoOf(k)));
          if (k !== 'dlo') mm.sort((a, b) => b[0] - a[0]);
          return `${k}: [${mm.map(([x, y]) => `[${x}, ${y}]`).join(', ')}],`;
        })
        .join('\n')
    : 'calibrate: click the front wheel centre, then the rear wheel centre';
  return (
    <div
      style={{
        position: 'fixed',
        inset: 'var(--topbar-h) 0 0 0',
        background: 'var(--bg)',
        overflow: 'auto',
        pointerEvents: 'auto',
      }}
    >
      {/* below the control panel so it never covers the photo */}
      <div style={{ position: 'relative', width: '100%', marginTop: 400 }}>
        {s.url && (
          <img
            ref={img}
            src={s.url}
            alt=""
            onClick={click}
            style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
          />
        )}
        {dots.map((d, i) => (
          <i
            key={i}
            style={{
              position: 'absolute',
              left: `${d.p[0] * 100}%`,
              top: `${d.p[1] * 100}%`,
              width: 6,
              height: 6,
              margin: -3,
              borderRadius: 3,
              background: d.c,
              pointerEvents: 'none',
            }}
          />
        ))}
      </div>
      <pre
        id="likeness-out"
        style={{
          font: '12px var(--mono)',
          padding: 12,
          whiteSpace: 'pre-wrap',
          color: 'var(--text)',
        }}
      >
        {`front ${s.front?.map((x) => x.toFixed(4)).join(', ') ?? '-'}  rear ${s.rear?.map((x) => x.toFixed(4)).join(', ') ?? '-'}  aspect ${s.aspect.toFixed(4)}\n${out}`}
      </pre>
    </div>
  );
}

export function Overlay() {
  const s = useLk();
  const ids = listVehicles().map((v) => ({
    value: v.id,
    label: `${LIKENESS_REFS[v.id] ? '● ' : ''}${v.name}`,
  }));
  return (
    <>
      {s.mode === 'measure' && <Measure />}
      <Dock side="top-left">
        <Panel title="Likeness">
          <Select
            label="Car"
            value={s.vehicleId}
            options={ids}
            onChange={(id) => useLk.setState({ vehicleId: id, ...fromRef(id) })}
          />
          <label className="apx-field">
            <span>Photo URL</span>
            <input
              className="apx-select"
              value={s.url}
              onChange={(e) =>
                useLk.setState({ url: e.target.value, front: null, rear: null, pts: emptyPts() })
              }
            />
          </label>
          <Segmented
            label="Facing"
            value={s.facing}
            onChange={(facing) => useLk.setState({ facing })}
            options={[
              { value: 'left', label: 'Nose left' },
              { value: 'right', label: 'Nose right' },
            ]}
          />
          <Segmented
            label="Mode"
            value={s.mode}
            onChange={(mode) => useLk.setState({ mode })}
            options={[
              { value: 'overlay', label: 'Overlay' },
              { value: 'measure', label: 'Measure' },
            ]}
          />
          <Slider
            label="Depth ratio (centre plane)"
            value={s.depth}
            min={0.9}
            max={1.6}
            step={0.005}
            format={(x) => x.toFixed(3)}
            onChange={(depth) => useLk.setState({ depth })}
          />
          {s.mode === 'overlay' ? (
            <>
              <Slider
                label="Model opacity"
                value={s.opacity}
                min={0}
                max={1}
                onChange={(opacity) => useLk.setState({ opacity })}
              />
              <Segmented
                label="Photo plane"
                value={s.plane}
                onChange={(plane) => useLk.setState({ plane })}
                options={[
                  { value: 'centre', label: 'Roof / ends' },
                  { value: 'side', label: 'Sides' },
                ]}
              />
            </>
          ) : (
            <>
              <Segmented<Curve>
                label="Click to add"
                value={s.curve}
                onChange={(curve) => useLk.setState({ curve })}
                options={[
                  { value: 'axles', label: 'Axles' },
                  { value: 'top', label: 'Top' },
                  { value: 'belt', label: 'Belt' },
                  { value: 'bottom', label: 'Bottom' },
                  { value: 'dlo', label: 'Windows' },
                ]}
              />
              <div className="apx-row">
                <Button
                  onClick={() =>
                    useLk.setState({
                      pts: { ...s.pts, ...(s.curve === 'axles' ? {} : { [s.curve]: [] }) },
                    })
                  }
                >
                  Clear curve
                </Button>
                <Button
                  onClick={() => {
                    const c = calib(s, getVehicle(s.vehicleId));
                    const a = c?.autoDepth(s.pts.top);
                    if (a) useLk.setState({ depth: a });
                  }}
                >
                  Depth from length
                </Button>
              </div>
            </>
          )}
        </Panel>
      </Dock>
    </>
  );
}

export { useLk };
