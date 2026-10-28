/**
 * <SoundControls audio> — compact sound controls for the explorer hub: sound on/off, gas pedal
 * (hold the button or Space), throttle blip, rev sweep, volume, and the add-on toggles that apply
 * to this engine or motor.
 */
import { useCallback, useEffect, type ReactNode } from 'react';
import type { AddonKey } from './config';
import { useAudioSettings } from './settings';
import type { EngineAudio } from './useEngineAudio';
import './sound.css';

const ADDON_LABEL: Record<AddonKey, string> = {
  spool: 'Spool',
  wastegate: 'Gate',
  bov: 'BOV',
  antiLag: 'Anti-lag',
  crackle: 'Burble',
  avas: 'AVAS',
};

const ADDON_TITLE: Record<AddonKey, string> = {
  spool: 'Turbo spool whine',
  wastegate: 'Wastegate chatter · surge flutter on lift',
  bov: 'Blow-off valve on lift',
  antiLag: 'Anti-lag bangs off throttle',
  crackle: 'Overrun burble and pops',
  avas: 'Pedestrian warning tone',
};

const svg = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const ICON = {
  // a throttle pedal on its hinge
  pedal: svg(
    <>
      <path d="M9 3.5h7l-2.5 13h-4.5z" />
      <path d="M7 20.5h9" />
    </>,
  ),
  blip: svg(<path d="M3 17h5.5l2.5-10 2.5 10H21" />),
  sweep: svg(<path d="M3 18c4.5 0 5-12 9-12s4.5 12 9 12" />),
  volume: svg(
    <>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
      <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" />
    </>,
  ),
  muted: svg(
    <>
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
      <path d="M16 10l4 4M20 10l-4 4" />
    </>,
  ),
};

function IconButton({
  label,
  onClick,
  children,
  pressed,
  active,
  primary,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  active?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={`apx-snd__btn${primary ? ' apx-snd__btn--primary' : ''}${active ? ' is-active' : ''}`}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * The controls alone, for callers that own the hook (explorer hub, A/B sandbox). The speaker
 * is the on/off switch (a ▶ would read as the engine animation's play); `compact` keeps only it
 * and the volume, for the views that aren't about the engine.
 */
export function SoundControls({
  audio,
  compact = false,
  pedalKeys = !compact,
  onToggle,
}: {
  audio: EngineAudio;
  compact?: boolean;
  /** W, ↑ or Space work the gas pedal (default: with the full controls) */
  pedalKeys?: boolean;
  /** told when the visitor switches the sound on or off */
  onToggle?: (on: boolean) => void;
}) {
  const { volume, muted, setVolume, setMuted } = useAudioSettings();
  const { playing, manoeuvre, toggle, blip, sweep, pedal, available, addons, setAddon } = audio;
  const level = muted ? 0 : volume;
  const floor = useCallback(
    (down: boolean) => {
      if (down && muted) setMuted(false);
      pedal(down);
    },
    [muted, setMuted, pedal],
  );
  usePedalKey(pedalKeys ? floor : null);
  return (
    <div className="apx-snd" role="group" aria-label="Sound">
      <div className="apx-snd__row">
        <IconButton
          label={playing ? 'Sound off' : 'Sound on'}
          pressed={playing}
          primary={!playing}
          onClick={() => {
            // switching the sound on means wanting to hear it (an old saved mute included)
            if (!playing && muted) setMuted(false);
            onToggle?.(!playing);
            toggle();
          }}
        >
          {playing ? ICON.volume : ICON.muted}
        </IconButton>
        {!compact && (
          <>
            <button
              type="button"
              className={`apx-snd__btn apx-snd__btn--pedal${manoeuvre === 'pedal' ? ' is-active' : ''}`}
              aria-label="Gas pedal (hold, or hold W)"
              title="Gas pedal: hold (or hold W, ↑ or Space)"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                floor(true);
              }}
              onPointerUp={() => floor(false)}
              onPointerCancel={() => floor(false)}
              onLostPointerCapture={() => floor(false)}
            >
              {ICON.pedal}
            </button>
            <IconButton label="Throttle blip" active={manoeuvre === 'blip'} onClick={blip}>
              {ICON.blip}
            </IconButton>
            <IconButton label="Rev sweep" active={manoeuvre === 'sweep'} onClick={sweep}>
              {ICON.sweep}
            </IconButton>
          </>
        )}
        <span className="apx-snd__gap" />
        <input
          className="apx-slider apx-snd__vol"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={level}
          aria-label="Volume"
          aria-valuetext={`${Math.round(level * 100)}%`}
          onChange={(e) => {
            setVolume(Number(e.target.value));
            if (muted) setMuted(false);
          }}
        />
      </div>
      {!compact && available.length > 0 && (
        <div className="apx-snd__chips" role="group" aria-label="Sound add-ons">
          {available.map((k) => (
            <button
              key={k}
              type="button"
              className="apx-snd__chip"
              aria-pressed={addons[k]}
              title={ADDON_TITLE[k]}
              onClick={() => setAddon(k, !addons[k])}
            >
              {ADDON_LABEL[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** W, ↑ or Space work the pedal (not while typing in a field). */
const PEDAL_KEYS = new Set(['Space', 'KeyW', 'ArrowUp']);

function usePedalKey(floor: ((down: boolean) => void) | null) {
  useEffect(() => {
    if (!floor) return;
    const field = (t: EventTarget | null) =>
      t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (!PEDAL_KEYS.has(e.code) || field(e.target)) return;
      // a focused button would otherwise click on Space
      e.preventDefault();
      if (!e.repeat) floor(down);
    };
    const down = key(true);
    const up = key(false);
    const lift = () => floor(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', lift);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', lift);
    };
  }, [floor]);
}
