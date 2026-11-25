# Grand Element Radio OFFLINE · unified clean rebuild

## System ownership

- One existing Radio player, not a second audio transport.
- One existing MUSIC workspace with four actions: ALL MUSIC, CHECKED SONGS, PLAYLIST, UPDATE MISSING. The front Radio OFFLINE button is merely a shortcut into that same MUSIC screen.
- One replacement offline manager at radio/offline-manager.js. Responsible for explicit authorized downloads, retry, stop, non-destructive selection union, catalog validation, and song/station verification.
- One replacement service worker at radio/sw.js. Responsible for atomic offline shell installation, essential graphics, cached start, local media playback and byte ranges.
- No new Cloudflare storage; no new backend, catalog, access-code system, or paid content infrastructure. All existing songs use their published URLs.
- Existing ge-radio-media-v4 downloads and localStorage playlist/access/selection keys must be preserved. No destructive cache or localStorage clearing.

## Offline completeness

A READY state requires: installed updated service worker; verified saved Radio index; script/style catalog startup files; all essential album covers, logo and default visual background; the selected authorized recording set; the station ID audio set; and the saved activation. A partial download never claims READY. A device may have a working partial set of recordings even while displaying PARTIAL.

All 55 decorative animated backgrounds are intentionally excluded from the auto-download package. Only the default background is required.

## Listener display privacy

The OFFLINE download UI shows only status, percent, estimated time remaining and a progress bar. No total file counts, song counts, failed file counts or filenames in progress/status text. Percent remains at or below 99% until verification succeeds. Internal diagnostic objects may include missing paths but do not print them in MUSIC.

This is only UI privacy; it is not a claim the public GitHub music inventory is confidential.

## Device acceptance test

1. On an iPhone, open the installed GE Radio Home Screen app with Wi-Fi on. Tap Radio OFFLINE. Confirm it opens MUSIC's same OFFLINE panel.
2. Enter a code that authorizes OFFLINE. Choose CHECKED SONGS. Download. Confirm percent, ETA and progress bar, without filename/track counts.
3. Confirm the screen says READY only after verification and that a selected recording plays and NEXT advances.
4. Close the app completely, switch Airplane Mode on, launch the same Home Screen icon. Confirm Radio opens without a network delay and plays the cached recording. Check album art, next, station IDs, seeking and SUN LAB SPECTRUM/WATERFALL.
5. Reconnect Wi-Fi. Choose ALL MUSIC or PLAYLIST, download. Interrupt with STOP, verify PARTIAL and previously saved songs remain. Choose UPDATE MISSING and verify it resumes without re-downloading existing songs.
6. Expire/revoke the code and confirm no new downloads can begin; the already saved recordings must remain usable offline.
7. If any step fails, do not declare production READY; preserve the current live version and diagnostics.

Automated Node/worker tests certify design invariants only. They cannot certify storage quota/eviction or a physical iPhone's Airplane Mode launch.
