# GE Studios Vault

GE Studios Vault is the permanent private data layer for Grand Element.

The GitHub repository contains only the schema and application code. **Do not put fan records, IP addresses, comments, passwords, API tokens, private instructions, or production exports in this repository.** The repository is public.

## What belongs in the Vault

- Fans: identities and contact details that people voluntarily provide.
- Listener events: anonymous/session listening activity, track and playlist context, referrer, user agent, coarse Cloudflare network/geographic metadata.
- Comments: messages left through GE websites or radio surfaces.
- Playlists: named playlists and exact track order.
- Permanent settings: values that should survive every website/backend deployment.
- Permanent locations: canonical song roots, URLs, API locations, mount points and other infrastructure references.
- Permanent instructions: stable operational rules that should not be rediscovered every time code changes.
- Audit history: administrative writes and deletions.

## Privacy model

Raw visitor IP addresses are stored only as AES-GCM encrypted ciphertext. A keyed HMAC hash is also stored so repeat activity can be grouped without exposing the IP during normal analytics.

Do not enrich anonymous visitors with scraped third-party personal information or attempt to identify people from an IP address. Store first-party information people provide and technical information needed to operate/measure GE services.

Cloudflare supplies request metadata such as country, region, city, timezone, ASN and colo through the Worker request context.

## Cloudflare setup

1. Create a D1 database named `ge-studios-vault`.
2. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.jsonc` with the database ID.
3. Apply `schema.sql` to the D1 database.
4. Create the Worker from this folder.
5. Bind D1 as `VAULT_DB`.
6. Add these as Cloudflare **Secrets**, never plaintext vars or Git files:
   - `VAULT_ADMIN_TOKEN`
   - `VAULT_INGEST_TOKEN`
   - `VAULT_HASH_KEY`
   - `VAULT_ENCRYPTION_KEY_B64`
7. `VAULT_ENCRYPTION_KEY_B64` must be a base64-encoded 32-byte random key.
8. Deploy the Worker behind a private GE hostname such as `vault.grandelement.com`.

Cloudflare D1 Time Travel provides point-in-time recovery. For retention beyond the Time Travel window, schedule an encrypted export to a separate backup location such as R2.

## API roles

### Admin token
Used by trusted GE administration code for:
- playlists
- permanent settings/locations/instructions
- fan/comment/listener review
- exports

Send:
`Authorization: Bearer <VAULT_ADMIN_TOKEN>`

### Ingest token
Used by trusted GE backend services to write listener events and comments.

Send:
`X-GE-Vault-Key: <VAULT_INGEST_TOKEN>`

Do not embed either token in public browser JavaScript.

## Important routes

- `GET /health`
- `POST /v1/ingest/listener`
- `POST /v1/ingest/comment`
- `GET|POST|PUT /v1/playlists`
- `DELETE /v1/playlists/:id`
- `GET|POST|PUT /v1/vault`
- `GET /v1/admin/summary`
- `GET /v1/admin/fans`
- `GET /v1/admin/comments`
- `GET /v1/admin/listeners`
- `GET /v1/admin/export`

## Permanent-value convention

Use `/v1/vault` with one of three kinds:

- `setting` — configuration values such as crossfade defaults.
- `location` — canonical URLs/paths such as song roots, stream URLs or storage locations.
- `instruction` — stable operational rules.

Each value has:
- `scope`
- `key`
- `locked`
- `sensitivity`
- `version`

A locked value cannot be replaced unless the write explicitly includes `force: true`. This is deliberate protection against accidental deploy-time overwrites.

## Example permanent records

These examples describe the intended keys only. Store actual private values through the authenticated API, not by committing them here.

- kind: `location`, scope: `music`, key: `song_root`
- kind: `location`, scope: `radio`, key: `public_stream`
- kind: `setting`, scope: `radio`, key: `default_crossfade_seconds`
- kind: `instruction`, scope: `radio`, key: `playlist_persistence_rule`
- kind: `instruction`, scope: `studio`, key: `live_owner_rule`

## Next integration step

Once the D1 database and Worker exist, configure Blitz with only the Vault URL and a server-side Vault credential. Then GE DJ playlist saves, listener activity, comments and permanent radio settings can write to Vault first and treat local container storage only as a cache.


## Radio Soul Reflections

The ship/universe public reflection wall uses:

- `GET /v1/public/reflections` — public read of visible Soul Reflections only.
- `POST /v1/public/reflections` — public create/update with strict field validation and per-network rate limiting.

This public response never returns IP addresses, IP hashes, email addresses, fan records, admin metadata, or private messages. The Worker stores network identity privately for abuse prevention and analytics.

The radio browser keeps a local copy as an offline fallback. D1 is the permanent shared master once the Vault Worker is deployed.


## Permanent Fan Data

Vault is the canonical long-term record for first-party GE fan relationships and site/radio interaction analytics.

### Append-first event ledger

Every meaningful interaction should create a new row in `fan_events`. Do not overwrite historic events. Normal application code has no delete route for fans, fan events, comments, or listener history.

Supported public browser telemetry includes:

- page/session views
- radio open/play/pause/stop
- track start/pause/resume/complete/skip/seek
- share sheet opened, share completed when observable, link copied, track shared
- offline enable/disable
- ship/gate/access interactions
- Soul Reflection and comment actions
- playlist views
- external-link clicks
- UTM/referrer attribution

The browser cannot reliably know whether a recipient actually received or forwarded something after the OS/native share sheet takes over. Record the share action we can observe, not an invented delivery result.

### Identity

Anonymous activity uses a random first-party `anon_id` and `session_id`. When a person voluntarily supplies an email/name/contact detail through a GE form, the trusted backend calls `POST /v1/ingest/fan` to create/update a fan record and link prior anonymous history.

Do not scrape email addresses, names, or other personal information from unrelated services or attempt to deanonymize visitors from an IP address.

### Protection

- D1 is the source of truth.
- Application deployments must never initialize D1 by replacing existing production tables.
- No ordinary DELETE endpoint exists for fans, fan events, comments, or listener history.
- Administrative corrections should use status/version fields and append audit records.
- Legal/privacy deletion requests, if required, must be handled as an explicit exceptional administrative process rather than through routine site code.
- Keep encrypted independent backups outside the running Worker/D1 deployment.

### Public event API

`POST /v1/public/event` accepts a tightly limited event vocabulary and records first-party interaction telemetry without exposing any secret to the browser.

### Trusted fan identity API

`POST /v1/ingest/fan` requires `VAULT_INGEST_TOKEN` and is for server-side forms/private-message workers to attach voluntary identity data to an anonymous visitor history.


## Permanent Fan Event Ledger

The Vault now treats fan/site interaction data as append-first records.

Public browser surfaces send first-party interaction events to:
- `POST /v1/public/event`

Examples:
- `page_view`
- `audio_play`, `audio_pause`, `audio_end`
- `track_share`
- `external_link`
- `radio_live`
- `game_start`, `game_complete`
- `gate_open`
- `comment_submit`
- `soul_reflection`

The Worker adds encrypted IP, stable keyed IP hash, coarse Cloudflare geography/network metadata, user agent and referrer. Browser code must not attempt to identify an anonymous person or scrape third-party personal data.

Email, name, phone or other contact data belongs in `fans` only when the person provides it through a first-party GE form or communication.

## Permanent Game Scores

- `GET /v1/public/game-scores` returns the public leaderboard fields only.
- `POST /v1/public/game-scores` saves or updates a score ID.
- Every score save also appends an immutable row to `game_score_versions`.
- There is intentionally no public or normal-admin delete route for game scores or score history.

The website should keep browser localStorage only as a cache/offline fallback. D1 is the permanent master.

## Deletion policy

Fan events, game score history and audit history are append-first and have no routine delete API. Moderation can hide a public comment without deleting its stored record. Any legally required data removal should be handled as an explicit administrative/privacy process rather than a normal site control.
