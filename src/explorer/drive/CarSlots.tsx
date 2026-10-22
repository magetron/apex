/**
 * The two cars, as chips at the top of the drive rail: A, the explorer's car (the URL's), and B,
 * what it is compared with; each its letter, its layout sketch (engine, centre of mass, driven
 * wheels) and its name. Clicking a chip opens the car picker for it; B's small menu offers car A
 * itself without the technique (or with more or less rear grip) and the question's own pick;
 * the arrows swap A and B.
 *
 * What B is shows on it: another car is a solid chip with its own layout sketch; car A itself
 * changed is a dashed ghost of car A's sketch, with what it leaves out (the lift, the throttle,
 * the catch, the brake) crossed out beside it. When a question brings another B, its chip comes
 * in afresh (keyed by what B is), so the change is seen.
 *
 * B starts as the question's own pick (the car that makes its point clearest, versus.ts) and
 * follows the question until the visitor picks; a picked car stays put across questions, in the
 * URL as `?vs=<id>` (the car view's own parameter, so a pair can be linked).
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { useTheme } from '../../scene/theme';
import type { VehicleSpec } from '../../spec/types';
import { openPicker } from '../panels/CarPicker';
import { withVehicle, type Go, type View } from '../view';
import { DRIVE_COLORS } from './colors';
import { InputGlyph, TWIN_LEAVES } from './glyphs';
import { LayoutSketch } from './LayoutSketch';
import { pickedRival, useDrive } from './state';
import { modelName } from './takeaway';
import { chooseRival, rivalOptions, type CompareKind, type Rival } from './versus';

const NONE: readonly string[] = [];

/** B's menu entry: its name (a car by its model, car A changed by what changed); what sets
 *  another car apart is its layout sketch's to show, not a note's. */
function optionText(r: Rival): string {
  return r.kind === 'less-rear' || r.kind === 'more-rear' ? `Car A with ${r.label}` : r.label;
}

const CHEVRON = (
  <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
    <path
      d="M6 9l6 6 6-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);
const SWAP = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
    <path
      d="M7 4v14M7 18l-3-3M7 18l3-3M17 20V6M17 6l-3 3M17 6l3 3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function CarSlots({ vehicle, view, go }: { vehicle: VehicleSpec; view?: View; go?: Go }) {
  const theme = useTheme((s) => s.theme);
  const colors = DRIVE_COLORS[theme];
  const scenario = useDrive((s) => s.scenario);
  const compare = useDrive((s) => s.compare);
  const vs = view?.vs ?? NONE;
  const picked = pickedRival(vs);
  const options = rivalOptions(vehicle, scenario, picked);
  const rival = chooseRival(vehicle, scenario, compare, picked);
  // the question's own pick, whatever the visitor chose
  const suggestion = rivalOptions(vehicle, scenario)[0];
  const same = (a: Rival, b: Rival) => a.kind === b.kind && a.vehicle.id === b.vehicle.id;

  // B is one car: a second pick replaces the first (the picker adds to the list)
  useEffect(() => {
    if (view && go && vs.length > 1) go({ ...view, vs: vs.slice(-1) }, { replace: true });
  }, [view, go, vs]);
  // a car newly picked for B is B, whatever was chosen before
  const lastPick = useRef(picked?.id);
  useEffect(() => {
    if (picked && picked.id !== lastPick.current) useDrive.setState({ compare: 'car' });
    lastPick.current = picked?.id;
  }, [picked]);

  const setB = (kind: CompareKind) => {
    useDrive.setState({ compare: kind });
    // anything but a picked car takes the pick out of the URL
    if (kind !== 'car' && view && go && vs.length) go({ ...view, vs: [] }, { replace: true });
  };
  const twin = rival.vehicle.id === vehicle.id;
  // what car A without the action leaves out, crossed out on its chip
  const leaves = rival.kind === 'without' ? TWIN_LEAVES[scenario] : undefined;
  const pick = (mode: 'go' | 'vs') => {
    // the picker's sheet needs the picker mounted: the timeline hosts it while picking
    useDrive.setState({ picking: true });
    openPicker(mode);
  };
  const swap = () => {
    if (!view || !go || twin) return;
    useDrive.setState({ compare: 'car' });
    go(withVehicle({ ...view, vs: [rival.vehicle.id] }, rival.vehicle.id));
  };

  return (
    <div className="apx-drive-pair" role="group" aria-label="The two cars">
      <button
        type="button"
        className="apx-drive-chip"
        style={{ '--sys': colors.you } as CSSProperties}
        onClick={() => pick('go')}
        title={`Car A: ${vehicle.name}`}
        aria-label={`Car A: ${vehicle.name}. Choose another`}
      >
        <b className="apx-drive-chip__tag" aria-hidden>
          A
        </b>
        <LayoutSketch vehicle={vehicle} color={colors.you} width={40} split={false} />
        <span className="apx-drive-chip__name">{modelName(vehicle.name)}</span>
      </button>
      <div
        key={`${rival.kind}:${rival.vehicle.id}`}
        className={`apx-drive-chip is-b${twin ? ' is-twin' : ''}`}
        style={{ '--sys': colors.rival } as CSSProperties}
      >
        <button
          type="button"
          className="apx-drive-chip__main"
          onClick={() => pick('vs')}
          title={`Car B: ${twin ? optionText(rival) : rival.vehicle.name}`}
          aria-label={`Car B: ${twin ? optionText(rival) : rival.vehicle.name}. Choose another`}
        >
          <b className="apx-drive-chip__tag" aria-hidden>
            B
          </b>
          <LayoutSketch vehicle={rival.vehicle} color={colors.rival} width={40} split={false} />
          {leaves && (
            <span className="apx-drive-chip__leaves">
              <InputGlyph input={leaves} off fill={0} />
            </span>
          )}
          <span className="apx-drive-chip__name">{rival.label}</span>
        </button>
        {/* B's other choices (car A without the technique…), behind a small menu */}
        <span className="apx-drive-chip__menu" title="More choices for car B">
          {CHEVRON}
          <select
            aria-label="Car B"
            value={same(rival, suggestion) ? 'auto' : rival.kind}
            onChange={(e) => setB(e.target.value as CompareKind)}
          >
            {options.map((r) => (
              <option key={r.kind} value={same(r, suggestion) ? 'auto' : r.kind}>
                {optionText(r)}
              </option>
            ))}
          </select>
        </span>
      </div>
      <button
        type="button"
        className="apx-drive-swap"
        onClick={swap}
        disabled={twin}
        aria-label="Swap car A and car B"
        title="Swap A and B"
      >
        {SWAP}
      </button>
    </div>
  );
}
