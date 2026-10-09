#!/usr/bin/env python3
import json
import os
import random
import re
import secrets
import subprocess
import time
import urllib.parse
import urllib.request
import urllib.error
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
RECENT_PLAYED = DATA / "recent-played.json"
NOW = RUNTIME / "now.json"
STATION_PERFORMANCE_STATE = DATA / "station-performance-state.json"

GE_VAULT_URL = os.environ.get("GE_VAULT_URL", "https://vault.grandelement.com").rstrip("/")
GE_VAULT_ADMIN_TOKEN = os.environ.get("GE_VAULT_ADMIN_TOKEN", "").strip()

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


def song_key(song):
    return f"{str(song.get('album','')).strip().lower()}|{str(song.get('title','')).strip().lower()}"

def dedupe_songs(songs):
    seen=set(); out=[]
    for song in songs:
        key=(str(song.get("path", "")), song_key(song))
        if key in seen:
            continue
        seen.add(key); out.append(song)
    return out

def load_recent_played():
    try:
        data=json.loads(RECENT_PLAYED.read_text(encoding="utf-8"))
        vals=data.get("keys", []) if isinstance(data, dict) else []
        return [str(x) for x in vals if str(x)][-12:]
    except Exception:
        return []

def record_station_performance(meta):
    if not GE_VAULT_URL or not GE_VAULT_ADMIN_TOKEN:
        return False
    title=str(meta.get("title", "") or "").strip()
    kind=str(meta.get("ge_kind", "") or "")
    if kind != "song" or not title:
        return False
    album=str(meta.get("album", "") or "").strip()
    path=str(meta.get("ge_path", "") or "").strip()
    key=f"{album}|{title}|{path}"
    previous={}
    try:
        previous=json.loads(STATION_PERFORMANCE_STATE.read_text(encoding="utf-8"))
    except Exception:
        previous={}
    now_ts=int(time.time())
    if previous.get("key")==key and now_ts-int(previous.get("recorded_at", 0) or 0)<60:
        return False
    metadata={
        "source":"ge-radio-automation",
        "ge_kind":kind,
        "ge_slot":str(meta.get("ge_slot", "") or ""),
        "path":path,
    }
    for field in ("ascap_work_id","ascap_title","ascap_status","iswc","writer","publisher"):
        value=str(meta.get(field, "") or "").strip()
        if value:
            metadata[field]=value
    payload={
        "occurred_at":now_ts,
        "session_id":"station-radio",
        "track_id":path or f"{album}|{title}",
        "track_title":title,
        "album":album,
        "playlist_id":"",
        "metadata":metadata,
    }
    req=urllib.request.Request(
        GE_VAULT_URL + "/v1/admin/station-performance",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Authorization":f"Bearer {GE_VAULT_ADMIN_TOKEN}",
            "Content-Type":"application/json",
            "Accept":"application/json",
            "User-Agent":"GE-Radio-Automation/1.0 (+https://grandelement.com)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            if 200 <= int(resp.status) < 300:
                atomic_json(STATION_PERFORMANCE_STATE, {"key":key,"recorded_at":now_ts})
                print(f"GE Radio: Vault station performance logged: {title}", flush=True)
                return True
    except Exception as exc:
        print(f"GE Radio: Vault station performance log failed: {exc}", flush=True)
    return False

def remember_now(last_seen):
    try:
        stat=NOW.stat()
        if stat.st_mtime_ns == last_seen:
            return last_seen
        meta=json.loads(NOW.read_text(encoding="utf-8"))
        kind=str(meta.get("ge_kind", ""))
        title=str(meta.get("title", "")).strip().lower()
        album=str(meta.get("album", "")).strip().lower()
        if kind=="song" and title:
            key=f"{album}|{title}"
            recent=load_recent_played()
            recent=[x for x in recent if x != key] + [key]
            atomic_json(RECENT_PLAYED, {"keys": recent[-12:], "updated_at": int(time.time())})
            record_station_performance(meta)
        return stat.st_mtime_ns
    except Exception:
        return last_seen

def guarded_shuffle(items, rng, avoid_first=None, guard=8):
    rows=[dict(x) for x in items]
    rng.shuffle(rows)
    avoid=set(avoid_first or [])
    if avoid and len(rows)>guard:
        safe=[x for x in rows if song_key(x) not in avoid]
        blocked=[x for x in rows if song_key(x) in avoid]
        rng.shuffle(safe); rng.shuffle(blocked)
        rows=safe[:guard] + blocked + safe[guard:]
    return rows

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

def normalize_work_title(value):
    return re.sub(r"[^A-Z0-9=]+", " ", str(value or "").upper()).strip()

def load_rights_catalog():
    try:
        raw = git_run(["show", "FETCH_HEAD:ge-music/ascap-work-ids.json"])
        data = json.loads(raw)
        out = {}
        for work in data.get("works", []):
            work_id = str(work.get("work_id", "") or "").strip()
            if not work_id:
                continue
            names = [work.get("title", "")] + list(work.get("aliases", []) or [])
            for name in names:
                key = normalize_work_title(name)
                if key:
                    out[key] = {
                        "ascap_work_id": work_id,
                        "ascap_title": str(work.get("title", "") or "").strip(),
                        "ascap_status": str(work.get("status", "") or "").strip(),
                    }
        return out
    except Exception as exc:
        print(f"GE Radio: ASCAP catalog warning: {exc}", flush=True)
        return {}

def clear_stale_git_lock():
    """Remove an abandoned shallow-fetch lock only when no Git process owns the repo."""
    lock = META_REPO / ".git" / "shallow.lock"
    try:
        if not lock.exists() or time.time() - lock.stat().st_mtime < 10:
            return False
        # A live Git operation may be writing this lock. Do not interfere with it.
        for proc in Path("/proc").iterdir():
            if not proc.name.isdigit() or int(proc.name) == os.getpid():
                continue
            try:
                cmd = (proc / "cmdline").read_bytes().replace(bytes([0]), b" ").decode("utf-8", "replace")
                if "git" in cmd and (str(META_REPO) in cmd or "fetch" in cmd):
                    return False
            except (OSError, PermissionError):
                # If process visibility is restricted, do not assume the lock is stale.
                return False
        lock.unlink()
        print("GE Radio: removed abandoned shallow.lock before metadata refresh.", flush=True)
        return True
    except OSError as exc:
        print(f"GE Radio: could not clear stale Git lock: {exc}", flush=True)
        return False

def fetch_library():
    # Important: this intentionally uses normal Git, NOT api.github.com.
    # Blitz uses shared outbound IPs and anonymous GitHub REST API requests can
    # hit a shared 60/hour limit. A shallow blobless fetch avoids that dependency.
    ensure_meta_repo()
    clear_stale_git_lock()
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

    rights_catalog = load_rights_catalog()
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
            title = clean_title(path)
            rights = rights_catalog.get(normalize_work_title(title), {})
            songs.append({
                "path": path,
                "sha": sha,
                "album": album,
                "title": title,
                "ascap_work_id": rights.get("ascap_work_id", ""),
                "ascap_title": rights.get("ascap_title", ""),
                "ascap_status": rights.get("ascap_status", ""),
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
        f'ge_path="{q(entry["path"])}"',
    ]
    if entry.get("ascap_work_id"):
        fields.append(f'ascap_work_id="{q(entry["ascap_work_id"])}"')
    if entry.get("ascap_title"):
        fields.append(f'ascap_title="{q(entry["ascap_title"])}"')
    if entry.get("ascap_status"):
        fields.append(f'ascap_status="{q(entry["ascap_status"])}"')
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
            "ascap_work_id": song.get("ascap_work_id", ""),
            "ascap_title": song.get("ascap_title", ""),
            "ascap_status": song.get("ascap_status", ""),
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
    songs = dedupe_songs(eligible_songs(songs, settings))
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
    recent_keys = load_recent_played()
    previous_tail = list(recent_keys[-8:])

    for pass_no in range(1, 13):
        pass_songs = guarded_shuffle(songs, rng, previous_tail, guard=min(8, max(1, len(songs)//4)))
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

        previous_tail = [song_key(x) for x in pass_songs[-min(8, len(pass_songs)):]]

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
    next_retry_at = 0.0
    last_signature = None
    last_now_seen = 0

    while True:
        try:
            settings = load_settings()
            last_now_seen = remember_now(last_now_seen)
            now = time.time()

            if now >= next_retry_at and (cached is None or now - last_repo_check >= CHECK_SECONDS):
                try:
                    cached = fetch_library()
                    last_repo_check = now
                    next_retry_at = 0.0
                except Exception as exc:
                    next_retry_at = now + 60
                    if cached is None:
                        raise
                    print(
                        f"GE Radio: Git metadata refresh warning; continuing with "
                        f"the current library: {exc}",
                        flush=True,
                    )
                    last_repo_check = now

            if cached is None:
                time.sleep(2)
                continue

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
            if cached is None:
                time.sleep(2)
                continue

        time.sleep(2)

if __name__ == "__main__":
    main()
