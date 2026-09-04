# Review prompt — paste into a fresh Opus 5 chat with this repo open

---

You are reviewing work another model (Fable 5.1) did on this repo today, 2026-09-04. Be adversarial. I want defects, not compliments. If you find nothing wrong in an area, say "checked, nothing" and move on.

**Project root:** `C:\Users\claude space\Marketing\buried-by-bots-pipeline`. Read-only is fine for the review; if you fix something, commit it to a branch called `review` and do not push.

## What the repo is

A faceless, pseudonymous YouTube Shorts / Instagram Reels pipeline for a channel called **Buried by Bots**, selling a $19 prompt toolkit called **Hired by AI** to **US tech job seekers**. The operator is a student in Chennai, India, with a $0 budget. Google Sheet → `scripts/sheet.mjs` → `scripts/tts.py` (edge-tts word boundaries drive all timing) → `scripts/build.mjs` (Remotion render) → `scripts/upload.mjs` (YouTube) → `scripts/deliver.mjs` (Telegram to phone) → `scripts/geo.mjs` (weekly US share of views). Read `README.md` first, then `UPGRADE-BRIEF.md` (the audit that motivated the redesign) and `REDESIGN-PROMPT.md` (the brief the other model worked from).

## What was done today (17 commits on `main`, `af41183..HEAD`)

Run `git log --stat af41183..HEAD` and read every commit. In summary: five new "artifact" scene types (posting, rejection, market, comp, terminal) in `src/scenes/`; a vocabulary linter (`scripts/lint.mjs`) that fails the build on Indian-English job vocabulary, identity claims, protected Vault prompts 1/2/3/26, unsourced numbers, missing keyword CTA, and pinned comments with no link; a seeding pack to Telegram; a geography feedback loop via the YouTube Analytics API; loop-back tail, generated music bed, character-budgeted captions; upload metadata fixes; stock-photo backdrops from Pixabay graded to a duotone; a rejection scene and product mention added to all five written videos in `sheet/*.csv`.

## What I want you to check, in this order

1. **Correctness of the pipeline end to end.** Run `npm install`, `pip install edge-tts`, then `npm run build -- sample` and `npm run build -- showcase`. Both must produce `out/<id>.mp4`, `.cover.jpg`, `.post.txt`, `.meta.json` with no errors. Then `node scripts/sheet.mjs 2026-08-28` through `2026-09-01` with `SHEET_ID` unset (reads `sheet/*.csv` from disk). All five must pass the linter.
2. **Look at the frames.** `npm run stills -- showcase` and `npm run stills -- sample`, then open every JPG in `out/stills/`. Report any text that overflows, overlaps, wraps into mush, or sits under the caption band. Also extract frames from a full render at 2 fps and check for static holds longer than ~6s with nothing moving and no captions.
3. **The linter's judgment.** Read `scripts/lint.mjs`. Is the deny list complete for Indian-English job vocabulary? Is the US-signal list going to produce false positives ("senior", "req", "blind")? Is the identity-claim regex too broad or too narrow? Would any of the five approved rows be blocked wrongly?
4. **Did anything violate the brief's hard constraints?** `content/links.json` existing values unchanged; no secrets in tracked files (`git grep` for the Pixabay key prefix `41791193` across all history must return nothing; `.env` must be untracked); the five approved content rows preserved (compare `git show af41183:sheet/scenes.csv` against HEAD column by column — only additions allowed); word-boundary timing untouched; one source of truth for copy (`out/<id>.meta.json`); brand palette; nothing claims to be American, a recruiter, or a hire.
5. **Two decisions the other model made that I want a second opinion on.**
   - Hook guard is warn >2.5s / fail >3.0s rather than the brief's hard 2.5s, because two approved rows would have failed. Right call or not?
   - Stock photo backdrops on every non-card scene by default. The redesign principle is "exclusionary specificity"; generic photos cut against it. The operator asked for them anyway. Is the duotone grade enough to keep them on-brand, or should they be off by default?
6. **What is missing.** Given the single goal — every video should produce a sale of the $19 toolkit — what is the highest-leverage thing the pipeline still does not do? Be concrete: a file, a column, a check. Do not propose paid tools, a face, a real name, or anything that needs a Business Instagram account.
7. **What is extra.** Anything built today that a lazy senior engineer would delete. Speculative abstractions, dead code, a check nobody will ever trip.

## Report back

- A ranked list of defects, most severe first, each with the file and line and how to reproduce.
- Your answers to the two decisions in item 5, one paragraph each.
- Your answer to items 6 and 7.
- A one-line verdict: ship as is, ship after fixes, or do not ship.

Do not summarise the codebase back to me. I wrote the brief and read every commit. Tell me what is wrong.
