import { flat, sound } from '../../builders';

export default flat(6, {
  id: 'flat6-m64-50',
  name: 'Flat-6 air-cooled turbo (M64/50)',
  layoutLabel: 'Horizontally opposed 6, air-cooled, single turbo',
  examples: [
    'Porsche M64/50 (964 Turbo 3.6)',
    'Porsche 930 Turbo 3.3',
    'Porsche 993 Carrera (M64, NA)',
  ],
  boreMm: 100,
  strokeMm: 76.4,
  rodMm: 127,
  borePitchMm: 118,
  numbering: 'bank-sequential',
  firstBank: 'right',
  firingOrder: [1, 6, 2, 4, 3, 5],
  valvetrain: { type: 'sohc', valvesPerCyl: 2 },
  induction: 'turbo',
  idleRpm: 900,
  redlineRpm: 6500,
  massKg: 230,
  powerKw: 265,
  torqueNm: 520,
  geometry: { drySump: true },
  sound: sound({
    character: 'whoosh',
    collector: 'per-bank',
    // One big KKK K27: the turbine soaks up most of the exhaust note, and boost arrives late.
    turbo: { count: 1, spoolRpm: 3200, maxShaftKrpm: 140, bov: true, antiLag: false },
  }),
  notes:
    'Finned barrels cooled by a belt-driven fan, one camshaft per bank and a dry sump; a single big turbo gives the classic Turbo’s late, hard boost.',
  source:
    'M64/50 (964 Turbo 3.6): 100 × 76.4 mm, 3600 cc, KKK K27 turbo, 360 PS (265 kW) at 5500 rpm / 520 Nm at 4200 rpm — Porsche via Wikipedia "Porsche 964"; 118 mm bore spacing, 127 mm rods (air-cooled 911 family); ~ mass and redline estimated',
});
