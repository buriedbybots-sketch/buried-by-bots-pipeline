# Review prompt — paste into a fresh Opus 5 chat with this repo open

Second-round version. The first review (2026-09-04) found eleven defects; all were fixed in commit `626c2e7` and later. This round has to prove those fixes hold and then find what the first round missed — by watching the newest video, not reading about it.

---

You are reviewing a Shorts pipeline another model (Fable 5.1) built and then revised after a previous Opus review. Be adversarial. I want defects, not compliments. If you find nothing wrong in an area, say "checked, nothing" and move on.

**Project root:** `C:\Users\claude space\Marketing\buried-by-bots-pipeline`. Read-only is fine; if you fix something, commit it to a branch called `review2` and do not push.

**What the repo is.** A faceless, pseudonymous YouTube Shorts / Instagram Reels pipeline for a channel called Buried by Bots, selling a $19 prompt toolkit called Hired by AI to US tech job seekers. The operator is a student in Chennai with a $0 budget. Google Sheet → `scripts/sheet.mjs` → `scripts/tts.py` (edge-tts word boundaries drive all timing) → `scripts/build.mjs` (Remotion) → `scripts/upload.mjs` (YouTube) → `scripts/deliver.mjs` (Telegram) → `scripts/geo.mjs` + `scripts/sales.mjs` (weekly US share of views and sales per video). Read `README.md` first, then `UPGRADE-BRIEF.md` and `REDESIGN-PROMPT.md`.

**What the previous review found and what was done.** Run `git log --stat af41183..HEAD`. The commit `626c2e7` message lists every fix: a two-tier geography check, a thicker deny list, a wider identity net, hashed protected-prompt fingerprints that fail CI when absent, scene 1 must be a hook, five distinct framing scenes, posting-scene motion, quoted shell args, per-video Gumroad discount codes with a sales report.

## Do this, in order

### 1. Build it

```bash
npm install
pip install edge-tts
node scripts/sheet.mjs 2026-08-28     # SHEET_ID unset → reads sheet/*.csv from disk
npm run build -- 2026-08-28
```

It must produce `out/2026-08-28.mp4`, `.cover.jpg`, `.post.txt`, `.meta.json` with no errors. Note every warning the linter prints and say whether each one is right.

### 2. Watch the newest video frame by frame

This is the part the first review skipped and the part that matters most. Do not skim stills. Extract every frame at 2 fps, tile them into contact sheets, and open every sheet. The bundled ffmpeg is at `node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe` (its `fps` and `tile` filters are stripped, so use `-r 2` and tile with PIL):

```bash
node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe -y -loglevel error -i out/2026-08-28.mp4 -r 2 -vf scale=270:-1 out/frames/f%03d.jpg
```

```python
from PIL import Image; import glob, math
fs = sorted(glob.glob('out/frames/f*.jpg')); w, h = Image.open(fs[0]).size
for si in range(0, len(fs), 30):
    chunk = fs[si:si+30]; sheet = Image.new('RGB', (6*w, math.ceil(len(chunk)/6)*h))
    for i, f in enumerate(chunk): sheet.paste(Image.open(f), ((i%6)*w, (i//6)*h))
    sheet.save(f'out/frames/sheet-{si//30+1}.jpg', quality=85)
```

For every scene, report:
- **Holds.** Any stretch over 4 seconds where nothing on screen changes except captions. Name the scene and the length.
- **Silence.** Any stretch where the voice is speaking and no captions are visible. (Captions are suppressed only when the card already shows what the voice says; check that rule held.)
- **Overflow.** Text touching or crossing a card edge, the caption band, or the top handle. Overlaps between the handle, the rank counter and anything else.
- **The backdrops.** Open every file in `public/photos/2026-08-28/`. Any person, hand, face, silhouette or logo is a defect. Then say whether the duotone grade actually reads as a deliberate look at thumbnail size, or as a photo pasted under text.
- **The loop.** Compare the last frame to frame 40. They should be the same settled hook, backdrop included.
- **The one-frame test.** Pick the single frame you would put in front of a stranger. Does it say "US tech hiring" without the audio? If no frame does, that is a finding.

Then do the same watch on `out/showcase.mp4` (`npm run build -- showcase`), which exercises the five artifact scenes — posting, rejection, market, comp, terminal — that 08-28 does not use.

### 3. Try to get a bad video through the linter

Write the worst rows you can and run them through `node scripts/lint.mjs`. Aim for each of these and report which ones you got past it:
- A transcript that would read as Indian to a US viewer but contains none of the listed deny words.
- A claim of insider identity phrased in a way the regex misses.
- A `terminal` scene that leaks protected-prompt text (generate `content/protected.json` from any four paragraphs of your own using `node scripts/protect.mjs <file>` to test the mechanism).
- A video with the conversion path broken in a way the linter accepts.
- A video with zero geography signal that still passes without a warning.

Report the exact `vo` text that got through, and the fix.

### 4. Hard constraints

`content/links.json` original values unchanged. No secrets tracked (`.env` untracked; `git grep` for any token-shaped string). The five approved rows preserved: `git show af41183:sheet/scenes.csv` against HEAD, column by column — additions and the corrected spelling `behavioural → behavioral` in the 09-01 description are the only allowed differences; the two `vo` edits from the first review must be reverted. Word-boundary timing untouched. One source of truth for copy in `out/<id>.meta.json`. Nothing claims to be American, a recruiter, or a hire.

### 5. Second opinions

- The build now fails in CI when `content/protected.json` is missing. Right call, or does it just guarantee the first cron run is red?
- Per-video Gumroad codes ride inside the product URL (`…/l/zpydx/YT0828`). Check the Gumroad API calls in `scripts/lib/gumroad.mjs` against the current v2 docs. Will `POST /products/:id/offer_codes` with `amount_off=10, offer_type=percent` actually create a 10% code? Will `GET /sales` return `offer_code` on each sale? If either is wrong, the whole attribution loop is decorative.
- Stock backdrops default on, kept against the first review's advice on the operator's instruction. Having now watched the video: does it help or hurt the one-frame test above?

### 6. What is still missing

Given the single goal — every video sells the $19 toolkit — what is the highest-leverage thing the pipeline still does not do? A file, a column, a check. No paid tools, no face, no real name, nothing needing a Business Instagram account.

### 7. What to delete

Anything a lazy senior engineer would remove now.

## Report back

- A ranked list of defects, most severe first, each with file, line, and repro. Frame findings cite the frame number.
- The linter bypasses you found, with the exact text.
- One paragraph on each item in section 5.
- Answers to 6 and 7.
- One-line verdict: ship as is, ship after fixes, or do not ship.

Do not summarise the codebase back to me. Tell me what is wrong, and what a viewer would see that I would not.
