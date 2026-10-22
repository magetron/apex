import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-cross',
  name: 'Cross-plane V8',
  layoutLabel: '90° V8, cross-plane crank',
  examples: ['GM LS3 (Corvette C6)', 'Ford Coyote (Mustang)', 'Mercedes-AMG M177'],
  boreMm: 103.25,
  strokeMm: 92,
  rodMm: 154.9,
  borePitchMm: 111.76,
  numbering: 'alternating',
  firstBank: 'left',
  pins: 'shared',
  firingOrder: [1, 8, 7, 2, 6, 5, 4, 3],
  valvetrain: { type: 'ohv', valvesPerCyl: 2 },
  induction: 'na',
  idleRpm: 650,
  redlineRpm: 6600,
  massKg: 210,
  powerKw: 321,
  torqueNm: 575,
  sound: sound({
    character: 'burble',
    // Each bank fires unevenly (90-180-270…), so a per-bank exhaust gets the lumpy burble.
    collector: 'per-bank',
    headerMm: 800,
  }),
  notes:
    'Pins at 90° steps; heavy counterweights cancel the primary rocking couple. Smooth but heavy crank.',
  source: '~ LS3: bore/stroke/rod/pitch GM; mass estimated',
});
