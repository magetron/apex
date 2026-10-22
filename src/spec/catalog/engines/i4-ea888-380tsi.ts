import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-ea888-380tsi',
  name: 'Inline-4 turbo (EA888, 380TSI)',
  layoutLabel: 'Inline-4, flat (180°) crank',
  examples: ['VW EA888 2.0 TSI 380TSI (Tiguan L Pro, China)', 'VW EA888 2.0 TSI (Golf GTI)'],
  boreMm: 82.5,
  strokeMm: 92.8,
  rodMm: 144,
  borePitchMm: 88,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 750,
  redlineRpm: 6800,
  massKg: 140,
  powerKw: 162,
  torqueNm: 350,
  sound: sound({
    character: 'thrum',
    turbo: { count: 1, spoolRpm: 1800, maxShaftKrpm: 200, bov: true, antiLag: false },
  }),
  notes:
    'Primary balanced; a 2nd-order vertical shake remains, so larger I4s carry twin balance shafts.',
  source:
    'The 380TSI tune of the i4 EA888 (same geometry and sound): 162 kW (220 PS) / 350 Nm in the Tiguan L Pro — autohome.com.cn, bitauto.com; ~ EA888 Gen3/4 bore/stroke/rod/pitch VW; mass estimated',
});
