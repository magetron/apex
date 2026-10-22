/**
 * Shared, cached materials. Reuse these instead of creating materials per mesh — hundreds of
 * engine parts must not mean hundreds of shader programs.
 */
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NormalBlending,
  ShaderMaterial,
} from 'three';
import { SYSTEM_COLORS, type System } from './palette';
import type { Theme } from './theme';

export type Finish = 'metal' | 'satin' | 'rubber' | 'paint';

const FINISH: Record<Finish, { metalness: number; roughness: number }> = {
  metal: { metalness: 0.85, roughness: 0.32 },
  satin: { metalness: 0.4, roughness: 0.55 },
  rubber: { metalness: 0.0, roughness: 0.9 },
  paint: { metalness: 0.5, roughness: 0.3 },
};

const solidCache = new Map<string, MeshStandardMaterial>();

/** Solid component material in the system colour. */
export function sysMat(system: System, finish: Finish = 'satin'): MeshStandardMaterial {
  const key = `${system}:${finish}`;
  let m = solidCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color: SYSTEM_COLORS[system], ...FINISH[finish] });
    solidCache.set(key, m);
  }
  return m;
}

const paintCache = new Map<string, MeshPhysicalMaterial>();

/** Clear-coated car paint for the exterior view. */
export function paintMat(color: string): MeshPhysicalMaterial {
  let m = paintCache.get(color);
  if (!m) {
    m = new MeshPhysicalMaterial({
      color,
      metalness: 0.35,
      roughness: 0.42,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
    });
    paintCache.set(color, m);
  }
  return m;
}

const ghostVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const ghostFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uRim;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uRim);
    gl_FragColor = vec4(uColor, uOpacity * (0.12 + 0.88 * f));
    #include <colorspace_fragment>
  }
`;

export interface GhostOptions {
  opacity?: number;
  /** fresnel exponent: higher = thinner glowing rim */
  rim?: number;
  additive?: boolean;
}

/** X-ray "glass" material: transparent face-on, glowing at grazing angles. */
export function makeGhostMaterial(color: string, o: GhostOptions = {}): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: o.opacity ?? 0.55 },
      uRim: { value: o.rim ?? 2.2 },
    },
    vertexShader: ghostVert,
    fragmentShader: ghostFrag,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: o.additive ? AdditiveBlending : NormalBlending,
  });
}

const ghostCache = new Map<string, { m: ShaderMaterial; system: System }>();
let ghostTheme: Theme = 'dark';

/** On a light background a pale glass tint vanishes, so ghosts darken toward slate. */
const ghostColor = (system: System, theme: Theme) =>
  theme === 'light'
    ? new Color(SYSTEM_COLORS[system]).lerp(new Color('#1b2633'), 0.55)
    : new Color(SYSTEM_COLORS[system]);

/** Cached ghost material in a system colour (body shells, engine blocks in cutaway). */
export function ghostMat(system: System, opacity = 0.55): ShaderMaterial {
  const key = `${system}:${opacity}`;
  let entry = ghostCache.get(key);
  if (!entry) {
    const m = makeGhostMaterial(SYSTEM_COLORS[system], { opacity });
    m.uniforms.uColor.value = ghostColor(system, ghostTheme);
    entry = { m, system };
    ghostCache.set(key, entry);
  }
  return entry.m;
}

/** Re-tint every cached ghost material for a theme (called by the Stage on theme change). */
export function retintGhosts(theme: Theme) {
  ghostTheme = theme;
  for (const { m, system } of ghostCache.values())
    m.uniforms.uColor.value = ghostColor(system, theme);
}
