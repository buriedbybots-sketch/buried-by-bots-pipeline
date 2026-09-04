import React, {useMemo} from 'react';
import {
  AbsoluteFill,
  Audio,
  Freeze,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont as loadHead} from '@remotion/google-fonts/BarlowCondensed';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import {C, FPS, SAFE_BOTTOM, TAIL_FRAMES} from './theme.js';
import {SCENES, SELF_CAPTIONED} from './scenes/index.jsx';

// Only the weights and subset actually used. Left unbounded, these two pull
// ~250 font files per render worker.
const head = loadHead('normal', {weights: ['500', '600', '700', '800'], subsets: ['latin']});
const mono = loadMono('normal', {weights: ['400'], subsets: ['latin']});

const frames = (ms) => Math.max(1, Math.ceil((ms / 1000) * FPS));

// The frame by which a hook's staggered words have all landed (last word
// starts at ~frame 21 for a 7-word line, springs settle in ~15). Used for the
// loop tail here and for the cover still in build.mjs.
export const SETTLED = 40;

// Duration comes from the voiceover, not from a guess — every scene is exactly
// as long as the line that narrates it, plus a beat.
export const sceneFrames = (audio) => audio.scenes.map((s) => frames(s.durationMs) + 8);

export const calcMeta = ({props}) => ({
  durationInFrames: sceneFrames(props.audio).reduce((a, b) => a + b, 0) + TAIL_FRAMES,
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

// --- an optional stock photo behind a scene, pulled to the palette: greyscale,
// dim, drifting slowly, fading into the void where the captions sit. It is
// texture that says "a person cut this", not an image the viewer is meant to
// read — the scene on top still does the talking.
const Backdrop = ({file}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.04, 1.12]);
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(file)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'grayscale(1) contrast(1.15) brightness(0.55)',
          opacity: 0.32,
          transform: `scale(${zoom})`,
        }}
      />
      <AbsoluteFill
        style={{background: `linear-gradient(rgba(15,17,21,0.35) 0%, rgba(15,17,21,0.15) 45%, ${C.void} 82%)`}}
      />
    </AbsoluteFill>
  );
};

// --- a 6-frame orange scan wipe on every cut.
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
//
// Words are grouped into lines by character budget, not by a fixed count, so
// six long words don't overflow the 940px band and six short ones don't leave
// it half empty.
const LINE_CHARS = 26;
const LINE_WORDS = 6;

export const captionLines = (words) => {
  const out = [];
  let cur = [];
  let len = 0;
  for (const w of words) {
    if (cur.length && (len + w.w.length + 1 > LINE_CHARS || cur.length >= LINE_WORDS)) {
      out.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(w);
    len += w.w.length + 1;
  }
  if (cur.length) out.push(cur);
  return out;
};

const Captions = ({words}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const lines = useMemo(() => captionLines(words), [words]);

  const idx = words.findIndex((w) => ms >= w.t && ms < w.t + w.d + 120);
  const cur = idx === -1 ? (ms < (words[0]?.t ?? 0) ? 0 : words.length - 1) : idx;
  const line = lines.find((l) => l.includes(words[cur]));
  if (!line) return null;

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
      {line.map((w) => (
        <span
          key={w.t}
          style={{
            fontSize: 62,
            fontWeight: 700,
            letterSpacing: '0.5px',
            color: w === words[cur] ? C.orange : C.paper,
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
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  const body = starts[starts.length - 1] + lens[lens.length - 1];
  const First = SCENES[content.scenes[0].type];

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
          loop
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
        if (!Comp) throw new Error(`Unknown scene type "${scene.type}" at index ${i}`);
        return (
          <Sequence key={i} from={starts[i]} durationInFrames={lens[i]}>
            <Audio src={staticFile(`vo/${content.id}/${i}.mp3`)} />
            {scene.photoFile ? <Backdrop file={scene.photoFile} /> : null}
            <Comp {...scene} />
            <Scan />
          </Sequence>
        );
      })}

      {/* The loop-back tail: half a second of the opening scene, settled, so a
          replay lands on the question the video started with. Shorts loop by
          default and replays are weighted heavily. */}
      <Sequence from={body} durationInFrames={TAIL_FRAMES}>
        <Freeze frame={SETTLED}>
          <First {...content.scenes[0]} />
        </Freeze>
        <Scan />
      </Sequence>

      {content.scenes.map((scene, i) => {
        const silent = scene.captions === false || (scene.captions !== true && SELF_CAPTIONED.has(scene.type));
        if (silent) return null;
        return (
          <Sequence key={`c${i}`} from={starts[i]} durationInFrames={lens[i]}>
            <Captions words={audio.scenes[i].words} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
