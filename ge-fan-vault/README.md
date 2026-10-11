# GE Studios — Fan Vault Profile and Engagement Alerts

Status: The fan profile enhancements are staged in the ge-vault-fan-profiles branch, NOT live. The GE Vault Worker source is not in the available GitHub repository, so server-side notifications and opt-in fan contact forms cannot yet be deployed or verified.

## Existing activity data

The production browser client is ge-vault-client.js. It POSTs to https://vault.grandelement.com/v1/public/event and sets an anonymous browser ID in localStorage and a session ID in sessionStorage. Existing website events include page visits, radio starts/pauses, track start, resume, seek, progress, completion, selected buttons/links/control changes, game events, form submit events and QR campaigns. It does NOT transmit typed form contents, passwords, all keystrokes, exact screen-video replay or raw IP from the browser. The authenticated DJ backend uses /control/vault/fan-detail to get history from /v1/admin/fan-detail. Backend IP retention is UNKNOWN without the Vault Worker/database source.

## Completed branch change

The GE DJ fan-detail view now offers observed-data activity insights, an automatically written factual recap, chronological event walkthrough (with per-session filter, step/play controls), and restricted CSV/log export. Walkthrough replays existing event summaries and timestamps, NOT the pixels of a screen session or typed keystrokes. Data derives solely from the currently loaded date range. No new tracking beacons were added. Exports exclude raw metadata and protect against CSV spreadsheet formula injection. Existing fan contact-consent indicators remain visible.

## Server integration still needed (NOT implemented)

1. Detect a returning *anonymous browser*, not a proven person, upon a new valid session with a previously seen anonymous ID. Suppress owner alerts for repeated reloads and send no more than one owner alert per fan per 24 hours.
2. Detect a first-time engaged music listener using actual sessions, at least two distinct songs and 120 seconds of real listening, with care not to count repeated track-progress heartbeats as new playback time. Do not count scheduled AutoDJ songs as actual listening.
3. Build opt-in owner alert settings (new engaged browser, returning browser, daily digest), off by default. Send to a verified OWNER recipient address through Cloudflare Workers Email Service restricted send_email binding. This can be free for verified account destination addresses on Workers Free, according to 2026 Cloudflare documentation. Check available domain and verified mailbox, sender configuration, and quota protections. No secret or email authorization in frontend code.
4. Keep an aggregated profile from anonymous browser ID, first/last activity, sessions, actual music listening time, favorite songs, QR campaign, approximate location, voluntary contact details, owner notes, marketing consent timestamp/purpose, and retention/deletion settings. Treat browser IDs as devices/browsers, not confirmed human identity. A shared browser, cleared storage, changing IP or Apple Private Relay breaks strong identity inference.
5. For contact names, email, mailing address or phone, use a separate voluntary signup/contact form, verify submitted email, require suitable marketing consent, and support unsubscribe. Do not reverse-enrich or scrape private identities/addresses based on IP address. Display an owner-entered nickname separately from voluntarily verified fan identity.
6. Optional actual browser session playback requires a separate session replay tool such as Microsoft Clarity, configured with visitor notice/consent as appropriate, comprehensive masking and a no-recording zone around passwords, private messages and personal input fields. Microsoft Clarity explicitly masks input box content in all masking modes; it does not provide a past replay for already collected Vault event history.
7. Restrict admin data to authenticated DJ; log owner exports; honor deletion/opt-out; set limited raw-event retention and minimize sensitive data. Do not email raw IP, home addresses, private typed content or unconsented personal details.

The existing private-message and access-request endpoints accept inbound requests; they are not automatically suitable for owner email alert sending. Never feed untrusted fan-supplied text to an unauthenticated email endpoint.

## Deployment notes

- The source for the backend at vault.grandelement.com is not present in the linked grandelement/website repository. Owner email delivery, durable profile changes and contact forms are not operational from this code-only change.
- The running Blitz container remains on an earlier version due to build quota; a GitHub branch change does not update its live DJ interface.
- The website has a hard USD $0 budget; no paid AI, hosting or email services.
- Once the backend and verified owner destination are available, deploy and test with synthetic fan events before turning on real alerts.

Official references:
https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/
https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-masking
https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention
