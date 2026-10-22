import { sound, vr } from '../../builders';

export default vr(6, 15, {
  id: 'vr6',
  name: 'VR6 (narrow-angle)',
  layoutLabel: '15° VR6, one head, staggered cylinders',
  examples: ['VW VR6 (Golf R32, Corrado)', 'VW 3.6 VR6 (Atlas, Passat)'],
  boreMm: 84,
  strokeMm: 95.9,
  rodMm: 164,
  borePitchMm: 65,
  firstRow: 'left',
  firingOrder: [1, 5, 3, 6, 2, 4],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 700,
  redlineRpm: 6500,
  massKg: 165,
  powerKw: 184,
  torqueNm: 320,
  sound: sound({ character: 'howl' }),
  notes:
    'Invented so a six-cylinder could fit transversely between the front wheels of a Golf/Passat.',
  source: '~ VW 3.2 VR6: bore/stroke VW; axial step, rod and mass estimated',
});
