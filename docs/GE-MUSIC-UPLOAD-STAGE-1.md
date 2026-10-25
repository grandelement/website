# GE Studios — Stage 1: album and track upload (24 October 2026)

## Non-destructive contract

**Never wipe the 94 already published audio files, existing playlists, Vault records, public album artwork, or BLITZ's pinned live source.** The uploader is an independent owner-authenticated path. Multiple files can be reviewed and uploaded to private R2, one by one, with real progress and explicit receipts. It does **not** place audio in public MUSIC, the store, or the on-air radio list.

### Current published audio inventory (GitHub main)

- 94 audio tracks in 12 album / singles directories, excluding DAW .asd sidecars.
- Fundamental Groove: 15; Trio: 5; Live: 9; Sessions I: 8; Sessions II: 6; Intergy: 10; Love: 7; Soul: 10; Spirit: 4; Fire: 11; Aether: 4; Singles: 5.
- The numbered files show gaps: Trio 1, 3–6, 10–17; Live 1, 3, 5, 7; Sessions II 2; Intergy 1; Love 4; Spirit 4. **These are numbering gaps only, not proof that the actual finished album should contain those exact recordings.** Compare to original masters, track lists, and intended editions.
- The website's current `radio/manifest.json` already contains these existing songs. Do not re-upload or overwrite them without inspecting the originals.

## Components

- `backroom/music-upload.html`: owner uploader; album picker, existing track inventory, multiselect, editable titles, per-song progress, upload receipts and private R2 listing.
- `backroom/publisher-worker.js`: authenticated `GET/POST /manage/music/uploads`, streams bytes directly to the private `GE_AUDIO_UPLOADS` R2 binding, validates selected file size (1–60 MiB), extension and album naming. Uses immutable UUID keys; does not write to public GitHub.
- `vault-worker/migrations/20261024_music_assets.sql`: additive D1 `music_assets` registry, created before deployment.
- `vault-worker/src/index.js`: authenticated `POST /v1/admin/music-assets`, records the exact private R2 receipt in Vault with status `staged`.
- Back Room MUSIC and PLAYLISTS link to the upload page **in the same browser tab** to retain `GE_BACKROOM_PUBLISH_SESSION_V1` in sessionStorage.

## One-time infrastructure setup (not handled by a GitHub commit)

From a trusted machine already authenticated with the GE Cloudflare account:

1. Confirm R2 is enabled. Create private bucket if missing: `npx wrangler r2 bucket create ge-audio-uploads`. Do not make it publicly accessible.
2. Run the additive Vault migration, **not** the full schema against the existing database:
   `cd vault-worker && npx wrangler d1 execute ge-studios-vault --remote --file=migrations/20261024_music_assets.sql`
3. Deploy updated Vault Worker: `npx wrangler deploy`.
4. In `backroom/wrangler.toml`, uncomment `[[r2_buckets]]` with binding `GE_AUDIO_UPLOADS` and bucket name `ge-audio-uploads`.
5. Deploy Back Room Worker: `cd ../backroom && npx wrangler deploy`. Preserve all existing Worker secrets and routes. Publishing frontend GitHub files is separate from deploying Cloudflare Workers.
6. Sign in to `https://grandelement.com/backroom/` with the actual private Publisher login. Open MUSIC > UPLOAD ALBUMS AND SONGS in the **same tab**. Select an album and a **small test file** (not the only master copy), click UPLOAD, and verify its receipt says both `R2 STORED` and `VAULT RECORDED`.
7. Test STOP and interrupted transfer behavior; confirm that a failed upload does not claim success, and check GET `/manage/music/uploads` under the authenticated owner session. Confirm neither BLITZ stream changed nor newly staged audio appeared publicly. Keep independent original master backups.

**Important:** R2 storage alone is **not** publication. Uploads do not yet populate the public MUSIC playlist picker, merchandise, or the DJ library. A separate reviewed publication phase must register catalog metadata, provide a verified playable/deliverable audio rendition, and join GE Vault playlist IDs with the DJ Booth; implement and test that before changing any live radio library. Do not expose purchased full masters through unauthenticated public URLs.

If the Vault receipt fails after a successful R2 write, the server responds **202** with the private object key and warning. It keeps the object; do not blindly upload again. Reconcile the recorded R2 object after Vault recovery.

## Why separate the layers?

Cloudflare R2 is for audio bytes, Vault D1 for permanent names/track data/playlists. The public website is the listener-facing selector. BLITZ remains only the radio delivery engine; it must not be a prerequisite for creating, saving, or browsing playlists. A DJ Booth playlist can eventually refer to the same durable Vault playlist ID/ordered tracks without copying playlists by name into multiple local databases.
