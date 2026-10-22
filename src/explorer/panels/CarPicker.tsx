/**
 * Car picker. Collapsed (bottom centre): the car on screen with ‹ › to its neighbours. Open: a
 * sheet of every car as a card — side silhouette on one shared scale, traits, weight split and
 * numbers — filtered by independent facets (position, drive, power, body, cylinders) and sorted
 * by a measure. Hovering or focusing a card overlays the current car's outline and shows the
 * differences. All of it is derived from the spec (carFacts, carSilhouette).
 */
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { Segmented } from '../../app/ui';
import { SYSTEM_COLORS } from '../../scene/palette';
import { getVehicle, listVehicles } from '../../spec/catalog';
import type { VehicleSpec } from '../../spec/types';
import { useDrive } from '../drive/state';
import { MAX_VS, withVehicle, type View } from '../view';
import {
  applyFilters,
  carFacts,
  deltas,
  facetCounts,
  facets,
  PLACE_LABEL,
  SORTS,
  sortCars,
  type CarFacts,
  type Delta,
  type Drive,
  type Facet,
  type FacetId,
  type Filters,
  type Place,
  type SortKey,
} from './carFacts';
import { prefetchCar, useModelLoad } from '../../vehicle3d/gltf/load';
import { gltfUrl } from '../../vehicle3d/gltf/manifest';
import { catalogFrame, frameOf, silhouette, viewBox, type Frame } from './carSilhouette';
import './carpicker.css';

// ── state shared by the bar and the sheet (survives level changes) ─────────────────────

interface PickerState {
  query: string;
  filters: Filters;
  sort: SortKey;
  /** 1 ascending, −1 descending */
  dir: 1 | -1;
  /** the open sheet: to switch the car, or to add cars to compare with; null = closed */
  sheet: SheetMode | null;
}

/** What clicking a card in the sheet does: switch to that car, or compare with it. */
export type SheetMode = 'go' | 'vs';

const usePicker = create<PickerState>()(() => ({
  query: '',
  filters: {},
  sort: 'name',
  dir: 1,
  sheet: null,
}));

/** Open the car sheet (from the hub's "add a car", say); the picker bar shows it. */
export const openPicker = (mode: SheetMode) => usePicker.setState({ sheet: mode });

let catalog: { all: CarFacts[]; facets: Facet[] } | null = null;
function getCatalog() {
  if (!catalog) {
    const all = listVehicles().map(carFacts);
    catalog = { all, facets: facets(all) };
  }
  return catalog;
}

/** The catalog as the picker currently filters and sorts it. */
function useCars(): CarFacts[] {
  const { query, filters, sort, dir } = usePicker();
  return useMemo(() => {
    const { all, facets: fs } = getCatalog();
    return sortCars(applyFilters(all, fs, filters, query), sort, dir);
  }, [query, filters, sort, dir]);
}

const PALETTE = {
  '--cp-engine': SYSTEM_COLORS.engine,
  '--cp-gearbox': SYSTEM_COLORS.gearbox,
  '--cp-motor': SYSTEM_COLORS.motor,
  '--cp-battery': SYSTEM_COLORS.battery,
  '--cp-shaft': SYSTEM_COLORS.shaft,
  '--cp-wheel': SYSTEM_COLORS.wheel,
  '--cp-driven': SYSTEM_COLORS['wheel-driven'],
} as CSSProperties;

// ── drawings ───────────────────────────────────────────────────────────────────────────

const GHOST_ID = 'apx-cp-ghost';

function Sil({
  v,
  frame,
  cg,
  ghost,
}: {
  v: VehicleSpec;
  frame: Frame;
  cg?: boolean;
  /** overlay the current car (a <use> of the sheet's one ghost path) */
  ghost?: boolean;
}) {
  const s = silhouette(v);
  const k = frame.w / 70;
  return (
    <svg
      className="apx-cp-sil"
      viewBox={viewBox(frame)}
      style={{ aspectRatio: `${frame.w} / ${frame.h}` }}
      aria-hidden="true"
    >
      <line className="apx-cp-sil__ground" x1={frame.x} x2={frame.x + frame.w} y1={0} y2={0} />
      <path className="apx-cp-sil__body" d={s.body} />
      {/* x-ray: the drivetrain shows through the wheels (a 911's engine hangs past its axle) */}
      {s.wheels.map((w, i) => (
        <circle
          key={i}
          className={w.driven ? 'apx-cp-sil__wheel is-driven' : 'apx-cp-sil__wheel'}
          cx={w.cx}
          cy={w.cy}
          r={w.r}
        />
      ))}
      {s.parts.map((p) => (
        <polygon key={p.id} className={`apx-cp-sil__${p.kind}`} points={p.points} />
      ))}
      {s.props.map((l, i) => (
        <line key={i} className="apx-cp-sil__shaft" {...l} />
      ))}
      {cg && s.cg && (
        <g className="apx-cp-sil__cg" transform={`translate(${s.cg[0]} ${s.cg[1]})`}>
          <circle r={k} />
          <path d={`M0 ${-k}A${k} ${k} 0 0 1 ${k} 0H0ZM0 ${k}A${k} ${k} 0 0 1 ${-k} 0H0Z`} />
        </g>
      )}
      {ghost && <use className="apx-cp-sil__ghost" href={`#${GHOST_ID}`} />}
    </svg>
  );
}

// a 26 × 12 side view, front to the right: where the power unit sits, which wheels are driven
const GLYPH_WHEEL = { rear: 6.5, front: 19.5 } as const;
const GLYPH_BLOCK: Record<Place, number> = { front: 16.5, mid: 8.5, rear: 1.8 };
const DRIVEN_AXLES: Record<Drive, ('front' | 'rear')[]> = {
  FWD: ['front'],
  RWD: ['rear'],
  AWD: ['front', 'rear'],
};

function Glyph({
  places,
  drive,
  unit = 'any',
}: {
  places?: Place[];
  drive?: Drive;
  unit?: 'engine' | 'motor' | 'any';
}) {
  const driven = drive ? DRIVEN_AXLES[drive] : [];
  return (
    <svg className="apx-cp-glyph" viewBox="0 0 26 12" aria-hidden="true">
      <path
        className="apx-cp-glyph__body"
        d="M1.5 8.5V5Q1.5 3.5 3 3.5H8L10.5 1.2H16.5L19.5 3.5H23Q24.5 3.5 24.5 5V8.5Z"
      />
      {(['rear', 'front'] as const).map((a) => (
        <circle
          key={a}
          className={driven.includes(a) ? 'is-driven' : undefined}
          cx={GLYPH_WHEEL[a]}
          cy={9}
          r={2.3}
        />
      ))}
      {places?.map((p) => (
        <rect
          key={p}
          className={`is-${unit}`}
          x={GLYPH_BLOCK[p]}
          y={3.9}
          width={5.8}
          height={2.8}
          rx={0.7}
        />
      ))}
    </svg>
  );
}

const placesText = (f: CarFacts) => f.places.map((p) => PLACE_LABEL[p]).join(' + ');

function Traits({ f }: { f: CarFacts }) {
  const unit = f.source === 'EV' ? 'motor' : 'engine';
  return (
    <span className="apx-cp-traits">
      <span className="apx-cp-trait" title={f.source === 'EV' ? 'Motors' : 'Engine'}>
        <Glyph places={f.places} unit={unit} />
        {placesText(f)}
      </span>
      <span className="apx-cp-trait" title="Driven wheels">
        <Glyph drive={f.drive} />
        {f.drive}
      </span>
      <span className={`apx-cp-unit is-${unit}`}>{f.unit}</span>
    </span>
  );
}

// ── one card ───────────────────────────────────────────────────────────────────────────

function Cmp({ d }: { d: Delta }) {
  return (
    <em className="apx-cp-cmp" data-sign={d.sign}>
      {d.text}
    </em>
  );
}

function Num({
  value,
  unit,
  d,
  hot,
}: {
  value: string | number;
  unit: string;
  d: Delta;
  hot: boolean;
}) {
  return (
    <span className={hot ? 'apx-cp-num is-hot' : 'apx-cp-num'}>
      <b>{value}</b>
      <small>{unit}</small>
      <Cmp d={d} />
    </span>
  );
}

/** Is a card's car compared with the current one: on, off, off with no room left; null for the
 *  current car itself. */
type VsState = 'on' | 'off' | 'full' | null;

const VS_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.5 15.5v-3l2.2-3.2h6.6l2.3 3.2h1.9a1.5 1.5 0 0 1 1.5 1.5v1.5z" />
    <path d="M8.5 11.2V8.4l2-2.9h6l2.1 2.9h1.9a1.5 1.5 0 0 1 1.5 1.5v1.4" />
  </svg>
);

const Card = memo(function Card({
  f,
  cur,
  frame,
  hot,
  vs,
  onPick,
  onVs,
}: {
  f: CarFacts;
  cur: CarFacts;
  frame: Frame;
  hot: SortKey;
  vs: VsState;
  onPick: (id: string) => void;
  onVs: (id: string) => void;
}) {
  const isCur = f.id === cur.id;
  const d = deltas(f, cur);
  const front = Math.round(f.frontPct);
  return (
    <div className="apx-cp-cardwrap" data-vs={vs ?? undefined}>
      <button
        type="button"
        className="apx-cp-card"
        aria-current={isCur || undefined}
        data-id={f.id}
        onClick={() => onPick(f.id)}
        onPointerEnter={() => prefetchCar(f.id)}
      >
        <Sil v={f.v} frame={frame} cg ghost={!isCur} />
        <span className="apx-cp-card__name">
          <b>{f.model}</b>
          {f.variant && <small>{f.variant}</small>}
        </span>
        <Traits f={f} />
        <span
          className={hot === 'front' ? 'apx-cp-split is-hot' : 'apx-cp-split'}
          title="Front / rear axle load"
        >
          <span className="apx-cp-split__bar">
            <i style={{ width: `${f.frontPct}%` }} />
            <span className="apx-cp-cmp apx-cp-split__cur" style={{ left: `${cur.frontPct}%` }} />
          </span>
          <b>
            {front}:{100 - front}
          </b>
          <Cmp d={d.front} />
        </span>
        <span className="apx-cp-nums">
          <Num value={Math.round(f.kw)} unit="kW" d={d.kw} hot={hot === 'kw'} />
          <Num value={Math.round(f.kg)} unit="kg" d={d.kg} hot={hot === 'kg'} />
          <Num value={Math.round(f.kwPerT)} unit="kW/t" d={d.kwPerT} hot={hot === 'kwPerT'} />
          <Num
            value={(f.lengthMm / 1000).toFixed(2)}
            unit="m"
            d={d.length}
            hot={hot === 'length'}
          />
        </span>
      </button>
      {vs && (
        <button
          type="button"
          className="apx-cp-vs"
          aria-pressed={vs === 'on'}
          disabled={vs === 'full'}
          aria-label={`Compare with ${f.name}`}
          title={vs === 'on' ? 'Compared · click to stop' : 'Compare with the car on show'}
          onClick={() => onVs(f.id)}
        >
          {VS_ICON}
        </button>
      )}
    </div>
  );
});

// ── the open sheet ─────────────────────────────────────────────────────────────────────

function FacetRow({
  facet,
  counts,
  present,
  selected,
}: {
  facet: Facet;
  counts: Map<string, number>;
  present: Set<string>;
  selected: string[];
}) {
  const toggle = (value: string) =>
    usePicker.setState((s) => {
      const now = s.filters[facet.id] ?? [];
      const next = now.includes(value) ? now.filter((x) => x !== value) : [...now, value];
      return { filters: { ...s.filters, [facet.id]: next } };
    });
  return (
    <div className="apx-cp-facet" role="group" aria-label={facet.label}>
      <span className="apx-cp-facet__label">{facet.label}</span>
      <span className="apx-cp-facet__chips">
        {facet.order
          .filter((value) => present.has(value))
          .map((value) => {
            const on = selected.includes(value);
            const n = counts.get(value) ?? 0;
            return (
              <button
                key={value}
                type="button"
                className="apx-cp-chip"
                aria-pressed={on}
                disabled={!on && n === 0}
                onClick={() => toggle(value)}
              >
                {facet.id === 'place' && <Glyph places={[value as Place]} />}
                {facet.id === 'drive' && <Glyph drive={value as Drive} />}
                {facet.id === 'source' && (
                  <i className={value === 'EV' ? 'is-motor' : 'is-engine'} />
                )}
                {facet.text(value)}
                <small>{n}</small>
              </button>
            );
          })}
      </span>
    </div>
  );
}

const SORT_DEFAULT_DIR = (k: SortKey): 1 | -1 => (k === 'name' ? 1 : -1);

function Sheet({
  cur,
  mode,
  vs,
  onPick,
  onVs,
  onClose,
}: {
  cur: CarFacts;
  mode: SheetMode;
  /** the cars compared with the current one */
  vs: readonly string[];
  onPick: (id: string) => void;
  onVs: (id: string) => void;
  onClose: () => void;
}) {
  const full = vs.length >= MAX_VS;
  const vsOf = (id: string): VsState =>
    id === cur.id ? null : vs.includes(id) ? 'on' : full ? 'full' : 'off';
  // comparing: a click on a card adds that car (the current one has nothing to add)
  const curId = cur.id;
  const onCard = useCallback(
    (id: string) => (mode === 'go' ? onPick(id) : id === curId ? onClose() : onVs(id)),
    [mode, curId, onPick, onVs, onClose],
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const downOutside = useRef(false);
  const { query, filters, sort, dir } = usePicker();
  const { all, facets: fs } = getCatalog();
  const frame = catalogFrame();
  const list = useCars();
  const counts = useMemo(() => facetCounts(all, fs, filters, query), [all, fs, filters, query]);
  const present = useMemo(() => {
    const none = facetCounts(all, fs, {}, '');
    return Object.fromEntries(fs.map((f) => [f.id, new Set(none[f.id].keys())])) as Record<
      FacetId,
      Set<string>
    >;
  }, [all, fs]);
  const active = !!query.trim() || Object.values(filters).some((v) => v?.length);

  useLayoutEffect(() => {
    const d = dialog.current!;
    if (!d.open) d.showModal();
    const card = grid.current?.querySelector<HTMLElement>('[aria-current="true"]');
    (card ?? search.current)?.focus({ preventScroll: true });
    card?.scrollIntoView({ block: 'center' });
    return () => d.close();
  }, []);

  // a new filter or order starts from the top (opening starts at the current car, above)
  const shown = useRef(list);
  useEffect(() => {
    if (shown.current !== list && grid.current) grid.current.scrollTop = 0;
    shown.current = list;
  }, [list]);

  useEffect(() => {
    // capture, so the explorer's own Esc (zoom out) never sees it
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (e.target === search.current && search.current?.value) usePicker.setState({ query: '' });
      else onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cards = [...e.currentTarget.querySelectorAll<HTMLElement>('.apx-cp-card')];
    const i = cards.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    // type to search
    if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      search.current?.focus();
      return;
    }
    const cols = Math.max(1, cards.filter((c) => c.offsetTop === cards[0].offsetTop).length);
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -cols,
      ArrowDown: cols,
      Home: -i,
      End: cards.length - 1 - i,
    };
    if (!(e.key in step)) return;
    e.preventDefault();
    const target = cards[Math.max(0, Math.min(cards.length - 1, i + step[e.key]))];
    target.focus();
    target.scrollIntoView({ block: 'nearest' });
  };

  return createPortal(
    <dialog
      ref={dialog}
      className="apx-cp"
      data-mode={mode}
      style={PALETTE}
      aria-label="Cars"
      // keys typed in here are the picker's, not the scene's (the gas pedal listens on Space/W/↑)
      onKeyDown={(e) => e.stopPropagation()}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => (downOutside.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOutside.current) onClose();
      }}
    >
      <svg className="apx-cp-defs" aria-hidden="true">
        <path id={GHOST_ID} d={silhouette(cur.v).ghost} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="apx-cp-sheet">
        <header className="apx-cp-head">
          {mode === 'vs' && (
            <span
              className="apx-cp-mode"
              title="A click on a card compares it with the car on show"
            >
              {VS_ICON}
              Compare with {cur.model}
            </span>
          )}
          <input
            ref={search}
            className="apx-cp-search"
            type="search"
            placeholder="Search"
            aria-label="Search cars"
            value={query}
            onChange={(e) => usePicker.setState({ query: e.target.value })}
          />
          <Segmented<SortKey>
            label="Sort"
            value={sort}
            options={SORTS.map((s) => ({
              value: s.key,
              title: s.title,
              label:
                s.key !== sort
                  ? s.label
                  : s.key === 'name'
                    ? dir > 0
                      ? 'A–Z'
                      : 'Z–A'
                    : `${s.label} ${dir > 0 ? '↑' : '↓'}`,
            }))}
            onChange={(k) =>
              usePicker.setState(
                k === sort ? { dir: dir > 0 ? -1 : 1 } : { sort: k, dir: SORT_DEFAULT_DIR(k) },
              )
            }
          />
          <span className="apx-cp-count" aria-live="polite">
            {list.length}/{all.length}
          </span>
          {active && (
            <button
              type="button"
              className="apx-cp-clear"
              onClick={() => usePicker.setState({ query: '', filters: {} })}
            >
              Clear
            </button>
          )}
          <button type="button" className="apx-cp-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="apx-cp-facets">
          {fs.map((facet) => (
            <FacetRow
              key={facet.id}
              facet={facet}
              counts={counts[facet.id]}
              present={present[facet.id]}
              selected={filters[facet.id] ?? []}
            />
          ))}
        </div>
        <div className="apx-cp-grid" ref={grid} onKeyDown={onGridKey}>
          {list.map((f) => (
            <Card
              key={f.id}
              f={f}
              cur={cur}
              frame={frame}
              hot={sort}
              vs={vsOf(f.id)}
              onPick={onCard}
              onVs={onVs}
            />
          ))}
          {!list.length && (
            <button
              type="button"
              className="apx-cp-clear apx-cp-empty"
              onClick={() => usePicker.setState({ query: '', filters: {} })}
            >
              0 · Clear
            </button>
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

// ── collapsed bar ──────────────────────────────────────────────────────────────────────

function Chevron({ dir }: { dir: 1 | -1 }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={dir > 0 ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
    </svg>
  );
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

/** [ and ] (or , and .) step to the previous / next car (by key position, or by the character) */
const STEP_KEYS: Record<string, 1 | -1> = {
  BracketLeft: -1,
  BracketRight: 1,
  Comma: -1,
  Period: 1,
  '[': -1,
  ']': 1,
  ',': -1,
  '.': 1,
};

/**
 * The car on show, with ‹ › to its neighbours in the picker's order ([ ] on the keyboard), the
 * sheet of every car, and a button to compare it with others. Switching keeps the mode: see-
 * through, a zoomed part, drive. `slim` is the one-line version for the drive dashboard.
 */
export function CarPicker({
  view,
  go,
  vehicle,
  slim = false,
}: {
  view: View;
  go: (v: View) => void;
  vehicle: VehicleSpec;
  slim?: boolean;
}) {
  const sheet = usePicker((s) => s.sheet);
  const opener = useRef<HTMLButtonElement>(null);
  const list = useCars();
  const cur = carFacts(vehicle);
  const tight = useMemo(() => frameOf([silhouette(vehicle)], 40), [vehicle]);
  const i = list.findIndex((f) => f.id === vehicle.id);
  const n = list.length;
  const prev = n ? list[i < 0 ? n - 1 : (i - 1 + n) % n] : null;
  const next = n ? list[i < 0 ? 0 : (i + 1) % n] : null;
  const vs = useMemo(() => view.vs ?? [], [view.vs]);

  // stable for the memoised cards; reads the latest view
  const latest = useRef({ view, go });
  useLayoutEffect(() => {
    latest.current = { view, go };
  });
  const pick = useCallback((id: string) => {
    const { view: v, go: nav } = latest.current;
    usePicker.setState({ sheet: null });
    if (id !== v.vehicleId) nav(withVehicle(v, id));
  }, []);
  const toggleVs = useCallback((id: string) => {
    const { view: v, go: nav } = latest.current;
    const now = v.vs ?? [];
    const on = now.includes(id);
    if (!on && now.length >= MAX_VS) return;
    // picking a car to drive against: the layout stand-ins on the road stay
    if (!on && v.level === 'drive' && !now.length)
      useDrive.getState().keepStandIns(getVehicle(v.vehicleId));
    nav({ ...v, vs: on ? now.filter((x) => x !== id) : [...now, id] });
    // adding from "compare with…" is done; toggling on a card keeps browsing
    if (!on && usePicker.getState().sheet === 'vs') usePicker.setState({ sheet: null });
  }, []);
  const close = useCallback(() => usePicker.setState({ sheet: null }), []);
  // back to the opener once the sheet (and its modal inertness) is gone
  const wasOpen = useRef(false);
  useEffect(() => {
    if (sheet) wasOpen.current = true;
    else if (wasOpen.current) {
      wasOpen.current = false;
      opener.current?.focus({ preventScroll: true });
    }
  }, [sheet]);

  // derive every silhouette while idle, so the sheet opens at once
  useEffect(() => {
    const warm = () => catalogFrame();
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(warm, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 300);
    return () => clearTimeout(t);
  }, []);

  // load the neighbours' models once this car's is in, so ‹ › swap at once
  const url = gltfUrl(vehicle.id);
  const ready = useModelLoad((s) => !url || s[url]?.state === 'ready');
  useEffect(() => {
    const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
    if (!ready || conn?.saveData) return;
    const t = setTimeout(() => {
      if (next) prefetchCar(next.id);
      if (prev) prefetchCar(prev.id);
    }, 1200);
    return () => clearTimeout(t);
  }, [ready, next, prev]);

  // [ ] or , . step through the cars from anywhere (not while typing or with the sheet open)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const d = STEP_KEYS[e.code] ?? STEP_KEYS[e.key];
      if (!d || e.defaultPrevented || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey)
        return;
      if (usePicker.getState().sheet) return;
      const to = d > 0 ? next : prev;
      if (to && to.id !== vehicle.id) {
        e.preventDefault();
        pick(to.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, vehicle.id, pick]);

  const step = (to: CarFacts | null, d: 1 | -1) => (
    <button
      type="button"
      className="apx-cp-step"
      disabled={!to || to.id === vehicle.id}
      onClick={() => to && pick(to.id)}
      onPointerEnter={() => to && prefetchCar(to.id)}
      aria-label={to ? `${d > 0 ? 'Next' : 'Previous'}: ${to.name}` : undefined}
      aria-keyshortcuts={d > 0 ? ']' : '['}
      title={to ? `${to.name} (${d > 0 ? ']' : '['})` : undefined}
    >
      <Chevron dir={d} />
    </button>
  );

  return (
    <div className={slim ? 'apx-cp-bar is-slim' : 'apx-cp-bar'} style={PALETTE}>
      {step(prev, -1)}
      <button
        ref={opener}
        type="button"
        className="apx-cp-current"
        aria-haspopup="dialog"
        aria-expanded={sheet === 'go'}
        onClick={() => usePicker.setState({ sheet: 'go' })}
        title="All cars"
      >
        {!slim && <Sil v={vehicle} frame={tight} />}
        <span className="apx-cp-current__text">
          <b>{cur.model}</b>
          {!slim && (
            <span className="apx-cp-current__sub">
              <span title={placesText(cur)}>
                <Glyph places={cur.places} unit={cur.source === 'EV' ? 'motor' : 'engine'} />
              </span>
              <span title={cur.drive}>
                <Glyph drive={cur.drive} />
              </span>
              {cur.unit}
            </span>
          )}
        </span>
        <span className="apx-cp-current__idx">
          <span>
            {i < 0 ? '–' : i + 1}/{n}
          </span>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" />
          </svg>
        </span>
      </button>
      {step(next, 1)}
      <button
        type="button"
        className="apx-cp-step apx-cp-vsbtn"
        aria-haspopup="dialog"
        aria-expanded={sheet === 'vs'}
        aria-pressed={vs.length > 0}
        disabled={vs.length >= MAX_VS}
        onClick={() => usePicker.setState({ sheet: 'vs' })}
        aria-label="Compare with another car"
        title={vs.length >= MAX_VS ? `Comparing ${MAX_VS} cars` : 'Compare with another car'}
      >
        {VS_ICON}
        {vs.length > 0 && <small>{vs.length}</small>}
      </button>
      {sheet && (
        <Sheet cur={cur} mode={sheet} vs={vs} onPick={pick} onVs={toggleVs} onClose={close} />
      )}
    </div>
  );
}
