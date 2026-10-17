#!/bin/sh
# GE Studio - local browser update for macOS El Capitan; launched by Finder.
# Bundles public helper code only. Never includes passwords or Google tokens.
set -u
BASE="$HOME/Library/Application Support/GEStudios"
TARGET="$BASE/ge-upload-helper.py"
STAGE="$BASE/ge-upload-helper.py.next"
AGENT="$HOME/Library/LaunchAgents/com.grandelement.geuploads.plist"
RCLONE="$HOME/Downloads/rclone-v1.52.0-osx-amd64/rclone"
CONFIG="$HOME/.config/rclone/rclone.conf"
atend() {
 echo ""
 echo "Press Return to close this window."
 read IGNORED || true
}
trap atend EXIT
echo "GE STUDIOS  |  FILE BROWSER UPDATE V4"
echo "------------------------------------"
echo "Preserves all uploaded music, BLITZ and studio audio."
if [ ! -x "$RCLONE" ] || [ ! -f "$CONFIG" ]; then
 echo "Drive configuration missing; nothing changed."
 exit 1
fi
mkdir -p "$BASE" "$HOME/Library/LaunchAgents" || exit 1
cat > "$STAGE" <<'__GE_V4_HELPER_END__'
#!/usr/bin/env python
# GE Studios local Google Drive uploader for OS X 10.11 (Python 2.7).
# Loopback-only service. Never touches Ableton, Saffire, BLITZ or BANGERS.
# The DJ webpage transfers file bytes to this Mac, then rclone uploads to Drive.
from __future__ import print_function
import errno
import json
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
GUARD = threading.Lock()
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

def job_update(key, **changes):
    with GUARD:
        if key in JOBS:
            JOBS[key].update(changes)

def process_job(job_id, source, workdir, original_name, kind, convert):
    try:
        ffmpeg = find_ffmpeg()
        lame = find_lame()
        if convert and not original_name.lower().endswith(".mp3"):
            target = os.path.join(workdir, "converted.mp3")
            job_update(job_id, phase="converting", percent=0, detail="Converting to 320 kbps MP3")
            if ffmpeg:
                # FFmpeg supports WAV, AIFF, MP4, M4A and the other allowed formats.
                command = [ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error",
                           "-y", "-i", source, "-vn", "-map", "0:a:0", "-codec:a",
                           "libmp3lame", "-b:a", "320k", "-id3v2_version", "3", target]
            elif lame and original_name.lower().endswith((".wav", ".aiff", ".aif")):
                # This standalone encoder handles uncompressed WAV and AIFF.
                command = [lame, "--quiet", "-h", "-b", "320", source, target]
            else:
                raise RuntimeError("To convert WAV/AIFF, install a compatible LAME encoder; other formats need FFmpeg. Uncheck Convert to MP3 to upload the original unchanged.")
            p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            output = p.communicate()[0]
            if p.returncode != 0 or not os.path.isfile(target) or os.path.getsize(target)==0:
                raise RuntimeError("MP3 conversion failed: " + as_text(output or b"").strip()[-350:])
            source = target
            upload_name = os.path.splitext(original_name)[0] + ".mp3"
        else:
            upload_name = original_name
        suffix = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
        folder = {"final": "Finals", "draft": "Drafts", "session": "Sessions"}[kind]
        destination = REMOTE + "/" + folder + "/" + suffix + "-" + upload_name
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
                   detail="Uploaded " + upload_name + " to GE Studios/" + folder,
                   name=upload_name)
    except Exception as ex:
        job_update(job_id, phase="error", detail=as_text(str(ex))[:850])
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

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

class ThreadingServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

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
        if target.path == "/health":
            return self.response(200, {"ok": True, "rclone_ready": os.path.isfile(RCLONE) and os.path.isfile(CONFIG),
                                       "mp3_available": bool(find_ffmpeg() or find_lame()),
                                       "mp3_converter": "FFmpeg" if find_ffmpeg() else ("LAME (WAV/AIFF)" if find_lame() else "not installed"),
                                       "backend": "Google Drive via local rclone",
                                       "helper_version": 4, "delete_available": True,
                                       "session_uploads": True, "all_app_files_available": True,
                                       "all_app_files_scope": "drive.file (app-created files only)",
                                       "trash_empty_requires_full_drive_scope": True,
                                       "auto_start_configured": os.path.isfile(os.path.expanduser("~/Library/LaunchAgents/com.grandelement.geuploads.plist")),
                                       "auto_repair_available": False,
                                       "drive_folders": ["Drafts", "Finals", "Sessions"]})
        if target.path == "/status":
            job_id = parse_qs(target.query).get("id", [""])[0]
            with GUARD:
                job = dict(JOBS.get(job_id, {}))
            return self.response(200 if job else 404, {"ok": bool(job), "job": job})
        if target.path == "/files":
            if not os.path.isfile(RCLONE) or not os.path.isfile(CONFIG):
                return self.response(503, {"ok": False, "error": "rclone configuration missing"})
            kind = parse_qs(target.query).get("kind", [""])[0]
            if kind not in ("draft", "final", "session", "all"):
                return self.response(400, {"ok": False, "error": "Invalid folder"})
            if kind == "all":
                # With this user's deliberately restricted drive.file OAuth
                # authorization, this lists only app-created/app-opened files.
                # It never impersonates a full My Drive listing.
                folder = "all app-accessible Google Drive files"
                command = [RCLONE, "--config", CONFIG, "lsjson", "-R",
                           "--files-only", "GEStudios:"]
            else:
                folder = {"final": "Finals", "draft": "Drafts", "session": "Sessions"}[kind]
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
        if kind not in ("draft", "final", "session") or not isinstance(name, (type(u""), type(""))):
            return self.response(400, {"ok": False, "error": "Invalid filename or folder"})
        if not name or len(name) > 180 or name in (".", "..") or any(c in name for c in ("/", "\\", "\r", "\n", "\x00")):
            return self.response(400, {"ok": False, "error": "Unsafe filename"})
        with GUARD:
            if any(x.get("phase") not in ("complete", "error") for x in JOBS.values()):
                return self.response(409, {"ok": False, "error": "Wait for the current upload to finish before deleting"})
        folder = {"final": "Finals", "draft": "Drafts", "session": "Sessions"}[kind]
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
        if parsed.path != "/upload":
            return self.response(404, {"ok": False, "error": "Not found"})
        if not os.path.isfile(RCLONE) or not os.path.isfile(CONFIG):
            return self.response(503, {"ok": False, "error": "rclone or Google Drive config missing on iMac"})
        params = parse_qs(parsed.query)
        kind = params.get("kind", [""])[0]
        name = safe_name(params.get("name", [""])[0])
        convert = params.get("convert", ["0"])[0] == "1"
        if kind not in ("draft", "final", "session") or not name:
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
        thread = threading.Thread(target=process_job, args=(job_id, local, workdir, name, kind, convert))
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

__GE_V4_HELPER_END__
if ! /usr/bin/python -m py_compile "$STAGE"; then
 echo "Python check failed. Existing uploader was not changed."
 rm -f "$STAGE"
 exit 1
fi
/bin/mv -f "$STAGE" "$TARGET" || exit 1
/bin/chmod 600 "$TARGET"
if ! /usr/bin/python - "$TARGET" "$AGENT" <<'PY_SETUP'
import plistlib,sys
program,plist=sys.argv[1:3]
plistlib.writePlist({
 "Label":"com.grandelement.geuploads",
 "ProgramArguments":["/usr/bin/python","-u",program],
 "RunAtLoad":True,"KeepAlive":True,"ThrottleInterval":10,
 "StandardOutPath":"/tmp/ge-studios-uploads.log",
 "StandardErrorPath":"/tmp/ge-studios-uploads-error.log"
},plist)
PY_SETUP
then
 echo "Startup registration failed; existing uploader is still running if it was open."
 exit 1
fi
/bin/chmod 600 "$AGENT"
PID=""
if [ -x /usr/sbin/lsof ]; then
 PID="$(/usr/sbin/lsof -nP -t -iTCP:8765 -sTCP:LISTEN 2>/dev/null | head -1 || true)"
fi
if [ -n "$PID" ]; then
 echo ""
 echo "V4 FILE BROWSER INSTALLED."
 echo "Your current upload service is still running safely."
 echo "No transfers or other studio software were interrupted."
 echo "When finished uploading, restart this iMac ONCE."
 echo "The updated helper will start automatically at login."
 echo "Then refresh the GE DJ Booth and select ALL GE FILES."
 exit 0
fi
/bin/launchctl unload "$AGENT" >/dev/null 2>&1 || true
if ! /bin/launchctl load -w "$AGENT"; then
 echo "V4 installed, but auto-launch failed. Restart the iMac when ready."
 exit 0
fi
/usr/bin/python - <<'PY_CHECK'
from __future__ import print_function
import json,time
from urllib2 import Request,urlopen
for attempt in range(8):
 try:
  request=Request("http://127.0.0.1:8765/health",
      headers={"Origin":"https://grandelement.com"})
  data=json.loads(urlopen(request,timeout=3).read())
  if data.get("helper_version",0)>=4:
   print("SUCCESS: HELPER V4 RUNNING.")
   print("ALL GE FILES: ENABLED FOR FILES THE APP CAN SEE.")
   print("FULL ACCOUNT: OPEN COMPLETE GOOGLE DRIVE IN THE BOOTH.")
   print("TRASH: GOOGLE DRIVE WILL ASK FOR PERMANENT DELETE CONFIRMATION.")
   break
 except Exception:
  pass
 time.sleep(1)
else:
 print("V4 installed. Restart the iMac to activate it.")
PY_CHECK
