import { inline, sound } from '../../builders';

export default inline(3, {
  id: 'i3',
  name: 'Inline-3 turbo',
  layoutLabel: 'Inline-3, 120° crank',
  examples: ['Toyota G16E-GTS (GR Yaris)', 'Ford 1.0 EcoBoost', 'BMW B38'],
  boreMm: 87.5,
  strokeMm: 89.7,
  rodMm: 140,
  borePitchMm: 96,
  firingOrder: [1, 2, 3],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 850,
  redlineRpm: 7000,
  massKg: 110,
  powerKw: 206,
  torqueNm: 390,
  sound: sound({
    character: 'thrum',
    turbo: { count: 1, spoolRpm: 2500, maxShaftKrpm: 220, bov: true, antiLag: false },
  }),
  notes:
    'Primary and secondary forces cancel but leave rocking couples; many I3s add a balance shaft.',
  source: '~ G16E-GTS: bore/stroke Toyota; rod length, pitch and mass estimated',
});
