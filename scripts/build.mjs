// One command per video:  npm run build -- 2026-08-28
// Lints, voices, guards, renders. Reads content/<id>.json, writes out/<id>.*
import {execSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {enforce} from './lint.mjs';
import {fetchPhotos} from './lib/photo.mjs';

// Local secrets (PIXABAY_KEY) live in a gitignored .env; CI gets them from
// GitHub Secrets. Node 20.12+ reads the file natively — nothing to install.
if (existsSync('.env')) process.loadEnvFile('.env');

// Content ids are dates in the scheduled pipeline, so today is the right default.
const id = process.argv[2] || new Date().toISOString().slice(0, 10);

const run = (cmd, args) => execSync([cmd, ...args].join(' '), {stdio: 'inherit'});
const fail = (msg) => {
  console.error(`\n${msg}`);
  process.exit(1);
};

// The first 2.5 seconds decide whether the viewer stays. Spoken length of the
// opening scene, not scene length — the 280ms tail and the 8-frame beat are
// production, not hook. Warn past 2.5s, refuse past 3s.
const HOOK_MAX_MS = 2500;
const HOOK_HARD_MS = 3000;
const TAIL_S = 0.5; // the loop-back tail, see src/theme.js
const BED = 'pulse.wav';

const content = JSON.parse(readFileSync(`content/${id}.json`, 'utf8'));
const links = JSON.parse(readFileSync('content/links.json', 'utf8'));

console.log(`\nlinting ${id}`);
enforce(content);

// The music bed. The default is generated, not downloaded — YouTube's Audio
// Library needs a browser and a login, and a 4-line synth is enough texture
// at 11% under a voice. Drop a real track in public/music/ and name it in the
// sheet's `music` column to replace it.
if (content.music) {
  const path = `public/music/${content.music}`;
  if (!existsSync(path)) {
    if (content.music !== BED) fail(`${path} does not exist — put the track in public/music/ or clear the music cell`);
    console.log(`\ngenerating ${path}`);
    run('python', ['scripts/bed.py', path]);
  }
}

console.log(`\nvoicing ${id}`);
run('python', ['scripts/tts.py', `content/${id}.json`]);

// Optional stock backdrops. Mutates `content` (adds scene.photoFile) so the
// props the renderer sees carry the local file, never the search term.
await fetchPhotos(content);

const audio = JSON.parse(readFileSync(`content/${id}.audio.json`, 'utf8'));
const props = {content, audio};
mkdirSync('out', {recursive: true});
writeFileSync(`out/${id}.props.json`, JSON.stringify(props));

const first = audio.scenes[0].words;
const hookMs = first.length ? first[first.length - 1].t + first[first.length - 1].d : 0;
if (hookMs > HOOK_HARD_MS) {
  fail(`the hook is spoken over ${(hookMs / 1000).toFixed(1)}s — over ${HOOK_HARD_MS / 1000}s. Cut scene 1's vo to one short line; the rest can be scene 2.`);
} else if (hookMs > HOOK_MAX_MS) {
  console.warn(`\n  ⚠ the hook is spoken over ${(hookMs / 1000).toFixed(1)}s — aim for under ${HOOK_MAX_MS / 1000}s. Trim a word from scene 1's vo.`);
}

// Shorts eligibility is 60s. Fail here rather than after a 3-minute render and
// a silently-ineligible upload.
const seconds = audio.scenes.reduce((a, s) => a + s.durationMs, 0) / 1000 + TAIL_S;
if (seconds > 58) fail(`${seconds.toFixed(1)}s — too long for Shorts. Cut a scene or shorten a vo line.`);

console.log(`\nrendering ${id}  (${seconds.toFixed(1)}s, hook ${(hookMs / 1000).toFixed(1)}s)`);
run('npx', ['remotion', 'render', 'src/index.jsx', 'Short', `out/${id}.mp4`, `--props=out/${id}.props.json`]);

// Instagram picks an arbitrary frame as the Reel cover otherwise, usually
// mid-transition. Frame 40 is the hook with every word landed (SETTLED in
// src/Short.jsx — same frame the loop tail freezes on).
run('npx', ['remotion', 'still', 'src/index.jsx', 'Short', `out/${id}.cover.jpg`, '--frame=40', `--props=out/${id}.props.json`]);

// --- the copy. Composed once, here, and read by upload.mjs and deliver.mjs.
// They used to each build their own strings, which is how videos went live
// with the links missing. One object, one file, every consumer reads it.
const hashtags = content.hashtags || [];
const fill = (s) =>
  (s || '')
    .replaceAll('[LEAD MAGNET LINK]', links.leadMagnet || '[LEAD MAGNET LINK — NOT SET YET]')
    .replaceAll('[PRODUCT LINK]', links.product)
    .replaceAll('[KEYWORD]', links.keyword);

if (!links.leadMagnet) console.warn('\n  ⚠ content/links.json has no leadMagnet URL — the pinned comment will ship broken.');

// Tags: the video's own hashtags first, then the standing base set, deduped,
// inside YouTube's 500-character budget (a tag with a space costs 2 extra for
// its quotes).
const tags = [];
let budget = 480;
for (const t of [...hashtags.map((h) => h.replace(/^#/, '')), ...(links.baseTags || [])]) {
  const cost = t.length + (t.includes(' ') ? 2 : 0) + 1;
  if (tags.includes(t) || cost > budget) continue;
  tags.push(t);
  budget -= cost;
}

const meta = {
  id,
  title: content.title,
  description: fill(
    `${content.description}\n\n` +
      `Free 5-prompt pack: [LEAD MAGNET LINK]\n` +
      `The full toolkit: [PRODUCT LINK]\n\n` +
      `${hashtags.join(' ')} #Shorts`
  ).trim(),
  pinned: fill(content.pinned).trim(),
  igCaption: fill(
    [
      content.caption || content.description,
      (content.caption || '').includes(links.keyword) ? null : `Comment ${links.keyword} and I'll send it, or it's in the bio.`,
      hashtags.join(' '),
    ]
      .filter(Boolean)
      .join('\n\n')
  ).trim(),
  tags,
  // The seeding pack. Who sees the first ~50 views decides everything after;
  // this is what the operator posts in the first hour. No link, by rule.
  seed: {
    comment: (content.seed || '').trim(),
    communities: content.communities || [],
  },
  seconds: Number(seconds.toFixed(1)),
};

if (!meta.pinned) console.warn('  ⚠ no "pinned" cell in the sheet for this row — the video will ship with no pinned comment.');

writeFileSync(`out/${id}.meta.json`, JSON.stringify(meta, null, 2));

// The human-readable twin, for posting by hand. Same strings, no second source.
writeFileSync(
  `out/${id}.post.txt`,
  [
    `--- YOUTUBE TITLE ---`,
    meta.title,
    ``,
    `--- YOUTUBE DESCRIPTION ---`,
    meta.description,
    ``,
    `--- YOUTUBE TAGS ---`,
    meta.tags.join(', '),
    ``,
    `--- YOUTUBE PINNED COMMENT (the pipeline posts this; you still pin it in Studio) ---`,
    meta.pinned || '(none set in the sheet)',
    ``,
    `--- INSTAGRAM CAPTION (no clickable links on IG — keyword + bio only) ---`,
    meta.igCaption,
    ``,
    `--- SEEDING PACK (post in the first hour, from the personal Reddit account, no link) ---`,
    meta.seed.comment || '(no seed comment in the sheet)',
    ``,
    ...meta.seed.communities.map((c) => `  • ${c}`),
    ``,
  ].join('\n')
);

console.log(`\ndone -> out/${id}.mp4  +  .cover.jpg  +  .post.txt  +  .meta.json`);
