# One-shot redesign prompt

Paste everything below the line into a fresh Fable 5.1 chat with the repo open. It is self-contained — it assumes no prior context.

---

You have full write access to the real project on disk. Redesign the whole pipeline in one pass. Do not split the work into phases, do not ask me to confirm intermediate steps, and do not stop to check in — produce the complete, working, redesigned pipeline in a single go, then tell me what changed and what I have to do by hand.

## Working agreement — edit the real files

**Project root:** `C:\Users\claude space\Marketing\buried-by-bots-pipeline`

Take control of it. Concretely:

- **Edit the files on disk.** Do not print proposed code in chat for me to paste. Read the real files, write the real files, create and delete files as the redesign requires.
- **Read everything before you change anything.** Every file in `src/`, `scripts/`, `sheet/`, `content/`, `.github/workflows/`, plus `README.md`, `DEPLOY.md` and `UPGRADE-BRIEF.md`. The brief is a full audit of the current state — read it first.
- **Refactor freely.** Rename, split, merge, or delete modules if the redesign is better for it. You are not patching; you are redesigning. If `src/scenes.jsx` should become a directory, make it one.
- **Run things.** Install dependencies, run the scripts, render a test video, iterate until it actually works. Do not hand me code you haven't executed.
- **Fix what you find.** If you hit a bug I haven't mentioned, fix it and note it in your summary.

**Boundaries — the only things off-limits:**

- **Never leave the project root.** Nothing outside `buried-by-bots-pipeline` gets touched. Its sibling `..\hired-by-ai-campaign` is the campaign's document folder — read it for context if useful, never write to it.
- **Do not change the values in `content/links.json`.** The two Gumroad URLs and the keyword are live and correct. You may add fields; do not edit the existing ones.
- **Do not commit secrets.** No tokens, no `.env`, no sheet ID in tracked files. Everything sensitive stays in GitHub Secrets and is read from `process.env`.
- **Preserve the existing content rows.** `sheet/videos.csv` and `sheet/scenes.csv` hold five days of written, approved scripts (2026-08-28 to 09-01, Vault Prompts 5, 12, 16, 9, 17). If the schema changes, **migrate those rows into the new schema** — do not drop them and do not invent replacements.
- **Git:** commit your work to a new branch called `redesign`, in logical commits with real messages. Do not push, do not touch `main`, do not force anything. I'll review the diff and merge.

## What this repo is

A faceless motion-graphics YouTube Shorts / Instagram Reels pipeline for a channel called **Buried by Bots**. It sells a $19 toolkit called **Hired by AI** to **US tech job seekers**.

Current flow:

```
Google Sheet (tabs "videos" + "scenes", published as CSV)
  └─ scripts/sheet.mjs   → content/<date>.json
  └─ scripts/tts.py      → public/vo/<date>/N.mp3 + content/<date>.audio.json  (edge-tts)
  └─ scripts/build.mjs   → Remotion render → out/<date>.mp4, .cover.jpg, .post.txt, .meta.json
  └─ scripts/upload.mjs  → YouTube Data API (multipart upload + comment insert)
  └─ scripts/deliver.mjs → Telegram (mp4 + cover + IG caption to my phone)
  └─ scripts/week.mjs    → batch 7 days
  └─ .github/workflows/daily.yml → cron '0 13 * * *'
Composition: src/index.jsx, src/Short.jsx, src/scenes.jsx, src/theme.js
```

Read every file before changing anything. `UPGRADE-BRIEF.md` in the repo has a fuller audit — read that too.

## The problem to solve

The channel has zero followers and the operator is in Chennai, India. The buyers are in the United States. At zero followers the platform seeds a video using creator locale, language, and content signals — and **two of those three currently point at India.**

The failure mode is not "no views." It is **views from the wrong continent.** If a generic resume-advice video performs well with Indian viewers, the algorithm learns to serve more Indians, and that compounds. A mediocre video seen by the right people is recoverable; a successful video seen by the wrong people trains the system against us.

**So the objective function is not engagement. It is engagement *differential*** — content a US tech job seeker stops on and everyone else scrolls past. Exclusionary specificity is the targeting mechanism, not a side effect. A frame reading `$185,000 – $220,000 · San Francisco, CA · Remote (US)` is illegible to most of the planet and magnetic to exactly one person. That is the design principle for the entire redesign.

## Components that decide niche reach, ranked by causal leverage

Build the redesign around this ordering. Spend effort proportional to rank.

**1 — The seed cohort (highest leverage, currently no lever exists).**
Who sees the first ~50 views determines everything downstream. The pipeline cannot set this directly, but it can support it: emit a **seeding pack** per video — the Short URL, a 2-sentence Reddit-safe comment with no link, and 3 named US communities appropriate to that video's topic — and push it to Telegram so the operator can seed within the first hour. Free, unbuilt, probably worth more than everything below.

**2 — The spoken transcript.** Both platforms run ASR and classify topic from it. Every word of `vo` is a targeting decision and nothing currently checks it.
- *US-signalling:* Workday, Greenhouse, Lever, Taleo, iCIMS, Ashby · LinkedIn, Indeed, levels.fyi, Blind · software engineer, SWE, backend, data engineer, PM, new grad, L4, L5, senior · $180k base, total comp, RSUs, equity refresh, sign-on · recruiter screen, hiring manager screen, onsite, loop, take-home, system design, behavioral · layoffs, RTO, hiring freeze, ghost job
- *Wrong-audience tells, must hard-fail the build:* CV (use **resume**), fresher, notice period, CTC, lakhs, crore, placement, aptitude round, HR round, tier-1 college
- The TTS voice is already `en-US-AndrewMultilingualNeural`, which is a real signal working in our favour. Keep it.

**3 — Upload metadata.** Mechanical, cheap, currently wrong. `categoryId` is `'22'` (People & Blogs) — the vaguest bucket on the platform; use `'27'` (Education) or `'26'` (Howto & Style). No `defaultLanguage` or `defaultAudioLanguage` is set — both should be `en-US`. Tags are three stripped hashtags against ~500 characters allowed; add a standing base set and merge per-video.

**4 — On-screen text (OCR).** Where the visual niche lives. The existing scenes are brand-correct but audience-generic — a frame from the `test` scene could be from any productivity channel. **Note honestly: OCR ranking weight is widely repeated but thinly evidenced. Build for it because it's cheap, don't stake the architecture on it.**

**5 — Retention shape.** A multiplier on the cohort already found, not a director of which cohort. Real but secondary.

**6 — Hashtags.** Weak on YouTube, moderate on Instagram. Keep at 3–5, not 30.

## What to build

**a. New scene types**, added to `src/scenes.jsx` and the `SCENES` map, each with a sheet column mapping in `scripts/sheet.mjs`:

| Type | Shows | Why |
|---|---|---|
| `posting` | Workday/Greenhouse-style req card — title, `San Francisco, CA · Remote (US)`, `$165,000 – $210,000`, requirements list with 2 bullets highlighted orange | One frame, unmistakably US tech hiring |
| `rejection` | The rejection email — *"we've decided to move forward with other candidates"* — in a mail-client frame with a timestamp | The most recognised artifact in this audience's life. Highest shareability in the set. |
| `market` | Two bars: *General SWE openings −49% vs Feb 2020* / *ML openings +59%*, with source chip | The repositioning angle nobody else teaches |
| `comp` | levels.fyi-style band: base / stock / bonus, with a counter-offer delta | Pure US comp vernacular |
| `terminal` | ChatGPT-style output filling in live (not the prompt text) | Proof it works, and the demo-only format for protected prompts |

**b. A vocabulary linter in `scripts/sheet.mjs`** — the deny-list hard-fails the build; a video whose `vo` lines contain zero US-signal tokens warns loudly. This is the enforcement point because `sheet.mjs` is already the gate every field passes through and already hard-fails on missing stat sources.

**c. A geography feedback loop.** New `scripts/geo.mjs` using the YouTube Analytics API (`youtubeAnalytics.reports.query`, dimension `country`) to report per-video and rolling 7-day viewer geography. Print `US: NN%`. Push weekly to Telegram. **Without this the whole redesign is unfalsifiable** — which is the same failure mode as the resume-tool vendors this brand was built against.

**d. Retention mechanics.** Loop-back tail so the last ~0.5s returns to the hook's first frame (replays are heavily weighted). Enforce a hook under ~2.5s. Wire the music bed that already exists in `Short.jsx` but is always `null`. Fix the fixed 6-word caption window overflowing on long words.

**e. Metadata fixes** from component 3 above.

**f. The seeding pack** from component 1 above.

**g. Sheet schema.** The sheet is the human interface — a person fills it in once a week. Every new capability needs a column, not a code edit. Update `sheet/videos.csv` and `sheet/scenes.csv` templates and document the schema in `README.md`.

## Hard constraints — do not violate, do not re-litigate

1. **$0 budget.** No paid APIs, no ElevenLabs, no paid schedulers, no VPS, no new paid dependency. Free tiers only.
2. **Faceless and pseudonymous forever.** No face, no real name.
3. **Never imply an identity the operator doesn't have.** Speaking American English is translation and is correct. Claiming to be American, or a recruiter, or someone who landed a FAANG offer, is fraud. Hold this line.
4. **No statistic on screen without a source chip.** `sheet.mjs` already hard-fails `stat` scenes missing `source` — extend that guard to every new scene type that displays a number.
5. **Vault Prompts 1, 2, 3 and 26 are demo-only.** Show what they do and show the output; their prompt text must never appear on screen or be spoken. Enforce it in the linter.
6. **Channel is "Buried by Bots" (the pain), product is "Hired by AI" (the solution).** Don't merge them.
7. **Sub-60s.** `build.mjs` fails over 58s. Keep that guard.
8. **Word-boundary timing is the architecture.** edge-tts returns `[{w, t, d}]` per word; those timings drive both scene duration and caption highlighting, so nothing is hand-timed and editing a script line retimes the video automatically. **Do not replace this with fixed durations.**
9. **One source of truth for copy.** `build.mjs` writes `out/<date>.meta.json` and `upload.mjs` / `deliver.mjs` read it. Two components independently composing the same strings is a bug that already shipped once — videos went live with no links. Don't reintroduce it.
10. **Brand palette:** void black `#0F1115`, signal orange `#FF4D2E`, paper white `#F5F3EF`, steel grey `#8A94A6`. Deliberately not the purple-gradient AI look. Barlow Condensed for display, JetBrains Mono for code and labels.

## Known environment facts

- Remotion 4 + React 18.3.1, `@remotion/google-fonts`. Renders ~3 min for 35–40s locally.
- Python 3.12 + `edge-tts`. No ffmpeg on PATH — Remotion ships its own.
- CI is GitHub Actions free tier, ~90 min/month used against 2,000. Not a constraint.
- **An unaudited Google Cloud project can only upload as `private`.** Not a bug — videos land private until the YouTube API audit clears.
- Posting a comment needs the `youtube.force-ssl` scope. **Pinning a comment is impossible via API** — Studio-only. Post it, and tell the operator to pin.
- Instagram is manual by design; Graph API publishing needs a Business account, linked Page and app review. `deliver.mjs` exists so that stays a 60-second phone job.

## Definition of done

Not done when the code looks right. Done when:

- `npm run build -- sample` renders end to end without errors and produces `out/sample.mp4`, `.cover.jpg`, `.post.txt` and `.meta.json`.
- You have **actually looked at the rendered frames** — render stills of each new scene type and inspect them. Text that overflows, overlaps, or wraps into mush is a defect, and it is only visible by looking. Fix what you see, re-render, look again.
- The five existing content rows still build after the schema migration.
- The vocabulary linter demonstrably fails on a deny-listed word — prove it by trying one.
- `node --check` passes on every `.mjs`, and nothing references a field that no longer exists.
- Everything is committed to the `redesign` branch.

## Then report back

1. Every file changed, added or deleted — one line each, with why.
2. The new sheet schema, as the exact header rows for both CSV tabs, ready to paste into Google Sheets.
3. Anything I must do by hand: new OAuth scopes, new GitHub Secrets, new Google Cloud APIs to enable.
4. The one command that renders a test video, so I can see it before the cron touches anything.
5. Anything you chose not to do, and why. If you disagreed with something in this brief, say so — I'd rather hear it than have it silently ignored.
