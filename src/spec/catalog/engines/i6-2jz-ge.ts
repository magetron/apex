import { inline, sound } from '../../builders';

export default inline(6, {
  id: 'i6-2jz-ge',
  name: 'Inline-6 3.0 twin-cam (2JZ-GE)',
  layoutLabel: 'Inline-6, 120° crank, twin-cam',
  examples: [
    'Toyota 2JZ-GE (Supra A80 SZ, Aristo, Lexus IS300/GS300)',
    'Toyota 2JZ-GTE (Supra RZ)',
  ],
  boreMm: 86,
  strokeMm: 86,
  rodMm: 142,
  borePitchMm: 96,
  firingOrder: [1, 5, 3, 6, 2, 4],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 700,
  redlineRpm: 6800,
  massKg: 205,
  powerKw: 165,
  torqueNm: 284,
  sound: sound({
    character: 'smooth',
    headerMm: 650,
    mix: { exhaust: 0.75, intake: 0.35, mechanical: 0.2 },
  }),
  notes:
    'Square 86 × 86 mm, iron block, alloy head. The same block took twin turbos as the 2JZ-GTE, which is why it is known for strength.',
  source:
    '2JZ-GE (JZA80 SZ-R): 86.0 × 86.0 mm, 2997 cc, 225 PS (165 kW) at 6000 rpm / 284 Nm at 4800 rpm — toyota.jp used-car catalogue (E-JZA80, 1994–99); 142 mm rods, iron block, bore pitch shared with the 1JZ — Wikipedia "Toyota JZ engine" and parts makers; ~ 96 mm bore pitch, mass and redline estimated',
});
