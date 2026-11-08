#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Private, local-only GitHub publisher for GE Radio (Python 2.7 / 3).
Install next to ge-upload-helper.py. Never expose the token to a browser.
Token file: ~/Library/Application Support/GEStudios/github-radio-token
Token requires Contents: Read and write on grandelement/website.
"""
from __future__ import print_function
import base64
import json
import os
import re
import stat
import time
try:
    from urllib2 import Request, urlopen, HTTPError
    from urllib import quote
except ImportError:
    from urllib.request import Request, urlopen, HTTPError
    from urllib.parse import quote

OWNER = "grandelement"
REPO = "website"
BRANCH = "main"
MAX_FILE_BYTES = 100000000  # GitHub hard file limit; check after conversion.
TOKEN_FILE = os.path.expanduser("~/Library/Application Support/GEStudios/github-radio-token")
DESTINATION = "ge-music/music/Radio Uploads"

def _text(x):
    return x.decode("utf-8", "replace") if isinstance(x, bytes) else x

def _api(method, route, token, payload=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    url = "https://api.github.com/repos/%s/%s/%s" % (OWNER, REPO, route)
    req = Request(url, data=data)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("Authorization", "Bearer " + token)
    req.add_header("User-Agent", "GEStudios-iMac-Radio")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if method not in ("GET", "POST"):
        req.get_method = lambda: method
    try:
        response = urlopen(req, timeout=90)
        return json.loads(_text(response.read()))
    except HTTPError as exc:
        # Never leak tokens or raw response bodies into UI.
        raise RuntimeError("GitHub API %s (%s). Check repository permission and connection." % (exc.code, route.split("/")[0]))

def _token():
    if not os.path.isfile(TOKEN_FILE):
        raise RuntimeError("GITHUB NOT CONNECTED: add private github-radio-token to GEStudios support folder.")
    if os.stat(TOKEN_FILE).st_mode & (stat.S_IRWXG | stat.S_IRWXO):
        raise RuntimeError("GITHUB TOKEN NOT PRIVATE: run chmod 600 on github-radio-token.")
    token = open(TOKEN_FILE, "r").read().strip()
    if not token or not re.match(r"^[A-Za-z0-9_]+$", token):
        raise RuntimeError("GitHub token file is empty or invalid.")
    return token

def publish(mp3_path, filename, update=None):
    size = os.path.getsize(mp3_path)
    if size >= MAX_FILE_BYTES:
        raise RuntimeError("FILE TOO LARGE: converted MP3 is %0.1f MB; GitHub limit is 100 MB." % (size / 1000000.0))
    if not filename.lower().endswith(".mp3"):
        raise RuntimeError("RADIO REQUIRES MP3: select 320 KBPS MP3 format.")
    filename = os.path.basename(filename).replace("/", "_").replace("\\", "_")
    token = _token()
    # Create a new immutable filename; do not overwrite another upload.
    stem = os.path.splitext(filename)[0]
    suffix = time.strftime("%Y%m%d-%H%M%S", time.gmtime())
    safe = re.sub(r"[^A-Za-z0-9 ._()-]", "_", stem)[:120].strip(" .") or "Radio"
    target = DESTINATION + "/" + safe + " - " + suffix + ".mp3"
    if update:
        update(phase="uploading", detail="Sending converted MP3 to GitHub", percent=15)
    # Git Data API: one blob and one tree/commit, no Git checkout required on old iMac.
    with open(mp3_path, "rb") as f:
        encoded = _text(base64.b64encode(f.read()))
    if update:
        update(phase="uploading", detail="Uploading MP3 to GitHub", percent=35)
    blob = _api("POST", "git/blobs", token, {"content": encoded, "encoding": "base64"})
    if update:
        update(phase="uploading", detail="Committing radio track", percent=80)
    for attempt in range(3):
        ref = _api("GET", "git/ref/heads/" + BRANCH, token)
        head = ref["object"]["sha"]
        commit = _api("GET", "git/commits/" + head, token)
        tree = _api("POST", "git/trees", token, {"base_tree": commit["tree"]["sha"], "tree": [
            {"path": target, "mode": "100644", "type": "blob", "sha": blob["sha"]}
        ]})
        new_commit = _api("POST", "git/commits", token, {
            "message": "Upload GE Radio track: " + safe,
            "tree": tree["sha"], "parents": [head]
        })
        try:
            _api("PATCH", "git/refs/heads/" + BRANCH, token, {"sha": new_commit["sha"], "force": False})
            return target
        except RuntimeError:
            if attempt == 2:
                raise
    raise RuntimeError("GitHub upload commit could not be confirmed.")
