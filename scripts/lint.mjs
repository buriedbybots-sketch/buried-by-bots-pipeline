// The vocabulary and rules linter. Every word the voice says and every word a
// frame shows is a targeting decision, and this is the one place they are
// checked. sheet.mjs runs it on the way in, build.mjs runs it before spending
// three minutes on a render, and you can run it by hand:
//
//   node scripts/lint.mjs content/sample.json
//
// Errors fail the build. Warnings print loudly and let it through.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';

// --- wrong-audience tells. One of these in the transcript and the video is
// classified for the wrong continent. Hard fail, no exceptions. Includes the
// vocabulary of Indian campus hiring, the job boards and the employers that
// only mean something there, and the British spellings an Indian writer
// reaches for by default.
export const DENY = [
  // Indian-English job vocabulary
  'CV', 'CVs', 'fresher', 'freshers', 'notice period', 'CTC', 'LPA', 'lakh', 'lakhs', 'crore', 'crores',
  'placement', 'placements', 'campus placement', 'campus drive', 'on-campus', 'off-campus', 'aptitude round',
  'aptitude test', 'HR round', 'technical round', 'tier-1 college', 'tier 1 college', 'tier-2', 'tier-3',
  'PPO', 'passout', 'pass-out', 'pass out', 'B.Tech', 'BTech', 'M.Tech', 'MTech', 'BE/B.Tech', 'MCA', 'BCA',
  'joining date', 'date of joining', 'service-based', 'product-based', 'service based', 'product based',
  'bond period', 'salary package', 'package of', 'revert back', 'do the needful', 'kindly', 'prepone',
  'mass recruiter', 'referral drive',
  // job boards and employers that only signal India
  'Naukri', 'Internshala', 'AmbitionBox', 'TCS', 'Infosys', 'Wipro', 'Cognizant', 'HCL', 'Tech Mahindra',
  'Capgemini', 'Zoho',
  // British spellings
  'organisation', 'organisations', 'organise', 'organised', 'optimise', 'optimised', 'optimising', 'optimisation',
  'specialise', 'specialised', 'realise', 'realised', 'recognise', 'recognised', 'prioritise', 'prioritised',
  'summarise', 'customise', 'customised', 'analyse', 'analysed', 'behaviour', 'behavioural', 'colour', 'favourite',
  'honour', 'labour', 'programme', 'centre', 'licence', 'defence', 'catalogue', 'learnt', 'whilst', 'amongst',
];

// --- identity the operator does not have. Speaking American English is
// translation; claiming to be American, a recruiter, an insider or a hire is
// fraud. Written to catch the natural phrasings, not just the formal ones.
const BIG = '(?:google|meta|facebook|amazon|apple|microsoft|netflix|openai|nvidia|stripe|uber|airbnb|faang|a faang|big tech)';
export const IDENTITY = [
  /\bas an? (?:recruiter|hiring manager|engineering manager|sourcer|talent partner)\b/i,
  /\bi(?:'m| am| was|'ve been| have been) (?:an? |the )?(?:recruiter|hiring manager|sourcer|american|us citizen|engineer at)\b/i,
  /\bi (?:have |'ve )?(?:hired|interviewed|screened|rejected|reviewed|read) (?:\w+ ){0,3}(?:candidates|engineers|resumes|applicants|people)\b/i,
  /\bi (?:got|landed|took|accepted|signed|received) (?:the|an?|my) (?:\w+ )?(?:job|role|position|offer)\b/i,
  /\bi (?:work|worked|am working|joined|interned) (?:at|for) /i,
  /\bwhen i (?:got|was|joined|started) (?:hired|at|there|recruiting)\b/i,
  new RegExp(`\\bmy (?:\\w+ )?(?:offer|job|team|manager|desk|badge) at ${BIG}\\b`, 'i'),
  new RegExp(`\\b(?:at|from|inside) ${BIG}\\b,? (?:we|i|our)\\b`, 'i'),
  /\b(?:after|with) (?:\w+ |\d+ )?years? (?:in|of|as a) (?:tech )?(?:recruit|hiring|sourcing)/i,
  /\b(?:we|our team|my team) (?:hire|hired|reject|rejected|screen|screened|interview|interviewed) /i,
  /\bhere in the (?:us|states|bay area|valley|city)\b/i,
];

// --- what "US tech job seeker" sounds like. Two tiers. STRONG tokens are
// geography: a US product, board, city, level, comp term or a $ figure —
// things nobody outside the US says. TOPIC tokens are just the subject and
// are shared with every country's job seekers, so they count for nothing
// on their own. A transcript with zero STRONG tokens warns, loudly.
export const US_STRONG = [
  'workday', 'greenhouse', 'lever', 'taleo', 'icims', 'ashby', 'linkedin', 'indeed', 'levels.fyi', 'blind app',
  'hiring cafe', 'glassdoor', 'faang', 'us tech', 'us job', 'us jobs', 'in the us', 'united states', 'american',
  'silicon valley', 'bay area', 'san francisco', 'new york', 'nyc', 'seattle', 'austin', 'denver', 'boston',
  'chicago', 'remote in the us', 'us remote', 'h-1b', 'h1b', 'l3', 'l4', 'l5', 'l6', 'e4', 'e5', 'ic4', 'ic5',
  'new grad', 'total comp', 'rsu', 'rsus', 'equity refresh', 'sign-on', 'signing bonus', 'base salary', '401k',
  'layoffs', 'laid off', 'rto', 'hiring freeze', 'ghost job', 'ghost jobs',
];
export const US_TOPIC = [
  'software engineer', 'swe', 'backend', 'frontend', 'full stack', 'data engineer', 'data scientist',
  'product manager', 'senior', 'staff engineer', 'recruiter', 'recruiter screen', 'hiring manager', 'onsite',
  'take-home', 'system design', 'behavioral', 'resume', 'resumes', 'ats', 'applicant tracking', 'req',
];

// Vault Prompts 1, 2, 3 and 26 are demo-only: show the output (terminal
// scene), never the prompt text. Two guards. A `prompt` scene titled after
// one of them is refused outright. And content/protected.json — hashed
// 8-word shingles of the actual prompt text, made once with
// scripts/protect.mjs, safe to commit because the hashes are one-way —
// refuses any run of that text, spoken or on screen, in any scene type.
// In CI the fingerprint file is mandatory: without it the hardest content
// rule is unenforced exactly where publishing happens.
const PROTECTED_TITLE = /\bprompt\s*#?\s*(?:0?1|0?2|0?3|26)\b(?![\d.])/i;
const PROTECTED_FILE = 'content/protected.json';

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

const US_VISUAL_TYPES = new Set(['posting', 'rejection', 'comp', 'market']);

const ON_SCREEN = [
  'text', 'accent', 'head', 'caption', 'label', 'source', 'title', 'sub', 'keyword',
  'step', 'result', 'kicker', 'company', 'location', 'pay', 'time',
];

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const wordsOf = (s) =>
  norm(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean);

export const shingles = (text) => {
  const w = wordsOf(text);
  const out = new Set();
  for (let i = 0; i + 8 <= w.length; i++) out.add(w.slice(i, i + 8).join(' '));
  return out;
};
export const digest = (s) => createHash('sha256').update(s).digest('hex').slice(0, 24);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (term, flags = 'i') => new RegExp(`(?<![\\w$])${escapeRe(term)}(?![\\w])`, flags);
// short all-caps terms (CV, CTC, LPA, PPO, TCS, HCL, MCA…) match case-sensitively,
// everything else case-insensitively
const denyRe = (term) => (term === term.toUpperCase() && term.length <= 4 ? wordRe(term, '') : wordRe(term));

const screenText = (scene) =>
  ON_SCREEN.map((k) => scene[k])
    .concat([(scene.lines || []).join('\n')])
    .filter(Boolean)
    .join('\n');

export const lint = (content, {protectedHashes, ci = false} = {}) => {
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
  // The hook guard in build.mjs measures scene 1. It has to be the hook.
  if (scenes.length && scenes[0].type !== 'hook') errors.push(`scene 1 is a ${scenes[0].type} — every video opens on a hook`);

  // ---- vocabulary: spoken and on-screen, plus the copy that ships with it
  const spoken = scenes.map((s) => s.vo || '').join('\n');
  const shown = scenes.map(screenText).join('\n');
  const copy = [content.title, content.description, content.caption, content.pinned, content.seed]
    .filter(Boolean)
    .join('\n');
  const everything = [spoken, shown, copy].join('\n');

  for (const term of DENY) {
    const re = denyRe(term);
    const hit = everything.match(re);
    if (hit) {
      const where = spoken.match(re) ? 'spoken' : shown.match(re) ? 'on screen' : 'in the post copy';
      errors.push(`wrong-audience word "${hit[0]}" ${where} — say it the American way (CV → resume, fresher → new grad, optimise → optimize)`);
    }
  }
  for (const re of IDENTITY) {
    const hit = everything.match(re);
    if (hit) errors.push(`identity claim "${hit[0].trim()}" — the operator is the person who tested the tools, not a recruiter, an insider or a hire`);
  }

  const strong = US_STRONG.filter((t) => wordRe(t).test(spoken));
  if (/\$\s?\d[\d,]*k?\b/i.test(spoken) || /\b\d{2,3}k\b/i.test(spoken)) strong.push('$ figure');
  const topic = US_TOPIC.filter((t) => wordRe(t).test(spoken));
  if (!strong.length) {
    warnings.push(
      'the transcript has ZERO geography signals. Topic words (' +
        (topic.join(', ') || 'none') +
        ') are shared with every country; name a US ATS, job board, city, level, comp term or $ figure in a vo line'
    );
  }
  if (!scenes.some((s) => US_VISUAL_TYPES.has(s.type))) {
    warnings.push('no artifact scene (posting/rejection/comp/market) — no frame shows a piece of US software');
  }

  // ---- protected prompt text
  if (protectedHashes) {
    const bad = new Set(protectedHashes);
    const check = (label, text) => {
      for (const sh of shingles(text)) {
        if (bad.has(digest(sh))) return errors.push(`${label} contains Vault 1/2/3/26 prompt text ("${sh}…") — demo-only, show the output instead`);
      }
    };
    scenes.forEach((s, i) => {
      check(`scene ${i + 1} vo`, s.vo);
      check(`scene ${i + 1} screen text`, screenText(s));
    });
    check('post copy', copy);
  } else {
    (ci ? errors : warnings).push(
      `${PROTECTED_FILE} is missing — Vault 1/2/3/26 text is unguarded. Run: node scripts/protect.mjs <file with the four prompts>`
    );
  }

  // ---- the conversion path. A video with no keyword CTA and no link in the
  // pinned comment can be seen by exactly the right people and still sell
  // nothing. Every video carries the whole path or it does not build.
  const cta = scenes.find((s) => s.type === 'cta');
  if (!cta) errors.push('no cta scene — every video ends on the keyword CTA, or the view is wasted');
  else if (!cta.keyword) errors.push('the cta scene has no keyword — "link in bio" is four taps, a comment is one');
  if (!/\[LEAD MAGNET LINK\]|https?:\/\//.test(content.pinned || '')) {
    errors.push('the pinned comment has no link — put [LEAD MAGNET LINK] in the pinned cell; that comment is where the click happens');
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

  return {errors, warnings, signals: strong, topic};
};

export const protectedHashes = () => (existsSync(PROTECTED_FILE) ? JSON.parse(readFileSync(PROTECTED_FILE, 'utf8')).hashes : null);

// Print the report; throw if it failed.
export const enforce = (content) => {
  const {errors, warnings, signals} = lint(content, {protectedHashes: protectedHashes(), ci: Boolean(process.env.CI)});
  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  for (const e of errors) console.error(`  ✖ ${e}`);
  if (signals.length) console.log(`  geography signals: ${signals.join(', ')}`);
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
