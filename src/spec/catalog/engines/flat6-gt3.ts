import { flat, sound } from '../../builders';

export default flat(6, {
  id: 'flat6-gt3',
  name: 'Flat-6 4.0 high-revving',
  layoutLabel: 'Horizontally opposed 6, individual throttle bodies, dry sump',
  examples: ['Porsche 911 GT3 (992, 991.2)', 'Porsche 911 GT3 Cup (992)'],
  boreMm: 102,
  strokeMm: 81.5,
  rodMm: 127,
  borePitchMm: 118,
  numbering: 'bank-sequential',
  firstBank: 'right',
  firingOrder: [1, 6, 2, 4, 3, 5],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 900,
  redlineRpm: 9000,
  massKg: 205,
  powerKw: 375,
  torqueNm: 470,
  geometry: { drySump: true },
  sound: sound({
    character: 'shriek',
    collector: 'per-bank',
    headerMm: 560,
    mix: { exhaust: 0.8, intake: 0.5, mechanical: 0.25 },
  }),
  notes:
    'The race car’s engine: six throttle bodies and a dry sump, revving to 9000 rpm behind the rear axle.',
  source:
    '992 GT3: 3996 cc, 375 kW (510 PS) at 8400 rpm / 470 Nm at 6100 rpm, 13.3:1 — auto motor und sport Supertest data; 9000 rpm, individual throttle bodies, dry sump — Motor1 (2021); ~ 102 × 81.5 mm as the 991.2 GT3 4.0; ~ rod, pitch and mass estimated',
});
