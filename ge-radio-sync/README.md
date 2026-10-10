# GE Radio — synchronized clock and DJ source selection (FREE)

**Status: software staged, NOT LIVE.** Branch: \`ge-radio-station-2\`. Nothing has changed in the running Blitz station or production GE website yet.

## How the two independent stations work

- **BLITZ** remains the genuine, continuously mixed Icecast stream at \`https://radio.grandelement.blitz.cloud/stream.mp3\`, supporting existing DJ microphone/audio.
- **GE RADIO** is a deterministic, 24/7 UTC schedule derived from actual audio file durations. Listeners opening the GE Clock player jump into the scheduled song at approximately the correct position, even if nobody has had a browser open.
- The **GE Radio coordinator** is a free Cloudflare Worker with a SQLite-backed Durable Object. It holds which station should be heard and the exact UTC start/duration for the audience-wide crossfade. It does **not** continuously decode or broadcast music or relay live voice.
- The **new DJ booth** (\`radio/ge-dj.html\`) reuses the full GE DJ UI and controls Blitz's existing backend. Its top rail includes BLITZ and GE RADIO buttons. Switching asks for confirmation, uses the existing crossfade slider, and needs a separate owner-only secret.
- The **GE Clock player** (\`radio/ge-clock.html\` and \`radio/ge-clock.js\`) follows the state through \`/v1/state\` every ~7.5s; during a transition it runs both audio sources with equal-power gains on capable devices, with a compatible best-effort hard handoff on the older iPhone 5. A slow replacement does not mute the current audio.
- The existing GE Vault browser library records real audience listening. The older-browser player has a minimal ES5 Vault reporting fallback. Server-side song performance events on Blitz continue as before, but GE's theoretical 24/7 schedule must NOT be falsely reported as a live performance without an actual listener.

**Limitations you must not hide:** only listeners using the GE Clock player receive shared station switches. Existing third-party listeners opening the raw Blitz MP3 URL cannot be remotely moved. iOS background play, multi-audio output and old Safari volume controls may prevent perfectly smooth 8-second crossfades. Two stations cannot both carry your **live DJ microphone** without an actual rebroadcast/mixer channel on GE RADIO. Leave BOTH/simulcast disabled until a technically independent second live audio path exists. The old Blitz v167 server also cannot reflect frontend v171 changes until its deployment limit clears.

## Predeployment checklist

1. **$0 only.** Do not authorize paid providers, an auto-renewing trial or a paid Cloudflare tier. Current CF Free Durable Object allowances are subject to request limits; if a limit is reached, the coordinator may stop receiving state updates. Blitz remains untouched. Cloudflare docs: https://developers.cloudflare.com/durable-objects/platform/pricing/
2. **Measure music.** The GitHub Action \`.github/workflows/ge-radio-clock.yml\` runs \`.github/scripts/build_ge_radio_clock.py\`. It uses ffprobe + real MP3/M4A files to generate \`radio/sync-playlist.json\` with fixed epoch, track lengths, total cycle and playlist hash. It refuses missing/invalid metadata. Verify at least 20 songs and nonzero durations. The manifest must be deployed to \`https://grandelement.com/radio/sync-playlist.json\` before switching to GE RADIO.
3. **Deploy the Worker** on Cloudflare Workers Free (separate name \`ge-radio-sync\`); use \`ge-radio-sync/wrangler.toml\` and \`ge-radio-sync/worker.mjs\`. The account's workers.dev subdomain must be verified; the code currently references the **proposed**, not yet confirmed, endpoint \`https://ge-radio-sync.grandelement.workers.dev\`. Use Cloudflare Dashboard → Workers & Pages → Create → import GitHub repo or \`npx wrangler deploy --config ge-radio-sync/wrangler.toml\` from the repository root. This is a one-time setup. Do not create a paid service.
4. **Set the secret** with \`npx wrangler secret put GE_RADIO_SWITCH_TOKEN --config ge-radio-sync/wrangler.toml\` or through the Cloudflare dashboard's Worker secrets. Use a new long random secret; don't reuse the Blitz DJ password. Never commit it or send it in chat.
5. **Verify the program**: GET \`/v1/program\` must return complete actual durations; GET \`/v1/state\` must return \`{"station":{"to":"blitz",...}}\` by default. Test wrong-token POST returns HTTP 401. Test GE RADIO switch (with correct secret) returns a 20-second scheduled transition and the chosen crossfade length. A failed GE program must prevent switching.
6. **Static website deploy**: Publish the new \`radio/ge-clock.*\`, \`radio/ge-switch.js\`, \`radio/ge-dj.html\` and edited \`radio/index.html\` from the feature branch after backend is verified. Cloudflare Pages Git integration can publish automatically on GitHub push. Do NOT deploy partially working UI that would imply listeners are switched before the Worker exists.
7. **Test** on iPhone 11 + iPad + iPhone 5, each after one Play tap. Confirm the same song near the same position; check the actual speaker output, not merely the song title; on old iPhone 5, expect an abrupt handoff if smooth crossfade is unsupported.
8. **Safety tests**: do not switch off existing Blitz broadcasting, examine 5 minute and 24 hour continuous listening, confirm listener count and GE Vault fan analytics, verify every UI switch confirmation and prevent accidental shutdown, keep an audit trail of switch times and source names, preserve fallback to Blitz.

## Studio interface and codes

- Proposed coordinator URL: \`https://ge-radio-sync.grandelement.workers.dev\`
- Audience status: \`GET /v1/state\`
- Measured songs: \`GET /v1/program\`
- Authenticated confirmed switch: \`POST /v1/admin/switch\` with \`Authorization: Bearer <GE_RADIO_SWITCH_TOKEN>\`, JSON \`{"to":"ge"|"blitz","crossfade_seconds":8}\`
- Each switch is scheduled **20 seconds in advance** to let clients prepare, then takes 0–30 seconds according to the DJ's existing slider. A conflicting request during an active fade gets HTTP 409.
- The DJ web page prompts for the separate switch secret only when needed and keeps it in memory, not persistent storage.

## Release blocker

Cloudflare Worker/Durable Object creation and its secret have **not** been completed in the account. The existing GE Vault Worker source and its administrative deployment configuration are not in the connected GitHub repository. Do not falsely claim the new player controls real listeners, that the Worker is live, or that this changes the blocked Blitz container.

The safe next step is to connect/provision the **free** GE Radio Worker, verify its published manifest, and then release tested static UI to production \`main\` without rebuilding Blitz.
