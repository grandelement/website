# GE RADIO / MUSIC — PROTECTED WORKING STANDARD
Status: protected baseline established 2026-10-28
Scope: Grand Element home, Radio 1 / Radio 2, GE Music library, playlists, Gate and Back Room integration.

## Change control — read before every edit
This file is a feature preservation contract, not permission to redesign the interface.
Only change the subsystem requested, with the smallest diff possible. Before editing:
1. Retrieve CURRENT main commit and existing source, compare to last working changes. A parallel GE Vault or Back Room thread may have made newer updates.
2. Record existing controls/features touched by the change. Keep their selectors, behavior, state transitions and existing saved data.
3. Make one focused change. Do not modify or re-create published playlists, access codes, fan records or radio media unless explicitly requested.
4. Run `node tests/ge-radio-standard-guard.test.mjs` and the existing GE Radio Music / Access / Safari tests. Fail means BLOCK deployment or revert only the offending change.
5. Verify both mobile Safari and desktop, RADIO placeholder before audio / verified connected red dimmer heartbeat with one-tap solid acknowledgement, Music SONGS and PLAYLISTS, loaded playlist ordering, each play control, and Gate enforcement.
6. Do not describe a live deployment or end-to-end success until the actual production workflow and browser verification succeed.

## Mandatory Music interface
- The Radio MUSIC button opens the normal MUSIC window, default SONGS with both SONGS and PLAYLISTS visible at the top. A previous Arrange session may not suppress these tabs on reopen.
- SONGS lists all published tracks/album groups and their checkboxes and individual PLAY buttons.
- PLAYLISTS and LOAD remain navigable. LOAD opens one modal with GE PLAYLISTS and USER PLAYLISTS, one selected item and LOAD SELECTED. LOAD never deletes saved playlists.
- Playlist name is editable beside LOAD and SAVE. Changing a name must not silently overwrite an unrelated GE playlist.
- ARRANGE remains usable: checked songs in current order; UP and DOWN arrow buttons; touch long press on a song row and slide to reorder; desktop drag-and-drop. The selected track order is maintained until explicitly changed.
- A top ARRANGE PLAY button starts the current ordered playlist in the actual Music player, displays its name/queue, and obeys the Gate. Do not destroy the order or claim to save it on PLAY.
- Footer CLEAR, ARRANGE and PLAY controls remain accessible, including when arranging. ACCESS CODE toggle stays purple and collapsible.
- Preserved controls are NOT removed as a side effect of another change. No duplicate BUY buttons inside Music; store/gate/payment flows are separate.

## Mandatory Radio behaviors
- **Updated October 28 visual requirement (latest instruction supersedes the earlier contained-only heartbeat):** Before verified forward progress of the native Radio 1/2 audio, the RADIO button location is a transparent empty slot without text, color, outline, or glow. It does not block unrelated transport. On verified audible progress, the same RADIO button fades into view and the **entire button** breathes red with a smooth two-beat dimmer envelope (0 to 10 on first beat, back down, a smaller second rise, and a smooth decline to zero). Use the existing Fire-era red album palette and a restrained outward red glow; do not scale or flash adjacent controls. On the first listener tap **after connection**, stop the animation and leave a steady red RADIO button. Reset the acknowledgement when connection is lost. Honor reduced-motion preferences. Implemented in `#ge-radio-connected-red-dimmer-20261028` and `updateRadioStartupCue` in `radio/index.html` without removing older styles or connection logic.
- **Connection message visibility:** Keep `setLiveStatus()` and Radio 1 / Radio 2 connecting, connected, retry and failure states intact for diagnostics and future UI. The former black `#liveStatus` banner is **temporarily hidden** on screen. Its underlying wrap and content-sized width CSS must be corrected and preserved so it can be re-enabled without stretching across the player. Do not replace it with the obsolete backup-rotation message. A connection can take the existing time windows; do not shorten the watchdog or replace authentic Radio 2 with a random playlist.

- Preserve Radio 1 primary and Radio 2 backup, their verified failover, BLITZ Bangers default, title, progress, transport, shuffle, clock and visualizer effects.
- Do not change the Blue Sun, planets, I AM studio, background selectors, responsive positioning, Ship controls, or screen rotation when editing the Music dialog.
- Preserve the existing radio preview Gate (33:33, 2013 seconds), verified access scopes and fan permissions. UI hiding is not an authorization mechanism.

## Mobile / Safari
- An ordinary iPhone Safari Mobile Website request uses responsive mobile viewport and controls. Safari's explicit Request Desktop Website or Mobile Website is the browser's choice; never silently force desktop on a normal iPhone UA.
- The two Safari states can have different UAs. A compact touchscreen advertising a Macintosh UA is not enough to distinguish a persistent Safari desktop-site preference from a one-time request. Do not claim otherwise or force a mode without a reversible user control.
- Changes must preserve portrait and landscape behavior. Test both iPhone mobile UA and iPhone Safari desktop UA and actual Safari if claiming live verification.

## Data / identity invariants
- Do NOT erase or overwrite `playlists/registry.json`. Bangers currently 33 songs, Johnb 15; preserve their IDs and order unless directly instructed.
- Published GE playlists are owner-managed master records; fan playlists are private Vault records; older local playlists remain identifiable. No silent local save or promotion to publisher.
- Only owner session may change GE master playlists. Fan data requires private per-fan credential; IP address is analytics only, never a reliable password.
- The Music catalog uses `radio/manifest.json` and `radio/track-durations.json`, not the playlist registry. Preserve the complete song library.
- Service worker UI shell can be rotated to load a fix; **never purge listener downloaded audio** stored in `ge-radio-media-v4`.

## Verification and rollback
- CI standard guard: `tests/ge-radio-standard-guard.test.mjs`; scheduled / push workflow: `.github/workflows/ge-radio-standard-guard.yml`.
- Existing coverage includes `tests/ge-unified-playlist-library.test.mjs`, `tests/ge-safari-layout-mode.test.mjs`, access-code Radio chain, Radio1/2 playback and website regression checks.
- The last pre-V7.1 interface checkpoint was `fd2b9fda16ed`; it is a comparison/rollback reference, not permission to revert newer Vault work.
- If a regression is discovered, fix the broken UI behavior with a targeted commit. Do not reset the entire repository, replace the playlist registry, delete access codes or overwrite parallel-thread work.
- Require this CI check for pull requests in GitHub repository Rulesets/branch protection to hard-block merges. Automated checks alone do NOT prevent direct pushes to main until this setting is enabled by a repository administrator.
