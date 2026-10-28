/**
 * A tour lives in the page's search string, beside the explorer's hash: /apex/?tour=<id>&step=<n>
 * #/<car>/<level>. The hash stays the explorer's own (every view a deep link, as ever); the tour
 * rides along on every hash navigation untouched, so a step can be linked and reloaded. `step` is
 * 1-based in the URL, as a visitor counts.
 */
import { findTour } from '../../content';

/** what the tour's store listens for when only the search string changed */
export const TOUR_EVENT = 'apex:tour';

export interface TourAt {
  id: string;
  /** 0-based */
  step: number;
}

/** The tour and step a search string names, if the tour exists (the step kept in range). */
export function parseTour(search: string): TourAt | null {
  const q = new URLSearchParams(search);
  const id = q.get('tour');
  const tour = id ? findTour(id) : undefined;
  if (!id || !tour) return null;
  const n = Number.parseInt(q.get('step') ?? '1', 10);
  const step = Number.isFinite(n) ? Math.min(tour.steps.length, Math.max(1, n)) - 1 : 0;
  return { id, step };
}

/** The search string with the tour set (or taken out), every other parameter kept. */
export function tourSearch(search: string, at: TourAt | null): string {
  const q = new URLSearchParams(search);
  q.delete('tour');
  q.delete('step');
  if (at) {
    q.set('tour', at.id);
    q.set('step', String(at.step + 1));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/**
 * Writes the tour (and, if given, the explorer's hash path) in one history entry: `push` for
 * starting a tour (so the back button leaves it), `replace` for its steps and for leaving it.
 * A changed hash is announced as the explorer's own navigation is (view.ts navigateHash).
 */
export function writeTour(at: TourAt | null, path: string | null, mode: 'push' | 'replace') {
  const oldURL = location.href;
  const url = new URL(oldURL);
  url.search = tourSearch(url.search, at);
  if (path !== null) url.hash = path;
  const newURL = url.href;
  if (newURL === oldURL) return;
  history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', newURL);
  if (new URL(oldURL).hash !== url.hash)
    dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL }));
  // (the search string alone changing has no event of its own: the tour's store listens for this)
  dispatchEvent(new Event(TOUR_EVENT));
}
