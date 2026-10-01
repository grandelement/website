#!/usr/bin/env python3
import base64
import hmac
import hashlib
import json
import struct
import os
import socket
import secrets
import time
import uuid
import urllib.parse
import urllib.request
import urllib.error
import subprocess
import threading
import queue
import re
import random
try:
    import zmq
except Exception:
    zmq = None
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RUNTIME = Path("/app/runtime")
DATA = Path(os.environ.get("GE_DATA_DIR", "/app/data"))
DATA.mkdir(parents=True, exist_ok=True)
SETTINGS = DATA / "settings.json"
ROTATION = RUNTIME / "rotation.json"
LIBRARY = RUNTIME / "library.json"
PLAYLIST = RUNTIME / "playlist.m3u"
NOW = RUNTIME / "now.json"
NEXT = RUNTIME / "next.json"
DJ_HTML = Path("/app/dj.html")
UPLOAD_DIR = RUNTIME / "uploads"
TEMP_UPLOADS = RUNTIME / "temp-uploads.json"
MIXER_SETTINGS = DATA / "mixer.json"
GAIN_FILES = {
    "volume@musicgain": RUNTIME / "music.gain",
    "volume@directgain": RUNTIME / "direct.gain",
    "volume@mastergain": RUNTIME / "master.gain",
}
CUSTOM_PLAYLISTS = DATA / "custom-playlists.json"
CUSTOM_PLAYLISTS_BACKUP = DATA / "custom-playlists.backup.json"
DEFAULT_PLAYLISTS = Path("/app/default-playlists.json")
PERMANENT_STATE_CACHE = DATA / "permanent-state-cache.json"
EFFECT_PRESETS_CACHE = DATA / "effect-presets-cache.json"
REMOTE_DEVICES_FILE = DATA / "remote-devices.json"
MAX_UPLOAD_BYTES = 100 * 1024 * 1024
MAX_TEMP_STORAGE_BYTES = 256 * 1024 * 1024
CLIP_DIR = RUNTIME / "clips"
MAX_CLIP_UPLOAD_BYTES = 100 * 1024 * 1024

GE_VAULT_URL = os.environ.get("GE_VAULT_URL", "https://vault.grandelement.com").rstrip("/")
GE_VAULT_ADMIN_TOKEN = os.environ.get("GE_VAULT_ADMIN_TOKEN", "").strip()

def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def write_json(path, value):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, indent=2), encoding="utf-8")
    tmp.replace(path)

def station_settings():
    raw = read_json(SETTINGS, {})
    return {
        "legacy": bool(raw.get("legacy", False)),
        "crossfade_seconds": max(0.0, min(12.0, float(raw.get("crossfade_seconds", 5.0) if raw.get("crossfade_seconds", 5.0) is not None else 5.0))),
        "custom_mix_enabled": bool(raw.get("custom_mix_enabled", False)),
        "custom_mix_id": str(raw.get("custom_mix_id", "") or ""),
    }

def vault_configured():
    return bool(GE_VAULT_URL and GE_VAULT_ADMIN_TOKEN)

def vault_request(method, path, payload=None, timeout=6):
    if not vault_configured():
        raise RuntimeError("GE Vault is not configured on the radio server.")
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        GE_VAULT_URL + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {GE_VAULT_ADMIN_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "GE-Radio-Vault/1.0 (+https://grandelement.com)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read().decode("utf-8", "replace").strip()
        except Exception:
            body = ""
        detail = ""
        if body:
            try:
                parsed = json.loads(body)
                detail = str(parsed.get("error") or parsed.get("message") or body)
            except Exception:
                detail = " ".join(body.split())
        detail = detail[:240]
        ray = str(exc.headers.get("CF-Ray", "") or "").strip()
        suffix = (f" · CF-Ray {ray}" if ray else "")
        raise RuntimeError(f"Vault HTTP {exc.code}: {detail or exc.reason}{suffix}") from exc

def vault_save_radio_setting(key, value):
    if not vault_configured():
        return False
    try:
        vault_request("PUT", "/v1/vault", {
            "kind": "setting",
            "scope": "radio",
            "key": str(key),
            "value_json": value,
            "locked": False,
            "sensitivity": "private",
        })
        return True
    except Exception as exc:
        print(f"GE Radio: Vault setting save failed for {key}: {exc}", flush=True)
        return False

def _vault_decode_value(row):
    if not isinstance(row, dict):
        return None
    raw = row.get("value_json")
    if raw not in (None, ""):
        try:
            return json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            return raw
    return row.get("value_text")

def vault_save_scoped_setting(scope, key, value):
    if not vault_configured():
        return False
    try:
        vault_request("PUT", "/v1/vault", {
            "kind": "setting",
            "scope": str(scope),
            "key": str(key),
            "value_json": value,
            "locked": False,
            "sensitivity": "private",
        })
        return True
    except Exception as exc:
        print(f"GE Radio: Vault setting save failed for {scope}/{key}: {exc}", flush=True)
        return False

def vault_load_scoped_setting(scope, key="state"):
    if not vault_configured():
        return None
    try:
        query = urllib.parse.urlencode({"kind": "setting", "scope": str(scope)})
        data = vault_request("GET", "/v1/vault?" + query)
        rows = data.get("items", []) if isinstance(data, dict) else []
        row = next((x for x in rows if str(x.get("key", "")) == str(key)), None)
        return _vault_decode_value(row)
    except Exception as exc:
        print(f"GE Radio: Vault setting load failed for {scope}/{key}: {exc}", flush=True)
        return None

def read_permanent_state_cache():
    data = read_json(PERMANENT_STATE_CACHE, {})
    return data if isinstance(data, dict) else {}

def permanent_state_save(scope, state):
    scope = str(scope or "").strip()[:80]
    if not scope or not isinstance(state, dict):
        raise ValueError("Permanent state requires a scope and object state.")
    cache = read_permanent_state_cache()
    cache[scope] = state
    write_json(PERMANENT_STATE_CACHE, cache)
    if vault_configured():
        threading.Thread(
            target=vault_save_scoped_setting,
            args=(scope, "state", state),
            daemon=True,
            name="ge-vault-state-" + scope.replace("/", "-")[:30],
        ).start()
    return {"state": state, "vault_configured": vault_configured()}

def permanent_state_load(scope):
    scope = str(scope or "").strip()[:80]
    value = vault_load_scoped_setting(scope, "state") if vault_configured() else None
    if isinstance(value, dict):
        cache = read_permanent_state_cache()
        cache[scope] = value
        write_json(PERMANENT_STATE_CACHE, cache)
        return value, "vault"
    cache = read_permanent_state_cache()
    local = cache.get(scope)
    return (local if isinstance(local, dict) else {}), ("cache" if isinstance(local, dict) else "default")

def read_effect_preset_cache():
    data = read_json(EFFECT_PRESETS_CACHE, {"dj": [], "studio": []})
    return data if isinstance(data, dict) else {"dj": [], "studio": []}

def write_effect_preset_cache(surface, items):
    cache = read_effect_preset_cache()
    cache[str(surface)] = items if isinstance(items, list) else []
    write_json(EFFECT_PRESETS_CACHE, cache)

def effect_presets_load(surface):
    surface = str(surface or "dj").strip().lower()[:40] or "dj"
    if vault_configured():
        try:
            q = urllib.parse.urlencode({"surface": surface})
            data = vault_request("GET", "/v1/effect-presets?" + q)
            items = data.get("items", []) if isinstance(data, dict) else []
            write_effect_preset_cache(surface, items)
            return items, "vault"
        except Exception as exc:
            print(f"GE Radio: Vault preset load failed for {surface}: {exc}", flush=True)
    items = read_effect_preset_cache().get(surface, [])
    return (items if isinstance(items, list) else []), "cache"

def effect_preset_save(surface, name, settings, preset_id=""):
    surface = str(surface or "dj").strip().lower()[:40] or "dj"
    name = " ".join(str(name or "").split())[:80]
    if not name:
        raise ValueError("Enter a preset name.")
    if not isinstance(settings, dict):
        raise ValueError("Preset settings must be an object.")
    if vault_configured():
        result = vault_request("PUT", "/v1/effect-presets", {
            "id": str(preset_id or ""),
            "surface": surface,
            "name": name,
            "settings": settings,
        })
        items, _ = effect_presets_load(surface)
        return result, items, True
    cache = read_effect_preset_cache()
    items = cache.get(surface, [])
    pid = str(preset_id or uuid.uuid4().hex[:12])
    row = {"id": pid, "surface": surface, "name": name, "archived": False, "settings": settings, "updated_at": int(time.time())}
    found = next((i for i,x in enumerate(items) if str(x.get("id","")) == pid or str(x.get("name","")).lower() == name.lower()), None)
    if found is None:
        items.append(row)
    else:
        row["id"] = str(items[found].get("id") or pid)
        items[found] = row
    cache[surface] = items
    write_json(EFFECT_PRESETS_CACHE, cache)
    return {"ok": True, "id": row["id"], "name": name, "surface": surface}, items, False

def effect_preset_archive(surface, preset_id):
    surface = str(surface or "dj").strip().lower()[:40] or "dj"
    preset_id = str(preset_id or "").strip()
    if not preset_id:
        raise ValueError("Choose a preset to delete.")
    if vault_configured():
        vault_request("DELETE", "/v1/effect-presets/" + urllib.parse.quote(preset_id, safe=""))
        items, _ = effect_presets_load(surface)
        return items, True
    cache = read_effect_preset_cache()
    items = [x for x in cache.get(surface, []) if str(x.get("id","")) != preset_id]
    cache[surface] = items
    write_json(EFFECT_PRESETS_CACHE, cache)
    return items, False

def vault_restore_crossfade():
    if not vault_configured():
        return False
    try:
        data = vault_request("GET", "/v1/vault?kind=setting&scope=radio")
        rows = data.get("items", []) if isinstance(data, dict) else []
        row = next((x for x in rows if str(x.get("key", "")) == "crossfade_seconds"), None)
        if not row:
            return False
        raw = row.get("value_json")
        if raw not in (None, ""):
            try:
                value = json.loads(raw) if isinstance(raw, str) else raw
            except Exception:
                value = raw
        else:
            value = row.get("value_text")
        seconds = max(0.0, min(12.0, float(value)))
        settings = station_settings()
        settings["crossfade_seconds"] = seconds
        write_json(SETTINGS, settings)
        rotation = read_json(ROTATION, {"entries": []})
        if rotation.get("entries"):
            rewrite_playlist(rotation)
            try:
                liquidsoap_command("radio.reload")
            except Exception:
                pass
        print(f"GE Radio: restored crossfade {seconds:.1f}s from Vault.", flush=True)
        return True
    except Exception as exc:
        print(f"GE Radio: Vault crossfade restore skipped: {exc}", flush=True)
        return False

def restore_vault_settings_after_start():
    # Give the rest of the radio stack time to create rotation/runtime files.
    time.sleep(2.0)
    vault_restore_crossfade()
    try:
        restored_playlists = vault_playlists_load()
        if isinstance(restored_playlists, dict):
            print(f"GE Radio: restored {len(restored_playlists.get('items', []))} playlists from Vault.", flush=True)
    except Exception as exc:
        print(f"GE Radio: Vault playlist restore skipped: {exc}", flush=True)
    remote_saved = vault_load_scoped_setting("remote_devices", "state")
    if isinstance(remote_saved, dict) and isinstance(remote_saved.get("items"), list):
        write_json(REMOTE_DEVICES_FILE, remote_saved)
    saved = vault_load_scoped_setting("radio_mixer_server", "state")
    if isinstance(saved, dict):
        current = mixer_state()
        for key in MIXER_DEFAULTS:
            if key in saved:
                current[key] = saved[key]
        current = {
            "music_level": clamp_number(current.get("music_level"), 0.0, 1.25, 1.0),
            "music_under_voice": clamp_number(current.get("music_under_voice"), 0.0, 1.0, 0.45),
            "music_muted": bool(current.get("music_muted", False)),
            "direct_level": clamp_number(current.get("direct_level"), 0.0, 1.5, 1.0),
            "master_level": clamp_number(current.get("master_level"), 0.0, 1.25, 1.0),
        }
        write_json(MIXER_SETTINGS, current)
        try:
            apply_mixer_state(current)
        except Exception as exc:
            print(f"GE Radio: restored mixer state but could not apply it yet: {exc}", flush=True)

def _vault_playlist_to_local(row):
    tracks = row.get("tracks", []) if isinstance(row, dict) else []
    return {
        "id": str(row.get("id", "")),
        "name": str(row.get("name", "") or ""),
        "paths": [str(t.get("track_path", "") or "") for t in tracks if str(t.get("track_path", "") or "")],
        "updated_at": int(row.get("updated_at", time.time()) or time.time()),
    }

def vault_playlists_load():
    if not vault_configured():
        return None
    data = vault_request("GET", "/v1/playlists")
    rows = data.get("items", []) if isinstance(data, dict) else []
    items = [_vault_playlist_to_local(row) for row in rows if isinstance(row, dict)]
    items = [x for x in items if x.get("id") and x.get("name") and x.get("paths")]
    local = {"items": items}
    write_json(CUSTOM_PLAYLISTS, local)
    write_json(CUSTOM_PLAYLISTS_BACKUP, local)
    active = next((row for row in rows if bool(row.get("active", False))), None)
    settings = station_settings()
    if active:
        settings["custom_mix_enabled"] = True
        settings["custom_mix_id"] = str(active.get("id", "") or "")
    elif settings.get("custom_mix_id") and not any(str(x.get("id")) == str(settings.get("custom_mix_id")) for x in items):
        settings["custom_mix_enabled"] = False
        settings["custom_mix_id"] = ""
    write_json(SETTINGS, settings)
    return local

def _playlist_tracks_for_vault(item):
    library = read_json(LIBRARY, {"items": []})
    by_path = {str(x.get("path", "")): x for x in library.get("items", [])}
    out = []
    for path in item.get("paths", []):
        meta = by_path.get(str(path), {})
        out.append({
            "track_path": str(path),
            "track_title": str(meta.get("title") or meta.get("picker_title") or ""),
            "album": str(meta.get("album") or ""),
        })
    return out

def vault_playlist_save(item, active=False):
    if not vault_configured():
        return False, "Vault credentials are not configured on this radio."
    try:
        vault_request("PUT", "/v1/playlists", {
            "id": str(item.get("id", "")),
            "name": str(item.get("name", "")),
            "tracks": _playlist_tracks_for_vault(item),
            "active": bool(active),
            "locked": False,
            "metadata": {"source": "ge-radio"},
        })
        return True, ""
    except Exception as exc:
        return False, str(exc)

def vault_playlist_delete(playlist_id):
    if not vault_configured():
        return False, "Vault credentials are not configured on this radio."
    try:
        vault_request("DELETE", "/v1/playlists/" + urllib.parse.quote(str(playlist_id), safe=""))
        return True, ""
    except Exception as exc:
        return False, str(exc)

def vault_sync_all_playlists(data, active_id=""):
    if not vault_configured():
        return False, "Vault credentials are not configured on this radio."
    try:
        for item in data.get("items", []):
            ok, err = vault_playlist_save(item, active=(str(item.get("id")) == str(active_id)))
            if not ok:
                raise RuntimeError(err)
        return True, ""
    except Exception as exc:
        return False, str(exc)

def read_custom_playlists():
    candidates = [CUSTOM_PLAYLISTS, CUSTOM_PLAYLISTS_BACKUP, DEFAULT_PLAYLISTS]
    data = {"items": []}
    for path in candidates:
        try:
            value = read_json(path, None)
            if isinstance(value, dict) and isinstance(value.get("items"), list):
                data = value
                if value.get("items") or path == CUSTOM_PLAYLISTS:
                    break
        except Exception:
            pass
    if not isinstance(data, dict):
        data = {"items": []}
    if not isinstance(data.get("items"), list):
        data["items"] = []
    return data

def write_custom_playlists(data):
    write_json(CUSTOM_PLAYLISTS, data)
    write_json(CUSTOM_PLAYLISTS_BACKUP, data)

def playlist_backup_payload():
    settings = station_settings()
    data = read_custom_playlists()
    return {
        "format": "ge-radio-playlists-v1",
        "exported_at": int(time.time()),
        "active_playlist_id": str(settings.get("custom_mix_id", "") or ""),
        "active_playlist_enabled": bool(settings.get("custom_mix_enabled", False)),
        "items": data.get("items", []),
    }

def import_playlist_backup(payload):
    if not isinstance(payload, dict) or payload.get("format") != "ge-radio-playlists-v1":
        raise ValueError("That is not a GE Radio playlist backup.")
    library = read_json(LIBRARY, {"items": []})
    allowed = {
        str(x.get("path", "")) for x in library.get("items", [])
        if x.get("kind") == "song" and str(x.get("path", ""))
    }
    items = []
    seen_ids = set()
    for raw in payload.get("items", []):
        if not isinstance(raw, dict):
            continue
        pid = str(raw.get("id", "") or uuid.uuid4().hex[:12])[:40]
        if pid in seen_ids:
            pid = uuid.uuid4().hex[:12]
        name = " ".join(str(raw.get("name", "")).split())[:80]
        paths = []
        for path in raw.get("paths", []):
            path = str(path)
            if path in allowed and path not in paths:
                paths.append(path)
        if name and paths:
            seen_ids.add(pid)
            items.append({
                "id": pid,
                "name": name,
                "paths": paths,
                "updated_at": int(raw.get("updated_at", time.time()) or time.time()),
            })
    data = {"items": items}
    write_custom_playlists(data)
    active_id = str(payload.get("active_playlist_id", "") or "")
    settings = station_settings()
    settings["custom_mix_enabled"] = bool(payload.get("active_playlist_enabled", False)) and any(str(x.get("id")) == active_id for x in items)
    settings["custom_mix_id"] = active_id if settings["custom_mix_enabled"] else ""
    write_json(SETTINGS, settings)
    return data, settings

def normalize_meta(value):
    if isinstance(value, dict):
        return value
    if isinstance(value, list):
        try:
            return dict(value)
        except Exception:
            return {}
    return {}

def public_track(meta):
    meta = normalize_meta(meta)
    return {
        "title": meta.get("title") or "",
        "album": meta.get("album") or "",
        "artist": meta.get("artist") or "Grand Element",
        "kind": meta.get("ge_kind") or "",
        "slot": meta.get("ge_slot") or "",
        "path": meta.get("ge_path") or "",
        "ascap_work_id": meta.get("ascap_work_id") or "",
        "ascap_title": meta.get("ascap_title") or "",
    }

ICECAST_META_CACHE = {"checked": 0.0, "track": {}}
ICECAST_META_LOCK = threading.Lock()

def _track_key_text(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()

def icecast_current_track():
    now_mono = time.monotonic()
    with ICECAST_META_LOCK:
        if now_mono - float(ICECAST_META_CACHE.get("checked", 0.0) or 0.0) < 0.75:
            return dict(ICECAST_META_CACHE.get("track") or {})
    track = {}
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:8000/status-json.xsl",
            headers={"User-Agent": "GE-DJ-Metadata/1.0"},
        )
        with urllib.request.urlopen(req, timeout=0.65) as response:
            data = json.loads(response.read().decode("utf-8", "ignore") or "{}")
        sources = ((data.get("icestats") or {}).get("source") or [])
        if isinstance(sources, dict):
            sources = [sources]
        source = None
        for item in sources:
            if not isinstance(item, dict):
                continue
            listen = str(item.get("listenurl") or "")
            mount = str(item.get("mount") or "")
            if listen.endswith("/stream.mp3") or mount == "/stream.mp3":
                source = item
                break
        if source is None and sources:
            source = sources[0] if isinstance(sources[0], dict) else None
        if source:
            title = str(source.get("title") or source.get("yp_currently_playing") or "").strip()
            artist = str(source.get("artist") or "").strip()
            album = str(source.get("album") or "").strip()
            if title and not artist:
                low = title.lower()
                if low.startswith("grand element - "):
                    artist = "Grand Element"
                    title = title[len("Grand Element - "):].strip()
            if title:
                track = {"title": title, "artist": artist or "Grand Element", "album": album}
    except Exception:
        track = {}
    with ICECAST_META_LOCK:
        ICECAST_META_CACHE["checked"] = now_mono
        ICECAST_META_CACHE["track"] = dict(track)
    return track

def match_rotation_track(entries, stream_track):
    if not stream_track:
        return None
    wanted = _track_key_text(stream_track.get("title"))
    if not wanted:
        return None
    for entry in entries:
        title = _track_key_text(entry.get("title"))
        if title == wanted:
            return entry
    return None

def q(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"')

def raw_url(commit_sha, path):
    from urllib.parse import quote
    return f"https://raw.githubusercontent.com/grandelement/website/{commit_sha}/{quote(path, safe='/')}"

TRACK_DURATION_CACHE = {}
TRACK_DURATION_LOADING = set()
TRACK_DURATION_LOCK = threading.Lock()

def _probe_track_duration(commit_sha, path, key):
    try:
        proc = subprocess.run(
            ["ffprobe","-v","error","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1",raw_url(commit_sha, path)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10
        )
        value = float(proc.stdout.decode("utf-8","ignore").strip() or "0") if proc.returncode == 0 else 0.0
    except Exception:
        value = 0.0
    value = max(0.0, min(60.0 * 60.0 * 4.0, value))
    with TRACK_DURATION_LOCK:
        TRACK_DURATION_CACHE[key] = value
        TRACK_DURATION_LOADING.discard(key)

def track_duration_seconds(commit_sha, path):
    commit_sha = str(commit_sha or "")
    path = str(path or "")
    if not commit_sha or not path:
        return 0.0
    key = commit_sha + "|" + path
    with TRACK_DURATION_LOCK:
        if key in TRACK_DURATION_CACHE:
            return TRACK_DURATION_CACHE[key]
        if key not in TRACK_DURATION_LOADING:
            TRACK_DURATION_LOADING.add(key)
            threading.Thread(target=_probe_track_duration, args=(commit_sha, path, key), daemon=True, name="ge-duration-probe").start()
    return 0.0

def annotation(entry, commit_sha, cross=None):
    fields = [
        'artist="Grand Element"',
        f'title="{q(entry.get("title",""))}"',
        f'album="{q(entry.get("album",""))}"',
        f'ge_kind="{q(entry.get("kind",""))}"',
        f'ge_slot="{q(entry.get("slot",""))}"',
    ]
    if cross is not None:
        fields.append(f'liq_cross_duration="{cross:.1f}"')
    path = entry.get("path", "")
    if entry.get("kind") == "temp_upload" or path.startswith("/app/runtime/uploads/"):
        source = path
    else:
        source = raw_url(commit_sha, path)
    return "annotate:" + ",".join(fields) + ":" + source

def rewrite_playlist(rotation):
    commit_sha = rotation.get("commit", "")
    entries = rotation.get("entries", [])
    if not commit_sha or not entries:
        raise RuntimeError("Rotation is not ready.")
    crossfade = station_settings().get("crossfade_seconds", 5.0)
    lines = ["#EXTM3U"]
    for i, entry in enumerate(entries):
        next_entry = entries[i + 1] if i + 1 < len(entries) else {}
        short = entry.get("kind") == "station_id" or next_entry.get("kind") == "station_id"
        lines.append(annotation(entry, commit_sha, cross=1.2 if short else crossfade))
    tmp = PLAYLIST.with_suffix(".m3u.tmp")
    tmp.write_text("\n".join(lines) + "\n", encoding="utf-8")
    tmp.replace(PLAYLIST)

def read_temp_uploads():
    data = read_json(TEMP_UPLOADS, {"items": []})
    return data if isinstance(data, dict) else {"items": []}

def write_temp_uploads(data):
    write_json(TEMP_UPLOADS, data)

def temp_items():
    return read_temp_uploads().get("items", [])

def rotation_paths():
    rot = read_json(ROTATION, {"entries": []})
    return {str(x.get("path", "")) for x in rot.get("entries", [])}

def prune_temp_storage(extra_bytes=0):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    data = read_temp_uploads()
    items = data.get("items", [])
    in_rotation = rotation_paths()

    def actual_size(item):
        try:
            return Path(item.get("path", "")).stat().st_size
        except Exception:
            return int(item.get("size", 0) or 0)

    total = sum(actual_size(x) for x in items)
    changed = False

    for item in sorted(list(items), key=lambda x: int(x.get("uploaded_at", 0) or 0)):
        if total + extra_bytes <= MAX_TEMP_STORAGE_BYTES:
            break
        path = str(item.get("path", ""))
        if path in in_rotation:
            continue
        try:
            size = actual_size(item)
            Path(path).unlink(missing_ok=True)
            total -= size
            items.remove(item)
            changed = True
        except Exception:
            pass

    if changed:
        data["items"] = items
        write_temp_uploads(data)

    if total + extra_bytes > MAX_TEMP_STORAGE_BYTES:
        raise ValueError("Temporary upload storage is full. Older queued files are still in use.")

def public_temp_item(item):
    return {
        "kind": "temp_upload",
        "title": item.get("title", ""),
        "picker_title": item.get("picker_title", item.get("title", "")),
        "album": "Temporary Upload",
        "path": item.get("path", ""),
        "section": "temporary",
        "size": int(item.get("size", 0) or 0),
        "uploaded_at": int(item.get("uploaded_at", 0) or 0),
    }

MIXER_DEFAULTS = {
    "music_level": 1.0,
    "music_under_voice": 0.45,
    "music_muted": False,
    "direct_level": 1.0,
    "master_level": 1.0,
}

def clamp_number(value, low, high, fallback):
    try:
        return max(low, min(high, float(value)))
    except Exception:
        return fallback

def mixer_state():
    raw = read_json(MIXER_SETTINGS, MIXER_DEFAULTS.copy())
    return {
        "music_level": clamp_number(raw.get("music_level", 1.0), 0.0, 1.25, 1.0),
        "music_under_voice": clamp_number(raw.get("music_under_voice", 0.45), 0.0, 1.0, 0.45),
        "music_muted": bool(raw.get("music_muted", False)),
        "direct_level": clamp_number(raw.get("direct_level", 1.0), 0.0, 1.5, 1.0),
        "master_level": clamp_number(raw.get("master_level", 1.0), 0.0, 1.25, 1.0),
    }

def _write_runtime_gain(path, value):
    value = clamp_number(value, 0.0, 2.0, 1.0)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(f"{value:.4f}\n", encoding="utf-8")
    tmp.replace(path)
    return value

def mixer_zmq_command(target, command, value):
    # V29: persist the requested gain and, when the continuous FFmpeg master is
    # online, push it live through FFmpeg's azmq filter. A startup call may
    # legitimately happen before FFmpeg has bound port 5555, so the persisted
    # value remains the fallback for the next master start.
    written = None
    if command == "volume" and target in GAIN_FILES:
        written = _write_runtime_gain(GAIN_FILES[target], value)
        value = f"{written:.4f}"
    if zmq is None:
        if written is not None:
            return f"0 volume {written:.4f} deferred"
        raise RuntimeError("Live mixer controls are unavailable on this server build.")
    ctx = zmq.Context.instance()
    sock = ctx.socket(zmq.REQ)
    sock.setsockopt(zmq.LINGER, 0)
    sock.setsockopt(zmq.SNDTIMEO, 350)
    sock.setsockopt(zmq.RCVTIMEO, 350)
    try:
        sock.connect("tcp://127.0.0.1:5555")
        sock.send_string(f"{target} {command} {value}")
        reply = sock.recv_string()
        if not reply.startswith("0 "):
            raise RuntimeError(reply)
        return reply
    except Exception:
        if written is not None:
            return f"0 volume {written:.4f} deferred"
        raise
    finally:
        sock.close(0)

def apply_mixer_state(state):
    live = bool(globals().get("BROADCAST") is not None and getattr(globals().get("BROADCAST"), "active", False))
    music = 0.0 if state.get("music_muted") else float(state.get("music_level", 1.0))
    if live:
        music *= float(state.get("music_under_voice", 0.45))
    mixer_zmq_command("volume@musicgain", "volume", f"{music:.4f}")
    mixer_zmq_command("volume@directgain", "volume", f"{float(state.get('direct_level', 1.0)):.4f}")
    mixer_zmq_command("volume@mastergain", "volume", f"{float(state.get('master_level', 1.0)):.4f}")
    return dict(state)


CF_REALTIME_APP_ID = os.environ.get("CF_REALTIME_APP_ID", "").strip()
CF_REALTIME_APP_SECRET = os.environ.get("CF_REALTIME_APP_SECRET", "").strip()
CF_REALTIME_BASE = "https://rtc.live.cloudflare.com/v1"
GE_PUBLIC_RADIO_BASE = os.environ.get("GE_PUBLIC_RADIO_BASE", "https://radio.grandelement.blitz.cloud").rstrip("/")
REALTIME_LOCK = threading.RLock()
REALTIME_STATE = {
    "owner": "none",
    "session_id": "",
    "mid": "",
    "track_name": "",
    "adapter_id": "",
    "ingest_token": "",
    "mode": "off",
    "created_at": 0.0,
}

def realtime_configured():
    return bool(CF_REALTIME_APP_ID and CF_REALTIME_APP_SECRET)

def cf_realtime_request(method, path, payload=None, timeout=12):
    if not realtime_configured():
        raise RuntimeError("Cloudflare Realtime is not configured on the radio server.")
    url = CF_REALTIME_BASE + path
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "Authorization": f"Bearer {CF_REALTIME_APP_SECRET}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        try:
            detail = json.loads(body)
        except Exception:
            detail = body
        raise RuntimeError(f"Cloudflare Realtime HTTP {exc.code}: {detail}")

def realtime_state():
    with REALTIME_LOCK:
        return dict(REALTIME_STATE)

def realtime_reserve(owner, mode, session_id, mid, track_name):
    owner = str(owner or "unknown").strip().lower()[:32] or "unknown"
    with REALTIME_LOCK:
        current = REALTIME_STATE.get("owner", "none")
        if current not in {"none", owner}:
            raise RuntimeError(f"Live audio is already reserved by {current}.")
        REALTIME_STATE.update({
            "owner": owner,
            "session_id": str(session_id or ""),
            "mid": str(mid or ""),
            "track_name": str(track_name or ""),
            "adapter_id": "",
            "ingest_token": "",
            "mode": str(mode or "voice"),
            "created_at": time.time(),
        })
        return dict(REALTIME_STATE)

def realtime_token_valid(token):
    token = str(token or "")
    with REALTIME_LOCK:
        expected = str(REALTIME_STATE.get("ingest_token", "") or "")
        return bool(token and expected and hmac.compare_digest(token, expected))

def _pb_read_varint(data, pos):
    value = 0
    shift = 0
    while pos < len(data) and shift < 70:
        b = data[pos]
        pos += 1
        value |= (b & 0x7F) << shift
        if not (b & 0x80):
            return value, pos
        shift += 7
    raise ValueError("Invalid protobuf varint.")

def cloudflare_pcm_payload(packet):
    data = bytes(packet)
    pos = 0
    result = b""
    while pos < len(data):
        key, pos = _pb_read_varint(data, pos)
        field = key >> 3
        wire = key & 7
        if wire == 0:
            _, pos = _pb_read_varint(data, pos)
        elif wire == 1:
            pos += 8
        elif wire == 2:
            length, pos = _pb_read_varint(data, pos)
            end = pos + length
            if end > len(data):
                raise ValueError("Invalid protobuf length.")
            if field == 5:
                result = data[pos:end]
            pos = end
        elif wire == 5:
            pos += 4
        else:
            raise ValueError("Unsupported protobuf wire type.")
    return result

def realtime_cleanup(owner=None, force=False, stop_broadcast=True):
    owner = str(owner or "").strip().lower()
    with REALTIME_LOCK:
        state = dict(REALTIME_STATE)
        current = str(state.get("owner", "none") or "none")
        if owner and current not in {"none", owner} and not force:
            raise RuntimeError(f"Realtime transport is owned by {current}.")
        REALTIME_STATE.update({
            "owner": "none", "session_id": "", "mid": "", "track_name": "",
            "adapter_id": "", "ingest_token": "", "mode": "off", "created_at": 0.0,
        })
    if realtime_configured():
        adapter_id = state.get("adapter_id")
        if adapter_id:
            try:
                cf_realtime_request("POST", f"/apps/{CF_REALTIME_APP_ID}/adapters/websocket/close", {
                    "tracks": [{"adapterId": adapter_id}]
                })
            except Exception as exc:
                print(f"GE Radio: Realtime adapter cleanup warning: {exc}", flush=True)
        session_id = state.get("session_id")
        mid = state.get("mid")
        if session_id and mid:
            try:
                cf_realtime_request("PUT", f"/apps/{CF_REALTIME_APP_ID}/sessions/{session_id}/tracks/close", {
                    "tracks": [{"mid": mid}], "force": True
                })
            except Exception as exc:
                print(f"GE Radio: Realtime track cleanup warning: {exc}", flush=True)
    if stop_broadcast:
        try:
            broadcast_engine().stop(owner=current if current != "none" else None, force=True)
        except Exception:
            pass
    return state

class RadioMeter:
    STREAM_URL = "http://127.0.0.1:8000/stream.mp3"
    LEVEL_RE = re.compile(r"FTPK:\s*(-?\d+(?:\.\d+)?)")
    MOMENTARY_RE = re.compile(r"M:\s*(-?\d+(?:\.\d+)?)")

    def __init__(self):
        self.lock = threading.Lock()
        self.db = -60.0
        self.updated = 0.0
        self.process = None
        self.thread = threading.Thread(target=self._loop, daemon=True, name="ge-radio-real-meter")
        self.thread.start()

    def _set_level(self, value):
        try:
            value = float(value)
        except Exception:
            return
        value = max(-60.0, min(0.0, value))
        with self.lock:
            self.db = value
            self.updated = time.monotonic()

    def _loop(self):
        while True:
            try:
                proc = subprocess.Popen(
                    [
                        "ffmpeg","-hide_banner","-nostdin","-loglevel","info",
                        "-i",self.STREAM_URL,
                        "-af","ebur128=peak=true",
                        "-f","null","-"
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    text=True,
                    bufsize=1,
                )
                self.process = proc
                if proc.stderr:
                    for line in proc.stderr:
                        m = self.LEVEL_RE.search(line) or self.MOMENTARY_RE.search(line)
                        if m:
                            self._set_level(m.group(1))
                proc.wait(timeout=2)
            except Exception:
                pass
            finally:
                self.process = None
                with self.lock:
                    self.db = -60.0
                    self.updated = 0.0
            time.sleep(1.0)

    def status(self):
        with self.lock:
            age = (time.monotonic() - self.updated) if self.updated else None
            db = self.db
        active = age is not None and age < 2.0
        pct = max(0.0, min(100.0, (db + 60.0) / 60.0 * 100.0)) if active else 0.0
        return {"active": active, "db": round(db, 1) if active else -60.0, "pct": round(pct, 1), "age": age}


class BroadcastEngine:
    SAMPLE_RATE = 48000
    CHANNELS = 2
    SAMPLE_BYTES = 2
    FRAME_MS = 10
    FRAME_BYTES = SAMPLE_RATE * CHANNELS * SAMPLE_BYTES * FRAME_MS // 1000
    STALE_SECONDS = 6.5
    FIFO_PATH = RUNTIME / "mic.pcm"
    ACTIVE_PATH = RUNTIME / "live.active"

    def __init__(self):
        self.lock = threading.RLock()
        self.pcm = queue.Queue(maxsize=40)
        self.pending = bytearray()
        self.fifo_fd = None
        self.active = False
        self.mode = "off"
        self.transport = "websocket"
        self.owner = "none"
        self.last_chunk = 0.0
        self.frames_received = 0
        self.bytes_received = 0
        self.peak_pct = 0.0
        self.peak_left_pct = 0.0
        self.peak_right_pct = 0.0
        self.fifo_frames_written = 0
        self.fifo_bytes_written = 0
        self.fifo_last_write = 0.0
        self.fifo_blocked_writes = 0
        self.fifo_partial_writes = 0
        self.fifo_peak_left_pct = 0.0
        self.fifo_peak_right_pct = 0.0
        self.fifo_audio_frames = 0
        self.fifo_silence_frames = 0
        self.fifo_last_audio = 0.0
        self.playout_started = False
        self.stop_event = threading.Event()
        self.feeder = threading.Thread(target=self._feeder_loop, daemon=True, name="ge-direct-mic-feeder")
        self.feeder.start()

    def _ensure_fifo_locked(self):
        try:
            if not self.FIFO_PATH.exists():
                os.mkfifo(self.FIFO_PATH, 0o600)
        except FileExistsError:
            pass
        if self.fifo_fd is not None:
            return True
        try:
            self.fifo_fd = os.open(str(self.FIFO_PATH), os.O_RDWR | os.O_NONBLOCK)
            return True
        except Exception as exc:
            print(f"GE Radio: microphone FIFO open failed: {exc}", flush=True)
            self.fifo_fd = None
            return False

    def _drop_oldest(self):
        try:
            self.pcm.get_nowait()
        except queue.Empty:
            pass

    def _queue_frame(self, frame):
        if len(frame) != self.FRAME_BYTES:
            return
        while self.pcm.qsize() > 18:
            self._drop_oldest()
        try:
            self.pcm.put_nowait(frame)
        except queue.Full:
            self._drop_oldest()
            try:
                self.pcm.put_nowait(frame)
            except queue.Full:
                pass

    def _queue_pcm_bytes(self, data):
        self.pending.extend(data)
        while len(self.pending) >= self.FRAME_BYTES:
            frame = bytes(self.pending[:self.FRAME_BYTES])
            del self.pending[:self.FRAME_BYTES]
            self._queue_frame(frame)

    def _clear_audio_locked(self):
        self.pending.clear()
        self.playout_started = False
        while True:
            try:
                self.pcm.get_nowait()
            except queue.Empty:
                break

    def _expire_if_stale_locked(self):
        if self.active and self.last_chunk and (time.monotonic() - self.last_chunk) > self.STALE_SECONDS:
            print("GE Radio: direct live input timed out; returning public master to automation.", flush=True)
            self.active = False
            self.mode = "off"
            self.owner = "none"
            try:
                self.ACTIVE_PATH.unlink(missing_ok=True)
            except Exception:
                pass
            self._clear_audio_locked()
            try:
                apply_mixer_state(mixer_state())
            except Exception as exc:
                print(f"GE Radio: could not restore music after live timeout: {exc}", flush=True)

    def _write_frame(self, frame):
        fd = self.fifo_fd
        if fd is None:
            return
        peak_left = 0
        peak_right = 0
        for i in range(0, len(frame) - 3, 16):
            left = int.from_bytes(frame[i:i+2], "little", signed=True)
            right = int.from_bytes(frame[i+2:i+4], "little", signed=True)
            peak_left = max(peak_left, abs(left))
            peak_right = max(peak_right, abs(right))
        self.fifo_peak_left_pct = max(0.0, min(100.0, peak_left / 32768.0 * 100.0))
        self.fifo_peak_right_pct = max(0.0, min(100.0, peak_right / 32768.0 * 100.0))
        if peak_left or peak_right:
            self.fifo_audio_frames += 1
            self.fifo_last_audio = time.monotonic()
        else:
            self.fifo_silence_frames += 1
        try:
            written = os.write(fd, frame)
            if written:
                self.fifo_frames_written += 1
                self.fifo_bytes_written += int(written)
                self.fifo_last_write = time.monotonic()
                if int(written) != len(frame):
                    self.fifo_partial_writes += 1
        except BlockingIOError:
            self.fifo_blocked_writes += 1
        except BrokenPipeError:
            with self.lock:
                try:
                    os.close(fd)
                except Exception:
                    pass
                self.fifo_fd = None
        except Exception as exc:
            print(f"GE Radio: microphone FIFO write failed: {exc}", flush=True)

    def _feeder_loop(self):
        silence = b"\x00" * self.FRAME_BYTES
        frame_seconds = self.FRAME_MS / 1000.0
        deadline = time.monotonic()
        while not self.stop_event.is_set():
            with self.lock:
                self._expire_if_stale_locked()
                self._ensure_fifo_locked()
                active = self.active

            frame = silence
            if active:
                if not self.playout_started and self.pcm.qsize() >= 8:
                    self.playout_started = True
                if self.playout_started:
                    try:
                        frame = self.pcm.get_nowait()
                    except queue.Empty:
                        self.playout_started = False
                        frame = silence

            self._write_frame(frame)

            deadline += frame_seconds
            wait = deadline - time.monotonic()
            if wait > 0:
                self.stop_event.wait(wait)
            elif wait < -0.25:
                deadline = time.monotonic()

    def start(self, mode, transport="websocket", owner="unknown"):
        mode = str(mode or "voice").strip().lower()
        if mode not in {"voice", "performance"}:
            mode = "voice"
        owner = str(owner or "unknown").strip().lower()[:32] or "unknown"
        with self.lock:
            self._expire_if_stale_locked()
            if self.active and self.owner not in {"none", owner}:
                raise RuntimeError(f"Live audio is already owned by {self.owner}. Stop that live source before taking over.")
            self._ensure_fifo_locked()
            self._clear_audio_locked()
            self.active = True
            self.mode = mode
            self.transport = str(transport or "websocket")
            self.owner = owner
            self.last_chunk = time.monotonic()
            self.ACTIVE_PATH.write_text(owner + "\n", encoding="utf-8")
            self.frames_received = 0
            self.bytes_received = 0
            self.peak_pct = 0.0
            self.peak_left_pct = 0.0
            self.peak_right_pct = 0.0
            self.fifo_frames_written = 0
            self.fifo_bytes_written = 0
            self.fifo_last_write = 0.0
            self.fifo_blocked_writes = 0
            self.fifo_partial_writes = 0
            self.fifo_peak_left_pct = 0.0
            self.fifo_peak_right_pct = 0.0
            self.fifo_audio_frames = 0
            self.fifo_silence_frames = 0
            self.fifo_last_audio = 0.0
            try:
                apply_mixer_state(mixer_state())
            except Exception as exc:
                print(f"GE Radio: could not apply live mixer duck: {exc}", flush=True)
            return self.status_locked()

    def write_pcm(self, data):
        if not data:
            raise ValueError("Empty microphone audio.")
        with self.lock:
            self._expire_if_stale_locked()
            if not self.active:
                raise RuntimeError("Live input is not active.")
            self._queue_pcm_bytes(data)
            self.bytes_received += len(data)
            self.frames_received += max(1, len(data) // max(1, self.FRAME_BYTES))
            peak_left = 0
            peak_right = 0
            # Stereo s16le is interleaved L,R. Sample both channels separately
            # so diagnostics can catch a one-sided contribution path.
            for i in range(0, len(data) - 3, 16):
                left = int.from_bytes(data[i:i+2], "little", signed=True)
                right = int.from_bytes(data[i+2:i+4], "little", signed=True)
                peak_left = max(peak_left, abs(left))
                peak_right = max(peak_right, abs(right))
            self.peak_left_pct = max(0.0, min(100.0, peak_left / 32768.0 * 100.0))
            self.peak_right_pct = max(0.0, min(100.0, peak_right / 32768.0 * 100.0))
            self.peak_pct = max(self.peak_left_pct, self.peak_right_pct)
            self.last_chunk = time.monotonic()

    def stop(self, owner=None, force=False):
        owner = str(owner or "").strip().lower()
        with self.lock:
            self._expire_if_stale_locked()
            if self.active and owner and self.owner not in {"none", owner} and not force:
                raise RuntimeError(f"Live audio is owned by {self.owner}.")
            self.active = False
            self.mode = "off"
            self.owner = "none"
            try:
                self.ACTIVE_PATH.unlink(missing_ok=True)
            except Exception:
                pass
            self._clear_audio_locked()
            try:
                apply_mixer_state(mixer_state())
            except Exception as exc:
                print(f"GE Radio: could not restore music after live stop: {exc}", flush=True)
            return self.status_locked()

    def status_locked(self):
        return {
            "ready": bool(self.fifo_fd is not None),
            "active": bool(self.active),
            "mode": self.mode,
            "transport": self.transport,
            "owner": self.owner,
            "last_chunk_age": max(0.0, time.monotonic() - self.last_chunk) if self.last_chunk else None,
            "queue_frames": self.pcm.qsize(),
            "frames_received": int(self.frames_received),
            "bytes_received": int(self.bytes_received),
            "peak_pct": float(self.peak_pct),
            "peak_left_pct": float(self.peak_left_pct),
            "peak_right_pct": float(self.peak_right_pct),
            "fifo_frames_written": int(self.fifo_frames_written),
            "fifo_bytes_written": int(self.fifo_bytes_written),
            "fifo_last_write_age": max(0.0, time.monotonic() - self.fifo_last_write) if self.fifo_last_write else None,
            "fifo_blocked_writes": int(self.fifo_blocked_writes),
            "fifo_partial_writes": int(self.fifo_partial_writes),
            "fifo_peak_left_pct": float(self.fifo_peak_left_pct),
            "fifo_peak_right_pct": float(self.fifo_peak_right_pct),
            "fifo_audio_frames": int(self.fifo_audio_frames),
            "fifo_silence_frames": int(self.fifo_silence_frames),
            "fifo_last_audio_age": max(0.0, time.monotonic() - self.fifo_last_audio) if self.fifo_last_audio else None,
        }

    def status(self):
        with self.lock:
            self._expire_if_stale_locked()
            self._ensure_fifo_locked()
            return self.status_locked()

REMOTE_DEVICE_LOCK = threading.RLock()
REMOTE_PAIRINGS = {}
REMOTE_COMMANDS = {}
REMOTE_PAIR_ATTEMPTS = {}

def _remote_device_token_hash(token):
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()

def _remote_devices():
    data = read_json(REMOTE_DEVICES_FILE, {"items": []})
    if not isinstance(data, dict) or not isinstance(data.get("items"), list):
        data = {"items": []}
    return data

def _write_remote_devices(data):
    write_json(REMOTE_DEVICES_FILE, data)
    if vault_configured():
        threading.Thread(
            target=vault_save_scoped_setting,
            args=("remote_devices", "state", data),
            daemon=True,
            name="ge-vault-remote-devices",
        ).start()

def _remote_public(row):
    now = time.time()
    last_seen = float(row.get("last_seen", 0) or 0)
    return {
        "id": str(row.get("id", "")),
        "name": str(row.get("name", "Remote Device")),
        "platform": str(row.get("platform", "ios")),
        "model": str(row.get("model", "")),
        "online": bool(last_seen and now - last_seen < 15),
        "last_seen": last_seen,
        "remote_ready": bool(row.get("remote_ready", False)),
        "mic_active": bool(row.get("mic_active", False)),
        "on_air": bool(row.get("on_air", False)),
        "muted": bool(row.get("muted", False)),
        "level": float(row.get("level", 1.0) or 1.0),
        "peak_pct": float(row.get("peak_pct", 0.0) or 0.0),
        "app_state": str(row.get("app_state", "")),
        "last_error": str(row.get("last_error", "")),
    }

def create_remote_pairing():
    code = f"{secrets.randbelow(1000000):06d}"
    token = uuid.uuid4().hex
    with REMOTE_DEVICE_LOCK:
        now = time.time()
        for old, item in list(REMOTE_PAIRINGS.items()):
            if float(item.get("expires_at", 0)) < now:
                REMOTE_PAIRINGS.pop(old, None)
        REMOTE_PAIRINGS[code] = {"claim_token": token, "expires_at": now + 600}
    return code

def check_remote_pair_rate(ip):
    ip = str(ip or "unknown")[:120]
    now = time.time()
    with REMOTE_DEVICE_LOCK:
        times = [x for x in REMOTE_PAIR_ATTEMPTS.get(ip, []) if now - x < 60]
        if len(times) >= 10:
            raise RuntimeError("Too many pairing attempts. Wait one minute.")
        times.append(now)
        REMOTE_PAIR_ATTEMPTS[ip] = times

def claim_remote_pairing(code, name, platform="ios", model=""):
    code = str(code or "").strip()
    with REMOTE_DEVICE_LOCK:
        pair = REMOTE_PAIRINGS.pop(code, None)
    if not pair or float(pair.get("expires_at", 0)) < time.time():
        raise ValueError("Pairing code is invalid or expired.")
    device_id = "device-" + uuid.uuid4().hex[:16]
    device_key = uuid.uuid4().hex + uuid.uuid4().hex
    row = {
        "id": device_id,
        "name": " ".join(str(name or "GE Remote Mic").split())[:80],
        "platform": str(platform or "ios")[:40],
        "model": str(model or "")[:100],
        "token_hash": _remote_device_token_hash(device_key),
        "created_at": int(time.time()),
        "last_seen": 0,
        "remote_ready": False,
        "mic_active": False,
        "on_air": False,
        "muted": False,
        "level": 1.0,
        "peak_pct": 0.0,
        "app_state": "",
        "last_error": "",
    }
    with REMOTE_DEVICE_LOCK:
        data = _remote_devices()
        data["items"] = [x for x in data["items"] if str(x.get("id")) != device_id]
        data["items"].append(row)
        _write_remote_devices(data)
        REMOTE_COMMANDS[device_id] = []
    return device_id, device_key

def remote_device_auth(headers):
    device_id = str(headers.get("X-GE-Device-ID", "") or "").strip()
    device_key = str(headers.get("X-GE-Device-Key", "") or "").strip()
    if not device_id or not device_key:
        return None
    wanted = _remote_device_token_hash(device_key)
    with REMOTE_DEVICE_LOCK:
        data = _remote_devices()
        row = next((x for x in data["items"] if str(x.get("id")) == device_id), None)
        if not row or not hmac.compare_digest(str(row.get("token_hash", "")), wanted):
            return None
        return dict(row)

def update_remote_device(device_id, fields):
    allowed = {"name","model","last_seen","remote_ready","mic_active","on_air","muted","level","peak_pct","app_state","last_error"}
    with REMOTE_DEVICE_LOCK:
        data = _remote_devices()
        row = next((x for x in data["items"] if str(x.get("id")) == str(device_id)), None)
        if not row:
            raise ValueError("Remote device not found.")
        for key, value in fields.items():
            if key in allowed:
                row[key] = value
        _write_remote_devices(data)
        return dict(row)

def list_remote_devices():
    with REMOTE_DEVICE_LOCK:
        return [_remote_public(x) for x in _remote_devices()["items"]]

def queue_remote_command(device_id, action, value=None):
    device_id = str(device_id or "")
    if not any(x["id"] == device_id for x in list_remote_devices()):
        raise ValueError("Remote device not found.")
    command = {"id": uuid.uuid4().hex[:16], "action": str(action or "")[:40], "value": value, "created_at": int(time.time())}
    with REMOTE_DEVICE_LOCK:
        REMOTE_COMMANDS.setdefault(device_id, []).append(command)
        REMOTE_COMMANDS[device_id] = REMOTE_COMMANDS[device_id][-50:]
    return command

def take_remote_commands(device_id):
    with REMOTE_DEVICE_LOCK:
        items = list(REMOTE_COMMANDS.get(str(device_id), []))
        REMOTE_COMMANDS[str(device_id)] = []
    return items

BROADCAST = None
RADIO_METER = None
LIVE_SESSIONS = {}
LIVE_SESSIONS_LOCK = threading.Lock()

def create_live_session():
    token = uuid.uuid4().hex + uuid.uuid4().hex
    expires = time.monotonic() + 60.0
    with LIVE_SESSIONS_LOCK:
        now = time.monotonic()
        for old, exp in list(LIVE_SESSIONS.items()):
            if exp < now:
                LIVE_SESSIONS.pop(old, None)
        LIVE_SESSIONS[token] = expires
    return token

def consume_live_session(token):
    if not token:
        return False
    with LIVE_SESSIONS_LOCK:
        expires = LIVE_SESSIONS.pop(token, None)
    return bool(expires and expires >= time.monotonic())


def broadcast_engine():
    if BROADCAST is None: raise RuntimeError("Broadcast engine is not ready.")
    return BROADCAST

def radio_meter_status():
    if RADIO_METER is None:
        return {"active": False, "db": -60.0, "pct": 0.0, "age": None}
    return RADIO_METER.status()

_PUBLIC_MASTER_HEALTH = {"checked": 0.0, "ok": False, "error": "not checked"}

def master_progress_status():
    path = RUNTIME / "master-progress.txt"
    result = {"exists": path.exists(), "age": None, "out_time": "", "speed": "", "progress": ""}
    if not path.exists():
        return result
    try:
        result["age"] = max(0.0, time.time() - path.stat().st_mtime)
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key in {"out_time", "speed", "progress"}:
                result[key] = value
    except Exception as exc:
        result["error"] = str(exc)[:160]
    return result

def public_master_health():
    now_mono = time.monotonic()
    if now_mono - float(_PUBLIC_MASTER_HEALTH.get("checked", 0.0) or 0.0) < 3.0:
        return dict(_PUBLIC_MASTER_HEALTH)
    result = {"checked": now_mono, "ok": False, "error": ""}
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:8000/stream.mp3",
            headers={"User-Agent": "GE-Radio-Health/1.0"},
        )
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            result["ok"] = int(getattr(resp, "status", 0) or 0) == 200
            result["status"] = int(getattr(resp, "status", 0) or 0)
            result["content_type"] = str(resp.headers.get("Content-Type", "") or "")
    except Exception as exc:
        result["error"] = str(exc)[:180]
    _PUBLIC_MASTER_HEALTH.clear()
    _PUBLIC_MASTER_HEALTH.update(result)
    return dict(_PUBLIC_MASTER_HEALTH)

    result = {"checked": now_mono, "ok": False, "error": ""}
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:8000/broadcast.mp3",
            headers={"User-Agent": "GE-Radio-Broadcast-Health/1.0"},
        )
        with urllib.request.urlopen(req, timeout=2.5) as response:
            chunk = response.read(1024)
            result["ok"] = bool(response.status == 200 and chunk)
            result["bytes"] = len(chunk)
    except Exception as exc:
        result["error"] = str(exc)[:160]
    _PUBLIC_BROADCAST_HEALTH.clear()
    _PUBLIC_BROADCAST_HEALTH.update(result)
    return dict(_PUBLIC_BROADCAST_HEALTH)

def liquidsoap_command(command):
    with socket.create_connection(("127.0.0.1", 1234), timeout=3) as s:
        s.settimeout(1)
        s.sendall((command + "\n").encode("utf-8"))
        chunks = []
        while True:
            try:
                part = s.recv(4096)
            except socket.timeout:
                break
            if not part:
                break
            chunks.append(part)
            if b"\nEND\n" in b"".join(chunks):
                break
        return b"".join(chunks).decode("utf-8", "replace")

def fade_music_gain(start_level, end_level, seconds=2.5, steps=12):
    start_level = max(0.0, min(1.25, float(start_level)))
    end_level = max(0.0, min(1.25, float(end_level)))
    steps = max(2, int(steps))
    pause = max(0.02, float(seconds) / steps)
    for i in range(1, steps + 1):
        value = start_level + (end_level - start_level) * (i / steps)
        mixer_zmq_command("volume@musicgain", "volume", f"{value:.4f}")
        time.sleep(pause)

def music_fade_action(action):
    state = mixer_state()
    action = str(action or "").lower()
    target = float(state.get("music_level", 1.0))
    if action == "off":
        start = 0.0 if state.get("music_muted") else target
        fade_music_gain(start, 0.0, seconds=2.8, steps=14)
        state["music_muted"] = True
        write_json(MIXER_SETTINGS, state)
        return state, "Music faded out. Automation continues silently."

    if action == "on":
        state["music_muted"] = False
        write_json(MIXER_SETTINGS, state)
        mixer_zmq_command("volume@musicgain", "volume", "0.0")
        try:
            liquidsoap_command("radio.skip")
        except Exception:
            pass
        time.sleep(0.15)
        fade_music_gain(0.0, target, seconds=2.3, steps=12)
        return state, "Music started at the beginning of a new song."

    raise ValueError("Unknown music action.")


DROP_LOCK = threading.RLock()
DROP_STATE = {
    "active": False,
    "mode": "",
    "saved_music_level": 1.0,
    "saved_music_muted": False,
    "saved_direct_level": 1.0,
}

def fade_zmq_volume(target, start_level, end_level, seconds=2.0, steps=12):
    start_level = float(start_level)
    end_level = float(end_level)
    steps = max(2, int(steps))
    pause = max(0.02, float(seconds) / steps)
    for i in range(1, steps + 1):
        value = start_level + (end_level - start_level) * (i / steps)
        mixer_zmq_command(target, "volume", f"{value:.4f}")
        time.sleep(pause)

def drop_start(mode):
    mode = str(mode or "top").strip().lower()
    if mode not in {"top", "stop"}:
        raise ValueError("DROP mode must be top or stop.")
    with DROP_LOCK:
        state = mixer_state()
        DROP_STATE.update({
            "active": True,
            "mode": mode,
            "saved_music_level": float(state.get("music_level", 1.0)),
            "saved_music_muted": bool(state.get("music_muted", False)),
            "saved_direct_level": float(state.get("direct_level", 1.0)),
        })
        # Start the contribution silently on the server, then fade it in here.
        mixer_zmq_command("volume@directgain", "volume", "0.0")
        direct_target = float(state.get("direct_level", 1.0))

    if mode == "stop":
        # Server owns both sides of the handoff.
        music_start = 0.0 if state.get("music_muted") else float(state.get("music_level", 1.0))
        steps = 14
        for i in range(1, steps + 1):
            f = i / steps
            mixer_zmq_command("volume@musicgain", "volume", f"{music_start * (1.0 - f):.4f}")
            mixer_zmq_command("volume@directgain", "volume", f"{direct_target * f:.4f}")
            time.sleep(2.6 / steps)
        state["music_muted"] = True
        write_json(MIXER_SETTINGS, state)
    else:
        fade_zmq_volume("volume@directgain", 0.0, direct_target, seconds=1.8, steps=12)

    return {
        "active": True,
        "mode": mode,
        "mixer": mixer_state(),
    }

def drop_stop(fast=False):
    with DROP_LOCK:
        prior = dict(DROP_STATE)
        state = mixer_state()
        active = bool(prior.get("active"))
        mode = str(prior.get("mode", "") or "")
        restore_music_level = float(prior.get("saved_music_level", state.get("music_level", 1.0)))
        restore_music_muted = bool(prior.get("saved_music_muted", False))
        direct_start = float(state.get("direct_level", prior.get("saved_direct_level", 1.0)))
        DROP_STATE.update({"active": False, "mode": ""})

    if not active:
        return {"active": False, "mixer": state}

    if fast:
        mixer_zmq_command("volume@directgain", "volume", "0.0")
    else:
        fade_zmq_volume("volume@directgain", direct_start, 0.0, seconds=1.0, steps=10)

    if mode == "stop":
        state["music_level"] = restore_music_level
        state["music_muted"] = restore_music_muted
        write_json(MIXER_SETTINGS, state)
        if restore_music_muted:
            mixer_zmq_command("volume@musicgain", "volume", "0.0")
        else:
            mixer_zmq_command("volume@musicgain", "volume", "0.0")
            fade_zmq_volume("volume@musicgain", 0.0, restore_music_level, seconds=2.0, steps=12)

    # Restore the configured Studio/DJ contribution level for the next live source.
    mixer_zmq_command("volume@directgain", "volume", f"{float(prior.get('saved_direct_level', 1.0)):.4f}")
    return {
        "active": False,
        "mode": mode,
        "mixer": mixer_state(),
    }

class Handler(BaseHTTPRequestHandler):
    server_version = "GERadioDJ/1.0"

    def log_message(self, fmt, *args):
        print("DJ API:", fmt % args, flush=True)

    def password_configured(self):
        return bool(os.environ.get("DJ_PASSWORD", "").strip())

    def authorized(self):
        password = os.environ.get("DJ_PASSWORD", "")
        if not password:
            return False
        supplied = self.headers.get("X-GE-DJ-Key", "")
        return hmac.compare_digest(supplied, password)

    def require_auth(self):
        if not self.password_configured():
            body = b"Set DJ_PASSWORD in the Blitz app Environment settings, then restart the app."
            self.send_response(503)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return False
        if not self.authorized():
            body = b"Grand Element Radio DJ login required."
            self.send_response(401)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return False
        return True

    def json_response(self, value, status=200):
        raw = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def read_body_json(self):
        n = int(self.headers.get("Content-Length", "0") or "0")
        if n <= 0:
            return {}
        return json.loads(self.rfile.read(n).decode("utf-8"))

    def _recv_exact(self, n):
        data = bytearray()
        while len(data) < n:
            part = self.connection.recv(n - len(data))
            if not part:
                raise ConnectionError("WebSocket closed.")
            data.extend(part)
        return bytes(data)

    def _ws_send(self, opcode, payload=b""):
        payload = bytes(payload)
        head = bytearray([0x80 | (opcode & 0x0F)])
        n = len(payload)
        if n < 126:
            head.append(n)
        elif n <= 0xFFFF:
            head.append(126)
            head.extend(struct.pack("!H", n))
        else:
            head.append(127)
            head.extend(struct.pack("!Q", n))
        self.connection.sendall(bytes(head) + payload)

    def _serve_live_websocket(self, token):
        if not consume_live_session(token):
            self.send_response(401)
            self.end_headers()
            return

        upgrade = self.headers.get("Upgrade", "").lower()
        key = self.headers.get("Sec-WebSocket-Key", "")
        if upgrade != "websocket" or not key:
            self.send_response(400)
            self.end_headers()
            return

        accept = base64.b64encode(
            hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")).digest()
        ).decode("ascii")

        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.end_headers()

        print("GE Radio: direct DJ WebSocket connected.", flush=True)
        try:
            while True:
                first = self._recv_exact(2)
                b1, b2 = first[0], first[1]
                opcode = b1 & 0x0F
                masked = bool(b2 & 0x80)
                length = b2 & 0x7F
                if length == 126:
                    length = struct.unpack("!H", self._recv_exact(2))[0]
                elif length == 127:
                    length = struct.unpack("!Q", self._recv_exact(8))[0]
                if length > 1024 * 1024:
                    raise ValueError("WebSocket audio frame too large.")

                mask = self._recv_exact(4) if masked else b""
                payload = self._recv_exact(length) if length else b""
                if masked and payload:
                    payload = bytes(byte ^ mask[i % 4] for i, byte in enumerate(payload))

                if opcode == 0x8:
                    try:
                        self._ws_send(0x8, payload[:125])
                    except Exception:
                        pass
                    break
                elif opcode == 0x9:
                    self._ws_send(0xA, payload[:125])
                elif opcode == 0x2:
                    broadcast_engine().write_pcm(payload)
        except Exception as exc:
            print(f"GE Radio: direct DJ WebSocket ended: {exc}", flush=True)

    def _serve_realtime_ingest_websocket(self, token):
        if not realtime_token_valid(token):
            self.send_response(401)
            self.end_headers()
            return
        upgrade = self.headers.get("Upgrade", "").lower()
        key = self.headers.get("Sec-WebSocket-Key", "")
        if upgrade != "websocket" or not key:
            self.send_response(400)
            self.end_headers()
            return
        accept = base64.b64encode(
            hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")).digest()
        ).decode("ascii")
        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.end_headers()
        print("GE Radio: Cloudflare Realtime PCM adapter connected.", flush=True)
        try:
            while True:
                first = self._recv_exact(2)
                b1, b2 = first[0], first[1]
                opcode = b1 & 0x0F
                masked = bool(b2 & 0x80)
                length = b2 & 0x7F
                if length == 126:
                    length = struct.unpack("!H", self._recv_exact(2))[0]
                elif length == 127:
                    length = struct.unpack("!Q", self._recv_exact(8))[0]
                if length > 1024 * 1024:
                    raise ValueError("Realtime adapter frame too large.")
                mask = self._recv_exact(4) if masked else b""
                payload = self._recv_exact(length) if length else b""
                if masked and payload:
                    payload = bytes(byte ^ mask[i % 4] for i, byte in enumerate(payload))
                if opcode == 0x8:
                    try:
                        self._ws_send(0x8, payload[:125])
                    except Exception:
                        pass
                    break
                if opcode == 0x9:
                    self._ws_send(0xA, payload[:125])
                elif opcode == 0x2:
                    pcm = cloudflare_pcm_payload(payload)
                    if pcm:
                        broadcast_engine().write_pcm(pcm)
        except Exception as exc:
            print(f"GE Radio: Cloudflare Realtime adapter disconnected: {exc}", flush=True)


    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/control/live":
            qs = urllib.parse.parse_qs(parsed.query)
            token = (qs.get("token") or [""])[0]
            self._serve_live_websocket(token)
            return

        if parsed.path == "/control/realtime-ingest":
            qs = urllib.parse.parse_qs(parsed.query)
            token = (qs.get("token") or [""])[0]
            self._serve_realtime_ingest_websocket(token)
            return

        if parsed.path == "/control/clip/file":
            if not self.require_auth(): return
            clip_id = (urllib.parse.parse_qs(parsed.query).get("id") or [""])[0]
            if not clip_id or not all(ch.isalnum() or ch in "-_" for ch in clip_id):
                self.json_response({"ok": False, "error": "Invalid clip id."}, 400); return
            path = CLIP_DIR / f"{clip_id}.wav"
            if not path.exists():
                self.json_response({"ok": False, "error": "Clip expired."}, 404); return
            raw = path.read_bytes(); self.send_response(200); self.send_header("Content-Type", "audio/wav"); self.send_header("Cache-Control", "no-store"); self.send_header("Content-Length", str(len(raw))); self.end_headers(); self.wfile.write(raw); return

        if self.path == "/control/healthz":
            body = b"DJ control OK\n"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/dj":
            self.send_response(302)
            self.send_header("Location", "/dj/")
            self.end_headers()
            return

        if self.path == "/dj/" or self.path == "/dj/index.html":
            if not self.require_auth():
                return
            raw = DJ_HTML.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return

        if parsed.path == "/control/devices":
            if not self.require_auth(): return
            self.json_response({"ok": True, "items": list_remote_devices()})
            return

        if parsed.path == "/control/vault/analytics":
            if not self.require_auth():
                return
            try:
                qs = urllib.parse.parse_qs(parsed.query)
                allowed = {}
                for name in ("days", "hours", "minutes", "start", "end"):
                    if qs.get(name):
                        allowed[name] = str(qs[name][0])[:80]
                query = urllib.parse.urlencode(allowed)
                data = vault_request("GET", "/v1/admin/analytics" + (("?" + query) if query else ""))
                self.json_response(data)
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 503)
            return

        if parsed.path == "/control/vault/fan-detail":
            if not self.require_auth():
                return
            try:
                qs = urllib.parse.parse_qs(parsed.query)
                anon_id = str((qs.get("anon_id") or [""])[0]).strip()
                if not anon_id:
                    self.json_response({"ok": False, "error": "Missing anonymous fan ID."}, 400)
                    return
                allowed = {"anon_id": anon_id}
                for name in ("days", "hours", "minutes", "start", "end"):
                    if qs.get(name):
                        allowed[name] = str(qs[name][0])[:80]
                path = "/v1/admin/fan-detail?" + urllib.parse.urlencode(allowed)
                data = vault_request("GET", path)
                self.json_response(data)
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 503)
            return

        if parsed.path == "/control/radio-meter":
            if not self.require_auth():
                return
            self.json_response({"ok": True, "radio_meter": radio_meter_status()})
            return

        if self.path == "/control/status":
            if not self.require_auth():
                return
            settings = station_settings()
            file_now = public_track(read_json(NOW, {}))
            rot = read_json(ROTATION, {"entries": []})
            entries = rot.get("entries", [])
            stream_now = icecast_current_track()
            now = dict(file_now)
            file_slot = str(now.get("slot", "") or "")
            matched_now = None
            if file_slot:
                matched_now = next((e for e in entries if str(e.get("slot", "")) == file_slot), None)
            if matched_now is None and not file_slot:
                matched_now = match_rotation_track(entries, stream_now)
            if matched_now:
                now["title"] = matched_now.get("title", now.get("title", ""))
                now["album"] = matched_now.get("album", now.get("album", ""))
                now["artist"] = "Grand Element"
                now["kind"] = matched_now.get("kind", "")
                now["slot"] = matched_now.get("slot", "")
                now["path"] = matched_now.get("path", "")
            elif stream_now.get("title"):
                now["title"] = stream_now.get("title") or now.get("title", "")
                now["artist"] = stream_now.get("artist") or now.get("artist", "Grand Element")
                if stream_now.get("album"):
                    now["album"] = stream_now.get("album")
            playlist_rows = read_custom_playlists().get("items", [])
            active_playlist_id = str(settings.get("custom_mix_id", "") or "")
            active_playlist = next((x for x in playlist_rows if str(x.get("id","")) == active_playlist_id), None)
            active_playlist_name = (active_playlist or {}).get("name") or ("Normal Rotation" if not settings.get("custom_mix_enabled") else "Saved Playlist")
            try:
                now_started_at = float(NOW.stat().st_mtime)
            except Exception:
                now_started_at = 0.0
            now_path = str(now.get("path", "") or "")
            if not now_path:
                slot = str(now.get("slot", "") or "")
                title = str(now.get("title", "") or "")
                album = str(now.get("album", "") or "")
                match = next((e for e in entries if slot and str(e.get("slot", "")) == slot), None)
                if match is None:
                    match = next((e for e in entries if str(e.get("title", "")) == title and str(e.get("album", "")) == album), None)
                if match:
                    now_path = str(match.get("path", "") or "")
                    now["path"] = now_path
            now_duration = track_duration_seconds(rot.get("commit", ""), now_path)

            upcoming = []
            slot = now.get("slot", "")
            if slot:
                for i, e in enumerate(entries):
                    if e.get("slot") == slot:
                        upcoming = entries[i+1:i+6]
                        break
            if not upcoming:
                upcoming = entries[:5]

            def queue_track(e):
                return {
                    "slot": e.get("slot",""),
                    "kind": e.get("kind",""),
                    "title": e.get("title",""),
                    "album": e.get("album",""),
                }

            nxt = queue_track(upcoming[0]) if upcoming else public_track(read_json(NEXT, {}))
            coming = [queue_track(e) for e in upcoming[1:5]]

            self.json_response({
                "version": "7.0",
                "legacy": bool(settings.get("legacy", False)),
                "crossfade_seconds": float(settings.get("crossfade_seconds", 5.0)),
                "custom_mix_enabled": bool(settings.get("custom_mix_enabled", False)),
                "custom_mix_id": str(settings.get("custom_mix_id", "") or ""),
                "active_playlist_name": active_playlist_name,
                "now_started_at": now_started_at,
                "now_duration": now_duration,
                "radio_meter": radio_meter_status(),
                "now": now,
                "now_metadata_source": "icecast" if stream_now.get("title") else "liquidsoap-file",
                "next": nxt,
                "coming": coming,
                "source_ingest": {
                    "architecture": "automation-plus-dj-mic-public-master-mix",
                    "realtime_configured": realtime_configured(),
                    "realtime": realtime_state(),
                    "voice_mount": "",
                    "live_mount": "",
                    "dj_stream": "/dj.mp3",
                    "public_radio_isolated": False,
                    "legacy_source_ingest_enabled": False,
                    "username": "source",
                    "ssl": True,
                    "port": 443,
                },
                "broadcast": broadcast_engine().status(),
                "public_master": public_master_health(),
                "master_progress": master_progress_status(),
                "audio_architecture": "v29-controllable-continuous-ffmpeg-master",
                "mixer": mixer_state(),
                "remote_devices": list_remote_devices(),
            })
            return

        if self.path == "/control/source-info":
            if not self.require_auth():
                return
            self.json_response({
                "ok": True,
                "host": "radio.grandelement.blitz.cloud",
                "port": 443,
                "ssl": True,
                "username": "source",
                "voice_mount": "",
                "live_mount": "",
                "legacy_source_ingest_enabled": False,
                "password": "Use the same DJ password you entered here.",
                "monitor": "/dj-cue.mp3",
                "dj_stream": "/dj.mp3",
                "public_stream": "/stream.mp3",
                "public_radio_isolated": False,
            })
            return

        if parsed.path == "/control/permanent-state":
            if not self.require_auth(): return
            scope = (urllib.parse.parse_qs(parsed.query).get("scope") or [""])[0]
            try:
                state, source = permanent_state_load(scope)
                self.json_response({"ok": True, "scope": scope, "state": state, "source": source, "vault_configured": vault_configured()})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 500)
            return

        if parsed.path == "/control/effect-presets":
            if not self.require_auth(): return
            surface = (urllib.parse.parse_qs(parsed.query).get("surface") or ["dj"])[0]
            try:
                items, source = effect_presets_load(surface)
                self.json_response({"ok": True, "surface": surface, "items": items, "source": source, "vault_configured": vault_configured()})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 500)
            return

        if self.path == "/control/library":
            if not self.require_auth():
                return
            library = read_json(LIBRARY, {"items": []})
            items = list(library.get("items", []))
            items.extend(public_temp_item(x) for x in temp_items())
            self.json_response({
                "commit": str(library.get("commit", "") or ""),
                "items": items,
            })
            return

        if self.path == "/control/playlists":
            if not self.require_auth():
                return
            vault_error = ""
            data = None
            if vault_configured():
                try:
                    data = vault_playlists_load()
                except Exception as exc:
                    vault_error = str(exc)
            if not isinstance(data, dict):
                data = read_custom_playlists()
            self.json_response({
                "items": data.get("items", []),
                "vault_configured": vault_configured(),
                "vault_source": bool(vault_configured() and not vault_error),
                "vault_error": vault_error,
            })
            return

        if self.path == "/control/playlists/backup":
            if not self.require_auth():
                return
            self.json_response(playlist_backup_payload())
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path == "/control/clip/extract":
            if not self.require_auth(): return
            try:
                n = int(self.headers.get("Content-Length", "0") or "0")
                if n <= 0 or n > MAX_CLIP_UPLOAD_BYTES: raise ValueError("Clip must be between 1 byte and 100 MB.")
                CLIP_DIR.mkdir(parents=True, exist_ok=True)
                clip_id = uuid.uuid4().hex[:16]
                raw_name = urllib.parse.unquote(self.headers.get("X-GE-File-Name", "clip"))
                suffix = Path(raw_name).suffix.lower()
                if len(suffix) > 8 or not suffix or not all(ch.isalnum() or ch == "." for ch in suffix): suffix = ".bin"
                src = CLIP_DIR / f"{clip_id}-source{suffix}"
                out = CLIP_DIR / f"{clip_id}.wav"
                src.write_bytes(self.rfile.read(n))
                cmd = ["ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(src),"-vn","-ac", "2","-ar","48000","-c:a","pcm_s16le",str(out)]
                proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90)
                src.unlink(missing_ok=True)
                if proc.returncode != 0 or not out.exists(): raise ValueError((proc.stderr.decode("utf-8","ignore") or "Could not extract audio from that file.")[-500:])
                # Keep temp clip storage bounded.
                files = sorted(CLIP_DIR.glob("*.wav"), key=lambda p:p.stat().st_mtime, reverse=True)
                for old in files[8:]: old.unlink(missing_ok=True)
                self.json_response({"ok": True, "id": clip_id, "name": raw_name, "bytes": out.stat().st_size})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/crossfade":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                seconds = max(0.0, min(12.0, float(body.get("seconds", 5.0))))
                settings = station_settings()
                settings["crossfade_seconds"] = seconds
                write_json(SETTINGS, settings)
                if vault_configured():
                    threading.Thread(
                        target=vault_save_radio_setting,
                        args=("crossfade_seconds", seconds),
                        daemon=True,
                        name="ge-vault-crossfade-save",
                    ).start()
                rotation = read_json(ROTATION, {"entries": []})
                if rotation.get("entries"):
                    rewrite_playlist(rotation)
                    try:
                        liquidsoap_command("radio.reload")
                    except Exception:
                        pass
                self.json_response({"ok": True, "crossfade_seconds": seconds, "vault_configured": vault_configured()})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return


        if self.path == "/control/playlists/import":
            if not self.require_auth(): return
            try:
                payload = self.read_body_json()
                data, settings = import_playlist_backup(payload)
                vault_saved, vault_error = vault_sync_all_playlists(data, str(settings.get("custom_mix_id", "") or ""))
                self.json_response({
                    "ok": True,
                    "items": data.get("items", []),
                    "custom_mix_enabled": bool(settings.get("custom_mix_enabled", False)),
                    "custom_mix_id": str(settings.get("custom_mix_id", "") or ""),
                    "vault_saved": vault_saved,
                    "vault_configured": vault_configured(),
                    "vault_error": vault_error,
                })
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/playlists/save":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                name = " ".join(str(body.get("name", "")).split())[:80]
                if not name:
                    raise ValueError("Enter a playlist name.")
                library = read_json(LIBRARY, {"items": []})
                allowed = {
                    str(x.get("path", "")) for x in library.get("items", [])
                    if x.get("kind") == "song" and str(x.get("path", ""))
                }
                paths = []
                for path in body.get("paths", []):
                    path = str(path)
                    if path in allowed and path not in paths:
                        paths.append(path)
                if not paths:
                    raise ValueError("Choose at least one song.")
                playlist_id = str(body.get("id", "") or uuid.uuid4().hex[:12])
                data = read_custom_playlists()
                item = {
                    "id": playlist_id,
                    "name": name,
                    "paths": paths,
                    "updated_at": int(time.time()),
                }
                existing = next((i for i,x in enumerate(data["items"]) if str(x.get("id","")) == playlist_id), None)
                if existing is None:
                    data["items"].append(item)
                else:
                    data["items"][existing] = item
                write_custom_playlists(data)
                settings = station_settings()
                vault_saved, vault_error = vault_playlist_save(
                    item,
                    active=bool(settings.get("custom_mix_enabled")) and str(settings.get("custom_mix_id")) == playlist_id,
                )
                self.json_response({
                    "ok": True,
                    "playlist": item,
                    "items": data["items"],
                    "vault_saved": vault_saved,
                    "vault_configured": vault_configured(),
                    "vault_error": vault_error,
                })
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/playlists/delete":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                playlist_id = str(body.get("id", ""))
                data = read_custom_playlists()
                before = len(data["items"])
                data["items"] = [x for x in data["items"] if str(x.get("id","")) != playlist_id]
                if len(data["items"]) == before:
                    raise ValueError("Playlist was not found.")
                write_custom_playlists(data)
                settings = station_settings()
                if settings.get("custom_mix_id") == playlist_id:
                    settings["custom_mix_enabled"] = False
                    settings["custom_mix_id"] = ""
                    write_json(SETTINGS, settings)
                vault_deleted, vault_error = vault_playlist_delete(playlist_id)
                self.json_response({
                    "ok": True,
                    "items": data["items"],
                    "vault_deleted": vault_deleted,
                    "vault_configured": vault_configured(),
                    "vault_error": vault_error,
                    "history_retained": vault_deleted,
                })
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/custom-mix":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                enabled = bool(body.get("enabled", False))
                playlist_id = str(body.get("playlist_id", "") or "")
                if enabled:
                    data = read_custom_playlists()
                    if not any(str(x.get("id","")) == playlist_id for x in data["items"]):
                        raise ValueError("Choose a saved Custom Mix first.")
                settings = station_settings()
                settings["custom_mix_enabled"] = enabled
                settings["custom_mix_id"] = playlist_id if enabled else playlist_id
                write_json(SETTINGS, settings)
                vault_saved = False
                vault_error = ""
                if enabled:
                    data = read_custom_playlists()
                    active_item = next((x for x in data["items"] if str(x.get("id","")) == playlist_id), None)
                    if active_item:
                        vault_saved, vault_error = vault_playlist_save(active_item, active=True)
                self.json_response({
                    "ok": True,
                    "custom_mix_enabled": settings["custom_mix_enabled"],
                    "custom_mix_id": settings["custom_mix_id"],
                    "vault_saved": vault_saved,
                    "vault_configured": vault_configured(),
                    "vault_error": vault_error,
                })
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return


        if self.path == "/control/drop/start":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                result = drop_start(body.get("mode", "top"))
                self.json_response({"ok": True, **result})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 503)
            return

        if self.path == "/control/drop/stop":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                result = drop_stop(bool(body.get("fast", False)))
                self.json_response({"ok": True, **result})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 503)
            return

        if self.path == "/control/music-action":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                state, message = music_fade_action(body.get("action"))
                self.json_response({"ok": True, "mixer": state, "message": message})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 503)
            return

        if self.path == "/control/permanent-state":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                scope = str(body.get("scope", "") or "")
                state = body.get("state")
                result = permanent_state_save(scope, state)
                self.json_response({"ok": True, "scope": scope, **result})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/effect-presets/save":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                result, items, vault_saved = effect_preset_save(
                    body.get("surface", "dj"),
                    body.get("name", ""),
                    body.get("settings") or {},
                    body.get("id", ""),
                )
                self.json_response({"ok": True, "preset": result, "items": items, "vault_saved": vault_saved})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/effect-presets/delete":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                items, vault_saved = effect_preset_archive(body.get("surface", "dj"), body.get("id", ""))
                self.json_response({"ok": True, "items": items, "vault_saved": vault_saved})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/mixer":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                state = mixer_state()
                if "music_level" in body:
                    state["music_level"] = clamp_number(body.get("music_level"), 0.0, 1.25, state["music_level"])
                if "music_under_voice" in body:
                    state["music_under_voice"] = clamp_number(body.get("music_under_voice"), 0.0, 1.0, state["music_under_voice"])
                if "music_muted" in body:
                    state["music_muted"] = bool(body.get("music_muted"))
                if "direct_level" in body:
                    state["direct_level"] = clamp_number(body.get("direct_level"), 0.0, 1.5, state["direct_level"])
                if "master_level" in body:
                    state["master_level"] = clamp_number(body.get("master_level"), 0.0, 1.25, state["master_level"])
                apply_mixer_state(state)
                write_json(MIXER_SETTINGS, state)
                permanent_state_save("radio_mixer_server", state)
                self.json_response({"ok": True, "mixer": state, "vault_configured": vault_configured(), "public_radio_isolated": False, "applied_to_public_radio": True, "mix_strategy": "continuous-gain-mix"})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 503)
            return


        if self.path == "/control/vault/fan-label":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                anon_id = str(body.get("anon_id", "") or "").strip()
                if not anon_id:
                    raise ValueError("Missing anonymous fan ID.")
                data = vault_request("POST", "/v1/admin/fan-label", {
                    "anon_id": anon_id,
                    "display_name": str(body.get("display_name", "") or "")[:200],
                    "notes": str(body.get("notes", "") or "")[:2000],
                })
                self.json_response(data)
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 503)
            return

        if self.path == "/control/realtime/publish":
            if not self.require_auth(): return
            try:
                if not realtime_configured():
                    raise RuntimeError("Cloudflare Realtime is not configured. Add CF_REALTIME_APP_ID and CF_REALTIME_APP_SECRET in Blitz.")
                body = self.read_body_json()
                owner = str(body.get("owner", "unknown")).strip().lower()[:32] or "unknown"
                mode = str(body.get("mode", "voice") or "voice")
                track_name = str(body.get("track_name", f"ge-{owner}-audio") or f"ge-{owner}-audio")[:80]
                mid = str(body.get("mid", "") or "")
                desc = body.get("sessionDescription") or {}
                if desc.get("type") != "offer" or not desc.get("sdp") or not mid:
                    raise ValueError("Realtime publish requires an SDP offer and audio MID.")
                bstate = broadcast_engine().status()
                if bstate.get("active") and bstate.get("owner") not in {"none", owner}:
                    raise RuntimeError(f"Live audio is already owned by {bstate.get('owner')}.")
                old = realtime_state()
                if old.get("owner") not in {"none", owner}:
                    raise RuntimeError(f"Realtime transport is already owned by {old.get('owner')}.")
                if old.get("owner") == owner and old.get("session_id"):
                    realtime_cleanup(owner=owner, force=True, stop_broadcast=False)
                session = cf_realtime_request("POST", f"/apps/{CF_REALTIME_APP_ID}/sessions/new", {})
                session_id = str(session.get("sessionId", "") or "")
                if not session_id:
                    raise RuntimeError("Cloudflare Realtime did not return a session ID.")
                published = cf_realtime_request("POST", f"/apps/{CF_REALTIME_APP_ID}/sessions/{session_id}/tracks/new", {
                    "sessionDescription": {"type": "offer", "sdp": str(desc.get("sdp"))},
                    "tracks": [{"location": "local", "mid": mid, "trackName": track_name}],
                })
                answer = published.get("sessionDescription") or {}
                tracks = published.get("tracks") or []
                if tracks and tracks[0].get("errorCode"):
                    raise RuntimeError(tracks[0].get("errorDescription") or tracks[0].get("errorCode"))
                if answer.get("type") != "answer" or not answer.get("sdp"):
                    raise RuntimeError("Cloudflare Realtime did not return an SDP answer.")
                realtime_reserve(owner, mode, session_id, mid, track_name)
                self.json_response({
                    "ok": True,
                    "session_id": session_id,
                    "mid": mid,
                    "track_name": track_name,
                    "sessionDescription": answer,
                    "transport": "webrtc-opus-cloudflare",
                })
            except Exception as exc:
                try:
                    realtime_cleanup(owner=(locals().get("owner") or None), force=True, stop_broadcast=False)
                except Exception:
                    pass
                self.json_response({"ok": False, "error": str(exc)}, 503)
            return

        if self.path == "/control/realtime/attach":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                owner = str(body.get("owner", "unknown")).strip().lower()[:32] or "unknown"
                state = realtime_state()
                if state.get("owner") != owner or not state.get("session_id"):
                    raise RuntimeError("Realtime publication is not reserved for this source.")
                token = uuid.uuid4().hex + uuid.uuid4().hex
                endpoint = GE_PUBLIC_RADIO_BASE.replace("https://", "wss://").replace("http://", "ws://") + "/control/realtime-ingest?token=" + urllib.parse.quote(token)
                bstate = broadcast_engine().start(state.get("mode", "voice"), "webrtc-opus-cloudflare", owner)
                with REALTIME_LOCK:
                    REALTIME_STATE["ingest_token"] = token
                adapter = cf_realtime_request("POST", f"/apps/{CF_REALTIME_APP_ID}/adapters/websocket/new", {
                    "tracks": [{
                        "location": "remote",
                        "sessionId": state["session_id"],
                        "trackName": state["track_name"],
                        "endpoint": endpoint,
                        "outputCodec": "pcm",
                    }]
                })
                tracks = adapter.get("tracks") or []
                if not tracks or tracks[0].get("errorCode"):
                    raise RuntimeError((tracks[0].get("errorDescription") if tracks else "") or "Cloudflare Realtime adapter could not start.")
                adapter_id = str(tracks[0].get("adapterId", "") or "")
                if not adapter_id:
                    raise RuntimeError("Cloudflare Realtime did not return an adapter ID.")
                with REALTIME_LOCK:
                    REALTIME_STATE["adapter_id"] = adapter_id
                self.json_response({"ok": True, "broadcast": bstate, "transport": "webrtc-opus-cloudflare"})
            except Exception as exc:
                try:
                    realtime_cleanup(owner=(locals().get("owner") or None), force=True, stop_broadcast=True)
                except Exception:
                    pass
                self.json_response({"ok": False, "error": str(exc)}, 503)
            return

        if self.path == "/control/realtime/stop":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                owner = str(body.get("owner", "") or "").strip().lower()
                realtime_cleanup(owner=owner or None, force=bool(body.get("force", False)), stop_broadcast=True)
                self.json_response({"ok": True, "broadcast": broadcast_engine().status()})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 409)
            return

        if self.path == "/control/device/pair/create":
            if not self.require_auth(): return
            try:
                code = create_remote_pairing()
                self.json_response({"ok": True, "code": code, "expires_seconds": 600})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 500)
            return

        if self.path == "/control/device/pair/claim":
            try:
                client_ip = (self.headers.get("CF-Connecting-IP") or self.headers.get("X-Forwarded-For") or self.client_address[0] or "").split(",")[0].strip()
                check_remote_pair_rate(client_ip)
                body = self.read_body_json()
                device_id, device_key = claim_remote_pairing(body.get("code"), body.get("name"), body.get("platform", "ios"), body.get("model", ""))
                self.json_response({"ok": True, "device_id": device_id, "device_key": device_key})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/device/heartbeat":
            row = remote_device_auth(self.headers)
            if not row:
                self.json_response({"ok": False, "error": "Remote device authorization failed."}, 401); return
            try:
                body = self.read_body_json()
                fields = {
                    "last_seen": time.time(),
                    "remote_ready": bool(body.get("remote_ready", False)),
                    "mic_active": bool(body.get("mic_active", False)),
                    "on_air": bool(body.get("on_air", False)),
                    "muted": bool(body.get("muted", False)),
                    "level": clamp_number(body.get("level"), 0.0, 1.5, 1.0),
                    "peak_pct": clamp_number(body.get("peak_pct"), 0.0, 100.0, 0.0),
                    "app_state": str(body.get("app_state", ""))[:40],
                    "last_error": str(body.get("last_error", ""))[:300],
                }
                updated = update_remote_device(row["id"], fields)
                self.json_response({"ok": True, "device": _remote_public(updated), "commands": take_remote_commands(row["id"])})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/device/command":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                action = str(body.get("action", "") or "").strip().lower()
                if action not in {"arm","air","mute","level","fx","stop","ping"}:
                    raise ValueError("Unsupported remote-device command.")
                command = queue_remote_command(body.get("device_id"), action, body.get("value"))
                self.json_response({"ok": True, "command": command})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/device/live-session":
            row = remote_device_auth(self.headers)
            if not row:
                self.json_response({"ok": False, "error": "Remote device authorization failed."}, 401); return
            try:
                fresh = next((x for x in list_remote_devices() if x["id"] == row["id"]), None)
                if not fresh or not fresh.get("remote_ready"):
                    raise RuntimeError("Remote device is not armed.")
                owner = "remote-" + row["id"]
                state = broadcast_engine().start("voice", "websocket", owner)
                token = create_live_session()
                self.json_response({"ok": True, "token": token, "expires_seconds": 60, "owner": owner, "broadcast": state})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 409)
            return

        if self.path == "/control/device/live-stop":
            row = remote_device_auth(self.headers)
            if not row:
                self.json_response({"ok": False, "error": "Remote device authorization failed."}, 401); return
            try:
                owner = "remote-" + row["id"]
                state = broadcast_engine().stop(owner=owner, force=False)
                update_remote_device(row["id"], {"on_air": False, "last_seen": time.time()})
                self.json_response({"ok": True, "broadcast": state})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 409)
            return

        if self.path == "/control/broadcast/session":
            if not self.require_auth(): return
            try:
                token = create_live_session()
                self.json_response({"ok": True, "token": token, "expires_seconds": 60})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 500)
            return

        if self.path == "/control/broadcast/start":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                state = broadcast_engine().start(body.get("mode", "voice"), body.get("transport", "websocket"), body.get("owner", "unknown"))
                self.json_response({"ok": True, "broadcast": state})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 500)
            return

        if self.path == "/control/broadcast/pcm":
            if not self.require_auth():
                return
            try:
                n = int(self.headers.get("Content-Length", "0") or "0")
                if n <= 0:
                    raise ValueError("Empty PCM microphone chunk.")
                if n > 1024 * 1024:
                    raise ValueError("PCM microphone chunk is too large.")
                data = self.rfile.read(n)
                if len(data) != n:
                    raise ValueError("PCM microphone chunk was incomplete.")
                broadcast_engine().write_pcm(data)
                self.json_response({"ok": True})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/broadcast/chunk":
            if not self.require_auth(): return
            self.json_response({"ok": False, "error": "Use the v4.2 direct live WebSocket."}, 410)
            return

        if self.path == "/control/broadcast/stop":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                state = broadcast_engine().stop(body.get("owner"), bool(body.get("force", False)))
                self.json_response({"ok": True, "broadcast": state})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 409)
            return

        if self.path == "/control/legacy":
            if not self.require_auth():
                return
            try:
                body = self.read_body_json()
                settings = station_settings()
                settings["legacy"] = bool(body.get("enabled", False))
                write_json(SETTINGS, settings)
                self.json_response({"ok": True, "legacy": settings["legacy"]})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/upload":
            if not self.require_auth():
                return
            tmp_path = None
            final_path = None
            try:
                n = int(self.headers.get("Content-Length", "0") or "0")
                if n <= 0:
                    raise ValueError("Choose an MP3 file first.")
                if n > MAX_UPLOAD_BYTES:
                    raise ValueError("That MP3 is larger than the 100 MB temporary upload limit.")

                encoded_name = self.headers.get("X-GE-File-Name", "upload.mp3")
                original_name = urllib.parse.unquote(encoded_name).strip() or "upload.mp3"
                if not original_name.lower().endswith(".mp3"):
                    raise ValueError("Temporary uploads currently accept MP3 files only.")

                prune_temp_storage(n)
                UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

                title = Path(original_name).stem.strip() or "Temporary Track"
                title = " ".join(title.replace("_", " ").split())[:100]
                unique = uuid.uuid4().hex
                final_path = UPLOAD_DIR / f"{unique}.mp3"
                tmp_path = UPLOAD_DIR / f".{unique}.part"

                remaining = n
                with tmp_path.open("wb") as out:
                    while remaining > 0:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            raise ValueError("Upload ended before the complete MP3 was received.")
                        out.write(chunk)
                        remaining -= len(chunk)

                tmp_path.replace(final_path)
                tmp_path = None

                item = {
                    "kind": "temp_upload",
                    "title": title,
                    "picker_title": title,
                    "album": "Temporary Upload",
                    "path": str(final_path),
                    "section": "temporary",
                    "size": n,
                    "uploaded_at": int(time.time()),
                    "original_name": original_name,
                }
                data = read_temp_uploads()
                data.setdefault("items", []).append(item)
                write_temp_uploads(data)

                self.json_response({
                    "ok": True,
                    "item": public_temp_item(item),
                    "storage_limit_bytes": MAX_TEMP_STORAGE_BYTES,
                })
            except Exception as exc:
                for p in (tmp_path, final_path):
                    try:
                        if p:
                            Path(p).unlink(missing_ok=True)
                    except Exception:
                        pass
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/reshuffle":
            if not self.require_auth():
                return
            try:
                rotation = read_json(ROTATION, {"entries": []})
                entries = list(rotation.get("entries", []))
                if len(entries) < 3:
                    raise ValueError("Rotation is not ready to reshuffle.")

                file_now = public_track(read_json(NOW, {}))
                current_slot = str(file_now.get("slot", "") or "")
                current_index = next((i for i, e in enumerate(entries) if current_slot and str(e.get("slot", "")) == current_slot), -1)
                if current_index < 0:
                    stream_now = icecast_current_track()
                    matched = match_rotation_track(entries, stream_now)
                    matched_slot = str((matched or {}).get("slot", "") or "")
                    current_index = next((i for i, e in enumerate(entries) if matched_slot and str(e.get("slot", "")) == matched_slot), -1)

                start_index = max(0, current_index + 1)
                song_positions = [i for i in range(start_index, len(entries)) if entries[i].get("kind") == "song"]
                if len(song_positions) < 2:
                    raise ValueError("There are not enough future songs to reshuffle.")

                songs = [dict(entries[i]) for i in song_positions]
                random.SystemRandom().shuffle(songs)

                current_title = str(file_now.get("title", "") or "")
                if current_title and len(songs) > 1 and str(songs[0].get("title", "")) == current_title:
                    swap = next((j for j, song in enumerate(songs[1:], 1) if str(song.get("title", "")) != current_title), None)
                    if swap is not None:
                        songs[0], songs[swap] = songs[swap], songs[0]

                for pos, moved in zip(song_positions, songs):
                    fixed_slot = entries[pos].get("slot", "")
                    entries[pos] = moved
                    entries[pos]["slot"] = fixed_slot

                rotation["entries"] = entries
                rotation["reshuffled_at"] = int(time.time())
                write_json(ROTATION, rotation)
                rewrite_playlist(rotation)
                try:
                    liquidsoap_command("radio.reload")
                except Exception:
                    pass

                upcoming = []
                for e in entries[start_index:]:
                    if e.get("kind") == "song":
                        upcoming.append({
                            "slot": e.get("slot", ""),
                            "kind": e.get("kind", ""),
                            "title": e.get("title", ""),
                            "album": e.get("album", ""),
                        })
                    if len(upcoming) >= 5:
                        break
                self.json_response({"ok": True, "upcoming": upcoming})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/reorder":
            if not self.require_auth():
                return
            try:
                body = self.read_body_json()
                slots = [str(x) for x in (body.get("slots") or []) if str(x)]
                if len(slots) < 2:
                    raise ValueError("Choose at least two upcoming tracks to reorder.")
                if len(slots) != len(set(slots)):
                    raise ValueError("Queue order contained a duplicate slot.")

                rotation = read_json(ROTATION, {"entries": []})
                entries = rotation.get("entries", [])
                slot_to_index = {str(e.get("slot", "")): i for i, e in enumerate(entries)}
                missing = [s for s in slots if s not in slot_to_index]
                if missing:
                    raise ValueError("The queue changed before the new order could be saved.")

                positions = sorted(slot_to_index[s] for s in slots)
                ordered_entries = [entries[slot_to_index[s]] for s in slots]

                for pos, moved in zip(positions, ordered_entries):
                    fixed_slot = entries[pos].get("slot", "")
                    entries[pos] = dict(moved)
                    entries[pos]["slot"] = fixed_slot

                rotation["entries"] = entries
                write_json(ROTATION, rotation)
                rewrite_playlist(rotation)
                try:
                    liquidsoap_command("radio.reload")
                except Exception:
                    pass
                self.json_response({"ok": True})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/replace":
            if not self.require_auth():
                return
            try:
                body = self.read_body_json()
                target_slot = str(body.get("slot", ""))
                selected_path = str(body.get("path", ""))
                if not target_slot or not selected_path:
                    raise ValueError("Missing queue slot or track.")

                rotation = read_json(ROTATION, {"entries": []})
                library = read_json(LIBRARY, {"items": []})
                entries = rotation.get("entries", [])
                items = list(library.get("items", []))
                items.extend(public_temp_item(x) for x in temp_items())

                selected = next((x for x in items if x.get("path") == selected_path), None)
                if not selected:
                    raise ValueError("Selected track is not in the current library.")

                target_index = next((i for i, x in enumerate(entries) if x.get("slot") == target_slot), None)
                if target_index is None:
                    raise ValueError("That queue position is no longer available.")

                old = entries[target_index]
                entries[target_index] = {
                    "slot": old.get("slot", target_slot),
                    "kind": selected.get("kind", "song"),
                    "title": selected.get("title", ""),
                    "album": selected.get("album", ""),
                    "path": selected.get("path", ""),
                }
                rotation["entries"] = entries
                write_json(ROTATION, rotation)
                rewrite_playlist(rotation)

                # Ask Liquidsoap to reload immediately. The watched playlist file
                # remains the fallback if the command is unavailable.
                try:
                    liquidsoap_command("radio.reload")
                except Exception:
                    pass

                self.json_response({
                    "ok": True,
                    "slot": target_slot,
                    "track": {
                        "kind": entries[target_index].get("kind",""),
                        "title": entries[target_index].get("title",""),
                        "album": entries[target_index].get("album",""),
                    },
                })
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
            return

        if self.path == "/control/skip":
            if not self.require_auth():
                return
            try:
                result = liquidsoap_command("radio.skip")
                self.json_response({"ok": True, "result": result[-500:]})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 500)
            return

        self.send_response(404)
        self.end_headers()

if __name__ == "__main__":
    BROADCAST = BroadcastEngine()
    RADIO_METER = RadioMeter()
    if vault_configured():
        threading.Thread(target=restore_vault_settings_after_start, daemon=True, name="ge-vault-settings-restore").start()
    print("GE Radio: direct microphone bridge ready on /control/live.", flush=True)
    print("GE Radio: DJ control server listening internally on 8090.", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8090), Handler).serve_forever()
