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
