import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-ea888-evo4-facelift',
  name: 'Inline-4 turbo, high output (Golf R 2024–)',
  layoutLabel: 'Inline-4, flat (180°) crank',
  examples: ['VW EA888 evo4 (Golf R and R Variant, 2024 facelift)', 'Audi S3 (8Y facelift)'],
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
  powerKw: 245,
  torqueNm: 420,
  sound: sound({
    character: 'thrum',
    headerMm: 300,
    turbo: { count: 1, spoolRpm: 2100, maxShaftKrpm: 210, bov: true, antiLag: false },
  }),
  notes:
    'The GTI’s block with a bigger turbo: the same engine bay, so the extra hardware goes into the driveline.',
  source:
    'The 2024 facelift tune of i4-ea888-evo4 (same geometry and sound): 245 kW (333 PS) — volkswagen.at technical data (Golf R), angurten.de (R Variant); 420 Nm as before (VW; 2024 R Variant at angurten.de); 82.5 × 92.8 mm, 1984 cc — VW via Wikipedia "Volkswagen Golf Mk8"; rod 144 mm, pitch 88 mm as EA888; ~ mass estimated',
});
