# AETHER album audit — 18 November 2026

## Sources checked
The `grandelement/website` GitHub `main` audio directory, `radio/manifest.json`, `radio/track-durations.json`, `radio/loudness.json`, `support/catalog.json`, `config/site-live.json`, `radio/approved-autoplay.json`, `radio/ge-music-v5.js`, `radio/index.html`, Back Room routing, `playlists/registry.json`, and the album-upload contract.

## Physical audio inventory: 12 files, no Track 09
Current file order, **as numbered on disk**, is:

| File | Recorded title | Filename track number |
| --- | --- | --- |
| `Aether_01-The Journey I.mp3` | The Journey I | 01 |
| `Aether_01-The Journey II.mp3` | The Journey II | 01 |
| `Aether_01-The Journey III.mp3` | The Journey III | 01 |
| `Aether_02-Gravity.mp3` | Gravity | 02 |
| `Aether_03-Free Energy.mp3` | Free Energy | 03 |
| `Aether_04-Prana.mp3` | Prana | 04 |
| `Aether_05-Nexus.mp3` | Nexus | 05 |
| `Aether_06-Polaris.mp3` | Polaris | 06 |
| `Aether_07-Conduit.mp3` | Conduit | 07 |
| `Aether_08_Peace.mp3` | Peace | 08 |
| `Aether_10_Aether.mp3` | Aether | 10 |
| `Aether_11_Starlight.mp3` | Starlight | 11 |

There is no `Aether_09...` source recording currently in the repository. The three different Journey recordings deliberately share `01` in the current catalog generator, which explicitly documents those three as separate files and track numbers as ordering hints. **This audit does not authorize inventing Track 09, reassigning an existing recording to number 09, or changing the intended album sequence without the artist's tracklist.**

## Published catalog and Back Room
- `radio/manifest.json`, `radio/track-durations.json`, `support/catalog.json`, and `config/site-live.json`'s STORE and PLAYER path lists include all 12 current recordings.
- AETHER appears in FRONT and STORE album lists.
- Back Room `radioMasterSongPaths` includes only 10 AETHER recordings. `Aether_10_Aether.mp3` and `Aether_11_Starlight.mp3` are excluded from RADIO rotation, *not* from the MUSIC album. Changing this is a distinct broadcast approval decision.
- `support/catalog.json` currently marks AETHER `partial: true`, a preview-only release setting. Do not silently change to a complete sale-ready product until the owner approves the tracklist and delivery rights.
- Existing playlist/Vault/offline records reference precise song paths. A physical file rename requires coordinated updates and a durable compatibility strategy, including server-side assigned access-code paths, saved user/Vault playlists, media caches, metadata manifests, and current Back Room routing. Renaming files in isolation could make purchased, assigned, or downloaded tracks unreachable.

## Player, styling and tests
- The current MUSIC album list is generated from the canonical manifest and PLAYER path assignment, not from the frozen RADIO autoplay approval snapshot.
- `radio/ge-music-v5.js` renders MUSIC inside a Shadow DOM. Site-level Radio CSS files do not override its song list directly.
- The only AETHER-specific CSS in MUSIC affects album-cover brightness/contrast; it does not hide album tracks.
- Removed an obsolete `radio/index.html` special case that translated deleted `Aether_11_Countdown to the Droid Army` to `PEACE!` rather than using the normal parser.
- The iPhone browser regression verifies AETHER's 12 titles in order and that Starlight is reachable by scrolling. The test's outdated version and obsolete selection-control expectations were brought into agreement with the current MUSIC screen.

## Stale supporting records to reconcile separately
- `radio/approved-autoplay.json` contains 4 retired AETHER paths from the frozen default autoplay snapshot. Its own release contract explicitly prohibits automatically replacing those approvals; these are **not** the MUSIC album list.
- `radio/loudness.json` includes a retired `Aether_08-Aether.mp3` entry and lacks current Peace, Aether, and Starlight entries; the Prana metadata is for an older audio blob. Recompute with the authorized analysis workflow, **not invented loudness values**. This is a metadata repair, not evidence that audio files are missing.

## Next safe content decision
Artist must verify the intended track 09 title/audio and whether Journey I, II, III are one composite numbered track or three separately numbered album tracks. Do not change MP3 filenames or Back Room approvals until this is resolved. Once supplied, migrate references in one reviewed release and regenerate metadata from the actual masters.
