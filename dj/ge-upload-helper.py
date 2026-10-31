#!/usr/bin/env python
# -*- coding: utf-8 -*-
# GE Studios local Google Drive uploader for OS X 10.11 (Python 2.7).
# Loopback-only service. Never touches Ableton, Saffire, BLITZ or BANGERS.
# The DJ webpage transfers file bytes to this Mac, then rclone uploads to Drive.
from __future__ import print_function
import errno
import json
import math
import struct
import wave
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import uuid

try:
    from BaseHTTPServer import HTTPServer, BaseHTTPRequestHandler
    from SocketServer import ThreadingMixIn
    from urlparse import urlparse, parse_qs
    from urllib import unquote
except ImportError:
    from http.server import HTTPServer, BaseHTTPRequestHandler
    from socketserver import ThreadingMixIn
    from urllib.parse import urlparse, parse_qs, unquote

HOST = "127.0.0.1"
PORT = 8765
ORIGINS = ("https://grandelement.com", "https://www.grandelement.com")
RCLONE = os.path.expanduser("~/Downloads/rclone-v1.52.0-osx-amd64/rclone")
CONFIG = os.path.expanduser("~/.config/rclone/rclone.conf")
REMOTE = "GEStudios:GE Studios"
LIMIT = 4 * 1024 * 1024 * 1024  # 4 GiB, transmitted in bounded chunks
CHUNK = 1024 * 1024
JOBS = {}
COVERS = {}
GUARD = threading.Lock()
# Only the fixed GEStudios OAuth command is permitted on this Mac.
DRIVE_RECONNECT = {"phase": "idle", "detail": "Google sign-in not started.", "started_at": 0}
PY3 = sys.version_info[0] >= 3

def as_text(s):
    if isinstance(s, bytes):
        return s.decode("utf-8", "replace")
    return s

def find_ffmpeg():
    for name in ("/usr/local/bin/ffmpeg", "/opt/local/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg"):
        if os.path.isfile(name) and os.access(name, os.X_OK):
            return name
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        filename = os.path.join(directory, "ffmpeg")
        if os.path.isfile(filename) and os.access(filename, os.X_OK):
            return filename
    return None

def find_lame():
    # Older standalone LAME binaries can run without replacing OS X libraries.
    # Only use a binary that the user has deliberately placed in one of these paths.
    paths = (
        os.path.expanduser("~/Library/Application Support/GEStudios/bin/lame"),
        os.path.expanduser("~/Downloads/lame"),
        os.path.expanduser("~/Downloads/lame-3.99"),
        os.path.expanduser("~/Downloads/lame-3.99.5-macosx-20120229/lame"),
        os.path.expanduser("~/Downloads/lame-3.100-macosx-20230418/lame"),
        "/usr/local/bin/lame",
        "/opt/local/bin/lame",
    )
    for path in paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        path = os.path.join(directory, "lame")
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    return None

def safe_name(raw):
    name = as_text(unquote(raw or ""))
    name = name.replace("\\", "_").replace("/", "_")
    name = re.sub(u"[\x00-\x1f\x7f]", "_", name).strip(" .")
    if not name or name in (".", ".."):
        return None
    return name[:180]


def ge_timestamped_title(original_name, kind="draft", timestamp=None):
    """Human-readable filenames for narrow Google Drive mobile lists."""
    local = time.localtime(timestamp)
    day = time.strftime("%Y-%m-%d", local)
    stem, extension = os.path.splitext(as_text(original_name))
    stem = stem.strip(" .-_")
    # Strip old date, generated clock and random-ID prefixes.
    stem = re.sub(r"^(?:\\d{4}[-_. ]?\\d{2}[-_. ]?\\d{2})(?:[-_ ]?\\d{6})?\\s*[-_ .]*", "", stem).strip(" .-_")
    stem = re.sub(r"^\\d{6}[-_]\\d{6}[-_][0-9a-f]{6,}[-_]*", "", stem, flags=re.I).strip(" .-_")
    stem = re.sub(r"^\\d{6}[-_][0-9a-f]{6,}[-_]*", "", stem, flags=re.I).strip(" .-_")
    stem = re.sub(r"\\s*[-_ ]+\\d{2}[-_]\\d{2}[-_]\\d{2}$", "", stem).strip(" .-_")
    if not stem:
        stem = "Untitled"
    if kind == "draft":
        return day + "-" + stem + extension
    if kind == "final":
        if re.match(r"^Grand Element\\s*[-–]\\s*", stem, re.I):
            return stem + extension
        return "Grand Element - " + stem + extension
    return stem + extension

def ge_unique_drive_upload_name(folder, proposed):
    # Avoid overwriting a different take uploaded in the same second.
    stem, extension = os.path.splitext(proposed)
    directory = REMOTE + "/" + folder
    try:
        check = subprocess.Popen(
            [RCLONE, "--config", CONFIG, "lsjson", "--files-only", directory],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out, _err = check.communicate()
        if check.returncode:
            message = as_text(_err).lower()
            if ("directory not found" in message or "folder not found" in message
                    or "directory does not exist" in message):
                return proposed  # The folder does not exist yet.
            raise RuntimeError("Google Drive could not verify the destination filename.")
        taken = set(as_text(item.get("Name", "")) for item in json.loads(as_text(out))
                    if not item.get("IsDir"))
        if proposed not in taken:
            return proposed
        for version in range(2, 1000):
            alternative = stem + " - V" + str(version) + extension
            if alternative not in taken:
                return alternative
        raise RuntimeError("Too many existing files share this date, title, and time.")
    except RuntimeError:
        raise
    except Exception:
        # Never silently overwrite when we cannot validate the destination.
        raise RuntimeError("Could not check for an existing filename in Google Drive. Upload not started.")

def job_update(key, **changes):
    with GUARD:
        if key in JOBS:
            JOBS[key].update(changes)

def clean_upload_tags(raw):
    """Only explicitly enabled tags; never HTTP-defined command switches."""
    if not isinstance(raw, dict):
        return {}
    clean = {}
    for key in ("title", "artist", "album", "genre", "date", "track",
                "composer", "copyright", "comment", "album_artist"):
        value = as_text(raw.get(key, "") or "").strip()
        value = re.sub(u"[\\x00-\\x1f\\x7f]", " ", value)[:180]
        if value:
            clean[key] = value
    return clean


def process_job(job_id, source, workdir, original_name, kind, convert,
                exact_name=False, tags=None, cover_token=None):
    cover = None
    try:
        ffmpeg = find_ffmpeg()
        lame = find_lame()
        tags = clean_upload_tags(tags)
        cover = None
        if cover_token:
            with GUARD:
                cover = COVERS.pop(cover_token, None)
            if not cover or not os.path.isfile(cover):
                raise RuntimeError("Cover image expired or missing. Upload not started.")
            if not (original_name.lower().endswith(".mp3") or convert):
                raise RuntimeError("Embedded artwork is supported for MP3. Select 320 KBPS MP3.")
        # Never modify an iMac recording. Write tags only to an isolated copy.
        if (tags or cover) and (not convert or original_name.lower().endswith(".mp3")):
            if not ffmpeg:
                raise RuntimeError("Selected embedded tags need FFmpeg for original-format uploads. File unchanged.")
            target = os.path.join(workdir, "tagged" + os.path.splitext(original_name)[1])
            command = [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", source]
            if cover:
                command.extend(["-i", cover, "-map", "0:a:0", "-map", "1:v:0",
                                "-c:a", "copy", "-c:v", "mjpeg", "-disposition:v",
                                "attached_pic", "-id3v2_version", "3"])
            else:
                command.extend(["-map", "0", "-c", "copy"])
            for key in sorted(tags):
                command.extend(["-metadata", key + "=" + tags[key]])
            command.append(target)
            job_update(job_id, phase="converting", detail="Writing metadata to a copy", percent=0)
            p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            output = p.communicate()[0]
            if p.returncode != 0 or not os.path.isfile(target) or os.path.getsize(target) == 0:
                raise RuntimeError("Metadata copy failed: " + as_text(output or b"")[-320:])
            source = target
        if convert and not original_name.lower().endswith(".mp3"):
            target = os.path.join(workdir, "converted.mp3")
            job_update(job_id, phase="converting", percent=0, detail="Converting to 320 kbps MP3")
            if ffmpeg:
                command = [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", source]
                if cover:
                    command.extend(["-i", cover])
                command.extend(["-map", "0:a:0", "-codec:a", "libmp3lame", "-b:a", "320k",
                                "-id3v2_version", "3"])
                if cover:
                    command.extend(["-map", "1:v:0", "-c:v", "mjpeg",
                                    "-disposition:v", "attached_pic"])
                else:
                    command.append("-vn")
                for key in sorted(tags):
                    command.extend(["-metadata", key + "=" + tags[key]])
                command.append(target)
            elif lame and original_name.lower().endswith((".wav", ".aiff", ".aif")):
                if cover:
                    raise RuntimeError("Cover artwork requires FFmpeg, not LAME.")
                if any(key in tags for key in ("composer", "copyright", "album_artist")):
                    raise RuntimeError("Composer, copyright and album artist tags require FFmpeg.")
                command = [lame, "--quiet", "-h", "-b", "320"]
                lame_tags = {"title":"--tt","artist":"--ta","album":"--tl",
                             "genre":"--tg","date":"--ty","track":"--tn","comment":"--tc"}
                for key in sorted(tags):
                    value = tags[key][:4] if key == "date" else tags[key]
                    if key in lame_tags:
                        command.extend([lame_tags[key], value])
                command.extend([source, target])
            else:
                raise RuntimeError("MP3 conversion needs LAME for WAV/AIFF or FFmpeg for other formats.")
            p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            output = p.communicate()[0]
            if p.returncode != 0 or not os.path.isfile(target) or os.path.getsize(target) == 0:
                raise RuntimeError("MP3 conversion failed: " + as_text(output or b"").strip()[-350:])
            source = target
            upload_name = os.path.splitext(original_name)[0] + ".mp3"
        else:
            upload_name = original_name
        actual_size = os.path.getsize(source)
        job_update(job_id, file_size_bytes=actual_size,
                   mp3_mode="320" if convert else "original")
        folder = {"final": "Finals", "draft": "Drafts", "session": "Sessions", "radio":"Radio"}[kind]
        if kind == "radio":
            mk = subprocess.Popen([RCLONE, "--config", CONFIG, "mkdir", REMOTE + "/Radio"],
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            _out, _err = mk.communicate()
            if mk.returncode:
                raise RuntimeError("Cannot prepare Google Drive Radio folder.")
        proposed = upload_name if exact_name else ge_timestamped_title(upload_name, kind)
        cloud_name = ge_unique_drive_upload_name(folder, proposed)
        destination = REMOTE + "/" + folder + "/" + cloud_name
        job_update(job_id, phase="uploading", detail="Sending to Google Drive", percent=0)
        command = [RCLONE, "--config", CONFIG, "copyto", source, destination,
                   "--stats", "2s", "--stats-one-line", "-P"]
        p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=0)
        logs = []
        pending = ""
        # rclone -P uses carriage returns to redraw its progress line.
        # readline() waits for a newline and leaves the DJ Booth at 0%.
        # os.read() handles both carriage-return updates and ordinary lines.
        while True:
            raw = os.read(p.stdout.fileno(), 4096)
            if not raw:
                break
            pending += as_text(raw).replace("\r", "\n")
            pieces = pending.split("\n")
            pending = pieces.pop()
            for line in pieces:
                if not line.strip():
                    continue
                logs.append(line + "\n")
                if len(logs) > 30:
                    logs.pop(0)
                match = re.search(r"([0-9]{1,3})\s*%", line)
                if match:
                    job_update(job_id, percent=min(99, int(match.group(1))))
            if len(pending) > 4096:
                logs.append(pending[-1500:])
                pending = ""
        if pending.strip():
            logs.append(pending)
            match = re.search(r"([0-9]{1,3})\s*%", pending)
            if match:
                job_update(job_id, percent=min(99, int(match.group(1))))
        code = p.wait()
        if code:
            raise RuntimeError("Google Drive upload failed: " + "".join(logs)[-550:])
        job_update(job_id, phase="complete", percent=100,
                   detail="Uploaded " + cloud_name + " to GE Studios/" + folder,
                   name=cloud_name)
    except Exception as ex:
        job_update(job_id, phase="error", detail=as_text(str(ex))[:850])
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
        try:
            if cover:
                os.remove(cover)
                os.rmdir(os.path.dirname(cover))
        except Exception:
            pass


def mp3_conversion_self_test():
    """Convert a generated short WAV; never touches music or Google Drive."""
    ffmpeg = find_ffmpeg()
    lame = find_lame()
    if not ffmpeg and not lame:
        return {"ok": True, "passed": False, "reason": "FFmpeg and LAME were not detected."}
    temp = tempfile.mkdtemp(prefix="ge-mp3-selftest-")
    try:
        source = os.path.join(temp, "source.wav")
        target = os.path.join(temp, "converted.mp3")
        # Python 2.7-compatible mono PCM test. Small input and no user file access.
        # Explicit close works with both Python 2.7 and modern Python.
        audio = wave.open(source, "wb")
        try:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(44100)
            audio.writeframes(b"".join(
                struct.pack("<h", int(6000 * math.sin(2 * math.pi * 440 * i / 44100.0)))
                for i in range(15435)))
        finally:
            audio.close()
        if ffmpeg:
            command = [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error",
                       "-y", "-i", source, "-vn", "-map", "0:a:0", "-codec:a",
                       "libmp3lame", "-b:a", "320k", "-id3v2_version", "3", target]
            encoder = "FFmpeg / libmp3lame"
        else:
            command = [lame, "--quiet", "-h", "-b", "320", source, target]
            encoder = "LAME"
        p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        output = p.communicate()[0]
        if p.returncode or not os.path.isfile(target) or os.path.getsize(target) < 1200:
            return {"ok": True, "passed": False,
                    "reason": "Encoder failed to generate an MP3. " + as_text(output or b"").strip()[-160:]}
        with open(target, "rb") as encoded:
            header = bytearray(encoded.read(8192))
        # The test requests 320 kbps MPEG-1 Layer III; verify the frame rate,
        # not just the output filename or encoder process exit code.
        has_frame = any(
            header[i] == 255 and (header[i + 1] & 224) == 224 and
            (header[i + 1] & 6) == 2 and
            (header[i + 1] & 24) == 24 and
            ((header[i + 2] >> 4) & 15) == 14
            for i in range(len(header) - 2))
        if not has_frame:
            return {"ok": True, "passed": False,
                    "reason": "Encoder returned no recognizable 320 kbps MPEG-1 Layer III frames."}
        return {"ok": True, "passed": True, "encoder": encoder,
                "output_bytes": os.path.getsize(target)}
    except Exception as ex:
        return {"ok": True, "passed": False,
                "reason": "Local encoder test failed: " + as_text(str(ex))[:180]}
    finally:
        shutil.rmtree(temp, ignore_errors=True)

def inspect_drive_quota():
    # Read-only server-side remote test for the GE Studio Status panel.
    # Never return OAuth configuration, account IDs or raw error logs to Firefox.
    status = {"ok": True, "drive_checked": True, "drive_accessible": False}
    if not os.path.isfile(RCLONE) or not os.path.isfile(CONFIG):
        status["reason"] = "Local rclone or its Google Drive configuration is missing."
        return status
    try:
        process = subprocess.Popen([RCLONE, "--config", CONFIG, "about", "GEStudios:"],
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        received = {}
        def drain():
            stdout, stderr = process.communicate()
            received["stdout"] = stdout
            received["stderr"] = stderr
        thread = threading.Thread(target=drain)
        thread.daemon = True
        thread.start()
        thread.join(10)
        if thread.is_alive():
            try:
                process.terminate()
            except Exception:
                pass
            status["reason"] = "Google Drive did not respond within 10 seconds."
            return status
        if process.returncode != 0:
            status["reason"] = "Google Drive rejected or failed the remote check. Authorization, connection or quota may need attention."
            return status
        output = as_text(received.get("stdout", ""))
        for key in ("Total", "Used", "Free", "Trashed"):
            match = re.search(r"(?mi)^" + key + r":\s*([0-9]+(?:\.[0-9]+)?\s*[KMGTPE]?i?B?)\s*$", output)
            if match:
                status[key.lower()] = match.group(1).strip()
        status["drive_accessible"] = True
        return status
    except Exception:
        status["reason"] = "Could not complete the Google Drive remote check."
        return status


def reconnect_set(phase, detail):
    with GUARD:
        DRIVE_RECONNECT["phase"] = phase
        DRIVE_RECONNECT["detail"] = detail

def reconnect_google_worker():
    # Output may contain private OAuth data. Never return it to the webpage.
    try:
        command = [RCLONE, "--config", CONFIG, "--auto-confirm",
                   "config", "reconnect", "GEStudios:"]
        process = subprocess.Popen(command, stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        def drain():
            process.communicate()
        watcher = threading.Thread(target=drain)
        watcher.daemon = True
        watcher.start()
        watcher.join(300)
        if watcher.is_alive():
            try:
                process.terminate()
            except Exception:
                pass
            reconnect_set("error", "Google sign-in timed out. Existing music is unchanged.")
            return
        if process.returncode:
            reconnect_set("error", "Google sign-in did not finish. Check the iMac browser.")
            return
        if not inspect_drive_quota().get("drive_accessible"):
            reconnect_set("error", "Google sign-in finished but Drive verification failed.")
            return
        reconnect_set("complete", "GOOGLE DRIVE CONNECTED. You can retry your upload.")
    except Exception:
        reconnect_set("error", "Google sign-in could not start. Existing music is unchanged.")

def reconnect_google_start(handler):
    if not os.path.isfile(RCLONE) or not os.path.isfile(CONFIG):
        return handler.response(503, {"ok": False, "error": "rclone or GEStudios config missing."})
    with GUARD:
        if DRIVE_RECONNECT["phase"] == "running":
            return handler.response(409, {"ok": False, "error": "Google sign-in is already running."})
        if any(x.get("phase") not in ("complete", "error") for x in JOBS.values()):
            return handler.response(409, {"ok": False, "error": "Finish the current upload first."})
        DRIVE_RECONNECT.update({"phase": "running",
                                "detail": "Google sign-in is opening in the iMac browser.",
                                "started_at": int(time.time())})
    thread = threading.Thread(target=reconnect_google_worker)
    thread.daemon = True
    thread.start()
    return handler.response(202, {"ok": True, "detail": "Complete sign-in in your iMac browser."})

class ThreadingServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def _valid_file_segment(value):
    if not isinstance(value, (type(u""), type(""))):
        return False
    return bool(value and len(value) <= 180 and value not in (".", "..") and
                not any(c in value for c in ("/", "\\", "\r", "\n", "\x00")))


def _folder_for_kind(kind):
    return {"draft": "Drafts", "final": "Finals", "session": "Sessions", "radio": "Radio"}.get(kind)


def _drive_names(folder):
    command = [RCLONE, "--config", CONFIG, "lsjson", "--files-only", REMOTE + "/" + folder]
    p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = p.communicate()
    if p.returncode:
        raise RuntimeError("Cannot verify Google Drive file list. Operation cancelled.")
    return set(as_text(item.get("Name", "")) for item in json.loads(as_text(out))
               if not item.get("IsDir", False))


class Handler(BaseHTTPRequestHandler):
    server_version = "GEUpload/1.0"

    def log_message(self, fmt, *args):
        pass  # No music names or credentials in local request logs.

    def authorized_origin(self):
        return self.headers.get("Origin", "") in ORIGINS

    def valid_host(self):
        return self.headers.get("Host", "") in (
            "127.0.0.1:%d" % PORT, "localhost:%d" % PORT
        )

    def response(self, code, obj):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        origin = self.headers.get("Origin", "")
        if origin in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-GE-Local")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        if not self.valid_host() or not self.authorized_origin():
            return self.response(403, {"ok": False, "error": "Unapproved origin"})
        self.response(200, {"ok": True})

    def do_GET(self):
        if not self.valid_host() or not self.authorized_origin():
            return self.response(403, {"ok": False, "error": "Unapproved origin"})
        target = urlparse(self.path)
        if target.path == "/check":
            return self.response(200, inspect_drive_quota())
        if target.path == "/drive/reconnect/status":
            with GUARD:
                state = dict(DRIVE_RECONNECT)
            return self.response(200, {"ok": True, "state": state})
        if target.path == "/health":
            return self.response(200, {"ok": True, "rclone_ready": os.path.isfile(RCLONE) and os.path.isfile(CONFIG),
                                       "mp3_available": bool(find_ffmpeg() or find_lame()),
                                       "mp3_converter": "FFmpeg" if find_ffmpeg() else ("LAME (WAV/AIFF)" if find_lame() else "not installed"),
                                       "backend": "Google Drive via local rclone",
                                       "helper_version": 10, "drive_reconnect_available": True,
                                        "rename_available": True, "copy_to_folder": True, "radio_folder": True,
                                        "cover_art_available": True,
                                        "filename_options_v2": True, "metadata_tags": True,
                                        "delete_available": True,
                                       "session_uploads": True, "all_app_files_available": True,
                                       "all_app_files_scope": "drive.file (app-created files only)",
                                       "trash_empty_requires_full_drive_scope": True,
                                       "auto_start_configured": os.path.isfile(os.path.expanduser("~/Library/LaunchAgents/com.grandelement.geuploads.plist")),
                                       "auto_repair_available": False,
                                       "drive_folders": ["Drafts", "Finals", "Radio", "Sessions"]})
        if target.path == "/mp3-test":
            return self.response(200, mp3_conversion_self_test())
        if target.path == "/status":
            job_id = parse_qs(target.query).get("id", [""])[0]
            with GUARD:
                job = dict(JOBS.get(job_id, {}))
            return self.response(200 if job else 404, {"ok": bool(job), "job": job})
        if target.path == "/files":
            if not os.path.isfile(RCLONE) or not os.path.isfile(CONFIG):
                return self.response(503, {"ok": False, "error": "rclone configuration missing"})
            kind = parse_qs(target.query).get("kind", [""])[0]
            if kind not in ("draft", "final", "session", "radio", "all"):
                return self.response(400, {"ok": False, "error": "Invalid folder"})
            if kind == "all":
                # With this user's deliberately restricted drive.file OAuth
                # authorization, this lists only app-created/app-opened files.
                # It never impersonates a full My Drive listing.
                folder = "all app-accessible Google Drive files"
                command = [RCLONE, "--config", CONFIG, "lsjson", "-R",
                           "--files-only", "GEStudios:"]
            else:
                folder = {"final": "Finals", "draft": "Drafts", "session": "Sessions", "radio":"Radio"}[kind]
                command = [RCLONE, "--config", CONFIG, "lsjson", "--files-only",
                           REMOTE + "/" + folder]
            try:
                p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                out, err = p.communicate()
                if p.returncode:
                    message = as_text(err).lower()
                    if ("directory not found" in message or "folder not found" in message
                            or "directory does not exist" in message):
                        return self.response(200, {"ok": True, "files": [], "has_more": False,
                                                   "folder_created": False})
                    return self.response(502, {"ok": False, "error":
                        "Google Drive could not list " + folder + ". Verify Drive authorization in STATUS."})
                items = json.loads(as_text(out))
                files = [{"name": i.get("Name", ""), "path": i.get("Path", i.get("Name", "")),
                          "bytes": i.get("Size", 0), "id": i.get("ID", ""),
                          "modified": i.get("ModTime", "")} for i in items if not i.get("IsDir")]
                files.sort(key=lambda f: f.get("modified", ""), reverse=True)
                return self.response(200, {"ok": True, "files": files[:1500],
                                           "has_more": len(files) > 1500,
                                           "scope": "app_created_files_only" if kind == "all" else "ge_studios_folder"})
            except Exception as ex:
                return self.response(500, {"ok": False, "error": as_text(str(ex))[:200]})
        self.response(404, {"ok": False, "error": "Not found"})

    def upload_cover(self):
        try:
            count = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            count = 0
        if count < 100 or count > 8*1024*1024:
            return self.response(413, {"ok": False, "error": "Cover artwork must be a JPEG or PNG under 8 MB"})
        ext = ".jpg" if self.headers.get("Content-Type", "") == "image/jpeg" else ".png" if self.headers.get("Content-Type", "") == "image/png" else ""
        if not ext:
            return self.response(400, {"ok": False, "error": "Choose JPEG or PNG artwork"})
        try:
            data = self.rfile.read(count)
            magic_ok = data.startswith(b"\xff\xd8\xff") if ext == ".jpg" else data.startswith(b"\x89PNG\r\n\x1a\n")
            if not magic_ok:
                return self.response(400, {"ok": False, "error": "Not a valid JPEG or PNG"})
            directory = tempfile.mkdtemp(prefix="ge-cover-", dir=os.path.expanduser("~/Library/Caches"))
            token = uuid.uuid4().hex
            filename = os.path.join(directory, "cover" + ext)
            with open(filename, "wb") as out:
                out.write(data)
            with GUARD:
                COVERS[token] = filename
            return self.response(201, {"ok": True, "cover_token": token})
        except Exception:
            return self.response(500, {"ok": False, "error": "Could not stage cover artwork"})

    def file_operation(self, action):
        # Authenticated local origin & X-GE-Local header are checked in do_POST.
        try:
            count = int(self.headers.get("Content-Length", "0") or "0")
            if count < 2 or count > 2048:
                return self.response(400, {"ok": False, "error": "Invalid operation"})
            body = json.loads(as_text(self.rfile.read(count)))
            if not isinstance(body, dict):
                return self.response(400, {"ok": False, "error": "Invalid operation"})
            source_kind = body.get("kind", "")
            target_kind = source_kind if action == "rename" else body.get("target_kind", "")
            folder = _folder_for_kind(source_kind)
            target_folder = _folder_for_kind(target_kind)
            name, target_name = body.get("name"), body.get("new_name", body.get("name"))
            if not folder or not target_folder or not _valid_file_segment(name) or not _valid_file_segment(target_name):
                return self.response(400, {"ok": False, "error": "Invalid folder or filename"})
            if source_kind == target_kind and name == target_name:
                return self.response(400, {"ok": False, "error": "Source and destination are identical"})
            with GUARD:
                if any(v.get("phase") not in ("complete", "error") for v in JOBS.values()):
                    return self.response(409, {"ok": False, "error": "Finish the upload first"})
            if target_folder == "Radio":
                mk = subprocess.Popen([RCLONE, "--config", CONFIG, "mkdir", REMOTE + "/Radio"],
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                _out, _err = mk.communicate()
                if mk.returncode:
                    raise RuntimeError("Radio folder could not be created.")
            names = _drive_names(folder)
            if name not in names:
                return self.response(404, {"ok": False, "error": "Source not found. Refresh files."})
            if target_name in _drive_names(target_folder):
                return self.response(409, {"ok": False, "error": "Destination filename already exists. No overwrite."})
            verb = "moveto" if action == "rename" else "copyto"
            args = [RCLONE, "--config", CONFIG, verb,
                    REMOTE + "/" + folder + "/" + name,
                    REMOTE + "/" + target_folder + "/" + target_name]
            task = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            out, err = task.communicate()
            if task.returncode:
                raise RuntimeError("Google Drive " + action + " failed. No further changes made.")
            return self.response(200, {"ok": True, "action": action, "name": target_name,
                                        "folder": target_folder, "source_name": name})
        except Exception as e:
            return self.response(502, {"ok": False, "error": as_text(str(e))[:300]})

    def delete_file(self):
        # Only an explicit browser-confirmed delete of an existing file inside
        # GE Studios/Drafts or GE Studios/Finals is permitted.
        try:
            length = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            length = 0
        if length < 2 or length > 2000:
            return self.response(400, {"ok": False, "error": "Invalid deletion request"})
        try:
            body = json.loads(as_text(self.rfile.read(length)))
        except Exception:
            return self.response(400, {"ok": False, "error": "Invalid JSON"})
        if not isinstance(body, dict):
            return self.response(400, {"ok": False, "error": "Invalid request"})
        kind = body.get("kind")
        name = body.get("name")
        if kind not in ("draft", "final", "session", "radio") or not isinstance(name, (type(u""), type(""))):
            return self.response(400, {"ok": False, "error": "Invalid filename or folder"})
        if not name or len(name) > 180 or name in (".", "..") or any(c in name for c in ("/", "\\", "\r", "\n", "\x00")):
            return self.response(400, {"ok": False, "error": "Unsafe filename"})
        with GUARD:
            if any(x.get("phase") not in ("complete", "error") for x in JOBS.values()):
                return self.response(409, {"ok": False, "error": "Wait for the current upload to finish before deleting"})
        folder = {"final": "Finals", "draft": "Drafts", "session": "Sessions", "radio":"Radio"}[kind]
        folder_path = REMOTE + "/" + folder
        try:
            # Require an exact file from a fresh, server-side directory listing.
            listing = subprocess.Popen([RCLONE, "--config", CONFIG, "lsjson", "--files-only", folder_path],
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            out, err = listing.communicate()
            if listing.returncode != 0:
                raise RuntimeError("Cannot verify file in Google Drive: " + as_text(err)[-250:])
            items = json.loads(as_text(out))
            if not any(x.get("Name") == name and not x.get("IsDir", False) for x in items):
                return self.response(404, {"ok": False, "error": "File not found in GE Studios/" + folder + ". Refresh the list."})
            # Drive default is trash; explicitly protect against any config that
            # would permanently delete instead.
            command = [RCLONE, "--config", CONFIG, "--drive-use-trash=true",
                       "deletefile", folder_path + "/" + name]
            task = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            _out, err = task.communicate()
            if task.returncode != 0:
                raise RuntimeError("Could not move the file to Google Drive Trash: " + as_text(err)[-350:])
            return self.response(200, {"ok": True, "name": name, "folder": folder, "trashed": True})
        except Exception as ex:
            return self.response(502, {"ok": False, "error": as_text(str(ex))[:600]})

    def do_POST(self):
        if not self.valid_host() or not self.authorized_origin() or self.headers.get("X-GE-Local", "") != "1":
            return self.response(403, {"ok": False, "error": "Unapproved upload"})
        parsed = urlparse(self.path)
        if parsed.path == "/delete":
            return self.delete_file()
        if parsed.path == "/cover":
            return self.upload_cover()
        if parsed.path == "/rename":
            return self.file_operation("rename")
        if parsed.path == "/copy-to":
            return self.file_operation("copy")
        if parsed.path == "/drive/reconnect":
            # No HTTP-provided shell arguments or credentials are accepted.
            return reconnect_google_start(self)
        if parsed.path != "/upload":
            return self.response(404, {"ok": False, "error": "Not found"})
        if not os.path.isfile(RCLONE) or not os.path.isfile(CONFIG):
            return self.response(503, {"ok": False, "error": "rclone or Google Drive config missing on iMac"})
        params = parse_qs(parsed.query)
        kind = params.get("kind", [""])[0]
        name = safe_name(params.get("name", [""])[0])
        convert = params.get("convert", ["0"])[0] == "1"
        cover_token = params.get("cover", [""])[0]
        if cover_token and not re.match(r"^[a-f0-9]{32}$", cover_token):
            return self.response(400, {"ok": False, "error": "Invalid cover image token"})
        exact_name = params.get("format", [""])[0] == "2"
        tags = {}
        if exact_name:
            raw = params.get("metadata", ["{}"])[0]
            if len(raw) > 4096:
                return self.response(400, {"ok": False, "error": "Metadata too long"})
            try:
                tags = clean_upload_tags(json.loads(as_text(raw)))
            except (ValueError, TypeError):
                return self.response(400, {"ok": False, "error": "Invalid metadata"})
        if kind not in ("draft", "final", "session", "radio") or not name:
            return self.response(400, {"ok": False, "error": "Choose a valid file for Drafts, Finals or Sessions"})
        if kind != "session" and not re.search(r"\.(mp3|mp4|wav|aif|aiff|m4a|aac|flac|ogg|oga)$", name, re.I):
            return self.response(400, {"ok": False, "error": "Drafts and Finals accept music files; use Sessions for a ZIP or complete project archive"})
        if kind == "session" and convert:
            return self.response(400, {"ok": False, "error": "Whole session archives must remain unchanged. MP3 conversion applies to individual audio files only."})
        if convert and not name.lower().endswith(".mp3"):
            if not find_ffmpeg() and not (find_lame() and name.lower().endswith((".wav", ".aif", ".aiff"))):
                return self.response(400, {"ok": False, "error": "MP3 conversion requires a compatible encoder: LAME for WAV/AIFF or FFmpeg for other formats. Uncheck conversion to upload unchanged."})
        try:
            count = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            count = 0
        if count < 1 or count > LIMIT:
            return self.response(413, {"ok": False, "error": "File must be between 1 byte and 4 GB"})
        with GUARD:
            running = any(x.get("phase") not in ("complete", "error") for x in JOBS.values())
        if running:
            return self.response(409, {"ok": False, "error": "An upload is still running"})
        root = os.path.expanduser("~/Library/Caches/GEStudios")
        if not os.path.isdir(root):
            os.makedirs(root)
        workdir = tempfile.mkdtemp(prefix="upload-", dir=root)
        local = os.path.join(workdir, "original" + os.path.splitext(name)[1])
        try:
            with open(local, "wb") as dest:
                left = count
                while left:
                    data = self.rfile.read(min(CHUNK, left))
                    if not data:
                        raise IOError("Upload connection closed early")
                    dest.write(data)
                    left -= len(data)
        except Exception as ex:
            shutil.rmtree(workdir, ignore_errors=True)
            return self.response(400, {"ok": False, "error": "Could not receive file: " + as_text(str(ex))})
        job_id = uuid.uuid4().hex
        job = {"phase": "queued", "percent": 0, "detail": "Preparing upload", "name": name, "kind": kind}
        with GUARD:
            JOBS[job_id] = job
        thread = threading.Thread(target=process_job, args=(job_id, local, workdir, name, kind, convert, exact_name, tags, cover_token))
        thread.daemon = True
        thread.start()
        self.response(202, {"ok": True, "id": job_id})

if __name__ == "__main__":
    if not os.path.isfile(RCLONE):
        print("Rclone not found at: " + RCLONE)
        sys.exit(1)
    if not os.path.isfile(CONFIG):
        print("Google Drive config not found at: " + CONFIG)
        sys.exit(1)
    server = ThreadingServer((HOST, PORT), Handler)
    print("GE STUDIOS UPLOAD HELPER READY on http://127.0.0.1:%d" % PORT)
    print("Open the GE DJ Booth in Firefox. Leave this Terminal window open.")
    print("Google Drive destination: GE Studios/Drafts or GE Studios/Finals.")
    if not find_ffmpeg() and not find_lame():
        print("MP3 conversion unavailable until FFmpeg or LAME is installed; original uploads work now.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nGE upload helper stopped.")
