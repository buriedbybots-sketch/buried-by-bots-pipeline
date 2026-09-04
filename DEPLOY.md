# Deploying the pipeline

Everything in this repo runs locally already. This file is the remaining work: getting it onto GitHub Actions so it runs daily without your PC being on.

---

## First, the rule about credentials

**Do not paste tokens, refresh tokens, client secrets, or API keys into chat — to Claude or anyone else.** A credential that appears in a chat log is a credential you have to rotate.

You don't need to. The pipeline reads its secrets from **GitHub Secrets**, which only you can write and only the runner can read. That gives you exactly what you wanted — a pipeline that posts on its own, unattended — while nobody but GitHub and Google ever sees the token. Every step below where a secret is involved is a step you do yourself.

---

## 1. Put the repo on GitHub

The code is already committed locally. Create an **empty private repo** at [github.com/new](https://github.com/new) — no README, no .gitignore, it would conflict — then:

```bash
git remote add origin https://github.com/<your-username>/buried-by-bots-pipeline.git
git branch -M main
git push -u origin main
```

Git for Windows ships with Credential Manager, so the push opens a browser window for you to sign in. Nothing to copy or paste.

**Keep it private.** The repo holds your content calendar and channel strategy. Actions minutes are free on private repos too (2,000/month; a Short costs about 3).

---

## 2. The Google Sheet

Import `sheet/videos.csv` and `sheet/scenes.csv` as two tabs named exactly `videos` and `scenes`. They're pre-filled with the sample video as a worked example — one row per video in `videos`, one row per scene in `scenes`, joined on `date`.

Then **File → Share → Publish to web**. Copy the sheet id out of its URL (the long string between `/d/` and `/edit`).

Publishing makes it publicly readable, which is what lets the pipeline read it with no API key and no service account. Scripts and captions aren't secret. **Don't put anything private in that sheet.**

---

## 3. Telegram bot, for phone delivery

1. Open Telegram, message **@BotFather**, send `/newbot`, follow the prompts. It gives you a token that looks like `1234567890:AAF...`.
2. Send your new bot any message (it can't message you first).
3. Open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser and find `"chat":{"id":123456789`. That number is your chat id.

The bot sends the mp4 as a **document**, not a video, so Telegram doesn't re-encode it — you get the exact 1080x1920 file the renderer produced. Save it to your gallery, then post the Reel from there.

---

## 4. YouTube API access

In [Google Cloud Console](https://console.cloud.google.com): new project → enable **YouTube Data API v3** → **OAuth client ID** (type: Desktop app) → on the consent screen add **both** of these scopes, then add your channel's Google account as a test user:

```
https://www.googleapis.com/auth/youtube.upload           ← uploads the video
https://www.googleapis.com/auth/youtube.force-ssl        ← posts the pinned comment
https://www.googleapis.com/auth/yt-analytics.readonly    ← reads viewer geography (geo.mjs)
```

And enable **two** APIs on the project, not one: **YouTube Data API v3** and **YouTube Analytics API**. The second one is what answers "what percentage of my views are from the US" — the number this whole channel is judged against.

**All three, not just the first.** With `youtube.upload` alone the upload works but the comment carrying your lead-magnet link 403s, and Shorts viewers open the comments far more often than the bio. If you already issued a refresh token with only the upload scope, reissue it — adding a scope to the consent screen does not upgrade a token that already exists.

One thing no scope can do: **pin** the comment. The Data API has no pin endpoint, it's Studio-only. The pipeline posts the comment; you tap pin once, in the same visit where you flip the video public.

Run the consent flow once on your machine to get a refresh token. You'll end up with three values: client id, client secret, refresh token.

### ⚠️ Uploads will land as private, and that is not a bug

An unaudited Google Cloud project is only permitted to upload **private** videos through the API. This is Google's rule and it applies to every new project.

Two ways forward:

- **Flip each video public in YouTube Studio.** Takes about 20 seconds a day. This is the recommended path — start here.
- **Request API audit.** Removes the restriction, but it's a review process with a wait, and you want the format proven before you care.

The workflow has a `privacy` input, so once an audit clears you set it to `public` and nothing else changes.

---

## 5. Add the secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**. Eight of them:

| Secret | Where it came from |
|---|---|
| `SHEET_ID` | Step 2 — the id from the sheet URL |
| `YT_CLIENT_ID` | Step 4 |
| `YT_CLIENT_SECRET` | Step 4 |
| `YT_REFRESH_TOKEN` | Step 4 — issued with all three scopes |
| `TG_BOT_TOKEN` | Step 3 — from BotFather |
| `TG_CHAT_ID` | Step 3 — from getUpdates |
| `PIXABAY_KEY` | Optional — a free key from pixabay.com/api/docs, for the stock backdrops |
| `GUMROAD_TOKEN` | Gumroad → Settings → Advanced → Applications → create one → **Generate access token**. Lets each video mint its own 10% code and lets `sales.mjs` read sales back by code. Without it, sales are real but unattributable. |

The Telegram pair is optional. Leave them out and the run still renders and uploads; it just skips phone delivery (and the seeding pack, and the weekly geography report) and says so. `PIXABAY_KEY` is optional too: without it, scenes that name a photo render without the backdrop.

**Never paste any of these into a chat.** A key that has been in a chat log is a key to rotate.

---

## 6. Test before the cron owns it

Actions tab → **daily short** → **Run workflow** → date `sample`, privacy `private`.

That runs the whole chain against the worked example already in the sheet. What should happen: the sheet is read, the video renders, YouTube gets a private upload, and the mp4 plus cover plus Instagram caption arrive on your phone.

If the upload step fails, the mp4 is still saved as a workflow artifact and still sent to Telegram — that fallback is deliberate.

**Only after that passes should you rely on the 13:00 UTC cron.** It's already enabled in the workflow file; the schedule fires whether or not you've tested, so run the manual test today.

---

## What runs, and when

```
13:00 UTC  (18:30 IST / 9:00 AM ET)   cron fires
                                       sheet.mjs   -> content/<date>.json
                                       build.mjs   -> out/<date>.mp4 + cover + post.txt
                                       upload.mjs  -> YouTube (private)
                                       deliver.mjs -> your phone
~18:35 IST                             flip the video public in Studio (20 seconds), pin the comment
~18:40 IST                             SEED: post the two-sentence comment from the Telegram pack in the three
                                       named communities, from the personal Reddit account. No link. First hour.
20:00-20:30 IST (10:30-11:00 AM ET)    post the Reel to Instagram by hand

Monday 14:00 UTC                       geo.yml → "US: NN%" per video, then "YT0828 → 3 sales" per video, to Telegram
```

The seeding step is the highest-leverage thing on this list. Who sees the first ~50 views decides who the algorithm shows the next 5,000 to, and the pipeline cannot choose them — you can.

GitHub delays scheduled runs under load, so treat 13:00 UTC as "sometime in the next hour" rather than a broadcast slot.

---

## Two things to do once, before the first upload

1. ~~Fingerprint the protected prompts.~~ **Done 2026-09-04** — `content/protected.json` is committed (729 one-way hashes of Vault 1, 2, 3 and 26; no text). Re-run `node scripts/protect.mjs <file with only those four prompts>` if the prompts ever change. The linter refuses any 8-word run of them in any scene, spoken or on screen, and CI fails if the file goes missing.
2. **Create the `GUMROAD_TOKEN` secret** so every video gets its own discount code. This is the only way the pipeline can ever tell you which video sold. Then run `node scripts/sales.mjs` once locally with the token and read the raw output: the API is not documented to say which code a sale used, so attribution rests on each code's usage count. If that count is missing too, say so in the campaign log and fall back to Gumroad's own dashboard per code.

## The number that decides whether any of this is working

`node scripts/geo.mjs` (or the Monday workflow) prints the US share of views for the channel and for each recent video. Read it every week. Above 60% — the vocabulary and the artifact scenes are doing their job. Between 35% and 60% — drifting; put a `posting`, `comp` or `market` scene in every video that week and seed only in US subs. Below 35% — the wrong continent is being trained on the channel. Stop posting until the next three scripts name a US ATS, a $ figure and a US city in the first ten seconds. A mediocre video seen by the right people is recoverable; a successful one seen by the wrong people is not.

## One open question worth answering before you automate

The README says it, and it's still true: **prove the format on real views before letting the cron run unattended.** Automating an unvalidated video format just produces the wrong video faster.

You now have the accounts, which you didn't when that was written — so the argument for waiting is weaker. But the cheap version of caution is: run it on `workflow_dispatch` for the first week, watch the retention graphs, then let the schedule take over. That costs you nothing except pressing a button each morning.
