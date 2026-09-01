// One command per video:  npm run build -- 2026-08-28
// Voices the script, then renders it. Reads content/<id>.json.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';

// Content ids are dates in the scheduled pipeline, so today is the right default.
const id = process.argv[2] || new Date().toISOString().slice(0, 10);

const run = (cmd, args) => execFileSync(cmd, args, {stdio: 'inherit', shell: true});

console.log(`\nvoicing ${id}`);
run('python', ['scripts/tts.py', `content/${id}.json`]);

const props = {
  content: JSON.parse(readFileSync(`content/${id}.json`, 'utf8')),
  audio: JSON.parse(readFileSync(`content/${id}.audio.json`, 'utf8')),
};
mkdirSync('out', {recursive: true});
writeFileSync(`out/${id}.props.json`, JSON.stringify(props));

// Shorts eligibility is 60s. Fail here rather than after a 3-minute render and
// a silently-ineligible upload.
const seconds = props.audio.scenes.reduce((a, s) => a + s.durationMs, 0) / 1000;
if (seconds > 58) {
  console.error(`\n${seconds.toFixed(1)}s — too long for Shorts. Cut a scene or shorten a vo line.`);
  process.exit(1);
}

console.log(`\nrendering ${id}  (${seconds.toFixed(1)}s)`);
run('npx', ['remotion', 'render', 'src/index.jsx', 'Short', `out/${id}.mp4`, `--props=out/${id}.props.json`]);

// Instagram picks an arbitrary frame as the Reel cover otherwise, usually
// mid-transition. Frame 20 is the hook with its animation settled.
run('npx', ['remotion', 'still', 'src/index.jsx', 'Short', `out/${id}.cover.jpg`, '--frame=20', `--props=out/${id}.props.json`]);

// Everything needed to post, next to the video, so posting is copy-paste and
// never "write a caption at 7am".
const {content} = props;
const tags = (content.hashtags || []).join(' ');
const links = JSON.parse(readFileSync('content/links.json', 'utf8'));

// The link lives in content/links.json and gets substituted here, so changing it
// once changes every video from then on instead of seven sheet rows a week.
const fill = (s) =>
  (s || '')
    .replaceAll('[LEAD MAGNET LINK]', links.leadMagnet || '[LEAD MAGNET LINK — NOT SET YET]')
    .replaceAll('[PRODUCT LINK]', links.product)
    .replaceAll('[KEYWORD]', links.keyword);

if (!links.leadMagnet) {
  console.warn('\n  ⚠ content/links.json has no leadMagnet URL — the pinned comment will ship broken.');
}

writeFileSync(
  `out/${id}.post.txt`,
  [
    `--- YOUTUBE TITLE ---`,
    content.title,
    ``,
    `--- YOUTUBE DESCRIPTION ---`,
    fill(
      `${content.description}\n\n` +
        `Free 5-prompt pack: [LEAD MAGNET LINK]\n` +
        `The full 25-prompt toolkit: [PRODUCT LINK]\n\n` +
        `${tags} #Shorts`
    ).trim(),
    ``,
    `--- YOUTUBE PINNED COMMENT (pin this, it outperforms the bio) ---`,
    fill(content.pinned) || '(none set in the sheet)',
    ``,
    // Instagram strips links from captions, so the CTA there is the keyword and
    // the bio — never a pasted URL.
    `--- INSTAGRAM CAPTION (no clickable links on IG — keyword + bio only) ---`,
    fill(
      [
        content.caption || content.description,
        // most captions already work the keyword in — don't say it twice
        (content.caption || '').includes(links.keyword)
          ? null
          : `Comment ${links.keyword} and I'll send it, or it's in the bio.`,
        tags,
      ]
        .filter(Boolean)
        .join('\n\n')
    ).trim(),
    ``,
  ].join('\n')
);

console.log(`\ndone -> out/${id}.mp4  +  .cover.jpg  +  .post.txt`);
