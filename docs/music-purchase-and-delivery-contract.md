# GE Music · purchase, formats, and delivery contract

Updated: October 28, 2026

## Current demo behavior

MUSIC V6.1 and `radio/ge-purchase-demo.js` support a **local simulation** of selected-track/album review, a payment-method choice, MAKE TEST PAYMENT, and delivery preferences. This is used with a verified, unrestricted Music access session (including LOVE when that code has those Vault grants), or from the owner-only Sun Lab test shortcut. It deliberately never calls a payment processor, never creates real Vault entitlements, and never sends email.

The mock receipt is stored under `GE_MUSIC_TEST_PURCHASES_V1` on the device. A simulated purchase is **not** ownership and must never be consulted by production download/stream routes.

MP3 demo links refer to already-public audio files solely as a delivery example. The demo JSON manifest is not a music file. Other formats are displayed as **not generated**. Production downloads must not use public GitHub audio files as protected purchased masters.

## Production sequence (not enabled)

1. **Catalog:** server-side mapping of release ID, track ID, canonical source/master ID, licence, available file formats, current price, sales tax rules, and any bulk/album discount. Do not trust client-supplied totals. Existing public 75-file catalog has numbered gaps and may not be complete masters.
2. **Checkout:** one multi-item order, buyer/email/account identity, payment method/unique provider invoice. BTCPay/AQUA wallet configuration and approved alternative processors require verified receiving accounts and webhook secrets. Never place seeds/private keys in GitHub, JavaScript, or Workers.
3. **Payment confirmation:** Cloudflare Worker verifies a signed provider webhook, amount, currency, invoice ID, settlement and idempotency, writes final order status into D1. Do not issue rights for underpaid, pending, failed, disputed, or demo orders. Handle reversals/refunds and audit.
4. **Permanent music access:** D1 `customer_music_entitlements` keyed to a securely authenticated customer identity with exact track IDs, album rights, delivery options, and verified transaction IDs. The customer can return from any device to MY MUSIC without re-purchasing. An access code alone is *not* proof of paid ownership. Never equate local saved playlists with owned recordings.
5. **Private masters and conversion:** original WAV/AIFF/FLAC masters stored in private R2 (or equivalent). A background transcoding service uses FFmpeg with queue jobs to generate:
   - MP3 320 kbps
   - WAV (16/24-bit PCM)
   - AIFF/AIF (16/24-bit PCM)
   - FLAC lossless
   - ALAC/M4A Apple lossless
   - AAC/M4A
   - Ogg Opus or Vorbis if requested
   Validate sample rate, bit depth, channel mapping, peak handling and metadata; keep art/tags and original filenames clean. Conversion from an existing lossy MP3 to AIFF/FLAC **does not restore lost audio quality**. Verify ownership/licensing of cover recordings and bonus songs before sale.
6. **Job architecture:** Cloudflare Worker can accept the order, authenticate, generate a queued conversion request, and serve signed links, but heavy on-demand FFmpeg transcodes generally belong in a separate resource-controlled compute worker/container. A Cloudflare Queue or equivalent delivers jobs reliably; completed objects are written to private R2. Retry idempotently and bound CPU/storage cost.
7. **Secure downloads:** short-lived signed URLs per authorized order and chosen format; expiry and reissue from MY MUSIC, optional zipped album, rate limits and abuse monitoring. Never rely on hiding a public GitHub media URL as a paywall.
8. **Email delivery:** ask whether the customer wants an emailed link, and collect only the email needed. Send through a transactional email provider (not an in-browser `mailto:`) after the file is ready; send an expiring link, not a large audio attachment. Provide change-format/redownload controls in authenticated MY MUSIC.
9. **Analytics:** record checkout initiated, confirmed/failed settlement, format chosen, conversion job state, download delivered/opened and customer consent as distinct events; never label a simulated order as revenue. Apply privacy minimization and account controls.

## Release acceptance checks

- A full-access LOVE user can test every UI step without charge or alteration of current Music/Radio grants.
- A guest cannot gain permanent purchased rights from localStorage, a fake order ID, edited browser settings, or a code without the required signed Vault scope.
- A settled real payment unlocks only purchased songs in a new browser/device after login.
- Every offered format exists as a correctly encoded object from an authorized source master; previews never mislabel conversion.
- Download links expire and can only be reissued to an authenticated owner.
- Email links are delivered only with the customer's consent and to the intended verified address.
- Radio 1, Radio 2 backup, gate timing and existing playlists remain operational.

**Status:** Frontend simulation is implemented; live payment, private masters, server-side conversion, account entitlements, and transactional email are not connected.
