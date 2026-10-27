# GE Access Codes — private Vault and encrypted GitHub recovery

## Where data is stored

- Playlist master: `grandelement/website/playlists/registry.json` (public GitHub).
- Live access codes, usage limits, song snapshots, redemption state and code-to-fan links: private Cloudflare D1 database `ge-studios-vault`.
- Encrypted recovery snapshot: `access-codes/private-vault-backup.enc.json` in this public GitHub repository. **Only AES-256-GCM ciphertext may be written here.** Never commit plaintext keys, HMAC values, user names, email addresses, phone numbers, or private fan events.
- Cloudflare secrets, including `VAULT_ENCRYPTION_KEY_B64`, remain in Cloudflare and must have an independent secure backup to make future decryption possible. Never copy them to GitHub.

## Owner save sequence

1. The owner selects an existing GitHub playlist and optionally an existing fan ID in Back Room.
2. Back Room calls the authenticated Publisher /manage/access-codes API.
3. The Publisher calls the private Vault Worker over the `GE_VAULT` service binding.
4. D1 atomically saves the code, explicit track snapshot, encrypted secret and optional fan link.
5. The Publisher requests a fully encrypted D1 snapshot, commits that ciphertext to GitHub and reads the GitHub file back to verify it.
6. Back Room fetches the saved D1 record again and verifies its name, scopes, fan ID, playlist IDs, songs, limits and duration. A save is labeled verified only after D1 readback. The UI independently reports `VERIFIED` or `PENDING` for the encrypted GitHub backup.

A GitHub failure is **not** a Vault save failure. Never repeat `issue` automatically: it creates another credential. Instead press **BACK UP ENCRYPTED CODES TO GITHUB** to retry the mirror without changing any issued code. The records remain in D1.

## Recovery safeguards

- Original LOVE remains a historical code. Never revoke, reset, delete, or reissue it as part of the integration.
- Never change existing radio or DJ/BLITZ playlists to reconcile access-code records.
- GitHub's public repository is unsuitable as an unencrypted customer database. The encrypted GitHub snapshot is a recovery/versioning mirror, not an alternate authentication database.
- Restoring D1 from any snapshot must be a separate, authenticated, audited, explicitly approved operation. This integration does **not** expose an automatic D1 overwrite endpoint.
- A link to a Fan Base Vault ID is an owner assignment, not proof that someone entering a bearer code has authenticated as that fan. Enforcing per-user login would require a separate identity verification flow.
- Neither this implementation nor GitHub playlist visibility alone protects publicly accessible audio files from direct URL retrieval.

## Deployment

This integration branch is intentionally **not production deployed**. The main-branch Vault and Publisher workflows can deploy automatically and some historic workflows redeem LOVE during verification. Keep this work on a feature branch until those checks can be performed without modifying LOVE or until a separately approved deployment window.

For owner-only testing after deployment, use Back Room > ACCESS CODES > RECONNECT, then inspect existing records and run the encrypted backup manually without issuing new codes. Verify the database readback and GitHub commit hash. Public health endpoints do not list private codes.
