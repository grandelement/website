#!/usr/bin/env python3
import json
import math
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "radio" / "loudness.json"
TARGET_LUFS = -16.0
BASE_VOLUME = 0.50
MIN_VOLUME = 0.12
EXTS = {".mp3", ".m4a", ".wav", ".ogg", ".flac", ".aac"}

def git_blob_sha(path: Path) -> str:
    return subprocess.check_output(
        ["git", "hash-object", str(path)],
        cwd=ROOT,
        text=True
    ).strip()

def safe_float(value):
    try:
        x = float(value)
        return x if math.isfinite(x) else None
    except Exception:
        return None

def analyze(path: Path):
    cmd = [
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-af", f"loudnorm=I={TARGET_LUFS}:TP=-1.5:LRA=11:print_format=json",
        "-f", "null", "-"
    ]
    proc = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True)
    text = proc.stderr or ""
    matches = re.findall(r'\{\s*"input_i"[\s\S]*?\}', text)
    if not matches:
        raise RuntimeError(f"ffmpeg loudness analysis failed for {path}")
    data = json.loads(matches[-1])

    lufs = safe_float(data.get("input_i"))
    true_peak = safe_float(data.get("input_tp"))
    lra = safe_float(data.get("input_lra"))
    threshold = safe_float(data.get("input_thresh"))

    if lufs is None:
        gain_db = 0.0
        volume = BASE_VOLUME
    else:
        gain_db = TARGET_LUFS - lufs
        volume = BASE_VOLUME * (10 ** (gain_db / 20.0))
        volume = max(MIN_VOLUME, min(1.0, volume))

    return {
        "lufs": None if lufs is None else round(lufs, 2),
        "truePeakDb": None if true_peak is None else round(true_peak, 2),
        "lra": None if lra is None else round(lra, 2),
        "threshold": None if threshold is None else round(threshold, 2),
        "gainDb": round(gain_db, 2),
        "volume": round(volume, 4),
    }

def load_existing():
    try:
        data = json.loads(OUT.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}

def main():
    existing = load_existing()
    old_files = existing.get("files", {}) if isinstance(existing.get("files"), dict) else {}

    paths = []
    for folder in (ROOT / "ge-music" / "music", ROOT / "ge-music" / "clips"):
        if folder.exists():
            for path in folder.rglob("*"):
                if path.is_file() and path.suffix.lower() in EXTS:
                    paths.append(path)

    files = {}
    changed = 0
    reused = 0

    for path in sorted(paths):
        rel = path.relative_to(ROOT).as_posix()
        sha = git_blob_sha(path)
        old = old_files.get(rel)
        if isinstance(old, dict) and old.get("sha") == sha and old.get("volume") is not None:
            files[rel] = old
            reused += 1
            continue

        print(f"Analyzing {rel}", flush=True)
        try:
            result = analyze(path)
            result["sha"] = sha
            result["bytes"] = path.stat().st_size
            files[rel] = result
            changed += 1
        except Exception as exc:
            print(f"WARNING: {exc}", flush=True)
            files[rel] = {
                "sha": sha,
                "bytes": path.stat().st_size,
                "lufs": None,
                "truePeakDb": None,
                "lra": None,
                "threshold": None,
                "gainDb": 0.0,
                "volume": BASE_VOLUME,
                "error": str(exc)[:240],
            }

    payload = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "method": "ffmpeg loudnorm analysis; native-player volume compensation",
        "targetLufs": TARGET_LUFS,
        "baseVolume": BASE_VOLUME,
        "minVolume": MIN_VOLUME,
        "files": files,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(files)} files, {changed} analyzed, {reused} reused.")

if __name__ == "__main__":
    main()
