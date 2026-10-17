# GE Radio — Zero-Cost Scale Research (2026-10-16)

Status: **research and source verification**, not a capacity certification. The only live origin currently configured is BLITZ Icecast. **Do not edit/rebuild the running BLITZ image until backups, deployment path and a revert procedure are confirmed.**

## Immediate listener decision
- Public GE website radio: BLITZ `https://radio.grandelement.blitz.cloud/stream.mp3` only.
- Public frontend switches to Radio 2's Cloudflare-program BANGERS backup are **disabled** (not destroyed).
- GE DJ's separate Cloudflare Radio 2 switch UI and its publication scripts are disconnected.
- Radio 1 public Icecast retains the LIVE studio / BANGERS mixer and controls. Backend unchanged.
- The `ge-radio-sync` Worker is not shut down: the classic iMac depends on its private DJ control proxy for authorization. Do **not** delete the Worker.
- Cloudflare live deployment was not independently confirmed. Verify on physical browser and with a separate listener before promoting.

## Verified current configuration from source
- `radio-backend/start-radio.sh`: Icecast `<clients>40</clients>`; nginx `worker_connections 256`; BLITZ public stream `128k MP3`.
- Icecast's **clients** limit is configurable. Changing it does not grant unlimited egress bandwidth.
- At 128 kbit/s, 40 listeners need ~5.12 Mb/s audio payload (plus protocol overhead); 400 need ~51.2 Mb/s; 4,000 need ~512 Mb/s; 10,000 need ~1.28 Gb/s. Each listener streams independently unless upstream distribution is added.
- **Daily visits != simultaneous listeners.** Forty uninterrupted slots total 960 listener-hours per day. At a 10-minute average listening session this is theoretically 5,760 listening sessions per day with perfectly even arrivals and zero overhead, not a guarantee in a burst. A 4,000-visitor rush can still exceed forty simultaneous slots in seconds.
- Source: https://icecast.org/docs/icecast-latest/config_file.html

## Verified options / limitations (official provider pages)
| Option | Published free offer | Crucial restriction / verdict | Source |
|---|---|---|---|
| Current BLITZ + Icecast | Already running, backend limit 40 clients | $0 extra now; no measured 4,000-listener capacity. Don't blindly increase config. | GE repo; https://icecast.org/docs/icecast-latest/config_file.html |
| Listen2MyRadio | Advertises up to **5,000** free simultaneous listeners on Icecast/SHOUTcast | Ads fund the hosted station, and provider explicitly says listeners must use its own station subdomain. Not a confirmed ad-free embeddable grandelement.com relay, not independently load-tested. | https://www.listen2myradio.com/radio-streaming-free.php |
| Caster.fm Free Cloud | **400** listener slots, up to **96 kbps**, no card needed | Free station radio page carries ads; paid plan adds direct stream link and no ads. Test provider restrictions before considering a relay. | https://www.caster.fm/ ; https://www.caster.fm/free-cloud-stream-hosting/cloud-plus-streaming-hosting/ |
| MyRadioStream Free | Free SHOUTcast/Icecast account and embeddable player advertised | Provider reserves the right to add banner or **audio ads**. Free-plan listener count, direct-link restrictions and whether upstream Icecast relay is allowed remain **unverified**. | https://myradiostream.com/ |
| GoCast Free | **100** listeners, browser-based broadcast, no credit card, as advertised Sep 2026 | Browser source must stay open. Doesn't confirm ability to relay the existing permanent BLITZ master for free. Newly offered; uptime and real capacity **untested**. | https://gocast.fm/ |
| Primcast J999 | Advertises 1,000 listeners at 32 kbps, no monthly charge | Charges **$5 one-time setup**, so excluded by $0 rule; 32 kbps below target quality. | https://primcast.com/radio |
| SHOUTcast Basic | Free self-hosted DNAS software | **Hosting and outbound bandwidth are not free** just because software is. Paid hosted entry plan begins €50/year and has ad-insertion. | https://www.shoutcast.com/pricing |
| AzuraCast | Free open-source management and Icecast stack | Still self-hosted; does not furnish free large-scale network egress. | https://www.azuracast.com/ |
| Zeno.FM | Trial available | New accounts have **no permanent free streaming since Jan 2025**; active subscription needed after trial. | https://help.zeno.fm/en/article/plans-and-pricing-6f0z0h/ |
| Radio.co | 14-day trial | Subscription after trial; not a perpetual zero-dollar option. | https://www.radio.co/pricing |
| laut.fm | Ad-financed radio model | Advertising is part of subsidy, rights/platform restrictions apply; not a guaranteed ad-free embedded relay. | https://laut.fm/pages/advertisment |
| Cloudflare Pages static assets | Officially free/unlimited static asset requests; 25 MiB max file | Useful candidate for **prerecorded song files**, not yet a solution to **LIVE** uploads/crossfades. Free-plan terms and large-file/audio suitability must be checked; no promise of unmetered radio broadcast. | https://developers.cloudflare.com/pages/functions/pricing/ ; https://developers.cloudflare.com/pages/platform/limits/ |
| Cloudflare Workers Free | 100,000 requests **per day** | Not suitable for per-listener 7.5-second polling at mass scale. Previously used Radio 2's clock; disabled public client polling. | https://developers.cloudflare.com/workers/platform/limits/ |
| GitHub Pages | Soft 100 GB **per month** bandwidth | Not an uncapped audio CDN. | https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits |
| PeerTube / browser P2P | Open-source P2P + HLS-assisted live possible | Users share capacity, but bootstrap/origin, mobile backgrounds, availability, metadata, and live latency must be tested. No proven 1,000+ reliable listeners at $0. | https://docs.joinpeertube.org/admin/configuration |

## Ten synchronized Icecast servers hypothesis
**Supported in principle by Icecast docs**, not tested on GE.
- One BLITZ master broadcasts the final mixed audio (BANGERS plus LIVE, including fades), and each independent **relay** connects as a listener to that same master.
- Each relay gets the same master audio, eliminating ten independent playlists, but connections to separate relays can still have different buffering/latency.
- Ten Icecast *processes on the same laptop/uplink* do not create 10× bandwidth. Ten truly independent, free, permitted hosts could distribute capacity, with each host's own connection/bitrate policy.
- A player-side selection mechanism could place listeners among healthy relays, but requires TLS, reachability, rights, failure isolation and proper rate controls.
- Do **not** create multiple free accounts contrary to host rules, or use a host's free relays as a hidden embedded audio source when the provider requires its ad-supported page.
- Source: https://icecast.org/docs/icecast-latest/relaying/

## Laptop as an extra relay
- Good candidate for a **backup encoder or private test relay**; it can deliver **one** 128 kbps contribution to BLITZ with little upstream bandwidth.
- Bad mass-audience distributor without measured symmetric broadband / security and uninterrupted power. 40 listeners would already require ~5.12 Mb/s outbound at 128 kbps plus overhead; 400 about 51.2 Mb/s.
- Network may be behind CGNAT; avoid exposing machine publicly before securing and testing. The existing 2007 iMac should remain a music source, not a public-origin relay cluster.

## Hypothesis → verification steps
1. **Do not touch running BANGERS**. Confirm one BLITZ URL plays on an external phone; check active Icecast connections and origin uplink separately.
2. Choose one provider with genuinely free long-term terms. **Read provider rules and confirm direct stream URL and relaying permissions in writing** before connecting to live audio. Check ad requirements.
3. Create a **private, separate test stream** with explicit owner authorization, using the master BLITZ broadcast as relay input only after approval. Keep listeners on the current BLITZ station while testing.
4. Check 1 / 5 / 10 / 20 listener connections and transitions from BANGERS to LIVE; measure actual playback, failure rates, startup time, stalls and disconnect behavior. Do not exceed provider limit or generate synthetic bulk traffic without explicit permission.
5. With the provider's written load-test permission, test progressively toward the provider's stated 100/400/5,000 capacity and verify remote client audio. Advertised numbers alone do not prove actual capacity.
6. A large audience rollout requires live health reporting, real listener counts, safe retry/backoff, and a rollback to BLITZ; no hidden switch to unrelated prerecorded tracks.
7. Evaluate ownership/master/performance rights for all streamed recordings separately from server hosting. GE's own compositions do not automatically establish every collaborator's master or neighboring rights.

**Decision pending:** No currently verified provider meets all four requirements at once: $0 forever; no ads; brand-owned embedded player; and thousands of guaranteed simultaneous LIVE stream listeners. Our next real milestone is one tested, provider-authorized free relay, not ten hypothetical account signups.


## Combined zero-dollar systems: research update, October 16, 2026

These are *combinations*, not claims that GE has already passed a load test. The cumulative goals are $0 ongoing, ad-free, GE-branded player, same BANGERS + LIVE audio, and an eventual capacity target of thousands to 100,000 simultaneous listeners.

### Candidate A: BLITZ master + audio-only HLS + P2P browser swarm + volunteer nodes

- BLITZ remains the single source of BANGERS and LIVE studio transitions, unchanged for current listeners.
- Separate FFmpeg audio-only HLS encoder reads BLITZ once and writes numbered AAC segments at optional 128/96/64 kbps.
- Open-source [Novage P2P Media Loader](https://github.com/Novage/p2p-media-loader) plus hls.js shares those segments over WebRTC among browsers on the Grand Element website, reducing demand on the origin.
- The project's [official wiki has a live *audio-only* HLS example](https://github.com/Novage/p2p-media-loader/wiki#live-audio-stream-with-multiple-qualities). This establishes the feasibility of its input format, **not** a test of GE's listener capacity.
- Its [FAQ](https://github.com/Novage/p2p-media-loader/blob/main/FAQ.md) says public WebTorrent trackers are for development and **must not be relied on in production**; a private tracker can be run with wt-tracker or Aquatic.
- HLS segments must initially originate from normal HTTP(S). P2P does not eliminate the origin, and peers behind restricted networks may fail to connect.
- Current v4 library documentation supports iOS Safari 17.1+, not legacy iPhone 5; browsers and background-audio behavior need tests. Older devices use native Icecast when the 40-client budget permits.
- Viewer P2P sharing reveals IP addresses to other peers; disclose this and consider an opt-out. Participation cannot be assumed.
- Volunteers may contribute outbound bandwidth and host relay/seed nodes free of charge to GE; those resources are not free to their owners.
- Result: **Potential combined $0 GE bill, ad-free, native-player architecture.** Thousands and 100,000 concurrent listeners remain untested hypotheses. A reliable hard guarantee without stable donated capacity is not supported.

### Candidate B: BLITZ + legitimate Oracle Always Free seed/tracker + P2P

- [OCI Always Free](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) offers up to **10 TB outbound transfer each month**, plus compute within exact free quotas. Current official equivalent is **2 Ampere A1 OCPU / 12 GB memory**, not 4 / 24.
- Oracle's [signup guide](https://docs.oracle.com/en/learn/cloud_free_tier/) states most applicants need a **credit card** for verification. This excludes it for users who cannot supply a card unless a legitimate, authorized sponsor hosts it.
- Ten TB translates to about 17.4 hours of 10,000 simultaneous 128-kbps listening, ignoring overhead; it is not unlimited monthly delivery. VM network capacity is independently constrained.
- Result: plausible *secondary source/tracker* where legitimately available, but not guaranteed free 100,000 concurrency by itself.

### Candidate C: BLITZ + geographically independent volunteer Icecast relays

- [Official Icecast relay docs](https://icecast.org/docs/icecast-latest/relaying/) confirm multiple permitted hosts can each mirror the same one master broadcast; the master needs only one stream per relay.
- GE player can select available relays, retaining the original station sound and LIVE mix.
- Ten processes on a single laptop or broadband uplink do not create ten times its outbound bandwidth. These must be genuinely independent donated networks with permission and documented free terms.
- Result: ad-free, 0 bill to GE is possible when nodes are donated; actual peak capacity is bounded by donor bandwidth, connection reliability and the host rules.

### Candidate D: Combined A+B+C

- P2P + donated seed nodes + permitted Icecast relays is the only researched approach where capacity could **partly grow with participant contributions**, rather than proportionally charging GE for every listener.
- Maintain one BLITZ broadcast source, one GE interface, native fallbacks for devices without P2P, and measurable relay health.
- Critical limitations: sufficient seed capacity at first listener join; production-grade signaling, WebRTC NAT/TURN barriers, volunteer reliability, mobile limitations, measured outage recovery, IP privacy and rights clearance.
- No claim that 100,000 listeners will work until real testing demonstrates it.

### Cloudflare free CDN restriction: important finding

[Cloudflare Pages static requests](https://developers.cloudflare.com/pages/functions/pricing/) are advertised free and unlimited, **but** Cloudflare's [application/CDN service terms](https://www.cloudflare.com/service-specific-terms-application-services/) permit restrictions for websites delivering a disproportionate percentage of *audio or other large files* using its free CDN. Do not design a massive audio origin by assuming Pages or free CDN will serve unlimited live audio. Pages free asset size is [25 MiB](https://developers.cloudflare.com/pages/platform/limits/). [Workers Free](https://developers.cloudflare.com/workers/platform/limits/) is limited to 100,000 requests per day; avoid polling once per listener.

### Verification gates: no modification to current public BLITZ

1. Create **private test** for BLITZ read-only input to isolated FFmpeg audio-only HLS conversion. Verify the full BANGERS-to-LIVE fade and real buffering with two physical devices.
2. Add browser P2P player in a nonpublic test page, using a *permitted* tracker and HLS origin. Test with 2, 5, 10 listeners and measure peer-vs-origin downloaded bytes, actually audible music, latency and failures.
3. Test Safari iOS 17.1+, Firefox/Chrome desktop and native fallback to Icecast on older browsers. Validate IP/privacy notices.
4. Add one voluntarily hosted, permitted relay. Test sudden peer dropouts; check that the existing BLITZ feed continues uninterrupted.
5. Load-test 20, 40, 100, 400, then larger batches *only on owned/authorized infrastructure*. Measure source upstream Mbps, p95 startup, stalls, WebRTC success, peer contribution and costs. Do not run unapproved high-volume tests against free providers.
6. Do not tell fans GE supports 4,000, 10,000 or 100,000 simultaneous LIVE listeners until it has been verified at scale.

**Recommendation:** Explore the P2P-assisted *live audio* distribution plus volunteer relays first, without changing the public BLITZ feed or reintroducing Radio 2.
