// Which video sold? The question that decides what to make next.
//
//   node scripts/sales.mjs          # last 7 days
//   node scripts/sales.mjs 28
//
// Per-video attribution comes from the usage count on each video's Gumroad
// code (build.mjs mints YT0828 etc. and puts it in the product URL). That
// count is cumulative, so the report shows lifetime uses per code plus the
// window's sale total; sales are grouped by code as well when the API
// happens to say which code a sale used. Sends the same to Telegram when the
// bot is configured. Runs every Monday with geo.mjs.
//
// Needs GUMROAD_TOKEN; without it the report is skipped, not failed.
import {readFileSync} from 'node:fs';
import {codes, productId, sales} from './lib/gumroad.mjs';
import {telegram} from './lib/telegram.mjs';

const days = Number(process.argv[2] || 7);
const links = JSON.parse(readFileSync('content/links.json', 'utf8'));
if (!process.env.GUMROAD_TOKEN) {
  console.log('GUMROAD_TOKEN not set — skipping the sales report (see DEPLOY.md).');
  process.exit(0);
}
const after = new Date(Date.now() - days * 86400e3).toISOString().slice(0, 10);

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};
const usd = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

const paidId = await productId(links.product);
const paid = await sales(paidId, after);
say(`SALES — last ${days} days (since ${after})`);
say(`Hired by AI: ${paid.length} sale(s), ${usd(paid.reduce((a, s) => a + Number(s.price || 0), 0))}`);

// Per-video codes, lifetime uses. The number that says which video sold.
const perVideo = (await codes(paidId)).filter((c) => /^YT\d{4}$/.test(c.name) || c.name.startsWith('YT'));
if (perVideo.length) {
  say('By video code (lifetime uses):');
  for (const c of perVideo.sort((a, b) => (b.used ?? 0) - (a.used ?? 0))) {
    say(`  ${c.name.padEnd(8)} ${c.used == null ? '(no usage count from the API)' : `${String(c.used).padStart(3)} use(s)`}`);
  }
} else {
  say('No per-video codes on the product yet — build.mjs creates them once GUMROAD_TOKEN is set.');
}

// Grouped by code from the sales themselves, only if the API reported one.
const attributed = paid.filter((s) => s.code);
if (attributed.length) {
  const byCode = {};
  for (const s of attributed) byCode[s.code] = (byCode[s.code] || 0) + 1;
  say(`This window, by code: ${Object.entries(byCode).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
} else if (paid.length) {
  say('(sales in this window carry no code field — attribution is from the usage counts above)');
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
