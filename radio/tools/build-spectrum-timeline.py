#!/usr/bin/env python3
"""Measure true bass/mid/treble energy from approved GE MP3 files.

Produces small, time-indexed envelopes so iPhone Safari can animate the Sun
without owning, muting, duplicating, or replacing the audible native player.
These are measured samples from the song, not synthetic heartbeat values.
"""
import argparse
import base64
import json
import math
import subprocess
from pathlib import Path
from urllib.parse import quote

SAMPLE_RATE = 8000
FRAME_MS = 100
SAMPLES_PER_FRAME = SAMPLE_RATE * FRAME_MS // 1000
LOW_ALPHA = 1 - math.exp(-2 * math.pi * 180 / SAMPLE_RATE)
HIGH_ALPHA = 1 - math.exp(-2 * math.pi * 2400 / SAMPLE_RATE)


def encode_level(energy):
    rms = math.sqrt(energy / SAMPLES_PER_FRAME)
    db = 20 * math.log10(max(rms, 0.00001))
    return max(0, min(255, round((db + 68) * 4.0)))


def measure(path):
    command = [
        "ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error",
        "-i", str(path), "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE),
        "-f", "s16le", "-acodec", "pcm_s16le", "pipe:1"
    ]
    p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    frames = bytearray()
    low = 0.0
    upper = 0.0
    try:
        while True:
            pcm = p.stdout.read(SAMPLES_PER_FRAME * 2)
            if len(pcm) != SAMPLES_PER_FRAME * 2:
                break
            bass = mids = highs = 0.0
            # A lightweight three-band signal-energy filter, not an FFT.
            for (v,) in __import__('struct').iter_unpack("<h", pcm):
                sample = v / 32768.0
                low += LOW_ALPHA * (sample - low)
                upper += HIGH_ALPHA * (sample - upper)
                mid = upper - low
                high = sample - upper
                bass += low * low
                mids += mid * mid
                highs += high * high
            frames.extend((encode_level(bass), encode_level(mids), encode_level(highs)))
    finally:
        p.stdout.close()
        try:
            p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            p.kill()
            p.wait()
    if p.returncode != 0 or not frames:
        raise RuntimeError("Audio analysis did not produce a complete track: " + str(path))
    return base64.b64encode(frames).decode("ascii"), len(frames) // 3


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--manifest", default="radio/manifest.json")
    cli.add_argument("--output", default="radio/eq/library-spectrum.json")
    args = cli.parse_args()
    data = json.loads(Path(args.manifest).read_text(encoding="utf8"))
    paths = sorted(set(path for path in data.get("files", [])
                       if path.startswith("ge-music/music/")
                       and path.lower().endswith((".mp3", ".m4a", ".ogg", ".wav"))))
    tracks = {}
    skipped = []
    for i, filename in enumerate(paths, 1):
        path = Path(filename)
        if not path.is_file() or path.stat().st_size < 1024:
            skipped.append(filename)
            continue
        try:
            packed, n = measure(path)
            tracks["/" + quote(filename, safe="/!'()*-._~")] = {"frames": packed, "count": n}
            print(f"{i}/{len(paths)} measured {filename}: {n} frames", flush=True)
        except Exception as error:
            skipped.append(filename)
            print("SKIPPED:", filename, str(error), flush=True)
    if not tracks:
        raise SystemExit("No playable tracks were measured; not overwriting spectrum file")
    result = {
        "format": "ge-song-3band-timeline-v1",
        "frame_ms": FRAME_MS,
        "tracks": tracks,
        "skipped_count": len(skipped)
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, separators=(",", ":")), encoding="utf8")
    print(f"Saved {len(tracks)} authentic song energy timelines to {output}", flush=True)


if __name__ == "__main__":
    main()
