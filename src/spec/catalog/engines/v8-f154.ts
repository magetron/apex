import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-f154',
  name: 'Flat-plane V8 twin-turbo',
  layoutLabel: '90° V8, flat-plane (180°) crank, twin-turbo, dry sump',
  examples: ['Ferrari F154 (F8 Tributo, 488 GTB, Roma, SF90)'],
  boreMm: 86.5,
  strokeMm: 83,
  rodMm: 140,
  borePitchMm: 104,
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 5, 3, 7, 4, 8, 2, 6],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 1000,
  redlineRpm: 8000,
  massKg: 200,
  powerKw: 530,
  torqueNm: 770,
  geometry: { drySump: true },
  sound: sound({
    character: 'shriek',
    collector: 'per-bank',
    // Ferrari uses equal-length, 3-into-1 style manifolds feeding twin-scroll turbos.
    headerMm: 480,
    turbo: { count: 2, spoolRpm: 2500, maxShaftKrpm: 210, bov: true, antiLag: false },
  }),
  notes:
    'Flat-plane crank: each bank fires evenly like an inline-4, so each turbo gets a steady pulse train and the crank is light.',
  source:
    'F154 CD (F8 Tributo): 86.5 × 83 mm, 3902 cc, 530 kW (720 cv) / 770 Nm, 8000 rpm — Ferrari press release (2019); ~ rod, pitch and mass estimated',
});
