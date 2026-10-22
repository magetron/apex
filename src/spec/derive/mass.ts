/**
 * Mass properties derived from where the parts actually sit. The body/interior/chassis mass is
 * whatever the published kerb weight leaves over, placed at bodyCgFrac of the wheelbase — so the
 * weight split is driven by the powertrain layout, which is the point of the whole site.
 */
import type { ComponentMass, MassProps, PowertrainLayout, VehicleSpec } from '../types';
import { layoutPowertrain } from './layout';

export function massProps(
  v: VehicleSpec,
  layout: PowertrainLayout = layoutPowertrain(v),
): MassProps {
  const L = v.dims.wheelbaseMm;
  const known: ComponentMass[] = layout.parts
    .filter((p) => p.kg > 0)
    .map((p) => ({ id: p.id, label: p.label, kg: p.kg, posMm: p.posMm, sizeMm: p.sizeMm }));
  known.push(...(v.extraMasses ?? []));

  const knownKg = known.reduce((s, c) => s + c.kg, 0);
  const bodyKg = v.published.curbKg - knownKg;
  if (bodyKg < 0.25 * v.published.curbKg) {
    throw new Error(
      `${v.id}: listed components (${knownKg.toFixed(0)} kg) leave too little for the body`,
    );
  }
  const body: ComponentMass = {
    id: 'body',
    label: 'Body, interior & chassis',
    kg: bodyKg,
    posMm: [-v.bodyCgFrac * L, 0.4 * v.dims.heightMm, 0],
    sizeMm: [0.85 * v.dims.lengthMm, 0.6 * v.dims.heightMm, 0.85 * v.dims.widthMm],
  };
  const components = [...known, body];

  const totalKg = components.reduce((s, c) => s + c.kg, 0);
  const cg = [0, 1, 2].map(
    (k) => components.reduce((s, c) => s + c.kg * c.posMm[k], 0) / totalKg,
  ) as [number, number, number];
  const frontPct = (100 * (cg[0] + L)) / L;

  let izzMm2 = 0;
  for (const c of components) {
    const dx = c.posMm[0] - cg[0];
    const dz = c.posMm[2] - cg[2];
    izzMm2 += c.kg * (dx * dx + dz * dz);
    if (c.sizeMm) izzMm2 += (c.kg * (c.sizeMm[0] ** 2 + c.sizeMm[2] ** 2)) / 12;
  }

  return { totalKg, cgMm: cg, frontPct, izzKgM2: izzMm2 * 1e-6, components };
}
