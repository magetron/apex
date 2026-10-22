/** A full-scene cover driven by driveTelemetry.fade, hiding the cut when a scenario loops. */
import { useEffect, useRef } from 'react';
import { driveTelemetry } from './state';

export function LoopFade() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const f = Math.round(driveTelemetry.fade * 100) / 100;
      if (f !== last && ref.current) {
        ref.current.style.opacity = String(f);
        last = f;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      driveTelemetry.fade = 0;
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      // first in the HUD and z-index auto: above the canvas, below every HUD panel
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
