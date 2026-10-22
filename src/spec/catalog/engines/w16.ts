import { sound, w } from '../../builders';

export default w(16, 90, 15, {
  id: 'w16',
  name: 'W16 quad-turbo',
  layoutLabel: 'W16: two 15° VR8 blocks at 90°',
  examples: ['Bugatti 8.0 W16 (Veyron, Chiron)'],
  boreMm: 86,
  strokeMm: 86,
  rodMm: 161,
  borePitchMm: 66,
  firingOrder: [1, 14, 9, 4, 7, 12, 15, 6, 13, 8, 3, 16, 11, 2, 5, 10],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'quad-turbo',
  idleRpm: 800,
  redlineRpm: 6700,
  massKg: 400,
  powerKw: 1103,
  torqueNm: 1600,
  geometry: { drySump: true },
  sound: sound({
    character: 'whoosh',
    collector: 'per-bank',
    turbo: { count: 4, spoolRpm: 2000, maxShaftKrpm: 150, bov: true, antiLag: false },
  }),
  notes: 'A power stroke every 45°; four turbos, ten radiators.',
  source:
    '~ Bugatti W16: bore/stroke Bugatti; firing order/numbering illustrative, other figures estimated',
});
