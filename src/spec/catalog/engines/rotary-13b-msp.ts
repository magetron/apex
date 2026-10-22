import { exhaustPort, intakePort, rotary, sound } from '../../builders';

export default rotary(2, {
  id: 'rotary-13b-msp',
  name: 'Two-rotor Wankel 1.3',
  layoutLabel: 'Two-rotor Wankel, rotors 180° apart, side ports',
  examples: ['Mazda RENESIS 13B-MSP (RX-8)', 'Mazda 13B-REW (RX-7 FD)', 'Mazda 12A (RX-7 SA)'],
  firingOrder: [1, 2],
  rotary: {
    generatingRadiusMm: 105,
    eccentricityMm: 15,
    rotorWidthMm: 80,
    sideHousingMm: 45,
    compressionRatio: 10,
    sparkPlugsPerRotor: 2,
    // high-power 6-port engine: three intake ports and two exhaust ports per rotor, all in the
    // side housings, so the exhaust shuts before the intake opens (no overlap)
    ports: [
      intakePort('primary', 'side', 1, 3, 65),
      intakePort('secondary', 'side', 1, 12, 36),
      intakePort('auxiliary', 'side', 1, 38, 80),
      exhaustPort('exhaust', 'side', 2, 50, 3),
    ],
  },
  induction: 'na',
  idleRpm: 800,
  redlineRpm: 9000,
  massKg: 125,
  powerKw: 177,
  torqueNm: 211,
  // wet sump with a shallow pan: the whole engine is barely taller than the gearbox
  geometry: { sumpDepthMm: 55 },
  sound: sound({
    character: 'shriek',
    headerMm: 450,
    mix: { exhaust: 0.8, intake: 0.45, mechanical: 0.1 },
  }),
  notes:
    'Nothing reciprocates: two triangular rotors orbit the eccentric shaft at a third of its speed, and each fires once per shaft turn. Side exhaust ports shut before the intake opens, which keeps fresh charge out of the exhaust.',
  source:
    'RENESIS 13B-MSP: 2 × 654 cc, 10.0:1, port timing (high power) intake primary 3° ATDC–65° ABDC, secondary 12° ATDC–36° ABDC, auxiliary 38° ATDC–80° ABDC, exhaust 50° BBDC–3° BTDC — Mazda RX-8 service manual (engine specifications, via foxed.ca); R 105 mm, e 15 mm, 80 mm rotors (all production Mazda Wankels) and 112 kg with standard attachments, dry — Wikipedia "Mazda Wankel engine"; 177 kW at 8200 rpm / 211 Nm at 5500 rpm (6-speed manual, high output) — australiancar.reviews; 9000 rpm redline (6-port manual) — Wikipedia "Mazda RX-8"; 338 mm core height, two side exhaust ports per chamber — Mazda via supercars.net; ~ side-housing thickness, idle, pan depth and 125 kg installed mass estimated',
});
