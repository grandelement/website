# RADIO 23 — Repair ledger (2026-10-23)

This is the carry-forward checklist for the Grand Element Radio website. Preserve decisions from the END of Radio 22 and the user's Radio 23 corrections. Do not treat older contradictory proposals as current.

## Protected / do not touch
- BANGERS is **just a saved playlist** in the original GE DJ Booth. Do not rename it, replace it, change its contents, or treat it as a separate station/product/architecture.
- Preserve the running BLITZ Radio 1 build. No BLITZ rebuild before November 1, 2026.
- Preserve the single DJ Booth playlist database and the Radio 2 fallback arrangement unless explicitly changed by the owner.
- Keep site operations $0; no paid services required for these repairs.
- Radio listener codes are NOT owner, DJ, purchasing or downloadable music entitlements. Do not advertise paid downloads until there is real server verification.

## Functional controls
- [x] SHUFFLE stops invoking MUSIC; it toggles the personal playback setting and never changes the shared station.
- [x] CONTACT opens an on-page address/copy/email panel even when no email app is registered.
- [x] CODE allows radio-only holders to enter an additional owner code and reports unlocked owner status; doesn't falsely promise purchases.
- [x] Owner's offline button is no longer permanently hidden by a later unconditional CSS rule.
- [x] PLAY ALBUM appears on every album tile, using the existing sequential album player; existing per-song PLAY remains available.
- [x] Owner-only SAVE ALBUM OFFLINE caches the chosen album in the existing radio media cache. This is **not** a ZIP download or a payment entitlement.
- [ ] Verify all player, background, ship transport and utility buttons using real iPhone portrait / landscape touch events and mouse/keyboard.
- [ ] Confirm actual downloaded/offline playback in iOS PWA, including cache/storage behavior. Genuine purchased album ZIP/download delivery is **not** implemented: the support store currently labels payments and downloads as preview only.
- [ ] Confirm Gate 33:33, CODE redemption, owner access, expiry, iPhone native playback and media session end-to-end.

## Ship artwork / EQ — not yet visually verified
- [ ] Examine the actual radio/cockpit-landscape.png *pixels* or a user-supplied accurate full-resolution screenshot before placing any new ship EQ overlays. **The existing image already depicts angled dashboard EQ meters.** Do not create new bars at a conflicting slope or misaligned x/y location.
- [ ] Align responsive ship buttons to the slots **drawn in the actual artwork**, on its fixed 1672:941 aspect-ratio stage. Both side rails start NEXT then PREV; portrait uses Player View only.
- [ ] Drive the image's EQ presentation from the same music/audio levels used by the Blue Sun EQ, or clearly indicate a motion approximation where Safari analysis is unavailable; do not claim synthetic oscillations are sampled audio.
- [ ] Tapping the existing ship EQ hotspot should reveal the existing Blue Sun-style reactive aura **around the selected meter**. The aura should evolve with zoom/dream-state controls, not spawn an unrelated tilted meter over the dashboard.
- [ ] Validate iPhone/desktop ship image geometry and meter behavior with screenshots of both orientations and real playback.

## Prior Radio 22 requirements still in force
- MUSIC can browse without stopping live Radio; choosing to PLAY a song is the explicit handoff.
- MUSIC scrolls the complete catalog: Singles, Aether, Fire, Spirit, Soul, Love, Intergy, Sessions II, Sessions I, Live, Trio, Fundamental Groove.
- PLAYLISTS remains based on original authenticated DJ records and private personal lists.
- Back Room settings cover Radio-approved song paths, Welcome, About, Moon, seven Games, high scores, access codes, and presets.
- Existing selected track upload replacements update by path without wiping playlists or authorizations.
- Stop proving bugs fixed from source inspection alone: require regression checks + deployment + actual handset verification.

## Delivery
- Branch: fix/radio23-player-controls-albums-eq-20261023
- Changes must pass automated checks before merge; passing GitHub checks does not by itself prove the live Cloudflare or iPhone experience.
