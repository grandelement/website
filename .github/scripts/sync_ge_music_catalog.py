#!/usr/bin/env python3
"""Synchronize the complete GE MUSIC and preview-only SHOP catalogs.

Never modifies the pinned BLITZ Radio rotation, automatic Shuffle lock, or
radio/sync-playlist.json. New album files are browsable but NOT auto-played.
A shop album's partial/release status is never marked complete automatically.
"""
import json
import pathlib
import re
from urllib.parse import quote

ROOT = pathlib.Path(__file__).resolve().parents[2]
MUSIC = ROOT / "ge-music" / "music"
CLIPS = ROOT / "ge-music" / "clips"
RADIO_MANIFEST = ROOT / "radio" / "manifest.json"
SHOP = ROOT / "support" / "catalog.json"
AUDIO_EXTS = {".mp3", ".m4a", ".ogg", ".wav"}
ORDER = ["Aether", "Fire", "Spirit", "Soul", "Love", "Intergy", "Sessions II",
         "Sessions I", "Live", "Trio", "Fundamental Groove", "Singles"]


def albums_on_disk():
    groups = {}
    for directory in MUSIC.iterdir():
        if not directory.is_dir():
            continue
        name = directory.name
        if name == "Grand Element - Singles":
            album, year = "Singles", None
        else:
            match = re.fullmatch(r"Grand Element - (\d{4}) - (.+)", name)
            if not match:
                raise ValueError(f"Invalid album directory: {name}")
            year, album = int(match.group(1)), match.group(2)
        if album in groups:
            raise ValueError(f"Duplicate album folder: {album}")
        files = sorted((p for p in directory.iterdir() if p.is_file() and
                        p.suffix.lower() in AUDIO_EXTS), key=lambda p:p.name.casefold())
        if not files:
            raise ValueError(f"Album folder has no audio files: {name}")
        tracks = []
        seen_numbers = set()
        for path in files:
            stem = path.stem
            if album != "Singles":
                prefix = re.escape(album)
                match = re.fullmatch(prefix + r"_(\d{1,3})[_ -](.+)", stem, re.I)
                if not match:
                    raise ValueError(f"Bad filename (album_01_Title): {path}")
                number = int(match.group(1))
                title = match.group(2).replace("_", " ").strip()
                if number <= 0 or number in seen_numbers:
                    raise ValueError(f"Duplicate/invalid track number in {name}: {number}")
                seen_numbers.add(number)
            else:
                match = re.fullmatch(r"Singles_(.+)", stem, re.I)
                if not match:
                    raise ValueError(f"Bad Singles filename: {path}")
                number = None
                title = match.group(1).replace("_", " ").strip()
            if not title:
                raise ValueError(f"Missing song title in filename: {path}")
            tracks.append({"number": number, "title": title, "file": path.name})
        tracks.sort(key=lambda item:((item["number"] if item["number"] is not None else 1000),
                                      item["file"].casefold()))
        groups[album] = {"year": year, "dir": directory, "tracks": tracks}
    if not groups:
        raise ValueError("No GE Music album folders found")
    return groups


def main():
    groups = albums_on_disk()
    old = json.loads(SHOP.read_text(encoding="utf-8"))
    existing = {str(item.get("id")): item for item in old.get("music", [])}
    items = []
    for album in [*ORDER, *sorted(set(groups) - set(ORDER))]:
        if album not in groups:
            continue
        source = groups[album]
        slug = re.sub(r"[^a-z0-9]+", "-", album.lower()).strip("-")
        album_id = "album-" + slug
        prior = existing.get(album_id, {})
        prior_tracks = {item.get("file"): item for item in prior.get("tracks", [])}
        tracks = []
        for item in source["tracks"]:
            old_item = prior_tracks.get(item["file"], {})
            item = dict(item)
            # Keep established song titles, but include every newly uploaded file.
            if old_item.get("title"):
                item["title"] = old_item["title"]
            if item["number"] is None:
                item.pop("number")
            tracks.append(item)
        record = dict(prior)
        record.update({
            "id": album_id,
            "title": prior.get("title", album),
            "tracks": tracks,
        })
        if source["year"] is not None:
            record["year"] = source["year"]
        if not record.get("cover"):
            record["cover"] = "../ge-images/images/" + quote("Grand Element - " + album + ".jpg")
        # Never mark an album complete/sale-ready just because files appeared.
        if "partial" not in record:
            record["partial"] = True
        items.append(record)
    old["music"] = items
    # Retain preview-only commerce status and all merch/radio configuration.
    audio_files = []
    for folder in [MUSIC, CLIPS]:
        if folder.exists():
            audio_files.extend(p.relative_to(ROOT).as_posix() for p in folder.rglob("*")
                               if p.is_file() and p.suffix.lower() in AUDIO_EXTS)
    if len(audio_files) < sum(len(x["tracks"]) for x in groups.values()):
        raise ValueError("Audio-file inventory incomplete")
    manifest = json.loads(RADIO_MANIFEST.read_text(encoding="utf-8"))
    manifest["files"] = sorted(audio_files)
    # Check all target JSON serializations before replacing either catalog.
    shop_text = json.dumps(old, indent=2, ensure_ascii=False) + "\n"
    manifest_text = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    json.loads(shop_text); json.loads(manifest_text)
    SHOP.write_text(shop_text, encoding="utf-8")
    RADIO_MANIFEST.write_text(manifest_text, encoding="utf-8")
    print(f"GE MUSIC: {sum(len(x['tracks']) for x in groups.values())} songs in {len(groups)} albums")
    print("RADIO/SHA-LOCK unchanged. Shop remains preview-only pending master delivery/approval.")


if __name__ == "__main__":
    main()
