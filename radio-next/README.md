# Grand Element Radio — Station 2

Development branch: `ge-radio-station-2`. Existing Blitz Station 1 and GitHub `main` remain untouched.

## Binding budget constraint: USD $0 only

The owner has **no money available**. Never recommend or authorize paid DigitalOcean, VPS subscriptions, paid backups, paid egress, trials that turn into paid services, upgrades, or auto-pay. No cloud provisioning is permitted until a specifically Always Free resource is confirmed available, a no-charge account is established, and all resource quotas/billing protections are checked. Station 1 remains the live fallback.

**Preferred free candidate (not guaranteed):** Oracle Cloud Infrastructure *Always Free* Ampere A1, currently allowing an aggregate of 2 OCPU and 12 GiB RAM monthly plus 10 TB/month outbound data on eligible resources. Oracle typically requires a payment card for identity verification, free capacity is often unavailable, and Oracle can reclaim idle free instances. Always Free is not a contractual uptime guarantee. Never upgrade the account or create paid resources. Official documentation: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm and https://docs.oracle.com/iaas/Content/FreeTier/freetier.htm .

The Debian Bookworm ARM64 packages exist for Liquidsoap and Icecast; actual backend operation, streaming throughput, and storage still require testing on a provisioned free instance.

**Free UI-only deployment:** Cloudflare Pages Free can host GE DJ static pages and update on GitHub push (current allowance 500 builds/month). It cannot run Icecast/Liquidsoap or a continuous audio process. For the existing Blitz backend, browser authentication and API origin permissions must be tested before routing DJ commands from another hostname. Avoid exposing secrets in static files.


## Architecture

- Station 1: Existing Blitz radio (`https://radio.grandelement.blitz.cloud/`). Retains its own settings and uninterrupted operation.
- Station 2: Independent Linux VPS, at the **proposed**, not yet active, DNS name `radio2.grandelement.com`.
- Radio 2 engine: Icecast + Liquidsoap + FFmpeg + GE Python DJ control service and library watcher. The existing backend is reused initially for continuity, but runs with separate credentials, persistent storage and process supervision.
- HTTPS: Caddy proxies long-running streaming connections to Station 2 and routes DJ HTML separately.
- DJ: `https://radio2.grandelement.com/dj/` after DNS/server setup. It uses its own origin for API calls, so commands for Station 2 never control Blitz.
- UI-only release: `radio-next/sync-ui.sh` changes the static files mounted into Caddy. It **never rebuilds or restarts the audio engine**, and writes `dj-build.json` from the actual deployed HTML bytes.
- Engine release: image build + health check + controlled maintenance rollout, independent from UI release. Test on staging before changing streaming infrastructure.

## Phase 1 checklist (requires a user-controlled, no-charge Always Free VM)

1. If an OCI Always Free account can be established **without a charge**, provision only an Always Free eligible Ampere A1 VM within the 2 OCPU / 12 GiB total limit. Do not upgrade the account. Verify an eligible free boot disk, networking and quotas in the account before creation; if unavailable, wait or use Blitz and the free UI-only plan. Use free monitoring and independently export encrypted state backups without buying backup products.
2. Install Docker Engine and Docker Compose plugin on the free VM; secure SSH and firewall to TCP 22 (restricted), 80 and 443. Confirm the architecture is ARM64 and audit image/package compatibility.
3. Clone the repository branch `ge-radio-station-2` to e.g. `/opt/ge-radio-two` on that confirmed Always Free VM.
4. Create `radio-next/.env` using `.env.example` and a **different** long random DJ password from Blitz. Never paste credentials into GitHub or chat.
5. Create a DNS-only A/AAAA record for `GE2_DOMAIN` pointing to the VPS. Do not proxy the MP3 stream through Cloudflare on the free plan.
6. Run `sh radio-next/sync-ui.sh` at the repository root. Confirm all UI files are in `radio-next/site/`.
7. Start from the `radio-next` directory: `docker compose up -d --build`.
8. Wait for Docker health checks and verify `/healthz`, `/control/healthz`, `/stream.mp3`, `/dj/`, and `/dj-build.json`.
9. Test music continuity overnight, login, independent playlists, DJ FX and remote mic before inviting listeners.
10. After the VPS is live, configure the included `.github/workflows/ge-radio-two-dj.yml` workflow. Set repository secrets `GE2_DEPLOY_HOST`, `GE2_DEPLOY_USER`, `GE2_DEPLOY_SSH_KEY`, and `GE2_DEPLOY_KNOWN_HOSTS`. Provision an unprivileged, UI-only server account with write access only to `/opt/ge-radio-two/radio-next/site`. Verify the SSH server host key out of band before pinning it; do not disable host-key checking.
11. Push a harmless UI-only commit and verify `dj-build.json` changes without any engine restart. DJ interface pushes to this branch will then sync automatically using GitHub Actions. **Engine code updates are not included in that workflow** and must be rolled out separately after safety tests.

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

Scaffold prepared only. **Strict $0 budget**. No VM provisioned, no DNS changed, no credentials created, no live deployment and no billing authorized. If Oracle's card requirement cannot be met or no Always Free capacity is available, no second live radio server can be promised; keep Blitz broadcasting and use only genuinely free front-end hosting while seeking an eligible always-on engine. The existing Blitz station is not modified.
