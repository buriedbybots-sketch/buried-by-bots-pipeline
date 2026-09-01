// Upload out/<date>.mp4 to YouTube.
//
//   node scripts/upload.mjs 2026-08-28
//
// Talks to the REST endpoint directly rather than pulling in googleapis — it's
// one token call and one multipart POST, and the file is ~5MB so a resumable
// upload buys nothing.
//
// Needs YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN.
// PRIVACY defaults to "private" because an unaudited Google Cloud project is
// only allowed to upload private videos anyway — flipping each one public by
// hand is 20 seconds, and cheaper than waiting on the audit.
import {readFileSync} from 'node:fs';

const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const privacy = process.env.PRIVACY || 'private';
const {YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN} = process.env;

for (const [k, v] of Object.entries({YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN})) {
  if (!v) {
    console.error(`${k} is not set`);
    process.exit(1);
  }
}

const content = JSON.parse(readFileSync(`content/${date}.json`, 'utf8'));
const video = readFileSync(`out/${date}.mp4`);

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: {'content-type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({
    client_id: YT_CLIENT_ID,
    client_secret: YT_CLIENT_SECRET,
    refresh_token: YT_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }),
});
if (!tokenRes.ok) throw new Error(`token refresh failed: ${await tokenRes.text()}`);
const {access_token} = await tokenRes.json();

const tags = (content.hashtags || []).map((h) => h.replace(/^#/, ''));
const metadata = {
  snippet: {
    title: content.title,
    // #Shorts in the description is the signal YouTube still reads; the 9:16
    // aspect and sub-60s length do the rest.
    description: `${content.description}\n\n${(content.hashtags || []).join(' ')} #Shorts`.trim(),
    tags,
    categoryId: '22', // People & Blogs
  },
  status: {privacyStatus: privacy, selfDeclaredMadeForKids: false},
};

const boundary = 'bbb' + '-'.repeat(8) + Date.now().toString(36);
const body = Buffer.concat([
  Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: video/mp4\r\n\r\n`
  ),
  video,
  Buffer.from(`\r\n--${boundary}--\r\n`),
]);

const res = await fetch(
  'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
  {
    method: 'POST',
    headers: {
      authorization: `Bearer ${access_token}`,
      'content-type': `multipart/related; boundary=${boundary}`,
    },
    body,
  }
);
if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`);

const {id} = await res.json();
console.log(`uploaded ${privacy}: https://youtube.com/shorts/${id}`);
