/**
 * Dark / light theme shared by the DOM (data-theme on <html>, tokens in app/theme.css) and the
 * 3D scene (SCENE_THEMES + re-tinted ghost materials).
 */
import { create } from 'zustand';

export type Theme = 'dark' | 'light';

export const SCENE_THEMES = {
  dark: {
    background: '#0a0e13',
    gridCell: '#152230',
    gridSection: '#1f3a52',
    outline: 0x7fdbff,
    outlineHidden: 0x2a6f97,
    shadowOpacity: 0.35,
    hemiSky: '#cfe8ff',
    hemiGround: '#0d141c',
  },
  light: {
    background: '#e8edf2',
    gridCell: '#cdd6e0',
    gridSection: '#a7b6c6',
    outline: 0x0b7fb3,
    outlineHidden: 0x8cc4e0,
    shadowOpacity: 0.2,
    hemiSky: '#ffffff',
    hemiGround: '#b8c4d1',
  },
} as const;

const KEY = 'apex.theme';

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* storage blocked: fall through to the OS preference */
  }
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export const useTheme = create<{ theme: Theme; toggle: () => void }>()((set, get) => ({
  theme: typeof window === 'undefined' ? 'dark' : initial(),
  toggle: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* not persisted; still switches for this visit */
    }
    set({ theme });
  },
}));

/** The current scene palette, reactive. */
export const useSceneTheme = () => SCENE_THEMES[useTheme((s) => s.theme)];
