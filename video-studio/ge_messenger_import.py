#!/usr/bin/env python3
"""Import link metadata from an authorized Facebook/Messenger JSON archive.

Works with a Meta ZIP export or its extracted folder. Keeps source messages local.
Does not access the Facebook account, download hosted videos, or publish a license.
Python 3.9+.
"""
import argparse
import csv
import hashlib
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

URL = re.compile(r"https?://[^\s<>\u0022'\u201c\u201d]+", re.I)
TRACK = {"fbclid", "gclid", "igshid", "si", "utm_source", "utm_medium",
         "utm_campaign", "utm_term", "utm_content"}
MEDIA_DOMAINS = ("facebook.com", "fb.watch", "instagram.com", "tiktok.com",
                 "youtube.com", "youtu.be", "vimeo.com", "streamable.com",
                 "dailymotion.com", "rumble.com", "x.com", "twitter.com")
MEDIA_EXT = (".mp4", ".mov", ".webm", ".m4v", ".gif", ".m3u8")

def normalize(link):
    raw = str(link).replace("\\/", "/").replace("&amp;", "&").strip().strip("[]()\"'")
    raw = raw.rstrip(".,;!?")
    p = urlparse(raw)
    if p.scheme not in ("http", "https") or not p.hostname:
        return None
    q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
         if k.lower() not in TRACK and not k.lower().startswith("utm_")]
    return urlunparse((p.scheme.lower(), p.netloc.lower(), p.path.rstrip("/"),
                       "", urlencode(q), ""))

def links_from_text(text):
    return {u for match in URL.findall(str(text))
            if (u := normalize(match))}

def urls_from_message(msg):
    urls = set()
    if isinstance(msg.get("content"), str):
        urls.update(links_from_text(msg["content"]))
    def scan(obj, depth=0):
        if depth > 8:
            return
        if isinstance(obj, dict):
            for key, val in obj.items():
                if isinstance(val, str) and key.lower() in {
                    "link", "url", "href", "target", "share_text",
                    "original_content_url", "title", "description", "uri"
                }:
                    urls.update(links_from_text(val))
                    if val.startswith(("http://", "https://")):
                        norm = normalize(val)
                        if norm:
                            urls.add(norm)
                elif isinstance(val, (dict, list)):
                    scan(val, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                scan(item, depth + 1)
    for k in ("share", "shares", "attachments", "links", "videos", "photos", "audio_files"):
        if k in msg:
            scan(msg[k])
    return urls

def category(link):
    p = urlparse(link)
    host = (p.hostname or "").lower().removeprefix("www.")
    if p.path.lower().endswith(MEDIA_EXT):
        return "direct_media_or_stream"
    if any(host == d or host.endswith("." + d) for d in MEDIA_DOMAINS):
        return "media_platform_link_review"
    return "other_link_review"

def discover_json(path):
    p = Path(path)
    if p.is_dir():
        for f in p.rglob("*.json"):
            if "message" in str(f.relative_to(p)).lower():
                try:
                    yield str(f), json.loads(f.read_text(encoding="utf-8-sig"))
                except (OSError, ValueError):
                    continue
    elif p.suffix.lower() == ".zip":
        with zipfile.ZipFile(p) as archive:
            for name in archive.namelist():
                if name.lower().endswith(".json") and "message" in name.lower():
                    try:
                        yield name, json.loads(archive.read(name).decode("utf-8-sig"))
                    except (ValueError, UnicodeError, KeyError):
                        continue
    elif p.suffix.lower() == ".json":
        yield p.name, json.loads(p.read_text(encoding="utf-8-sig"))
    else:
        raise ValueError("Give a Meta export .zip, extracted folder, or .json file")

def fmt_time(value):
    if not isinstance(value, (int, float)):
        return None
    try:
        return datetime.fromtimestamp(value / (1000 if value > 100000000000 else 1),
                                      tz=timezone.utc).isoformat(timespec="seconds")
    except (ValueError, OverflowError, OSError):
        return None

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("export", help="Your Meta Messenger JSON export ZIP or extracted folder")
    ap.add_argument("--output", default="ge-messenger-links.json")
    ap.add_argument("--csv", default="ge-messenger-links.csv")
    args = ap.parse_args()
    entries = {}
    threads = 0
    messages = 0
    for source_path, doc in discover_json(args.export):
        if not isinstance(doc, dict):
            continue
        # Messenger archives typically store one thread per message_1.json,
        # but other exports may not include these standard keys.
        thread_messages = doc.get("messages")
        if not isinstance(thread_messages, list):
            continue
        threads += 1
        participants = [x.get("name") for x in doc.get("participants", [])
                        if isinstance(x, dict) and x.get("name")]
        conversation = doc.get("title") or " / ".join(participants) or source_path
        for msg in thread_messages:
            if not isinstance(msg, dict):
                continue
            messages += 1
            sender = msg.get("sender_name") or None
            when = fmt_time(msg.get("timestamp_ms", msg.get("timestamp")))
            for link in urls_from_message(msg):
                if link not in entries:
                    entries[link] = {
                        "id": "GEV-" + hashlib.sha256(link.encode()).hexdigest()[:12],
                        "source_url": link,
                        "category": category(link),
                        "creator_name": None,
                        "creator_handle": None,
                        "credit_line": None,
                        "rights_status": "review_conversation_and_user_confirmation",
                        "permission_evidence_location": "original Messenger export (retain privately)",
                        "media_file": None,
                        "uses_in_projects": [],
                        "message_sources": []
                    }
                event = {"conversation": conversation, "shared_by": sender,
                         "shared_at": when, "file_in_export": source_path}
                if event not in entries[link]["message_sources"]:
                    entries[link]["message_sources"].append(event)
    result = {
        "schema_version": 1,
        "source": "Grand Element Messenger export",
        "note": "Export includes conversation identifiers; store these outputs privately, NOT in the public website GitHub repository. Sender/uploader is not necessarily the owner. Link extraction does not establish permission.",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "conversations_processed": threads,
        "messages_processed": messages,
        "clips": sorted(entries.values(), key=lambda x: x["id"])
    }
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with open(args.csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["clip_id", "type", "source_url", "conversation", "shared_by",
                    "shared_at", "rights_status", "creator_name", "creator_handle"])
        for item in result["clips"]:
            for s in item["message_sources"]:
                w.writerow([item["id"], item["category"], item["source_url"],
                            s["conversation"], s["shared_by"], s["shared_at"],
                            item["rights_status"], "", ""])
    print(f"Processed {threads} conversations, {messages} messages and "
          f"{len(entries)} unique links. Outputs: {args.output}, {args.csv}")
    print("Note: Video/platform share URLs are candidates, not downloaded video files.")

if __name__ == "__main__":
    main()
