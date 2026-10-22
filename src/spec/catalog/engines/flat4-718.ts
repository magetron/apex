import { flat, sound } from '../../builders';

export default flat(4, {
  id: 'flat4-718',
  name: 'Flat-4 2.0 turbo',
  layoutLabel: 'Horizontally opposed 4',
  examples: [
    'Porsche 2.0 turbo flat-4 (718 Boxster/Cayman, 718 T)',
    'Porsche 2.5 turbo flat-4 (718 S, GTS 2.5)',
  ],
  boreMm: 91,
  strokeMm: 76.4,
  rodMm: 127,
  borePitchMm: 118,
  numbering: 'alternating',
  firstBank: 'right',
  firingOrder: [1, 3, 2, 4],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 800,
  redlineRpm: 7500,
  massKg: 140,
  powerKw: 220,
  torqueNm: 380,
  sound: sound({
    character: 'rumble',
    headerMm: 450,
    collector: 'single',
    turbo: { count: 1, spoolRpm: 2000, maxShaftKrpm: 200, bov: true, antiLag: false },
  }),
  notes:
    'Two cylinders fewer than the 911’s flat-6 family it comes from, and a turbo: short enough to sit low ahead of the rear axle.',
  source:
    '718 2.0: 1988 cc, 220 kW (300 PS) at 6500 rpm / 380 Nm from 2150 rpm in the Boxster T — auto-motor-und-sport.de; ~ 91 × 76.4 mm bore × stroke, rod, 118 mm pitch (as the 9A2 flat-6), red line and mass estimated; ~ cylinder numbering and firing order shown as for any flat-crank boxer four',
});
