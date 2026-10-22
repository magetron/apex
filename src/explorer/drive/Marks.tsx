/**
 * The manoeuvre's steps painted on the road where they happen: a line across the road and a
 * label at its edge ("Brake", "Turn in", "Lift"…), and for the scripted event a band over the
 * stretch where the driver holds the steering still. The step the visitor's car is in lights up.
 */
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { offsetPoint, type Path, type PathPoint } from '../../sim/scenarios';
import type { DriveColors } from './colors';
import type { Lane } from './lanes';

const tmp: PathPoint = { x: 0, n: 0, h: 0, k: 0 };

/** A flat band along `path` from s0 to s1, from lateral offset l0 to l1 (m, + = left). */
function band(path: Path, s0: number, s1: number, l0: number, l1: number, y: number) {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = Math.max(1, Math.ceil((s1 - s0) / 0.5));
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const [ax, an] = offsetPoint(path, s, l1, tmp);
    const [bx, bn] = offsetPoint(path, s, l0, tmp);
    pos.push(ax, y, -an, bx, y, -bn);
    if (i > 0) {
      const v = i * 2;
      idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

const KIND_COLOR = { drive: 'ok', brake: 'slide', steer: 'mark', event: 'limit' } as const;

export function Marks({
  lane,
  t,
  colors,
}: {
  lane: Lane;
  t: { now: number };
  colors: DriveColors;
}) {
  const { plan, marks } = lane;
  const half = plan.roadWidth / 2;
  const geo = useMemo(() => {
    const path = plan.path;
    return marks.map((m) => {
      const across = band(path, m.s - 0.25, m.s + 0.25, -half + 0.3, half - 0.3, 0.006);
      // the hands-still stretch: as far as the car travels at its corner speed in that time
      const hold =
        m.kind === 'event' && m.holdS
          ? band(
              path,
              m.s,
              Math.min(path.length, m.s + (plan.kmh / 3.6) * lane.run.ctl.vScale * m.holdS),
              -half + 0.3,
              half - 0.3,
              0.005,
            )
          : null;
      const [lx, ln] = offsetPoint(path, m.s, -half - 0.6, tmp);
      return { across, hold, at: [lx, 0, -ln] as [number, number, number] };
    });
  }, [plan, marks, half, lane]);
  useLayoutEffect(
    () => () =>
      geo.forEach((g) => {
        g.across.dispose();
        g.hold?.dispose();
      }),
    [geo],
  );

  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const lit = useRef(-2);
  useFrame(() => {
    // the step the car is in: the last mark it has passed by the playhead
    let now = -1;
    for (let i = 0; i < marks.length; i++) if (lane.markT[i] <= t.now) now = i;
    if (now === lit.current) return;
    lit.current = now;
    labels.current.forEach((el, i) => el?.classList.toggle('is-now', i === now));
  });

  const color = (k: keyof typeof KIND_COLOR) =>
    KIND_COLOR[k] === 'ok' ? 'var(--ok)' : colors[KIND_COLOR[k]];

  return (
    <group>
      {marks.map((m, i) => {
        const c = color(m.kind);
        return (
          <group key={i}>
            <mesh geometry={geo[i].across} renderOrder={1}>
              <meshBasicMaterial
                color={m.kind === 'drive' ? colors.mark : c}
                transparent
                opacity={0.85}
                depthWrite={false}
                polygonOffset
                polygonOffsetFactor={-3}
                polygonOffsetUnits={-30}
              />
            </mesh>
            {geo[i].hold && (
              <mesh geometry={geo[i].hold!} renderOrder={1}>
                <meshBasicMaterial
                  color={colors.limit}
                  transparent
                  opacity={0.16}
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-2}
                  polygonOffsetUnits={-20}
                />
              </mesh>
            )}
            <Html position={geo[i].at} zIndexRange={[0, 0]} style={{ pointerEvents: 'none' }}>
              <div
                ref={(el) => {
                  labels.current[i] = el;
                }}
                className="apx-label apx-drive-mark"
                style={{ '--sys': m.kind === 'drive' ? 'var(--ok)' : c } as CSSProperties}
              >
                <span className="apx-label__dot" />
                {m.label}
                {m.kind === 'event' && m.holdS ? (
                  <span className="apx-drive-mark__hold">
                    <WheelIcon /> still {m.holdS} s
                  </span>
                ) : null}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

/** A small steering wheel, for "hands still" and the driver's inputs. */
export function WheelIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="2.2" />
      <path d="M2.8 10.5h6.9M14.3 10.5h6.9M12 14.2v7.3" />
    </svg>
  );
}
