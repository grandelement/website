# GE Website Back Room Publisher

This Worker is the private write bridge for the Website Back Room.

## Security model

The browser contains no GitHub credential and no admin password.

Cloudflare secrets:
- BACKROOM_PASSWORD
- SESSION_SECRET
- GITHUB_TOKEN

The GitHub token should be fine-grained, restricted to the `grandelement/website` repository, with Contents read/write only.

## API

- `GET /health`
- `POST /login` with `{"password":"..."}`
- `GET /session` with Bearer session
- `POST /publish` with Bearer session and `{"config":{...}}`

Successful publishing writes only `config/site-live.json` on `main`.

Recommended Worker hostname: `https://backroom-api.grandelement.com`.


## Radio playlists and access-code administration (2026-10-21)

The Back Room now has separate **RADIO**, **PLAYLISTS**, **ACCESS CODES**, **GATE**, **SCORES**, and **PRESETS** tabs. Owner functions use the same authenticated publisher session, never public browser tokens for the Vault.

Additional secret required in the **Back Room publisher Worker**:

```sh
cd backroom
npx wrangler secret put VAULT_ADMIN_TOKEN
```

Set this to the **same secret** already configured as `VAULT_ADMIN_TOKEN` on the GE Vault Worker. Do not put it in site config, GitHub, localStorage, or the front-end. The publisher forwards whitelisted operations to `https://vault.grandelement.com`. Without the secret, the Access Codes and Playlists tabs show a configuration error rather than falsely saving anything.

Authenticated routes (Bearer Back Room session):
- `GET /manage/playlists` — read Vault playlist records and track order.
- `POST /manage/playlists` — actions `save` or `delete`.
- `GET /manage/access-codes` — list code metadata and master switch only (never plaintext codes).
- `POST /manage/access-codes` — `issue`, `activate`, `suspend`, `revoke`, `master`.

The Vault database migration and Vault Worker deployment must precede access-code requests. See `../vault-worker/README.md`.

**Important:** Vault playlist saving does not directly force a live BLITZ queue change. Use the existing GE DJ Booth to select the live playlist. Access codes are currently issued and redeemed by the separate Vault service. They do not yet unlock the public Radio Gate or website without explicit, tested client-side entitlement integration. The approved Gate timing and fade are unchanged.

Deployment: deploy the Vault Worker after applying the D1 migration, then deploy the Back Room publisher Worker. Changes in these Worker source files are **not automatically deployed** by ordinary GitHub Pages updates.
