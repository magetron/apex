import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-ea888-evo4',
  name: 'Inline-4 turbo, high output',
  layoutLabel: 'Inline-4, flat (180°) crank',
  examples: ['VW EA888 evo4 (Golf R Mk8, Tiguan R)', 'Audi S3 (8Y)'],
  boreMm: 82.5,
  strokeMm: 92.8,
  rodMm: 144,
  borePitchMm: 88,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 750,
  redlineRpm: 6500,
  massKg: 145,
  powerKw: 235,
  torqueNm: 420,
  sound: sound({
    character: 'thrum',
    headerMm: 300,
    turbo: { count: 1, spoolRpm: 2100, maxShaftKrpm: 210, bov: true, antiLag: false },
  }),
  notes:
    'The GTI’s block with a bigger turbo: the same engine bay, so the extra hardware goes into the driveline.',
  source:
    'EA888 evo4 (Golf R Mk8): 82.5 × 92.8 mm, 1984 cc, 235 kW (320 PS) / 420 Nm (DSG) — VW via Wikipedia "Volkswagen Golf Mk8"; rod 144 mm, pitch 88 mm as EA888; ~ mass estimated',
});
