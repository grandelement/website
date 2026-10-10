#!/bin/sh
# Safe frontend-only sync: rebuilds DJ UI files WITHOUT restarting the radio engine.
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
SITE="$ROOT/radio-next/site"
mkdir -p "$SITE"
for name in dj-entry.html dj.html dj-lite.html live-dj.html; do
  cp "$ROOT/radio-backend/$name" "$SITE/$name.tmp"
  mv "$SITE/$name.tmp" "$SITE/$name"
done
python3 - "$SITE" <<'PY'
import hashlib, json, os, pathlib, re, sys, tempfile
site = pathlib.Path(sys.argv[1])
raw = (site / 'dj.html').read_bytes()
match = re.search(rb'id="geDjBuildLabel">v(\d+)</span>', raw)
version = match.group(1).decode('ascii') if match else "unknown"
fingerprint = hashlib.sha256(raw).hexdigest()[:8]
payload = {"ok": True, "version": version, "build": fingerprint}
fd, tmp = tempfile.mkstemp(dir=site, prefix='.dj-build-', suffix='.json')
with os.fdopen(fd, 'w') as fp:
    json.dump(payload, fp)
os.replace(tmp, site / 'dj-build.json')
print("GE Radio 2 DJ UI deployed:", version, fingerprint, "(engine uninterrupted)")
PY
