// Fingerprint the demo-only prompts so the linter can refuse their text
// without the text ever being in the repo.
//
//   node scripts/protect.mjs "C:\path\to\Prompt Vault.txt"
//
// Reads the file, takes every 8-word run of it, hashes each one, and writes
// the hashes to content/protected.json. Commit that file: it is one-way, it
// reveals nothing, and it is what makes the Vault 1/2/3 + 26-30 rule hold in CI.
// Re-run whenever the prompts change. Paste only the eight protected prompts
// into the file (1, 2, 3, 26, 27, 28, 29, 30). The giveaway prompts 4-25 are
// shown in videos by design, so they must NOT be fingerprinted or every
// scheduled Short would fail the linter.
import {readFileSync, writeFileSync} from 'node:fs';
import {shingles, digest, lint} from './lint.mjs';

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/protect.mjs <text file containing Vault prompts 1, 2, 3 and 26-30>');
  process.exit(2);
}
const text = readFileSync(src, 'utf8');

// Sanity: the file has to look like the eight protected prompts and nothing
// else. Otherwise any text with enough words would satisfy the CI gate and
// nobody would know the wrong thing was fingerprinted.
const GIVEAWAY = ['format cleaner', 'headline optimizer', 'likely-questions generator', 'referral ask', 'star story builder'];
const lower = text.toLowerCase();
const words = text.split(/\s+/).filter(Boolean).length;
const blocks = text.split(/\n\s*\n/).filter((b) => b.split(/\s+/).length >= 25).length;
const problems = [];
if (words < 500 || words > 5000) problems.push(`${words} words — eight prompts should be roughly 800 to 3,000`);
if (blocks < 8) problems.push(`only ${blocks} paragraph(s) of 25+ words — expected at least eight prompts`);
for (const f of GIVEAWAY) if (lower.includes(f)) problems.push(`contains the free prompt "${f}" — prompts 4-25 are given away in videos and must not be fingerprinted`);
if (problems.length) {
  for (const p of problems) console.error(`  ✖ ${p}`);
  process.exit(1);
}
const hashes = [...shingles(text)].map(digest);

// Self-test: the approved sample video (free prompt 5) must not trip it.
const sample = JSON.parse(readFileSync('content/sample.json', 'utf8'));
const hit = lint(sample, {protectedHashes: hashes}).errors.find((e) => /Vault 1\/2\/3\/26 prompt text/.test(e));
if (hit) {
  console.error(`  ✖ the fingerprints match the approved sample video: ${hit}\n    The file contains text that is also in a giveaway prompt. Paste only 1, 2, 3 and 26-30.`);
  process.exit(1);
}
writeFileSync('content/protected.json', JSON.stringify({made: new Date().toISOString().slice(0, 10), hashes}, null, 0) + '\n');
console.log(`content/protected.json  ${hashes.length} fingerprints. Commit it.`);
