// One command per video:  npm run build -- 2026-08-28
// Lints, voices, guards, renders. Reads content/<id>.json, writes out/<id>.*
import {execSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {enforce} from './lint.mjs';
import {fetchPhotos} from './lib/photo.mjs';
import {productId, ensureCode} from './lib/gumroad.mjs';

// Local secrets (PIXABAY_KEY) live in a gitignored .env; CI gets them from
// GitHub Secrets. Node 20.12+ reads the file natively — nothing to install.
if (existsSync('.env')) process.loadEnvFile('.env');

// Content ids are dates in the scheduled pipeline, so today is the right default.
const id = process.argv[2] || new Date().toISOString().slice(0, 10);

const q = (a) => (/^[\w./=:-]+$/.test(a) ? a : `"${String(a).replace(/"/g, '\\"')}"`);
const run = (cmd, args) => execSync([cmd, ...args.map(q)].join(' '), {stdio: 'inherit'});
const fail = (msg) => {
  console.error(`\n${msg}`);
  process.exit(1);
};

// The first 2.5 seconds decide whether the viewer stays. Spoken length of the
// opening scene, not scene length — the 280ms tail and the 8-frame beat are
// production, not hook. Warn past 2.5s, refuse past 3s.
const HOOK_MAX_MS = 2500;
const HOOK_HARD_MS = 3200; // 3s plus room for TTS jitter — an approved hook measures 2997ms
const TAIL_S = 0.5; // the loop-back tail, see src/theme.js
const TARGET_S = 45; // soft ceiling: past this a cold viewer stops finishing it
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
//
// But 58s is the platform's limit, not ours. A cold-audience Short is watched
// to the end at 30-40s and abandoned well before 55, so the guard that
// matters is the soft one: past TARGET_S the video is too long to hold a
// stranger, whatever YouTube will accept.
const seconds = audio.scenes.reduce((a, s) => a + s.durationMs, 0) / 1000 + TAIL_S;
if (seconds > 58) fail(`${seconds.toFixed(1)}s — too long for Shorts. Cut a scene or shorten a vo line.`);
if (seconds > TARGET_S) {
  console.warn(
    `\n  ⚠ ${seconds.toFixed(1)}s — over the ${TARGET_S}s target. It will upload, but a stranger will not` +
      ` finish it. Cut the weakest scene, or trim the two longest vo lines.`
  );
}

console.log(`\nrendering ${id}  (${seconds.toFixed(1)}s, hook ${(hookMs / 1000).toFixed(1)}s)`);
run('npx', ['remotion', 'render', 'src/index.jsx', 'Short', `out/${id}.mp4`, `--props=out/${id}.props.json`]);

// The Reel cover. Instagram picks a mid-transition frame otherwise, and the
// cover is the one-frame test: a stranger sees it with no audio and has to
// know this is about US tech hiring.
//
// Frame 40 — scene 1, settled — was hard-coded, and scene 1 is a bare hook
// card. Prefer the first scene that says who this is for on screen: an
// artifact scene (a Greenhouse req, a rejection mail, a comp table) or any
// scene carrying a `head` kicker. Fall back to scene 1 when a row has
// neither.
const ARTIFACT = new Set(['posting', 'rejection', 'comp', 'market']);
const coverIdx = content.scenes.findIndex((s) => ARTIFACT.has(s.type) || s.head);
const lens = audio.scenes.map((s) => Math.max(1, Math.ceil((s.durationMs / 1000) * 30)) + 8);
const coverFrame =
  coverIdx === -1
    ? 40
    : lens.slice(0, coverIdx).reduce((a, b) => a + b, 0) + Math.min(45, lens[coverIdx] - 1);
console.log(`cover: frame ${coverFrame} (scene ${coverIdx === -1 ? 1 : coverIdx + 1})`);
// Captions off for the still: a caption fragment burned into a cover reads
// as a mistake.
writeFileSync(`out/${id}.cover.props.json`, JSON.stringify({content: {...content, cover: true}, audio}));
run('npx', ['remotion', 'still', 'src/index.jsx', 'Short', `out/${id}.cover.jpg`, `--frame=${coverFrame}`, `--props=out/${id}.cover.props.json`]);

// --- the copy. Composed once, here, and read by upload.mjs and deliver.mjs.
// They used to each build their own strings, which is how videos went live
// with the links missing. One object, one file, every consumer reads it.
const hashtags = content.hashtags || [];

// Per-video attribution. Each video gets its own 10% Gumroad code (YT0828
// for 2026-08-28, or the sheet's `code` cell), the code rides inside the
// product URL so nobody has to type it, and scripts/sales.mjs reads sales
// back by code. Without GUMROAD_TOKEN the code can't be created, so the
// plain product link ships and the "10% off" clause is dropped — a link to
// a discount that doesn't exist is worse than no discount.
const code = (content.code || `YT${id.replace(/-/g, '').slice(4)}`).toUpperCase();
let productUrl = links.product;
let coded = false;
try {
  const pid = await productId(links.product);
  if (pid) coded = await ensureCode(pid, code);
} catch (e) {
  console.warn(`  ⚠ gumroad: ${e.message} — shipping the plain product link`);
}
if (coded) productUrl = `${links.product.replace(/\/+$/, '')}/${code}`;
else console.warn('  ⚠ GUMROAD_TOKEN not set — no per-video code, sales will not be attributable to this video');

const fill = (s) =>
  (s || '')
    .replaceAll('[LEAD MAGNET LINK]', links.leadMagnet || '[LEAD MAGNET LINK — NOT SET YET]')
    .replaceAll('[PRODUCT LINK]', productUrl)
    .replaceAll('[KEYWORD]', links.keyword)
    // "… — 10% off with code [CODE])" collapses to ")" when there is no code
    .replace(/\s*[—-]\s*10% off with code \[CODE\]/g, coded ? ` — 10% off with code ${code}` : '')
    .replaceAll('[CODE]', coded ? code : '');

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
  code: coded ? code : null,
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
