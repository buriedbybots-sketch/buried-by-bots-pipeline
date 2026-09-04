// Fingerprint the demo-only prompts so the linter can refuse their text
// without the text ever being in the repo.
//
//   node scripts/protect.mjs "C:\path\to\Prompt Vault.txt"
//
// Reads the file, takes every 8-word run of it, hashes each one, and writes
// the hashes to content/protected.json. Commit that file: it is one-way, it
// reveals nothing, and it is what makes the Vault 1/2/3/26 rule hold in CI.
// Re-run whenever the prompts change. Paste only the four protected prompts
// into the file, or the whole vault — either works, the free five are
// allowed to appear in videos regardless because prompt scenes carry them
// by design, so pass a file with just 1, 2, 3 and 26 to avoid false hits.
import {readFileSync, writeFileSync} from 'node:fs';
import {shingles, digest, lint} from './lint.mjs';

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/protect.mjs <text file containing Vault prompts 1, 2, 3 and 26>');
  process.exit(2);
}
const text = readFileSync(src, 'utf8');

// Sanity: the file has to look like the four protected prompts and nothing
// else. Otherwise any text with enough words would satisfy the CI gate and
// nobody would know the wrong thing was fingerprinted.
const FREE = ['format cleaner', 'headline optimizer', 'likely-questions generator', 'referral ask', 'star story builder'];
const lower = text.toLowerCase();
const words = text.split(/\s+/).filter(Boolean).length;
const blocks = text.split(/\n\s*\n/).filter((b) => b.split(/\s+/).length >= 25).length;
const problems = [];
if (words < 200 || words > 4000) problems.push(`${words} words — four prompts should be roughly 300 to 2,000`);
if (blocks < 4) problems.push(`only ${blocks} paragraph(s) of 25+ words — expected at least four prompts`);
for (const f of FREE) if (lower.includes(f)) problems.push(`contains the free prompt "${f}" — only Vault 1, 2, 3 and 26 belong in this file`);
if (problems.length) {
  for (const p of problems) console.error(`  ✖ ${p}`);
  process.exit(1);
}
const hashes = [...shingles(text)].map(digest);

// Self-test: the approved sample video (free prompt 5) must not trip it.
const sample = JSON.parse(readFileSync('content/sample.json', 'utf8'));
const hit = lint(sample, {protectedHashes: hashes}).errors.find((e) => /Vault 1\/2\/3\/26 prompt text/.test(e));
if (hit) {
  console.error(`  ✖ the fingerprints match the approved sample video: ${hit}\n    The file contains text that is also in the free prompts. Paste only 1, 2, 3 and 26.`);
  process.exit(1);
}
writeFileSync('content/protected.json', JSON.stringify({made: new Date().toISOString().slice(0, 10), hashes}, null, 0) + '\n');
console.log(`content/protected.json  ${hashes.length} fingerprints. Commit it.`);
