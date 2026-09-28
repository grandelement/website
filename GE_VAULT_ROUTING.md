# GE STUDIOS VAULT — CANONICAL ROUTING INSTRUCTIONS

Status: PERMANENT ARCHITECTURE  
Source of truth for durable GE data: **Cloudflare D1 / GE Studios Vault**  
Canonical public event endpoint: `https://vault.grandelement.com/v1/public/event`  
Canonical public Soul Reflection endpoint: `https://vault.grandelement.com/v1/public/reflections`

## Rule 1 — Deployments never own permanent data

GitHub, GitHub Pages, Blitz containers, browser localStorage, service workers and phones are application/cache surfaces. They are **not** the permanent record.

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

Named playlists, track order, active playlist, permanent settings, permanent locations and permanent operational instructions belong in Vault.

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
