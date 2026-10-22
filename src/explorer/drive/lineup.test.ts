import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../../sim/scenarios';
import { listVehicles } from '../../spec/catalog';
import { buildLineup } from './lineup';
import {
  autoFamilies,
  familyOf,
  lineupGhosts,
  resolveGhosts,
  standInFamilies,
  useDrive,
} from './state';

const all = listVehicles();
const car = all.find((v) => familyOf(v) === 'RR')!;
const mrs = all.filter((v) => familyOf(v) === 'MR');
const ff = all.find((v) => familyOf(v) === 'FF')!;

describe('the drive lineup', () => {
  it('without picks: the layout stand-ins, as before', () => {
    expect(lineupGhosts(car, null)).toEqual(resolveGhosts(car, null));
    expect(standInFamilies(car, null)).toEqual(autoFamilies(car));
  });

  it('picked cars run first and alone, unless stand-ins were asked for', () => {
    const picked = [mrs[0].id, ff.id];
    expect(lineupGhosts(car, null, picked).map((v) => v.id)).toEqual(picked);
    expect(standInFamilies(car, null, picked)).toEqual([]);
    const withFr = lineupGhosts(car, ['FR'], picked);
    expect(withFr.slice(0, 2).map((v) => v.id)).toEqual(picked);
    expect(familyOf(withFr[2])).toBe('FR');
    expect(standInFamilies(car, ['FR'], picked)).toEqual(['FR']);
  });

  it('never drops a picked car for a stand-in', () => {
    const picked = mrs.slice(0, 3).map((v) => v.id);
    const lineup = lineupGhosts(car, autoFamilies(car), picked);
    expect(lineup.length).toBeLessThanOrEqual(5);
    expect(lineup.slice(0, 3).map((v) => v.id)).toEqual(picked);
  });

  it('two cars of one layout wear different colours', () => {
    const s = { scenario: 'power-exit' as const, ghosts: null, compare: 'layouts' as const };
    const kmh = SCENARIOS['power-exit'].speed.def;
    const lineup = buildLineup(car, s, kmh, [mrs[0].id, mrs[1].id]);
    expect(lineup.map((e) => e.info.slot ?? null)).toEqual([null, 0, 1]);
  });

  it('picking a car in drive keeps the stand-ins that were on the road', () => {
    useDrive.setState({ ghosts: null });
    useDrive.getState().keepStandIns(car);
    expect(useDrive.getState().ghosts).toEqual(autoFamilies(car));
    useDrive.getState().toggleGhost(car, 'FF', [mrs[0].id]);
    expect(useDrive.getState().ghosts).not.toContain('FF');
    useDrive.setState({ ghosts: null });
  });
});
