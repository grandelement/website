#!/bin/sh
# GE Studios - one-time, user-approved self-healing iMac helper registration.
# OS X El Capitan 10.11.6 (system Python 2.7 and launchd).
# Does not change Ableton, Saffire, Soundflower, BLITZ or BANGERS.
set -eu
BASE="$HOME/Library/Application Support/GEStudios"
AGENTS="$HOME/Library/LaunchAgents"
DEST="$BASE/ge-upload-helper.py"
PLIST="$AGENTS/com.grandelement.geuploads.plist"
RCLONE="$HOME/Downloads/rclone-v1.52.0-osx-amd64/rclone"
CONF="$HOME/.config/rclone/rclone.conf"
echo "GE STUDIOS · DRIVE RECOVERY"
echo "Checking the original iMac Google Drive setup..."
if [ ! -f "$RCLONE" ] || [ ! -f "$CONF" ]; then
 echo "STOP: The existing Google Drive rclone executable or its authorization is missing."
 echo "Nothing was changed. Return to GE Studio > STATUS for help."
 exit 1
fi
SRC=""
for candidate in "$HOME/Downloads/ge-upload-helper-v7.py" "$HOME/Downloads/ge-upload-helper-v3.py" "$HOME/Downloads/ge-upload-helper.py" "$HOME/Downloads/ge-upload-helper-v2.py"; do
 if [ -f "$candidate" ] && grep -q 'session_uploads' "$candidate" && grep -q 'HOST = "127.0.0.1"' "$candidate"; then
  SRC="$candidate"
  break
 fi
done
if [ -z "$SRC" ]; then
 echo "STOP: Download the latest GE Upload Helper from the GE DJ Booth before running this repair."
 echo "Your existing songs and Google Drive configuration have not been touched."
 exit 1
fi
if ! /usr/bin/python -m py_compile "$SRC"; then
 echo "STOP: Helper failed the Python check; nothing installed."
 exit 1
fi
# Never interrupt a live transfer from another GE Upload Helper process.
PID="$(/usr/sbin/lsof -n -t -iTCP:8765 -sTCP:LISTEN 2>/dev/null | head -1 || true)"
if [ -n "$PID" ]; then
 echo "A local helper is already running (process $PID)."
 echo "For safety, this setup will NOT terminate it during a possible upload."
 echo "Close that helper with Control+C in its Terminal window, then run this setup once more."
 exit 1
fi
mkdir -p "$BASE" "$AGENTS"
cp "$SRC" "$DEST"
/bin/chmod 600 "$DEST"
# The helper reopens after login or an unexpected exit, without an open Terminal.
/usr/bin/python - "$DEST" "$PLIST" <<'PY'
import plistlib,sys
target,path=sys.argv[1:3]
plistlib.writePlist({
 "Label":"com.grandelement.geuploads",
 "ProgramArguments":["/usr/bin/python","-u",target],
 "RunAtLoad":True,
 "KeepAlive":True,
 "ThrottleInterval":10,
 "StandardOutPath":"/tmp/ge-studios-uploads.log",
 "StandardErrorPath":"/tmp/ge-studios-uploads-error.log"
},path)
PY
/bin/chmod 600 "$PLIST"
/bin/launchctl unload "$PLIST" >/dev/null 2>&1 || true
/bin/launchctl load -w "$PLIST"
sleep 2
echo "Checking helper..."
if /usr/bin/curl --noproxy "*" --connect-timeout 2 --max-time 5 --silent \
  -H "Origin: https://grandelement.com" "http://127.0.0.1:8765/health" | /usr/bin/grep -q '"ok": true'; then
 echo "SUCCESS: GE STUDIOS HELPER STARTED."
 echo "Automatic startup and restart at login have been configured."
 echo "Return to the GE DJ Booth; it will automatically reconnect."
else
 echo "Installed, but helper is not responding yet."
 echo "Leave the existing files untouched; check /tmp/ge-studios-uploads-error.log."
fi
