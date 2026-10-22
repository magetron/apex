import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-2zz',
  name: 'Inline-4 1.8 VVTL-i',
  layoutLabel: 'Inline-4, flat (180°) crank, twin-cam with cam-lobe switching',
  examples: ['Toyota 2ZZ-GE (Lotus Elise 111R, Celica T-Sport, Corolla T-Sport)'],
  boreMm: 82,
  strokeMm: 85,
  rodMm: 137.5,
  borePitchMm: 87,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 850,
  redlineRpm: 8200,
  massKg: 110,
  powerKw: 141,
  torqueNm: 181,
  sound: sound({
    character: 'shriek',
    headerMm: 650,
    mix: { exhaust: 0.7, intake: 0.5, mechanical: 0.25 },
  }),
  notes:
    'A front-drive hatchback engine and gearbox, moved whole into the back of the Elise behind the seats.',
  source:
    '2ZZ-GE: 82 × 85 mm, 1796 cc, 141 kW (192 PS) / 181 Nm in the Elise 111R — Toyota/Lotus data via Wikipedia "Toyota ZZ engine"; ~ rod, pitch and mass estimated',
});
