# Grand Element Radio — Confirmed working iPhone baseline

**Date confirmed by site owner:** October 25, 2026

## User-confirmed results

- RADIO is playing on iPhone.
- MUSIC player is playing on iPhone.
- Scrolling is working on iPhone.

**Status:** All three were explicitly reported working by the site owner after the latest round of iPhone fixes.

## Preserve this behavior

These are known-good user-visible functions. Do not regress them while changing the radio, music browsing, transport controls, playlists, Gate, or website layout.

Before changes to relevant code:
1. Preserve working RADIO playback on iPhone.
2. Preserve working MUSIC playback on iPhone.
3. Preserve working scroll behavior on iPhone.
4. Preserve existing Bangers playlist, music catalog, and navigation.
5. Verify all three on iPhone following deployments when possible.

## Reference

The previous MUSIC playback change removed an explicit `audio.load()` call immediately before gesture-bound `audio.play()` in `radio/preview-lab.html`, committed as `76af19fe35dcf3487a08b19e647b0b0380eff1f9`.

This note records the owner's confirmation. It does not assert that a particular commit alone caused the successful behavior.

**Important:** This file is documentation only. Do not modify working runtime settings based solely on this note.

## Public MUSIC privacy and controls — October 27, 2026

Mandatory owner requirements:
- MUSIC button is **bright blue**; do not replace its established blue gradient/glow.
- RADIO button is the **red double-heartbeat** (lub-dub) visual.
- In public MUSIC search and rows, show **SONG TITLE — ALBUM** on one line.
- **NEVER show total song counts** in public Radio/MUSIC screens, cards, playlists, offline notices or accessibility labels. Internal calculations may still need counts to function.
- Use **subtle distinct album colors** consistent with the GE home website, while keeping song text readable.
- Keep **ALBUMS immediately next to ALL SONGS** in the MUSIC category controls.
- The public MUSIC selector must never link to **MANAGE GE PLAYLISTS** or the **Back Room**. GE master playlists and access-code administration are owner-only.
- Clicking PLAY in MUSIC should start the selected recording on iPhone; if rejected, show the actual user-visible error.
- Preserve the known-good RADIO playback, MUSIC playback, scrolling and Bangers program; avoid unrelated cleanup.

Security caveats:
- Hiding Back Room links is not access control; Back Room management must require server-side authentication.
- The current public music manifest/repository can reveal its entries to someone who inspects raw data even if count labels are removed. A private backend catalog would be needed for stronger collection-size confidentiality.

Code changes on 2026-10-27 touched radio/ge-music-v5.js, radio/preview-lab.html, radio/index.html and backroom/index.html. These are committed code changes, not proof of live iPhone validation.
