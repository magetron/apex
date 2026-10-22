import { sound, vee } from '../../builders';

export default vee(6, 120, {
  id: 'v6-120',
  name: '120° "hot-vee" V6 twin-turbo',
  layoutLabel: '120° V6, shared pins, turbos in the vee',
  examples: ['Ferrari F163 (296 GTB)', 'McLaren M630 (Artura)'],
  boreMm: 88,
  strokeMm: 82,
  rodMm: 140,
  borePitchMm: 100,
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 4, 2, 5, 3, 6],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 900,
  redlineRpm: 8500,
  massKg: 160,
  powerKw: 487,
  torqueNm: 630,
  geometry: { drySump: true },
  sound: sound({
    character: 'shriek',
    collector: 'per-bank',
    turbo: { count: 2, spoolRpm: 2500, maxShaftKrpm: 180, bov: true, antiLag: false },
  }),
  notes:
    'A 120° vee fires evenly on a 3-throw crank and leaves room for both turbos between the banks.',
  source: '~ F163 bore/stroke Ferrari; firing order and other figures illustrative',
});
