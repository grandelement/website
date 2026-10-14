# Grand Element · BTCPay Bitcoin / Lightning payment service (NOT LIVE)

## Current status

This source supplies a fail-closed Cloudflare Worker checkout service. The UI can display Bitcoin and Lightning as available methods **only after** the operator has completed production installation, reconciliation, master-file fulfillment, and a real paid test. At publication, there is no production BTCPay host, verified store ID, API key, webhook secret, bound D1 instance, or connection to an AQUA wallet in the connected system. No funds are collected by this source as committed.

### Official compatible path

Run BTCPay Server v2.1.6 or newer on a trustworthy production host. Install SamRock Protocol plugin + Boltz plugin. Connect the merchant-controlled **AQUA** wallet using the QR flow inside the wallet on the operator's phone. Enable **Bitcoin on-chain** and **Lightning via Boltz** (optionally Liquid if desired). Verify real merchant receiving addresses on the wallet and server before enabling checkout. Boltz swap/network fees and hosting costs still apply. **Never expose the recovery phrase or merchant API key**. See https://docs.btcpayserver.org/SamRockProtocol/.

A server that is merely deployed without **completed fulfillment and an audited private download service** must not activate any payment flags. Existing music in a public GitHub repository is already accessible and cannot be retroactively paywalled.

### Deployment prerequisites

1. Deploy an HTTPS BTCPay server under merchant control, finish wallet (AQUA SamRock) and Lightning (Boltz) setup. Test a *manual* invoice first.
2. Register a merchant store with HTTPS production URL and scoped Greenfield invoice API key. Enable signed invoice-status webhooks pointed to `https://<your-workers-host>/webhooks/btcpay`.
3. Create Cloudflare D1 database, paste its binding into `wrangler.toml`, apply `schema.sql` with `npx wrangler d1 execute ge-support-orders --remote --file=./schema.sql`, and keep receipts, access tokens and order data private.
4. Add `BTCPAY_URL` and `BTCPAY_STORE_ID` as *server-side* configuration; add `BTCPAY_API_KEY` and `BTCPAY_WEBHOOK_SECRET` using `wrangler secret put` (NEVER in GitHub).
5. Build authenticated paid digital-master delivery, mail receipt and/or GE Player library entitlement, and refund/customer-service workflow. Paid customer downloads should be served from private R2 through expiring order-specific links; ensure a release rights audit for the Singles cover track. Stripe/PayPal card checkout is a separate onboarding task, and Stripe/PayPal identity verification is not bypassed by this code.
6. Do not enable merchandise orders until address collection, production supplier, shipping rates, sales tax and returns are wired. The existing Worker intentionally rejects all merchandise orders even if the merch flag is set, to avoid incorrectly collecting a price with no delivery address.
7. Perform a full end-to-end small-value mainnet invoice test separately with Bitcoin and Lightning, confirm **Settled** status through both webhook and Greenfield re-check, confirm fulfillment and refunds, then set `DIGITAL_DELIVERY_READY` / `RADIO_ACCESS_READY` / `DELIVERY_AUDITED` and `PAYMENTS_ENABLED` to true. On-chain transaction broadcasts marked merely **Processing** are never treated as Settled.
8. Deploy Worker to a real HTTPS endpoint and set `support/checkout-config.json` `bitcoin.api_base_url` to that endpoint, `bitcoin.configured` and `lightning.configured` to true only after checks. The UI calls `GET /health` and permits checkout only if backend `ready:true`.

### Worker endpoints

* `GET /health` readiness/declared payment methods.
* `POST /checkout` with `{items:[{id,qty,fit?,size?}],email}` from an allowed Grand Element origin. Prices come from the **embedded authoritative SKU table** in `worker.js`, not the browser. `201` returns `checkoutUrl`, `orderId`, and `accessToken`; the checkout URL must match the configured BTCPay origin.
* `POST /webhooks/btcpay` verifies `BTCPay-Sig` HMAC-SHA256 over raw bytes before event processing, then cross-checks the invoice's store, amount, currency and status via authenticated Greenfield lookup before updating the D1 order. Processing != Settled.
* `GET /order?id=<uuid>&token=<accessToken>` obtains a limited order state for the payer; avoid placing token in analytics/referrers, prefer the `x-order-token` request header.

### Important constraints

* SKU pricing was compiled from `support/catalog.json` at implementation time. **Rebuild/re-audit the worker SKU table if catalog changes**.
* This code intentionally **does not auto-fulfill a paid order**. `paid_unfulfilled` is the only outcome of a successful Settled invoice until a separately reviewed fulfillment Worker is installed. Keeping the payment flags false is mandatory until that work is complete.
* Protect checkout against bot abuse using Cloudflare WAF / Turnstile or rate limits before production. Do not interpret CORS as authorization or anti-bot defense.
* No live cards, PayPal, Stripe, BTC, or Lightning payment acceptance is being claimed at this stage.

Sources: https://docs.btcpayserver.org/Developers/api/examples/ ; https://docs.btcpayserver.org/SamRockProtocol/ ; https://developers.cloudflare.com/workers/configuration/secrets/ ; https://developers.cloudflare.com/d1/get-started/.
