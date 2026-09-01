# -*- coding: utf-8 -*-
"""Voice the scenes with edge-tts and write back the word timings.

    python scripts/tts.py content/sample.json

Produces public/vo/<id>/<n>.mp3 and content/<id>.audio.json. The audio json is
what tells the composition how long each scene runs and when each caption word
lands, so this has to run before every render.
"""
import asyncio
import json
import os
import sys

import edge_tts

VOICE = "en-US-AndrewMultilingualNeural"   # US male, conversational, free
RATE = "+8%"                               # Shorts pacing; +15% starts to gabble
TAIL_MS = 280                              # beat of silence after the last word


async def speak(text, out_path):
    audio = bytearray()
    words = []
    async for chunk in edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary").stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            # edge-tts reports 100-nanosecond ticks
            words.append(
                {
                    "w": chunk["text"],
                    "t": chunk["offset"] // 10_000,
                    "d": chunk["duration"] // 10_000,
                }
            )
    with open(out_path, "wb") as f:
        f.write(audio)

    # ponytail: scene length comes from the last word boundary rather than
    # decoding the mp3, which keeps ffprobe out of the dependency list. Swap in
    # a real duration read if a scene ever ends visibly early.
    end = words[-1]["t"] + words[-1]["d"] if words else 1000
    return {"durationMs": end + TAIL_MS, "words": words}


async def main(content_path):
    with open(content_path, encoding="utf-8") as f:
        content = json.load(f)

    root = os.path.dirname(os.path.dirname(os.path.abspath(content_path)))
    vo_dir = os.path.join(root, "public", "vo", content["id"])
    os.makedirs(vo_dir, exist_ok=True)

    scenes = []
    for i, scene in enumerate(content["scenes"]):
        vo = scene.get("vo", "").strip()
        if not vo:
            raise SystemExit(f'scene {i} ("{scene.get("type")}") has no "vo" line')
        out = os.path.join(vo_dir, f"{i}.mp3")
        scenes.append(await speak(vo, out))
        print(f'  {i} {scene["type"]:<7} {scenes[-1]["durationMs"] / 1000:5.1f}s  {vo[:52]}')

    total = sum(s["durationMs"] for s in scenes) / 1000
    audio_path = os.path.join(root, "content", f'{content["id"]}.audio.json')
    with open(audio_path, "w", encoding="utf-8") as f:
        json.dump({"scenes": scenes}, f, indent=1)

    print(f"\n  {total:.1f}s total -> {audio_path}")
    if total > 58:
        print("  WARNING: over 58s. YouTube Shorts caps at 60 — trim a scene.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    asyncio.run(main(sys.argv[1]))
