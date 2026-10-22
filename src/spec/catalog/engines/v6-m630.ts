import { sound, vee } from '../../builders';

export default vee(6, 120, {
  id: 'v6-m630',
  name: '120° V6 3.0 twin-turbo',
  layoutLabel: '120° V6, shared pins, turbos in the vee, dry sump',
  examples: ['McLaren M630 (Artura, Artura GT4)'],
  boreMm: 84,
  strokeMm: 90,
  rodMm: 150,
  borePitchMm: 96,
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 4, 2, 5, 3, 6],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 900,
  redlineRpm: 8500,
  massKg: 160,
  powerKw: 430,
  torqueNm: 584,
  geometry: { drySump: true },
  sound: sound({
    character: 'shriek',
    collector: 'per-bank',
    turbo: { count: 2, spoolRpm: 2500, maxShaftKrpm: 180, bov: true, antiLag: false },
  }),
  notes:
    'Wide and flat: 120° between the banks fires evenly on three crank pins and leaves room for both turbos in the vee, so the engine sits very low.',
  source:
    'M630: 2993 cc, 120° vee, dry sump, 430 kW (585 PS) / 584 Nm without the hybrid motor, 8500 rpm, ~160 kg — McLaren via Wikipedia "McLaren Artura" / "McLaren M630 engine"; ~ 84 × 90 mm bore/stroke (Wikipedia infobox, uncited); ~ rod, pitch and firing order estimated',
});
