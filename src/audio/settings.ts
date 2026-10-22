/** Master volume / mute, persisted per browser (storage may be blocked: always try/catch). */
import { create } from 'zustand';

const KEY = 'apex.audio';

interface Saved {
  volume: number;
  muted: boolean;
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Saved>;
      return {
        volume: typeof v.volume === 'number' && v.volume >= 0 && v.volume <= 1 ? v.volume : 0.7,
        muted: v.muted === true,
      };
    }
  } catch {
    /* blocked or corrupt storage: defaults */
  }
  return { volume: 0.7, muted: false };
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: keep the in-memory value */
  }
}

export interface AudioSettings extends Saved {
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
}

export const useAudioSettings = create<AudioSettings>()((set, get) => ({
  ...load(),
  setVolume: (volume) => {
    set({ volume, muted: volume > 0 ? false : get().muted });
    save({ volume, muted: get().muted });
  },
  setMuted: (muted) => {
    set({ muted });
    save({ volume: get().volume, muted });
  },
}));
