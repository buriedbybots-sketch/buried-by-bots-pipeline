// Pull one day's video out of the Google Sheet and write content/<date>.json.
//
//   node scripts/sheet.mjs 2026-08-28
//
// The sheet is read as published CSV, so there is no API key, no service
// account and no OAuth here — the trade is that the sheet must be published to
// the web (File > Share > Publish to web). Set SHEET_ID to the id in its URL.
//
// With no SHEET_ID the same two tabs are read from sheet/videos.csv and
// sheet/scenes.csv on disk, so a row can be checked locally before it ever
// goes in the sheet. Same parser, same linter, same output.
import {readFileSync, writeFileSync} from 'node:fs';
import {enforce} from './lint.mjs';

const SHEET_ID = process.env.SHEET_ID;
const date = process.argv[2] || new Date().toISOString().slice(0, 10);

// Minimal CSV reader — handles quoted fields and embedded newlines, which is
// all Google's export produces.
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
};

const tab = async (name) => {
  if (!SHEET_ID) return parseCsv(readFileSync(`sheet/${name}.csv`, 'utf8'));
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sheet "${name}" -> HTTP ${res.status}. Is it published to the web?`);
  return parseCsv(await res.text());
};

const num = (v) => (v === '' || v == null ? undefined : Number(v));
const opt = (v) => v || undefined;
const lines = (v) => (v || '').split('\n');
const list = (v) => (v || '').split(/[,\n]+/).map((x) => x.trim()).filter(Boolean);

// Column → prop mapping, one entry per scene type. Only the keys a type uses
// get carried through, so a stray cell can't end up as a prop. Columns are
// reused across types on purpose (text/label/head mean "the big line", "the
// second line", "the small line above") so the sheet stays at 23 columns
// instead of 60.
const TYPES = {
  hook: (s) => ({text: s.text, accent: opt(s.accent), head: opt(s.head)}),
  rank: (s) => ({to: num(s.to), total: num(s.total), caption: opt(s.caption)}),
  stat: (s) => ({value: num(s.value), suffix: s.suffix || '%', label: s.label, source: s.source}),
  prompt: (s) => ({title: s.title, lines: lines(s.lines)}),
  test: (s) => ({step: s.text, result: opt(s.label), kicker: opt(s.head)}),
  cta: (s) => ({text: s.text, sub: opt(s.sub), keyword: opt(s.keyword)}),
  // the artifact scenes
  posting: (s) => ({
    title: s.title,
    company: opt(s.company),
    location: s.location,
    pay: opt(s.pay),
    lines: lines(s.lines),
    source: opt(s.source),
  }),
  rejection: (s) => ({company: opt(s.company), title: opt(s.title), text: opt(s.text), time: opt(s.time)}),
  market: (s) => ({label: opt(s.label), lines: lines(s.lines), suffix: s.suffix || '%', source: s.source}),
  comp: (s) => ({title: s.title, lines: lines(s.lines), sub: opt(s.sub), source: s.source}),
  terminal: (s) => ({title: opt(s.title), head: opt(s.head), lines: lines(s.lines)}),
};

const build = (s) => {
  const map = TYPES[s.type];
  if (!map) throw new Error(`row ${s.order}: unknown scene type "${s.type}" (know: ${Object.keys(TYPES).join(', ')})`);
  const scene = {type: s.type, vo: s.vo, ...map(s)};
  if (s.captions) scene.captions = s.captions.toLowerCase() === 'true';
  // a Pixabay search term or numeric image id; rendered as a dim monochrome
  // backdrop behind the scene. Needs PIXABAY_KEY at build time.
  if (s.photo) scene.photo = s.photo;
  return scene;
};

const videos = await tab('videos');
const scenes = await tab('scenes');
if (!SHEET_ID) console.log('  SHEET_ID not set — reading sheet/*.csv from disk');

const meta = videos.find((v) => v.date === date);
if (!meta) throw new Error(`no row in "videos" for ${date}`);

const mine = scenes.filter((s) => s.date === date).sort((a, b) => Number(a.order) - Number(b.order));
if (!mine.length) throw new Error(`no rows in "scenes" for ${date}`);

const links = JSON.parse(readFileSync('content/links.json', 'utf8'));

const content = {
  id: date,
  title: meta.title,
  description: meta.description || '',
  hashtags: (meta.hashtags || '').split(/[ ,]+/).filter(Boolean),
  // blank = the generated bed, "none" = silence, anything else = a file in public/music/
  music: meta.music.toLowerCase() === 'none' ? null : meta.music || 'pulse.wav',
  caption: meta.caption || '', // Instagram
  pinned: meta.pinned || '', // YouTube pinned comment — where the link lives
  // the seeding pack: a Reddit-safe comment (no link) and 3 US communities
  seed: meta.seed || '',
  communities: list(meta.communities).length ? list(meta.communities) : links.communities || [],
  scenes: mine.map(build),
};

enforce(content);

writeFileSync(`content/${date}.json`, JSON.stringify(content, null, 2));
console.log(`content/${date}.json  (${content.scenes.length} scenes)`);
