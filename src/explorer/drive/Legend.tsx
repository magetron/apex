/**
 * "How to read this": a compact legend for drive mode's marks (the lines, the slip wedges, the
 * load bars, the timeline's held-wheel band and key-moment pin), each next to a small picture
 * of itself in the scene's colours. Opens by itself on the first visit (remembered per browser;
 * without storage it simply opens each visit) and from the dashboard's ? button. The run waits
 * while it is open.
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { useTheme } from '../../scene/theme';
import { DRIVE_COLORS, GHOST_COLORS } from './colors';
import { useDrive } from './state';

const SEEN = 'apex.drive.legend';

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN) === '1';
  } catch {
    return false;
  }
}

export const useLegend = create<{ open: boolean }>()(() => ({
  open: typeof window !== 'undefined' && !seen(),
}));

export const openLegend = () => useLegend.setState({ open: true });

export function closeLegend() {
  try {
    localStorage.setItem(SEEN, '1');
  } catch {
    /* not remembered: it opens again next visit */
  }
  useLegend.setState({ open: false });
}

const W = 44;
const H = 24;

export function Legend() {
  const open = useLegend((s) => s.open);
  const theme = useTheme((s) => s.theme);
  const c = DRIVE_COLORS[theme];
  const g = GHOST_COLORS[theme];
  const done = useRef<HTMLButtonElement>(null);

  // the run waits while the legend is up, and carries on where it was
  useEffect(() => {
    if (!open) return;
    const was = useDrive.getState().playing;
    useDrive.setState({ playing: false });
    done.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLegend();
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('keydown', key);
      if (was) useDrive.setState({ playing: true });
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;
  const svg = { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': true } as const;
  return createPortal(
    <div
      className="apx-drive-legend"
      role="dialog"
      aria-modal="false"
      aria-label="How to read this"
    >
      <h2>How to read this</h2>
      <ul>
        <li>
          <svg {...svg} fill="none" strokeLinecap="round">
            <path d="M3 20 Q 22 18 41 5" stroke={g.FF} strokeWidth="2" />
            <path d="M3 20 Q 26 20 41 12" stroke={g.RR} strokeWidth="2" />
            <path d="M3 20 Q 24 19 41 8" stroke={c.you} strokeWidth="3" />
          </svg>
          <span>Each car&rsquo;s line: yours, and the other layouts in their colours</span>
        </li>
        <li>
          <svg {...svg} fill="none" strokeLinecap="round" stroke={c.you}>
            <path d="M3 20 Q 20 17 41 4" strokeWidth="2.5" strokeDasharray="3 4" />
            <path d="M3 20 Q 24 18 41 13" strokeWidth="2.5" />
          </svg>
          <span>Ahead of your car: dashed where the wheels point, solid where it goes</span>
        </li>
        <li>
          <svg {...svg}>
            {[c.ring, c.limit, c.slide].map((col, i) => (
              <path
                key={col}
                d={`M${3 + 14 * i} 19 L${15 + 14 * i} 15 L${13 + 14 * i} ${8 - i * 2} Z`}
                fill={col}
                fillOpacity="0.75"
                stroke={col}
              />
            ))}
          </svg>
          <span>Slip at each axle: gripping, at the limit, sliding</span>
        </li>
        <li>
          <svg {...svg}>
            <rect x="8" y="2" width="8" height="21" fill={c.you} fillOpacity="0.22" />
            <rect x="10" y="15" width="4" height="8" fill={c.ring} />
            <rect x="28" y="12" width="8" height="11" fill={c.you} fillOpacity="0.22" />
            <rect x="30" y="13" width="4" height="10" fill={c.slide} />
            {[12, 32].map((x) => (
              <rect key={x} x={x - 8} y="10" width="16" height="2" fill={c.you} />
            ))}
          </svg>
          <span>Load on each axle (tick: standing still), filled as far as its grip is used</span>
        </li>
        <li>
          <svg {...svg} className="apx-drive-legend__time">
            <rect x="2" y="13" width="40" height="3" rx="1.5" className="is-track" />
            <rect x="8" y="10" width="14" height="9" rx="2" className="is-hold" />
            <path d="M27 3 h8 l-4 6 z" className="is-pin" />
            <rect x="25" y="19" width="14" height="3" rx="1.5" className="is-key" />
          </svg>
          <span>Timeline: wheel held still; the moment that matters, in slow motion</span>
        </li>
      </ul>
      <button ref={done} type="button" className="apx-btn apx-btn--primary" onClick={closeLegend}>
        Got it
      </button>
    </div>,
    document.body,
  );
}
