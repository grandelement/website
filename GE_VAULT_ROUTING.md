# GE STUDIOS VAULT — CANONICAL ROUTING INSTRUCTIONS

Status: PERMANENT ARCHITECTURE  
Source of truth for private fan/analytics data: **Cloudflare D1 / GE Studios Vault**. The **owner-approved GE playlist master** is the GitHub file `playlists/registry.json` (see `playlists/INTEGRATION_CONTRACT.md`).  
Canonical public event endpoint: `https://vault.grandelement.com/v1/public/event`  
Canonical public Soul Reflection endpoint: `https://vault.grandelement.com/v1/public/reflections`

## Rule 1 — Deployments never own permanent data

GitHub is the owner-approved permanent record **only for public/nonconfidential GE playlist definitions** at `playlists/registry.json`. GitHub Pages, Blitz containers, browser localStorage, service workers and phones are application/cache surfaces for private fan data; they must not hold the sole permanent fan record.

Permanent records belong in Vault first. Local copies may exist only as cache/offline recovery.

Never replace, clear, initialize, truncate or recreate production Vault data during a normal deployment.

## Rule 2 — Permanent fan data

Record meaningful first-party GE interactions in the append-first `fan_events` ledger:

- page/session views
- radio opens, play, pause, stop
- track start, pause, resume, complete, skip, seek
- track/share button use
- native share sheet opened
- successful copy-link action
- download/offline actions
- ship open and arrival
- gate open/unlock/access request
- Soul Reflection open/place
- comments/messages
- playlist views
- external-link clicks
- referrer and UTM attribution

The browser can record that a user invoked sharing. It generally cannot know whether another person actually received or forwarded the content after the OS/share service takes over. Store only the observable event.

## Rule 3 — Fan identities

Anonymous use is keyed by a random first-party `anon_id` plus per-tab/session `session_id`.

If someone voluntarily gives GE:
- email
- name
- phone
- contact request
- other first-party profile information

the trusted backend should call `POST /v1/ingest/fan` using the private `VAULT_INGEST_TOKEN`. Never place that token in public JavaScript.

Do not scrape identities from unrelated services, infer a person's identity from IP, or attach third-party personal information merely because it can be found online.

## Rule 4 — Comments and Soul Reflections

Radio Soul Reflections:
- WRITE: `POST /v1/public/reflections`
- READ: `GET /v1/public/reflections`
- Local browser copy remains only as offline fallback.

Private comments/messages:
- existing trusted private-message backend should forward the permanent copy to Vault.
- never expose Vault ingest/admin secrets to the browser.

## Rule 5 — Playlists and permanent configuration

**Playlist exception (supersedes older Vault-first instructions):** Owner-curated GE playlist names, stable IDs and ordered song paths belong in GitHub `playlists/registry.json`; Cloudflare D1 must not be a competing curated playlist master. Existing BLITZ live DJ/Radio Bangers remain on their controller until an explicitly tested integration. Private fan identities, playlists not approved for public disclosure, access codes, entitlements and analytics belong in an authenticated private backend, not in public GitHub. Permanent settings, locations and operational instructions continue to belong in Vault.

Use locked Vault values for infrastructure facts that should not change accidentally, including:
- music/song root
- stream URL
- cue URL
- Vault URL
- canonical site/radio URLs
- default crossfade
- live-audio ownership rules
- storage locations

Locked values require an intentional forced administrative replacement.

## Rule 6 — Retention / deletion protection

Normal website/radio code must have **no destructive path** for:
- fans
- fan events
- listener history
- comments
- Soul Reflections

Use append/update/status/audit behavior. Do not add routine delete buttons or deploy-time cleanup.

A legally required privacy deletion or an intentional administrator purge is an exceptional maintenance action and must never be triggered by ordinary application deployment.

## Rule 7 — Shared client

For browser analytics load:

`/ge-vault-client.js`

Then use:

`GEVault.website('page_view')`  
`GEVault.radio('track_start',{track_title:'...',album:'...'})`  
`GEVault.radio('share_track',{track_title:'...',share_target:'native-share'})`  
`GEVault.ship('ship_arrival')`

The client contains no secret.

## WEBSITE THREAD INSTRUCTIONS

1. Preserve all existing visuals and behavior.
2. Load `ge-vault-client.js`.
3. Send page views and meaningful interaction events to Vault.
4. Track share/copy actions as observable actions only.
5. Any email/contact form must continue its normal user-facing action and also have its trusted backend call `/v1/ingest/fan`.
6. Never store permanent fan/contact/comment data only in localStorage or a repo JSON file.
7. Never expose `VAULT_ADMIN_TOKEN`, `VAULT_INGEST_TOKEN`, `VAULT_HASH_KEY` or `VAULT_ENCRYPTION_KEY_B64`.

## RADIO THREAD INSTRUCTIONS

1. Preserve playback/Ship behavior.
2. Load `ge-vault-client.js`.
3. Track radio open/play/pause/stop, track lifecycle, skip/seek, share/copy, offline actions, Ship/gate events and playlist views.
4. Soul Reflections must read/write through `/v1/public/reflections`; browser localStorage is fallback only.
5. Private messages/access requests must be forwarded server-side into Vault.
6. Do not add a second permanent comment or analytics store.
7. Never expose Vault secrets to public radio JavaScript.

## DJ / STUDIO THREAD INSTRUCTIONS

DJ/Studio operational telemetry may use Vault, but performance-critical audio/control must never wait on Vault. Analytics writes are fire-and-forget and must not interrupt audio, mixer, playlist or DROP operation.

## Security boundary

This GitHub repository is public. Only code, schemas and non-secret endpoint names may be committed.

Actual fan records, IP data, emails, comments, tokens, encryption keys and private exports stay in private Cloudflare services.


## Rule 8 — Game scores are permanent

The game currently uses browser key `GE_GAME_SCORES_V3` as an offline/cache copy only.

Permanent scoreboard:
- READ: `GET /v1/public/game-scores`
- WRITE: `POST /v1/public/game-scores`
- Every save appends a permanent version to `game_score_versions`.
- Routine game reset controls may clear/rebuild the local cache but must never delete Vault game scores.
- New phones/browsers restore the leaderboard from Vault.

All future game modes must include `gameType` when saving a record so leaderboards can be segmented without losing the unified history.

## Rule 9 — QR acquisition follows the fan

The canonical QR entrance is `/qr/` and must load `ge-vault-client.js`.

Every QR entrance writes a `qr_scan` event to the Vault and keeps the same first-party `anon_id` as the visitor continues through the website and radio.

Supported first-party QR parameters:
- `c` — campaign or sticker batch, default `main-sticker`
- `qr` / `qid` — unique QR/sticker ID when desired
- `placement` / `p` — known physical placement or distribution area
- `variant` / `v` — artwork/print variant
- normal `utm_*` parameters

The browser preserves first-touch and latest-touch attribution locally and includes it with later Vault events. Cloudflare adds coarse network/geographic context at ingest time. Raw IP remains encrypted in Vault and is not exposed in normal analytics.

Do not create a second permanent QR analytics database. `fan_events` is the master acquisition and behavior ledger.

## Rule 10 — Music listening / usage records

The shared Vault client records actual media engagement using:
- `track_start`
- `track_pause`
- `track_resume`
- `track_progress` approximately every 30 seconds while actively playing
- `track_seek`
- `track_complete`
- `track_stop`

Each media session carries actual accumulated listening seconds, playback position, duration when known, completion percentage when known, anonymous fan/session IDs, acquisition attribution and Cloudflare geography.

For the continuous GE Radio stream, radio metadata changes split the continuous stream into individual song listening sessions.

Rights metadata fields are supported when known:
- `ascap_work_id`
- `iswc`
- `writer`
- `publisher`

Do not invent per-work rights identifiers. Populate those fields only from confirmed repertoire registrations.

Private reporting:
- `GET /v1/admin/analytics?days=N` summarizes QR acquisition, geography, fan sessions and music usage.
- The DJ backend proxies this report to its authenticated FANS dashboard.


## GE Music LOAD / SAVE / Fan association contract (October 28, 2026)

### Listener Music interface
- Music has a **LOAD** button, not an inline native playlist-selection arrow.
- LOAD opens a single dialog with **GE PLAYLISTS** and **USER PLAYLISTS** tabs. Selecting an item and pressing **LOAD SELECTED** replaces only the current working song selection/order; it does not delete saved playlists.
- The main playlist row has one editable playlist name, LOAD, and SAVE.
- **GE PLAYLISTS** includes owner-published GitHub playlist masters plus unlisted GE playlists explicitly authorized by the listener's Vault code. The GE playlist master remains `playlists/registry.json` with stable IDs. The Back Room exposes a PUBLIC checkbox per GE playlist. Unlisted in the Music UI **does not** make the publicly hosted GitHub registry confidential.
- **USER PLAYLISTS** reads fan-owned private D1 playlists via `/v1/public/fan-playlists` with an unguessable per-browser bearer credential. Legacy device-only mixes may be offered distinctly for transition, never silently presented as synced.
- SAVE updates an existing owner GE master only after authenticated Back Room authorization; otherwise SAVE creates/updates the listener's own private Fan Vault playlist. A new name creates a new fan playlist instead of overwriting the GE master. There is no implicit SAVE COPY.
- Playlist labels/categories are not licensing or payment rights. Playback still uses the independently enforced Music Gate (33:33 guest preview and server-verified scoped entitlements).

### Fan identity and access codes
- The browser's `GEVault.anonId` is the first-party anonymous analytics identifier; `sessionId` represents a session. The fan-playlist record may include the anonymous ID to connect owner-visible events and records.
- Saved fan records can be manually linked by the owner to a saved Vault access-code ID using `fan_code_links` via private `/v1/admin/fan-access` and Back Room `/manage/fan-access`. The Back Room Access editor contains a FANS category for this link. This is an administrative association, **not** independent verification that a code redeemer is that person.
- The owner-only fan-playlist list should display its anonymous visitor ID, any verified-in-Vault saved fan association, and that fan's assigned code, without revealing bearer secrets or public IP addresses.
- **IP address is not an account credential or reliable identity key.** IP changes, NAT, carrier routing and shared networks make linking on IP alone unsafe. IP/region observations remain analytics and investigative hints only.
- The current anonymous browser credential can recover playlists **in the same browser** after the 33:33 Gate expires and the listener returns or enters a code. It does not by itself permit cross-device restoration. Durable fan-account recovery needs a verified sign-in or separate recovery credential and an authenticated account-to-playlist binding. Access codes may grant music permissions but must not expose another listener's saved playlists.
- Do not state that a fan playlist is saved permanently until the private D1 POST and independent GET readback both succeed. Do not create silent device-only copies on Vault failure.
- Back Room FANS owner routes must remain admin-protected. Never expose `VAULT_ADMIN_TOKEN`, publisher session secret, or private fan bearer tokens in public playlists.

### Deployment coordination
- Music UI code: `radio/ge-music-v5.js` (the filename is historical; BUILD identifies the current UI). Radio loads it through `radio/index.html`.
- Master GE editor: `backroom/index.html` and owner Publisher Worker `backroom/publisher-worker.js`.
- Fan playlists: `vault-worker/src/index.js`, private D1 `fan_music_playlists`, `/v1/public/fan-playlists`, owner-only `/v1/admin/fan-playlists`.
- Regression: `tests/ge-unified-playlist-library.test.mjs` and Radio Music/Access Code chain tests.
- Worker deployment and live endpoint results must be separately checked; passing static tests or successfully invoking Wrangler does not itself prove authenticated fan saving or cross-device recovery.
