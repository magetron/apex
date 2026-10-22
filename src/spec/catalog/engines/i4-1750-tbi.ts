import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-1750-tbi',
  name: 'Inline-4 1750 TBi turbo',
  layoutLabel: 'Inline-4, flat (180°) crank, turbo',
  examples: ['Alfa Romeo 1750 TBi (4C, Giulietta Quadrifoglio Verde)'],
  boreMm: 83,
  strokeMm: 80.5,
  rodMm: 138,
  borePitchMm: 90,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 800,
  redlineRpm: 6500,
  massKg: 130,
  powerKw: 177,
  torqueNm: 350,
  sound: sound({
    character: 'thrum',
    // pulse-converter exhaust manifold straight into the turbo
    headerMm: 300,
    turbo: { count: 1, spoolRpm: 2000, maxShaftKrpm: 200, bov: true, antiLag: false },
  }),
  notes:
    'A front-drive engine and twin-clutch gearbox, installed across the car behind the seats of the 4C.',
  source:
    '1750 TBi (4C): 83 × 80.5 mm, 1742 cc, 177 kW (240 PS) at 6000 rpm / 350 Nm — Alfa Romeo USA spec sheet via fiat500usa.com (2014); ~ rod, pitch, redline and mass estimated',
});
