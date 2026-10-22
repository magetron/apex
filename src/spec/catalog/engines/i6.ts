import { inline, sound } from '../../builders';

export default inline(6, {
  id: 'i6',
  name: 'Inline-6 turbo',
  layoutLabel: 'Inline-6, 120° crank',
  examples: ['BMW B58 (M340i, Supra)', 'Toyota 2JZ', 'Mercedes M256'],
  boreMm: 82,
  strokeMm: 94.6,
  rodMm: 144,
  borePitchMm: 91,
  firingOrder: [1, 5, 3, 6, 2, 4],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 700,
  redlineRpm: 7000,
  massKg: 180,
  powerKw: 285,
  torqueNm: 500,
  sound: sound({
    character: 'smooth',
    turbo: { count: 1, spoolRpm: 1600, maxShaftKrpm: 180, bov: true, antiLag: false },
  }),
  notes:
    'Mirror-symmetric crank: primary and secondary forces and couples all cancel — no balance shafts needed.',
  source: '~ B58: bore/stroke/pitch BMW; rod and mass estimated',
});
