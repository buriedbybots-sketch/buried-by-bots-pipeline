// Send the finished Short to your phone over Telegram, with the Instagram
// caption ready to copy.
//
//   node scripts/deliver.mjs 2026-08-28
//
// Why Telegram: it's free, it's already on the phone, and — the part that
// matters — sendDocument transfers the file byte-exact. sendVideo would
// re-encode it and hand you back a softer copy of the thing we just rendered
// at 1080x1920. So this sends the mp4 as a *document*. On the phone: tap it,
// save to gallery, then post to Instagram from the gallery at full quality.
//
// Needs TG_BOT_TOKEN and TG_CHAT_ID. Both come from GitHub Secrets — see
// DEPLOY.md. If they aren't set the script says so and exits 0 rather than
// failing the run: delivery is a convenience, and a missing Telegram bot
// shouldn't turn a successful render and upload into a red build.
import {readFileSync, existsSync} from 'node:fs';

// Telegram caps bot uploads at 50MB. That binds well before Instagram's 120MB
// quality cliff, so it's the only limit worth checking — and a 35-second Short
// out of this pipeline is about 7MB, so neither is close.
const TG_LIMIT = 50 * 1024 * 1024;

// When to post the Reel by hand. The cron fires 13:00 UTC (18:30 IST, 9:00 AM
// ET); this window is ~90 minutes later so the two platforms don't compete for
// the same first hour, and it still lands mid-morning on the US East Coast.
const IG_WINDOW = '8:00-8:30 PM IST  (10:30-11:00 AM ET)';

const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const {TG_BOT_TOKEN, TG_CHAT_ID} = process.env;

if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
  console.log('TG_BOT_TOKEN / TG_CHAT_ID not set — skipping phone delivery.');
  process.exit(0);
}

const api = (method, form) =>
  fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/${method}`, {method: 'POST', body: form}).then(
    async (res) => {
      if (!res.ok) throw new Error(`${method} failed: ${res.status} ${await res.text()}`);
      return res.json();
    }
  );

const videoPath = `out/${date}.mp4`;
if (!existsSync(videoPath)) throw new Error(`${videoPath} does not exist — did the render run?`);

const video = readFileSync(videoPath);
const mb = (video.length / 1024 / 1024).toFixed(1);
if (video.length > TG_LIMIT) {
  throw new Error(
    `${videoPath} is ${mb}MB, over Telegram's 50MB bot limit. ` +
      `Grab it from the workflow artifact instead, and shorten the script — ` +
      `a Short this size means something is wrong upstream.`
  );
}

// The mp4 first, as a document so it arrives uncompressed.
const doc = new FormData();
doc.append('chat_id', TG_CHAT_ID);
doc.append('document', new Blob([video], {type: 'video/mp4'}), `${date}.mp4`);
doc.append('caption', `Short for ${date} — ${mb}MB, 1080x1920.\nSave to gallery, then post the Reel.`);
await api('sendDocument', doc);

// The cover frame, so Instagram doesn't pick a mid-transition frame itself.
const coverPath = `out/${date}.cover.jpg`;
if (existsSync(coverPath)) {
  const cover = new FormData();
  cover.append('chat_id', TG_CHAT_ID);
  cover.append('document', new Blob([readFileSync(coverPath)], {type: 'image/jpeg'}), `${date}.cover.jpg`);
  cover.append('caption', 'Reel cover — set this manually, IG picks a bad frame otherwise.');
  await api('sendDocument', cover);
}

// The Instagram caption on its own, because a document caption is capped at
// 1024 characters and because a standalone message is easier to long-press and
// copy on a phone.
const post = existsSync(`out/${date}.post.txt`) ? readFileSync(`out/${date}.post.txt`, 'utf8') : '';
const igCaption = post.split('--- INSTAGRAM CAPTION ---')[1]?.trim();

const msg = new FormData();
msg.append('chat_id', TG_CHAT_ID);
msg.append(
  'text',
  igCaption
    ? `POST THE REEL AT:  ${IG_WINDOW}\n\nCaption below — copy from here down.\n\n${igCaption}`
    : `POST THE REEL AT:  ${IG_WINDOW}\n\n(No caption found in out/${date}.post.txt — check the build.)`
);
await api('sendMessage', msg);

console.log(`delivered ${date}.mp4 (${mb}MB) to Telegram`);
