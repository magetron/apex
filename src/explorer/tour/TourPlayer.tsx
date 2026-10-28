/**
 * The tour player: a slim bar at the top, between the breadcrumb and the info card, with the
 * step's title (a few words), its dots, back, next and the way out (← → and Esc too). The scene
 * does the explaining: each step opens its view through the explorer's own state (play.ts).
 * Mounted beside the HUD, after it, so what a step sets once its view is open comes after the
 * HUD's own resets for a new car.
 */
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { findTour } from '../../content';
import type { EngineAudio } from '../../audio';
import { useDrive } from '../drive/state';
import { typing } from '../keys';
import { navigateHash, viewPath, type View } from '../view';
import { goStep, leaveTour, restore, stageStep, type Pending } from './play';
import { currentStage, setStage, useTour } from './state';
import { TourPicker } from './TourPicker';
import './tour.css';

/** how long what a step sets waits for its view at most (ms) */
const PENDING_MS = 1500;

const ARROW = (dir: 'prev' | 'next') => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d={dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const CROSS = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path
      d="M6 6l12 12M18 6L6 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * The room between the breadcrumb (top left) and the info card (top right), as the bar's inset,
 * so it never sits over either however long a car's name is.
 */
function useBetween(on: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const layer = el?.parentElement;
    if (!on || !el || !layer) return;
    const left = layer.querySelector<HTMLElement>(':scope > .apx-dock--top-left');
    const right = layer.querySelector<HTMLElement>(':scope > .apx-dock--top-right');
    const measure = () => {
      const box = layer.getBoundingClientRect();
      const l = left?.getBoundingClientRect();
      const r = right?.getBoundingClientRect();
      el.style.setProperty('--tour-l', `${l && l.width ? l.right - box.left : 0}px`);
      el.style.setProperty('--tour-r', `${r && r.width ? box.right - r.left : 0}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const e of [layer, left, right]) if (e) ro.observe(e);
    return () => ro.disconnect();
  }, [on]);
  return ref;
}

/** The tour's steps applied to the explorer as the URL names them; leaving puts things back. */
function usePlayback(view: View) {
  const at = useTour((s) => s.at);
  const replay = useTour((s) => s.replay);
  const tour = at ? findTour(at.id) : undefined;
  const step = tour?.steps[at!.step];
  const current = viewPath(view);
  const latest = useRef(current);
  latest.current = current;
  const pending = useRef<Pending | null>(null);
  const played = useRef(false);

  /** what waits for the view, once it is open (forced: after a moment anyway) */
  const flush = useRef((force = false) => {
    const p = pending.current;
    if (!p || (!force && p.path !== latest.current)) return;
    pending.current = null;
    p.run();
  }).current;

  // (before the step's own effect: a stage left from a view the visitor has since left goes)
  useEffect(() => {
    const s = currentStage();
    if (s && s.path !== current) setStage(null);
  }, [current]);

  useEffect(() => {
    if (step) {
      played.current = true;
      pending.current = stageStep(step.scene);
      navigateHash(pending.current.path, true);
    } else if (played.current) {
      played.current = false;
      pending.current = restore();
    } else return;
    const t = window.setTimeout(() => flush(true), PENDING_MS);
    return () => window.clearTimeout(t);
    // the step (and a replay of it) is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, replay]);

  // the view is open: what waits for it
  useEffect(() => flush());
}

/** ← and → step through the tour (not while typing, on a slider, or driving the car). */
function useStepKeys(view: View, step: number | null) {
  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.defaultPrevented || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      const t = e.target as HTMLElement | null;
      if (t?.matches?.('input[type="range"], [role="slider"]')) return;
      if (view.level === 'drive' && useDrive.getState().mode === 'drive') return;
      e.preventDefault();
      goStep(step + (e.key === 'ArrowRight' ? 1 : -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.level, step]);
}

export function TourPlayer({ view }: { view: View }) {
  const at = useTour((s) => s.at);
  const picking = useTour((s) => s.picking);
  const tour = at ? findTour(at.id) : undefined;
  usePlayback(view);
  useStepKeys(view, tour ? at!.step : null);
  const room = useBetween(!!tour);
  const n = tour?.steps.length ?? 0;
  const i = at?.step ?? 0;
  const step = tour?.steps[i];
  return (
    <>
      {tour && step && (
        <div ref={room} className="apx-tour-room">
          <div className="apx-tour" role="group" aria-label={tour.question} title={tour.question}>
            <button
              type="button"
              className="apx-tour__nav"
              onClick={() => goStep(i - 1)}
              disabled={i === 0}
              aria-label="Previous step"
              aria-keyshortcuts="ArrowLeft"
            >
              {ARROW('prev')}
            </button>
            <div className="apx-tour__mid">
              <span className="apx-tour__title" aria-live="polite">
                {step.title}
              </span>
              <span className="apx-tour__dots">
                {tour.steps.map((s, k) => (
                  <button
                    key={s.id}
                    type="button"
                    className={k === i ? 'is-on' : k < i ? 'is-past' : undefined}
                    style={{ '--k': k } as CSSProperties}
                    onClick={() => goStep(k)}
                    aria-label={`Step ${k + 1} of ${n}: ${s.title}`}
                    aria-current={k === i ? 'step' : undefined}
                    title={s.title}
                  />
                ))}
              </span>
            </div>
            <button
              type="button"
              className="apx-tour__nav is-next"
              onClick={() => goStep(i + 1)}
              disabled={i === n - 1}
              aria-label="Next step"
              aria-keyshortcuts="ArrowRight"
            >
              {ARROW('next')}
            </button>
            <button
              type="button"
              className="apx-tour__exit"
              onClick={() => leaveTour()}
              aria-label="End the tour"
              aria-keyshortcuts="Escape"
              title="End the tour (Esc)"
            >
              {CROSS}
            </button>
          </div>
        </div>
      )}
      {picking && <TourPicker current={at?.id} />}
    </>
  );
}

/**
 * The hub's voice and the tour: a step that wants the engine heard starts it (the click on next
 * was the gesture), and leaving the tour stops it again if the tour started it.
 */
export function useTourSound(audio: EngineAudio) {
  const ask = useTour((s) => s.sound);
  const playing = useTour((s) => !!s.at);
  const started = useRef(false);
  const latest = useRef(audio);
  latest.current = audio;
  useEffect(() => {
    if (!ask || latest.current.playing) return;
    latest.current.start();
    started.current = true;
  }, [ask]);
  useEffect(() => {
    if (playing || !started.current) return;
    started.current = false;
    latest.current.stop();
  }, [playing]);
}
