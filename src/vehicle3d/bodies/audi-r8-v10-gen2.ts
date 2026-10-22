/**
 * Audi R8 V10 (Gen 2): low, wide mid-engine wedge. Cab-forward screen that starts almost over
 * the front axle, a long glazed engine cover sloping to the tail, the split side blade behind
 * the door, hexagonal Singleframe grille with big side intakes, and a black mesh tail.
 */
import { dlo, poly, roundRect } from '../shell/decals';
import type { BodyTuning, Decal } from '../shell/types';

const tune: BodyTuning = () => ({
  top: [
    [880, 420],
    [868, 500],
    [820, 572],
    [550, 640],
    [200, 700],
    [-150, 742],
    [-300, 758],
    [-550, 960],
    [-880, 1196],
    [-960, 1226],
    [-1250, 1240],
    [-1580, 1224],
    [-1720, 1198],
    [-2100, 1136],
    [-2600, 1086],
    [-3000, 1062],
    [-3300, 1056],
    [-3420, 1040],
    [-3500, 950],
    [-3546, 780],
  ],
  belt: [
    [880, 410],
    [840, 560],
    [600, 660],
    [200, 720],
    [-300, 772],
    [-950, 820],
    [-1600, 870],
    [-2100, 940],
    [-2650, 992],
    [-3200, 990],
    [-3450, 940],
    [-3546, 770],
  ],
  bottom: [
    [880, 270],
    [760, 170],
    [500, 110],
    [-3000, 115],
    [-3300, 200],
    [-3546, 330],
  ],
  plan: [
    [880, 0.9],
    [400, 0.95],
    [0, 0.97],
    [-1300, 0.955],
    [-2650, 1],
    [-3546, 0.96],
  ],
  nose: { len: 380, p: 2.3 },
  tail: { len: 260, p: 2.8 },
  cabin: [-1760, -290],
  roofHalf: 0.62,
  crown: 50,
  topExp: 2.6,
  tuck: 60,
  tuckUnder: 40,
  shoulder: 0.5,
  beltCrease: true,
  wing: [
    [-2000, 0],
    [-2650, 30],
    [-3200, 20],
    [-3460, 0],
  ],
  wingAt: 0.86,
  flare: [25, 45],
  flareTop: 0.45,
  archGap: 34,
  lip: 8,
  accent: '#2a2c31',
  mirrors: { x: -420, dy: 72, mat: 'paint' },
  exhaust: [
    { z: -560, y: 330, r: 50, w: 1.4 },
    { z: 560, y: 330, r: 50, w: 1.4 },
  ],
  decals: (s, d) => {
    const keep = d.filter((x) => x.tag === 'windscreen');
    // glazed engine cover, framed in black, with two cross ribs
    const cover = (x0: number, x1: number, zw: number): Decal => ({
      view: 'top',
      ...roundRect(x0, x1, -zw, zw, 60),
      mat: 'glass',
      offset: 4,
    });
    return [
      ...keep,
      {
        tag: 'rear-screen',
        view: 'top',
        ...roundRect(-1900, -1745, -380, 380, 30),
        mat: 'glass',
        offset: 4,
      },
      {
        tag: 'engine-cover-frame',
        view: 'top',
        ...roundRect(-2930, -1960, -470, 470, 70),
        mat: 'black',
        offset: 3,
      },
      { tag: 'engine-cover', ...cover(-2900, -1990, 430) },
      {
        tag: 'rib',
        view: 'top',
        ...roundRect(-2480, -2440, -430, 430, 8),
        mat: 'black',
        offset: 6,
        nv: 3,
        outline: false,
      },
      {
        tag: 'dlo',
        view: 'side',
        ...dlo(s, { rear: -1640, rearTop: -1480, top: 34 }),
        mat: 'glass',
        mirror: true,
        offset: 4,
        nv: 4,
      },
      // the side blade and its intake
      {
        tag: 'side-blade',
        view: 'side',
        ...poly(
          [
            [-2150, 330],
            [-2070, 905],
            [-1720, 880],
            [-1660, 760],
          ],
          [
            [-2150, 330],
            [-2030, 185],
            [-1750, 185],
            [-1660, 760],
          ],
        ),
        mat: 'accent',
        mirror: true,
        offset: 4,
      },
      {
        tag: 'blade-intake',
        view: 'side',
        ...roundRect(-2060, -1820, 520, 820, 40),
        mat: 'grille',
        mirror: true,
        offset: 6,
      },
      {
        tag: 'headlight',
        view: 'front',
        ...poly(
          [
            [470, 612],
            [860, 692],
          ],
          [
            [470, 612],
            [700, 598],
            [860, 642],
          ],
        ),
        mat: 'lamp',
        mirror: true,
        offset: 5,
      },
      {
        tag: 'grille',
        view: 'front',
        ...poly(
          [
            [-340, 520],
            [-270, 588],
            [270, 588],
            [340, 520],
          ],
          [
            [-340, 520],
            [-240, 330],
            [240, 330],
            [340, 520],
          ],
        ),
        mat: 'grille',
        offset: 4,
      },
      {
        tag: 'intake-side',
        view: 'front',
        ...poly(
          [
            [420, 505],
            [850, 548],
          ],
          [
            [420, 505],
            [540, 280],
            [850, 300],
          ],
        ),
        mat: 'grille',
        mirror: true,
        offset: 3,
      },
      {
        tag: 'taillight',
        view: 'rear',
        ...poly(
          [
            [300, 1012],
            [880, 1002],
          ],
          [
            [300, 992],
            [880, 940],
          ],
        ),
        mat: 'lampRed',
        mirror: true,
        offset: 5,
      },
      {
        tag: 'rear-mesh',
        view: 'rear',
        ...roundRect(-720, 720, 470, 950, 40),
        mat: 'grille',
        offset: 3,
      },
      {
        tag: 'diffuser',
        view: 'rear',
        ...roundRect(-780, 780, 250, 450, 24),
        mat: 'black',
        offset: 4,
      },
    ];
  },
});

export default tune;
