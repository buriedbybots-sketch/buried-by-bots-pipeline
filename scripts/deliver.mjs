// Send the finished Short to the phone over Telegram: the mp4, the cover, the
// Instagram caption, the pin reminder, and the seeding pack.
//
//   node scripts/deliver.mjs 2026-08-28
//
// Needs TG_BOT_TOKEN and TG_CHAT_ID. If they aren't set the script says so and
// exits 0 rather than failing the run: delivery is a convenience, and a
// missing Telegram bot shouldn't turn a successful render into a red build.
import {existsSync, readFileSync} from 'node:fs';
import {telegram} from './lib/telegram.mjs';

// Telegram caps bot uploads at 50MB. A 35-second Short out of this pipeline is
// about 7MB, so this only trips when something upstream is wrong.
const TG_LIMIT = 50 * 1024 * 1024;

// When to post the Reel by hand. The cron fires 13:00 UTC (18:30 IST, 9:00 AM
// ET); this window is ~90 minutes later so the two platforms don't compete for
// the same first hour, and it still lands mid-morning on the US East Coast.
const IG_WINDOW = '8:00-8:30 PM IST  (10:30-11:00 AM ET)';

const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const tg = telegram();
if (!tg) {
  console.log('TG_BOT_TOKEN / TG_CHAT_ID not set — skipping phone delivery.');
  process.exit(0);
}

const read = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const videoPath = `out/${date}.mp4`;
if (!existsSync(videoPath)) throw new Error(`${videoPath} does not exist — did the render run?`);

const video = readFileSync(videoPath);
const mb = (video.length / 1024 / 1024).toFixed(1);
if (video.length > TG_LIMIT) {
  throw new Error(`${videoPath} is ${mb}MB, over Telegram's 50MB bot limit. Grab it from the workflow artifact instead.`);
}

// The mp4 first, as a document so it arrives uncompressed.
await tg.file(`${date}.mp4`, video, 'video/mp4', `Short for ${date} — ${mb}MB, 1080x1920.\nSave to gallery, then post the Reel.`);

const coverPath = `out/${date}.cover.jpg`;
if (existsSync(coverPath)) {
  await tg.file(`${date}.cover.jpg`, readFileSync(coverPath), 'image/jpeg', 'Reel cover — set this manually, IG picks a bad frame otherwise.');
}

// Everything below reads out/<date>.meta.json — the same strings the uploader
// used, so nothing here can drift from what went live.
const meta = read(`out/${date}.meta.json`) || {};
const upload = read(`out/${date}.upload.json`);

await tg.text(
  meta.igCaption
    ? `POST THE REEL AT:  ${IG_WINDOW}\n\nCaption below — copy from here down.\n\n${meta.igCaption}`
    : `POST THE REEL AT:  ${IG_WINDOW}\n\n(No caption in out/${date}.meta.json — check the build.)`
);

// upload.mjs posts the pinned comment, but it still has to be *pinned* by hand
// (the API can't), and if the token is missing the comment scope this is the
// fallback text.
if (meta.pinned) {
  await tg.text(`PIN THIS COMMENT on the Short (Studio > Comments):\n\n${meta.pinned}`);
}

// The seeding pack. The first ~50 viewers decide who the next 5,000 are, and
// the pipeline can't pick them — but the operator can, in the first hour,
// from the personal Reddit account. URL, comment, three communities. No link
// in the comment, ever; the Short URL goes only where a sub allows video.
const seed = meta.seed || {};
await tg.text(
  [
    `SEED IT NOW (first hour):`,
    upload?.url ? upload.url : `(upload failed — post the Short by hand from the file above, then seed with that URL)`,
    ``,
    seed.comment || '(no seed comment in the sheet — write two sentences, no link)',
    ``,
    `Where:`,
    ...(seed.communities || []).map((c) => `  • ${c}`),
  ].join('\n')
);

console.log(`delivered ${date}.mp4 (${mb}MB) + seeding pack to Telegram`);
