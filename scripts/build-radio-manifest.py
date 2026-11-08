#!/usr/bin/env python3
"""Rebuild the public GE Radio inventory from committed music and station IDs.
Does not modify Radio Master approvals, durations, access, or purchase records.
"""
import datetime
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest_path = root / "radio" / "manifest.json"
music = root / "ge-music" / "music"
clips = root / "ge-music" / "clips"
allowed = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"}
if not music.is_dir():
    raise SystemExit("Missing ge-music/music; refusing to overwrite manifest")
existing = json.loads(manifest_path.read_text(encoding="utf-8"))
old_files = existing.get("files", [])
if not isinstance(old_files, list):
    raise SystemExit("Invalid existing manifest")
files = sorted(
    str(p.relative_to(root)).replace("\\", "/")
    for folder in (music, clips)
    if folder.is_dir()
    for p in folder.rglob("*")
    if p.is_file() and p.suffix.lower() in allowed
)
if not files:
    raise SystemExit("No music files found; refusing to publish an empty manifest")
if files == sorted(old_files):
    print("Manifest is already current")
else:
    data = dict(existing)
    data["generatedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    data["files"] = files
    manifest_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated manifest: {len(files)} audio files")
