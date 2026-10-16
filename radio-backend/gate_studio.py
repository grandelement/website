"""GE Gate Studio: per-visitor programs, background defaults, and fade controls.

The public station is never modified. Only DJ-authenticated requests may edit
programs. Guest passwords are salted hashes and are never sent to the browser.
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import tempfile
import threading
import time
import urllib.parse
import uuid
from pathlib import Path

DATA = Path(os.environ.get("GE_DATA_DIR", "/app/data"))
SETTINGS = DATA / "gate-settings.json"
PROGRAMS = DATA / "gate-programs.json"
LIBRARY = Path("/app/runtime/library.json")
LOCK = threading.RLock()
ATTEMPTS = {}
IMAGE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,65}\.(?:gif|png|jpg|jpeg|webp)$", re.I)
DEFAULT_SETTINGS = {"fade_delay_seconds": 11, "fade_seconds": 60, "reverb_level": 2.4}


def read(path, fallback):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else fallback
    except (FileNotFoundError, ValueError, OSError, UnicodeError):
        return fallback


def write(path, obj):
    DATA.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".gate-", dir=str(DATA))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            json.dump(obj, out, ensure_ascii=False, separators=(",", ":"))
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def settings():
    raw = read(SETTINGS, {})
    result = dict(DEFAULT_SETTINGS)
    for name, low, high in (
        ("fade_delay_seconds", 0, 120),
        ("fade_seconds", 10, 180),
        ("reverb_level", 0, 4),
    ):
        try:
            value = float(raw.get(name, result[name]))
            if low <= value <= high:
                result[name] = value
        except (ValueError, TypeError, OverflowError):
            pass
    return result


def image_name(value):
    name = str(value or "").strip()
    return name if IMAGE_RE.fullmatch(name) else ""


def get_library():
    return [x for x in read(LIBRARY, {"items": []}).get("items", []) if
            isinstance(x, dict) and x.get("kind") == "song"]


def persisted():
    data = read(PROGRAMS, {"programs": [], "image_defaults": {}})
    return {
        "programs": data.get("programs", []) if isinstance(data.get("programs"), list) else [],
        "image_defaults": data.get("image_defaults", {}) if isinstance(data.get("image_defaults"), dict) else {},
    }


def public_program(row):
    return {
        "id": row.get("id", ""), "name": row.get("name", ""),
        "steps": row.get("steps", []), "end_mode": row.get("end_mode", "radio"),
        "has_password": bool(row.get("digest", "")),
        "updated_at": row.get("updated_at", 0),
    }


def digest(value, salt):
    return hashlib.pbkdf2_hmac(
        "sha256", value.strip().casefold().encode("utf-8"), bytes.fromhex(salt), 210000
    ).hex()


def clean_step(row, allowed, albums):
    if not isinstance(row, dict):
        return None
    kind = str(row.get("kind", "song"))
    image = image_name(row.get("image", ""))
    if kind == "song":
        path = str(row.get("path", ""))
        return {"kind": "song", "path": path, "image": image} if path in allowed else None
    if kind == "album":
        album = str(row.get("album", ""))[:100]
        return {"kind": "album", "album": album, "image": image} if album in albums else None
    return None


def unlock_limited(ip):
    with LOCK:
        now = time.monotonic()
        recent = [t for t in ATTEMPTS.get(ip, []) if now - t < 120]
        if len(recent) >= 12:
            return True
        recent.append(now)
        ATTEMPTS[ip] = recent
        if len(ATTEMPTS) > 2000:
            for key in list(ATTEMPTS)[:500]:
                ATTEMPTS.pop(key, None)
    return False


def audio_plan(row, defaults):
    tracks = get_library()
    by_path = {str(x.get("path", "")): x for x in tracks}
    by_album = {}
    for x in tracks:
        by_album.setdefault(str(x.get("album", "")), []).append(x)
    result = []
    for step in row.get("steps", []):
        if step.get("kind") == "song":
            items = [by_path[step["path"]]] if step.get("path") in by_path else []
        elif step.get("kind") == "album":
            items = by_album.get(str(step.get("album", "")), [])
        else:
            items = []
        for song in items:
            path = str(song["path"])
            filename = image_name(step.get("image")) or image_name(defaults.get(path, ""))
            result.append({
                "url": "https://www.grandelement.com/" + urllib.parse.quote(path, safe="/"),
                "path": path,
                "title": str(song.get("title", "")),
                "album": str(song.get("album", "")),
                "image": filename,
            })
            if len(result) >= 500:
                return result
    return result


def handle_get(h, path):
    if path == "/control/gate/public":
        h.json_response({"ok": True, "settings": settings()})
        return True
    if path != "/control/gate/studio":
        return False
    if not h.require_auth():
        return True
    saved = persisted()
    h.json_response({
        "ok": True,
        "settings": settings(),
        "programs": [public_program(x) for x in saved["programs"]],
        "image_defaults": saved["image_defaults"],
    })
    return True


def handle_post(h, path):
    if path not in (
        "/control/gate/settings", "/control/gate/program/save",
        "/control/gate/program/delete", "/control/gate/image-default",
        "/control/gate/unlock",
    ):
        return False
    is_public = path == "/control/gate/unlock"
    if not is_public and not h.require_auth():
        return True
    try:
        if is_public:
            ip = h.headers.get("X-Real-IP", h.client_address[0])
            if unlock_limited(ip):
                h.json_response({"ok": False, "error": "Too many attempts."}, 429)
                return True
            body = h.read_body_json()
            code = str(body.get("password", "")).strip()
            if not (1 <= len(code) <= 64):
                raise ValueError("Invalid code")
            saved = persisted()
            matching = None
            for item in saved["programs"]:
                try:
                    if hmac.compare_digest(digest(code, item.get("salt", "")), str(item.get("digest", ""))):
                        matching = item
                except (ValueError, TypeError):
                    continue
            if not matching:
                raise ValueError("Invalid code")
            plan = audio_plan(matching, saved["image_defaults"])
            if not plan:
                raise ValueError("Missing tracks")
            h.json_response({
                "ok": True, "name": matching.get("name", ""),
                "tracks": plan,
                "end_mode": matching.get("end_mode", "radio"),
            })
            return True

        body = h.read_body_json()
        if path == "/control/gate/settings":
            result = {}
            for name, low, high in (
                ("fade_delay_seconds", 0, 120),
                ("fade_seconds", 10, 180),
                ("reverb_level", 0, 4),
            ):
                value = float(body.get(name))
                if not low <= value <= high:
                    raise ValueError(name + " out of range.")
                result[name] = value
            with LOCK:
                write(SETTINGS, result)
            h.json_response({"ok": True, "settings": result})
            return True

        with LOCK:
            saved = persisted()
            saved_id = ""
            if path == "/control/gate/image-default":
                path_name = str(body.get("path", ""))
                if path_name not in {x.get("path") for x in get_library()}:
                    raise ValueError("Unknown song")
                image = image_name(body.get("image"))
                if image:
                    saved["image_defaults"][path_name] = image
                else:
                    saved["image_defaults"].pop(path_name, None)
                write(PROGRAMS, saved)
            elif path == "/control/gate/program/delete":
                pid = str(body.get("id", ""))
                saved["programs"] = [x for x in saved["programs"] if str(x.get("id")) != pid]
                write(PROGRAMS, saved)
            else:
                name = " ".join(str(body.get("name", "")).split())[:80]
                pid = str(body.get("id", ""))[:40] or uuid.uuid4().hex[:16]
                code = str(body.get("password", "")).strip()
                if not name:
                    raise ValueError("Name the program.")
                library = get_library()
                allowed = {str(x.get("path", "")) for x in library}
                albums = {str(x.get("album", "")) for x in library}
                steps = [clean_step(x, allowed, albums) for x in body.get("steps", [])[:300]]
                if not steps or any(x is None for x in steps):
                    raise ValueError("Add valid songs or albums.")
                mode = str(body.get("end_mode", "radio"))
                if mode not in ("radio", "shuffle", "stop"):
                    raise ValueError("Unknown ending.")
                existing = next((x for x in saved["programs"] if str(x.get("id")) == pid), None)
                if not existing and not code:
                    raise ValueError("A new Gate program requires a password.")
                if code and not 6 <= len(code) <= 64:
                    raise ValueError("Password must contain 6–64 characters.")
                if code:
                    for other in saved["programs"]:
                        if str(other.get("id")) == pid:
                            continue
                        try:
                            if hmac.compare_digest(digest(code, other.get("salt", "")),
                                                   str(other.get("digest", ""))):
                                raise ValueError("This Gate password is assigned to another program.")
                        except (TypeError, ValueError) as error:
                            if str(error).startswith("This Gate password"):
                                raise
                            continue
                updated = dict(existing) if existing else {"id": pid}
                updated.update({
                    "name": name, "steps": steps, "end_mode": mode,
                    "updated_at": int(time.time()),
                })
                if code:
                    salt = secrets.token_hex(16)
                    updated["salt"] = salt
                    updated["digest"] = digest(code, salt)
                if existing:
                    saved["programs"] = [
                        updated if str(x.get("id")) == pid else x for x in saved["programs"]
                    ]
                else:
                    if len(saved["programs"]) >= 200:
                        raise ValueError("Gate program limit reached.")
                    saved["programs"].append(updated)
                write(PROGRAMS, saved)
                saved_id = pid
            h.json_response({
                "ok": True, "saved_id": saved_id, "programs": [public_program(x) for x in saved["programs"]],
                "image_defaults": saved["image_defaults"],
            })
            return True
    except Exception as exc:
        if is_public:
            h.json_response({"ok": False, "error": "Invalid access code."}, 401)
        else:
            h.json_response({"ok": False, "error": str(exc)}, 400)
    return True
