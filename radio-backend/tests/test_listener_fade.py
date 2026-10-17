#!/usr/bin/env python3
"""Verify that the ACTUAL listener FFmpeg graph attenuates encoded audio."""
import array
import importlib.util
import math
import pathlib
import subprocess
import sys
import tempfile

BACKEND = pathlib.Path(__file__).resolve().parents[1] / "personal-preview.py"
spec = importlib.util.spec_from_file_location("personal_preview", BACKEND)
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


def run(*args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise AssertionError(result.stderr.decode(errors="replace")[-3000:])
    return result.stdout


def rms(values):
    return math.sqrt(sum(x * x for x in values) / max(1, len(values)))


def test_encoded_fade(seconds, use_reverb=True):
    mode = "rich reverb" if use_reverb else "capacity fallback"
    with tempfile.TemporaryDirectory() as tmp:
        output = str(pathlib.Path(tmp) / "personal.mp3")
        # Constant test tone allows actual output-gain measurements.
        run("ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i",
            "sine=frequency=440:sample_rate=48000:duration=" + str(seconds),
            "-filter_complex", (preview.reverb_filter(seconds) if use_reverb
                                else preview.lightweight_fade_filter(seconds)),
            "-map", "[out]",
            "-c:a", "libmp3lame", "-b:a", "128k", "-y", output)
        pcm = run("ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error",
                  "-i", output, "-f", "f32le", "-ac", "1", "-ar", "48000", "-")
        samples = array.array("f")
        samples.frombytes(pcm)
        def level(start, duration=0.2):
            segment = samples[int(start * 48000):int((start + duration) * 48000)]
            return rms(segment)
        reference = level(0)
        assert reference > 0.02, "Source or encoder is silent"
        fade_start = max(0, seconds - 10)
        if seconds >= 10:
            assert level(fade_start + 1) < reference * 0.96, "Fade did not begin"
            levels = [level(fade_start + tick) for tick in range(1, 9)]
            assert all(a > b for a, b in zip(levels, levels[1:])), (
                "Volume did not fall continuously: " + str(levels))
        else:
            assert level(0) < reference * 1.1, "Late reconnect gain jumped"
        # Encoder-decoded samples must be near digital zero BEFORE cutoff.
        assert level(seconds - 0.1, 0.07) < reference * 0.005, (
            "Output still audible at deadline")
        print(f"{seconds}s {mode}: encoded output fades to silence")


if __name__ == "__main__":
    for seconds in (18, 12, 5):
        for use_reverb in (True, False):
            test_encoded_fade(seconds, use_reverb)
