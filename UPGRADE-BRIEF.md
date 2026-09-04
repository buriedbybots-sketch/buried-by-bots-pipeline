# Pipeline audit + upgrade brief

**For:** whichever model picks up the upgrade. Everything needed is in here; you should not have to guess.
**Written:** 2026-09-04, against the repo as it stands.
**Goal of the upgrade:** every view this pipeline earns should come from a **US tech job seeker**. Not "job seekers." Not "AI content watchers." US software engineers, data people, PMs and designers who are applying and hearing nothing back.

---

## 0. The 30-second orientation

One JSON row in → one 1080×1920 MP4 + cover + post copy out. Voice timing drives everything.

```
Google Sheet (2 tabs, published CSV)
      │  scripts/sheet.mjs        → content/<date>.json
      ▼
scripts/tts.py  (edge-tts)        → public/vo/<date>/N.mp3  +  content/<date>.audio.json
      │            └── word boundaries: [{w, t, d}]  ← the load-bearing data
      ▼
scripts/build.mjs  → Remotion render (src/) → out/<date>.mp4
                                             out/<date>.cover.jpg
                                             out/<date>.post.txt
      ▼
scripts/upload.mjs (YouTube REST)   scripts/deliver.mjs (Telegram → phone → IG by hand)
      ▲
.github/workflows/daily.yml — cron '0 13 * * *'
```

**The one idea the whole thing rests on:** edge-tts returns word boundaries. Those timings set *both* scene duration and caption highlighting. Nothing is hand-timed. Change a `vo` line and the video retimes itself. **Do not break this.** Any upgrade that introduces hand-authored timings throws away the reason this pipeline is maintainable.

---

## 1. Every file, what it does, and what it decides about reach

| File | Lines | Owns | Niche-targeting relevance |
|---|---|---|---|
| `src/theme.js` | 16 | 4 brand colours, 1080×1920, 30fps, `SAFE_BOTTOM=1640` | Low. Colour is brand, not targeting. |
| `src/index.jsx` | 21 | Remotion composition registration, `calculateMetadata` | None |
| `src/Short.jsx` | 171 | Scene sequencing, Grid backdrop, Scan wipe, **Captions**, music bed | **High** — captions are OCR'd by both platforms |
| `src/scenes.jsx` | 367 | The 6 scene components + `SCENES` map | **Highest** — this is what a viewer sees and what OCR reads |
| `scripts/tts.py` | 77 | edge-tts voice, `+8%` rate, word boundaries | **High** — the spoken transcript is the strongest topic signal |
| `scripts/sheet.mjs` | 112 | CSV → content JSON, per-type prop whitelist, source guard | Medium — it's the gate every field passes through |
| `scripts/build.mjs` | 90 | Orchestration, 58s guard, cover still, `post.txt` copy | **High** — writes the description/caption/pinned text |
| `scripts/upload.mjs` | 79 | YouTube OAuth + multipart upload, metadata | **Highest** — title/description/tags/category/language |
| `scripts/deliver.mjs` | 90 | Telegram delivery of mp4 + cover + IG caption | Low (logistics) |
| `scripts/week.mjs` | 42 | Batch 7 days | None |
| `.github/workflows/daily.yml` | ~70 | Cron, secrets, artifact | Medium — posting time is a US-timezone decision |
| `sheet/videos.csv` | — | Per-video meta template | Medium |
| `sheet/scenes.csv` | — | Per-scene template, 19 columns | Medium |
| `content/links.json` | — | Single source for lead-magnet/product/keyword | High (conversion, not reach) |

### The 6 scene types that exist today

| Type | Props | What's on screen |
|---|---|---|
| `hook` | `text`, `accent`, `head?` | Words spring in on a stagger; `accent` word turns orange with an underline swipe. 132px. |
| `rank` | `to`, `total`, `caption?` | The signature shot. Counter above, sheet stack scrolls and decelerates onto the buried orange sheet. |
| `stat` | `value`, `suffix`, `label`, `source` | Number counts up, label, mono source chip. **`sheet.mjs` throws if `source` is missing.** |
| `prompt` | `title`, `lines[]` | Terminal card, auto-sized mono, types itself in over 68% of the scene. |
| `test` | `step`, `result`, `kicker?` | The diagnostic — an action the viewer can take in 60s, then the bad result. |
| `cta` | `text`, `keyword?`, `sub?` | Channel mark assembles, then `COMMENT "PACK"` in an orange pill. |

Global layers: `Grid` (drifting 120px grid), `Scan` (6-frame orange wipe on every cut), `Captions` (6-word rolling window, current word orange, auto-suppressed on `hook`/`cta`), optional music bed at 11%.

---

## 2. ✅ Two conversion bugs — FIXED 2026-09-04

Recorded here because the shape of the mistake is worth remembering, not because there is work left.

**Bug 1 — auto-uploaded videos contained no link.** `build.mjs` wrote the links into `post.txt`; `upload.mjs` rebuilt its own description from the raw sheet cell and never read that file. Every video the cron posted went live with no lead-magnet URL and no product URL.

**Bug 2 — the pinned comment was never posted.** It existed only in `post.txt`, so it only happened if the operator did it by hand — which is the thing the cron exists to remove.

**The fix, and the rule it encodes:** `build.mjs` now writes `out/<date>.meta.json` — `{title, description, pinned, igCaption, tags}` — and it is the *only* place that copy is composed. `upload.mjs` and `deliver.mjs` read it; neither builds its own strings any more. `post.txt` is now a human-readable twin generated from the same object. Two components independently composing the same copy is what let them drift, so that possibility is gone rather than corrected.

`upload.mjs` also now posts the pinned comment after upload, and guards the 100-character YouTube title cap.

**Known limit, not a bug:** the YouTube Data API has no endpoint to *pin* a comment — it is Studio-only. The pipeline posts it; pinning is one tap, in the same visit where the video gets flipped public. Posting requires the `youtube.force-ssl` scope; with `youtube.upload` alone the insert 403s and the run warns loudly, prints the comment text, and still succeeds.

---

## 3. What actually routes a Short to US tech job seekers

Ranked by leverage, with what the pipeline currently does about each.

### 3.1 The spoken transcript — **strongest signal, fully controllable, currently unmanaged**

Both platforms transcribe the audio and classify topic from it. Every word in `vo` is a targeting decision, and right now nothing checks what's in there.

**What "US tech job seeker" sounds like in a transcript:**

- ATS product names: **Workday, Greenhouse, Lever, Taleo, iCIMS, Ashby, Bamboo**
- Job boards: **LinkedIn, Indeed, Hiring Cafe, Otta, levels.fyi, Blind**
- Roles said the American way: *software engineer, SWE, backend, data engineer, PM, new grad, L4, IC5, senior*
- US comp vernacular: *$180k base, total comp, RSUs, equity refresh, sign-on, levels.fyi*
- US process words: *recruiter screen, hiring manager screen, onsite, loop, take-home, system design, behavioral, offer deadline*
- US market events: *layoffs, RTO, hiring freeze, req closed, ghost job*

**What pushes it toward the wrong audience:** *CV* (British/Indian — use **resume**), *fresher*, *notice period*, *CTC*, *lakhs*, *placement*, *aptitude round*, *HR round* (US says *recruiter screen*).

**Upgrade:** add a vocabulary linter to `sheet.mjs` — a deny-list that hard-fails the build, and an allow-list that warns if a video contains **zero** US-tech tokens across all its `vo` lines. That single check would prevent the most expensive possible mistake: a month of videos that read as generically Indian and train the algorithm to serve the wrong continent.

### 3.2 On-screen text — OCR'd, second strongest, and where the visual niche lives

Right now the scenes render brand-correct but **audience-generic** text. A frame from the `test` scene could be from any productivity channel.

**Missing scene types that would make the niche unmistakable in a single frame:**

| Proposed | What it shows | Why it targets |
|---|---|---|
| `posting` | A Workday/Greenhouse-style job-req card: title, location (`San Francisco, CA · Remote (US)`), `$165,000 – $210,000`, a Requirements list with 2 bullets highlighted orange | One frame, unmistakably US tech hiring. Also the highest-value visual for the keyword prompts. |
| `rejection` | The actual rejection-email template — *"we've decided to move forward with other candidates"* — in a mail-client frame, timestamp visible | The single most recognised artifact in this audience's life. Enormous relatability + shareability. |
| `market` | Two bars: *General SWE openings −49% vs Feb 2020* / *ML openings +59%*, sourced | The repositioning pillar nobody else teaches. Named in MARKET-ANALYSIS.md as the biggest untapped angle. |
| `comp` | A levels.fyi-style band: base / stock / bonus, with a counter-offer delta | Pure US comp vernacular; nothing else says "American tech" faster. |
| `terminal` | The prompt scene, but showing **ChatGPT output filling in**, not the prompt text | Proof the thing works, and it's the demo-only format for protected Prompts 1/2/3. |

**Rule to encode:** every video should contain at least one frame that names a US company, a US city, a `$` figure, or a US ATS product. Add it to the same linter as 3.1.

### 3.3 Upload metadata — cheap, mechanical, currently wrong

In `upload.mjs`:

```js
categoryId: '22',            // People & Blogs  ← wrong bucket
// no defaultLanguage
// no defaultAudioLanguage
tags: hashtags stripped of '#'   // 3 tags, out of ~500 chars allowed
```

**Fix all three:**
- `categoryId: '27'` (Education) or `'26'` (Howto & Style). "People & Blogs" is the vaguest bucket on the platform and tells YouTube nothing.
- `defaultLanguage: 'en-US'` and `defaultAudioLanguage: 'en-US'`. A direct, explicit locale declaration that costs one line.
- Tags: add a standing base set to `links.json` and merge with per-video ones — `ats resume, applicant tracking system, tech job search, software engineer jobs, resume keywords, job search 2026, faang recruiting, tech layoffs`. Cap at 500 chars.
- Title guard: YouTube caps at 100 chars. Nothing checks; a long sheet cell gets silently truncated by the API.

### 3.4 Retention & the loop — decides how far it travels *within* the audience it found

- **No end-loop.** The `cta` ends on the mark and stops. Cutting the last ~0.5s back to the hook's first frame makes replays seamless, and replays are heavily weighted on Shorts.
- **No music.** `content.music` is wired and always `null`. Silence under a synthetic voice reads as cheap and hurts watch time. Needs one YouTube Audio Library track dropped into `public/music/`.
- **Hook length isn't enforced.** The first 2 seconds decide everything and nothing checks that scene 0 is short. Add a guard: if `scenes[0]` is longer than ~2.5s, fail the build.
- **Caption window is fixed at 6 words** regardless of word length. Long words overflow the 940px band.

### 3.5 Publishing time — half-right

Cron is `0 13 * * *` = 13:00 UTC = 9:00 AM ET. Good for the US East Coast. But it's **one fixed time, and GitHub's scheduler drifts under load** — a run can land an hour late, which moves a 9 AM ET post to 10 AM. Acceptable, worth knowing. `deliver.mjs` already staggers the Instagram post 90 minutes later, which is the right instinct.

---

## 4. Constraints the upgrade must not violate

These are decided. Re-opening them wastes a cycle.

1. **$0 budget.** No paid APIs, no ElevenLabs, no paid schedulers, no VPS. Free tiers only.
2. **Faceless and pseudonymous.** No face, no real name, no claimed hiring outcome, ever.
3. **Never state a statistic without an on-screen source.** `sheet.mjs` already enforces this for `stat` scenes — keep the guard and extend it to any new scene type that shows a number.
4. **Vault Prompts 1, 2, 3 and 26 are demo-only.** Show what they do and show the output; the prompt text must never appear on screen or be read aloud. A `prompt` scene must never carry their text. Worth encoding as a check.
5. **Channel = "Buried by Bots" (the pain). Product = "Hired by AI" (the solution).** Don't collapse them.
6. **Sub-60s.** `build.mjs` fails over 58s. Keep it.
7. **Word-boundary timing is the architecture.** Don't replace it with fixed durations.
8. **The sheet is the interface.** A human writes rows once a week; anything the upgrade adds needs a column, not a code edit.

---

## 5. Suggested order of work

1. **Fix Bug 1 and Bug 2** (links + pinned comment). Everything else is worth nothing if the video can't convert.
2. **Upload metadata** — category, language, tags, title guard. 20 minutes, pure upside.
3. **The vocabulary linter** in `sheet.mjs`. Cheap, and it prevents the expensive mistake.
4. **`posting` and `rejection` scene types.** Biggest visual-niche gain per unit of work.
5. **Loop-back tail + music bed.** Retention.
6. **`market` and `comp` scenes.** Opens the repositioning pillar.
7. Hook-length guard, caption overflow, title truncation.

---

## 6. Facts worth having before you start

- Renders take ~3 min locally for 35–40s. Free-tier CI minutes are not a constraint (~90 min/month against 2,000).
- **An unaudited Google Cloud project can only upload as `private`.** Not a bug. Videos land private until the YouTube API audit clears; `PRIVACY` is a workflow input for afterwards.
- Instagram is manual by design — Graph API publishing needs a Business account, linked Page and app review. `deliver.mjs` exists precisely so that stays a 60-second phone job.
- The repo is private, on the pseudonymous `buriedbybots-sketch` GitHub account. Keep it that way.
- Days 1–5 of content are already written into `sheet/*.csv` using Vault Prompts 5, 12, 16, 9, 17 — all five are in the free pack, so the CTA delivers exactly what the viewer just watched.
