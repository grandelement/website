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
