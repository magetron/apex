/**
 * The few materials engine3d needs beyond the shared sysMat/ghostMat: additive combustion
 * glow and always-on-top balance arrows. Module-level singletons, never per mesh.
 */
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  LineBasicMaterial,
  MeshBasicMaterial,
  MultiplyBlending,
} from 'three';
import { SYSTEM_COLORS } from '../scene/palette';
import type { Theme } from '../scene/theme';
import type { StrokeName } from '../spec/derive/kinematics';

/** First- vs second-order colours, shared by the 3D arrows and the panel bars. */
export const ORDER_COLORS = {
  primary: SYSTEM_COLORS.brake,
  secondary: SYSTEM_COLORS.cooling,
} as const;

/** The balance view's still marker (nothing free there): the fit check's "ok" green. */
export const STILL_COLOR = '#06d6a0';

export const COMBUSTION = new Color(SYSTEM_COLORS.combustion);

/**
 * What the gas in a cylinder or chamber is doing: fresh charge in the intake colour, warming
 * to yellow as it is squeezed, the combustion orange, then spent gas in the exhaust colour.
 * The firing timelines draw the power stroke in the same combustion colour.
 */
export const STROKE_COLORS: Record<StrokeName, string> = {
  intake: SYSTEM_COLORS.intake,
  compression: SYSTEM_COLORS.shaft,
  power: SYSTEM_COLORS.combustion,
  exhaust: SYSTEM_COLORS.exhaust,
};

export const STROKE_LABELS: Record<StrokeName, string> = {
  intake: 'Intake',
  compression: 'Compression',
  power: 'Combustion',
  exhaust: 'Exhaust',
};

const chambers = new Map<Theme, MeshBasicMaterial>();
/** Gas in the rotary's chambers: per-vertex phase colour, see-through, drawn after the castings. */
export function chamberMat(theme: Theme): MeshBasicMaterial {
  let m = chambers.get(theme);
  if (!m) {
    m = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: theme === 'dark' ? 0.62 : 0.78,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    chambers.set(theme, m);
  }
  return m;
}

const glows = new Map<Theme, MeshBasicMaterial>();
/**
 * Combustion light, white × per-instance colour. Dark theme: added on top (black = off).
 * Light theme: additive light vanishes on a pale ground, so it multiplies instead (white = off).
 */
export function glowMat(theme: Theme): MeshBasicMaterial {
  let m = glows.get(theme);
  if (!m) {
    m = new MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      blending: theme === 'dark' ? AdditiveBlending : MultiplyBlending,
      premultipliedAlpha: theme === 'light',
      depthWrite: false,
      toneMapped: false,
    });
    glows.set(theme, m);
  }
  return m;
}

const WHITE = new Color('#ffffff');
/** Per-instance glow colour for an intensity 0..1 (into out). */
export function glowColor(theme: Theme, k: number, out: Color): Color {
  return theme === 'dark'
    ? out.copy(COMBUSTION).multiplyScalar(1.5 * k)
    : out.copy(WHITE).lerp(COMBUSTION, Math.min(1, 1.2 * k));
}

const arrows = new Map<string, MeshBasicMaterial>();
export function arrowMat(color: string): MeshBasicMaterial {
  let m = arrows.get(color);
  if (!m) {
    m = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    arrows.set(color, m);
  }
  return m;
}

const lines = new Map<string, LineBasicMaterial>();
export function traceMat(color: string): LineBasicMaterial {
  let m = lines.get(color);
  if (!m) {
    m = new LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
      depthWrite: false,
    });
    lines.set(color, m);
  }
  return m;
}
