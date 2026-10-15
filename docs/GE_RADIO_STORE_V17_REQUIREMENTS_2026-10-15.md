# GE Radio / Store / Merchandise — requirements archive
Date: 2026-10-15
Status: USER REQUIREMENTS + IMPLEMENTATION PLAN, not yet production features.
Owner-approved source of baseline: main commit 80a9e6599e24fc980ae623a5ef04330917dab2b1. Archived branch ge-merch-layout-1-archive-20261015 is Layout 1 baseline. DO NOT replace or delete Layout 1 while evaluating alternatives.

## Monthly Radio membership + song credit
- Current catalog price: $6 per MONTH (not one-time).
- Each successful paid monthly subscription period grants the member exactly ONE credit to redeem ONE song of their choice, separate from Radio streaming privileges.
- No credit for a failed/duplicated/unauthenticated payment. Unique ledger key: (subscription_id, paid_period_start or provider_invoice_id). Handle webhook retries idempotently; grant only after final verified settlement.
- Member UI: MY MUSIC, SONG CREDITS (available balance), REDEEM 1 SONG, and existing purchased/redeemed songs.
- Credits must survive logout, device changes, and browser cache reset; account ledger in authenticated server-side database, never only localStorage.
- Do not silently expire credits or erase credited songs. Unused-credit expiry/transfer/cancellation policy requires explicit decision before sale.
- Purchased or redeemed track availability depends on rights verification, proper mastered/private download assets, and digital fulfillment deployment.
- Bitcoin/Lightning/monthly renewal backend is NOT connected; never claim a paid purchase or grant actual entitlements in preview mode.

## User-selected access code and account recovery
- Customer chooses a unique member/login code; if the user means this to be a password, require a *separate* private password/passkey. Display small but legible "Forgot your code or password?" near sign-in, at least regular body legibility and adequate tap target.
- Payment method/provider customer reference or transaction ID is used ONLY to locate an account. Never use card last four, invoice number, address, or blockchain tx hash alone as password-reset authorization.
- Secure reset: verified email magic link or a one-time recovery code created at enrollment; provider-authenticated account recovery where available. Reset token single-use, short-lived and rate-limited; do not disclose whether an account exists. Crypto-only customers need a securely issued recovery code if there is no email.
- Store only payment provider tokens + minimal needed payment metadata, never raw payment card number, CVV, wallet seed phrase, private keys, or credentials. Hash private passwords; protect account DB and credit ledger.
- Make privacy and cancellation terms plain and visible before enabling recurring payment.

## Master responsive design across all GE pages
- Scope: homepage, website non-game/Body, games, Radio, DJ Booth, music, merch, support store, checkout, and account screens.
- Use fluid CSS Grid/Flexbox, responsive images, border-box sizing, rem/clamp fonts, viewport-fit cover + env(safe-area-inset-*), orientation-sensitive composition and 100dvh/100svh where appropriate.
- TARGET LAYOUTS (viewport width, not hard-coded device type): compact phone 320–374 CSS px, regular phone 375–599, small tablet 600–767, large tablet 768–1023, desktop >=1024, wide desktop >=1440.
- Use touch pointer/hover/orientation for refinements; preserve layout on orientation change and do not rebuild underlying game/space physics on rotate.
- No accidental horizontal scrolling/panning, content clipped offscreen, or offscreen checkout. Explicit user requirement: no pinch-to-zoom across GE pages. Engineering caveat: *global* browser zoom suppression cannot be reliable on all iOS/browser versions, and harms low-vision access; solve accidental zoom/sideways drift through correct fit/reflow, control touch behaviors on interactive game/canvas regions and respect browser accessibility controls elsewhere.
- Design for 320 CSS px wide even with text increased, without two-dimensional scrolling for ordinary pages; buttons at accessible tap sizes.
- Prefer pictorial navigation, visual grouping and whitespace. Keep existing descriptive text/info and readable font size; collapse expanded details into one dedicated READING/DETAILS area rather than dropping content.
- Avoid repeating near-identical monochrome control tiles.
- Do not scale all UI and text by 25%. Instead trial Layout 2 with ~25% *less visual density*: less panel chrome, smaller nonessential card framing, more visual breathing space while text stays the same size.
- Every layout retains all current product data, labels, sizes, quantities, cart, previews, checkout guards, and CLOSE/BACK controls.
- Provide ten distinct visual layout concept images for comparison; no change to the public default until owner chooses.

## Merchandise / product imagery
- Layout 1 currently uses support/index.html and support/catalog.json with two stickers: sticker-sun and sticker-ge.
- Add **GE Body (formerly Ship)** as a third sticker. Source must be the exact *non-game* mode Body/Ship artwork from the GE website, not an invented logo. Verify source, silhouette/crop and printing dimensions; price remains PENDING until fulfillment exists.
- Blue Sun circular sticker currently references support/assets/sticker-sun.png. User flags awkward image / off-center lettering. Inspect actual source and placement on a real rendered product before replacing; center graphic/text optically within trim/safe area with proof image.
- Existing merchandise pricing and product functionality remain unchanged pending physical print/ship quote.
- Alternate product-centered, imagery-heavy layouts; start with comparable 10-panel design concept sheet and ask the owner to select directions.

## Operational notes
- This archive does NOT modify live storefront, install recurring billing, or activate commerce.
- Re-test all viewport categories in portrait/landscape; check phone bottom controls, large text and safe areas.
- Maintain BLITZ v167 primary and independent Radio 2 fallback: changes in the store must not disturb audio.
