import { useTheme } from '../scene/theme';
import { href, ROUTES } from './routes';

function CgMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#f4f6f8" stroke="#0a0e13" strokeWidth="2" />
      <path d="M16 2a14 14 0 0 1 14 14H16z" fill="#0a0e13" />
      <path d="M16 30A14 14 0 0 1 2 16h14z" fill="#0a0e13" />
    </svg>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="apx-icon-btn"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {theme === 'dark' ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

export function TopBar({ location }: { location: string }) {
  const section = '/' + (location.split('/').filter(Boolean)[0] ?? '');
  return (
    <header className="apx-topbar">
      <a className="apx-brand" href={href('/')}>
        <CgMark />
        APEX
      </a>
      <nav className="apx-nav" aria-label="Sections">
        {ROUTES.filter((r) => r.nav).map((r) => {
          const base = '/' + (r.pattern.split('/').filter(Boolean)[0] ?? '');
          return (
            <a
              key={r.pattern}
              href={href(base)}
              className={section === base ? 'is-active' : undefined}
            >
              {r.nav}
            </a>
          );
        })}
      </nav>
      <ThemeToggle />
    </header>
  );
}
