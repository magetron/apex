import { Html } from '@react-three/drei';
import type { CSSProperties } from 'react';
import type { Vec3 } from '../spec/types';
import { SYSTEM_COLORS, type System } from './palette';

export interface PartLabelProps {
  position: Vec3;
  text: string;
  system?: System;
  active?: boolean;
}

/** Floating label with a leader line, anchored to a point in the part's frame. */
export function PartLabel({ position, text, system, active }: PartLabelProps) {
  const style = { '--sys': system ? SYSTEM_COLORS[system] : '#7fdbff' } as CSSProperties;
  return (
    <Html position={position} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`apx-label${active ? ' is-active' : ''}`} style={style}>
        <span className="apx-label__dot" />
        {text}
      </div>
    </Html>
  );
}
