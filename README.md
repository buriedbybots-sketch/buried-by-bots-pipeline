# Buried by Bots — Shorts pipeline

Motion-graphics vertical video for `@buriedbybots`. One JSON file in, one 1080x1920 MP4 out, voiced and captioned.

Rebuilt from scratch 2026-08-23 — the old stickfigure pipeline did not survive the device migration, so nothing was cloned.

## Run it

```bash
npm install                    # once
pip install edge-tts           # once
npm run build -- sample        # voices + renders content/sample.json -> out/sample.mp4
npm run studio                 # live preview while editing the look
```

## How it works

1. `scripts/tts.py` sends each scene's `vo` line to **edge-tts** (free Microsoft neural voice, `en-US-AndrewMultilingualNeural`) and keeps the **word boundaries** it reports back.
2. Those timings become two things: how long each scene runs, and when each caption word highlights. Nothing is hand-timed.
3. **Remotion** renders the composition frame by frame in headless Chrome and muxes the audio. It ships its own ffmpeg — nothing else to install.

## Content format

`content/<id>.json`:

```json
{
  "id": "2026-08-28",
  "title": "YouTube title",
  "music": "bed.mp3 or null",
  "scenes": [ { "type": "...", "vo": "what the voice says", ...scene props } ]
}
```

`vo` is required on every scene — it's what sets the timing. Scene types:

| type | props | what it does |
|---|---|---|
| `hook` | `text`, `accent`, `head?` | Words spring in staggered; `accent` word turns orange with an underline swipe |
| `rank` | `to`, `total`, `caption?` | The signature shot — the stack scrolls and stops on the buried orange sheet |
| `stat` | `value`, `suffix`, `label`, `source` | Number counts up. **`source` is not optional in practice** — the channel rule is no number on screen without one |
| `prompt` | `title`, `lines[]` | Terminal card that types itself out |
| `test` | `step`, `result`, `kicker?` | A thing the viewer can do in 60 seconds that returns a bad result about their own resume |
| `cta` | `text`, `keyword?`, `sub?` | The channel mark assembles, then the line |

Every scene cuts in on an orange scan wipe. Captions sit above the YouTube UI zone (`SAFE_BOTTOM` in `src/theme.js`), and switch off automatically on `hook` and `cta` scenes, which already put their line on screen at 130px.

Adding a scene type means one component in `src/scenes.jsx` and one line in the `SCENES` map at the bottom.

**Two scene types carry the selling, and they do different jobs.** `prompt` proves the product is good. `test` proves the viewer has the problem. A stranger who watched 30 seconds of resume advice doesn't want a toolkit — they want to know whether *their* resume is broken. The `test` scene is what makes them find out.

**`cta` should almost always set `keyword`.** "Link in bio" costs a viewer four taps; a comment costs one, is itself an engagement signal, and on Instagram a bot can DM the link back automatically. The link still lives in the YouTube pinned comment — see the `pinned` column.

## What each build produces

| File | Use |
|---|---|
| `out/<id>.mp4` | The video, both platforms |
| `out/<id>.cover.jpg` | Reel cover — Instagram picks a mid-transition frame otherwise |
| `out/<id>.post.txt` | YouTube title, description, **pinned comment**, and the Instagram caption, ready to paste |

The build fails rather than renders if the voiceover totals more than 58 seconds, since anything over 60 loses Shorts eligibility.

## Music

Drop a track in `public/music/` and name it in the content JSON. It plays at 11% under the voice and fades out at the end.

Use the **YouTube Audio Library** — it's free and already cleared for YouTube, which matters because a copyright claim on a monetised Short is worse than having no music. Use a track of at least 60 seconds; short ones just end early rather than looping.

## The scheduled version

`.github/workflows/daily.yml` runs the same three scripts on a cron: pull the day's row from the sheet, render it, upload it. Free — a 35-second Short is a couple of minutes of runner time, and the free tier is 2,000 minutes a month.

```
sheet.mjs <date>   ->  content/<date>.json     (published-CSV read, no API key)
build.mjs <date>   ->  out/<date>.mp4          (edge-tts + Remotion)
upload.mjs <date>  ->  youtube.com/shorts/...  (OAuth refresh token)
```

The mp4 is also saved as a workflow artifact, so a failed upload still leaves you a finished video to post by hand.

### Setting it up

**1. The sheet.** Import `sheet/videos.csv` and `sheet/scenes.csv` as two tabs named exactly `videos` and `scenes` — they're pre-filled with the sample video as a worked example. One row per video in `videos`, one row per scene in `scenes`, joined on `date`. Then **File → Share → Publish to web**, and put the id from the sheet's URL in the `SHEET_ID` secret.

Published means publicly readable. Scripts and captions aren't secret, and it buys us out of service accounts entirely — but don't put anything private in that sheet.

**2. YouTube.** In Google Cloud: new project → enable YouTube Data API v3 → OAuth client (Desktop app) → consent screen with the `youtube.upload` scope, your channel Google account added as a test user. Run the consent flow once locally to get a refresh token. Secrets: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`.

**Expect uploads to land as private.** An unaudited project can't publish publicly through the API — that's Google's rule, not a bug here. Flipping each one public in YouTube Studio takes 20 seconds and is faster than waiting on the audit. `PRIVACY` is a workflow input for when the audit clears.

**3. Timing.** The cron is 13:00 UTC — 6:30 PM IST, 9:00 AM ET, the US morning window from the 30-day plan. GitHub delays scheduled runs under load, so treat it as "sometime in the next hour."

### Before turning the cron on

The format has to be proven on real views first. Automating an unvalidated video format just produces the wrong video faster — run it on `workflow_dispatch` for the first week and watch the retention graphs.

## Deliberate limits

- Scene length comes from the last TTS word boundary plus a 280 ms tail, not from decoding the mp3 — keeps ffprobe out of the dependency list. If a scene ever ends visibly early, read the real duration instead.
- Music doesn't loop and there's no sidechain ducking, just a fixed level under the voice.
- Captions show a rolling window of six words. Longer windows get unreadable at this size.
