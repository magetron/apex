/**
 * The info card's comparison: the car on show and the cars it is compared with, one column
 * each, every number from the spec (carFacts) with the signed difference to the main car. Each
 * compared car can become the main one (⇄) or leave (×), and + adds one. How they stand and
 * where to look from are switched above the car picker (CompareBar).
 */
import type { CSSProperties } from 'react';
import { useTheme } from '../../scene/theme';
import type { VehicleSpec } from '../../spec/types';
import { compareColors, mainColor, useCompare } from '../compare';
import { MAX_VS, withVehicle, type Go, type View } from '../view';
import { carFacts, compareRows, type CarFacts, type CompareRow } from './carFacts';
import { Glyph, openPicker } from './CarPicker';
import { compareLessons, layoutWords } from './lessons';
import { Why } from './Why';
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

/** The cars' columns (a dot in each car's colour heading them) and the given rows. */
function RowsTable({
  rows,
  main,
  facts,
  colors,
}: {
  rows: CompareRow[];
  main: CarFacts;
  facts: CarFacts[];
  colors: string[];
}) {
  return (
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
              const f = i ? facts[i - 1] : main;
              return (
                <td key={i} title={r.key === 'layout' ? layoutWords(f) : undefined}>
                  <b>{v}</b>
                  {d && <em data-sign={d.sign}>{d.text}</em>}
                  {r.key === 'layout' && (
                    // where the engine sits and which wheels drive, drawn, not spelled out
                    <span className="apx-cmp__glyph" role="img" aria-label={layoutWords(f)}>
                      <Glyph
                        places={f.places}
                        drive={f.drive}
                        unit={f.source === 'EV' ? 'motor' : 'engine'}
                      />
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The cars and their colours, as the comparison shows them. */
function useCompared(vehicle: VehicleSpec, others: VehicleSpec[]) {
  const theme = useTheme((s) => s.theme);
  const mode = useCompare((s) => s.mode);
  const main = carFacts(vehicle);
  const facts = others.map(carFacts);
  const colors = [mainColor(theme), ...compareColors(others, theme, mode)];
  return { main, facts, colors, rows: compareRows(main, facts) };
}

/**
 * The rows that aren't about the layout (the engine, power, mass), for the card's More: up front
 * they pushed the layout rows down.
 */
export function CompareMore({ vehicle, others }: { vehicle: VehicleSpec; others: VehicleSpec[] }) {
  const { main, facts, colors, rows } = useCompared(vehicle, others);
  return (
    <div className="apx-cmp" style={{ '--cols': others.length + 1 } as CSSProperties}>
      <RowsTable rows={rows.filter((r) => r.more)} main={main} facts={facts} colors={colors} />
    </div>
  );
}

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
  const { main, facts, colors, rows } = useCompared(vehicle, others);
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
      <RowsTable rows={rows.filter((r) => !r.more)} main={main} facts={facts} colors={colors} />
      <Why lessons={compareLessons(main, facts)} view={view} go={go} />
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
