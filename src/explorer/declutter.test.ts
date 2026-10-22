import { describe, expect, it } from 'vitest';
import { declutter } from './declutter';

type Rect = { x0: number; x1: number; y0: number; y1: number };

const box = (text: string, x0: number, y0: number, w = 100, h = 20) => ({
  text,
  x0,
  x1: x0 + w,
  y0,
  y1: y0 + h,
});

const placed = (o: { box: Rect; dx: number; dy: number }) => ({
  x0: o.box.x0 + o.dx,
  x1: o.box.x1 + o.dx,
  y0: o.box.y0 + o.dy,
  y1: o.box.y1 + o.dy,
});

describe('label declutter', () => {
  it('spreads labels on one spot so none overlap, and hides repeats', () => {
    // an engine's parts on one axis: every label anchored at the same point
    const names = ['Crankshaft', 'Flywheel', 'Intake', 'Pistons', 'Turbos', 'Camshafts'];
    const out = declutter([...names.map((n) => box(n, 500, 300)), box('Intake', 500, 300)]);
    const shown = out.filter((o) => !o.hidden).map(placed);
    expect(shown).toHaveLength(names.length);
    for (let i = 0; i < shown.length; i++)
      for (let j = i + 1; j < shown.length; j++) {
        const [a, b] = [shown[i], shown[j]];
        expect(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0).toBe(false);
      }
    // a fan, not one tall column
    expect(new Set(shown.map((r) => r.x0)).size).toBeGreaterThan(1);
    expect(out.filter((o) => o.hidden)).toHaveLength(1);
  });

  it('keeps a data tag where it is measured: a part label steps aside, and repeats still show', () => {
    const cg = { ...box('CG 461 mm', 500, 300), tag: true };
    // the engine's name, hovered, lower down and right over the CG
    const engine = box('Flat-6 3.0 twin-turbo', 480, 305);
    // side by side, both cars' torque tags read the same
    const rear = [
      { ...box('100% rear', 100, 100), tag: true },
      { ...box('100% rear', 100, 400), tag: true },
    ];
    const out = declutter([engine, cg, ...rear]);
    const at = (b: object) => out.find((o) => o.box === b)!;
    expect(at(cg).dx === 0 && at(cg).dy === 0 && !at(cg).hidden).toBe(true);
    expect(at(engine).dx !== 0 || at(engine).dy !== 0).toBe(true);
    const [a, b] = [placed(at(cg)), placed(at(engine))];
    expect(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0).toBe(false);
    expect(rear.every((r) => !at(r).hidden)).toBe(true);
  });

  it("never moves a compared car's name tag: a data tag under it steps aside", () => {
    const names = { ...box('911 · Golf GTI', 600, 170, 200, 45), pin: true };
    const rear = { ...box('100% rear', 612, 199, 65, 19), tag: true };
    const out = declutter([rear, names]);
    const at = (b: object) => out.find((o) => o.box === b)!;
    expect(at(names).dx === 0 && at(names).dy === 0).toBe(true);
    const [a, b] = [placed(at(names)), placed(at(rear))];
    expect(a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0).toBe(false);
  });

  it('leaves labels that do not touch alone', () => {
    const out = declutter([box('A', 0, 0), box('B', 200, 0), box('C', 0, 100)]);
    expect(out.every((o) => o.dx === 0 && o.dy === 0 && !o.hidden)).toBe(true);
  });
});
