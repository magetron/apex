/**
 * Why the layout matters, as buttons: each names a drive question ("▶ Lift mid-corner") and
 * opens drive on it, with the car it is about alongside. The drive page shows what happens; the
 * card only asks.
 */
import { useDrive } from '../drive/state';
import type { Go, View } from '../view';
import type { Lesson } from './lessons';
import './compare.css';

const PLAY = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 5.5v13l10.5-6.5z" />
  </svg>
);

export function Why({ lessons, view, go }: { lessons: Lesson[]; view: View; go: Go }) {
  if (!lessons.length) return null;
  const ask = (l: Lesson) => {
    useDrive.getState().setScenario(l.scenario);
    go({ vehicleId: view.vehicleId, level: 'drive', vs: l.other ? [l.other] : view.vs });
  };
  return (
    <div className="apx-why" role="group" aria-label="Try it in Drive">
      {lessons.map((l) => (
        <button key={l.key} type="button" onClick={() => ask(l)} title={l.question}>
          {PLAY}
          {l.ask}
        </button>
      ))}
    </div>
  );
}
