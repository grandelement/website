> **UPDATE 2026-10-26 — The playlist-source paragraph below is superseded.** The permanent GE owner playlist source is `playlists/registry.json` in `grandelement/website`, written by authenticated `/manage/github-playlists`. The existing GE Fan Base Vault remains the private source for fan identities, events, payments and entitlements. User private playlist cross-device persistence is **not yet implemented**. Do not put fan data or IP addresses in the public GitHub registry. Refer to [current integration contract](../playlists/INTEGRATION_CONTRACT.md). Existing BLITZ Bangers must remain unchanged.

# Grand Element — Permanent Fan Base Vault Integration Contract

Status: Required architecture and acceptance criteria. This document does not claim the integrations are already deployed or verified.

## Single source of truth
The existing GE Fan Base Vault is the authoritative record for persistent fan identities (where lawfully collected), playlist identities, playlist metadata and track order, purchase and payment status, customer entitlements, and reporting events. Reuse the existing authenticated DJ/Vault APIs and published snapshots; never introduce a competing playlist, customer, or purchase database. Browser caches are temporary, never authoritative.

## Connected surfaces
- DJ Booth: create, load, rename, delete, and apply playlists using the original DJ/Vault playlist IDs.
- Back Room: edit those same records, explicitly approve public mixes, control catalog pricing and availability, and report analytics.
- Radio MUSIC: read only approved published playlist snapshots; log permitted aggregate listening and playlist events to the existing analytics pipeline without exposing private fan or DJ records.
- Support / Merchandise: display explicitly published curated mixes as purchasable sets of songs. Preserve track IDs and order. Existing albums and individual-song purchases continue to work.
- Fan Base Vault: associate confirmed orders, line items, rights/entitlements, downloads, and consent-aware analytics with the appropriate fan/customer record. Anonymous listeners remain anonymous unless they voluntarily identify themselves.

## Payment and delivery invariants
Never grant download entitlements from a client-side button click or an unverified checkout response. A trusted server must verify the payment provider's signed or authenticated payment state, apply idempotent order fulfillment, then issue authorized downloads for the exact purchased songs. No secret keys or private customer data in static site files. Never assert that checkout is live until an end-to-end test succeeds.

## Privacy and reliability
Collect only necessary information, honor consent and applicable privacy requirements, and avoid cross-device tracking without appropriate notice/authorization. Keep private playlists, access codes, and purchase details out of public config. Preserve existing radio playback, service worker, game and website behavior. Failed Vault writes must be surfaced, retried safely, and never silently treated as durable.

## Required release checks
1. Save Bangers in DJ Booth; reopen it from DJ Booth and Back Room with identical ID, order, and songs.
2. Create another mix; confirm it does not overwrite Bangers.
3. Publish a mix; verify it appears in Radio MUSIC and Support / Merchandise; unpublish and verify it disappears from public catalogs.
4. Test purchase using the actual payment provider's sandbox or verified test transaction; confirm no entitlement before verified payment and one entitlement per purchased song after payment.
5. Verify order, download, playlist, and permitted listening events reach Fan Base Vault analytics, with no duplicate orders or private data leakage.
6. Verify mobile, offline behavior, refresh, and ongoing radio playback.

All future Grand Element changes touching these surfaces must preserve and retest this contract.
