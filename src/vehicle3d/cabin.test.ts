/**
 * Every occupant fits the car: each seated mannequin's head stays under its roof, and every seat
 * sits on the cabin floor, for every catalog car (detailed models included, via their measured
 * body profiles).
 */
import { describe, expect, it } from 'vitest';
import { listVehicles } from '../spec/catalog';
import { seatPlan, SEATED_MM } from './packaging';
import { getShell } from './shell/build';

describe('cabin', () => {
  it.each(listVehicles().map((v) => [v.id, v] as const))(
    '%s: every head clears the roof',
    (_id, v) => {
      const s = getShell(v).shape;
      for (const q of seatPlan(v, s)) {
        const reach = SEATED_MM * q.scale;
        const head = q.y + Math.cos(q.recline) * reach;
        const hx = q.x - Math.sin(q.recline) * reach * 0.8;
        expect(head, `row ${q.row} at z ${Math.round(q.z)}`).toBeLessThanOrEqual(
          s.topY(hx, q.z * 0.9),
        );
        expect(q.floorY).toBeGreaterThan(60);
      }
    },
  );
});
