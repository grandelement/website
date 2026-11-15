# GE Studios private media migration

STATUS: Protected gateway prepared for testing. NO MIGRATION OR DEPLOYMENT COMPLETED.

Radio and MUSIC presently use public GitHub music files and the public radio/manifest.json. Hiding counts in the UI does not hide the library from a public GitHub viewer. Public commit history and copies may remain available even after the repository is reorganized.

## Safe deployment plan

1. Back up the current audio, catalogs, playlists, purchase entitlements, and worker configuration separately. Do not delete existing device caches.
2. Create a Cloudflare R2 bucket with NO public bucket endpoint or custom domain, and upload audio preserving ge-music/music/ object paths. Verify original sizes/hashes after upload.
3. Configure the Vault Worker R2 binding named GE_PRIVATE_AUDIO, plus a new secret GE_PRIVATE_MEDIA_SIGNING_KEY with at least 32 unpredictable characters. Do not commit the secret.
4. Run the private-gateway security tests and verify unauthorized requests are denied. The gateway uses existing D1 music-session verification and issues short-lived per-track signed URLs. GET and HEAD support byte ranges. No public list, counts, or manifest are provided by this gateway.
5. Integrate the online Radio player, MUSIC and the one OFFLINE engine with this protected route. Preserve current cache keys, file identity, playlist order, saved songs and access permissions. Verify with real recordings.
6. Test a physical iPhone: authorized download, 100% READY, airplane-mode cold launch, playlist/shuffle, next, seeking, and a reopened app; ensure code expiry does not erase already-saved authorized songs.
7. Only after all active clients and the BLITZ pinned source have migrated: retire public audio paths and catalog from public hosting. Rehost the public website separately and remove the publicly served audio repository exposure. Do NOT suddenly make this website repo private because it will break GitHub Raw consumers.
8. Previously public media and inventory may still be found via commit history, clones, or caches. Future audio releases must stay outside public Git. Absolute secrecy for historic releases cannot be promised.

## Existing prepared API

POST /v1/private/music/sign: accepts an existing authorized Music session and track path and signs a short-lived playback URL.

GET or HEAD /v1/private/music/file/encoded/path?expires=...&sig=...: validates URL signature and reads only the private R2 bucket.

The private route fails closed with HTTP 503 until R2 and the signing key are configured; it does not use GitHub as a fallback.

Deployment gate: no branch merge or public-song removal as evidence of complete privacy until storage migration, browser integration and iPhone tests pass.
