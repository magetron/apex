import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-pe-vps',
  name: 'Inline-4 2.0 high-compression, transverse',
  layoutLabel: 'Inline-4, flat (180°) crank',
  examples: ['Mazda Skyactiv-G 2.0 PE-VPS (Mazda3, CX-30)', 'Mazda Skyactiv-G 2.5 PY-VPS'],
  boreMm: 83.5,
  strokeMm: 91.2,
  rodMm: 150,
  borePitchMm: 92,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 700,
  redlineRpm: 6500,
  massKg: 110,
  powerKw: 114,
  torqueNm: 200,
  sound: sound({
    character: 'thrum',
    // 4-2-1 exhaust manifold: long primaries tuned against residual-gas knock
    headerMm: 650,
    mix: { exhaust: 0.65, intake: 0.4, mechanical: 0.25 },
  }),
  notes:
    'The same block as the MX-5’s, turned across the car: a long 4-2-1 exhaust manifold lets it run 13:1 compression on regular fuel.',
  source:
    'Skyactiv-G 2.0 (Mazda3 G20, Australia): 83.5 × 91.2 mm, 1998 cc, 114 kW at 6000 rpm / 200 Nm at 4000 rpm — Mazda via carexpert.com.au; ~ rod, pitch (as the MX-5 block) and mass estimated',
});
