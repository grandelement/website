#!/usr/bin/env python3
import base64
import hmac
import hashlib
import json
import struct
import os
import socket
import time
import uuid
import urllib.parse
import subprocess
import threading
import queue
try:
    import zmq
except Exception:
    zmq = None
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RUNTIME = Path("/app/runtime")
SETTINGS = RUNTIME / "settings.json"
ROTATION = RUNTIME / "rotation.json"
LIBRARY = RUNTIME / "library.json"
PLAYLIST = RUNTIME / "playlist.m3u"
NOW = RUNTIME / "now.json"
NEXT = RUNTIME / "next.json"
DJ_HTML = Path("/app/dj.html")
UPLOAD_DIR = RUNTIME / "uploads"
TEMP_UPLOADS = RUNTIME / "temp-uploads.json"
MIXER_SETTINGS = RUNTIME / "mixer.json"
CUSTOM_PLAYLISTS = RUNTIME / "custom-playlists.json"
MAX_UPLOAD_BYTES = 100 * 1024 * 1024
MAX_TEMP_STORAGE_BYTES = 256 * 1024 * 1024

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
        "crossfade_seconds": max(0.0, min(12.0, float(raw.get("crossfade_seconds", 5.0) or 5.0))),
        "custom_mix_enabled": bool(raw.get("custom_mix_enabled", False)),
        "custom_mix_id": str(raw.get("custom_mix_id", "") or ""),
    }

def read_custom_playlists():
    data = read_json(CUSTOM_PLAYLISTS, {"items": []})
    if not isinstance(data, dict):
        data = {"items": []}
    if not isinstance(data.get("items"), list):
        data["items"] = []
    return data

def write_custom_playlists(data):
    write_json(CUSTOM_PLAYLISTS, data)

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
    }

def q(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"')

def raw_url(commit_sha, path):
    from urllib.parse import quote
    return f"https://raw.githubusercontent.com/grandelement/website/{commit_sha}/{quote(path, safe='/')}"

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
    }

def mixer_zmq_command(target, command, value):
    if zmq is None:
        raise RuntimeError("Live mixer controls are unavailable on this server build.")
    ctx = zmq.Context.instance()
    sock = ctx.socket(zmq.REQ)
    sock.setsockopt(zmq.LINGER, 0)
    sock.setsockopt(zmq.SNDTIMEO, 1200)
    sock.setsockopt(zmq.RCVTIMEO, 1200)
    try:
        sock.connect("tcp://127.0.0.1:5555")
        sock.send_string(f"{target} {command} {value}")
        reply = sock.recv_string()
        if not reply.startswith("0 "):
            raise RuntimeError(reply)
        return reply
    finally:
        sock.close(0)

def apply_mixer_state(state):
    effective_music = 0.0 if state.get("music_muted") else float(state.get("music_level", 1.0))
    duck_mix = 1.0 - float(state.get("music_under_voice", 0.45))
    mixer_zmq_command("volume@musicgain", "volume", f"{effective_music:.4f}")
    mixer_zmq_command("sidechaincompress@duck", "mix", f"{duck_mix:.4f}")

class BroadcastEngine:
    SAMPLE_RATE = 48000
    CHANNELS = 2
    SAMPLE_BYTES = 2
    FRAME_MS = 20
    FRAME_BYTES = SAMPLE_RATE * CHANNELS * SAMPLE_BYTES * FRAME_MS // 1000
    STALE_SECONDS = 4.0
    FIFO_PATH = RUNTIME / "mic.pcm"

    def __init__(self):
        self.lock = threading.RLock()
        self.pcm = queue.Queue(maxsize=120)
        self.pending = bytearray()
        self.fifo_fd = None
        self.active = False
        self.mode = "off"
        self.transport = "websocket"
        self.last_chunk = 0.0
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
            print(f"GE Radio: direct microphone FIFO open failed: {exc}", flush=True)
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
        while True:
            try:
                self.pcm.get_nowait()
            except queue.Empty:
                break

    def _expire_if_stale_locked(self):
        if self.active and self.last_chunk and (time.monotonic() - self.last_chunk) > self.STALE_SECONDS:
            print("GE Radio: direct live input timed out; returning to silence.", flush=True)
            self.active = False
            self.mode = "off"
            self._clear_audio_locked()

    def _write_frame(self, frame):
        fd = self.fifo_fd
        if fd is None:
            return
        try:
            os.write(fd, frame)
        except BlockingIOError:
            pass
        except BrokenPipeError:
            with self.lock:
                try:
                    os.close(fd)
                except Exception:
                    pass
                self.fifo_fd = None
        except Exception as exc:
            print(f"GE Radio: direct mic FIFO write failed: {exc}", flush=True)

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
                try:
                    frame = self.pcm.get_nowait()
                except queue.Empty:
                    frame = silence

            self._write_frame(frame)

            deadline += frame_seconds
            wait = deadline - time.monotonic()
            if wait > 0:
                self.stop_event.wait(wait)
            elif wait < -0.25:
                deadline = time.monotonic()

    def start(self, mode, transport="websocket"):
        mode = str(mode or "voice").strip().lower()
        if mode not in {"voice", "performance"}:
            mode = "voice"
        with self.lock:
            self._ensure_fifo_locked()
            self._clear_audio_locked()
            self.active = True
            self.mode = mode
            self.transport = str(transport or "websocket")
            self.last_chunk = time.monotonic()
            return self.status_locked()

    def write_pcm(self, data):
        if not data:
            raise ValueError("Empty microphone audio.")
        with self.lock:
            self._expire_if_stale_locked()
            if not self.active:
                raise RuntimeError("Live input is not active.")
            self._queue_pcm_bytes(data)
            self.last_chunk = time.monotonic()

    def stop(self):
        with self.lock:
            self.active = False
            self.mode = "off"
            self._clear_audio_locked()
            return self.status_locked()

    def status_locked(self):
        return {
            "ready": bool(self.fifo_fd is not None),
            "active": bool(self.active),
            "mode": self.mode,
            "transport": self.transport,
            "last_chunk_age": max(0.0, time.monotonic() - self.last_chunk) if self.last_chunk else None,
            "queue_frames": self.pcm.qsize(),
        }

    def status(self):
        with self.lock:
            self._expire_if_stale_locked()
            self._ensure_fifo_locked()
            return self.status_locked()

BROADCAST = None
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

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/control/live":
            qs = urllib.parse.parse_qs(parsed.query)
            token = (qs.get("token") or [""])[0]
            self._serve_live_websocket(token)
            return

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

        if self.path == "/control/status":
            if not self.require_auth():
                return
            settings = station_settings()
            now = public_track(read_json(NOW, {}))
            rot = read_json(ROTATION, {"entries": []})
            entries = rot.get("entries", [])

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
                "version": "4.9",
                "legacy": bool(settings.get("legacy", False)),
                "crossfade_seconds": float(settings.get("crossfade_seconds", 5.0)),
                "custom_mix_enabled": bool(settings.get("custom_mix_enabled", False)),
                "custom_mix_id": str(settings.get("custom_mix_id", "") or ""),
                "now": now,
                "next": nxt,
                "coming": coming,
                "mic_ready": broadcast_engine().status().get("ready", False),
                "broadcast": broadcast_engine().status(),
                "mixer": mixer_state(),
            })
            return

        if self.path == "/control/library":
            if not self.require_auth():
                return
            library = read_json(LIBRARY, {"items": []})
            items = list(library.get("items", []))
            items.extend(public_temp_item(x) for x in temp_items())
            self.json_response({
                "items": items,
            })
            return

        if self.path == "/control/playlists":
            if not self.require_auth():
                return
            self.json_response(read_custom_playlists())
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path == "/control/crossfade":
            if not self.require_auth(): return
            try:
                body = self.read_body_json()
                seconds = max(0.0, min(12.0, float(body.get("seconds", 5.0))))
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
                self.json_response({"ok": True, "crossfade_seconds": seconds})
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
                self.json_response({"ok": True, "playlist": item, "items": data["items"]})
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
                self.json_response({"ok": True, "items": data["items"]})
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
                self.json_response({
                    "ok": True,
                    "custom_mix_enabled": settings["custom_mix_enabled"],
                    "custom_mix_id": settings["custom_mix_id"],
                })
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 400)
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
                apply_mixer_state(state)
                write_json(MIXER_SETTINGS, state)
                self.json_response({"ok": True, "mixer": state})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 503)
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
                state = broadcast_engine().start(body.get("mode", "voice"), body.get("transport", "pcm"))
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
                state = broadcast_engine().stop()
                self.json_response({"ok": True, "broadcast": state})
            except Exception as exc:
                self.json_response({"ok": False, "error": str(exc)}, 500)
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
    print("GE Radio: direct microphone bridge ready on /control/live.", flush=True)
    print("GE Radio: DJ control server listening internally on 8090.", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8090), Handler).serve_forever()
