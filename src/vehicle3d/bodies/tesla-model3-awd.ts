/**
 * Tesla Model 3: smooth, grille-less nose that drops steeply from a very short bonnet, one dark
 * glass canopy from the windscreen over the roof into the rear window, a short boot with a lip,
 * swept headlamps and wrap-around tail lamps. No exhaust.
 */
import { dlo, poly, roofPatch, roundRect } from '../shell/decals';
import type { BodyTuning } from '../shell/types';

const tune: BodyTuning = () => ({
  top: [
    [840, 470],
    [830, 560],
    [792, 640],
    [600, 712],
    [200, 800],
    [-200, 875],
    [-500, 1040],
    [-900, 1270],
    [-1250, 1420],
    [-1650, 1441],
    [-2200, 1425],
    [-2700, 1370],
    [-3050, 1232],
    [-3380, 1092],
    [-3700, 1072],
    [-3820, 1064],
    [-3870, 1012],
    [-3880, 780],
  ],
  belt: [
    [840, 460],
    [800, 620],
    [600, 712],
    [200, 800],
    [-200, 880],
    [-1250, 955],
    [-2700, 1020],
    [-3380, 1062],
    [-3800, 1052],
    [-3880, 770],
  ],
  bottom: [
    [840, 300],
    [700, 190],
    [400, 140],
    [-3300, 145],
    [-3600, 240],
    [-3880, 400],
  ],
  plan: [
    [840, 0.93],
    [300, 0.975],
    [0, 0.985],
    [-1400, 0.99],
    [-2875, 1],
    [-3880, 0.95],
  ],
  nose: { len: 440, p: 2.1 },
  tail: { len: 330, p: 2.3 },
  cabin: [-3380, -180],
  roofHalf: 0.77,
  crown: 50,
  topExp: 2.3,
  tuck: 55,
  tuckUnder: 35,
  shoulder: 0.62,
  beltCrease: false,
  flare: [12, 18],
  flareTop: 0.25,
  archGap: 38,
  lip: 5,
  mirrors: { x: -380, dy: 72, mat: 'paint' },
  exhaust: [],
  decals: (s, d) => {
    const keep = d.filter((x) => x.tag === 'b-pillar');
    return [
      ...keep,
      {
        tag: 'canopy',
        view: 'top',
        ...roofPatch(s, -3355, -215, 52),
        mat: 'glass',
        offset: 4,
        nu: 40,
        nv: 12,
      },
      {
        tag: 'roof-bar',
        view: 'top',
        ...roofPatch(s, -1720, -1660, 40),
        mat: 'black',
        offset: 7,
        nv: 6,
        outline: false,
      },
      {
        tag: 'dlo-trim',
        view: 'side',
        ...dlo(s, { rear: -3030, rearTop: -2690, top: 14, bottom: 10 }),
        mat: 'black',
        mirror: true,
        offset: 3,
        nv: 4,
        outline: false,
      },
      {
        tag: 'dlo',
        view: 'side',
        ...dlo(s, { rear: -3000, rearTop: -2700, top: 30 }),
        mat: 'glass',
        mirror: true,
        offset: 5,
        nv: 4,
      },
      {
        tag: 'headlight',
        view: 'front',
        ...poly(
          [
            [520, 702],
            [855, 730],
          ],
          [
            [520, 702],
            [700, 656],
            [855, 668],
          ],
        ),
        mat: 'lamp',
        mirror: true,
        offset: 5,
      },
      {
        tag: 'intake',
        view: 'front',
        ...roundRect(-420, 420, 300, 362, 26),
        mat: 'grille',
        offset: 3,
      },
      {
        tag: 'taillight',
        view: 'rear',
        ...poly(
          [
            [330, 1048],
            [880, 1030],
          ],
          [
            [330, 1000],
            [880, 958],
          ],
        ),
        mat: 'lampRed',
        mirror: true,
        offset: 5,
      },
      {
        tag: 'diffuser',
        view: 'rear',
        ...roundRect(-660, 660, 300, 400, 22),
        mat: 'black',
        offset: 3,
      },
    ];
  },
});

export default tune;
