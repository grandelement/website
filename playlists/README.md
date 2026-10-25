# GRAND ELEMENT · PLAYLIST MASTER
**Fixed GitHub home:** `grandelement/website/playlists/registry.json`

This is the permanent public playlist reference. One playlist is a **name, a stable ID and an ordered list of song file paths**, saved under that name for reuse by Radio, GE MUSIC and other Grand Element pages.

## Song catalog
Use the existing published files, not a second copied catalog:
- `radio/manifest.json`
- `radio/track-durations.json`

## Playlist record
```json
{
  "id": "guest-playlist-001",
  "name": "Guest Playlist",
  "visibility": "published",
  "songs": [
    "ge-music/music/Grand Element - 2017 - Soul/Soul_01_Sunbeam.mp3"
  ]
}
```

Each song must exist in the catalog. The order of `songs` is the playback order. Never overwrite an unrelated playlist with the same name; IDs remain stable. Unpublished/private music and private listener assignments must **not** be committed to this public repository. In particular, **never put access codes, passwords, hashes, purchaser IDs, email addresses, or private fan data in GitHub**.

## Where it is loaded
- `radio/ge-music-v5.js` loads published playlists directly from the GitHub **raw** registry; this read does **not** depend on Cloudflare Vault endpoints or a Cloudflare build. The existing Vault response is used as a legacy fallback only to avoid losing old published music while transitioning.
- The BLITZ DJ Booth's live Bangers rotation remains untouched. Do not replace Bangers with guesses or initialize the radio playlists from this empty registry.
- The Back Room playlist editor now exposes one scrollable checklist of the entire music catalog, in addition to the original album view.

## Saving playlists
Authenticated GitHub writes are required; an ordinary browser cannot safely commit to GitHub without owner authorization. This commit establishes storage and read paths, **not** a completed browser-to-GitHub save integration. Until an authenticated writer is connected, a Back Room "SAVE TO VAULT" still uses the old Vault publisher and must report a real error if unavailable. Owner-authorized ChatGPT/GitHub connector edits can update this registry directly. Do not falsely report an unsaved playlist as saved.

## Access codes
The code-to-playlist relation is `code → authorized playlist ID / song paths → session → playback`. Codes, entitlements, use limits and expiration must stay in a **private, server-validated store**, never in public JSON or browser storage. This registry does **not** create paid access or private audio protection: published MP3 URLs are currently public.

## Quality control
- Never silently delete a playlist when its source is unreachable.
- Never alter the live Bangers rotation as a side effect of editing an individual customer's playlist.
- Preserve both existing Vault data and radio local/backup data during transition.
- The Git commit history is the human-readable change log; a failed read must be visible, not silently described as success.
