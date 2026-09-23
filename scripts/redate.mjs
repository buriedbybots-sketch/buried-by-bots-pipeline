// Shift every sheet row onto consecutive days starting at <start>, keeping order.
// Sheet dates rot while nothing is posting; this is the whole fix.
//   npm run redate -- 2026-09-28
import { readFileSync, writeFileSync } from 'node:fs';

const start = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '')) throw new Error('usage: npm run redate -- YYYY-MM-DD');

// A row starts with its date; quoted multi-line cells never do.
const ROW = /^(\d{4}-\d{2}-\d{2}),/gm;
const videos = readFileSync('sheet/videos.csv', 'utf8');
const old = [...videos.matchAll(ROW)].map((m) => m[1]);

const day = (i) => new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10);
const map = Object.fromEntries(old.map((d, i) => [d, day(i)]));

for (const f of ['sheet/videos.csv', 'sheet/scenes.csv']) {
  const text = readFileSync(f, 'utf8');
  const out = text.replace(ROW, (m, d) => {
    if (!map[d]) throw new Error(`${f}: row dated ${d} has no match in videos.csv`);
    return `${map[d]},`;
  });
  writeFileSync(f, out);
}
for (const [a, b] of Object.entries(map)) console.log(`${a} -> ${b}`);
