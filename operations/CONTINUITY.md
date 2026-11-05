# GE Studios: ten-year continuity and self-funding architecture

Status: **implementation in progress**. This is a public, non-secret operating plan. It does not certify hosting, bank accounts, payment processing, backups or ten years of unattended service.

## Permanent core (Tier 0)

- Static homepage, art, album pages, music manifests, accessible controls, and browser games must remain usable without the Vault, Cloudflare Workers, radio stream, commerce, or a live analytics connection.
- Static song data and source code belong in a portable archive independent of the current host.
- Radio 1, Radio 2, DJ devices, leaderboards, messages and checkout are optional modules; failures must never erase the public music library or hold a visitor at a blank screen.
- Never convert a failed payment, local cache value, demo flag, or browser-only check into a paid entitlement.
- Back Room editing and publication must remain authenticated. Static HTML visibility is NOT private access control.

## Critical vendor risks

1. **Domain:** grandelement.com stops resolving if registration is lost. Registrar, expiration, payment method and owner recovery path require verification. Authorize auto-renew only at the actual registrar.
2. **Production host:** GitHub is the source repository, not guaranteed perpetual e-commerce hosting. GitHub Pages terms restrict using free Pages as the primary online-business/e-commerce host. Plan an independent production host that permits commercial activity; do not change DNS until a replacement has passed acceptance tests.
3. **Purchased music:** Preserve durable, separately backed-up payment and entitlement records. Do not publish account/customer records in this public repository.
4. **Radio:** Live radio needs an operating streaming provider. Local music continues when the provider is down.
5. **Cloudflare:** Workers currently support owner login, private messages and DJ sync; the Vault endpoint remains a necessary back-end service until verified replacement and restore.
6. **Google Drive:** Useful secondary backup, **not** the only backup. Consumer-account inactivity can lead to deletion after two years; organization accounts have different terms.
7. **Scheduled checks:** GitHub scheduled Actions in public repositories are disabled after 60 days of inactivity. They are not a ten-year heartbeat; use an independent monitor and recovery contact when configured.

Source documentation:
- GitHub Pages additional terms: https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- GitHub scheduled workflow rules: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Google's consumer-account inactivity policy: https://support.google.com/accounts/answer/12418290

## Financial operating loop (not yet connected)

Customer checkout -> payment processor (verifies settled/authorized payments) -> approved GE Studios settlement account -> reserve and expenses -> vendor-authorized autopay -> reconciled bookkeeping -> encrypted offsite backup.

- All bank accounts, beneficiaries, tax identities, authorized signers and payments require independent legal and financial verification. No account is configured by this file.
- Keep a minimum target of **12 months of verified essential operating expenses**, subject to actual cash flow; use at least two distinct recovery paths.
- Record every vendor's exact contract name, renewal date, bill amount, autopay state, domain expiration, and recovery method **in a private encrypted ledger, not in this repository**.
- Separate revenue and refunds from payouts; processor webhooks must be signature-verified and idempotent. A frontend redirect is not purchase proof.
- Preserve music access for paying fans through vendor outages and payment-provider transitions; test restore from an independent entitlement ledger.
- Never grant any bot unlimited transfer authority. Caps, audit trail, tax obligations, refund handling, and an authorized human override are required.
- Never rely on unattended scripted login to keep accounts active; it may not qualify under vendor policies.

## Backups and recovery

- Keep original audio masters, derived web audio, images, game assets, static config, entire source repository, and private records in **separate** backup groups.
- Target at least two distinct backup providers plus an offline owner-controlled copy; encrypt account, payment and fan data. Restore test before relying on a backup.
- Store recovery credentials outside the public repository. Do not create public, world-readable Vault exports or customer spreadsheets.
- Regularly verify backups, hosting terms, bank/provider identity requests, expiration dates and the domain registration. No system can promise zero human attention for ten years.
- A deployment is not proven until the public website, published music, Back Room lock, radio failover, offline caching and payment entitlements have been tested on real devices.

## Acceptance gates for any migration

1. Static pages and music load with **all third-party APIs unavailable**.
2. The owner-only Back Room cannot be entered without server-verified authentication.
3. Purchases and license entitlements are unchanged; no new checkout backend goes live without a verified payout and reconciliation path.
4. Radio or DJ outage does not block core navigation and local playback.
5. All published master songs remain in the manifest and originals are not deleted.
6. A restore from an independently stored backup is tested.
7. Rollback to the previous working provider is documented before DNS changes.
8. Changes pass `node tests/smoke.cjs` and live device checks; syntax-only passing is not browser verification.

See `operations/service-register.json` for the non-secret dependency inventory. Copy `operations/expense-ledger.template.csv` into a **private encrypted location** before entering costs or banking details.

## Unfinished prerequisites

- Verify the domain registrar and expiration.
- Confirm the actual hosting provider and permitted commercial use; choose an independent production host before migration.
- Identify every paid vendor, annual renewal, contract, bank account signer and processor.
- Implement a secure revenue-to-ledger reconciliation and approved autopay through providers; none is connected yet.
- Export, encrypt and **restore-test** the Vault, purchases and entitlements.
- Run outage simulations in a real browser and test rollback; do not mislabel syntax checks as an end-to-end test.
