# GE Studios human verification integration

Status: front-end control panel implemented on feature branch; **not deployed and not active**.

## Existing configuration
- Turnstile widget created by owner in Cloudflare; allowed hostname grandelement.com and Managed mode confirmed.
- Never commit the Turnstile secret to GitHub or put it in frontend JavaScript.
- Existing fan Vault and owner Back Room must not be reset, replaced or bypassed.

## Required private Worker endpoint
Extend the existing authenticated `ge-backroom-publisher` Worker with:
- `GET /manage/turnstile-settings` returning JSON `{ok:true,mode:"off"|"monitor"|"challenge",site_key_configured:true,server_validation_ready:true}`, only if fully configured.
- `POST /manage/turnstile-settings` accepting a JSON mode and returning `{ok:true,mode:<persisted mode>}` after persisting it. Authenticate existing owner bearer session server-side, require origin/CSRF protection, validate mode enum, audit changes. Must not be public-writeable.
- Store authoritative mode in a persistent Cloudflare binding, not localStorage or a browser variable.
- Provide the public widget SITE KEY as a public setting. Store the SECRET KEY in a Cloudflare secret binding only.

## Mandatory public-site enforcement before enabling ON
- Route protected entry through a server/Worker guard. A static GitHub Pages frontend cannot guarantee verification *before* reaching a public webpage or media URLs.
- On challenge, render Turnstile and send its single-use token to server; server calls `https://challenges.cloudflare.com/turnstile/v0/siteverify` with secret, token, and optional remote IP. Require `success===true` and intended hostname; prevent replay.
- Set a short-lived signed HttpOnly Secure SameSite session cookie following success. Enforce it server-side on protected routes. Do not treat a localStorage flag or browser-only token as proof.
- MONITOR does not block site entry and must label metrics *likely human / unverified / automation suspected*, never verified legal identity. Only claim Turnstile-verified after successful server check.
- OFF does not run verification. Changes should take effect for new sessions.
- Leave public music, accessibility, radio backup and purchase entitlements working. If verification provider is unavailable, do not silently make the entire public music site unusable; choose explicit, tested fallback policy.
- Never classify all US IPs as humans, identify a person by IP alone, or claim country/state values are precise.
- Apply retention limits, disclosure, and consent rules to tracking and analytics.

## Acceptance tests
1. Logged-out access to settings returns 401/403 for both methods.
2. Missing secret or missing server validation means controls remain disabled.
3. POST mode persists across Worker restarts and devices.
4. Invalid modes rejected.
5. Challenge token not accepted without server-side Siteverify success; expired/reused tokens rejected.
6. Challenge mode prevents unverified access only on intentionally protected routes.
7. Monitor/OFF mode leaves public music accessible.
8. No secret appears in GitHub, browser devtools, or public API responses.
9. Existing Vault analytics and purchases remain unchanged.
10. Re-run `node tests/smoke.cjs` and manual browser/device testing before production merge.

## Deployment blocker
Private Cloudflare Worker source, routes, KV/D1 bindings and secret deployment are not present in this repository's checked-in source. Frontend controls cannot complete backend activation on their own. Do not merge claiming verification is live.
