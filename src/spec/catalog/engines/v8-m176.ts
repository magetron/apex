import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-m176',
  name: 'Cross-plane V8 twin-turbo, luxury',
  layoutLabel: '90° V8, cross-plane crank, turbos in the vee',
  examples: ['Mercedes-Benz M176 (S 580 W223, G 500 W463)', 'Maybach S 580'],
  boreMm: 83,
  strokeMm: 92,
  rodMm: 150,
  borePitchMm: 106,
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 5, 4, 2, 6, 3, 7, 8],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 600,
  redlineRpm: 6200,
  massKg: 215,
  powerKw: 370,
  torqueNm: 700,
  sound: sound({
    character: 'burble',
    collector: 'per-bank',
    headerMm: 320,
    mufflerMm: 900,
    mix: { exhaust: 0.45, intake: 0.25, mechanical: 0.15 },
    turbo: { count: 2, spoolRpm: 1500, maxShaftKrpm: 170, bov: false, antiLag: false },
  }),
  notes:
    'Shuts down four cylinders at light load; a 48 V starter-generator sits between engine and gearbox.',
  source:
    'M176 (S 580 4MATIC, 2020): 83 × 92 mm, 3982 cc, 370 kW (503 PS) / 700 Nm — Mercedes-Benz press kit; the 2016–18 G 500 uses it at 310 kW / 610 Nm; ~ rod, pitch and mass estimated',
});
