import { flat, sound } from '../../builders';

export default flat(4, {
  id: 'flat4',
  name: 'Flat-4 (boxer) turbo',
  layoutLabel: 'Horizontally opposed 4',
  examples: ['Subaru EJ257 (WRX STI)', 'Subaru FA24', 'Porsche 718 (MA2)'],
  boreMm: 99.5,
  strokeMm: 79,
  rodMm: 130.5,
  borePitchMm: 113,
  numbering: 'alternating',
  firstBank: 'right',
  firingOrder: [1, 3, 2, 4],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 800,
  redlineRpm: 6700,
  massKg: 150,
  powerKw: 221,
  torqueNm: 407,
  sound: sound({
    character: 'rumble',
    // Unequal-length headers: exhaust pulses reach the collector unevenly → the classic burble.
    headerMm: [380, 680, 420, 720],
    collector: 'single',
    turbo: { count: 1, spoolRpm: 3000, maxShaftKrpm: 170, bov: true, antiLag: true },
  }),
  notes:
    'Opposed pistons cancel forces; a small rocking couple remains because opposite cylinders are offset.',
  source: '~ EJ257: bore/stroke/rod/pitch Subaru; header lengths illustrative',
});
