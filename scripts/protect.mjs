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
import {shingles, digest} from './lint.mjs';

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/protect.mjs <text file containing Vault prompts 1, 2, 3 and 26>');
  process.exit(2);
}
const text = readFileSync(src, 'utf8');
const hashes = [...shingles(text)].map(digest);
if (hashes.length < 20) {
  console.error(`only ${hashes.length} shingles — is that the right file? It should hold four full prompts.`);
  process.exit(1);
}
writeFileSync('content/protected.json', JSON.stringify({made: new Date().toISOString().slice(0, 10), hashes}, null, 0) + '\n');
console.log(`content/protected.json  ${hashes.length} fingerprints. Commit it.`);
