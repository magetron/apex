/** VW Golf R (Mk8), same shell as the GTI (without the GTI's red pinstripe). */
import type { BodyTuning } from '../shell/types';
import gti from './vw-golf-gti-mk8';

const tune: BodyTuning = (c, base) => {
  const t = gti(c, base);
  const decals = t.decals;
  return {
    ...t,
    decals: (s, d) => (decals ? decals(s, d) : d).filter((x) => x.tag !== 'gti-stripe'),
  };
};

export default tune;
