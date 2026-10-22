import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-k12m',
  name: 'Inline-4 1.2 short-stroke',
  layoutLabel: 'Inline-4, flat (180°) crank, twin cam',
  examples: ['Suzuki K12M (Swift, Baleno, Dzire)', 'Suzuki K12N DualJet'],
  boreMm: 73,
  strokeMm: 71.5,
  rodMm: 125,
  borePitchMm: 80,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 750,
  redlineRpm: 6300,
  massKg: 80,
  powerKw: 61,
  torqueNm: 113,
  sound: sound({
    character: 'thrum',
    headerMm: 450,
    mix: { exhaust: 0.6, intake: 0.35, mechanical: 0.3 },
  }),
  source:
    'K12M: 73 × 71.5 mm, 1197 cc, 61 kW (83 PS) at 6000 rpm / 113 Nm at 4200 rpm — Wikipedia "Suzuki K engine" and Maruti Suzuki data; ~ rod, bore pitch, red line and mass estimated',
});
