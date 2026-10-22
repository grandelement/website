# GE Website — Access Codes Architecture
Updated: 2026-10-22

## Owner interface
- GE Website Back Room > ACCESS CODES opens as a **collapsed accordion**, never a permanently expanded wall of controls.
- Inside the accordion, **Issued Codes** displays exactly one selected code at a time. Search, previous/next, and a select menu let the owner review assignments.
- **New Access Code** opens one editor divided into: (1) permissions, (2) music assignments, (3) expiration/limits.
- **Edit Code** reuses the same editor, retains the secret and existing redemption count, and can update the label, scopes, expiry, limits, assigned Vault playlist and individual GE catalog songs.
- **Suspend / Activate / Revoke / Delete** apply to the selected code only. Delete **archives and permanently disables** the code, preserving audit history. Revoked codes cannot be edited or reactivated.
- New plaintext codes are returned **only once**. Existing code cards reveal only the last four characters, not the secret.

## Data ownership
- Cloudflare D1 (GE Studios Vault) is authoritative. Never store issued access codes, private tokens, or their assignments in GitHub or localStorage.
- `access_codes` retains secret HMAC, scope, expiry, redemption count, revocation and metadata.
- `access_code_content` stores `playlist_ids_json` and `track_paths_json`. Existing codes default to unrestricted song/playlist metadata if no assignment row exists.
- `access_code_deletions` is a tombstone table. Archived codes are excluded from owner listings and cannot redeem.
- Playlist selection references a **Vault playlist ID**, not a BLITZ queue ID. A separately assigned song references a relative path from `ge-music/music/`.
- A redemption bound to specific music requires a matching `playlist_id` or `track_path` from the trusted media context. Merely presenting a code is insufficient to grant broad music access.

## Boundaries still outstanding
1. The new D1 migration must run against the **existing production database** before deploying the new Vault Worker; never drop old tables.
2. Deploy the updated Vault Worker, then Back Room publisher Worker with its private `VAULT_ADMIN_TOKEN` secret.
3. Public Radio Gate, website album and music players still need server-verified entitlement/session integration. The owner UI and Vault redemption primitive alone **do not unlock public playback**.
4. The current `first_use` duration is measured from the **first redemption of the code overall**, not individually for each distinct recipient. Genuine per-recipient timers require separate recipient identity/entitlement records.
5. Selecting an active Vault playlist does not control BLITZ Radio 1's live queue. The authenticated GE DJ Booth remains operational source of truth; Bangers synchronization with Radio 2 is a separate workflow.

## QA
- `tests/backroom-admin.test.mjs` checks syntax, the collapsed UI, selector/editor controls, service routes and database schemas.
- `.github/workflows/backroom-admin-qa.yml` validates SQL schema and repeatable migration on pushes.
- Before production use, perform an authenticated device test: create > copy code > assign playlist and song > edit > redeem on a correctly scoped test endpoint > suspend > reject redemption > activate > delete > reject redemption; also verify old issued codes remain.
- Never report the Worker deployment, D1 migration or live Gate integration as complete solely because code was committed.
