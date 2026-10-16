import React from 'react';
import { env } from './fx';
import { serif } from './fonts';

// Safe area: >=150 px at the sides, >=250 px at the top and bottom.
export const SAFE = { x: 150, top: 260, bottom: 260 };

export const Caption: React.FC<{
  frame: number; from: number; to: number; text: string; top?: number; size?: number; style?: React.CSSProperties;
}> = ({ frame, from, to, text, top = SAFE.top, size = 88, style }) => {
  const o = env(frame, from, to, 24, 22);
  return (
    <div
      style={{
        position: 'absolute', left: SAFE.x, right: SAFE.x, top, textAlign: 'center',
        fontFamily: serif, fontStyle: 'italic', fontWeight: 500, fontSize: size, lineHeight: 1.18,
        color: '#fbe8c4', opacity: o, filter: `blur(${(1 - o) * 7}px)`,
        transform: `translateY(${(1 - o) * 16}px)`,
        textShadow: '0 0 28px rgba(255,190,100,0.45), 0 2px 10px rgba(0,0,0,0.6)',
        ...style,
      }}
    >
      {text}
    </div>
  );
};
