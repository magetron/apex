import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-cr12de',
  name: 'Inline-4 1.2 16-valve',
  layoutLabel: 'Inline-4, flat (180°) crank, chain-driven twin cam',
  examples: ['Nissan CR12DE (Micra/March K12, Note E11)', 'Nissan CR14DE (Micra K12 1.4)'],
  boreMm: 71,
  strokeMm: 78.4,
  rodMm: 128,
  borePitchMm: 78,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 700,
  redlineRpm: 6500,
  massKg: 85,
  powerKw: 59,
  torqueNm: 110,
  sound: sound({
    character: 'thrum',
    headerMm: 450,
    mix: { exhaust: 0.6, intake: 0.35, mechanical: 0.3 },
  }),
  notes: 'A small, short block: across the car it leaves the cabin almost the whole length.',
  source:
    'CR12DE: 71 × 78.4 mm, 1240 cc, 59 kW (80 PS) at 5200 rpm / 110 Nm at 3600 rpm — ADAC Autokatalog (Micra 1.2 K12) and auto-data.net; ~ rod, bore pitch, red line and mass estimated',
});
