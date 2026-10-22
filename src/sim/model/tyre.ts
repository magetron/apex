/**
 * "Pacejka-lite" tyre: a magic-formula lateral curve whose peak and cornering stiffness both
 * depend on load, plus a friction ellipse that trades side grip for drive/brake force.
 *
 * Load sensitivity is what makes weight distribution matter: doubling a tyre's load less than
 * doubles its grip, so the heavier axle (and the outside tyre in a corner) is the weaker one.
 */

/** Magic-formula shape: C sets the peak slip angle, E < 0 gives the post-peak drop to ~0.89. */
const C_SHAPE = 1.3;
const E_CURV = -0.5;
/** Friction falls ~12% per nominal load of extra load. */
const MU_LOAD_SENS = 0.12;
/** Cornering stiffness ≈ 24× the nominal load per radian at the nominal load. */
const STIFF_COEF = 30;
/** Above this share of the friction ellipse a driven/braked tyre is spinning or locking. */
const LONG_LIN = 0.9;
const LONG_MAX = 0.98;

export interface TyreOut {
  /** longitudinal force, tyre frame (N, + forward) */
  fx: number;
  /** lateral force, tyre frame (N, + left) */
  fy: number;
  /** grip available at this load, μ(Fz)·Fz (N): the friction circle's radius */
  cap: number;
}

/** Peak friction coefficient at load fz for a tyre with nominal load fz0. */
export function muAt(mu: number, fz: number, fz0: number): number {
  return mu * Math.max(0.6, 1 - MU_LOAD_SENS * (fz / fz0 - 1));
}

/** Cornering stiffness (N/rad), rising with load but saturating (sub-linear). */
export function corneringStiffness(fz: number, fz0: number): number {
  return STIFF_COEF * fz0 * Math.sin(2 * Math.atan(fz / (2 * fz0)));
}

/** Normalised magic-formula curve: 0 → 1 (peak) → ~0.89 sliding. */
function mf(x: number): number {
  return Math.sin(C_SHAPE * Math.atan(x - E_CURV * (x - Math.atan(x))));
}

/**
 * One tyre. `alpha` is the slip angle (rad, + when the contact patch slides to the left, so the
 * force pushes right), `fxDemand` what the drivetrain/brakes ask for. Writes into `out`;
 * allocation-free.
 */
export function tyreForce(
  fz: number,
  alpha: number,
  fxDemand: number,
  mu: number,
  fz0: number,
  out: TyreOut,
): TyreOut {
  if (fz <= 1) {
    out.fx = 0;
    out.fy = 0;
    out.cap = 0;
    return out;
  }
  const d = muAt(mu, fz, fz0) * fz;
  // friction ellipse: drive/brake force uses up grip; past ~90% the wheel spins or locks
  let ux = fxDemand / d;
  const ax = Math.abs(ux);
  if (ax > LONG_LIN) {
    const over = ax - LONG_LIN;
    ux =
      Math.sign(ux) *
      (LONG_LIN + (LONG_MAX - LONG_LIN) * (1 - Math.exp(-over / (LONG_MAX - LONG_LIN))));
  }
  const dy = d * Math.sqrt(1 - ux * ux);
  const c = corneringStiffness(fz, fz0);
  // keep the initial slope (c) while the peak shrinks to what the ellipse leaves
  const bStiff = c / (C_SHAPE * dy);
  out.fx = ux * d;
  out.fy = -dy * mf(bStiff * alpha);
  out.cap = d;
  return out;
}

/** Slip angle at which a tyre with these properties peaks (rad), for plots and tests. */
export function peakSlip(fz: number, fz0: number, mu: number): number {
  const d = muAt(mu, fz, fz0) * fz;
  const bStiff = corneringStiffness(fz, fz0) / (C_SHAPE * d);
  // solve C·atan(x − E(x − atan x)) = π/2 by bisection on x = B·α
  let lo = 0;
  let hi = 20;
  const target = Math.tan(Math.PI / (2 * C_SHAPE));
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (mid - E_CURV * (mid - Math.atan(mid)) < target) lo = mid;
    else hi = mid;
  }
  return lo / bStiff;
}
