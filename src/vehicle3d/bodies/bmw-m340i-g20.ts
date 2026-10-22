/**
 * BMW M340i (G20): the classic three-box saloon. Long bonnet with the screen well behind the
 * front axle, short front overhang, notchback boot, the Hofmeister kink in the C-pillar, the big
 * twin-kidney grille and L-shaped tail lamps.
 */
import { dlo, pillar, poly, roundRect } from '../shell/decals';
import type { BodyTuning } from '../shell/types';

const tune: BodyTuning = () => ({
  top: [
    [780, 470],
    [768, 590],
    [730, 690],
    [450, 780],
    [0, 862],
    [-570, 950],
    [-850, 1130],
    [-1200, 1360],
    [-1350, 1415],
    [-1850, 1442],
    [-2350, 1425],
    [-2700, 1370],
    [-3000, 1240],
    [-3330, 1095],
    [-3600, 1082],
    [-3830, 1070],
    [-3900, 1032],
    [-3929, 880],
  ],
  belt: [
    [780, 460],
    [740, 680],
    [450, 790],
    [0, 862],
    [-570, 950],
    [-1350, 995],
    [-2700, 1050],
    [-3330, 1076],
    [-3800, 1062],
    [-3929, 870],
  ],
  bottom: [
    [780, 300],
    [650, 190],
    [400, 130],
    [-3300, 140],
    [-3600, 230],
    [-3929, 380],
  ],
  plan: [
    [780, 0.93],
    [300, 0.97],
    [0, 0.985],
    [-1400, 0.99],
    [-2851, 1],
    [-3929, 0.96],
  ],
  nose: { len: 330, p: 2.5 },
  tail: { len: 300, p: 2.6 },
  cabin: [-3330, -550],
  roofHalf: 0.78,
  crown: 45,
  topExp: 2.4,
  tuck: 50,
  tuckUnder: 30,
  shoulder: 0.64,
  beltCrease: true,
  flare: [15, 25],
  flareTop: 0.2,
  archGap: 40,
  lip: 10,
  mirrors: { x: -720, dy: 78, mat: 'paint' },
  exhaust: [
    { z: -560, y: 300, r: 44, w: 1.6 },
    { z: 560, y: 300, r: 44, w: 1.6 },
  ],
  decals: (s, d) => {
    const keep = d.filter((x) => ['windscreen', 'rear-window'].includes(x.tag ?? ''));
    const side = dlo(s, { rear: -2930, rearTop: -2640, kink: { from: -2760, h: 120 } });
    const xB = -1930;
    return [
      ...keep,
      { tag: 'dlo', view: 'side', ...side, mat: 'glass', mirror: true, offset: 4, nv: 4 },
      {
        tag: 'b-pillar',
        view: 'side',
        ...pillar(s, xB, 90),
        mat: 'black',
        mirror: true,
        offset: 7,
        nv: 3,
      },
      {
        tag: 'c-divider',
        view: 'side',
        ...pillar(s, -2640, 34),
        mat: 'black',
        mirror: true,
        offset: 7,
        nv: 3,
      },
      // twin kidneys in a chrome surround
      {
        tag: 'kidney-surround',
        view: 'front',
        ...roundRect(16, 330, 452, 712, 76),
        mat: 'chrome',
        mirror: true,
        offset: 3,
      },
      {
        tag: 'kidney',
        view: 'front',
        ...roundRect(34, 312, 470, 694, 62),
        mat: 'grille',
        mirror: true,
        offset: 6,
      },
      {
        tag: 'headlight',
        view: 'front',
        ...poly(
          [
            [370, 708],
            [830, 696],
          ],
          [
            [370, 708],
            [380, 646],
            [600, 630],
            [830, 652],
          ],
        ),
        mat: 'lamp',
        mirror: true,
        offset: 5,
      },
      {
        tag: 'intake',
        view: 'front',
        ...roundRect(-320, 320, 300, 410, 30),
        mat: 'grille',
        offset: 3,
      },
      {
        tag: 'intake-side',
        view: 'front',
        ...roundRect(470, 790, 290, 510, 46),
        mat: 'grille',
        mirror: true,
        offset: 3,
      },
      {
        tag: 'taillight',
        view: 'rear',
        ...poly(
          [
            [360, 1042],
            [880, 1030],
          ],
          [
            [360, 1042],
            [370, 978],
            [700, 982],
            [790, 905],
            [880, 900],
          ],
        ),
        mat: 'lampRed',
        mirror: true,
        offset: 5,
      },
      {
        tag: 'diffuser',
        view: 'rear',
        ...roundRect(-720, 720, 300, 430, 22),
        mat: 'black',
        offset: 3,
      },
    ];
  },
});

export default tune;
