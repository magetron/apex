import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-skyactiv',
  name: 'Inline-4 2.0 high-compression',
  layoutLabel: 'Inline-4, flat (180°) crank',
  examples: ['Mazda Skyactiv-G 2.0 (MX-5 ND, Mazda3)'],
  boreMm: 83.5,
  strokeMm: 91.2,
  rodMm: 150,
  borePitchMm: 92,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 750,
  redlineRpm: 7500,
  massKg: 115,
  powerKw: 135,
  torqueNm: 205,
  sound: sound({
    character: 'thrum',
    headerMm: 650,
    mix: { exhaust: 0.7, intake: 0.45, mechanical: 0.25 },
  }),
  notes: 'In the MX-5 it sits longitudinally, entirely behind the front axle line.',
  source:
    'Skyactiv-G 2.0 (MX-5 ND2, 2019+): 83.5 × 91.2 mm, 1998 cc, 135 kW (184 PS) / 205 Nm, 7500 rpm red line — Mazda press data; ~ rod, pitch and mass estimated',
});
