import { inline, sound } from '../../builders';

export default inline(6, {
  id: 'i6-m30',
  name: 'Inline-6 3.0 SOHC (M30)',
  layoutLabel: 'Inline-6, 120° crank, single overhead cam',
  examples: ['BMW M30 (3.0 CSL, E3, E12/E28 5 Series, E24 6 Series)'],
  boreMm: 89.25,
  strokeMm: 80,
  rodMm: 135,
  borePitchMm: 100,
  firingOrder: [1, 5, 3, 6, 2, 4],
  valvetrain: { type: 'sohc', valvesPerCyl: 2 },
  induction: 'na',
  idleRpm: 900,
  redlineRpm: 6400,
  massKg: 195,
  powerKw: 147,
  torqueNm: 272,
  sound: sound({
    character: 'smooth',
    headerMm: 750,
    mix: { exhaust: 0.75, intake: 0.4, mechanical: 0.25 },
  }),
  notes:
    'Iron block, alloy cross-flow head. BMW installs the "big six" leaning 30° to the right so it fits under a low bonnet.',
  source:
    'M30B30 (3.0 CSL, Bosch D-Jetronic): 89.25 × 80 mm, 3003 cc, 200 PS (147 kW) at 5500 rpm / 272 Nm at 4300 rpm — BMW via Wikipedia "BMW E9" and supercarnostalgia.com; 100 mm bore spacing, 135 mm rods (M30); ~ mass and redline estimated',
});
