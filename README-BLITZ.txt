GE Radio v5.0 CLOUD SAFE

This build is deliberately tuned for the current blitz.cloud Docker rules.

PLATFORM FIT
- linux/amd64 Debian base
- runtime user/group 1000; no root or Linux capabilities required
- only public listener is nginx on 0.0.0.0:8080
- Icecast 8000, DJ API 8090, Liquidsoap control 1234 stay localhost-only
- Docker app remains a small Blitz app; the current published ceiling is 512 MB RAM and 0.5 CPU
- one kept folder only: /app/data; Blitz currently reserves 1 GB storage for an app with kept folders
- DJ_PASSWORD remains an environment variable
- GitHub-source deployment still requires the repository to be public

STABILITY CHANGES
- public nginx gateway starts before the music library fetch, so a temporary GitHub problem does not keep the whole app from becoming reachable
- internal services are supervised and restarted inside the container because Blitz does not auto-restart custom Docker apps
- saved station settings and custom mixes moved to /app/data instead of disposable /app/runtime
- Live DJ loader adds one local track at a time instead of handing Safari a whole crate at once
- local audio is attached lazily only when the user presses Play/Arm
- deprecated main-thread ScriptProcessor audio bridge replaced with AudioWorklet
- Live DJ code split into HTML, CSS, JS, and worklet files
- old heavy Debian/package layers are intentionally kept in the same order as v4.x so Blitz can reuse its build cache
- no giant base64 lines in Dockerfile

BLITZ SETTINGS
Dockerfile: Dockerfile.radio
Port: 8080
Background worker: OFF
Start command: blank
Environment: DJ_PASSWORD=<your private password>

Do not expose 8000, 8090, 1234, or 5555 publicly.


WEBRTC LIVE AUDIO (RECOMMENDED)
GE DJ and GE Studio can use Cloudflare Realtime SFU for the phone/browser-to-cloud audio leg.
The browser sends Opus over WebRTC to Cloudflare. Cloudflare's WebSocket media adapter sends
decoded 48 kHz stereo PCM to the existing Blitz radio mixer. The old direct PCM WebSocket path
remains as a fallback.

Add these Blitz environment variables:
CF_REALTIME_APP_ID=<Cloudflare Realtime SFU App ID>
CF_REALTIME_APP_SECRET=<Cloudflare Realtime SFU App Secret>

Optional:
GE_PUBLIC_RADIO_BASE=https://radio.grandelement.blitz.cloud

Create the Realtime SFU application in the Cloudflare dashboard. Keep the App Secret only in
Blitz Environment settings; never put it in DJ or Studio HTML.


GE VAULT PERMANENT SETTINGS
To mirror radio settings such as crossfade into the private GE Vault and restore them after a fresh radio deployment, add these Blitz environment variables:

GE_VAULT_URL=https://vault.grandelement.com
GE_VAULT_ADMIN_TOKEN=<private Vault admin token>

Keep GE_VAULT_ADMIN_TOKEN only in Blitz Environment settings. Never put it in DJ, Studio, radio HTML, GitHub, or browser JavaScript.
