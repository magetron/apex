/**
 * The tours, as cards: each its question, its teaser and, drawn as the car picker draws it, the
 * layout of the car it starts on. A click starts it; Esc or a click outside closes the sheet.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { listTours } from '../../content';
import { findVehicle } from '../../spec/catalog';
import { carFacts } from '../panels/carFacts';
import { Glyph } from '../panels/CarPicker';
import { startTour } from './play';
import { closeTours } from './state';

const CLOSE = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M6 6l12 12M18 6L6 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export function TourPicker({ current }: { current?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const downOutside = useRef(false);
  const cards = useMemo(
    () =>
      listTours().map((t) => {
        const v = findVehicle(t.steps[0].scene.view.vehicleId);
        return { t, facts: v ? carFacts(v) : null };
      }),
    [],
  );

  useLayoutEffect(() => {
    const d = dialog.current!;
    if (!d.open) d.showModal();
    const on = d.querySelector<HTMLElement>('[aria-current="true"]') ?? d.querySelector('button');
    on?.focus({ preventScroll: true });
    return () => d.close();
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="apx-tours"
      aria-label="Tours"
      // keys typed in here are the sheet's, not the scene's
      onKeyDown={(e) => e.stopPropagation()}
      onCancel={(e) => {
        e.preventDefault();
        closeTours();
      }}
      onPointerDown={(e) => (downOutside.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOutside.current) closeTours();
      }}
    >
      <div className="apx-tours__sheet">
        <header className="apx-tours__head">
          <h2>Tours</h2>
          <button
            type="button"
            className="apx-tours__close"
            onClick={closeTours}
            aria-label="Close"
          >
            {CLOSE}
          </button>
        </header>
        <div className="apx-tours__grid">
          {cards.map(({ t, facts }) => (
            <button
              key={t.id}
              type="button"
              className="apx-tours__card"
              aria-current={t.id === current ? 'true' : undefined}
              onClick={() => startTour(t.id)}
            >
              {facts && (
                <span className="apx-tours__glyph" title={facts.name}>
                  <Glyph
                    places={facts.places}
                    drive={facts.drive}
                    unit={facts.source === 'EV' ? 'motor' : 'engine'}
                  />
                </span>
              )}
              <span className="apx-tours__q">{t.question}</span>
              <span className="apx-tours__teaser">{t.teaser}</span>
              <span className="apx-tours__steps" aria-label={`${t.steps.length} steps`}>
                {t.steps.map((s) => (
                  <i key={s.id} />
                ))}
              </span>
            </button>
          ))}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
