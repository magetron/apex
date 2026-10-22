/**
 * Vehicle-only cached materials (tyres, glass, lamps, trims) on top of the shared scene ones.
 * One instance per look, shared by every car, so switching cars never compiles new shaders.
 */
import {
  AdditiveBlending,
  Color,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NormalBlending,
  type Material,
} from 'three';
import { makeGhostMaterial } from '../scene/materials';
import { SYSTEM_COLORS, type System } from '../scene/palette';
import type { Theme } from '../scene/theme';
import type { DecalMat } from './shell/types';

const decal = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } as const;

const DECAL: Record<Exclude<DecalMat, 'accent' | 'paint'>, () => Material> = {
  glass: () =>
    new MeshPhysicalMaterial({
      color: '#05080c',
      metalness: 0,
      roughness: 0.16,
      clearcoat: 0.55,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.3,
      ...decal,
    }),
  lamp: () =>
    new MeshPhysicalMaterial({
      color: '#dfe6ec',
      metalness: 0.55,
      roughness: 0.12,
      clearcoat: 1,
      emissive: '#7e93a8',
      emissiveIntensity: 0.35,
      ...decal,
    }),
  lampRed: () =>
    new MeshPhysicalMaterial({
      color: '#a3101b',
      metalness: 0.1,
      roughness: 0.18,
      clearcoat: 1,
      emissive: '#6d0710',
      emissiveIntensity: 0.6,
      ...decal,
    }),
  lampAmber: () =>
    new MeshPhysicalMaterial({
      color: '#f0a020',
      roughness: 0.2,
      clearcoat: 1,
      emissive: '#7a4a00',
      emissiveIntensity: 0.4,
      ...decal,
    }),
  drl: () =>
    new MeshStandardMaterial({
      color: '#f4fbff',
      emissive: '#e8f6ff',
      emissiveIntensity: 1.1,
      ...decal,
    }),
  black: () =>
    new MeshPhysicalMaterial({
      color: '#0c0e11',
      metalness: 0.3,
      roughness: 0.28,
      clearcoat: 0.8,
      ...decal,
    }),
  grille: () =>
    new MeshStandardMaterial({ color: '#15181c', metalness: 0.2, roughness: 0.75, ...decal }),
  chrome: () =>
    new MeshStandardMaterial({ color: '#dfe3e8', metalness: 1, roughness: 0.14, ...decal }),
  fabric: () =>
    new MeshStandardMaterial({ color: '#1b1d21', metalness: 0, roughness: 0.95, ...decal }),
};

const cache = new Map<string, Material>();
const cached = <T extends Material>(key: string, make: () => T): T => {
  let m = cache.get(key);
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m as T;
};

export function decalMat(kind: DecalMat, accent: string, paint: string): Material {
  if (kind === 'accent')
    return cached(
      `accent:${accent}`,
      () =>
        new MeshPhysicalMaterial({
          color: accent,
          metalness: 0.4,
          roughness: 0.35,
          clearcoat: 0.6,
          ...decal,
        }),
    );
  if (kind === 'paint')
    return cached(
      `paintdecal:${paint}`,
      () =>
        new MeshPhysicalMaterial({
          color: paint,
          metalness: 0.35,
          roughness: 0.42,
          clearcoat: 0.6,
          ...decal,
        }),
    );
  return cached(`decal:${kind}`, DECAL[kind]);
}

export const tyreMat = () =>
  cached(
    'tyre',
    () => new MeshStandardMaterial({ color: '#17191c', metalness: 0, roughness: 0.92 }),
  );
export const rimMat = (dark = false) =>
  cached(
    `rim:${dark}`,
    () =>
      new MeshStandardMaterial({
        color: dark ? '#2b2f35' : '#c9ced4',
        metalness: 0.9,
        roughness: dark ? 0.35 : 0.22,
      }),
  );
export const discMat = () =>
  cached(
    'disc',
    () => new MeshStandardMaterial({ color: '#8a8f96', metalness: 0.95, roughness: 0.38 }),
  );
export const trimMat = () =>
  cached(
    'trim',
    () => new MeshStandardMaterial({ color: '#111317', metalness: 0.2, roughness: 0.55 }),
  );
export const chromeMat = () =>
  cached(
    'chrome',
    () => new MeshStandardMaterial({ color: '#dfe3e8', metalness: 1, roughness: 0.14 }),
  );

/** Driven wheels glow green at the internals level (the one colour legend). */
export const drivenMat = () =>
  cached('driven', () => {
    const c = new Color(SYSTEM_COLORS['wheel-driven']);
    return new MeshStandardMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: 0.45,
      roughness: 0.6,
    });
  });

/** Never drawn, still raycast: click envelopes around small or complex parts. */
export const hitMat = () => cached('hit', () => new MeshBasicMaterial({ visible: false }));

// ── theme-aware bits (re-tinted by useVehicleTheme) ──

const lineCol: Record<Theme, string> = { dark: '#a9c4e0', light: '#2a3d52' };
const ghostBody: Record<Theme, Color> = {
  dark: new Color(SYSTEM_COLORS.body),
  light: new Color(SYSTEM_COLORS.body).lerp(new Color('#1b2633'), 0.55),
};

/** The car's own x-ray shell (not the shared ghostMat: it fades as the body lifts off). */
export const bodyGhost = makeGhostMaterial(SYSTEM_COLORS.body, { opacity: 0.4, rim: 2.4 });
export const BODY_GHOST_OPACITY = 0.4;
export const bodyLines = new LineBasicMaterial({
  color: lineCol.dark,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
});

/** Overlay ink: lines/labels drawn on top of the scene. */
export const overlayLine = (system: System | 'ink', opacity = 0.9, onTop = true) =>
  cached(
    `ovl:${system}:${opacity}:${onTop}`,
    () =>
      new LineBasicMaterial({
        color: system === 'ink' ? lineCol[applied ?? 'dark'] : SYSTEM_COLORS[system],
        transparent: true,
        opacity,
        depthTest: !onTop,
        depthWrite: false,
      }),
  );
export const overlayFill = (color: string, opacity: number, onTop = false) =>
  cached(
    `fill:${color}:${opacity}:${onTop}`,
    () =>
      new MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        depthTest: !onTop,
      }),
  );

let applied: Theme | null = null;
export function applyVehicleTheme(theme: Theme) {
  if (applied === theme) return;
  applied = theme;
  bodyGhost.uniforms.uColor.value.copy(ghostBody[theme]);
  bodyLines.color.set(lineCol[theme]);
  bodyLines.opacity = theme === 'light' ? 0.4 : 0.32;
  for (const [k, m] of cache) {
    if (k.startsWith('ovl:ink') && m instanceof LineBasicMaterial) m.color.set(lineCol[theme]);
  }
  flowBlend.current = theme === 'light' ? NormalBlending : AdditiveBlending;
}

/** Blending for glow-like overlays (additive on dark ground, normal on light). */
export const flowBlend = {
  current: AdditiveBlending as typeof AdditiveBlending | typeof NormalBlending,
};
