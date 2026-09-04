// Upload out/<date>.mp4 to YouTube and post the pinned comment.
//
//   node scripts/upload.mjs 2026-08-28
//
// Talks to the REST endpoint directly rather than pulling in googleapis — it's
// one token call and one multipart POST, and the file is ~7MB so a resumable
// upload buys nothing.
//
// Needs YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN.
// PRIVACY defaults to "private" because an unaudited Google Cloud project is
// only allowed to upload private videos anyway — flipping each one public by
// hand is 20 seconds, and cheaper than waiting on the audit.
import {readFileSync, writeFileSync} from 'node:fs';
import {accessToken, gapi} from './lib/google.mjs';

const date = process.argv[2] || new Date().toISOString().slice(0, 10);
const privacy = process.env.PRIVACY || 'private';

// The copy build.mjs produced. Do NOT rebuild the description here — that is
// exactly how videos went live with no lead-magnet or product link in them.
const meta = JSON.parse(readFileSync(`out/${date}.meta.json`, 'utf8'));
const video = readFileSync(`out/${date}.mp4`);
const token = await accessToken();

const metadata = {
  snippet: {
    title: meta.title,
    description: meta.description, // carries the links and #Shorts
    tags: meta.tags,
    // 27 = Education. The old value, 22 "People & Blogs", is the vaguest bucket
    // on the platform and tells the classifier nothing.
    categoryId: '27',
    // An explicit locale declaration, for a channel whose operator is not in
    // that locale. One line each, and they are read.
    defaultLanguage: 'en-US',
    defaultAudioLanguage: 'en-US',
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

const {id} = await gapi(token, 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', {
  method: 'POST',
  headers: {'content-type': `multipart/related; boundary=${boundary}`},
  body,
});

const url = `https://youtube.com/shorts/${id}`;
console.log(`uploaded ${privacy}: ${url}`);

// deliver.mjs reads this to put the URL in the seeding pack; geo.mjs does not
// need it (the Analytics API lists videos itself).
writeFileSync(`out/${date}.upload.json`, JSON.stringify({videoId: id, url, privacy, at: new Date().toISOString()}, null, 2));

// --- the pinned comment, where the link actually gets clicked ---------------
// Posting it is an API call; *pinning* it is not — the Data API has no pin
// endpoint, it's Studio-only. Needs the youtube.force-ssl scope; with
// youtube.upload alone the insert 403s, in which case say so and carry on —
// a successful upload should not be reported as a failed run over a comment.
if (!meta.pinned) {
  console.warn('no pinned comment text for this video — nothing to post.');
} else {
  try {
    await gapi(token, 'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet', {
      method: 'POST',
      body: JSON.stringify({snippet: {videoId: id, topLevelComment: {snippet: {textOriginal: meta.pinned}}}}),
    });
    console.log(`posted the link comment. Pin it in Studio: https://studio.youtube.com/video/${id}/comments`);
  } catch (e) {
    const scopeProblem = e.status === 403 && /insufficient|scope/i.test(e.body || '');
    console.warn(
      scopeProblem
        ? `could not post the comment: the refresh token lacks the youtube.force-ssl scope. Reissue it (DEPLOY.md). Post this by hand meanwhile:\n\n${meta.pinned}`
        : `could not post the comment. Post this by hand:\n\n${meta.pinned}\n\n${e.message}`
    );
  }
}
