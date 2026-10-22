import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-2zr-sc',
  name: 'Inline-4 1.8 supercharged',
  layoutLabel: 'Inline-4, flat (180°) crank, Roots-type supercharger',
  examples: [
    'Toyota 2ZR-FE, supercharged by Lotus (Elise S, Sport 220, Sprint 220)',
    'Toyota 2ZR-FE (Corolla, Auris)',
  ],
  boreMm: 80.5,
  strokeMm: 88.3,
  rodMm: 140,
  borePitchMm: 88,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'supercharged',
  idleRpm: 850,
  redlineRpm: 7000,
  massKg: 125,
  powerKw: 162,
  torqueNm: 250,
  sound: sound({
    character: 'howl',
    headerMm: 650,
    mix: { exhaust: 0.65, intake: 0.5, mechanical: 0.25 },
  }),
  notes:
    'A Toyota family-car engine with a Roots-type blower and intercooler added, installed behind the seats with its front-drive gearbox.',
  source:
    '2ZR-FE: 80.5 × 88.3 mm, 1798 cc — Toyota via Wikipedia "Toyota ZR engine"; Elise Sprint 220 162 kW at 6800 rpm / 250 Nm at 4600 rpm, supercharged and intercooled — carsales.com.au (2018 Sprint 220); ~ rod, pitch, red line and mass estimated',
});
