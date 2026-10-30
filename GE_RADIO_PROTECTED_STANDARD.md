# GE RADIO / MUSIC — PROTECTED WORKING STANDARD
Status: protected baseline established 2026-10-28
Scope: Grand Element home, public BLITZ Radio 1, stored Radio 2 infrastructure, GE Music library, playlists, Gate and Back Room integration.

## Change control — read before every edit
This file is a feature preservation contract, not permission to redesign the interface.
Only change the subsystem requested, with the smallest diff possible. Before editing:
1. Retrieve CURRENT main commit and existing source, compare to last working changes. A parallel GE Vault or Back Room thread may have made newer updates.
2. Record existing controls/features touched by the change. Keep their selectors, behavior, state transitions and existing saved data.
3. Make one focused change. Do not modify or re-create published playlists, access codes, fan records or radio media unless explicitly requested.
4. Run `node tests/ge-radio-standard-guard.test.mjs` and the current Radio1-only, Music / Access / Safari tests. Fail means BLOCK deployment or revert only the offending change.
5. Verify mobile Safari and desktop, visible neutral RADIO before verified playback / red double-beat only after progress, reconnect taps, Music SONGS and PLAYLISTS, loaded order, each play control, and Gate enforcement.
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

## Mandatory Radio behaviors (owner revision 2026-10-30)
- **BLITZ Radio 1 is the only public station.** Radio 2 is disabled in the listener, including error handling and retries. Do not substitute scheduled Radio 2 tracks or a personal playlist for the BLITZ stream. Preserve the old backup service configuration without activating it.
- **Connect as soon as visitors arrive.** The main homepage and Radio page both attempt Radio 1 automatically. Some browsers, particularly iPhone Safari, require a real tap for unmuted audio; when blocked, leave the same Radio 1 source ready and allow direct RADIO or PLAY retries. Never claim that a browser can be forced to allow audible autoplay.
- **RADIO visible while connecting:** The original RADIO button and its Ship proxy always display RADIO with the same dark and light text/border treatment as other controls. Never leave a transparent, blocked, or unclickable empty slot. Repeated taps can retry the same BLITZ stream; do not start a second source.
- **Connected heartbeat:** Only verified forward audio progress of the native BLITZ stream changes the RADIO button to red with the smooth two-beat 6.7-second heartbeat. Retain the Fire red palette, minimal outward glow, no scale change or adjacent animation, and reduced-motion support. The heartbeat persists while connected and resets on lost progress, pause or reconnect.
- **Connection diagnostics:** Keep `setLiveStatus()`, connecting, connected, retry and failure state messages intact, although the old black `#liveStatus` banner stays hidden. Its sizing and text wrapping remain correct for later reactivation. Keep the 115-second Radio 1 connection watchdog without shortening its existing cold-start window.
- Preserve Radio 1 title, progress, transport, shuffle, clock, visualizers, Bangers playlists, and Gate. Keep the Blue Sun, planets, I AM studio, responsive positioning, Ship controls, and screen rotation unchanged.
- Preserve the existing radio preview Gate (33:33, 2013 seconds), verified access scopes and fan permissions. UI hiding is not authorization.

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
- Existing coverage includes `tests/ge-unified-playlist-library.test.mjs`, `tests/ge-safari-layout-mode.test.mjs`, access-code Radio chain, Radio1-only playback and website regression checks.
- The last pre-V7.1 interface checkpoint was `fd2b9fda16ed`; it is a comparison/rollback reference, not permission to revert newer Vault work.
- If a regression is discovered, fix the broken UI behavior with a targeted commit. Do not reset the entire repository, replace the playlist registry, delete access codes or overwrite parallel-thread work.
- Require this CI check for pull requests in GitHub repository Rulesets/branch protection to hard-block merges. Automated checks alone do NOT prevent direct pushes to main until this setting is enabled by a repository administrator.
