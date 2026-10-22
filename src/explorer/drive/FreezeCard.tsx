/**
 * The key moment's stop. Nothing is written there: the scene says it (the camera closes in on
 * the tyres that decide it, each car's tag gets its word, the rings under the tyres show which
 * end is at its limit) and the timeline marks where it is. This keeps its controls: Space (or
 * Enter) carries on, caught before the drive keys, where Space is the gas pedal; playing again
 * by any way clears the frame.
 */
import { useEffect } from 'react';
import { carryOn, useFreeze } from './freeze';
import { useDrive } from './state';

const play = () => useDrive.setState({ playing: true });

export function FreezeKeys() {
  const at = useFreeze((s) => s.at);
  const playing = useDrive((s) => s.playing);
  const shown = !!at && !playing;

  // playing again by any other way (the timeline's play button) clears the frame
  useEffect(() => {
    if (playing && at) useFreeze.setState({ at: null });
  }, [playing, at]);

  useEffect(() => {
    if (!shown) return;
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      // a field keeps its own keys (the car chooser, a slider)
      if (e.target instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))
        return;
      e.preventDefault();
      e.stopImmediatePropagation();
      carryOn(play);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [shown]);

  return null;
}
