# Grand Element Radio — Station 2

Development branch: `ge-radio-station-2`. Existing Blitz Station 1 and GitHub `main` remain untouched.

## Architecture

- Station 1: Existing Blitz radio (`https://radio.grandelement.blitz.cloud/`). Retains its own settings and uninterrupted operation.
- Station 2: Independent Linux VPS, at the **proposed**, not yet active, DNS name `radio2.grandelement.com`.
- Radio 2 engine: Icecast + Liquidsoap + FFmpeg + GE Python DJ control service and library watcher. The existing backend is reused initially for continuity, but runs with separate credentials, persistent storage and process supervision.
- HTTPS: Caddy proxies long-running streaming connections to Station 2 and routes DJ HTML separately.
- DJ: `https://radio2.grandelement.com/dj/` after DNS/server setup. It uses its own origin for API calls, so commands for Station 2 never control Blitz.
- UI-only release: `radio-next/sync-ui.sh` changes the static files mounted into Caddy. It **never rebuilds or restarts the audio engine**, and writes `dj-build.json` from the actual deployed HTML bytes.
- Engine release: image build + health check + controlled maintenance rollout, independent from UI release. Test on staging before changing streaming infrastructure.

## Phase 1 checklist (requires user-controlled DigitalOcean/VPS account)

1. Create a Linux VPS (initial suggestion 2 vCPU / 4 GB RAM); enable automatic backups and monitoring.
2. Install Docker Engine and Docker Compose plugin, secure SSH and firewall to TCP 22 (restricted), 80, and 443.
3. Clone the repository branch `ge-radio-station-2` to e.g. `/opt/ge-radio-two`.
4. Create `radio-next/.env` using `.env.example` and a **different** long random DJ password from Blitz. Never paste credentials into GitHub or chat.
5. Create a DNS-only A/AAAA record for `GE2_DOMAIN` pointing to the VPS. Do not proxy the MP3 stream through Cloudflare on the free plan.
6. Run `sh radio-next/sync-ui.sh` at the repository root. Confirm all UI files are in `radio-next/site/`.
7. Start from the `radio-next` directory: `docker compose up -d --build`.
8. Wait for Docker health checks and verify `/healthz`, `/control/healthz`, `/stream.mp3`, `/dj/`, and `/dj-build.json`.
9. Test music continuity overnight, login, independent playlists, DJ FX and remote mic before inviting listeners.
10. Only after testing, configure **GitHub push-triggered UI-only deployment** with a scoped deploy key or CI secret and keep station engine deployments explicitly separate.

## Separation and safety requirements

- Leave the Blitz station online and untouched; it does not share the new server's volume, keys or URL.
- Each station uses independent login credentials, playback state, playlist state and source identity.
- The UI station tabs **navigate**, they do not relay audio or send commands between stations.
- The UI must show which station you are controlling before any ON AIR or destructive controls.
- Changing a DJ screen must not stop the station or require build minutes.
- Health checks must test the audio stream, not just return an HTTP 200 page.
- Snapshot `station_data` (e.g. Docker volume backup) before changing the engine; test restoration.
- Account for egress bandwidth, listeners, and licensing before opening Station 2 publicly.
- Disable duplicate Vault performance reporting until distinct station identity is implemented.
- Important: the Caddy gateway relies on public DNS resolution and successful HTTPS issuance. The configured hostname is a placeholder until approved and provisioned.

## Current status

Scaffold prepared only. No VPS provisioned, no DNS changed, no credentials created, no live deployment and no billing authorized. The existing Blitz station is not modified.
