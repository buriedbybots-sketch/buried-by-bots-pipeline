// Render a week in one go:  npm run week -- 2026-08-28
//
// Pulls each day's row from the sheet and builds it. Skips days the sheet
// doesn't have, and keeps going if one day fails, so a single bad row can't
// cost you the other six.
import {execSync} from 'node:child_process';
import {existsSync} from 'node:fs';

const start = process.argv[2] || new Date().toISOString().slice(0, 10);
const days = Number(process.argv[3] || 7);

const dates = Array.from({length: days}, (_, i) => {
  const d = new Date(start + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
});

const run = (cmd, args) => execSync([cmd, ...args].join(' '), {stdio: 'inherit'});
const done = [];
const failed = [];

for (const date of dates) {
  console.log(`\n${'='.repeat(52)}\n${date}\n${'='.repeat(52)}`);
  try {
    // SHEET_ID set? pull it. Otherwise assume content/<date>.json is already there.
    if (process.env.SHEET_ID) run('node', ['scripts/sheet.mjs', date]);
    else if (!existsSync(`content/${date}.json`)) {
      console.log('  no sheet and no local content file — skipping');
      continue;
    }
    run('node', ['scripts/build.mjs', date]);
    done.push(date);
  } catch (e) {
    console.error(`  FAILED: ${date}`);
    failed.push(date);
  }
}

console.log(`\n${'='.repeat(52)}`);
console.log(`rendered ${done.length}: ${done.join(', ') || '—'}`);
if (failed.length) console.log(`failed ${failed.length}: ${failed.join(', ')}`);
console.log(`\nEach one is in out/ as .mp4 + .cover.jpg + .post.txt + .meta.json`);
