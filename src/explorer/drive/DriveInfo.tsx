/**
 * Drive-mode card (top right): the question as its title, and under it both cars' paths from
 * straight above, live: each drawn as far as the playhead, so the moment they part shows as it
 * happens. When the run ends, the same card grows in place into the picture the run ends on
 * (each car's outcome on its path, the gaps measured), with replay and the next question beside
 * the title; the scene keeps the rest of the view, so the cars stay in sight beside it.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Panel } from '../../app/ui';
import { HUB_ORDER, SCENARIOS } from '../../sim/scenarios';
import type { VehicleSpec } from '../../spec/types';
import type { Go, View } from '../view';
import { nextQuestion, PathDrawing, replayRun } from './PathPicture';
import { usePathPicture, type PathPicture } from './picture';
import { drivePlayback, useDrive } from './state';
import './drive.css';

/** the inset's size (px) */
const INSET_W = 268;
const INSET_H = 150;
/** the ending's drawing (its own units: drawn to the card's width, as tall as it may be) */
const END_W = 560;
const END_H = 440;
/** the ending keeps this clear of what is under it, and is never shorter than this (px) */
const END_GAP = 10;
const END_MIN = 160;
/** redrawn at most this often while the playhead moves (s) */
const EVERY = 1 / 30;

const REPLAY = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
    <path d="M4.5 3.5v4h4" />
  </svg>
);
const NEXT = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

/** Both paths so far, redrawn as the playhead moves (and only then). */
function Inset({ pic }: { pic: PathPicture }) {
  const [t, setT] = useState(drivePlayback.t);
  useEffect(() => {
    let raf = 0;
    let last = -1;
    let at = 0;
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick);
      const now = drivePlayback.t;
      if (now !== last && ms - at >= EVERY * 1000) {
        last = now;
        at = ms;
        setT(now);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="apx-drive-inset">
      <PathDrawing pic={pic} w={INSET_W} h={INSET_H} until={t} />
    </div>
  );
}

/** (the Hud hands every card the car and the view; this one needs neither) */
export function DriveInfo(_: { vehicle: VehicleSpec; view?: View; go?: Go }) {
  const scenario = useDrive((s) => s.scenario);
  const def = SCENARIOS[scenario];
  const pic = usePathPicture((s) => s.pic);
  const open = usePathPicture((s) => s.open);
  const fresh = !!pic && pic.id === scenario;
  const end = open && fresh;
  // (a straight stop's paths are one straight line: through the run its answer is the rings)
  const inset = fresh && scenario !== 'braking';
  const next = (HUB_ORDER.indexOf(scenario) + 1) % HUB_ORDER.length;
  const nextBtn = useRef<HTMLButtonElement>(null);
  const endBox = useRef<HTMLDivElement>(null);

  // the ending as tall as the room down to the timeline (when it is under the card) or the
  // window's foot: followed while open, as the timeline grows its row of layouts
  useLayoutEffect(() => {
    if (!end) return;
    let raf = 0;
    let last = -1;
    // at the window's foot, the HUD's own margin (where the card's column ends)
    const root = getComputedStyle(document.documentElement);
    const margin = Math.max(END_GAP, parseFloat(root.getPropertyValue('--gutter')) || 0);
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = endBox.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // the card's own foot (its padding and border) comes under the picture too: kept clear
      // of the timeline with the rest (without it the card's edge met the timeline's)
      const card = el.closest('.apx-panel')?.getBoundingClientRect();
      const below = card ? Math.max(0, card.bottom - r.bottom) : 0;
      const dash = document.querySelector('.apx-drive-dash')?.getBoundingClientRect();
      let foot = innerHeight - margin;
      if (dash && dash.right > r.left && dash.left < r.right)
        foot = Math.min(foot, dash.top - END_GAP);
      const h = Math.max(END_MIN, Math.floor(foot - below - r.top));
      if (h !== last) {
        last = h;
        el.style.setProperty('--end-h', `${h}px`);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end]);

  // at the end, Space or Enter presses the button in focus (the next question, at first), caught
  // before the drive keys, where Space is the gas pedal and would take the wheel
  useEffect(() => {
    if (!end) return;
    nextBtn.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      if (e.target instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const el = document.activeElement;
      if (el instanceof HTMLButtonElement && el.closest('.apx-drive-info')) el.click();
      else nextQuestion();
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [end]);

  return (
    <Panel className={`apx-drive-info${end ? ' is-end' : ''}`}>
      <header className="apx-drive-info__head">
        <h2 className="apx-drive-title">
          <span className="apx-drive-title__n" aria-hidden>
            {HUB_ORDER.indexOf(scenario) + 1}
          </span>
          {def.question}
        </h2>
        {end && (
          <span className="apx-drive-info__actions">
            <button
              type="button"
              className="apx-drive-iconbtn"
              onClick={replayRun}
              aria-label="Replay"
              title="Replay"
            >
              {REPLAY}
            </button>
            <button
              ref={nextBtn}
              type="button"
              className="apx-drive-iconbtn is-primary"
              onClick={nextQuestion}
              aria-label={`Question ${next + 1}`}
              title={`Question ${next + 1}`}
            >
              <b>{next + 1}</b>
              {NEXT}
            </button>
          </span>
        )}
      </header>
      {end ? (
        <div ref={endBox} className="apx-drive-end" aria-label="Both lines, from above">
          <PathDrawing pic={pic} w={END_W} h={END_H} />
        </div>
      ) : (
        inset && <Inset pic={pic} />
      )}
    </Panel>
  );
}
