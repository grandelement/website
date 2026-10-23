# GE Studios music re-upload — lock and release procedure (22 October 2026)

> **October 22 update:** The website Player/Shuffle now uses an editable
> GE Radio Master Song List in Back Room, approved by current music paths,
> not Git commit blobs. Replacing audio under an unchanged path retains its
> approval. New paths default excluded from automatic playback.
> **The live BLITZ backend remains on its earlier pinned revision until the
> real Bangers rotation can be compared and a separately reviewed backend
> deployment can enforce this same list. Do not assume GitHub merge redeploys
> the BLITZ container.**

## DO NOT START THE BULK UPLOAD UNTIL LIVE BLITZ IS VERIFIED ON THE FROZEN SOURCE

Pinned source commit: `69442ea48d04024881d20d8e78725ebd42d970fa`.

The running BLITZ container must first be rebuilt/redeployed with the updated
`radio-backend/library-watcher.py`. In the authenticated GE DJ Booth / library
status, confirm that `/control/library` reports the **full pinned commit SHA**.
A merged GitHub PR or updated Cloudflare website does **not** prove Blitz has
deployed. Do not use the upload as a deployment test.

BLITZ reads old tracks via the pinned commit's raw GitHub URLs, not new files
from `main`. It retains the existing active Bangers Custom Mix in the runtime
when those song paths existed at the frozen commit. New and same-named replaced
files are not automatically imported. Never change the pinned SHA to `main`.

The independent website Player/Shuffle uses the `radio/approved-autoplay.json`
snapshot (47 default-approved recordings; any explicitly chosen MUSIC playlist
is separate). No new catalog file can join that automatic set. New songs can
appear in MUSIC and the shop without changing station/Shuffled playback.

## Album upload contract

Place each audio file in its real album folder:

`ge-music/music/Grand Element - YYYY - Album Name/Album Name_01_Song Title.mp3`

`ge-music/music/Grand Element - YYYY - Album Name/Album Name_02_Another Song.wav`

The current folder names must be retained unless an intentional album rename is
coordinated across artwork, track metadata, and shop catalog. For singles, use
`ge-music/music/Grand Element - Singles/Singles_Song Title.mp3`.

- Use a unique positive track number per album, with the album folder name as
  the file-name prefix. Do not overwrite multiple mixes under one track number.
- Existing multiword album names, including Sessions I/II and Fundamental
  Groove, must match the filenames exactly.
- Accepted website audio inventory formats: `.mp3`, `.m4a`, `.ogg`, `.wav`.
  Supply final mastered audio, not DAW sidecars (`.asd`), drafts or projects.
  For buyer master delivery, configure the verified delivery system separately.
- For multiple masters or alternate mixes, decide whether they are separate
  album tracks before uploading; the inventory rejects duplicate numbers.
- First upload a *complete album*, not a partial batch, if the shop is meant
  to eventually offer a **FULL ALBUM** product.
- Retain reliable original backups outside the repository before overwrites.

## Automatic catalog updates

On music-folder pushes, the GitHub workflow:

1. validates all current album folders, audio names, duplicate track numbers;
2. refreshes **all** songs in `radio/manifest.json` for MUSIC;
3. measures `radio/track-durations.json`, failing if a new audio file is corrupt;
4. updates **every** album's song list in `support/catalog.json`, including
   new albums and Fundamental Groove;
5. leaves `radio/sync-playlist.json`, the BLITZ source SHA and
   `radio/approved-autoplay.json` **untouched**.

The shop catalog is **preview-only**. An album's existing `partial` status is
not silently changed to complete by a file upload. Payment, customer delivery
of purchased master recordings, and complete album tracklist review must be
approved/tested before enabling a sale. Likewise, uploading a new recording
does not license it for broadcast and does not add it to Bangers.

## Before declaring the upload complete

- Verify that each folder includes the intended complete album, not only files
  currently in GitHub.
- Compare `radio/manifest.json` and `support/catalog.json` to the new tree.
- Approve the entire final album tracklist and release-ready masters.
- Confirm the public MUSIC browser shows all tracks, the shop includes every
  track, and neither Radio nor automatic Shuffle changed.
- Only then explicitly decide whether any new song should be added to Bangers
  or automatic Shuffle and revise the appropriate approval separately.
