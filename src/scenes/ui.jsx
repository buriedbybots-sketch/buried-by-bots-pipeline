// Shared layout primitives for every scene. Nothing here knows about content.
import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C} from '../theme.js';

export const ease = (frame, fps, delay = 0, damping = 200) =>
  spring({frame: frame - delay, fps, config: {damping, mass: 0.6, stiffness: 120}});

export const center = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
};

export const kicker = {
  fontSize: 40,
  fontWeight: 600,
  letterSpacing: '4px',
  textTransform: 'uppercase',
  color: C.steel,
};

export const chip = {
  fontFamily: 'var(--mono)',
  fontSize: 30,
  letterSpacing: '2px',
  color: C.steel,
  border: `2px solid ${C.line}`,
  borderRadius: 999,
  padding: '12px 26px',
};

export const mono = {fontFamily: 'var(--mono)', fontWeight: 400};

// The "someone else's software" frame: a job req, a mail client, a comp table.
// One card for all of them so the set reads as one channel, not four.
//
// After it lands, the card keeps drifting very slowly toward the viewer. A
// card that holds for eight seconds with nothing moving reads as a frozen
// video, and a frozen video gets swiped.
export const Card = ({children, style, s = 1}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const drift = 1 + (0.035 * Math.min(frame, durationInFrames)) / Math.max(1, durationInFrames);
  return (
    <div
      style={{
        width: '100%',
        background: C.panel,
        border: `2px solid ${C.line}`,
        borderRadius: 22,
        overflow: 'hidden',
        textAlign: 'left',
        opacity: s,
        transform: `translateY(${(1 - s) * 40}px) scale(${drift})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Mac-style title bar. Three dots and a mono label is all the eye needs to
// read "this is a screenshot of a real app".
export const TitleBar = ({label}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '22px 30px',
      borderBottom: `2px solid ${C.line}`,
      background: '#1A1E26',
    }}
  >
    {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
      <span key={c} style={{width: 18, height: 18, borderRadius: 9, background: c, opacity: 0.85}} />
    ))}
    <span style={{...mono, fontSize: 26, color: C.steel, marginLeft: 18, letterSpacing: '1px'}}>{label}</span>
  </div>
);

// The source chip. Not decoration: the channel rule is no number on screen
// without one, and sheet.mjs refuses rows that try.
export const Source = ({source, frame, at = 22, style}) => {
  if (!source) return null;
  const o = Math.min(1, Math.max(0, (frame - at) / 14));
  return <div style={{...chip, fontSize: 26, whiteSpace: 'nowrap', opacity: o, ...style}}>SOURCE: {source}</div>;
};
