/**
 * A held note is noise, not information: once the revs and throttle have stayed put for a moment
 * (a paused run, a steady corner, an idle left running) the voice fades out, and it comes straight
 * back when either moves. So the sound marks what changes: a lift, a stab of throttle, a shift.
 */

/** how long a steady note may sound before it fades (s) */
export const HOLD_S = 1.2;

export class SteadyGate {
  private rpm = NaN;
  private throttle = NaN;
  private still = 0;

  /** Feed one frame; returns whether the voice should sound. */
  step(dt: number, rpm: number, throttle: number): boolean {
    const moved =
      !(Math.abs(rpm - this.rpm) <= Math.max(60, 0.02 * this.rpm)) ||
      !(Math.abs(throttle - this.throttle) <= 0.08);
    if (moved) {
      // measure the next change from here, so a slow creep still counts once it adds up
      this.rpm = rpm;
      this.throttle = throttle;
      this.still = 0;
    } else this.still += dt;
    return this.still < HOLD_S;
  }

  /** Something the visitor did (a blip, the pedal): sound now. */
  wake() {
    this.still = 0;
  }
}
