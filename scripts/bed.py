# -*- coding: utf-8 -*-
"""Generate the default music bed: a cold, slow pulse. No dependencies.

    python scripts/bed.py public/music/pulse.wav

Why generated: the YouTube Audio Library is free but needs a browser and a
login, and silence under a synthetic voice reads as cheap. At 11% under the
voice this is texture, not music — a low drone, a fifth above it breathing
slowly, and a soft kick every beat at 84 BPM. Swap in a real track by dropping
it in public/music/ and naming it in the sheet's `music` column.
"""
import math
import struct
import sys
import wave

RATE = 22050
SECONDS = 64
BPM = 84


def sample(t):
    beat = 60.0 / BPM
    # drone: root and fifth, detuned a hair so it moves
    drone = (
        0.55 * math.sin(2 * math.pi * 55.0 * t)
        + 0.25 * math.sin(2 * math.pi * 82.4 * t)
        + 0.20 * math.sin(2 * math.pi * 110.5 * t)
    )
    drone *= 0.75 + 0.25 * math.sin(2 * math.pi * 0.07 * t)  # slow breath
    # kick: a decaying 52Hz sine on every beat, a touch louder on the one
    p = t % beat
    bar = int(t / beat) % 4
    kick = math.sin(2 * math.pi * 52.0 * p) * math.exp(-p * 14.0) * (1.0 if bar == 0 else 0.7)
    # a faint high tick on beats 2 and 4, the "machine" in the room
    tick = math.sin(2 * math.pi * 1760.0 * p) * math.exp(-p * 90.0) * (0.12 if bar in (1, 3) else 0.0)
    return 0.42 * drone + 0.55 * kick + tick


def main(path):
    n = RATE * SECONDS
    frames = bytearray()
    for i in range(n):
        t = i / RATE
        v = sample(t)
        # fade the first and last 100ms so the loop point doesn't click
        edge = min(1.0, i / (RATE * 0.1), (n - i) / (RATE * 0.1))
        v = max(-1.0, min(1.0, v * edge))
        frames += struct.pack("<h", int(v * 32767 * 0.9))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(bytes(frames))
    print(f"  {path}  {SECONDS}s @ {RATE}Hz")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
