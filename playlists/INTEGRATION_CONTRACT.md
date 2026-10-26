# GE STUDIOS — ONE PLAYLIST SYSTEM
**Permanent integration reference for every GE website, Back Room, DJ, and Radio thread.**

## Canonical data source
- Repository: `grandelement/website`, branch `main`
- Playlist master: `playlists/registry.json`
- Public read: `https://raw.githubusercontent.com/grandelement/website/main/playlists/registry.json`
- Format: `ge-playlist-registry-v1`
- Catalog sources: `radio/manifest.json`, `radio/track-durations.json`
- NEVER use Cloudflare Vault or D1 as the playlist source, fallback or writable copy.
- Google Drive playlist folder is an optional reference/backup, not a runtime dependency.
- GitHub commit history provides versioning and recoverability. A playlist save is successful only after a commit SHA and fresh readback with identical song order.

## Meaning of a playlist
A playlist is a **stable ID**, **human-readable name**, and **ordered list of checked song paths**. The exact same playlist ID and track order must be recallable everywhere.

An individual registry entry looks like:
```json
{
  "id": "playlist_123",
  "name": "Guest Mix",
  "visibility": "published",
  "songs": ["ge-music/music/<actual album folder>/<actual filename>.mp3"],
  "created_at": "ISO-8601 timestamp",
  "updated_at": "ISO-8601 timestamp"
}
```
The example path above is a placeholder, not a valid song. Always use actual catalog paths. Do not invent track filenames. Preserve song order; preserve stable playlist IDs. `published` means the playlist appears in public GE MUSIC. `unlisted` means the public UI hides it, **not** that it is confidential: this repository and its JSON files are public.

## Already coded
1. Back Room owner UI: `backroom/index.html`, Playlists tab, complete scrollable checkboxes; selected songs, order, name, publish flag.
2. Owner save/read API: `backroom/publisher-worker.js` route `/manage/github-playlists`. Existing secure Back Room login supplies the owner bearer session. This Worker sends authenticated GitHub commits using server-side GitHub App credentials, which must never reach a public browser.
3. Public GE MUSIC reader: `radio/ge-music-v5.js`. Reads the GitHub playlist file directly and displays only published lists.
4. DJ Booth: `radio/ge-dj.html` and `radio-backend/control-server.py` are STILL on their older independent playlist endpoints and backup files; **not yet integrated** with the new GitHub playlist master. Preserve live Bangers without alteration.
5. Access Codes: existing Back Room code interface still uses the legacy private Vault endpoint. **It is not yet connected to a new code service or to customer-specific audio playback.** Do not claim that customer codes work.

## Exact owner API contract (existing implementation)
Service: `https://ge-backroom-publisher.grandelement.workers.dev`
Requires authenticated Back Room bearer session:
- `GET /manage/github-playlists` → `{ok:true,storage:"GITHUB",items:[{id,name,tracks:[{track_path,position}],metadata_json}],commit_sha}`.
- `POST /manage/github-playlists` with
```json
{"action":"save","playlist":{
 "id":"","name":"Guest Mix","public":false,
 "tracks":[{"track_path":"<real catalog path>","track_title":"<real title>","album":"<real album>"}]
}}
```
  Returns `{ok:true,id,name,commit_sha,storage:"GITHUB"}`.
- `POST /manage/github-playlists` with `{"action":"delete","id":"<playlist id>"}` requires owner authorization.
- On HTTP 401: expired owner session. On HTTP 404: outdated publisher deployment or incorrect route. On GitHub 409/422: concurrent update; refresh and resolve. Never call the save successful without readback.
- Note: the public raw GitHub URL is read-only; browsers must NOT have a GitHub write token.

## Integration instructions by component
**Back Room:** Keep full song-checkbox editor and owner GitHub save/read; show actionable connectivity errors. `Save` saves the ordered list to the GitHub registry only. The access-code tab must select an existing playlist and separately create permission in a private backend.

**DJ Booth:** Add a read-only `GitHub Playlists` list sourced from the master. When explicitly importing a playlist into an individual user's DJ/playback selection, preserve its name, stable ID and song order. Do not automatically replace local/DJ playlists, switch active station, modify Bangers, or erase radio backups. If the owner deliberately edits a canonical playlist through DJ, route the authenticated save to the same GitHub writer and verify readback.

**GE MUSIC & website:** Public playlists are read from the GitHub registry; private/customer code unlocks must be checked separately server-side. Reuse existing song catalog paths. An unavailable registry is an explicit error, not a reason to substitute Cloudflare Vault or overwrite saved records.

**Radio / customer playback:** The shared live Radio 1/Radio 2 stream is one broadcast. A customer's code should open a **separate personalized player/session/queue** from their assigned playlist, not change the station's global Bangers rotation. Next/previous/play must all enforce authorized song scope.

**Access codes:** The registry contains **no secret codes**, payment information, customer identities or listening entitlements. Use a private server-side authorization store for code hashes, expiration, revocation, rate limiting and allowed playlist IDs. Support bulk issuing 100 codes. An unlisted playlist in a public repository is discoverable by anyone; the actual MP3 files are presently public, so a playlist code alone is not a paid-content access boundary. Private audio hosting and enforced delivery are required for paid protected songs.

## Do not break
- Preserve working BLITZ DJ Booth, Bangers, Radio 1 and Radio 2.
- Never initialize an empty GitHub registry with guessed copies of Bangers.
- Do not delete any existing local/DJ playlist backup or Cloudflare Vault historical records.
- Never invent a successful deployment, a saved playlist, a checked code, or working paid access.
- If a service is unavailable, show the exact service failing; other services continue running.

## Required acceptance tests
1. Owner opens Back Room, checks several real songs, gives a name, saves. GitHub commit is returned.
2. Refresh Back Room and GitHub registry. Verify exact ID, name, selected songs and ordering.
3. Published list appears in GE MUSIC; unlisted list does not appear in public list (but is still visible in public GitHub JSON).
4. DJ Booth can read the selected playlist without altering active Bangers rotation.
5. Owner can issue, suspend and revoke a code bound to that playlist; an actual customer with the code loads an authorized personalized queue.
6. Unauthorized/expired users cannot obtain protected audio; playlist browser display alone never counts as content protection.
7. Deployment checks confirm the live publisher actually exposes `/manage/github-playlists` and enforces owner authorization.

## Current operational caution
The first GitHub Actions publisher deployment with working deployment credentials uploaded `ge-backroom-publisher`, but the runner's verification HTTP call returned **403 Forbidden**. This means the Worker upload succeeded, **not** that authenticated playlist saves have been proven live. Investigate Cloudflare's workers.dev access/edge rule or runner restrictions using the public health page and authenticated owner test; do not falsely declare all connections complete.
