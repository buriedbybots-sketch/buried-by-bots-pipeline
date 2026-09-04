import React, {useMemo} from 'react';
import {
  AbsoluteFill,
  Audio,
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
//
// Graded to a black-and-orange duotone (grayscale → sepia → hue toward the
// brand orange) with a touch of film grain, so a stock photo reads as a
// deliberate look rather than a photo someone pasted under the text.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

const Backdrop = ({file}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.04, 1.14]);
  const drift = interpolate(frame, [0, durationInFrames], [0, -18]);
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(file)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'grayscale(1) sepia(0.6) hue-rotate(-28deg) saturate(2.2) contrast(1.25) brightness(0.5)',
          opacity: 0.42,
          transform: `scale(${zoom}) translateY(${drift}px)`,
        }}
      />
      {/* grain: shifts every few frames so it flickers like film, not like a texture */}
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN,
          backgroundPosition: `${(frame * 37) % 300}px ${(frame * 53) % 300}px`,
          opacity: 0.12,
          mixBlendMode: 'overlay',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            `radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(15,17,21,0.55) 100%),` +
            `linear-gradient(rgba(15,17,21,0.3) 0%, rgba(15,17,21,0.05) 40%, ${C.void} 82%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// --- the channel handle, always on. Every screen-record and repost of a
// faceless channel is an orphan without it. Sits below YouTube's top chrome.
const Handle = () => (
  <div
    style={{
      position: 'absolute',
      top: 72, // clear of the rank counter at 150 and under the platform's top chrome
      left: 0,
      right: 0,
      textAlign: 'center',
      fontFamily: 'var(--mono)',
      fontSize: 26,
      letterSpacing: '3px',
      color: C.steel,
      opacity: 0.85,
      textShadow: '0 2px 12px rgba(0,0,0,0.8)',
    }}
  >
    @buriedbybots
  </div>
);

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

  // The last word that has started. Never search for a word *containing* ms:
  // edge-tts leaves gaps between words, and on every gap the old lookup fell
  // through to words.length - 1 and flashed the scene's final caption line —
  // visible several times in every scene.
  let cur = 0;
  for (let i = 0; i < words.length; i++) {
    if (ms >= words[i].t) cur = i;
    else break;
  }
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
          default and replays are weighted heavily.

          Not <Freeze>: Remotion clamps a frozen frame to the composition's
          length, and this sits at the very end, so Freeze would show the
          hook mid-spring. A negative-offset Sequence hands the hook frames
          SETTLED..SETTLED+TAIL instead — every word landed, nothing moving. */}
      <Sequence from={body} durationInFrames={TAIL_FRAMES}>
        <Sequence from={-SETTLED} durationInFrames={SETTLED + TAIL_FRAMES}>
          {/* the hook's backdrop too, or the last half second drops the photo
              and the loop point flashes to a bare grid */}
          {content.scenes[0].photoFile ? <Backdrop file={content.scenes[0].photoFile} /> : null}
          <First {...content.scenes[0]} />
        </Sequence>
        <Scan />
      </Sequence>

      <Handle />

      {content.scenes.map((scene, i) => {
        // A hook or cta already shows its line in display type — unless the
        // voice says a lot more than the card does, in which case a muted
        // viewer would sit on a static card for ten seconds. Word counts,
        // not scene types, decide.
        const spoken = (scene.vo || '').split(/\s+/).filter(Boolean).length;
        const shownWords = (scene.text || '').split(/\s+/).filter(Boolean).length;
        const covered = SELF_CAPTIONED.has(scene.type) && spoken <= shownWords + 4;
        const silent = scene.captions === false || (scene.captions !== true && covered);
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
