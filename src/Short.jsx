import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont as loadHead} from '@remotion/google-fonts/BarlowCondensed';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import {C, FPS, SAFE_BOTTOM} from './theme.js';
import {SCENES} from './scenes.jsx';

// Only the weights and subset actually used. Left unbounded, these two pull
// ~250 font files per render worker, which is slow here and slower on a CI
// runner paying for every second.
const head = loadHead('normal', {weights: ['600', '700', '800'], subsets: ['latin']});
const mono = loadMono('normal', {weights: ['400'], subsets: ['latin']});

const frames = (ms) => Math.max(1, Math.ceil((ms / 1000) * FPS));

// Duration comes from the voiceover, not from a guess — every scene is exactly
// as long as the line that narrates it, plus a beat.
export const sceneFrames = (audio) => audio.scenes.map((s) => frames(s.durationMs) + 8);

export const calcMeta = ({props}) => ({
  durationInFrames: sceneFrames(props.audio).reduce((a, b) => a + b, 0),
});

// --- backdrop: the same cold grid as the banner, drifting slowly
const Grid = () => {
  const frame = useCurrentFrame();
  const y = (frame * 0.35) % 120;
  return (
    <AbsoluteFill style={{background: C.void}}>
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(138,148,166,0.07) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(138,148,166,0.07) 1px, transparent 1px)',
          backgroundSize: '120px 120px',
          transform: `translateY(${y}px)`,
        }}
      />
      <AbsoluteFill
        style={{background: 'radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(0,0,0,0.65) 100%)'}}
      />
    </AbsoluteFill>
  );
};

// --- a 6-frame orange scan wipe on every cut. Cheap, and it's already the
// brand's motif (the Reel cover prompt has the same scan line).
const Scan = () => {
  const frame = useCurrentFrame();
  if (frame > 7) return null;
  const y = interpolate(frame, [0, 7], [0, 1920], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          top: y,
          left: 0,
          right: 0,
          height: 5,
          background: C.orange,
          boxShadow: `0 0 60px 16px rgba(255,77,46,0.5)`,
          opacity: interpolate(frame, [0, 5, 7], [0.9, 0.9, 0]),
        }}
      />
    </AbsoluteFill>
  );
};

// --- word-level captions, timed off the TTS word boundaries. Most Shorts are
// watched muted; this is the only reason the script lands at all.
const Captions = ({words, offset}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = ((frame - offset) / fps) * 1000;

  // a rolling window of ~6 words keeps the line short enough to read
  const idx = words.findIndex((w) => ms >= w.t && ms < w.t + w.d + 120);
  const cur = idx === -1 ? (ms < (words[0]?.t ?? 0) ? 0 : words.length - 1) : idx;
  const start = Math.max(0, cur - (cur % 6));
  const line = words.slice(start, start + 6);
  if (!line.length) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 70,
        right: 70,
        top: SAFE_BOTTOM - 190,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '0 18px',
      }}
    >
      {line.map((w, i) => (
        <span
          key={start + i}
          style={{
            fontSize: 62,
            fontWeight: 700,
            letterSpacing: '0.5px',
            color: start + i === cur ? C.orange : C.paper,
            textShadow: '0 4px 26px rgba(0,0,0,0.9)',
          }}
        >
          {w.w}
        </span>
      ))}
    </div>
  );
};

export const Short = ({content, audio}) => {
  const {durationInFrames} = useVideoConfig();
  const lens = sceneFrames(audio);
  let at = 0;

  return (
    <AbsoluteFill
      style={{
        fontFamily: head.fontFamily,
        backgroundColor: C.void,
        ['--mono']: mono.fontFamily,
      }}
    >
      <Grid />

      {content.music ? (
        <Audio
          src={staticFile(`music/${content.music}`)}
          volume={(f) =>
            // sits under the voice, and gets out of the way at the end
            interpolate(f, [0, 20, durationInFrames - 30, durationInFrames], [0, 0.11, 0.11, 0], {
              extrapolateRight: 'clamp',
            })
          }
        />
      ) : null}

      {content.scenes.map((scene, i) => {
        const Comp = SCENES[scene.type];
        const from = at;
        at += lens[i];
        if (!Comp) throw new Error(`Unknown scene type "${scene.type}" at index ${i}`);
        return (
          <Sequence key={i} from={from} durationInFrames={lens[i]}>
            <Audio src={staticFile(`vo/${content.id}/${i}.mp3`)} />
            <Comp {...scene} />
            <Scan />
          </Sequence>
        );
      })}

      {/* Captions live above the scenes so they never get covered. Hook and CTA
          scenes already put their line on screen in 130px type — captioning it
          again underneath just says the same thing twice. */}
      {content.scenes.map((scene, i) => {
        const silent = scene.captions === false || (scene.captions !== true && (scene.type === 'hook' || scene.type === 'cta'));
        if (silent) return null;
        const from = lens.slice(0, i).reduce((a, b) => a + b, 0);
        return (
          <Sequence key={`c${i}`} from={from} durationInFrames={lens[i]}>
            <Captions words={audio.scenes[i].words} offset={0} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
