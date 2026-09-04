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

// Read the copy build.mjs produced. Do NOT rebuild the description here — that
// is exactly how videos went live with no lead-magnet or product link in them.
const meta = JSON.parse(readFileSync(`out/${date}.meta.json`, 'utf8'));
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

const metadata = {
  snippet: {
    // YouTube truncates past 100 characters. Fail loudly rather than ship a
    // title that stops mid-word.
    title: meta.title,
    // Carries the links. #Shorts is the signal YouTube still reads; the 9:16
    // aspect and sub-60s length do the rest.
    description: meta.description,
    tags: meta.tags,
    categoryId: '22', // People & Blogs
  },
  status: {privacyStatus: privacy, selfDeclaredMadeForKids: false},
};

if (meta.title.length > 100) {
  throw new Error(`title is ${meta.title.length} chars, YouTube caps at 100: "${meta.title}"`);
}

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

// --- the pinned comment, where the link actually gets clicked ---------------
//
// Shorts viewers open the comments far more than the bio, so this is the
// channel's real conversion surface. Posting it is an API call; *pinning* it
// is not — the Data API has no pin endpoint, it's Studio-only. So: post it
// here, pin it by hand once.
//
// This needs the `youtube.force-ssl` scope. If the refresh token was issued
// with `youtube.upload` alone the insert 403s — in that case say so clearly
// and carry on, because a successful upload should not be reported as a
// failed run over a comment.
if (!meta.pinned) {
  console.warn('no pinned comment text for this video — nothing to post.');
} else {
  const commentRes = await fetch(
    'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet',
    {
      method: 'POST',
      headers: {authorization: `Bearer ${access_token}`, 'content-type': 'application/json'},
      body: JSON.stringify({
        snippet: {
          videoId: id,
          topLevelComment: {snippet: {textOriginal: meta.pinned}},
        },
      }),
    }
  );

  if (commentRes.ok) {
    console.log(`posted the link comment. Pin it in Studio: https://studio.youtube.com/video/${id}/comments`);
  } else {
    const body = await commentRes.text();
    const scopeProblem = commentRes.status === 403 && /insufficient|scope/i.test(body);
    console.warn(
      scopeProblem
        ? 'could not post the comment: the refresh token lacks the youtube.force-ssl scope. ' +
            'Reissue it with that scope added (see DEPLOY.md). Post this by hand meanwhile:\n\n' +
            meta.pinned
        : `could not post the comment (${commentRes.status}). Post this by hand:\n\n${meta.pinned}\n\n${body}`
    );
  }
}
