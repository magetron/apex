/**
 * Generic shell parameters derived from a VehicleSpec: the BodyProfile stations plus a style
 * preset. Any car WP6 adds gets a plausible body from this alone; bodies/<id>.ts refines it.
 */
import { getEngine } from '../../spec/catalog';
import type { BodyStyle, VehicleSpec } from '../../spec/types';
import { clamp, lerp, type Pt } from './curves';
import type { BodyContext, BodyParams, ExhaustTip, WheelArch } from './types';

interface StylePreset {
  clear: number;
  roofHalf: number;
  crown: number;
  cornerR: number;
  tuck: number;
  tuckUnder: number;
  topExp: number;
  shoulder: number;
  flare: [number, number];
  flareTop: number;
  nose: { len: number; p: number };
  tail: { len: number; p: number };
  beltCrease: boolean;
  archGap: number;
  lip: number;
  lipMat: 'paint' | 'black';
  /** how far the beltline rises toward the rear (mm) */
  beltRise: number;
  /** roof drop at its rear end (mm) */
  roofDrop: number;
}

const BASE: StylePreset = {
  clear: 135,
  roofHalf: 0.78,
  crown: 45,
  cornerR: 120,
  tuck: 45,
  tuckUnder: 30,
  topExp: 2.4,
  shoulder: 0.62,
  flare: [15, 20],
  flareTop: 0.15,
  nose: { len: 360, p: 2.4 },
  tail: { len: 280, p: 2.5 },
  beltCrease: true,
  archGap: 40,
  lip: 12,
  lipMat: 'paint',
  beltRise: 40,
  roofDrop: 40,
};

export const STYLE: Record<BodyStyle, StylePreset> = {
  city: {
    ...BASE,
    clear: 150,
    roofHalf: 0.86,
    crown: 35,
    cornerR: 110,
    tuck: 40,
    flare: [20, 25],
    nose: { len: 260, p: 2.4 },
    tail: { len: 170, p: 2.8 },
    lip: 14,
    beltRise: 50,
    roofDrop: 25,
  },
  hatch: {
    ...BASE,
    clear: 140,
    roofHalf: 0.8,
    nose: { len: 380, p: 2.4 },
    tail: { len: 250, p: 2.6 },
  },
  saloon: { ...BASE },
  estate: { ...BASE, tail: { len: 200, p: 2.8 }, roofDrop: 25 },
  coupe: {
    ...BASE,
    clear: 120,
    roofHalf: 0.7,
    crown: 50,
    tuck: 60,
    tuckUnder: 50,
    topExp: 2.2,
    shoulder: 0.55,
    flare: [25, 40],
    flareTop: 0.35,
    nose: { len: 380, p: 2.3 },
    tail: { len: 320, p: 2.4 },
    beltCrease: false,
    archGap: 38,
    lip: 14,
    beltRise: 60,
  },
  fastback: {
    ...BASE,
    roofHalf: 0.76,
    crown: 48,
    tuck: 50,
    topExp: 2.3,
    shoulder: 0.6,
    flare: [15, 25],
    nose: { len: 400, p: 2.2 },
    tail: { len: 320, p: 2.4 },
    beltCrease: false,
    beltRise: 50,
  },
  supercar: {
    ...BASE,
    clear: 105,
    roofHalf: 0.64,
    crown: 55,
    tuck: 70,
    tuckUnder: 45,
    topExp: 2.3,
    shoulder: 0.5,
    flare: [30, 45],
    flareTop: 0.4,
    nose: { len: 380, p: 2.2 },
    tail: { len: 300, p: 2.6 },
    archGap: 35,
    lip: 14,
    beltRise: 90,
    roofDrop: 30,
  },
  roadster: {
    ...BASE,
    clear: 120,
    roofHalf: 0.72,
    crown: 40,
    tuck: 50,
    topExp: 2.3,
    shoulder: 0.55,
    flare: [20, 30],
    flareTop: 0.3,
    nose: { len: 380, p: 2.3 },
    tail: { len: 300, p: 2.4 },
    beltCrease: false,
    archGap: 38,
    lip: 14,
    beltRise: 30,
  },
  suv: {
    ...BASE,
    clear: 190,
    roofHalf: 0.84,
    crown: 40,
    tuck: 40,
    topExp: 2.6,
    flare: [25, 25],
    nose: { len: 320, p: 2.6 },
    tail: { len: 220, p: 2.8 },
    archGap: 50,
    lip: 18,
    lipMat: 'black',
    beltRise: 45,
    roofDrop: 30,
  },
  offroader: {
    ...BASE,
    clear: 235,
    roofHalf: 0.93,
    crown: 18,
    cornerR: 50,
    tuck: 12,
    tuckUnder: 5,
    topExp: 6,
    shoulder: 0.7,
    flare: [40, 40],
    flareTop: 0.5,
    nose: { len: 110, p: 4 },
    tail: { len: 80, p: 5 },
    archGap: 60,
    lip: 24,
    lipMat: 'black',
    beltRise: 0,
    roofDrop: 10,
  },
};

export function bodyContext(v: VehicleSpec): BodyContext {
  const d = v.dims;
  const xF = d.overhangFMm;
  const xR = d.overhangFMm - d.lengthMm;
  const R = v.tires.diameterMm / 2;
  const style = STYLE[v.body.style];
  const arch = (axle: 'front' | 'rear', x: number, track: number, tw: number): WheelArch => ({
    axle,
    x,
    y: R,
    tyreR: R,
    archR: R + style.archGap,
    zInner: track / 2 - tw / 2 - 30,
    zOuter: track / 2 + tw / 2,
  });
  return {
    v,
    xF,
    xR,
    L: d.lengthMm,
    W: d.widthMm,
    H: d.heightMm,
    WB: d.wheelbaseMm,
    R,
    clear: style.clear,
    wheels: [
      arch('front', 0, d.trackFMm, v.tires.widthFMm),
      arch('rear', -d.wheelbaseMm, d.trackRMm, v.tires.widthRMm),
    ],
  };
}

function defaultExhaust(c: BodyContext): ExhaustTip[] {
  const pt = c.v.powertrain;
  if (pt.kind !== 'ice') return [];
  const cyl = getEngine(pt.engine).cylinders.length;
  const y = c.clear + 95;
  const z = 0.31 * c.W;
  return cyl >= 6
    ? [
        { z: -z, y, r: 42 },
        { z, y, r: 42 },
      ]
    : [{ z: -z, y, r: 38 }];
}

export function defaultParams(c: BodyContext): BodyParams {
  const { v, xF, xR, H, WB, clear } = c;
  const b = v.body;
  const st = STYLE[b.style];
  const bonnetH = clamp(b.bonnetHMm, clear + 250, H - 200);
  const beltH = clamp(b.beltHMm, bonnetH - 100, H - 150);
  const tailH = clamp(b.tailHMm, clear + 250, H - 40);
  const cowlX = clamp(b.cowlXMm, xR + 800, xF - 150);
  const roofF = clamp(b.roofFrontXMm, xR + 300, cowlX - 80);
  const roofR = clamp(b.roofRearXMm, xR + 60, roofF - 200);

  const nose = clamp(0.04 * c.L, 90, 200);
  const tipH = lerp(clear, bonnetH, 0.45);
  const bonnetFront = bonnetH - clamp(0.1 * (xF - cowlX), 30, 170);
  const roofEnd = H - st.roofDrop;

  const top: Pt[] = [
    [xF, tipH],
    [xF - 22, lerp(tipH, bonnetFront, 0.6)],
    [xF - nose, bonnetFront],
    [lerp(xF - nose, cowlX, 0.5), lerp(bonnetFront, bonnetH, 0.72)],
    [cowlX, bonnetH + 10],
    [lerp(cowlX, roofF, 0.5), lerp(bonnetH, H, 0.62)],
    [roofF, H - 15],
    [lerp(roofF, roofR, 0.38), H],
    [roofR, roofEnd],
  ];
  const tailTipH = tailH - 0.35 * (tailH - clear);
  let cabinRear: number;
  switch (b.tail) {
    case 'hatch': {
      const steep =
        b.style === 'suv' || b.style === 'city' || b.style === 'offroader' || b.style === 'estate'
          ? 0.4
          : 0.62;
      const xg = Math.max(xR + 90, roofR - steep * (roofR - xR));
      top.push(
        [roofR - 25, roofEnd - 12],
        [xg, tailH],
        [xR + 40, lerp(tailH, tailTipH, 0.6)],
        [xR, tailTipH],
      );
      cabinRear = xg;
      break;
    }
    case 'notch': {
      const deckX = roofR - 0.55 * (roofR - (xR + 80));
      top.push([deckX, tailH + 15], [xR + 90, tailH], [xR, tailTipH]);
      cabinRear = deckX;
      break;
    }
    case 'fastback': {
      top.push(
        [lerp(roofR, xR, 0.55), lerp(roofEnd, tailH, 0.78)],
        [xR + 100, tailH],
        [xR, tailTipH],
      );
      cabinRear = lerp(roofR, xR, 0.6);
      break;
    }
    case 'engine-deck': {
      top.push(
        [lerp(roofR, xR, 0.5), lerp(roofEnd, tailH, 0.75)],
        [xR + 120, tailH],
        [xR, tailTipH],
      );
      cabinRear = roofR - 120;
      break;
    }
  }

  const belt: Pt[] = [
    [xF, tipH - 12],
    [xF - nose * 1.3, bonnetFront + 10],
    [cowlX, beltH - 15],
    [roofF, beltH],
    [roofR, beltH + st.beltRise],
    [xR + st.tail.len * 0.6, Math.min(tailH, beltH + st.beltRise) - 10],
    [xR, tailTipH - 12],
  ];
  const bottom: Pt[] = [
    [xF, clear + 0.35 * (tipH - clear)],
    [xF - 220, clear + 40],
    [xF - 450, clear],
    [xR + 500, clear + 10],
    [xR + 200, clear + 70],
    [xR, clear + 0.24 * (tailH - clear)],
  ];
  const plan: Pt[] = [
    [xF, 0.95],
    [0, 0.985],
    [-WB * 0.5, 1],
    [-WB, 1],
    [xR, 0.97],
  ];
  return {
    top,
    belt,
    bottom,
    plan,
    nose: st.nose,
    tail: st.tail,
    cabin: [cabinRear, cowlX + 20],
    shoulder: st.shoulder,
    cornerR: st.cornerR,
    tuck: st.tuck,
    tuckUnder: st.tuckUnder,
    roofHalf: st.roofHalf,
    crown: st.crown,
    topExp: st.topExp,
    wing: [],
    wingAt: 0.78,
    beltCrease: st.beltCrease,
    archGap: st.archGap,
    flare: st.flare,
    flareTop: st.flareTop,
    lip: st.lip,
    lipMat: st.lipMat,
    accent: '#1d2024',
    mirrors: { x: cowlX - 140, dy: 70, mat: 'paint' },
    exhaust: defaultExhaust(c),
    spare: b.style === 'offroader',
    rails: b.style === 'suv',
    decals: (_s, d) => d,
  };
}
