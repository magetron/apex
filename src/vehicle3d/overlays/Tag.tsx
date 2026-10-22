import { Html } from '@react-three/drei';
import type { ReactNode } from 'react';
import type { Vec3 } from '../../spec/types';
import './overlays.css';

export type TagTone = 'plain' | 'ok' | 'warn' | 'bad' | 'flow';

/** A small data label pinned to a point in the car's frame (metres). */
export function Tag({
  at,
  tone = 'plain',
  children,
}: {
  at: Vec3;
  tone?: TagTone;
  children: ReactNode;
}) {
  return (
    <Html position={at} center zIndexRange={[15, 0]} style={{ pointerEvents: 'none' }}>
      <span className={`wp3-tag${tone === 'plain' ? '' : ` wp3-tag--${tone}`}`}>{children}</span>
    </Html>
  );
}
