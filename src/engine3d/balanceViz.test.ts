import { describe, expect, it } from 'vitest';
import { getEngine } from '../spec/catalog';
import { stillPlaces } from './BalanceViz';
import { balanceTable } from './motion';

const still = (id: string) => stillPlaces(balanceTable(getEngine(id)));

describe('the balance view marks where nothing is free', () => {
  it('a flat-6 and an I6: still at the centre and at both ends', () => {
    expect(still('flat6')).toEqual({ centre: true, ends: true });
    expect(still('i6-m30')).toEqual({ centre: true, ends: true });
  });

  it('an I4 shakes at the centre (2nd order) but does not rock: still only at its ends', () => {
    expect(still('i4')).toEqual({ centre: false, ends: true });
  });

  it('an I3 rocks end to end but does not shake: still only at the centre', () => {
    expect(still('i3')).toEqual({ centre: true, ends: false });
  });
});
