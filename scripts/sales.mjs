// Which video sold? The question that decides what to make next.
//
//   node scripts/sales.mjs          # last 7 days
//   node scripts/sales.mjs 28
//
// Reads Gumroad sales for the $19 product and the free pack, groups the paid
// ones by the per-video offer code that build.mjs put in every pinned
// comment and description, and prints one line per code. Sends the same to
// Telegram when the bot is configured. Runs every Monday with geo.mjs, so
// the weekly message reads "US 62% · YT0828 → 3 sales" in one screen.
//
// Needs GUMROAD_TOKEN. Sales with no code came from the bio link, the free
// pack's emails, or a typed URL — real, just unattributed.
import {readFileSync} from 'node:fs';
import {productId, sales} from './lib/gumroad.mjs';
import {telegram} from './lib/telegram.mjs';

const days = Number(process.argv[2] || 7);
const links = JSON.parse(readFileSync('content/links.json', 'utf8'));
if (!process.env.GUMROAD_TOKEN) {
  console.error('GUMROAD_TOKEN is not set — see DEPLOY.md');
  process.exit(1);
}
const after = new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10);

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

const paidId = await productId(links.product);
const paid = await sales(paidId, after);
const byCode = {};
for (const s of paid) {
  const code = (s.offer_code || '—').toUpperCase();
  byCode[code] = byCode[code] || {n: 0, usd: 0};
  byCode[code].n++;
  byCode[code].usd += Number(s.price || 0) / 100;
}
say(`SALES — last ${days} days (since ${after})`);
say(`Hired by AI: ${paid.length} sale(s), $${paid.reduce((a, s) => a + Number(s.price || 0) / 100, 0).toFixed(2)}`);
for (const [code, v] of Object.entries(byCode).sort((a, b) => b[1].n - a[1].n)) {
  say(`  ${code.padEnd(8)} ${String(v.n).padStart(3)} sale(s)  $${v.usd.toFixed(2)}${code === '—' ? '   (no code: bio, email or typed)' : ''}`);
}

if (links.leadMagnet) {
  try {
    const free = await sales(await productId(links.leadMagnet), after);
    say(`Free pack: ${free.length} download(s)`);
  } catch (e) {
    say(`Free pack: could not read (${e.message})`);
  }
}

const tg = telegram();
if (tg) {
  await tg.text(out.join('\n'));
  console.log('\nsent to Telegram');
}
