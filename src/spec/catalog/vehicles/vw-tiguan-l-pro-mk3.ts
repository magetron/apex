import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'vw-tiguan-l-pro-mk3',
  name: 'VW Tiguan L Pro 380TSI 4MOTION (Mk3)',
  archetype: 'suv',
  examples: [
    'VW Tiguan (Mk3, short wheelbase)',
    'Toyota RAV4',
    'Skoda Kodiaq (same MQB evo platform)',
  ],
  years: '2024–',
  dims: {
    wheelbaseMm: 2791,
    trackFMm: 1626,
    trackRMm: 1626,
    lengthMm: 4735,
    widthMm: 1859,
    heightMm: 1682,
    overhangFMm: 925,
  },
  // 235/50 R19, the largest size in its MIIT filing
  // ~ μ (lateral peak) 1.05, set so the sim's 100–0 km/h stop matches: 35.7 m from 100 km/h cold:
  // the EU Tiguan Mk3 2.0 TDI 4Motion — Auto Bild
  // ~ kind: OE touring
  tires: { widthFMm: 235, widthRMm: 235, diameterMm: 718, mu: 1.05, kind: 'road' },
  body: {
    style: 'suv',
    tail: 'hatch',
    bonnetHMm: 1050,
    beltHMm: 1120,
    cowlXMm: -250,
    roofFrontXMm: -1050,
    roofRearXMm: -2950,
    tailHMm: 1450,
    paint: '#29425f',
  },
  bay: { widthMm: 1100, lengthMm: 700 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-ea888-380tsi',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 190,
    crankYMm: 520,
    engineTiltDeg: 12,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 85,
    driven: 'all',
    // Haldex-type multi-plate coupling ahead of the rear diff: front-drive until it engages.
    awd: 'clutch-on-demand',
    frontTorqueShare: 0.9,
    fuelTank: { litres: 58, xMm: -2200 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 615 },
  bodyCgFrac: 0.48,
  extraMasses: [
    { id: 'ptu', label: 'Angle drive (power take-off)', kg: 15, posMm: [-80, 430, -150] },
    {
      id: 'prop-shaft',
      label: 'Prop shaft',
      kg: 13,
      posMm: [-1350, 380, 0],
      sizeMm: [2300, 80, 80],
    },
  ],
  blurb: 'A tall Golf: monocoque body, transverse engine and on-demand all-wheel drive.',
  published: {
    curbKg: 1790,
    frontPct: 58,
    source:
      'Tiguan L Pro 2024/25 380TSI 4WD R-Line (SAIC-VW, long-wheelbase China Mk3): 4735 × 1859 × 1682 mm, kerb 1790 kg, 2.0T 220 PS, 7-speed DSG, 4WD — db.auto.sohu.com; 162 kW / 350 Nm, wet dual-clutch — autohome.com.cn; wheelbase 2791 mm, MacPherson front / multilink rear — bitauto.com; 215/65 R17, 235/55 R18 or 235/50 R19 (MIIT filing) — autohome.com.cn; ~ tracks and front overhang measured on the model; ~ 58 L tank and 615 L boot as the Mk2 (not found for this car); ~ 58/42 split estimated (transverse FF-based AWD)',
  },
};

export default v;
