# GE PLAYLIST OPERATING NOTES — 2026-10-26

## One playlist master
The only owner-curated GE playlist master is `playlists/registry.json` in `grandelement/website`. Owner Back Room loads/saves through the authenticated publisher `/manage/github-playlists`. Song paths must match `radio/manifest.json`. A typed new name gets a new playlist ID; an existing name requires overwrite confirmation; deletion requires confirmation. Do not use Cloudflare Vault/D1 for these curated playlist records.

## One Music window
The Radio Music window is `radio/ge-music-v5.js`, build GE-MUSIC-V5.2-20261026. Tabs: ALL SONGS, ALBUMS, GE PLAYLISTS, USER PLAYLISTS. The same visible scroll container hosts all tabs. Selecting a GE or user list checks its constituent songs. Playback still passes through the existing Radio preview/access gate. The live Radio 1/2 Bangers schedule is unrelated; never alter it as a side-effect of saved playlist edits.

## iPhone scrolling invariant
Native scrolling was fixed by a flex column modal with a single flex scroll child. Do not replace this with an auto-height nested scroller or add global touchmove preventDefault. Keep the following unchanged:
- `.window` is `display:flex;flex-direction:column;overflow:hidden`.
- `.scroll` is `flex:1 1 0px;height:0;min-height:0;overflow-y:scroll;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch`.
- The Shadow DOM scroll area registers passive `touchstart` and `touchmove` listeners that stop propagation, preventing old outer Radio handlers from cancelling swipes.

## Current user-playlist status
The USER PLAYLISTS tab saves to this browser only (`GE_MUSIC_PERSONAL_PLAYLISTS_V1`). This is **not** cross-device or permanent server storage. Do not tell listeners their playlist is in GitHub or the Fan Base Vault until a private persistent fan playlist API actually exists and a reload from another device has succeeded. Do not put fan IDs, IP addresses, payment details, access codes or private preferences into public GitHub files.

## Fan analytics, already wired
The existing `ge-vault-client.js` is loaded by the Radio page. `ge-music-v5.js` now emits accepted `playlist_view` events when opening a saved list, and `control_change` events when checking/unchecking a song or saving a local user list. The private Fan Base Vault identifies sessions with first-party `anon_id` and `session_id`, with permitted network context handled server-side, not pushed into GitHub. These logs support future rankings of most chosen songs. A reporting query/dashboard and server-persistent per-fan playlists remain unfinished. IPs should not be treated as stable identities; many fans share IPs and IPs change.

## Required next integration
Implement private authenticated playlist storage keyed to existing anonymous visitor/fan records, with code and API contracts maintained in `grandelement/website` but records stored privately. Make GET, upsert, delete, fan access revocation and album/song order testable. Add admin aggregate counts by distinct anonymous/fan identity for each song; separate selection from completed listening. Then connect user UI to the server and test 1,000 independent playlists without cross-user reads or overwrites. All of this must coexist with the GitHub GE owner playlist master and existing Bangers live-radio queue.

## Deploy/test
The last successful owner screenshot confirmed Test saved and verified with seven songs in GitHub. New UI changes are in GitHub code. A GitHub Pages deployment plus an iPhone test are still needed before claiming the modified interface works live. CI regression checks include some failures; investigate failures separately, don't equate a clean JavaScript parse with a working device UI.
