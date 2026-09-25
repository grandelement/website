#!/usr/bin/env python3
import json
import os
import random
import re
import secrets
import subprocess
import time
import urllib.parse
from pathlib import Path

REPO = "grandelement/website"
REPO_URL = "https://github.com/grandelement/website.git"
BRANCH = "main"
CHECK_SECONDS = 900
AUDIO_EXTS = (".mp3", ".m4a", ".wav", ".aac", ".ogg", ".oga", ".flac")

RUNTIME = Path("/app/runtime")
DATA = Path(os.environ.get("GE_DATA_DIR", "/app/data"))
DATA.mkdir(parents=True, exist_ok=True)
META_REPO = RUNTIME / "repo-meta"
PLAYLIST = RUNTIME / "playlist.m3u"
ROTATION = RUNTIME / "rotation.json"
LIBRARY = RUNTIME / "library.json"
SETTINGS = DATA / "settings.json"
CUSTOM_PLAYLISTS = DATA / "custom-playlists.json"

CORE_ALBUMS = {"intergy", "love", "soul", "spirit", "fire"}
LEGACY_ALBUMS = {"fundamental groove", "trio", "live", "sessions i", "sessions ii"}

def atomic_text(path, text):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)

def atomic_json(path, value):
    atomic_text(path, json.dumps(value, ensure_ascii=False, indent=2))

def load_settings():
    settings = {
        "legacy": False,
        "crossfade_seconds": 5.0,
        "custom_mix_enabled": False,
        "custom_mix_id": "",
    }
    try:
        data = json.loads(SETTINGS.read_text(encoding="utf-8"))
        settings["legacy"] = bool(data.get("legacy", False))
        settings["crossfade_seconds"] = max(0.0, min(12.0, float(data.get("crossfade_seconds", 5.0))))
        settings["custom_mix_enabled"] = bool(data.get("custom_mix_enabled", False))
        settings["custom_mix_id"] = str(data.get("custom_mix_id", "") or "")
    except Exception:
        pass
    if not SETTINGS.exists():
        atomic_json(SETTINGS, settings)
    return settings

def load_custom_playlists():
    try:
        data = json.loads(CUSTOM_PLAYLISTS.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            return data.get("items", [])
    except Exception:
        pass
    return []

def active_custom_paths(settings):
    if not settings.get("custom_mix_enabled"):
        return None
    playlist_id = str(settings.get("custom_mix_id", "") or "")
    for item in load_custom_playlists():
        if str(item.get("id", "")) == playlist_id:
            paths = [str(x) for x in item.get("paths", []) if str(x)]
            return paths
    return []

def git_run(args, timeout=90):
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    proc = subprocess.run(
        ["git", "-C", str(META_REPO), *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
        timeout=timeout,
    )
    if proc.returncode != 0:
        msg = proc.stderr.strip() or proc.stdout.strip() or "git command failed"
        raise RuntimeError(msg)
    return proc.stdout

def ensure_meta_repo():
    if (META_REPO / ".git").exists():
        return
    META_REPO.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["git", "-C", str(META_REPO), "init", "-q"],
        check=True, timeout=30
    )
    subprocess.run(
        ["git", "-C", str(META_REPO), "remote", "add", "origin", REPO_URL],
        check=True, timeout=30
    )

def album_name(path):
    rel = path.split("ge-music/music/", 1)[1]
    folder = rel.split("/", 1)[0]
    parts = folder.split(" - ")
    return parts[-1].strip() if parts else folder.strip()

def clean_title(path):
    stem = Path(path).stem
    stem = re.sub(r"^[A-Za-z ]+[_ -]\d{1,2}[_ -]+", "", stem)
    return stem.replace("_", " ").strip() or Path(path).stem

def fetch_library():
    # Important: this intentionally uses normal Git, NOT api.github.com.
    # Blitz uses shared outbound IPs and anonymous GitHub REST API requests can
    # hit a shared 60/hour limit. A shallow blobless fetch avoids that dependency.
    ensure_meta_repo()
    git_run([
        "-c", "protocol.version=2",
        "fetch", "-q", "--force", "--depth=1", "--filter=blob:none",
        "origin", BRANCH
    ])
    commit_sha = git_run(["rev-parse", "FETCH_HEAD"]).strip()
    listing = git_run([
        "-c", "core.quotePath=false",
        "ls-tree", "-r", "FETCH_HEAD", "--",
        "ge-music/music", "ge-music/clips"
    ])

    songs, clips = [], []
    for line in listing.splitlines():
        try:
            left, path = line.split("\t", 1)
            _, obj_type, sha = left.split(" ", 2)
        except ValueError:
            continue
        if obj_type != "blob":
            continue

        lower = path.lower()
        if not lower.endswith(AUDIO_EXTS):
            continue

        if lower.startswith("ge-music/music/"):
            album = album_name(path)
            songs.append({
                "path": path,
                "sha": sha,
                "album": album,
                "title": clean_title(path),
            })
        elif lower.startswith("ge-music/clips/") and "station identification" in lower:
            clips.append({
                "path": path,
                "sha": sha,
                "album": "GE Radio",
                "title": "Grand Element Radio",
            })

    if not songs:
        raise RuntimeError("No Grand Element songs found in the Git tree.")

    return commit_sha, songs, clips

def raw_url(commit_sha, path):
    encoded = urllib.parse.quote(path, safe="/")
    return f"https://raw.githubusercontent.com/{REPO}/{commit_sha}/{encoded}"

def q(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"')

def annotation(entry, commit_sha, cross=None):
    fields = [
        'artist="Grand Element"',
        f'title="{q(entry["title"])}"',
        f'album="{q(entry["album"])}"',
        f'ge_kind="{q(entry["kind"])}"',
        f'ge_slot="{q(entry["slot"])}"',
    ]
    if cross is not None:
        fields.append(f'liq_cross_duration="{cross:.1f}"')
    return "annotate:" + ",".join(fields) + ":" + raw_url(commit_sha, entry["path"])

def eligible_songs(songs, settings):
    custom_paths = active_custom_paths(settings)
    if custom_paths is not None:
        wanted = set(custom_paths)
        return [song for song in songs if song.get("path") in wanted]

    selected = []
    legacy = bool(settings.get("legacy", False))
    for song in songs:
        album = song["album"].strip().lower()
        if album in CORE_ALBUMS or (legacy and album in LEGACY_ALBUMS):
            selected.append(song)
    return selected

def save_library(commit_sha, songs, clips):
    items = []
    for song in songs:
        album_key = song["album"].strip().lower()
        if album_key in CORE_ALBUMS:
            section = "core"
        elif album_key in LEGACY_ALBUMS:
            section = "legacy"
        elif album_key == "singles":
            section = "singles"
        else:
            section = "other"
        items.append({
            "kind": "song",
            "title": song["title"],
            "picker_title": song["title"],
            "album": song["album"],
            "path": song["path"],
            "section": section,
        })

    for clip in clips:
        label = clean_title(clip["path"])
        items.append({
            "kind": "station_id",
            "title": "Grand Element Radio",
            "picker_title": label,
            "album": "Station Identification",
            "path": clip["path"],
            "section": "station_ids",
        })

    atomic_json(LIBRARY, {
        "commit": commit_sha,
        "generated_at": int(time.time()),
        "items": items,
    })

def build_rotation(commit_sha, songs, clips, settings):
    songs = eligible_songs(songs, settings)
    if not songs:
        if settings.get("custom_mix_enabled"):
            raise RuntimeError("The active Custom Mix has no available songs.")
        raise RuntimeError("No eligible Grand Element songs found for the current rotation.")

    legacy = bool(settings.get("legacy", False))
    crossfade = max(0.0, min(12.0, float(settings.get("crossfade_seconds", 5.0))))

    rng = random.Random(secrets.randbits(128))
    rotation = []
    playlist_lines = ["#EXTM3U"]
    last_clip_path = None
    slot_counter = 0

    for pass_no in range(1, 13):
        pass_songs = [dict(x) for x in songs]
        rng.shuffle(pass_songs)
        pos = 0

        while pos < len(pass_songs):
            block_size = rng.randint(4, 6)
            block = pass_songs[pos:pos + block_size]
            pos += block_size

            chosen_clip = None
            if clips and pos <= len(pass_songs):
                choices = [c for c in clips if c["path"] != last_clip_path] or clips
                chosen_clip = dict(rng.choice(choices))
                last_clip_path = chosen_clip["path"]

            for idx, song in enumerate(block):
                slot_counter += 1
                entry = dict(song)
                entry["kind"] = "song"
                entry["slot"] = f"{pass_no:02d}-{slot_counter:04d}"
                rotation.append({k: entry[k] for k in ("slot","kind","title","album","path")})
                short_to_id = chosen_clip is not None and idx == len(block) - 1
                playlist_lines.append(
                    annotation(entry, commit_sha, cross=1.2 if short_to_id else crossfade)
                )

            if chosen_clip:
                slot_counter += 1
                chosen_clip["kind"] = "station_id"
                chosen_clip["slot"] = f"{pass_no:02d}-{slot_counter:04d}"
                rotation.append({k: chosen_clip[k] for k in ("slot","kind","title","album","path")})
                playlist_lines.append(annotation(chosen_clip, commit_sha, cross=1.2))

    atomic_text(PLAYLIST, "\n".join(playlist_lines) + "\n")
    atomic_json(ROTATION, {
        "commit": commit_sha,
        "legacy": legacy,
        "crossfade_seconds": crossfade,
        "custom_mix_enabled": bool(settings.get("custom_mix_enabled", False)),
        "custom_mix_id": str(settings.get("custom_mix_id", "") or ""),
        "generated_at": int(time.time()),
        "entries": rotation,
    })
    custom_label = "off"
    if settings.get("custom_mix_enabled"):
        custom_label = str(settings.get("custom_mix_id", "") or "missing")
    print(
        f"GE Radio: rotation rebuilt: {len(songs)} songs, "
        f"legacy={'on' if legacy else 'off'}, custom={custom_label}, "
        f"crossfade={crossfade:.1f}s, {len(clips)} station IDs.",
        flush=True,
    )

def main():
    RUNTIME.mkdir(parents=True, exist_ok=True)
    cached = None
    last_repo_check = 0.0
    last_signature = None

    while True:
        try:
            settings = load_settings()
            now = time.time()

            if cached is None or now - last_repo_check >= CHECK_SECONDS:
                try:
                    cached = fetch_library()
                    last_repo_check = now
                except Exception as exc:
                    if cached is None:
                        raise
                    print(
                        f"GE Radio: Git metadata refresh warning; continuing with "
                        f"the current library: {exc}",
                        flush=True,
                    )
                    last_repo_check = now

            commit_sha, songs, clips = cached
            save_library(commit_sha, songs, clips)
            custom_paths = active_custom_paths(settings)
            custom_sig = ",".join(custom_paths or []) if settings.get("custom_mix_enabled") else ""
            signature = (
                f"{commit_sha}|legacy={int(settings['legacy'])}"
                f"|custom={int(settings.get('custom_mix_enabled', False))}"
                f"|custom_id={settings.get('custom_mix_id','')}"
                f"|paths={custom_sig}"
            )
            if not PLAYLIST.exists() or signature != last_signature:
                build_rotation(commit_sha, songs, clips, settings)
                last_signature = signature

        except Exception as exc:
            print(f"GE Radio: library metadata warning: {exc}", flush=True)
            if not PLAYLIST.exists():
                time.sleep(10)
                continue

        time.sleep(2)

if __name__ == "__main__":
    main()
