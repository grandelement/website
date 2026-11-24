# GE unified core reconstruction
## Acceptance contract
Preserve production, music assets, published settings, access entitlements, playlists, fan data and existing share URLs. Reconstruct in isolation; do not delete production.
- Back Room publishes one authoritative configuration; public clients consume it. Local preferences cannot override owner-controlled settings.
- Music catalog supplies stable song IDs, album order, artwork, measured durations, playlist totals and library total.
- Music album universe supports squares, touching circles and separated circles; owner controls global mode.
- Radio BLITZ primary, Cloudflare backup; explicit failover status.
- One playback coordinator owns queue, selection, next/previous, lock-screen media session and cached playback.
- Offline checked selection downloads exactly checked authorized songs; no implicit full library; verify actual stored audio and airplane-mode cold start.
- EQ Effects enabled publicly by default; owner controls exposed variables; advanced access code unlocks advanced variables only.
- Responsive layout survives portrait/landscape transitions, with one viewport policy and accessible controls.
- Preserve existing share URL compatibility, access restrictions, playlists, analytics and merchandise.
## Migration gates
Inventory entrypoints, listeners, configuration writers/readers, caches, playback owners and dependencies. Establish baseline regression failures. Implement shared contracts and adapters, migrate one vertical slice at a time, remove old code only after parity tests pass. Require regression, deployment and real-device acceptance before declaring completion.
