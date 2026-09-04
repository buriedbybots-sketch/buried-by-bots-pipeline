// The vocabulary and rules linter. Every word the voice says and every word a
// frame shows is a targeting decision, and this is the one place they are
// checked. sheet.mjs runs it on the way in, build.mjs runs it before spending
// three minutes on a render, and you can run it by hand:
//
//   node scripts/lint.mjs content/sample.json
//
// Errors fail the build. Warnings print loudly and let it through.
import {existsSync, readFileSync} from 'node:fs';

// --- wrong-audience tells. One of these in the transcript and the video is
// classified for the wrong continent. Hard fail, no exceptions.
export const DENY = [
  'CV',
  'CVs',
  'fresher',
  'freshers',
  'notice period',
  'CTC',
  'lakh',
  'lakhs',
  'crore',
  'crores',
  'placement',
  'placements',
  'aptitude round',
  'aptitude test',
  'HR round',
  'tier-1 college',
  'tier 1 college',
  'campus drive',
];

// --- identity the operator does not have. Speaking American English is
// translation; claiming to be American, a recruiter, or a FAANG hire is fraud.
export const IDENTITY = [
  /\bas a recruiter\b/i,
  /\bi(?:'m| am) an? (?:recruiter|hiring manager|american|us citizen)\b/i,
  /\bi (?:got|landed|accepted|took|signed) (?:an?|my|the) (?:\w+ )?offer\b/i,
  /\bwhen i (?:got|was) hired\b/i,
  /\bmy (?:faang|google|meta|amazon|apple|netflix|microsoft|openai) offer\b/i,
  /\bhere in the (?:us|states|bay area|valley)\b/i,
  /\bwe (?:hire|hired|reject|rejected) (?:you|people|candidates)\b/i,
];

// --- what "US tech job seeker" sounds like. Zero of these across a video's
// transcript is a loud warning, not a failure — some videos are about the
// process, not the products — but it should never happen by accident.
export const US_SIGNAL = [
  'workday', 'greenhouse', 'lever', 'taleo', 'icims', 'ashby',
  'linkedin', 'indeed', 'levels.fyi', 'blind', 'hiring cafe',
  'software engineer', 'swe', 'backend', 'front-end', 'frontend', 'full stack', 'full-stack',
  'data engineer', 'data scientist', 'product manager', 'new grad', 'l4', 'l5', 'l6', 'ic5', 'senior', 'staff engineer',
  'total comp', 'rsu', 'rsus', 'equity refresh', 'sign-on', 'signing bonus', 'base salary',
  'recruiter', 'recruiter screen', 'hiring manager', 'onsite', 'take-home', 'system design', 'behavioral',
  'layoffs', 'laid off', 'rto', 'hiring freeze', 'ghost job', 'ghost jobs', 'req',
  'resume', 'resumes', 'ats', 'applicant tracking', 'faang',
];

// A frame that names a US company, city, $ figure or ATS product. The artifact
// scenes do this by construction; anything else has to earn it in its text.
const US_VISUAL_TYPES = new Set(['posting', 'rejection', 'comp', 'market']);
const US_VISUAL =
  /\$\s?\d|\b(?:San Francisco|New York|NYC|Seattle|Austin|Denver|Boston|Chicago|Bay Area|Remote \(US\)|Workday|Greenhouse|Lever|Taleo|iCIMS|Ashby|levels\.fyi|LinkedIn|Indeed)\b|, (?:CA|NY|WA|TX|MA|CO|IL|GA|NC)\b/;

// Vault Prompts 1, 2, 3 and 26 are demo-only: show the output (terminal
// scene), never the prompt text. A `prompt` scene titled after one of them is
// refused outright. If content/protected.txt exists (gitignored — it is the
// product) its text is fingerprinted and any 8-word run of it, on screen or
// spoken, is refused too.
const PROTECTED_TITLE = /\bprompt\s*#?\s*(?:0?1|0?2|0?3|26)\b(?![\d.])/i;

// What each scene type has to carry to render at all, plus which ones show a
// number and therefore need a source chip.
export const REQUIRED = {
  hook: ['text'],
  rank: ['to', 'total'],
  stat: ['value', 'label', 'source'],
  prompt: ['title', 'lines'],
  test: ['step'],
  cta: ['text'],
  posting: ['title', 'location', 'lines'],
  rejection: [],
  market: ['lines', 'source'],
  comp: ['title', 'lines', 'source'],
  terminal: ['lines'],
};

const ON_SCREEN = [
  'text', 'accent', 'head', 'caption', 'label', 'source', 'title', 'sub', 'keyword',
  'step', 'result', 'kicker', 'company', 'location', 'pay', 'time',
];

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const words8 = (s) =>
  norm(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean);

const shingles = (text) => {
  const w = words8(text);
  const out = new Set();
  for (let i = 0; i + 8 <= w.length; i++) out.add(w.slice(i, i + 8).join(' '));
  return out;
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (term, flags = 'i') => new RegExp(`(?<![\\w$])${escapeRe(term)}(?![\\w])`, flags);

const screenText = (scene) =>
  ON_SCREEN.map((k) => scene[k])
    .concat([(scene.lines || []).join('\n')])
    .filter(Boolean)
    .join('\n');

export const lint = (content, {protectedText} = {}) => {
  const errors = [];
  const warnings = [];
  const scenes = content.scenes || [];

  // ---- per-scene structure
  scenes.forEach((s, i) => {
    const tag = `scene ${i + 1} (${s.type})`;
    if (!REQUIRED[s.type]) return errors.push(`${tag}: unknown scene type`);
    if (!norm(s.vo)) errors.push(`${tag}: no vo line — the voice sets the timing, every scene needs one`);
    for (const k of REQUIRED[s.type]) {
      const v = s[k];
      const empty = v == null || v === '' || (Array.isArray(v) && !v.join('').trim()) || Number.isNaN(v);
      if (empty) errors.push(`${tag}: "${k}" is required`);
    }
    if (s.type === 'posting' && s.pay && !s.source) {
      errors.push(`${tag}: shows a pay band but has no source — no number on screen without one`);
    }
    if (s.type === 'prompt' && PROTECTED_TITLE.test(s.title || '')) {
      errors.push(`${tag}: "${s.title}" — Vault 1/2/3/26 are demo-only. Use a terminal scene and show the output.`);
    }
    if (s.type === 'terminal' && (s.lines || []).join('\n').length > 620) {
      warnings.push(`${tag}: output is over 620 characters and will run off the card — trim it`);
    }
    if ((s.type === 'market' || s.type === 'comp') && (s.lines || []).some((l) => l.trim() && !l.includes('|'))) {
      errors.push(`${tag}: every line must be "Label|value"`);
    }
  });
  if (scenes.length && scenes[0].type !== 'hook') warnings.push(`scene 1 is a ${scenes[0].type}, not a hook`);

  // ---- vocabulary: spoken and on-screen, plus the copy that ships with it
  const spoken = scenes.map((s) => s.vo || '').join('\n');
  const shown = scenes.map(screenText).join('\n');
  const copy = [content.title, content.description, content.caption, content.pinned, content.seed]
    .filter(Boolean)
    .join('\n');
  const everything = [spoken, shown, copy].join('\n');

  for (const term of DENY) {
    const re = term === term.toUpperCase() && term.length <= 4 ? wordRe(term, '') : wordRe(term);
    const hit = everything.match(re);
    if (hit) {
      const where = spoken.match(re) ? 'spoken' : shown.match(re) ? 'on screen' : 'in the post copy';
      errors.push(`wrong-audience word "${hit[0]}" ${where} — say it the American way (CV → resume, fresher → new grad)`);
    }
  }
  for (const re of IDENTITY) {
    const hit = everything.match(re);
    if (hit) errors.push(`identity claim "${hit[0]}" — the operator is the person who tested the tools, not a recruiter or a hire`);
  }

  const signals = US_SIGNAL.filter((t) => wordRe(t).test(spoken));
  if (/\$\s?\d+k?\b/i.test(spoken)) signals.push('$ figure');
  if (!signals.length) {
    warnings.push(
      'the transcript has ZERO US-tech tokens. ASR classifies topic from the voice — name an ATS, a job board, a role, a $ figure or a US process word in at least one vo line'
    );
  }
  const visual = scenes.some((s) => US_VISUAL_TYPES.has(s.type) || US_VISUAL.test(screenText(s)));
  if (!visual) {
    warnings.push('no frame names a US company, city, $ figure or ATS product — add a posting/rejection/comp/market scene or put one in a title');
  }

  // ---- protected prompt text, if the fingerprint file exists
  if (protectedText) {
    const bad = shingles(protectedText);
    const check = (label, text) => {
      for (const sh of shingles(text)) {
        if (bad.has(sh)) return errors.push(`${label} contains Vault 1/2/3/26 prompt text ("${sh}…") — demo-only, show the output instead`);
      }
    };
    scenes.forEach((s, i) => {
      check(`scene ${i + 1} vo`, s.vo);
      check(`scene ${i + 1} screen text`, screenText(s));
    });
  }

  // ---- post copy
  if ((content.title || '').length > 100) errors.push(`title is ${content.title.length} chars; YouTube caps at 100`);
  const tags = content.hashtags || [];
  if (tags.length < 3 || tags.length > 5) warnings.push(`${tags.length} hashtags — keep it at 3 to 5`);
  if (content.seed) {
    if (/https?:\/\/|\.com\b|\.fyi\b|gumroad/i.test(content.seed)) errors.push('seed comment contains a link — Reddit-safe means no link, ever');
    const sentences = norm(content.seed).split(/[.!?]+(?:\s|$)/).filter((x) => x.trim()).length;
    if (sentences > 2 || content.seed.length > 400) warnings.push(`seed comment is ${sentences} sentences / ${content.seed.length} chars — two short sentences is the format`);
  } else {
    warnings.push('no seed comment — the seeding pack will ship without one, and the first hour is the whole game');
  }
  const comms = content.communities || [];
  if (comms.length !== 3) warnings.push(`${comms.length} communities named — the seeding pack wants exactly 3`);

  return {errors, warnings, signals};
};

export const protectedText = () => (existsSync('content/protected.txt') ? readFileSync('content/protected.txt', 'utf8') : null);

// Print the report; throw if it failed.
export const enforce = (content) => {
  const {errors, warnings, signals} = lint(content, {protectedText: protectedText()});
  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  for (const e of errors) console.error(`  ✖ ${e}`);
  if (signals.length) console.log(`  US signals in transcript: ${signals.join(', ')}`);
  if (errors.length) throw new Error(`lint: ${errors.length} error(s) in ${content.id} — fix the sheet row`);
  return {errors, warnings};
};

if (process.argv[1] && /lint\.mjs$/.test(process.argv[1])) {
  const path = process.argv[2];
  if (!path) {
    console.error('usage: node scripts/lint.mjs content/<id>.json');
    process.exit(2);
  }
  try {
    const {warnings} = enforce(JSON.parse(readFileSync(path, 'utf8')));
    console.log(warnings.length ? `\n${path}: passed with ${warnings.length} warning(s)` : `\n${path}: clean`);
  } catch (e) {
    console.error(`\n${e.message}`);
    process.exit(1);
  }
}
