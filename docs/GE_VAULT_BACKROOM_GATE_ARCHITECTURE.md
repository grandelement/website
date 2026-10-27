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
