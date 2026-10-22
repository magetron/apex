/**
 * Features measured on real, freely licensed recordings (Wikimedia Commons), with
 * test/features.ts on steady-rpm stretches. The audio itself is not in the repo: each entry names
 * its source so the numbers can be re-measured (#/dev/audio can fetch and decode it in the page).
 * rpm was found from the firing comb and checked against the averaged spectrum's peaks.
 *
 * Recording conditions differ (exterior at a hillclimb start line, under the bonnet, a promo
 * clip), so only what survives that is compared: where the energy sits among the firing
 * harmonics, how much lies below the firing order, how tonal the sound is, and how it tilts.
 */
export interface RealRecording {
  /** Commons file page */
  source: string;
  licence: string;
  author: string;
  conditions: string;
  /** the catalog engine closest to it, and the throttle to render it at */
  engine: string;
  throttle: number;
  /** stretch analysed (s), its rpm and firing order */
  t: [number, number];
  rpm: number;
  F: number;
  /** orders 0.5 and 1; every order below F; firing harmonics 2F–4F (dB re the firing line) */
  lope: number;
  sub: number;
  harm: number;
  /** share of 100 Hz–3 kHz power on the half-order lines */
  tonal: number;
  /** octave bands 125 Hz … 8 kHz, dB re the loudest */
  bands: number[];
  /** half orders up to 2F, dB re the firing line */
  orders: Record<string, number>;
}

const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`;

export const REAL: Record<string, RealRecording> = {
  'rover-v8-idle': {
    source: commons('Rover-v8-rr79.ogg'),
    licence: 'Public domain',
    author: 'Collard (English Wikipedia)',
    conditions: '1979 Range Rover, 3.5 Rover V8 (cross-plane, carburetted) idling; exterior',
    engine: 'v8-rover-40',
    throttle: 0.1,
    t: [0.5, 2.5],
    rpm: 839,
    F: 4,
    lope: -21.6,
    sub: -9.3,
    harm: -12.3,
    tonal: 0.55,
    bands: [0, -10, -13, -6, -7, -3, -7],
    orders: {
      0.5: -23,
      1: -28,
      1.5: -22,
      2: -21,
      2.5: -13,
      3: -19,
      3.5: -15,
      4: 0,
      4.5: -18,
      5: -9,
      5.5: -17,
      6: -15,
      6.5: -27,
      7: -21,
      7.5: -20,
      8: -12,
    },
  },
  'slant6-idle': {
    source: commons('225_Slant_Six.ogg'),
    licence: 'CC BY-SA 4.0',
    author: 'Scheinwerfermann',
    conditions: '1965 Chrysler Valiant 225 slant-6, medium idle; exterior',
    engine: 'i6-m30',
    throttle: 0.1,
    t: [6, 8.3],
    rpm: 841,
    F: 3,
    lope: -25.1,
    sub: -21.4,
    harm: 12.5,
    tonal: 0.72,
    bands: [0, -1, -5, -5, -8, -12, -33],
    orders: {
      0.5: -33,
      1: -26,
      1.5: -39,
      2: -27,
      2.5: -27,
      3: 0,
      3.5: -22,
      4: -21,
      4.5: -7,
      5: -31,
      5.5: -18,
      6: 11,
    },
  },
  '458-launch': {
    source: commons('Ferrari_458_Italia.ogg'),
    licence: 'CC BY-SA 3.0',
    author: 'Edvvc',
    conditions:
      'Ferrari 458 Italia (F136 flat-plane V8) held on the start line, Goodwood 2010; exterior',
    engine: 'v8-flat',
    throttle: 0.3,
    t: [0.6, 1.5],
    rpm: 2984,
    F: 4,
    lope: -26.8,
    sub: -24.4,
    harm: -19.2,
    tonal: 0.78,
    bands: [-28, 0, -17, -25, -30, -37, -51],
    orders: {
      0.5: -52,
      1: -27,
      1.5: -41,
      2: -29,
      2.5: -48,
      3: -51,
      3.5: -38,
      4: 0,
      4.5: -45,
      5: -33,
      5.5: -56,
      6: -25,
      6.5: -50,
      7: -34,
      7.5: -40,
      8: -19,
    },
  },
  'cayman-2000': {
    source: commons('2006_Porsche_Cayman_S_engine_sound.wav'),
    licence: 'CC BY-SA 3.0',
    author: 'John64',
    conditions:
      '2006 Porsche Cayman S (3.4 flat-6) cruising after a brisk pull; microphone on the car',
    engine: 'flat6-718',
    throttle: 0.3,
    t: [28.8, 32.9],
    rpm: 2016,
    F: 3,
    lope: -17,
    sub: -10.5,
    harm: 21.5,
    tonal: 0.29,
    bands: [-22, -2, 0, -3, -6, -12, -23],
    orders: {
      0.5: -20,
      1: -20,
      1.5: -16,
      2: -16,
      2.5: -17,
      3: 0,
      3.5: -14,
      4: -10,
      4.5: -35,
      5: -11,
      5.5: -15,
      6: 17,
    },
  },
  'scirocco-2230': {
    source: commons('Scirocco_r_0.ogg'),
    licence: 'Public domain',
    author: 'myvolkswagen',
    conditions: 'VW Scirocco R (EA888 2.0 TFSI I4) driving; promo clip',
    engine: 'i4',
    throttle: 0.3,
    t: [15.8, 16.5],
    rpm: 2231,
    F: 2,
    lope: -4,
    sub: -3.6,
    harm: 21.6,
    tonal: 0.79,
    bands: [0, -12, 0, -13, -30, -41, -48],
    orders: { 0.5: -10, 1: -5, 1.5: -15, 2: 0, 2.5: -10, 3: -7, 3.5: -17, 4: 21 },
  },
  'focusrs-1392': {
    source: commons('Ford_Focus_RS.ogg'),
    licence: 'CC BY-SA 3.0',
    author: 'Edvvc',
    conditions: 'Ford Focus RS Mk2 (2.5 I5 turbo) held on the start line, Goodwood 2009; exterior',
    engine: 'i5-duratec-rs',
    throttle: 0.2,
    t: [3.9, 4.9],
    rpm: 1396,
    F: 2.5,
    lope: -2.4,
    sub: 8,
    harm: 10.5,
    tonal: 0.79,
    bands: [-13, 0, -4, -5, -7, -10, -18],
    orders: { 0.5: -11, 1: -3, 1.5: 6, 2: 2, 2.5: 0, 3: -4, 3.5: -8, 4: -9, 4.5: -5, 5: 9 },
  },
  'vq35hr-idle': {
    source: commons('NISSAN_VQ35HR_engine.ogg'),
    licence: 'Public domain',
    author: 'TTTNIS',
    conditions: 'Nissan Fuga 350GT (VQ35HR 60° V6) idling',
    engine: 'v6-60',
    throttle: 0.1,
    t: [1.3, 2.3],
    rpm: 1028,
    F: 3,
    lope: -23.2,
    sub: -13.3,
    harm: 24.4,
    tonal: 0.86,
    bands: [-10, 0, -2, -6, -4, -2, -52],
    orders: {
      0.5: -24,
      1: -36,
      1.5: -32,
      2: -14,
      2.5: -28,
      3: 0,
      3.5: -5,
      4: 2,
      4.5: -2,
      5: -6,
      5.5: -12,
      6: 10,
    },
  },
};
