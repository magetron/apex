/**
 * The key: every mark the drive draws, each as it is drawn, with one word. Opened and closed by
 * the ? on the rail (or Esc), and nothing else: it stays while the run plays. It floats beside
 * the rail (and above the timeline), so opening it moves or covers nothing under the visitor's
 * pointer. The explorer reads `useLegend.open` so that Esc closes the key before it stops the
 * drive.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { SYSTEM_COLORS } from '../../scene/palette';
import { useTheme } from '../../scene/theme';
import { DRIVE_COLORS } from './colors';
import { InputGlyph, MAGNIFIER, movesLoad, WHEEL } from './glyphs';
import { useDrive } from './state';
import { MATCHED } from './takeaway';

export const useLegend = create<{ open: boolean }>()(() => ({ open: false }));

export const closeLegend = () => useLegend.setState({ open: false });
export const toggleLegend = () => useLegend.setState({ open: !useLegend.getState().open });

const W = 30;
const H = 20;
/** the key's width (px; drive.css .apx-drive-legend) */
const KEY_W = 230;
const svg = { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': true } as const;

/** A ring as round a tyre, in `color`. */
function Ring({ color }: { color: string }) {
  return (
    <svg {...svg} fill="none">
      <circle cx={15} cy={10} r={7} stroke={color} strokeWidth={2.6} />
    </svg>
  );
}

/** Where the key sits: beside the rail, its foot level with the rail's (px, from the viewport). */
function useBeside(open: boolean) {
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;
    let last = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const rail = document.querySelector('.apx-drive-rail')?.closest('.apx-panel');
      const r = rail?.getBoundingClientRect();
      if (!r) return;
      const left = r.right + 8;
      let bottom = innerHeight - r.bottom;
      // and above the timeline where it would sit on it (its buttons stay where they were)
      const dash = document.querySelector('.apx-drive-dash')?.getBoundingClientRect();
      if (dash && dash.left < left + KEY_W && dash.right > left)
        bottom = Math.max(bottom, innerHeight - dash.top + 8);
      const next = { left: Math.round(left), bottom: Math.round(bottom) };
      const k = `${next.left}|${next.bottom}`;
      if (k !== last) {
        last = k;
        setAt(next);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);
  return at;
}

export function Legend() {
  const open = useLegend((s) => s.open);
  const scenario = useDrive((s) => s.scenario);
  const theme = useTheme((s) => s.theme);
  const c = DRIVE_COLORS[theme];
  const at = useBeside(open);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLegend();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open]);

  if (!open || !at || typeof document === 'undefined') return null;
  // a question's own marks, only there: braking into a turn, the path without the brake
  const unbraked = MATCHED.includes(scenario);
  const catching = scenario === 'catch';
  // watched from the side round the key moment: the line each body pitches against
  const level = movesLoad(scenario);
  return createPortal(
    <div
      ref={root}
      className="apx-panel apx-drive-legend"
      role="dialog"
      aria-label="Key"
      style={{ left: at.left, bottom: at.bottom, '--sys': c.you } as CSSProperties}
    >
      <ul>
        <li>
          <Ring color={c.ok} />
          grip
        </li>
        <li>
          <Ring color={c.limit} />
          limit
        </li>
        <li>
          <Ring color={c.slide} />
          out
        </li>
        <li>
          <svg {...svg}>
            <rect
              x={3}
              y={5}
              width={24}
              height={10}
              rx={3}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
            />
            <rect x={19} y={7} width={6} height={6} rx={1} fill={SYSTEM_COLORS.engine} />
          </svg>
          engine
        </li>
        {level && (
          <li>
            <svg {...svg} fill="none" strokeLinejoin="round">
              <path d="M2 5H28" stroke="currentColor" strokeWidth={1.6} />
              <path d="M5 8 25 11V16H5Z" stroke="currentColor" strokeWidth={1.2} opacity={0.6} />
            </svg>
            level
          </li>
        )}
        <li>
          <svg {...svg} fill="none">
            <path d="M2 10H28" stroke="currentColor" strokeWidth={1.6} strokeDasharray="2 2" />
          </svg>
          aimed
        </li>
        {unbraked && (
          <li>
            <svg {...svg} fill={c.rival}>
              {[4, 10, 16, 22, 28].map((x) => (
                <circle key={x} cx={x} cy={10} r={1.8} />
              ))}
            </svg>
            unbraked
          </li>
        )}
        <li>
          <span className="apx-drive-legend__glyph">
            <InputGlyph input="lift" />
          </span>
          lift
        </li>
        <li>
          <span className="apx-drive-legend__glyph">
            <InputGlyph input="gas" />
          </span>
          gas
        </li>
        <li>
          <span className="apx-drive-legend__glyph">
            <InputGlyph input="brake" />
          </span>
          brake
        </li>
        <li>
          <span className="apx-drive-legend__glyph apx-drive-hands__wheel">{WHEEL}</span>
          steering
        </li>
        {catching && (
          <li>
            <svg {...svg} fill="none" strokeLinecap="round">
              <path d="M4 15 26 5" stroke={c.steer} strokeWidth={2.6} />
            </svg>
            wheels
          </li>
        )}
        {catching && (
          <li>
            <svg {...svg} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10H25M20 5.5 25.5 10 20 14.5" stroke="currentColor" strokeWidth={2} />
            </svg>
            goes
          </li>
        )}
        <li>
          <span className="apx-drive-legend__glyph">{MAGNIFIER}</span>
          enlarged
        </li>
      </ul>
    </div>,
    document.body,
  );
}
