import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-ea211',
  name: 'Inline-4 1.5 turbo',
  layoutLabel: 'Inline-4, flat (180°) crank',
  examples: ['VW EA211 evo 1.5 TSI (Golf Mk8, Tiguan)', 'Skoda Octavia 1.5 TSI'],
  boreMm: 74.5,
  strokeMm: 85.9,
  rodMm: 140,
  borePitchMm: 82,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 750,
  redlineRpm: 6200,
  massKg: 105,
  powerKw: 110,
  torqueNm: 250,
  sound: sound({
    character: 'thrum',
    headerMm: 300,
    turbo: { count: 1, spoolRpm: 1500, maxShaftKrpm: 230, bov: false, antiLag: false },
  }),
  notes:
    'Exhaust side toward the bulkhead with the turbo close to the head; the block leans back in the car.',
  source:
    'EA211 evo 1.5 TSI: 74.5 × 85.9 mm, 1498 cc, 110 kW / 250 Nm, 82 mm bore pitch — VW press data; ~ rod length and mass estimated',
});
