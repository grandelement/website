# GE Studios radio ghost-page incident: routing and offline-cache audit
Date: 2026-11-14
Scope: current GitHub main and proposed repair branch. This is a code audit, **not** proof of deployment to grandelement.com or a reproduced Safari session.

## Confirmed defects and remediation
1. The public home and Radio pages automatically redirected to the **different** `/lite/` Radio interface on slow connections, data-saver settings, deviceMemory <= 1, narrow screen, or unsupported syntax. This makes an unexpected different website entirely plausible, independently of a tapped link. The repair changes lite-mode redirection to **explicit `?lite=1` only**. The lite page is preserved and labeled as Lite Mode.
2. `radio/sw.js` accepted previously cached Radio index HTML lacking the current build marker as offline fallback. It also consulted global cross-cache snapshots for secondary HTML and UI assets. The repair requires the current build marker, uses only the current Radio shell for UI fallbacks, and bumps the shell version. The separately downloaded music cache `ge-radio-media-v4` is preserved.
3. The website-level `sw.js` recovered older home HTML from prior `GE_SITE_SHELL_*` caches whenever the new page failed. It also allowed stale executable/CSS assets from arbitrary caches. The repair checks the current Home build marker, uses only the current shell for UI/navigation/executables, and prunes old UI shells after installing a valid new one. Shared downloaded music `GE_SHARED_OFFLINE_V2` is preserved.
4. Empty Radio Gate access-code entry navigated directly to `/support/?section=radio&flow=shop`. The repair leaves the visitor on Radio with an input message. The explicit membership link remains available.
5. Two separate service workers with distinct scopes and persistent media caches remain by design. Both workers are retained; their UI fallback behavior is isolated. Old shell caches can still exist on devices until the new service workers successfully activate online.
6. `/radio/ge-dj.html` has a deliberate user-agent-based redirect for classic Safari (<14) to `/dj/imac.html`. That alternate interface is **not** removed because the code documents a compatibility requirement; it could also explain an old-looking page when using older hardware.
7. Radio carries a permission-gated LEGACY music mode and multiple view modes. These were **not** deleted because they can affect access-code permissions and retained music entitlements. Do not conflate a legacy music catalog with an unauthorized old website.
8. `/radio/preview-lab.html` and `/radio/offline-player.html` are intentionally separate tools; these are not main Radio HTML and should remain independently reachable.

## Static audit
- Main inspected pages: `index.html`, `radio/index.html`, `backroom/index.html`, `lite/index.html`, `radio/preview-lab.html`, `radio/ge-dj.html`, `radio/offline-player.html`, `dj/imac.html`, `support/index.html`.
- JavaScript syntax parsed for inline scripts on Home (25), Radio (15), Back Room (3), Lite (1), Music Selection (1), and DJ (2); no parsing errors were found in this sample.
- Parsed actual HTML markup (excluding script/style text): no duplicate static element IDs in inspected pages.
- Reviewed explicit navigation links and representative route destinations. Not a full network crawl; Cloudflare and live browser runtime not accessible to this audit.
- Added tests in `tests/smoke.cjs` to reject the legacy fallback and automatic lite redirect.
- Radio service-worker scope remains `/radio/`; website worker scope remains `/`.
- Neither Vault records, access codes, payment entitlements, saved fan data, nor original audio media were altered.

## Remaining verification before calling it fixed live
- Confirm GitHub Actions smoke checks on this branch, then deploy.
- Visit `/`, `/radio/`, and `/lite/` on desktop, iPhone Safari, and an older device; verify all links, radio playback, code dialog, and the owner Back Room.
- Test online, a disconnected/offline reload, restored network, and service-worker update. Check that no old build loads, no downloaded music is deleted, and access-code redemption still calls the Vault.
- Inspect Cloudflare Pages/Workers/DNS routes, redirects, caches and `grandelement.com` production host. This repo alone does not establish those live settings.
- If an old interface persists, capture full address bar URL and browser/app type. Do **not** clear all site storage: that can erase downloaded music and saved local settings. Clear only confirmed obsolete UI caches after independent backup.
- Resume Fan Verification PR #93 separately. It is not deployed by this repair.
