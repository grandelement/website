#!/usr/bin/env python
# -*- coding: utf-8 -*-
# GE Studios - one-time server-side rename of our own timestamp-prefixed uploads.
# macOS El Capitan / Python 2.7 and rclone v1.52 compatible.
# DOES NOT download music, delete files, or alter any local project.
from __future__ import print_function
import datetime
import json
import os
import re
import subprocess
import sys
import time

PY3 = sys.version_info[0] >= 3
RCLONE = os.path.expanduser("~/Downloads/rclone-v1.52.0-osx-amd64/rclone")
CONFIG = os.path.expanduser("~/.config/rclone/rclone.conf")
ROOT = "GEStudios:GE Studios"
FOLDERS = ("Drafts", "Finals", "Sessions")
OLD_NAME = re.compile(r"^(\d{8})-(\d{6})-([0-9a-fA-F]{6})-(.+)$")

def text(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return value if isinstance(value, type(u"")) else type(u"")(value)

def output(value):
    line = text(value) + u"\n"
    if PY3:
        sys.stdout.write(line)
    else:
        sys.stdout.write(line.encode("utf-8"))
    sys.stdout.flush()

def command(arguments):
    process = subprocess.Popen(arguments, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = process.communicate()
    return process.returncode, text(out), text(err)

def source_upload_active():
    # Protect active uploads/conversions. The command file itself does not
    # match these processes, so inspection is safe while it remains open.
    code, listing, _error = command(["/bin/ps", "-axo", "command"])
    if code:
        return True  # Cannot establish that it is safe to rename.
    for line in listing.splitlines():
        line = line.strip().lower()
        if "rclone" in line and (re.search(r"\bcopyto\b", line) or re.search(r"\bcopy\b", line)):
            return True
        if ("lame" in line or "ffmpeg" in line) and (
                "converted.mp3" in line or "ge-studios" in line):
            return True
    return False

def list_files(folder):
    remote = ROOT + "/" + folder
    code, out, err = command([RCLONE, "--config", CONFIG, "lsjson", "--files-only", remote])
    if code:
        error = err.lower()
        if ("directory not found" in error or "folder not found" in error
                or "directory does not exist" in error):
            output(u"  " + folder + u": folder not present (skipped).")
            return []
        raise RuntimeError(u"Could not read GE Studios/" + folder +
                           u". No files have been renamed. " + err[-300:])
    items = json.loads(out)
    return [text(item.get("Name", "")) for item in items if not item.get("IsDir")]

def desired_name(filename):
    match = OLD_NAME.match(filename)
    if not match or "/" in filename or "\\" in filename:
        return None
    day, clock, _random_tag, original = match.groups()
    try:
        dt = datetime.datetime.strptime(day + clock, "%Y%m%d%H%M%S")
    except ValueError:
        return None
    base, extension = os.path.splitext(original)
    base = base.strip(" .-_")
    if not base:
        return None
    # Avoid repeating the same date when it was already in the original title.
    d = re.match(r"^(\d{4}[-_. ]\d{1,2}[-_. ]\d{1,2}|\d{8})\s*[-_ .]+(.+)$", base)
    if d:
        found = re.sub(r"[^0-9]", "", d.group(1))
        if found == day and d.group(2).strip():
            base = d.group(2).strip(" .-_")
    new_filename = (dt.strftime("%Y-%m-%d") + " - " + base + " - " +
                    dt.strftime("%H-%M-%S") + extension)
    return new_filename if new_filename != filename else None

def prepare_plan():
    all_moves, skipped = [], []
    for folder in FOLDERS:
        output(u"Checking GE Studios/" + folder + u"…")
        filenames = list_files(folder)
        reserved = set(name.lower() for name in filenames)
        candidates = []
        for old in filenames:
            new = desired_name(old)
            if not new:
                continue
            if new.lower() in reserved:
                skipped.append((folder, old, u"Name already exists: " + new))
                continue
            reserved.add(new.lower())
            candidates.append((folder, old, new))
        all_moves.extend(candidates)
    return all_moves, skipped

def main():
    output(u"GE STUDIOS · RENAME EXISTING DRIVE UPLOADS")
    output(u"-----------------------------------------")
    output(u"Only GE Studios/Drafts, Finals, and Sessions are scanned.")
    output(u"No local files, music bytes, BLITZ, or Ableton will be modified.")
    output(u"")
    if not os.path.isfile(CONFIG) or not os.path.isfile(RCLONE):
        output(u"STOP: Missing the iMac's existing rclone Google Drive connection.")
        return 1
    if source_upload_active():
        output(u"STOP: A music upload or conversion may be active (or could not be checked).")
        output(u"Finish transfers first. Run this repair again when the studio is idle.")
        return 1
    try:
        moves, skipped = prepare_plan()
    except Exception as error:
        output(u"STOP: " + text(error))
        return 1
    output(u"")
    for folder, old, target in moves:
        output(u"[" + folder + u"] " + old)
        output(u"    → " + target)
    if skipped:
        output(u"")
        output(u"SKIPPED TO AVOID OVERWRITING:")
        for folder, old, reason in skipped:
            output(u"[" + folder + u"] " + old + u" · " + reason)
    output(u"")
    output(u"READY TO RENAME: " + str(len(moves)) + u" file(s).")
    output(u"ALREADY CONFLICTING: " + str(len(skipped)) + u" file(s), skipped.")
    if not moves:
        output(u"Nothing to rename. Either all matching files are already renamed,")
        output(u"or this iMac is connected to a different Google Drive account.")
        return 0
    output(u"")
    output(u"WARNING: This changes filenames in Google Drive, not song audio.")
    output(u"Type RENAME to approve these exact changes, or anything else to cancel.")
    try:
        answer = (input("> ") if PY3 else raw_input("> "))
    except (EOFError, KeyboardInterrupt):
        answer = ""
    if answer.strip() != "RENAME":
        output(u"CANCELED. No Drive files were changed.")
        return 0
    if source_upload_active():
        output(u"STOP: Transfer activity detected after confirmation; try again later.")
        return 1
    updated, failed = 0, 0
    for folder, old, target in moves:
        code, _out, err = command(
            [RCLONE, "--config", CONFIG, "moveto",
             ROOT + "/" + folder + "/" + old,
             ROOT + "/" + folder + "/" + target])
        if code == 0:
            updated += 1
            output(u"RENAMED [" + folder + u"] " + target)
        else:
            failed += 1
            output(u"NOT RENAMED [" + folder + u"] " + old + u": " + err[-250:])
        if updated and updated % 10 == 0:
            time.sleep(0.3)
    output(u"")
    output(u"FINISHED · " + str(updated) + u" renamed · " +
           str(failed) + u" errors · " + str(len(skipped)) + u" skipped.")
    output(u"Original music remains in place; no files were deleted.")
    return 0 if not failed else 1

if __name__ == "__main__":
    sys.exit(main())
