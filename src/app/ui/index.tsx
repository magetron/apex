/**
 * Minimal UI kit for the overlay panels. Plain CSS classes (ui.css) — no CSS-in-JS.
 * Pages compose: <Dock side="left"><Panel title="…">controls</Panel></Dock>.
 */
import type { CSSProperties, ReactNode } from 'react';
import { SYSTEM_COLORS, SYSTEM_LABELS, type System } from '../../scene/palette';
import './ui.css';

/** Floating HUD region over the 3D scene. */
export function Dock({
  side,
  children,
}: {
  side: 'top-left' | 'top-right' | 'center';
  children: ReactNode;
}) {
  return <div className={`apx-dock apx-dock--${side}`}>{children}</div>;
}

/** Bottom HUD row: left = settings hub, center = car strip, right = spare (keeps center centred). */
export function BottomBar({
  left,
  center,
  right,
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="apx-dock apx-dock--bottom">
      <div className="apx-slot-left">{left}</div>
      <div className="apx-slot-center">{center}</div>
      <div className="apx-slot-right">{right}</div>
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  className,
  style,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={`apx-panel${className ? ` ${className}` : ''}`} style={style}>
      {(title || actions) && (
        <header className="apx-panel__head">
          {title && <h2 className="apx-panel__title">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export interface Option<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="apx-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format = (v) => v.toFixed(2),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="apx-field">
      <span className="apx-field__row">
        <span>{label}</span>
        <span className="apx-field__value">{format(value)}</span>
      </span>
      <input
        className="apx-slider"
        aria-label={label}
        aria-valuetext={format(value)}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="apx-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="apx-field">
      <span>{label}</span>
      <select className="apx-select" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Stat({
  label,
  value,
  unit,
  title,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  title?: string;
}) {
  return (
    <div className="apx-stat" title={title}>
      <span className="apx-stat__label">{label}</span>
      <span className="apx-stat__value">
        {value}
        {unit && <span className="apx-stat__unit">{unit}</span>}
      </span>
    </div>
  );
}

export function Stats({ children }: { children: ReactNode }) {
  return <div className="apx-stats">{children}</div>;
}

export function Legend({ systems }: { systems: System[] }) {
  return (
    <div className="apx-legend">
      {systems.map((s) => (
        <span key={s} style={{ '--sys': SYSTEM_COLORS[s] } as CSSProperties}>
          <i />
          {SYSTEM_LABELS[s]}
        </span>
      ))}
    </div>
  );
}

export function Button({
  children,
  onClick,
  href,
  primary,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
  title?: string;
}) {
  const cls = `apx-btn${primary ? ' apx-btn--primary' : ''}`;
  return href ? (
    <a className={cls} href={href} title={title}>
      {children}
    </a>
  ) : (
    <button type="button" className={cls} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="apx-tag">{children}</span>;
}

/** Short facts as chips — prefer these over sentences; feed them from spec data. */
export function Chips({
  items,
}: {
  items: { label: ReactNode; system?: System; title?: string }[];
}) {
  return (
    <div className="apx-chips">
      {items.map((c, i) => (
        <span
          key={i}
          className="apx-chip"
          title={c.title}
          style={c.system ? ({ '--sys': SYSTEM_COLORS[c.system] } as CSSProperties) : undefined}
        >
          {c.system && <i />}
          {c.label}
        </span>
      ))}
    </div>
  );
}
