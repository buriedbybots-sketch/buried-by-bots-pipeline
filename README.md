# Buried by Bots — Shorts pipeline

Motion-graphics vertical video for `@buriedbybots`. One sheet row in, one 1080x1920 MP4 out, voiced, captioned, uploaded, and delivered to a phone with everything needed to post the Reel and seed the first hour.

The channel sells **Hired by AI** ($19) to **US tech job seekers**. The operator is not in the US. So the pipeline's job is not "get views" — it is to make videos that a US software engineer stops on and everyone else scrolls past, and then to measure whether that is happening. Every design choice below follows from that.

## Run it

```bash
npm install                    # once
pip install edge-tts           # once
npm run build -- sample        # lint + voice + render content/sample.json -> out/sample.*
npm run build -- showcase      # every artifact scene type in one 47s video
npm run stills -- showcase     # one jpg per scene, no full render, in out/stills/
npm run lint -- content/sample.json
npm run studio                 # live preview while editing the look
```

To check a sheet row before it goes in the Google Sheet, leave `SHEET_ID` unset and `node scripts/sheet.mjs 2026-08-28` reads `sheet/videos.csv` + `sheet/scenes.csv` from disk instead. Same parser, same linter.

## How it works

```
Google Sheet (tabs "videos" + "scenes", published as CSV)   ← the human interface
  └─ scripts/sheet.mjs    → content/<date>.json          + the linter
  └─ scripts/build.mjs    → lint → tts.py → guards → Remotion → out/<date>.mp4 .cover.jpg .post.txt .meta.json
  └─ scripts/upload.mjs   → YouTube (category 27, en-US, merged tags) + pinned comment → out/<date>.upload.json
  └─ scripts/deliver.mjs  → Telegram: mp4, cover, IG caption, pin reminder, SEEDING PACK
  └─ scripts/geo.mjs      → YouTube Analytics: "US: NN%" per video and per week → Telegram
  └─ .github/workflows/daily.yml  cron 13:00 UTC   ·   geo.yml  Mondays 14:00 UTC
Composition: src/index.jsx, src/Short.jsx, src/scenes/{ui,core,artifacts,index}.jsx, src/theme.js
```

1. `scripts/tts.py` sends each scene's `vo` line to **edge-tts** (`en-US-AndrewMultilingualNeural`, free) and keeps the **word boundaries** it reports back.
2. Those timings set how long each scene runs and when each caption word highlights. Nothing is hand-timed; change a `vo` line and the video retimes itself. **This is the architecture. Do not replace it with fixed durations.**
3. **Remotion** renders frame by frame in headless Chrome and muxes the audio. It ships its own ffmpeg.
4. `build.mjs` composes the title, description, pinned comment, Instagram caption, tags and seeding pack **once** into `out/<date>.meta.json`. `upload.mjs` and `deliver.mjs` read that file and never build their own strings — two components composing the same copy is how videos once shipped with no links.

## What decides who sees it

Ranked by leverage. The pipeline has a lever for each.

| # | Signal | Lever |
|---|---|---|
| 1 | **Who sees the first ~50 views** | The **seeding pack** (`seed` + `communities` columns): Short URL, a two-sentence no-link comment, three US communities. Delivered to Telegram the minute the upload finishes. Post it in the first hour from the personal Reddit account. |
| 2 | **The spoken transcript** (ASR → topic) | The **linter** (`scripts/lint.mjs`). Wrong-audience words (CV, fresher, CTC, lakhs, notice period, placement…) fail the build. Zero US-tech tokens across the `vo` lines warns loudly. |
| 3 | **Upload metadata** | `categoryId 27` (Education), `defaultLanguage`/`defaultAudioLanguage` `en-US`, the video's hashtags merged with `baseTags` from `content/links.json` inside YouTube's 500-char cap. |
| 4 | **On-screen text** (OCR) | The five **artifact scenes** below. A frame reading `San Francisco, CA · Remote (US) · $185,000 – $220,000` is illegible to most of the planet and magnetic to one person. The linter warns if no frame names a US company, city, $ figure or ATS. |
| 5 | **Retention shape** | Loop-back tail (last 0.5s = the hook, settled), hook guard (warn >2.5s spoken, fail >3s), music bed, captions sized by character budget. |
| 6 | **Hashtags** | 3–5. The linter warns outside that range. |

And the check on all of it: **`npm run geo`** prints `US: NN%` for the channel and for each recent video from the YouTube Analytics API, and sends it to Telegram every Monday. Without that number the design is unfalsifiable.

## The sheet

Two tabs, named exactly `videos` and `scenes`, joined on `date`. `sheet/videos.csv` and `sheet/scenes.csv` are the templates, pre-filled with the first five videos.

### `videos` — one row per video

```
date,title,description,hashtags,music,caption,pinned,seed,communities
```

| column | what |
|---|---|
| `date` | `YYYY-MM-DD`. The cron builds today's row. |
| `title` | YouTube title, ≤100 chars (the linter fails past it). |
| `description` | First lines of the YouTube description. The links and `#Shorts` are appended by the build. |
| `hashtags` | 3–5, space-separated, with `#`. Also become YouTube tags. |
| `music` | Blank = the generated bed (`pulse.wav`). `none` = silence. Anything else = a file in `public/music/`. |
| `caption` | Instagram caption. No links — IG strips them; the keyword and the bio do the work. |
| `pinned` | The YouTube pinned comment. `[LEAD MAGNET LINK]`, `[PRODUCT LINK]` and `[KEYWORD]` are substituted from `content/links.json`. |
| `seed` | **Two sentences, no link.** The Reddit-safe comment for the seeding pack. The linter fails on a link and warns past two sentences. |
| `communities` | Three US communities, comma-separated (`r/cscareerquestions, r/resumes, r/recruitinghell`). Blank = the default trio in `links.json`. |

### `scenes` — one row per scene

```
date,order,type,vo,text,accent,head,to,total,caption,value,suffix,label,source,title,lines,sub,keyword,company,location,pay,time,photo,captions
```

`vo` is required on every row; it sets the timing. `photo` (optional, any type) is a Pixabay search term or image id for a dim monochrome backdrop — needs `PIXABAY_KEY`. `captions` is `true`/`false` to force captions on or off. Columns are reused across types on purpose so the sheet stays at 24 columns; here is what each type reads:

| type | columns | what's on screen |
|---|---|---|
| `hook` | `text`, `accent`, `head?` | Words spring in staggered; `accent` word turns orange with an underline swipe. Keep the `vo` under 2.5s spoken. |
| `rank` | `to`, `total`, `caption?` | The signature shot — the stack scrolls and stops on the buried orange sheet. |
| `stat` | `value`, `suffix`, `label`, **`source`** | Number counts up. **No number on screen without a source** — the build refuses. |
| `prompt` | `title`, `lines` | Terminal card that types itself. **Never Vault 1, 2, 3 or 26** — a title naming them fails the build; use `terminal` to show their output. |
| `test` | `text`, `label?`, `head?` | The diagnostic: `text` is the step, `label` the bad result, `head` the small kicker (`60-SECOND TEST`). |
| `cta` | `text`, `sub?`, `keyword?` | The channel mark, then the line, then `COMMENT "PACK"` in an orange pill. Always set `keyword`. |
| `posting` | `title`, `company?`, `location`, `pay?`, `lines`, `source` (required if `pay`) | A Greenhouse-style req card. `lines` = requirements, one per line; start a line with `*` to turn it orange. |
| `rejection` | `company?`, `title?`, `text?`, `time?` | The rejection email in a mail client. Blank `text` uses the canonical one; wrap a phrase in `*stars*` to turn it orange. `time` defaults to `4:12 AM`. |
| `market` | `label?`, `lines`, `suffix?`, **`source`** | Bars. `lines` = `Label\|-49` one per line; negative bars are orange. |
| `comp` | `title`, `lines`, `sub?`, **`source`** | levels.fyi-style band. `lines` = `Base\|$185,000` one per line (a `Total` row is drawn larger); `sub` = the counter-offer delta, in orange. |
| `terminal` | `title?`, `head?`, `lines` | ChatGPT-style answer filling in live. `head` is the user bubble (default: "Pasted my resume and the job description."); `lines` is the answer, ≤620 chars. `*stars*` turn orange. **This is the format for the demo-only prompts.** |

Every scene cuts in on an orange scan wipe. Captions sit above the YouTube UI zone (`SAFE_BOTTOM` in `src/theme.js`) and switch off automatically on `hook` and `cta`.

Adding a scene type: one component in `src/scenes/`, one line in `SCENES` in `src/scenes/index.jsx`, one mapping in `TYPES` in `scripts/sheet.mjs`, one line in `REQUIRED` in `scripts/lint.mjs`.

## The linter

Runs in `sheet.mjs` (on the way in) and `build.mjs` (before spending three minutes on a render). Errors fail; warnings print.

**Fails on:** a wrong-audience word anywhere (spoken, on screen, or in the post copy) · an identity claim ("as a recruiter", "when I got hired", "here in the Bay Area") · a `prompt` scene titled Vault 1/2/3/26 · a `stat`/`market`/`comp` scene, or a `posting` with `pay`, with no `source` · a title over 100 chars · a link in the seed comment · a missing required column.

**Warns on:** zero US-tech tokens in the transcript · no frame naming a US company/city/$/ATS · hashtags outside 3–5 · a seed comment over two sentences · not exactly three communities · a first scene that isn't a hook.

If `content/protected.txt` exists (gitignored — paste the text of Vault 1, 2, 3 and 26 into it), any 8-word run of it spoken or on screen also fails the build.

## What each build produces

| File | Use |
|---|---|
| `out/<id>.mp4` | The video, both platforms |
| `out/<id>.cover.jpg` | Reel cover — Instagram picks a mid-transition frame otherwise |
| `out/<id>.meta.json` | The copy, composed once: title, description, tags, pinned, igCaption, seed |
| `out/<id>.post.txt` | The same, human-readable, for posting by hand |
| `out/<id>.upload.json` | Written by `upload.mjs`: the video id and Short URL |

The build fails rather than renders if the voiceover plus the loop tail is over 58 seconds, or if the hook is spoken over 3 seconds.

## Music

The default bed is generated by `scripts/bed.py` on first build (`public/music/pulse.wav`, gitignored): a low drone and a soft pulse at 84 BPM, played at 11% under the voice and looped. It exists because silence under a synthetic voice reads as cheap and the YouTube Audio Library can't be fetched without a browser.

To use a real track, drop it in `public/music/` and put its filename in the `music` column. Use the **YouTube Audio Library** — free and already cleared, which matters because a copyright claim on a monetised Short is worse than no music. Tracks loop, so length doesn't matter.

## Stock photo backdrops

On by default for every `hook`, `test`, `stat`, `rank` and `cta` scene. With `PIXABAY_KEY` set (free API key; `.env` locally, a GitHub Secret in CI) the build fetches one photo per scene into `public/photos/` and renders it as a black-and-orange duotone with film grain, drifting slowly, faded to black where the captions sit. It is what makes the videos read as cut by a person rather than generated. No key → no backdrops, everything else renders as before.

- A blank `photo` cell uses the default term for that scene type from `photos` in `content/links.json`, written as `term @category` (`keyboard macro dark @computer`). The category is Pixabay's own and is the only thing that keeps a fish out of a keyboard search. The pick rotates by date so consecutive videos don't share a photo.
- Put your own term, `term @category`, or a numeric Pixabay image id in the cell to override. `none` switches it off for that scene.
- Card scenes (`prompt`, `terminal`, `posting`, `rejection`, `comp`, `market`) never get one. The card is the frame.
- **Objects only, never people.** The channel is faceless and a stock face is still a face. Defaults are buildings, keyboards, circuit boards and paper. Check `npm run stills` before a new term goes into rotation.

## The scheduled version

`.github/workflows/daily.yml` runs the chain on a cron: sheet → build → upload → deliver, then keeps the mp4 as a workflow artifact so a failed upload still leaves a finished video. `.github/workflows/geo.yml` runs `geo.mjs` every Monday. Setup is in `DEPLOY.md`.

Timing: 13:00 UTC — 6:30 PM IST, 9:00 AM ET. GitHub delays scheduled runs under load, so treat it as "sometime in the next hour."

**Prove the format on real views before letting the cron run unattended.** Run it on `workflow_dispatch` for the first week, watch retention and — more importantly — watch `geo.mjs`. If US share is under a third, stop and fix the scripts; a successful video seen by the wrong continent trains the algorithm against the channel.

## Deliberate limits

- Scene length comes from the last TTS word boundary plus a 280 ms tail, not from decoding the mp3 — keeps ffprobe out of the dependency list.
- Music is a fixed level under the voice, no sidechain ducking.
- Captions group words by a 26-character budget (max 6 words). Longer lines get unreadable at this size.
- The loop tail freezes the opening scene at frame 20. If a video ever opens with something other than a `hook`, it still works, it's just less of a loop.
- The Analytics API lags about two days. `geo.mjs` on Monday reports last week, not the weekend.
