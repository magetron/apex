/**
 * The info card's comparison: the car on show and the cars it is compared with, one column
 * each, every number from the spec (carFacts) with the signed difference to the main car. Each
 * compared car can become the main one (⇄) or leave (×), and + adds one. How they stand and
 * where to look from are switched above the car picker (CompareBar).
 */
import type { CSSProperties } from 'react';
import { useTheme } from '../../scene/theme';
import type { VehicleSpec } from '../../spec/types';
import { compareColors, mainColor } from '../compare';
import { MAX_VS, withVehicle, type Go, type View } from '../view';
import { carFacts, compareRows } from './carFacts';
import { openPicker } from './CarPicker';
import './compare.css';

const SWAP = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
  </svg>
);
const CLOSE = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
);

export function CompareTable({
  view,
  go,
  vehicle,
  others,
}: {
  view: View;
  go: Go;
  vehicle: VehicleSpec;
  others: VehicleSpec[];
}) {
  const theme = useTheme((s) => s.theme);
  const main = carFacts(vehicle);
  const facts = others.map(carFacts);
  const rows = compareRows(main, facts);
  const colors = [mainColor(theme), ...compareColors(others, theme)];
  const drop = (id: string) => go({ ...view, vs: (view.vs ?? []).filter((x) => x !== id) });
  return (
    <div className="apx-cmp" style={{ '--cols': others.length + 1 } as CSSProperties}>
      <ul className="apx-cmp__cars" aria-label="Compared cars">
        {[main, ...facts].map((f, i) => (
          <li key={f.id} style={{ '--sys': colors[i] } as CSSProperties}>
            <i aria-hidden />
            <span className="apx-cmp__name" title={f.name}>
              {f.model}
            </span>
            {i > 0 && (
              <>
                <button
                  type="button"
                  aria-label={`Make ${f.name} the main car`}
                  title="Make it the main car"
                  onClick={() => go(withVehicle(view, f.id))}
                >
                  {SWAP}
                </button>
                <button
                  type="button"
                  aria-label={`Stop comparing with ${f.name}`}
                  title="Stop comparing"
                  onClick={() => drop(f.id)}
                >
                  {CLOSE}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <table className="apx-cmp__table">
        <thead>
          <tr>
            <th aria-hidden />
            {colors.map((c, i) => (
              <th key={i} scope="col" aria-label={i ? facts[i - 1].name : main.name}>
                <i style={{ '--sys': c } as CSSProperties} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} title={r.title}>
              <th scope="row">
                {r.label}
                {r.unit && <small>{r.unit}</small>}
              </th>
              {r.values.map((v, i) => {
                const d = i ? r.deltas[i - 1] : null;
                return (
                  <td key={i}>
                    <b>{v}</b>
                    {d && <em data-sign={d.sign}>{d.text}</em>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="apx-cmp__foot">
        {others.length < MAX_VS && (
          <button
            type="button"
            className="apx-cmp__add"
            onClick={() => openPicker('vs')}
            aria-label="Compare with another car"
            title="Compare with another car"
          >
            + Car
          </button>
        )}
      </div>
    </div>
  );
}
