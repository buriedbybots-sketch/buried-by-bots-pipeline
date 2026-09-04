// Where are the views coming from? The one number this whole design is
// falsifiable against.
//
//   node scripts/geo.mjs          # last 7 days
//   node scripts/geo.mjs 28       # last 28 days
//
// Reads the YouTube Analytics API (youtubeAnalytics.reports.query, dimension
// `country`) for the channel and for its most-viewed videos in the window,
// prints `US: NN%` for each, and sends the same report to Telegram when the
// bot is configured. Runs weekly from .github/workflows/geo.yml.
//
// Needs the same YT_* secrets as upload.mjs, and the refresh token must have
// been issued with https://www.googleapis.com/auth/yt-analytics.readonly on
// top of the upload and force-ssl scopes. Also needs "YouTube Analytics API"
// enabled on the Cloud project. Analytics data lags ~2 days; a video posted
// yesterday will not be in here yet.
import {accessToken, gapi} from './lib/google.mjs';
import {telegram} from './lib/telegram.mjs';

const days = Number(process.argv[2] || 7);
const iso = (d) => d.toISOString().slice(0, 10);
const end = new Date();
const start = new Date(end.getTime() - days * 86400e3);

const token = await accessToken();

const report = async (params) => {
  const q = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: iso(start),
    endDate: iso(end),
    metrics: 'views',
    sort: '-views',
    ...params,
  });
  const res = await gapi(token, `https://youtubeanalytics.googleapis.com/v2/reports?${q}`);
  return res.rows || [];
};

// country rows → "US 62% · IN 18% · GB 6%" plus the US share on its own
const summarise = (rows) => {
  const total = rows.reduce((a, [, v]) => a + v, 0);
  if (!total) return {line: 'no views in window', us: null, total: 0};
  const pct = (v) => Math.round((v / total) * 100);
  const us = pct(rows.find(([c]) => c === 'US')?.[1] || 0);
  const line = rows
    .slice(0, 5)
    .map(([c, v]) => `${c} ${pct(v)}%`)
    .join(' · ');
  return {line, us, total};
};

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

let channel;
try {
  channel = summarise(await report({dimensions: 'country', maxResults: '10'}));
} catch (e) {
  if (e.status === 403) {
    console.error(
      'Analytics API refused (403). The refresh token needs the yt-analytics.readonly scope and the ' +
        'YouTube Analytics API must be enabled on the Cloud project — see DEPLOY.md.\n' +
        e.message
    );
    process.exit(1);
  }
  throw e;
}

say(`GEO — last ${days} days (${iso(start)} → ${iso(end)}, data lags ~2 days)`);
say(`Channel: US ${channel.us ?? '—'}%   ${channel.total} views   ${channel.line}`);

const videos = await report({dimensions: 'video', maxResults: '10'});
if (videos.length) {
  // Titles are a nicety; videos.list needs a readonly/force-ssl scope, so
  // fall back to bare ids if the token can't.
  let titles = {};
  try {
    const ids = videos.map(([id]) => id).join(',');
    const res = await gapi(token, `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}`);
    titles = Object.fromEntries((res.items || []).map((v) => [v.id, v.snippet.title]));
  } catch {}

  say('');
  for (const [id, views] of videos) {
    const v = summarise(await report({dimensions: 'country', filters: `video==${id}`, maxResults: '5'}));
    const name = (titles[id] || id).slice(0, 48);
    say(`US ${String(v.us ?? '—').padStart(3)}%  ${String(views).padStart(5)} views  ${name}\n           ${v.line}`);
  }
}

const verdict =
  channel.us == null
    ? 'No data yet. Seed harder, and check again next week.'
    : channel.us >= 60
      ? 'On target. Keep the transcript vocabulary where it is.'
      : channel.us >= 35
        ? 'Drifting. Add a posting/comp/market scene to every video this week and seed only in US subs.'
        : 'WRONG CONTINENT. Stop posting until the next three scripts each name a US ATS, a $ figure and a US city in the first 10 seconds.';
say(`\n${verdict}`);

const tg = telegram();
if (tg) {
  await tg.text(out.join('\n'));
  console.log('\nsent to Telegram');
}
