/**
 * Closed-throttle drag at the driven wheels: engine braking for a combustion engine, lift-off
 * regen for an EV. One rule for every engine, from its displacement and redline.
 *
 * Combustion: the crank's motoring torque T = (FMEP + PMEP) × V / 2π, V the volume swept per
 * crank revolution (half a four-stroke's displacement; a rotary sweeps all of it per turn of its
 * eccentric shaft).
 *  - FMEP, friction: Heywood eq. 13.15 (Barnes-Moss, SI engines), 0.97 + 0.15·N + 0.05·N² bar with
 *    N in thousands of rpm, × the engine's fmepScale (params.ts FRICTION_MODERN: today's engines
 *    run lower friction than the 1980s ones it was fitted to; less again for a rotary).
 *  - PMEP, pumping against the closed throttle: PUMP_BAR.
 * The engine turns on the lift ratio (gearbox.ts liftRatio: LIFT_BAND of its redline) and the
 * driveline's losses add to its drag at the wheels: F = T·ratio / (r·η).
 *
 * EVs: a flat regen force (params.ts regenN). The model has no regen cut for wheel slip, which
 * real EVs have, so it stays a modest 0.12 g (0.15 g spins a Model 3 RWD on a lift).
 */
import { liftRatio } from './gearbox';
import { DRIVELINE_EFF, type CarParams, type DriveParams } from './params';

/** pumping loss against a closed throttle (bar): the middle of the usual 0.5–1 bar */
export const PUMP_BAR = 0.75;

/** The engine's friction mean effective pressure at `rpm` (bar). */
export function fmepBar(d: DriveParams, rpm: number): number {
  const k = rpm / 1000;
  return d.fmepScale * (0.97 + 0.15 * k + 0.05 * k * k);
}

/** The torque it takes to turn the engine with the throttle shut at `rpm` (N·m at the crank). */
export function motoringNm(d: DriveParams, rpm: number): number {
  return ((fmepBar(d, rpm) + PUMP_BAR) * 1e5 * d.sweptPerRev) / (2 * Math.PI);
}

/** Engine speed (rpm) at road speed v (m/s) on overall ratio `ratio`, never below idle. */
const rpmOn = (p: CarParams, v: number, ratio: number) =>
  Math.max(p.drive.idleRpm, ((Math.max(0, v) / p.wheelRadius) * ratio * 60) / (2 * Math.PI));

/** Engine speed (rpm) with the throttle closed at road speed v (m/s); 0 for an EV. */
export const liftRpm = (p: CarParams, v: number) =>
  p.drive.kind === 'ev' ? 0 : rpmOn(p, v, liftRatio(p, v));

/** Closed-throttle force at the driven wheels at speed v (N, positive), before car.ts fades it
 *  out at walking pace. */
export function engineBraking(p: CarParams, v: number): number {
  const d = p.drive;
  if (d.kind === 'ev') return d.regenN;
  const ratio = liftRatio(p, v);
  return (motoringNm(d, rpmOn(p, v, ratio)) * ratio) / (p.wheelRadius * DRIVELINE_EFF);
}
