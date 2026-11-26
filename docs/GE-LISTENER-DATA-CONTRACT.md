# GE listener data compatibility contract (v1)

**Application is replaceable. Listener data is not.** Every deployment, rebuild, update, repair, rollback and service worker migration must preserve the user's existing media and state. Normal maintenance must never clear site storage, reset access, remove saved recordings, or force an offline redownload.

## Storage ownership

| Layer | Current storage | Required behavior |
| --- | --- | --- |
| Radio application shell | ge-radio-shell-* | Revalidate online; verified offline fallback; retire only inspected caches with no recordings |
| Website application shell | GE_SITE_SHELL_* | Revalidate online; no listener data deletion |
| Media | ge-radio-media-v4; legacy and GE_SHARED_OFFLINE_V2 caches may also contain recordings | Keep stable; validate complete replacements before retiring duplicates; never remove automatically because a catalog entry changes |
| Offline intent | GE_RADIO_OFFLINE_PLAN_V1; pending and activated keys | Preserve selected paths/order and legitimate existing offline authorization; derive readiness from actual verified files |
| Personal playlists | GE_MUSIC_PERSONAL_PLAYLISTS_V1; private Fan Vault; device-local cached Fan Vault rows | Retain playlist IDs, names and ordered song references; no overwrite on application upgrade |
| Selection/working order | GE_MUSIC_V3_SELECTION_20261024; GE_MUSIC_WORKING_PLAYLIST_V1:*; GE_RADIO_PERSONAL_SONGS_V3 | Preserve user's exact choices; migrate explicitly, idempotently, with legacy read support |
| Preferences | GE_RADIO_TRANSPARENCY_V1; GE_BG_*_V2; GE_BG_VIEW_MODE_V1; GE_HUD_AUTOHIDE_V2; GE_DEVICE_VIEW_PREFERENCE_V1; other documented GE preferences | Do not reset from code version changes; validate existing settings against supported schemas |
| Authentication/entitlements | Existing Vault device/session records | Remain separate from preferences; validate with Vault; never convert a backup or local receipt into permission |
| Games/private recordings | Existing local game keys and recording stores | Preserve independently; inventory and migrate explicitly before changing storage format |

## Stable identity and compatibility

config/track-identities.json is the allocated registry of the current master music catalog. IDs are opaque, permanent and must not be regenerated or reassigned from filename, sorted position, audio hash or album ordering. A rename changes only the path and appends the former path to aliases. Keep retired entries. A new recording receives a new unused ID. New/renamed recordings require a catalog/registry consistency check.

Current live playlists still use canonical repository paths; the registry is the foundation, not a completed playback migration. Before switching consumers to IDs, add a backward-compatible resolver at every playlist, queue, Vault, offline inventory and entitlement boundary, test path aliases and preserve unresolved references rather than silently dropping them. Never bypass access checks based on an imported ID.

A portable user-data export/import format should use an explicit schema version, stable recording IDs with legacy path compatibility, ordered playlist data, offline download intent and an allowlist of validated preference fields. Do not include bearer tokens, plaintext codes, private administrator data or raw downloaded copyrighted recordings by default. Keep imports separate from authorization; user-approved re-download requires current authorization. Do not claim cross-device transfer is complete until round-trip and migration tests pass.

## Release gate

- Check online fresh HTML, CSS, JS and service worker behavior; retain last verified offline application on failed network/installation.
- Confirm media and user storage survive app update, repair and rollback without clearing, resetting, or deleting browser storage.
- Verify a failed replacement leaves the old recording intact; old shell cleanup must fail closed if recordings might exist.
- Confirm website-only removal cannot remove saved Radio audio; explicit music deletion must match the listener's requested selection.
- Verify private Fan Vault playlists and local playlists preserve names, exact order, checked selection and working state after reload.
- Verify preference values and game/private-recording data survive upgrades.
- Test real Safari/iPhone foreground, reopen, airplane-mode cold start, reconnect and update. No real-device pass may be inferred from a syntax check.
- Use StorageManager.persist() when supported during deliberate offline downloads; browser storage remains device/origin-bound and may be evicted or deliberately erased. Persistent storage is not a backup.

Research: MDN Using Service Workers, Cache API, Web Storage API, Storage quotas and eviction criteria. Browser-managed data may be evicted at the origin level; application separation alone is not an external backup.

## Audit status

2026-11-26: RESET SITE replaced with UPDATE SITE; older media replacement routine reordered; catalog removal no longer purges downloads; Radio legacy-shell deletion checks for recordings; website offline clearing preserves recordings; stable track registry created; Radio requests best-effort persistence. Full portable backup/import, server-backed cross-device preference synchronization and end-to-end ID migration are open. Existing access policy is unchanged.
