#!/usr/bin/env python3
"""GE Video Studio: public-link crawler and saved-link importer. Python 3.9+."""
import argparse
import hashlib
import html
import json
import re
import sys
import time
from collections import deque
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

AGENT = "GEVideoStudioLinkIndexer/1.0"
URL_RE = re.compile(r"https?://[^\s<>\"'{}]+", re.I)
TRACKING = {"fbclid", "gclid", "igshid", "si", "feature", "utm_source",
            "utm_medium", "utm_campaign", "utm_term", "utm_content"}
VIDEO_EXTENSIONS = (".mp4", ".mov", ".webm", ".m4v", ".gif", ".m3u8")

def normalize(raw, base=None):
    raw = html.unescape(str(raw)).replace("\\/", "/").strip().strip("()[]'\"")
    raw = raw.rstrip(".,;")
    if base:
        raw = urljoin(base, raw)
    p = urlparse(raw)
    if p.scheme not in {"http", "https"} or not p.hostname:
        return None
    query = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
             if k.lower() not in TRACKING and not k.lower().startswith("utm_")]
    path = p.path.rstrip("/") or "/"
    return urlunparse((p.scheme.lower(), p.netloc.lower(), path, "",
                       urlencode(query), ""))

def is_video_link(url):
    p = urlparse(url)
    host = (p.hostname or "").lower().removeprefix("www.")
    path = p.path.lower()
    query = dict(parse_qsl(p.query))
    if path.endswith(VIDEO_EXTENSIONS):
        return True
    if host in {"youtu.be", "youtube.com", "m.youtube.com"}:
        return host == "youtu.be" or path.startswith(("/shorts/", "/live/", "/embed/")) or (path == "/watch" and "v" in query)
    if host.endswith("instagram.com"):
        return path.startswith(("/reel/", "/reels/", "/p/", "/tv/"))
    if host.endswith("tiktok.com"):
        return "/video/" in path or path.startswith("/t/")
    if host.endswith("facebook.com") or host == "fb.watch":
        return host == "fb.watch" or "/videos/" in path or "/reel/" in path or path == "/watch" or "video.php" in path
    if host.endswith("vimeo.com"):
        return bool(re.search(r"/\d{5,}", path))
    if host in {"x.com", "twitter.com"}:
        return "/status/" in path
    if host.endswith(("streamable.com", "dailymotion.com", "rumble.com", "redgifs.com")):
        return bool(path and path != "/")
    return False

def creator_hint(url):
    p = urlparse(url)
    host = (p.hostname or "").lower()
    path = p.path
    m = re.search(r"/(@[A-Za-z0-9_.-]+)/video/", path)
    if m:
        return m.group(1)
    m = re.search(r"/(@[A-Za-z0-9_]+)/status/", path)
    if m:
        return m.group(1)
    # The uploader of a reel is often not encoded in its link.
    return None

class Links(HTMLParser):
    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base = base
        self.links = set()
        self.pages = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for attr in ("href", "src", "data-src", "data-url", "content"):
            raw = attrs.get(attr)
            if not raw:
                continue
            u = normalize(raw, self.base)
            if not u:
                continue
            if is_video_link(u):
                self.links.add(u)
            if tag == "a" and attr == "href":
                self.pages.add(u)

def extract_text(text, base=None):
    text = text.replace("\\/", "/")
    found = set()
    for m in URL_RE.finditer(text):
        u = normalize(m.group(0), base)
        if u and is_video_link(u):
            found.add(u)
    return found

def read_local(path):
    raw = Path(path).read_text(encoding="utf-8-sig", errors="replace")
    found = extract_text(raw)
    if Path(path).suffix.lower() in {".htm", ".html"}:
        parser = Links(None)
        parser.feed(raw)
        found.update(parser.links)
    if Path(path).suffix.lower() == ".json":
        try:
            data = json.loads(raw)
            def walk(value):
                if isinstance(value, str):
                    found.update(extract_text(value))
                elif isinstance(value, dict):
                    for v in value.values():
                        walk(v)
                elif isinstance(value, list):
                    for v in value:
                        walk(v)
            walk(data)
        except json.JSONDecodeError:
            pass
    return found

def get_public(url):
    req = Request(url, headers={"User-Agent": AGENT, "Accept": "text/html,application/xml;q=0.9,*/*;q=0.5"})
    with urlopen(req, timeout=15) as res:
        typ = res.headers.get("Content-Type", "")
        if not any(t in typ for t in ("text/html", "text/xml", "application/xml")):
            return ""
        return res.read(4_000_000).decode("utf-8", errors="replace")

def crawl(start, limit, pause):
    root = normalize(start)
    if not root:
        raise ValueError("A complete HTTPS or HTTP website URL is required")
    domain = urlparse(root).hostname
    robots = RobotFileParser()
    robots.set_url(f"{urlparse(root).scheme}://{domain}/robots.txt")
    try:
        robots.read()
    except (HTTPError, URLError, OSError):
        print("Warning: robots.txt unavailable; checking pages cautiously.", file=sys.stderr)
        robots = None
    todo = deque([root])
    sitemap = f"{urlparse(root).scheme}://{domain}/sitemap.xml"
    if robots is None or robots.can_fetch(AGENT, sitemap):
        try:
            xml = get_public(sitemap)
            for loc in re.findall(r"<loc>\s*(.*?)\s*</loc>", xml):
                u = normalize(loc)
                if u and urlparse(u).hostname == domain:
                    todo.append(u)
        except (HTTPError, URLError, OSError):
            pass
    visited, found = set(), set()
    while todo and len(visited) < limit:
        page = todo.popleft()
        if page in visited or urlparse(page).hostname != domain:
            continue
        if robots is not None and not robots.can_fetch(AGENT, page):
            continue
        visited.add(page)
        try:
            body = get_public(page)
        except (HTTPError, URLError, OSError) as exc:
            print(f"Skipping {page}: {exc}", file=sys.stderr)
            continue
        parser = Links(page)
        parser.feed(body)
        found.update(parser.links)
        found.update(extract_text(body, page))
        for u in parser.pages:
            if urlparse(u).hostname == domain and u not in visited:
                todo.append(u)
        time.sleep(pause)
    print(f"Public pages checked: {len(visited)}, video links: {len(found)}")
    return found

def make_entry(url, provenance, confirmed):
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    handle = creator_hint(url)
    return {
        "id": "GEV-" + hashlib.sha256(url.encode("utf-8")).hexdigest()[:12],
        "source_url": url,
        "source_platform": urlparse(url).hostname,
        "discovered_from": [provenance],
        "creator_handle": handle,
        "creator_display_name": None,
        "credit_text": handle,
        "creator_rights_holder_verified": False,
        "permission": {
            "status": "user_reported_messenger_permission" if confirmed else "not_yet_confirmed",
            "confirmation": "Reported by GE Studios; no independent review" if confirmed else None,
            "evidence_ref_private": None,
            "allowed_uses": None,
            "credit_requirements": "Tag the source creator; verify exact handle"
        },
        "media_file_ref": None,
        "duration_seconds": None,
        "tags": [],
        "added_at": stamp
    }

def main():
    ap = argparse.ArgumentParser(description="Index public video links for GE Video Studio; does not download videos.")
    ap.add_argument("--input", action="append", default=[], help="Local .txt, .html or .json exports; repeatable")
    ap.add_argument("--link", action="append", default=[], help="A share link confirmed by GE Studios; repeatable")
    ap.add_argument("--website", action="append", default=[], help="Public page to crawl for discoverable links; repeatable")
    ap.add_argument("--max-pages", type=int, default=100)
    ap.add_argument("--delay", type=float, default=0.4)
    ap.add_argument("--output", default="clip-vault.json")
    args = ap.parse_args()
    if not (args.input or args.link or args.website):
        ap.error("Specify --input, --link or --website")
    output = Path(args.output)
    vault = {"schema_version": 1, "collection": "GE Video Studio", "clips": []}
    if output.exists():
        vault = json.loads(output.read_text(encoding="utf-8"))
    by_url = {c["source_url"]: c for c in vault.get("clips", []) if "source_url" in c}
    new_count = 0
    def register(url, provenance, confirmed):
        nonlocal new_count
        u = normalize(url)
        if not u or not is_video_link(u):
            return
        if u in by_url:
            old = by_url[u]
            if provenance not in old.setdefault("discovered_from", []):
                old["discovered_from"].append(provenance)
            if confirmed and old.get("permission", {}).get("status") == "not_yet_confirmed":
                old["permission"]["status"] = "user_reported_messenger_permission"
                old["permission"]["confirmation"] = "Reported by GE Studios; no independent review"
        else:
            by_url[u] = make_entry(u, provenance, confirmed)
            new_count += 1
    for path in args.input:
        for u in read_local(path):
            register(u, f"import:{Path(path).name}", True)
    for u in args.link:
        register(u, "pasted_by_GE_Studios", True)
    for site in args.website:
        for u in crawl(site, max(1, args.max_pages), max(0, args.delay)):
            register(u, f"crawl:{site}", False)
    vault["clips"] = sorted(by_url.values(), key=lambda c: c["id"])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(vault, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Added {new_count}. Total {len(by_url)} entries. Saved to {output}")
    print("No video files downloaded. Store private Messenger grants and contact information outside public GitHub.")

if __name__ == "__main__":
    main()
