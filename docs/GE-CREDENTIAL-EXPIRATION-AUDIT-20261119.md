# GE Studios — Credential and Expiration Audit
Date: 2026-11-19
Repository: grandelement/website

## Scope and evidence
Inspected the repository tree (615 files), 53 GitHub Actions workflow files, credential-related code in Back Room, Vault, Radio/DJ, payment services, associated configs and docs, and screenshots supplied by the owner showing the Cloudflare Publisher's production variables and GitHub's personal access tokens. Private Cloudflare secret values, their validity/expiration dates, GitHub Actions secret values, external BLITZ infrastructure and device-local credentials are not readable through the repository. Do not equate a configured secret name with a working credential.

**Production incident:** Back Room sign-in and the Vault access-code read work, but GitHub publication returns HTTP 401. The Cloudflare Publisher screenshot shows GITHUB_TOKEN configured and no GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, or GITHUB_APP_PRIVATE_KEY. The GitHub screenshot shows two expired GE Back Room Publisher personal access tokens. The UI health check is only a GET; successful reads are not proof of write permission. No recent real Back Room commit was confirmed in the reviewed history.

## Inventory and required disposition

| Component / source | Credential or token | Used for | Expiration / renewal risk | Decision |
| --- | --- | --- | --- | --- |
| Cloudflare Worker `ge-backroom-publisher`, `backroom/publisher-worker.js` | `GITHUB_TOKEN` (currently configured) | Ordinary GitHub public settings, music routing and playlist saves | Owner's PAT expired; observed GitHub 401 | **Replace with GitHub App; remove this secret only after a verified real write** |
| Same Worker | `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` | GitHub App creates new installation token automatically | Installation token is ~1 hour; Worker renews. App private key has no scheduled expiry but can be revoked | **Configure once in Cloudflare**; use repo-scoped Contents: Read/Write |
| `backroom/index.html` (old hidden UI) | Manually entered GitHub PAT / legacy browser PUT | Superseded public website publish route | Per-device manual PAT; unsafe maintenance burden | **Removed dead browser PAT fields and legacy routines in this audit** |
| `backroom/github-direct.html`, `github-direct.js` | Browser-encrypted GitHub PAT and separate passcode | Historic direct GitHub editor | Per-device token renewal and storage | **Retired its HTML entrance**; original JS kept only as an unreferenced historical file pending post-cutover cleanup |
| GitHub personal access tokens, account settings | GE Back Room Publisher; GE Back Room Publisher 2 | Previous Publisher versions | Both expired in owner screenshot | **Revoke/clean up after App cutover** |
| GitHub personal access tokens, account settings | GE Studios iMac Library | iMac library workflow, if ever used | No expiration configured; screenshot says never used | **Verify on iMac before revoking** |
| GitHub Actions, e.g. `.github/workflows/backroom-publisher-auto-deploy.yml`, `ge-workers-direct-deploy.yml` and other Cloudflare deploy/migration workflows | `secrets.CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Worker deployments and D1 maintenance; NOT ordinary Back Room SAVE | End date of configured token unknown. Cloudflare tokens may be issued without an end date | **Keep a narrowly scoped deployment token**; check current expiration and permissions, then use a nonexpiring token if policy permits |
| GitHub Actions | GitHub's built-in workflow `GITHUB_TOKEN` (not the Cloudflare secret of the same name) | Commits / Actions operations | Ephemeral per run, automatically generated | **Keep; requires no manual renewals** |
| Cloudflare Publisher | `BACKROOM_PASSWORD`, `SESSION_SECRET` | Owner sign-in / 12-hour temporary session | Password and signing secret do not have routine scheduled expiry; user session does | **Keep securely** |
| Cloudflare Publisher / Vault, `vault-worker/src/index.js` | `VAULT_ACCESS_CODES_TOKEN`, `VAULT_ADMIN_TOKEN` | Authenticated internal code/fan administration | Shared opaque secrets; no built-in short renewal unless owner rotates them | **Keep**; do not break service-to-service auth |
| Vault Worker / D1 | `VAULT_INGEST_TOKEN`, `VAULT_HASH_KEY`, `VAULT_ENCRYPTION_KEY_B64` | Ingest, hashing, private encryption | No inherent routine expiry | **Keep**. Never delete or rotate encryption keys casually |
| `ge-radio-sync/worker.mjs`, `radio-backend/control-server.py` | `BLITZ_DJ_PASSWORD`, `GE_RADIO_SWITCH_TOKEN`, radio-device credentials | DJ authentication and switching | Generally owner-managed; not part of GitHub publishing | **Keep**; audit BLITZ external deployment separately |
| `support/payments/worker.js` | `BTCPAY_API_KEY`, `BTCPAY_WEBHOOK_SECRET` | Payments | Separate merchant-managed credentials | **Keep private**; published wrangler activation flags currently default to false |

## Cutover procedure, in order
1. In GitHub Developer Settings, create a dedicated **GE Studios Back Room Publisher GitHub App**, install it on **grandelement/website only**, grant **Repository contents: Read and write**, and do not give it administration permissions. Preserve the App ID, installation ID and generated private PEM key privately.
2. In Cloudflare, under `ge-backroom-publisher` production Variables and Secrets, add encrypted `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`. Do not place any secret value in GitHub source, chat, screenshots or localStorage.
3. Confirm deployed `backroom/publisher-worker.js` uses `githubCredential()`. Test authenticated `/manage/github-health`: `credential_mode` should report `github_app` (or `github_app+fallback` during transition) and GitHub GET HTTP 200.
4. **Do one controlled, reversible Back Room public-setting edit and press SAVE.** Require an actual GitHub commit SHA, a readback of that edited field through `/manage/public-settings`, and successful Pages deployment. A connected Vault, GitHub GET, or `NO CHANGES` response is NOT proof of a write.
5. Only after successful authenticated GitHub App-only saving: delete the expired Cloudflare `GITHUB_TOKEN` fallback and revoke the two expired GitHub personal access tokens. Test again with the PAT absent, including Radio Music and a GitHub playlist.
6. Review the distinct GitHub Actions `CLOUDFLARE_API_TOKEN` in Cloudflare's token dashboard: minimum required Worker deployments/D1 permissions, account restriction, no end date if policy permits. It is deploy-only, so loss blocks deployments but **must not block everyday site SAVE**.
7. Audit any iMac/desktop PAT usage before revoking the separate iMac token. Recheck external BLITZ and BTCPay secrets only if those services are in use.
8. Add operational monitoring for both *read* and *write* status, without publishing private admin endpoints or credentials. Alert on GitHub HTTP 401/403 before edits are lost.

## Safety rules
- Never delete or overwrite D1, Vault fans, radio master lists, DJ playlists, access codes, encryption keys, or payments to repair GitHub.
- Do not remove `BACKROOM_PASSWORD`, `SESSION_SECRET`, `VAULT_ACCESS_CODES_TOKEN`, or `VAULT_ADMIN_TOKEN` as an attempt to eliminate expiring personal access tokens.
- Keep the Cloudflare fallback PAT until the App installation truly works; remove it when the App can save independently.
- A GitHub Pages frontend deployment does not configure Cloudflare secrets.
- Live Worker account secret values and expiration settings were not directly inspected. This audit identifies configuration names and safe changes; an actual GitHub App cutover still requires owner access to GitHub App setup and Cloudflare secret management.
