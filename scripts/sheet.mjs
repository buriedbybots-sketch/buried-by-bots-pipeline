// Pull one day's video out of the Google Sheet and write content/<date>.json.
//
//   node scripts/sheet.mjs 2026-08-28
//
// The sheet is read as published CSV, so there is no API key, no service
// account and no OAuth here — the trade is that the sheet must be published to
// the web (File > Share > Publish to web). Scripts and captions aren't secret,
// so that's a fair trade. Set SHEET_ID to the id in the sheet's URL.
import {writeFileSync} from 'node:fs';

const SHEET_ID = process.env.SHEET_ID;
const date = process.argv[2] || new Date().toISOString().slice(0, 10);
if (!SHEET_ID) {
  console.error('SHEET_ID is not set');
  process.exit(1);
}

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
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sheet "${name}" -> HTTP ${res.status}. Is it published to the web?`);
  return parseCsv(await res.text());
};

const num = (v) => (v === '' || v == null ? undefined : Number(v));

const videos = await tab('videos');
const scenes = await tab('scenes');

const meta = videos.find((v) => v.date === date);
if (!meta) throw new Error(`no row in "videos" for ${date}`);

const mine = scenes
  .filter((s) => s.date === date)
  .sort((a, b) => Number(a.order) - Number(b.order));
if (!mine.length) throw new Error(`no rows in "scenes" for ${date}`);

// Only the keys a scene type actually uses get carried through, so an unrelated
// stray cell in the sheet can't end up as a prop.
const build = (s) => {
  const base = {type: s.type, vo: s.vo};
  if (s.captions) base.captions = s.captions.toLowerCase() === 'true';
  switch (s.type) {
    case 'hook':
      return {...base, text: s.text, accent: s.accent || undefined, head: s.head || undefined};
    case 'rank':
      return {...base, to: num(s.to), total: num(s.total), caption: s.caption || undefined};
    case 'stat':
      return {...base, value: num(s.value), suffix: s.suffix || '%', label: s.label, source: s.source};
    case 'prompt':
      return {...base, title: s.title, lines: (s.lines || '').split('\n')};
    case 'test':
      return {...base, step: s.text, result: s.label || undefined, kicker: s.head || undefined};
    case 'cta':
      return {...base, text: s.text, sub: s.sub || undefined, keyword: s.keyword || undefined};
    default:
      throw new Error(`row ${s.order}: unknown scene type "${s.type}"`);
  }
};

const content = {
  id: date,
  title: meta.title,
  description: meta.description || '',
  hashtags: (meta.hashtags || '').split(/[ ,]+/).filter(Boolean),
  music: meta.music || null,
  caption: meta.caption || '',   // Instagram
  pinned: meta.pinned || '',     // YouTube pinned comment — where the link lives
  scenes: mine.map(build),
};

const missingSource = content.scenes.find((s) => s.type === 'stat' && !s.source);
if (missingSource) throw new Error(`a stat scene has no source — every number on screen needs one`);

writeFileSync(`content/${date}.json`, JSON.stringify(content, null, 2));
console.log(`content/${date}.json  (${content.scenes.length} scenes)`);
