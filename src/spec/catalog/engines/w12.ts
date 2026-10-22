import { sound, w } from '../../builders';

export default w(12, 72, 15, {
  id: 'w12',
  name: 'W12 twin-turbo',
  layoutLabel: 'W12: two 15° VR6 blocks at 72°',
  examples: ['VW/Bentley 6.0 W12 (Continental GT, Phaeton)'],
  boreMm: 84,
  strokeMm: 90.2,
  rodMm: 160,
  borePitchMm: 65,
  firingOrder: [1, 12, 5, 8, 3, 10, 6, 7, 2, 11, 4, 9],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 650,
  redlineRpm: 6500,
  massKg: 270,
  powerKw: 485,
  torqueNm: 900,
  sound: sound({
    character: 'smooth',
    collector: 'per-bank',
    turbo: { count: 2, spoolRpm: 1500, maxShaftKrpm: 160, bov: true, antiLag: false },
  }),
  notes: 'Twelve cylinders in a block barely longer than a V8.',
  source: '~ VW W12: bore/stroke VW; firing order/numbering illustrative, other figures estimated',
});
