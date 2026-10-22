import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/theme.css';
import './app/ui/ui.css';
import { useTheme } from './scene/theme';

// Dev-only handle for inspecting live state from the browser console / automated QA.
if (import.meta.env.DEV) {
  void Promise.all([import('./scene/store'), import('./scene/runtime')]).then(
    ([store, runtime]) => {
      (window as unknown as { __apex: unknown }).__apex = { useScene: store.useScene, ...runtime };
    },
  );
}

// Theme attribute before first paint, then follow the toggle.
const applyTheme = (t: string) => document.documentElement.setAttribute('data-theme', t);
applyTheme(useTheme.getState().theme);
useTheme.subscribe((s) => applyTheme(s.theme));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
