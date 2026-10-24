# GE Playlist Library — single-source migration plan

## Decision
Keep **GE Vault Cloudflare D1** as the durable authoritative playlist store.
Use the existing `playlists` and `playlist_tracks` tables. Do not create another
browser-only or GitHub JSON source of truth. Music files remain where they are.

## Current verified paths (2026-10-24)
- Original DJ editor: `radio/ge-dj.html`, calls `/control/playlists`,
  `/control/playlists/save`, `/control/playlists/backup` and `/control/playlists/import`
  through the authenticated original DJ controller.
- Back Room: `backroom/index.html` fetches DJ playlists through
  `https://ge-radio-sync.grandelement.workers.dev/v1/dj-proxy/control/playlists`;
  it can copy approved playlists to `music.publicPlaylists` in a published
  `config/site-live.json` snapshot.
- Vault database: `vault-worker/src/index.js` reads `VAULT_DB`
  `playlists` and `playlist_tracks`; private `/v1/playlists` endpoints use
  admin authentication.
- Public Radio: `radio/index.html` fetches
  `https://vault.grandelement.com/v1/public/dj-playlists`. Public selection
  is currently gated through `music.publicDJPlaylistNames` or
  `music.publicPlaylists` in published config, not through an authoritative
  playlist's own visibility flag.
- `config/site-live.json` currently approves name `Bangers`, but does not
  contain the playlist's song list. Do not infer songs from the radio queue.

## Target flow
DJ Booth SAVE -> authenticated DJ controller -> signed server-to-server sync
-> GE Vault D1 -> public filtered playlist API -> Radio MUSIC GE PLAYLISTS.

The DJ editor and the public Radio must load the same playlist ID, name,
ordered track paths and revision. No manual re-creation or special casing BANGERS.

## Required implementation
1. Export/backup all original DJ playlist records, especially BANGERS, before migration.
   Also back up current D1 tables. Preserve IDs, song order, names and timestamps.
2. Add authenticated DJ-to-Vault writes on the **server side**, using distinct
   private credentials. Never send `VAULT_ADMIN_TOKEN` or DJ keys to browser code.
   Implement idempotent upsert by DJ playlist ID. Confirm every SAVE receives a
   durable Vault acknowledgment; preserve DJ's existing store as recovery backup.
3. Add a durable public visibility setting per playlist, editable only by owner.
   Migrate existing published BANGERS approval to the correct playlist ID. Default
   all other playlists to PRIVATE. Do not assume all DJ lists are public.
4. Public `GET /v1/public/dj-playlists` reads only public D1 rows with their
   ordered track paths and returns `id,name,songs,revision` with no secrets.
   Remove live `site-live.json` fetch as a *data dependency* once migrated.
5. Radio MUSIC reads the live public endpoint directly, clearly displaying
   connection errors and last successful read; no invented songs and no
   unauthenticated DJ management API calls.
6. Back Room displays source status, Vault sync status, playlist counts and
   last-updated revision. Owner toggles publication there; no `PUBLISH LIVE`
   needed for every DJ playlist edit once publication is approved.
7. Test create/update/rename/reorder/unpublish, offline fallback, CORS on
   `https://grandelement.com`, private list isolation, and iPhone Safari.
   Do not touch BLITZ Radio 1 scheduling/playlist rotation.

## Required verification gates
- BANGERS exported from original DJ, unchanged track count and order.
- BANGERS imported into D1 under a stable DJ ID; no duplicates.
- Saving edits in DJ updates Vault and then the Radio response.
- A private playlist never leaks via public endpoint, cache or fallback.
- Vault and DJ controller failures surface actionable diagnostics.
- New MUSIC and DJ playlist UI both display the expected revision.

## Rollout
Stage new private sync and public read alongside the old paths. Backfill and
compare records. Switch Radio readers only after checks pass. Keep existing
DJ controller and D1 backups until migration is verified; do not delete data.
