# GE Studios — Unified Access & Fan Vault
Updated 2026-10-27. This document is the integration checklist and release contract.

## What the owner asked for

One GE Studios Vault architecture, with the Back Room as the owner editor.
- Source code, public curated playlist definitions and GitHub revision history are in `grandelement/website`.
- PRIVATE persistent Vault fan records, access credentials, assignments and analytics live in the SAME `ge-studios-vault` Cloudflare D1 database, deployed from the GitHub repository.
- The older BLITZ DJ controller and its separate storage remain operational until a measured, backed-up migration. No changes to running Bangers or the Radio 1/Radio 2 broadcast are authorized by an individual's code.
- The LOVE album and historic LOVE access credential are separate records. Never rename/delete the album or silently retire the credential.

### Unified Access UI

- [x] Existing Access Code picker, human-readable credential name, Save, Load, Delete stay in the Back Room.
- [x] Website section offers default-on Games and Dream State / Autopilot presentation switches, saved per access code in D1.
- [x] Radio section has optional *personal listening playlist* choice; the shared live broadcast does not change.
- [x] Music section retains multi-playlist assignments and an exact owner-arranged ordered song snapshot in D1.
- [x] Music customer view offers MY ORDER, BY ALBUM HISTORY and ASSIGNED PLAYLISTS while using the same allowed paths.
- [x] Playback queue supports Next/Previous in the chosen view order; each restricted song is rechecked by Vault.
- [x] Signed Radio Gate redemption carries music playlist IDs and song paths without redeeming a second time.
- [x] Simplified owner Fan subsection can read saved profiles, observe *recent event activity*, and associate a saved fan ID with an existing code ID using private owner credentials.
- [x] Fan/code assignments and per-code site settings have additive D1 table definitions. Existing fan records, codes and playlist histories are not reset.
- [ ] Confirm the D1 migration ran against the production database, Publisher has the full `VAULT_ADMIN_TOKEN` for fan management, and the latest Workers are live.
- [ ] Confirm live owner Save -> Vault readback -> Radio Gate redeem -> Music queue on iPhone and desktop.
- [ ] Confirm the accepted Track order and version matches the current GitHub playlist definition and the saved code's snapshot.
- [ ] Confirm fan/code assignment survives reload, does not leak fan identities to public browsers, and owner labels are not represented as verified identities.
- [x] Back Room owner can select a recent anonymized visitor and save an owner label through the existing Vault fan-label handler (code complete; live device read/write unverified).
- [ ] Authenticated customer accounts / explicit consent before automatic cross-device person-to-session linkage. A name or IP cannot establish identity.
- [ ] Accurate online presence heartbeat if desired; current owner list is recent events within two minutes, not a live socket.
- [ ] Optional time-limited abuse-control/IP restrictions with safeguards for shared or changing IPs, privacy notices, and appeal/unblock; do NOT use IP as a unique fan identity.
- [ ] Move audio to server-authorized delivery before charging for downloads/full tracks. Public GitHub MP3 paths are not secured by a JavaScript access view.
- [ ] Migrate original BLITZ DJ playlist IDs, revision and ordered tracks through an owner-verified import only after taking full backups and lifting existing deployment constraints.
- [ ] Fan-specific personal playlist editing/persistence across devices, beyond current owner-curated codes.
- [ ] Security review of user-chosen short credentials, login/rate limiting, revocation propagation, event privacy and authorization for individual games.
- [ ] Production CI checks and Cloudflare action status. Source syntax or a GitHub commit is not deployment proof.

### UX choice

Recommended navigation: **ACCESS → Website / Radio / Music / Fans**. The Fans selector is a second way into the same code assignment, never a competing second playlist editor.

Alternate 1: Fan-first CRM table (name, last activity, code, mix). It is useful for dozens of repeat visitors but cumbersome on a phone.
Alternate 2: A New Experience wizard (Fan -> Code -> Website -> Radio -> Music -> Review). It is easier for issuing a single code but slower for repeated editing.
Keep the recommended one-page accordion as the default and consider a wizard later.

### Functional contract

1. A playlist has a stable GitHub registry ID, name and ordered real song paths. `unlisted` entries are excluded from public browse but remain discoverable in the public repository. No confidential fan/customer data or secrets may be written to GitHub.
2. A code is a private D1 access-code record with a hashed/recoverable secret, scope, expiration, revocation, permitted playlist IDs and frozen ordered track paths. Different code labels do not prove different secrets.
3. Experience flags apply to visitors who successfully redeem a code granting **website** scope. The current game/autopilot settings are UI-presentation choices, **not server-enforced game authorization**.
4. A fan-code link is an owner administrative association only. It does NOT automatically authenticate that fan's browser or reveal the private code. The person must still present the actual code unless a future verified-account login is added.
5. A Radio-only access code may unlock the shared broadcast; if the same code has explicit saved song paths, its signed personal Music token permits those tracks only.
6. A code's personal Radio playlist is only an initial Music selection, never a global switch of Radio 1/2 or the original DJ Booth's Bangers.
7. Visitor events continue directly into the private Vault without requiring a code, subject to the user's privacy choices and applicable law.
8. Existing BLOITZ/BLITZ v167, Radio 1 stream, Radio 2 clock, owner DJ credentials, and existing fan-code histories are preserved. An owner credential is not interchangeable with a fan access code.
9. The Back Room publisher-to-Vault service binding and token protections remain necessary; removing these passwords from the public interface must never remove owner-side authentication.

### Production check sequence (required)

1. Obtain a backup/export of current Vault D1 and genuine BLITZ DJ playlists (including Bangers).
2. Deploy the Vault Worker and safely apply additive migration, verify `/health`.
3. Deploy the Back Room Publisher with current binding and owner secrets. Confirm `/health?diagnose=access-codes`.
4. In the Back Room, reopen original LOVE, Test 1, Test 2, Test 3, compare real record IDs, code hints, scopes, song order, and any custom short code; never issue duplicates to make failed reads disappear.
5. Save Website Games/Autopilot options and a personal Radio playlist on an EXISTING chosen test code. Reload and check byte-for-byte D1 readback of settings and song order.
6. Enter that actual code into Radio, verify allowed Music track list/order and album-history view, and verify unauthorized song playback and expiry/revocation fail.
7. Identify a previously labeled fan record, assign its code in the owner-only Fans panel, reload and verify the same fan_id and code_id relationship. Check anonymous recent events are not mislabeled as real identities.
8. Verify the shared BLITZ Radio/Bangers live stream and Radio 2 remain unchanged, the iPhone PWA refreshes, and owner analytics log observable fan/listener events.
9. If live deployment, Cloudflare security, tests, or signed media permissions are unavailable, leave status **NOT VERIFIED**; never represent a code as secure paid access.

*This checklist does not assert that any live environment was tested or deployed.*
