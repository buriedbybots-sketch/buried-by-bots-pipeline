# Interrupt message — send this to Fable now

Paste this into the Fable chat. It supersedes the "push when ready" line in the previous handoff.

---

**Hold the push.** Do not push anything to GitHub yet. Merging `review2` into `main` locally is fine and correct — just keep it local until the list below is genuinely done, then push once.

The reason: a push right now would put a `main` on GitHub whose very first scheduled run fails. The cron builds *today's* row, the sheet holds `2026-08-28` through `2026-09-01`, and today is `2026-09-04` — `sheet.mjs` throws `no row in "videos" for 2026-09-04`. Pushing before that is fixed just means the first cron run is red and nobody notices for a day.

## Get it push-ready first

**1. Re-date the five rows.** Shift all five to consecutive days starting the day *after* you finish, preserving order and keeping every other cell identical — `date` in `sheet/videos.csv` and `sheet/scenes.csv` both, they join on it. Say in your report exactly which dates you used so the operator can move them.

**2. Merge `review2` into `main` locally.** Two commits: the caption fix and the D1/D3/D4/D5 batch. Then `npm run build -- <the new first date>` and confirm exit 0.

**3. Do the work from the previous handoff** — the linter bypasses, the Gumroad verification, `sales.mjs` exiting 1 without a token, the caption fragment on the cover, the `.gitignore` still naming `protected.txt`, and the missing validation in `protect.mjs`.

**4. Then run the whole chain end to end, locally, as the cron would:**

```
node scripts/sheet.mjs <first date>     # must pass the linter
node scripts/build.mjs <first date>     # must exit 0, four artifacts
node scripts/lint.mjs content/<first date>.json
```

Only when that is clean do you push.

## Two things you cannot finish, and must not fake

- **`content/protected.json`** needs a file containing Vault prompts 1, 2, 3 and 26. Only the operator has that text. Do not generate it from a placeholder to make CI green — the whole point of the gate is that it holds real fingerprints. Stop and ask for the file.
- **The eight GitHub Secrets and the published Google Sheet** are the operator's to create; `DEPLOY.md` lists them. Do not push a `main` that depends on secrets nobody has set without saying so plainly in your report.

## When you push

Push `main` only. Then tell the operator, in one short list:

- the dates you assigned the five videos
- which items from the handoff you completed, and which you could not and why
- exactly what they must do before the first cron run can post: the secrets, the sheet, `protected.json`, and the daily manual steps (flip the upload public, pin the comment, post the Reel, post the seeding comment in the first hour)
- that **`COMMENT "PACK"` is a promise nothing keeps until ManyChat is connected** — every video ends on it, and right now a viewer who comments gets silence

Do not enable or rely on the cron. The operator turns it on when they are ready.
