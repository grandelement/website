# GE Studios — Vault, Back Room and Gate authority

## Permanent project architecture

**GE Vault is the foundation and source of truth.** The Back Room is the owner control surface, not the storage destination for ordinary visitors.

```
EVERY PUBLIC SURFACE (website, radio, game, music, shop, QR, etc.)
  ├─ Visitor/fan events ─────────────────> GE Vault (permanent D1 and event APIs)
  └─ Content requests and Gate entry ───> Vault server-side policy enforcement

OWNER / BACK ROOM
  ├─ Read saved records ────────────────> GE Vault
  ├─ Save access codes, scopes, song assignments, expiration and policy
  │                                      └─> GE Vault
  └─ Publish general site settings ─────> Configuration pipeline / Vault where applicable
```

Rules:
1. Track public visitor sessions, page views and supported interactions directly to Vault regardless of whether a code is entered. Failed transmissions must not be called saved; privacy and consent requirements still apply.
2. The Back Room manages access permissions and site settings; it is not a relay or gatekeeper for collecting visitor events.
3. A Radio Gate code must be authenticated by the Vault; it cannot rely on the hardcoded historical `LOVE` browser flag, a code label, or a fabricated success response.
4. The Gate must accept *all* issued, active Back Room/Vault code secrets, subject to each code's scope, song assignments, expiration, revocation and use limits. Radio-only is not all-website access.
5. **Love (album)** is a separate music catalog entry and must not be edited by any access-code migration. **LOVE (historic access code)** is a distinct D1 access record; preserve its original issued credential and owner-managed controls.
6. Access-code records must be durable and listable/editable on the Back Room by the owner. Never silently replace another saved code or its playlist.
7. Browser session data is UI state, not payment-grade authorization. Any protected resource must be verified server-side against D1, including permission and revocation checks.
8. Recording should be supported on every public surface, but a browser-side successful attempt alone is not proof that a particular event is stored in D1.

## Current integration and limits (October 27, 2026)

- `ge-vault-client.js` posts baseline sessions and page views directly to `https://vault.grandelement.com/v1/public/event`.
- `radio/index.html` posts entered Gate code secrets to `/v1/public/access/redeem`, and shares a temporary scoped UI receipt for the homepage.
- `radio/ge-home-gate-stop.js` no longer uses the historical LOVE local flag; it honors only website/music/album scopes from the temporary receipt or the separate private local owner demo.
- The Vault D1 access records and Back Room editor are implemented in `vault-worker/src/index.js` and `backroom/index.html`. Production table readiness, the saved LOVE record, editor readback and live Cloudflare deployment require independent production verification.
- Temporary browser receipts are not signed authentication. The implementation must not present them as protected paid-content enforcement.


## Access Code forensic path and verification contract

Owner issue / edit / reveal / rotate:
`backroom/index.html` -> authenticated
`https://ge-backroom-publisher.grandelement.workers.dev/manage/access-codes`
-> `backroom/publisher-worker.js` (owner session and action allowlist)
-> private Cloudflare `GE_VAULT` service binding
-> `vault-worker/src/index.js` `/v1/admin/access-codes`
-> D1 `access_codes` + `access_code_content` + encrypted recoverable keys
-> owner GET readback of the **same record ID and assignments**.

Listener entry:
`radio/index.html` CODE -> public Vault `/v1/public/access/redeem`
-> D1 HMAC match + enabled / scope / expiry / usage / revocation checks
-> Radio Gate client session. Website UI may receive a scoped receipt,
but it is **not** a signed right to protected audio.

Playlist assignment:
GitHub `playlists/registry.json` (playlist catalog source)
-> owner selects saved playlist -> the exact track paths are snapshotted
into the D1 access-code content record -> Music-session verify checks the
actual allowed track paths. Merely showing a playlist label is not proof of
successful authorization or synchronized Bangers rotation.

Visitor telemetry (independent of Gate):
`ge-vault-client.js` -> Vault `/v1/public/event` -> D1 events.
Codes must never be required just to collect events; a client send attempt
is not proof of D1 persistence.

### Source defects corrected on October 27, 2026

- Publisher owner action allowlist omitted `reveal` and `rotate`,
  so existing Back Room buttons were rejected before reaching the Vault.
- A failed Back Room code-list GET previously set `codeRows=[]`,
  which made existing codes appear gone in the interface. Old verified
  in-memory rows now remain visible as **unverified**, without enabling saves.
- An unmatched code-name search previously invoked `saveCode(false)`
  immediately; now it opens an explicit draft pending a SAVE action.
- Editor repaint previously unconditionally hid the newly issued or
  rotated secret, even after a successful Vault write. A same-record
  refresh now preserves the secret display; a failed readback must not
  hide an issued key.

### Required production proof — do not mark completed without evidence

1. Confirm Vault `/health` reports `storage=READY` and
   `access_codes_ready=true`.
2. Confirm Publisher `/health` reports `configured`,
   `vault_service_bound`, `vault_reachable`,
   `vault_access_codes_ready` and `access_codes_bridge_configured`.
3. Confirm Publisher `/health?diagnose=access-codes` reports
   `access_codes_readable=true` and `upstream_http_status=200`.
4. Through an authenticated Back Room session, retrieve the D1 list,
   confirm the historic LOVE **code record** without confusing it with
   the album, and reconcile earlier issued records without overwriting
   or revoking any of them.
5. Issue one controlled, new test code; capture its D1 ID and secret;
   reload the page, load the *same ID* and verify scopes / expiry /
   playlist IDs / exact tracks survive. Do not make a second code when
   a readback fails.
6. Verify owner-only reveal and rotate from Back Room, and anonymous
   denial, then verify the rotated key belongs to the same D1 ID.
7. Redeem the authorized test secret through the public Radio Gate and
   verify the expected entitlement while an invalid/revoked secret is
   rejected. For music restrictions, verify an allowed real track and
   a denied unassigned track using the Music-session endpoint.
8. Confirm a real page event and radio entry event reached D1 rather
   than merely being queued in the browser.
9. Confirm Cloudflare Pages/Workers have deployed the tested commit and
   check the real iPhone/desktop experience; passing repository tests
   **is not** a completed live deployment.

**Preserve existing LOVE album, original LOVE access credential,
fan/event data, Bangers playlist and all existing saved code IDs.
Never erase or reconstruct production records merely because a client
refresh fails.**


## October 27, 2026: ground-zero Radio Gate + playlist trace

**Source-verified fault sequence (the first failing connection was NOT the
original LOVE album):**

1. Back Room MUSIC saves named GE playlists into GitHub
   `playlists/registry.json` through `/manage/github-playlists`.
   The current Test 2 record is **unlisted with seven tracks**: it is meant
   for an owner-assigned access code, not anonymous public browsing.
2. Back Room ACCESS CODES saves each code into the Vault D1
   `access_codes` and `access_code_content` tables through Publisher.
   Each selected playlist is converted into an explicit song-path snapshot.
   Failure to see a code after a GET failure was a UI bug, not proof
   that D1 deleted the code.
3. Radio Gate previously sent `{code,scope:"radio"}` to the Vault but
   discarded the saved track assignments. Radio-only codes with explicitly
   saved tracks were also rejected by the separate Music-session endpoint.
   As a result, entering a valid Radio code did not load its songs.
4. Radio Music V5 could redeem a separate Music code, but was not notified
   when Radio Gate had already redeemed the same code. That would consume
   a second use, a particularly serious bug with `max_uses:1`.
5. The embedded `radio/preview-lab.html` still hardcoded lowercase
   `love` as its only Gate key and set a local owner-demo flag.
   It also obtained public playlists from an older, unrelated D1
   playlist endpoint while the newer Back Room used GitHub.
6. Radio 1/2 **broadcast** playlists (BLITZ Bangers) are NOT personal
   access-code playlists. A code can assign private listener tracks
   without changing every other listener's shared broadcast.

**Source changes:**

- `vault-worker/src/index.js` generates a short-lived signed Music
  token and the exact allowed song snapshot alongside a successful
  Radio redemption. The D1 `use_count` updates once; independent
  Music verification never consumes another redemption.
- Radio-only codes explicitly assigned a nonempty track snapshot
  permit ONLY those tracks in the personal Music player. A Radio-only
  code with no songs remains broadcast-only.
- `radio/index.html` saves the signed Music session in the same
  tab after successful Radio Gate entry.
- `radio/ge-music-v5.js` reads newly issued sessions and shows
  code-assigned songs in its ACCESS CODE view automatically.
- `radio/preview-lab.html` no longer accepts a hardcoded LOVE browser
  bypass for visitors; it redeems codes with Vault and verifies assigned
  tracks. Private owner downloads still require owner-preview status.
- The preview player and Music V5 now read public named playlists
  from the SAME GitHub registry; only `visibility:"published"` appears
  publicly. Unlisted names stay private, but their code-assigned songs
  can appear through a valid signed Vault session.
- `radio/sw.js` changed to v53, and Radio HTML cache keys were
  refreshed to prevent the old scripts persisting on iPhones.

**Verification achieved in this code-inspection session:**

- All changed JavaScript and inline page scripts passed V8 syntax
  parsing against the current GitHub source.
- Source paths and payloads were traced end-to-end.
- The actual `accessRedeem` function, invoked with a mock D1 record
  (Radio-only, one permitted song, `max_uses:1`), returned a signed
  restricted Music entitlement, refused a second redemption, and
  updated the mock use count once.
- Regression tests added in `tests/access-music-session.test.mjs`
  and `tests/ge-access-code-radio-chain.test.mjs`; workflow
  `.github/workflows/ge-access-code-radio-chain.yml`.
  An added workflow is not proof that it passed in production.

**Evidence still missing:**

- Production D1 table state and the real current LOVE/Test Access
  record IDs, hashes, scopes and assigned track paths.
- Live Cloudflare Publisher-to-Vault bridge authentication and deployment.
- CI run conclusion and live iPhone/desktop acceptance test after deployment.
- Exact Radio 2/Bangers program synchronization and listener audio
  are independent and have NOT been certified by this Access Codes fix.
- Full-length audio is still hosted at publicly reachable static paths;
  client UI receipts are not a secure paywall. Serving paid downloads
  requires protected server-side delivery, not just a JavaScript code check.

**Required live acceptance test:**

1. In the authenticated Back Room, Refresh GitHub playlists. Confirm
   Test 2 and seven exact track paths.
2. Refresh Access Codes and inspect the original LOVE record without
   recreating it. Select the existing desired test code and confirm its
   real D1 ID, enabled state, Radio scope, playlist ID and seven tracks.
3. Save changes once, read back the same code ID, and confirm every
   playlist/track assignment persisted. Do NOT issue another code as a
   response to a failed read.
4. In a fresh Radio tab, enter the ACTUAL secret, not the code label.
   Confirm one Vault Radio redemption, open MUSIC, see seven assigned songs,
   and play an allowed song while a different song is denied. Confirm the
   max-use counter increases only once.
5. Reload in another browser/phone and inspect a Vault read and Radio
   access: use existing code with its true expiration/usage policy, not
   a browser flag. Confirm suspended/revoked code is rejected.
6. Inspect Cloudflare deployment versions, Worker health, GitHub Actions
   conclusions, PWA cache version, and event persistence in D1. No
   claim of complete release before these checks are observed.
