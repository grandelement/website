# Grand Element Support Store — preview build

Created for the GE Studios Support Center at /support/.

## What this version does
- Links existing album popup's former BANDCAMP button to SUPPORT and opens the corresponding album in the store.
- Uses the original album covers from ge-images/images/; catalogs audio filenames already in ge-music/music/.
- Uses product images sourced from Grand Element's connected Google Drive Merch/STORE PHOTOS.
- Displays albums, individual track selectors, radio unlock, shirts, hats, circular stickers, and a 2027+ booking inquiry.
- Adds a quantity/fit/size selector and persistent local shopping cart.
- Exposes planned Bitcoin/BTCPay, card/PayPal, and Lightning options clearly marked as NOT CONNECTED.

## STOP: no live commerce yet

Live payment is intentionally disabled. There is no receiver address in this source. Do not activate until the actual merchant-controlled AQUA GE Studios Bitcoin receiving wallet is verified on-device and the real production BTCPay server connects securely using a supported watch-only/SamRock method. Never copy a seed phrase into the website or a server. Do not use mainnet.demo.btcpayserver.org for customer payments.

Card, PayPal, and wallet options require an independently approved payment processor/merchant account and may require ID and tax verification. Processor fees and exchange rates must be disclosed.

No emails, file downloads, radio gate entitlements, printer orders, reservations, or actual payments are processed by this front end. The 2027 booking inquiry opens a mailto message; there is no connected Grand Element availability calendar.

## Next work: checkout and delivery services

1. Provision a production BTCPay host with confirmed AQUA compatibility. Compare a test invoice address to a wallet receive address without exposing a seed phrase or xpub publicly.
2. Create authenticated server-side Cloudflare Worker routes (never trust price provided by browser). Use SKU/variant + authoritative prices from the server.
3. Persist pending orders in D1; use one unique invoice per checkout (multiple tracks in one order); idempotent handling and signed BTCPay callbacks.
4. Confirm settlement and reversible/underpaid cases before delivery. Provide refunds/order-support procedures.
5. Store verified downloadable masters in private R2 storage and generate short-lived order-specific download links; email recipients should receive links, not music attachments. Configure sender domain and transactional mail service.
6. For radio, grant an account entitlement server-side only after settlement; protect the live streaming URLs without disrupting the existing BLITZ fallback workflow.
7. Select a printer with verified unit pricing, acceptable returns address/terms, and secure fulfilment API; do not place merchandise orders until supplier payment method is funded or revenue-splitting is contracted.
8. Set up separate approved card/PayPal hosted checkout; do not claim it pays into AQUA unless the provider explicitly supports BTC settlement.
9. Connect booking availability via free/busy-only calendar integration. Do not publish private SGRT Trust event details.

### Catalog audit required
Current nine album folders contain 70 audio files and Singles contains 4. Several numbered album folders have gaps (Trio, Live, Sessions II, Intergy, Love, Spirit). The numbers are files available in the public source repository, NOT verified canonical album track counts or private masters. Confirm actual final release lists and rights before paid sale. Existing public GitHub audio URLs cannot be protected merely by introducing a paywall; keep radio operation intact while separating the download masters into private storage.

### Merchandise image provenance
The store uses the mockups from the authenticated Grand Element Google Drive. They are storefront CONCEPT PREVIEWS and not supplier-validated print templates. White/black shirts are represented front and back; both trucker hat colorways and two sticker concepts are included.

### Manual check
- Home and Album Scan SUPPORT links open /support/ and /support/?album=...
- Albums render from catalog.json using the actual GitHub covers
- Cart remains across reload; size/fit/quantity selection works; totals update
- Sticker prices are TBD, so sticker items cannot be added yet
- Checkout UI shows proposed methods and cannot collect funds
- Booking enforces 2027 minimum, sends inquiry via mail application
- Desktop/mobile layout and About/Radio/Game functionality remain unchanged
