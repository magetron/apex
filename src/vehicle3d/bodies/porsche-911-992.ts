/**
 * Porsche 911 (992). Side profile traced in #/dev/likeness from a side-on photo of a 991 Turbo S
 * (same roof, glass and wings as the 992 Carrera), with perspective corrected so the traced
 * nose-to-tail length is the real 4519 mm: one arc from the screen header down to the ducktail,
 * the bonnet sunk between raised front wings carrying upright oval headlights, a narrow cabin
 * over wide rear haunches, a full-width light bar and the louvred engine lid.
 */
import { ellipse, pillar, poly, roundRect } from '../shell/decals';
import type { BodyTuning, Decal } from '../shell/types';

const tune: BodyTuning = () => ({
  // centre line; over the front this is the bonnet, ~40 mm below the wing crests (see wing)
  top: [
    [940, 380],
    [925, 435],
    [888, 492],
    [820, 560],
    [760, 600],
    [610, 672],
    [369, 736],
    [7, 768],
    [-356, 800],
    [-614, 860],
    [-838, 1000],
    [-1016, 1101],
    [-1203, 1173],
    [-1445, 1212],
    [-1783, 1208],
    [-2091, 1193],
    [-2336, 1148],
    [-2523, 1078],
    [-2709, 1007],
    [-2954, 945],
    [-3199, 921],
    [-3414, 900],
    [-3491, 813],
    [-3551, 674],
    [-3575, 522],
    [-3579, 420],
  ],
  // side top edge: front-wing crest, window sill, rear-haunch crest
  belt: [
    [940, 370],
    [900, 470],
    [800, 580],
    [600, 668],
    [300, 728],
    [0, 765],
    [-400, 806],
    [-834, 848],
    [-1355, 846],
    [-1849, 858],
    [-2177, 892],
    [-2562, 922],
    [-2890, 926],
    [-3150, 905],
    [-3350, 850],
    [-3480, 750],
    [-3550, 610],
    [-3579, 420],
  ],
  bottom: [
    [940, 260],
    [900, 165],
    [752, 112],
    [507, 106],
    [-350, 115],
    [-1364, 116],
    [-2161, 120],
    [-3082, 142],
    [-3356, 178],
    [-3495, 222],
    [-3579, 300],
  ],
  // plan view: narrow nose between the front wings, waisted at the doors, widest over the rear
  // haunches (the 911's "hips")
  plan: [
    [940, 0.72],
    [820, 0.85],
    [500, 0.94],
    [0, 0.95],
    [-1100, 0.925],
    [-1900, 0.96],
    [-2450, 1],
    [-3200, 0.985],
    [-3579, 0.9],
  ],
  nose: { len: 380, p: 2.4 },
  tail: { len: 320, p: 2.6 },
  cabin: [-2700, -600],
  // narrow greenhouse over the wide body
  roofHalf: 0.57,
  crown: 55,
  topExp: 2.7,
  tuck: 70,
  tuckUnder: 60,
  shoulder: 0.5,
  cornerR: 140,
  beltCrease: false,
  // front wings stand ~40 mm proud of the bonnet; the rear haunches only a little over the lid
  wing: [
    [930, 0],
    [860, 36],
    [300, 40],
    [-250, 22],
    [-600, 0],
    [-2000, 0],
    [-2500, 14],
    [-3000, 10],
    [-3380, 0],
  ],
  wingAt: 0.82,
  flare: [22, 46],
  flareTop: 0.55,
  archGap: 32,
  lip: 6,
  mirrors: { x: -760, dy: 78, mat: 'paint' },
  exhaust: [
    { z: -330, y: 300, r: 44, w: 1.5 },
    { z: 330, y: 300, r: 44, w: 1.5 },
  ],
  decals: (s, d) => {
    const keep = d.filter((x) => x.tag === 'windscreen' || x.tag === 'rear-window');
    // side glass traced from the photo (heights lifted with the roof to the spec height)
    const side = poly(
      [
        [-2431, 1050],
        [-2255, 1180],
        [-2051, 1238],
        [-1759, 1250],
        [-1415, 1233],
        [-1267, 1207],
        [-1124, 1108],
        [-996, 988],
        [-889, 846],
      ],
      [
        [-2431, 1050],
        [-2316, 975],
        [-1937, 870],
        [-1473, 852],
        [-889, 846],
      ],
    );
    const louvres: Decal[] = [];
    for (let k = -4; k <= 4; k++) {
      louvres.push({
        view: 'top',
        ...roundRect(-3100, -2790, k * 72 - 18, k * 72 + 18, 10),
        mat: 'black',
        offset: 3,
        nv: 2,
        outline: false,
      });
    }
    return [
      ...keep,
      { tag: 'dlo', view: 'side', ...side, mat: 'glass', mirror: true, offset: 4, nv: 4 },
      {
        tag: 'quarter-divider',
        view: 'side',
        ...pillar(s, -1800, 34),
        mat: 'black',
        mirror: true,
        offset: 7,
        nv: 2,
      },
      // headlights: upright ovals on the wing fronts, in a dark bezel
      {
        tag: 'headlight-bezel',
        view: 'front',
        ...ellipse(612, 628, 116, 124),
        mat: 'black',
        mirror: true,
        offset: 3,
      },
      {
        tag: 'headlight',
        view: 'front',
        ...ellipse(612, 628, 100, 108),
        mat: 'lamp',
        mirror: true,
        offset: 6,
        nu: 12,
        nv: 10,
      },
      // three bumper intakes with DRL slats
      {
        tag: 'intake',
        view: 'front',
        ...roundRect(-300, 300, 320, 432, 40),
        mat: 'grille',
        offset: 3,
      },
      {
        tag: 'intake-side',
        view: 'front',
        ...roundRect(470, 770, 290, 470, 50),
        mat: 'grille',
        mirror: true,
        offset: 3,
      },
      {
        tag: 'drl',
        view: 'front',
        ...roundRect(500, 740, 452, 464, 5),
        mat: 'drl',
        mirror: true,
        offset: 5,
        nv: 2,
      },
      // full-width light bar under the ducktail + corner clusters
      {
        tag: 'light-bar',
        view: 'rear',
        ...roundRect(-760, 760, 872, 900, 12),
        mat: 'lampRed',
        offset: 4,
        nv: 2,
      },
      {
        tag: 'taillight',
        view: 'rear',
        ...roundRect(560, 860, 842, 916, 26),
        mat: 'lampRed',
        mirror: true,
        offset: 5,
      },
      ...louvres,
      {
        tag: 'brake-light',
        view: 'top',
        ...roundRect(-3150, -3120, -120, 120, 8),
        mat: 'lampRed',
        offset: 4,
        nv: 2,
      },
      {
        tag: 'diffuser',
        view: 'rear',
        ...roundRect(-640, 640, 300, 430, 30),
        mat: 'black',
        offset: 3,
      },
    ];
  },
});

export default tune;
