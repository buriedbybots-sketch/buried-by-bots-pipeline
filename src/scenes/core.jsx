// The original six: the brand's own visual language.
import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {C} from '../theme.js';
import {ease, center, kicker, chip, Source} from './ui.jsx';

// ---------------------------------------------------------------- hook
// Words spring in on a stagger; the accent word gets the one orange and an
// underline swipe. This is the first 2 seconds, so it has to move immediately.
export const Hook = ({text, accent, head}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = text.split(' ');

  return (
    <div style={{...center, padding: '0 90px'}}>
      {head ? <div style={{...kicker, marginBottom: 44}}>{head}</div> : null}
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 26px'}}>
        {words.map((w, i) => {
          const s = ease(frame, fps, i * 3);
          const hit = accent && w.replace(/[^A-Za-z']/g, '').toUpperCase() === accent.toUpperCase();
          return (
            <span
              key={i}
              style={{
                fontSize: 132,
                fontWeight: 800,
                lineHeight: 1.02,
                letterSpacing: '-0.5px',
                color: hit ? C.orange : C.paper,
                opacity: s,
                transform: `translateY(${(1 - s) * 44}px)`,
                position: 'relative',
              }}
            >
              {w}
              {hit ? (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: -14,
                    height: 10,
                    background: C.orange,
                    width: `${interpolate(frame - i * 3 - 8, [0, 12], [0, 100], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    })}%`,
                  }}
                />
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- rank
// The signature shot: the stack scrolls past you and stops on the buried
// orange sheet. Same visual language as the profile mark and the banner.
export const Rank = ({to = 340, total = 400, caption = 'applicants'}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const ROW = 108;
  const settle = Math.min(durationInFrames * 0.62, 62);
  const pos = interpolate(frame, [0, settle], [0, to], {
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 4),
  });
  const landed = frame > settle;
  const glow = landed ? interpolate(frame - settle, [0, 10], [0, 1], {extrapolateRight: 'clamp'}) : 0;

  const first = Math.max(1, Math.floor(pos) - 6);
  const rows = Array.from({length: 16}, (_, i) => first + i);

  return (
    <div style={{...center, justifyContent: 'flex-start', paddingTop: 460}}>
      <div style={{position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center'}}>
        <div style={{fontSize: 170, fontWeight: 800, color: landed ? C.orange : C.paper, lineHeight: 1}}>
          #{Math.round(pos)}
        </div>
        <div style={{...kicker, marginTop: 10}}>
          of {total} {caption}
        </div>
      </div>

      <div style={{position: 'relative', width: 700, height: 900, overflow: 'hidden'}}>
        {rows.map((n) => {
          const y = (n - pos) * ROW + 420;
          const isTarget = n === to;
          const dim = Math.max(0.18, 1 - Math.abs(n - pos) / 11);
          return (
            <div
              key={n}
              style={{
                position: 'absolute',
                top: y,
                left: 0,
                width: '100%',
                height: 76,
                borderRadius: 10,
                background: isTarget ? C.orange : C.paper,
                opacity: isTarget ? 1 : dim,
                boxShadow: isTarget ? `0 0 ${60 * glow}px ${24 * glow}px rgba(255,77,46,0.55)` : 'none',
              }}
            />
          );
        })}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(${C.void} 0%, transparent 22%, transparent 78%, ${C.void} 100%)`,
          }}
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- stat
export const Stat = ({value, suffix = '%', label, source}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = ease(frame, fps, 0, 26);
  const shown = Math.round(value * s);

  return (
    <div style={{...center, padding: '0 100px'}}>
      <div
        style={{
          fontSize: 300,
          fontWeight: 800,
          color: C.paper,
          lineHeight: 0.9,
          transform: `scale(${interpolate(s, [0, 1], [0.86, 1])})`,
        }}
      >
        {shown}
        <span style={{color: C.orange}}>{suffix}</span>
      </div>
      <div
        style={{
          marginTop: 46,
          fontSize: 60,
          fontWeight: 600,
          color: C.paper,
          textAlign: 'center',
          lineHeight: 1.22,
          opacity: interpolate(frame, [10, 24], [0, 1], {extrapolateRight: 'clamp'}),
        }}
      >
        {label}
      </div>
      <Source source={source} frame={frame} style={{marginTop: 54}} />
    </div>
  );
};

// ---------------------------------------------------------------- prompt
// A terminal card that types itself. The product is prompts, so showing one
// running is the sample, not a teaser. Never carries Vault 1/2/3/26 — the
// linter refuses those; use `terminal` to demo their output instead.
export const Prompt = ({title, lines = []}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const body = lines.join('\n');
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
  const size = Math.max(20, Math.min(38, Math.floor(816 / (longest * 0.6))));
  const chars = Math.floor(
    interpolate(frame, [8, durationInFrames * 0.68], [0, body.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  return (
    <div style={{...center, padding: '0 70px'}}>
      <div style={{...chip, alignSelf: 'flex-start', marginBottom: 26}}>{title}</div>
      <div
        style={{
          width: '100%',
          background: C.panel,
          border: `2px solid ${C.line}`,
          borderRadius: 18,
          padding: '40px 36px',
          textAlign: 'left',
        }}
      >
        <pre
          style={{
            margin: 0,
            fontFamily: 'var(--mono)',
            fontSize: size,
            lineHeight: 1.45,
            color: C.paper,
            whiteSpace: 'pre',
          }}
        >
          {body.slice(0, chars)}
          <span style={{color: C.orange, opacity: Math.floor(frame / 8) % 2 ? 0.2 : 1}}>▌</span>
        </pre>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- test
// The diagnostic scene: a 60-second thing the viewer can do right now that
// returns a bad result about their own resume.
export const Test = ({step, result, kicker: label = 'TRY THIS NOW'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = ease(frame, fps, 4);
  const verdict = ease(frame, fps, 34, 18);

  return (
    <div style={{...center, padding: '0 90px'}}>
      <div style={{...kicker, color: C.orange, marginBottom: 40, opacity: s}}>{label}</div>
      <div
        style={{
          fontSize: 76,
          fontWeight: 700,
          color: C.paper,
          lineHeight: 1.18,
          opacity: s,
          transform: `translateY(${(1 - s) * 30}px)`,
        }}
      >
        {step}
      </div>
      {result ? (
        <div
          style={{
            marginTop: 60,
            paddingTop: 44,
            borderTop: `3px solid ${C.line}`,
            width: '100%',
            fontSize: 62,
            fontWeight: 700,
            color: C.orange,
            lineHeight: 1.2,
            opacity: verdict,
            transform: `translateY(${(1 - verdict) * 24}px)`,
          }}
        >
          {result}
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------- cta
// Same mark as the profile picture, drawn in CSS so it animates. `keyword`
// turns it into a comment-keyword CTA: one tap instead of four.
export const Cta = ({text, sub, keyword}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = ease(frame, fps);
  const kw = ease(frame, fps, 10, 22);

  return (
    <div style={center}>
      <div style={{width: 300, marginBottom: 70}}>
        {Array.from({length: 7}, (_, i) => {
          const hot = i === 5;
          const r = ease(frame, fps, i * 2);
          return (
            <div
              key={i}
              style={{
                height: 26,
                marginBottom: 14,
                borderRadius: 7,
                background: hot ? C.orange : C.paper,
                opacity: r,
                transform: `scaleX(${interpolate(r, [0, 1], [0.7, 1])})`,
                boxShadow: hot ? '0 0 44px 12px rgba(255,77,46,0.45)' : 'none',
              }}
            />
          );
        })}
      </div>
      <div style={{fontSize: 96, fontWeight: 800, color: C.paper, transform: `translateY(${(1 - s) * 30}px)`}}>
        {text}
      </div>
      {keyword ? (
        <div
          style={{
            marginTop: 40,
            padding: '22px 52px',
            border: `4px solid ${C.orange}`,
            borderRadius: 999,
            fontSize: 66,
            fontWeight: 800,
            color: C.orange,
            opacity: kw,
            transform: `scale(${interpolate(kw, [0, 1], [0.88, 1])})`,
          }}
        >
          COMMENT “{keyword}”
        </div>
      ) : null}
      {sub ? <div style={{...kicker, marginTop: 22, fontSize: 46}}>{sub}</div> : null}
    </div>
  );
};
