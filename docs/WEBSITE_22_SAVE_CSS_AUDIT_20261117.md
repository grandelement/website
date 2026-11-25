# Website 22: Back Room SAVE and CSS audit (2026-11-17 UTC)

## Source evidence
Inspected the current `main` homepage, Back Room, Radio, server-side Publisher, Music router and GitHub Actions; compared with the established Website 22/Back Room workflow. These are source and automated-test findings, not proof of every live device and login.

| Item | Finding |
|---|---|
| Main site `index.html` | 68 inline CSS blocks; 1,844 `!important` declarations in inline styles |
| Back Room `backroom/index.html` | 10 inline CSS blocks; 261 `!important` declarations in inline styles |
| Main Back Room navigation | `#backroomMain .backroomTabs` is declared eight times in inline CSS; mobile sticky positioning previously intercepted clicks |
| Save controls | Website local draft, GitHub publication, radio route, GitHub playlist, Access Code Vault, fan Vault, original BLITZ DJ all have distinct handlers |
| Static HTML buttons | 126 Back Room `<button>` elements; no duplicate static HTML IDs found |
| Radio | `radio/index.html` has moved primary CSS into external stylesheets, rather than more appended inline patches |

## Confirmed architecture / authoritative write destinations

1. **Website public settings** (`welcome/about/visual/albums/easySettings/merchandise/games/gateTiming/radioMoon` and optional first-track/startup settings): owner-authenticated Back Room Publisher writes **only the selected changed keys** to `config/site-live.json` on GitHub. Requires conflict checking and readback. It must not replace the complete public file using a stale local draft.
2. **Radio MUSIC matrix** (`FRONT / STORE / PLAYER / RADIO`): existing `brRouteSave` goes through `/manage/player-profile`, action `save_catalog_routing`, preserving radio Master and playlist assignments. GitHub controls public routing but does **not** replace the authentic BLITZ live station queue.
3. **Saved GE playlists**: `playlists/registry.json` via the authenticated Publisher, not Fan Vault.
4. **Access codes and fan links/profiles**: existing owner-authenticated Vault endpoints; do not put credentials, fan identities or access history in a public GitHub file.
5. **Original BLITZ DJ playlist and on-air selection**: original DJ Booth remains authoritative. Save playlist does not mean USE ON RADIO 1. Radio 2 schedule is independent.
6. **Draft / Preset** is not the same as **published**. A device-local SAVE DRAFT must not report “live.”

## Central SAVE implementation in PR #136

- Four persistent controls: **RADIO, ACCESS CODES, FANS, SAVE**; Music lives under RADIO as designed.
- One SAVE delegates to the active screen's existing verified publisher.
- Public website settings use a new **allowlisted, conflict-safe, authenticated GitHub write** and GET readback; unrelated objects and music route keys are preserved.
- RADIO defaults to FRONT/STORE/PLAYER/RADIO matrix; opening an advanced Playlist / Master / Player disclosure opts into its specific existing save.
- ACCESS CODES saves to private Vault only after a selected code is open; FANS saves fan/code links or explicitly confirmed new profiles to private Vault.
- Obsolete primary SAVE DRAFT/PUBLISH GITHUB and mapped context save buttons are visually hidden; original handlers remain in the document for safe dispatch and regression compatibility.
- Errors must remain visible. Do not claim a save succeeded on button click alone.

## CSS failure patterns

- Repeating identical selectors across dated `<style id="...">` patches makes cascade order a hidden dependency. `!important` often masks earlier rules and breaks iPhone/desktop changes.
- The Back Room previously mixed sticky `.backroomTabs`, responsive grid rules and 2-column mobile overrides. Critical controls need one final scoped stylesheet, stable hit-target tests and proper device-specific behavior.
- Main website GAME HUD, About text, planet interactions and merchandise animation have separate historical patches. Automatically deleting or merging them would risk physics, playback and persisted settings.
- The earlier browser test still asserted a fourth **MUSIC** main tab after Music was moved into RADIO. The test has been updated to match the actual approved navigation and test SAVE.

## Remaining work, not yet verified by this PR

- Fully consolidate all legacy homepage CSS into modular stylesheets. Must be staged by GAME, SUN, RADIO, ABOUT, MERCH, accessibility and responsive behavior; each migrated selector requires visual/regression comparison.
- Verify real iOS Safari and Firefox mobile, desktop, service worker cache invalidation and live Pages deployment.
- Test an actual owner-authorized SAVE to Cloudflare Publisher / GitHub and inspect the resulting published configuration; tests currently use mocked credentials and GitHub data. Never create or modify a real access code as a public smoke test.
- Audit every working control with a behavioral map, not just static IDs. Especially Radio 1/2, DJ playlist selection, BUY flows and Fan Vault history.
- Investigate pre-existing failing radio, offline, access-code bridge and website smoke tests separately. A failing historical assertion is not proof the associated production feature is down.

## Regression contract
- `tests/ge-backroom-central-save.test.mjs`
- `tests/backroom-access-browser.test.mjs`
- `tests/private-vault-binding.test.mjs`
- `scripts/audit-ge-css-buttons.mjs`

**Safety rule:** No blanket “save everything” write, no resetting Fan Vault, no silent replacement of Radio 1/Radio 2 playlists, and no deletion of old selectors without baseline screenshots and passing tests.
