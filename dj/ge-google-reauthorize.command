#!/bin/bash
# GE Studios · Google Drive authorization renewal for the original iMac.
# Runs locally; never uploads credentials or changes music, Ableton or BLITZ.
set -u
RCLONE="$HOME/Downloads/rclone-v1.52.0-osx-amd64/rclone"
CONF="$HOME/.config/rclone/rclone.conf"
echo "GE STUDIOS · REAUTHORIZE GOOGLE DRIVE"
echo "------------------------------------"
if [ ! -x "$RCLONE" ]; then echo "Rclone is missing at the configured location. No changes made."; read -p "Press Return to close..."; exit 1; fi
if [ ! -f "$CONF" ]; then echo "Google Drive configuration is missing. No changes made."; read -p "Press Return to close..."; exit 1; fi
BACKUP="$CONF.backup-$(date +%Y%m%d-%H%M%S)"
cp -p "$CONF" "$BACKUP" || { echo "Unable to back up config; stopping."; read -p "Press Return..."; exit 1; }
echo "Saved a backup of the existing Drive configuration."
echo "Google may open a sign-in window on this iMac."
echo "If authorization requires another device, follow the rclone prompts using your iPhone."
echo "Do not share or photograph any authorization codes or tokens."
echo
# Answer the known rclone v1.52 reconnect prompts: refresh=yes, auto config=yes, team drive=no.
# Google OAuth consent still requires the owner to approve access in Firefox.
printf 'y\\ny\\nn\\n' | "$RCLONE" config reconnect GEStudios:
STATUS=$?
if [ "$STATUS" -ne 0 ]; then echo; echo "Authorization was not completed. Existing config backup preserved."; read -p "Press Return to close..."; exit "$STATUS"; fi
echo
echo "Checking Drive access..."
"$RCLONE" lsf "GEStudios:GE Studios" --max-depth 1 >/dev/null 2>&1
STATUS=$?
if [ "$STATUS" -eq 0 ]; then
 echo "SUCCESS · GOOGLE DRIVE VERIFIED"
 echo "Return to the iMac DJ Google tab and click RECONNECT DRIVE."
else
 echo "Authorization finished but the remote check failed. Do not upload yet."
 echo "Use the Google diagnostics panel to check Drive."
fi
read -p "Press Return to close..."
exit "$STATUS"
