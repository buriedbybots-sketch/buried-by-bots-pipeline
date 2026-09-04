# Handoff prompt — round-two review results

Paste everything below the line into the Fable 5.1 chat that built this pipeline, with the repo open.

---

Your redesign was reviewed twice today by a second model. Round one's fixes you already merged. **Round two's are sitting unmerged on branch `review2` and the cron builds from `main`, so no render gets them until you merge.** That is the first thing to do.

You have full write access. Merge, fix what is listed as open, verify, and push when — and only when — the blockers below are cleared.

## What is on `review2` (2 commits, both verified on a real 08-28 render)

**`c3bfb7f` — captions jumped to the end of the scene on every pause.**
`src/Short.jsx`, the `Captions` component. `words.findIndex(w => ms >= w.t && ms < w.t + w.d + 120)` looked for a word whose window *contains* the current time. edge-tts leaves gaps between words, so in every gap `findIndex` returned −1 and the fallback picked `words.length - 1` — the scene's **final** caption line — then snapped back on the next word. Roughly once a second, all video long, in every scene. Invisible in any single frame; only a 2fps watch of the whole render shows it.

Repro on the old build: rank scene at 16.0s and 19.0s flashed `three forty` mid-sentence; the rejection scene flashed `the fold`; the test scene flashed `notepad file`. Fixed by tracking the last word whose start time has passed.

**`b2e964e` — four defects from watching all 113 frames.**

- **The hook was invisible for the first second.** The shared `ease()` is heavily overdamped; on an eight-word line with a 3-frame stagger nothing was legible until frame 29. `src/scenes/core.jsx` now has a dedicated `snap()` spring (damping 26, mass 0.35, stiffness 260) on a 1-frame stagger, opacity clamped because it overshoots past 1. Measured at 15fps on the render: headline hits full brightness at **0.33s**, was ~1.0s.
- **Rank and stat animated on fixed frame counts tuned for 4-second scenes.** `Rank`'s settle was `Math.min(duration * 0.62, 62)` — capped at 62 frames *however long the scene ran* — so an 11-second rank scene sat frozen on `#340` for 8.5 of them. Now `max(45, duration * 0.66)` plus a slow pulse on the buried sheet. `Stat` counted up in under half a second then held for 7; now the count spans 45% of the scene, label at 40%, source chip at 60%, with a long push on the number. **This class of bug will come back** — any timing written as a raw frame count breaks the moment a `vo` line gets longer. Prefer fractions of `durationInFrames`.
- **55.9 seconds.** The five framing lines (your additions, not approved copy) are trimmed to one sentence each → **50.5s**. `build.mjs` gains `TARGET_S = 45` as a soft guard so length is surfaced instead of silently accepted at the 58s platform limit.
- **The Reels cover was hard-coded to `--frame=40`** — scene 1, a bare hook card saying nothing about the audience. `build.mjs` now picks the first scene carrying a `head` kicker or an artifact card. On 08-28 it selects frame 121 / scene 2, and the cover reads `FOR US TECH JOB SEEKERS / WHY YOUR RESUME NEVER GOT READ.`

I re-verified after the sheet edit: **0 approved `vo` lines lost**; the only diffs on approved rows are `order` renumbering and the `sub` cell you had already populated.

## Do this

1. `git merge review2` into `main`. Run `npm run build -- 2026-08-28` and confirm it still exits 0.
2. **Generate `content/protected.json` and commit it.** It does not exist. `enforce()` promotes the missing-file warning to an error when `process.env.CI` is set, so **the next scheduled run goes red**. `npm run protect -- <file containing Vault prompts 1, 2, 3 and 26>`. Also fix `.gitignore`: it still names the old `content/protected.txt`, which is why nobody was reminded to commit the `.json`. And add a sanity check to `protect.mjs` — right now any file with ≥20 shingles produces a "valid" fingerprint file, so the CI gate can be satisfied with the wrong text and nobody would know.
3. **Close these linter bypasses.** Each was proved with the exact text, all returning zero errors:
   - `If you are in Bangalore or Hyderabad and applying to jobs in the US, your resume is sorted the same way.` — `US_STRONG` lists twelve US cities; `DENY` lists no Indian ones. Add Bangalore/Bengaluru, Hyderabad, Pune, Chennai, Gurgaon, Noida, Mumbai, Delhi, Kolkata.
   - `I am a senior engineer at a large tech company…` (an adjective between "a" and "engineer at" defeats the alternation) · `I have sat on the other side of the hiring table in the US for years.` · `At my company in the US we throw out most of these resumes.` · `They hired me in the US after I fixed exactly this.` · `I run hiring for a US startup, so I know what the filter does.` Two of those assert being hired and running hiring. Enumerating verbs is losing an arms race — add a broad first-person-authority *warning* that forces a human to look.
   - A `cta` scene whose `keyword` disagrees with `content/links.json` passes. The video tells viewers to comment one word while the automation listens for another, and nothing reports it. One line: compare the two, error on mismatch.
4. **Verify Gumroad before trusting `sales.mjs`.** Make one real `GET /v2/sales` call and look at the raw JSON. Two specific risks: `offer_code` is not in the documented sale fields — if it is absent, `(s.offer_code || '—')` buckets every sale under `—` and the attribution report is decorative; if it is an *object* rather than a string, `.toUpperCase()` throws. And `gumroad.mjs` increments `page` while the documented cursor is `page_key` / `next_page_url` — if `page` is ignored the loop re-fetches page 1 forever. A safe fallback that needs no sale field at all: `GET /products/:id/offer_codes` returns each code with its usage count.
5. **`sales.mjs` exits 1 when `GUMROAD_TOKEN` is unset**, so the Monday workflow goes red even though the step comment says it is "skipped cleanly" and `geo.yml` runs it with `if: always()`. Match `deliver.mjs`: log and exit 0.
6. **One cosmetic thing I left.** The cover still has a burned-in caption fragment across the bottom (`in the US and hearing`). Suppress captions when rendering the cover still.

## Then push

Push `main` once 1–5 are done and a test build exits 0. Do **not** enable or rely on the cron before `content/protected.json` is committed — that is the one thing that will fail every scheduled run.

## Not yours to decide — leave these for the operator

- **50.5s is still over the 45s target** and the new guard says so on every build. Getting under it means cutting a scene: either the framing hook (its job, naming the audience, is now done by the `head` kicker which is also the cover) or the rejection scene (6.1s, but the strongest artifact in the set). Do not choose; surface it.
- **The stock backdrops.** On 08-28, three of seven are Seoul, Tokyo, and a Russian-language financial report whose Cyrillic is legible behind the captions — on a channel whose stated principle is that every frame should say US tech hiring. The people-filter works (no face in any of the seven) and the duotone genuinely reads as deliberate. The problem is sourcing, not grading. Recommend defaulting `photos` to `none` and filling the cell per row only where the image *is* the signal; the NYC shot under the stat scene is what that looks like when it works.
