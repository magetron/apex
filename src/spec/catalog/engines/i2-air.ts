import { inline, sound } from '../../builders';

export default inline(2, {
  id: 'i2-air',
  name: 'Air-cooled inline-2',
  layoutLabel: 'Inline-2, 360° crank (pistons rise together)',
  examples: [
    'Fiat Nuova 500 D–L (499.5 cc, 1960–72)',
    'Fiat 126 (594/652 cc)',
    'Fiat Nuova 500 (479 cc, 1957) and 500 R (594 cc, 1972–75)',
  ],
  // 500 D–L bore; the 1957 car's 479 cc used 66 × 70 mm, the 500 R / 126 73.5 × 70 mm.
  boreMm: 67.4,
  strokeMm: 70,
  rodMm: 118,
  borePitchMm: 96,
  // Both pistons rise together and fire alternately: one power stroke every 360°.
  firingOrder: [1, 2],
  valvetrain: { type: 'ohv', valvesPerCyl: 2 },
  induction: 'na',
  idleRpm: 900,
  redlineRpm: 4800,
  massKg: 55,
  powerKw: 13.2,
  torqueNm: 31,
  geometry: { sumpDepthMm: 70 },
  sound: sound({
    character: 'thrum',
    // Two long primaries loop down from the head into one transverse silencer.
    headerMm: 750,
    collectorMm: 300,
    mufflerMm: 500,
    tailpipeMm: 400,
    mix: { exhaust: 0.8, intake: 0.2, mechanical: 0.1 },
  }),
  notes:
    'Behaves like a big single: with a 360° crank the primary shake is not cancelled, so the engine rocks on its mounts. A belt-driven fan blows air over the finned barrels.',
  source:
    '500 F (1965–72): 499.5 cc air-cooled twin, 18 PS (13.2 kW) — auction data (Pandolfini 1968 500 F: 18.2 bhp; Dore & Rees) and Wikipedia "Fiat 500"; 67.4 × 70 mm (500 D–L; 499.5 cc checks out); 500 R / 126: 73.5 × 70 mm, 594 cc; ~ rod, pitch, torque and mass estimated',
});
