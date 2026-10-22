import { describe, expect, it } from 'vitest';
import { BoxGeometry, PlaneGeometry } from 'three';
import { buildOutline, FEATURE, PLAIN, WINDOW } from './outlineBuild';

/** flat triangle positions of a geometry (non-indexed) */
const tris = (g: BoxGeometry | PlaneGeometry) =>
  new Float32Array(g.toNonIndexed().getAttribute('position').array);

const segments = (edges: Float32Array) => edges.length / 6;

describe('car outline geometry', () => {
  it('welds split vertices into one smooth shell', () => {
    // a box comes with 24 vertices (split per face); welded it has its 8 corners
    const pos = tris(new BoxGeometry(1, 1, 1));
    const b = buildOutline(pos, new Uint8Array(pos.length / 9).fill(FEATURE));
    expect(b.positions.length / 3).toBe(8);
    expect(b.index.length).toBe(36);
    // smooth normals point out of the corners
    for (let v = 0; v < 8; v++) {
      const n = [b.normals[v * 3], b.normals[v * 3 + 1], b.normals[v * 3 + 2]];
      const p = [b.positions[v * 3], b.positions[v * 3 + 1], b.positions[v * 3 + 2]];
      expect(n[0] * p[0] + n[1] * p[1] + n[2] * p[2]).toBeGreaterThan(0.8);
    }
  });

  it('draws the sharp creases, not the flat diagonals', () => {
    const pos = tris(new BoxGeometry(1, 1, 1));
    const b = buildOutline(pos, new Uint8Array(pos.length / 9).fill(FEATURE));
    expect(segments(b.edges)).toBe(12);
  });

  it('draws a window’s open edges, nothing for a wheel', () => {
    const quad = tris(new PlaneGeometry(1, 1));
    expect(segments(buildOutline(quad, new Uint8Array([FEATURE, FEATURE])).edges)).toBe(0);
    expect(segments(buildOutline(quad, new Uint8Array([WINDOW, WINDOW])).edges)).toBe(4);
    const box = tris(new BoxGeometry(1, 1, 1));
    expect(segments(buildOutline(box, new Uint8Array(box.length / 9).fill(PLAIN)).edges)).toBe(0);
  });
});
