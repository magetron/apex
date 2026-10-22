import { sound, vee } from '../../builders';

export default vee(6, 90, {
  id: 'v6-90',
  name: '90° V6 twin-turbo, hot-vee',
  layoutLabel: '90° V6, split pins (even fire), turbos in the vee',
  examples: ['Audi 2.9 TFSI EA839 (RS4 B9, RS5, Porsche Panamera 4S)', 'Audi 3.0 TFSI'],
  boreMm: 84.5,
  strokeMm: 86,
  rodMm: 155,
  borePitchMm: 90,
  numbering: 'bank-sequential',
  firstBank: 'right',
  // A 90° vee wants 120° for even firing, so each pair of crank pins is split by 30°.
  pins: 'split',
  firingOrder: [1, 4, 3, 6, 2, 5],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 700,
  redlineRpm: 6700,
  massKg: 182,
  powerKw: 331,
  torqueNm: 600,
  sound: sound({
    character: 'thrum',
    collector: 'per-bank',
    headerMm: 300,
    turbo: { count: 2, spoolRpm: 1900, maxShaftKrpm: 200, bov: true, antiLag: false },
  }),
  notes:
    'Short enough to hang ahead of the front axle in a longitudinal Audi; the turbos sit inside the vee to keep the exhaust path short.',
  source:
    '2.9 TFSI: 84.5 × 86 mm, 2894 cc, 331 kW (450 PS) / 600 Nm, engine 182 kg — Audi MediaCenter, RS 4 Avant (B9) drivetrain; ~ rod and pitch estimated',
});
