/**
 * The comparison's controls, right above the car picker while cars are compared: how they stand
 * (side by side, or one outlined over the other) and where to look from (three quarters, from
 * above, from the side). Icons with a word each.
 */
import type { ReactNode } from 'react';
import { Segmented } from '../../app/ui';
import { pickMode, pickView, useCompare, type CompareMode, type CompareView } from '../compare';
import './compare.css';

const icon = (d: ReactNode) => (
  <svg className="apx-cmpbar__icon" viewBox="0 0 24 24" aria-hidden="true">
    {d}
  </svg>
);

const MODES: { value: CompareMode; label: string; title: string; icon: ReactNode }[] = [
  {
    value: 'side',
    label: 'Side by side',
    title: 'Parked side by side',
    icon: icon(
      <>
        <rect x="3" y="4" width="18" height="6.5" rx="2.5" />
        <rect x="3" y="13.5" width="18" height="6.5" rx="2.5" />
      </>,
    ),
  },
  {
    value: 'overlay',
    label: 'Overlay',
    title: 'Outlined over the car',
    icon: icon(
      <>
        <rect x="3" y="8" width="16" height="8" rx="2.5" />
        <rect x="6" y="6" width="15" height="11" rx="2.5" strokeDasharray="2.5 2" />
      </>,
    ),
  },
];

const VIEWS: { value: CompareView; label: string; title: string; icon: ReactNode }[] = [
  {
    value: '3q',
    label: '3/4',
    title: 'Three-quarter view',
    icon: icon(<path d="M4 9l8-4 8 4v7l-8 4-8-4zM4 9l8 4 8-4M12 13v7" />),
  },
  {
    value: 'top',
    label: 'Top',
    title: 'From above',
    icon: icon(
      <>
        <rect x="4" y="7" width="16" height="10" rx="3" />
        <circle cx="12" cy="12" r="1.6" />
      </>,
    ),
  },
  {
    value: 'side',
    label: 'Side',
    title: 'From the side, overlaid',
    icon: icon(
      <>
        <path d="M2.5 15.5v-3l2.5-3h7l3 3h4a2 2 0 0 1 2 2v1z" />
        <circle cx="7" cy="16.5" r="1.8" />
        <circle cx="17" cy="16.5" r="1.8" />
      </>,
    ),
  },
];

const options = <T extends string>(
  list: { value: T; label: string; title: string; icon: ReactNode }[],
) =>
  list.map((o) => ({
    value: o.value,
    title: o.title,
    label: (
      <span className="apx-cmpbar__opt">
        {o.icon}
        <span>{o.label}</span>
      </span>
    ),
  }));

export function CompareBar() {
  const mode = useCompare((s) => s.mode);
  const view = useCompare((s) => s.view);
  return (
    <div className="apx-cmpbar" role="toolbar" aria-label="Compare">
      <Segmented<CompareMode>
        label="Show the cars"
        value={mode}
        onChange={pickMode}
        options={options(MODES)}
      />
      {/* the side view swaps side by side for the overlay: the mode buttons show the switch */}
      <Segmented<CompareView>
        label="Look from"
        value={view}
        onChange={pickView}
        options={options(VIEWS)}
      />
    </div>
  );
}
