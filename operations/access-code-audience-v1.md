# GE Studios Access Code Audience report

Status: Back Room read-only dashboard added in a feature branch; **not deployed or connected to private Vault yet**.

## User goal
For each saved access code, show the audience that redeemed it: count of redemptions, anonymous fan IDs, approximate geography, visits, song and playlist engagement, games and other events, with time filtering. The same person on two browsers may be counted twice. Never claim to know a real name from an access code, IP, or Turnstile.

## Existing infrastructure verified in public repository
- `ge-vault-client.js` already creates persistent `anon_id` and session IDs, and batches event types such as `page_view`, `track_start`, `track_complete`, `game_start`, `game_complete`, `button_click`.
- Back Room already has a FANS geography panel using authenticated `/manage/fan-geography` and an ACCESS CODES editor using the existing publisher Worker.
- Access Codes already support linking an existing saved fan to a code. This is NOT automatic redemption attribution.
- Private Vault D1 schema, publisher Worker routes, and redemption Worker code are not in the checked-in website repository; do not pretend the report is connected.

## Private Worker requirements
Owner-only GET `/manage/access-code-audience/codes`: `{ok:true,codes:[{id,label}]}`, where id is the stable private record ID and label is the nonsecret display name. No raw access code or code hash in response.

Owner-only GET `/manage/access-code-audience?code_id=<id>&period=24h|7d|30d|90d`: `{ok:true,totals:{visitors,redemptions,sessions,events},visitors:[{fan_id,first_seen,last_seen,region,sessions,events,song_plays,game_plays,activity:[{at,type,title}]}]}`. Strictly validate code_id against existing D1 codes, time bounds, response size, permissions, and event types. Use authenticated owner session and rate limits. Never accept public writes to these endpoints.

**Critical: record redemption on the server.** On a *successful* access-code validation, write an idempotent `code_redemptions` association: `code_id`, server-generated redemption ID, pseudonymous visitor/session ID, server timestamp, optionally campaign label. Do not put the actual code string in telemetry or URLs. Reject failed code attempts from the redemption count.

Link subsequent Vault events by a signed short-lived server-issued redemption/session attribution claim (or verified server-side mapping), not merely a browser-supplied `code_id` in metadata. Support repeat visits only where the association is valid and visitor choice/consent allows. If the existing Vault cannot securely verify visitor IDs, report events as unattributed rather than joining on untrusted strings.

For geography, use coarse IP-derived location server-side and return only country/state/city where sufficiently reliable. Never expose raw IPs in the dashboard by default. Provide appropriate notice and consent where required, opt-out/deletion procedures, restricted owner access, retention limits, and secure storage.

## Acceptance checks
1. No publisher session -> 401/403 for both routes.
2. No private Worker route -> visible NOT CONNECTED message, never invented counts.
3. One valid redemption -> one recorded redemption, linked to one pseudonymous browser ID.
4. Failed/revoked/expired code -> no successful redemption recorded.
5. Replayed or forged attribution claim -> rejected.
6. Songs, games, website navigation appear under correct code and fan ID only when valid attribution is present.
7. Code A events never leak into Code B; shared browser and multiple devices do not claim verified identity.
8. Geography remains approximate; untracked activity is labeled incomplete.
9. Reports paginate/limit histories and sanitize strings.
10. Public music, existing codes, and Vault records are unchanged by this dashboard.
