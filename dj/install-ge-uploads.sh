#!/bin/sh
# One-time setup for the GE Studios iMac DJ Google Drive Upload Helper.
# OS X El Capitan 10.11.6. Requires existing rclone configuration.
# Installs a login-time local-only uploader; no Apple/Google passwords needed.
set -eu
BASE="$HOME/Library/Application Support/GEStudios"
AGENTS="$HOME/Library/LaunchAgents"
HELPER="$BASE/ge-upload-helper.py"
PLIST="$AGENTS/com.grandelement.geuploads.plist"
URL="https://raw.githubusercontent.com/grandelement/website/main/dj/ge-upload-helper.py"
RCLONE="$HOME/Downloads/rclone-v1.52.0-osx-amd64/rclone"
CONF="$HOME/.config/rclone/rclone.conf"
if [ ! -f "$RCLONE" ] || [ ! -f "$CONF" ]; then
  echo "Google Drive is not configured. RADIO GitHub uploads can still work; DRAFTS/FINALS need rclone."
fi
mkdir -p "$BASE" "$AGENTS"
echo "Downloading GE upload helper..."
curl --fail --location --silent --show-error "$URL" --output "$HELPER"
echo "Downloading GitHub Radio publisher..."
curl --fail --location --silent --show-error "https://raw.githubusercontent.com/grandelement/website/main/dj/ge-radio-github.py" --output "$BASE/ge-radio-github.py"
if [ ! -s "$BASE/ge-radio-github.py" ]; then
  echo "STOP: GitHub Radio publisher did not download."
  exit 1
fi
if [ ! -s "$HELPER" ]; then
  echo "STOP: The helper did not download."
  exit 1
fi
# Check syntax before registering with launchd.
if ! /usr/bin/python -m py_compile "$HELPER" "$BASE/ge-radio-github.py"; then
  echo "STOP: Could not check the helper. Nothing was started."
  exit 1
fi
/usr/bin/python - "$HELPER" "$PLIST" <<'PY'
import plistlib
import sys
helper, filename = sys.argv[1:]
plistlib.writePlist({
    "Label": "com.grandelement.geuploads",
    "ProgramArguments": ["/usr/bin/python", helper],
    "RunAtLoad": True,
    "KeepAlive": True,
    "ThrottleInterval": 30,
    "StandardOutPath": "/tmp/ge-studios-uploads.log",
    "StandardErrorPath": "/tmp/ge-studios-uploads-error.log",
}, filename)
PY
chmod 600 "$HELPER" "$BASE/ge-radio-github.py" "$PLIST"
launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load -w "$PLIST"
echo ""
echo "GE STUDIOS UPLOAD HELPER INSTALLED."
echo "Starts at login and automatically restarts if it stops (30-second throttle)."
echo "Open https://grandelement.com/dj/imac.html in Firefox."
echo "Use UPLOAD RADIO for GitHub. DRAFTS and FINALS use Google Drive when configured."
echo "GitHub RADIO connection diagnostic:"
/usr/bin/python "$BASE/ge-radio-github.py" --check || true
echo "To activate RADIO, save a fine-grained GitHub token (Contents read/write for grandelement/website)"
echo "at ~/Library/Application Support/GEStudios/github-radio-token and run chmod 600 on it."
echo "If there is a problem, see /tmp/ge-studios-uploads-error.log"
