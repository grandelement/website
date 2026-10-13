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
if [ ! -f "$RCLONE" ]; then
  echo "STOP: Cannot find rclone at $RCLONE"
  exit 1
fi
if [ ! -f "$CONF" ]; then
  echo "STOP: Cannot find the Google Drive authorization in $CONF"
  exit 1
fi
mkdir -p "$BASE" "$AGENTS"
echo "Downloading GE upload helper..."
curl --fail --location --silent --show-error "$URL" --output "$HELPER"
if [ ! -s "$HELPER" ]; then
  echo "STOP: The helper did not download."
  exit 1
fi
# Check syntax before registering with launchd.
if ! /usr/bin/python -m py_compile "$HELPER"; then
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
    "KeepAlive": False,
    "StandardOutPath": "/tmp/ge-studios-uploads.log",
    "StandardErrorPath": "/tmp/ge-studios-uploads-error.log",
}, filename)
PY
chmod 600 "$HELPER" "$PLIST"
launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load -w "$PLIST"
echo ""
echo "GE STUDIOS UPLOAD HELPER INSTALLED."
echo "Starts automatically when you log in to this iMac."
echo "Open https://grandelement.com/dj/imac.html in Firefox."
echo "Use UPLOAD DRAFT or UPLOAD FINAL; conversion is optional."
echo "If there is a problem, see /tmp/ge-studios-uploads-error.log"
