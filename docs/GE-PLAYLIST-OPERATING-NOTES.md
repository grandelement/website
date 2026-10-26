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

## 2026-10-26 owner iPhone playlist picker / selected-song visibility fix
- The `<datalist>` name chooser was not revealing saved names on the iPhone. `backroom/index.html` now has `brPlaylistPicker`, `brPlaylistName`, `brPlaylistOpenList` and `brPlaylistChoices`: tap the text box OR down-arrow to expose a real, scrollable list of all currently saved GitHub playlists. A new name can still be typed into the same field. Selecting a saved name loads it and closes the dropdown.
- The owner's **LOAD** button performs the same named load and resets prior music search and scroll position.
- `renderAllSongs()` puts all **checked tracks first in the exact saved order** under IN THIS PLAYLIST, then the remaining catalog under ALL OTHER SONGS. All songs stay in one scroll area, with checkboxes and song search. This prevents the previous illusion that a loaded playlist has no checked tracks because the list was scrolled midway through unrelated songs.
- Confirmed at the GitHub registry: `Test` and `Test 2` both exist separately with 7 songs each. The original screenshot only displayed an `LOADED · Test · 7 SONGS` status alongside unrelated unchecked songs.
- The fix is a repository change, not proof of live iPhone deployment; after Pages succeeds, reload the site and test opening name dropdown, selecting Test 2, viewing seven checked songs at top, and returning to Test without losing either.

## 2026-10-26 Music-first Back Room layout and combined playlist loader
Approved owner flow:
1. Sticky top section tabs, organized as website start/screens, Music/Radio/Moon/Gate, then Access Codes/Scores/Presets. Playlist tab is visually retired and playlists are **inside Music**. Keep original tab element hidden for legacy routing; old stored playlist-tab selection remaps to Music.
2. The original website-wide **VIEW WEBSITE / SAVE DRAFT / PUBLISH LIVE** buttons keep their existing IDs and handlers but are moved from the sticky header into **WELCOME** (the website-action area). Do not confuse Website Publish with saving a GitHub playlist; the latter commits independently via publisher.
3. At top of Back Room **MUSIC**: one playlist name input and just **SAVE** and **PLAYLISTS** buttons; search follows, then the **one scrollable catalog** of song checkboxes. The Radio Master list stays available but is collapsed under *Radio Master Settings* below the song checklist, not a competing playlist editor.
4. **PLAYLISTS** opens a real scrollable menu of saved owner GitHub playlists, each with a checkbox. Check one or multiple; click **LOAD SELECTED** *inside* the picker. One list loads its exact ID, name and song order. Multiple lists merge songs in selected-list order, remove duplicate paths, and clear an existing name to require saving as a **new** playlist. The original lists are never modified by a combined load.
5. **DELETE** is also inside the picker and only deletes one selected list, with confirmation. **SAVE** commits the currently checked song paths under the typed name. A name collision requires explicit overwrite confirmation and preserves the existing stable ID. An unfamiliar name creates a new GitHub playlist ID.
6. The scrolling song checklist displays selected songs first in saved order, then album-grouped remaining songs. Each album has a **whole-album checkbox** (including an indeterminate state for partly selected albums). The album checkbox selects/unselects all tracks from that album even if a song search is active. Song search and the checked state do not change backend data until SAVE succeeds.
7. This is an **owner Back Room** editor and its GitHub writer requires an authenticated owner session. Listeners' USER playlists in the public Radio MUSIC window remain device-only pending separately built private user storage, and may never write private fan data to the public registry.
8. The original BLITZ Bangers queue, backup Radio 2, DJ controller, and original song catalog remain untouched. Existing GitHub registry records `Test` and `Test 2` are independent and preserved. Browser/iPhone usability and Pages deployment still need explicit live checks; passing JS parsing is not equivalent to an on-device QA result.

## 2026-10-26 Back Room website-actions clarification from owner screenshot
The owner drew three red website actions (VIEW WEBSITE, SAVE DRAFT, PUBLISH LIVE) leaving the persistent top bar and arrows to the first four tabs (WELCOME / ABOUT / UNIVERSE / GAMES). The approved behavior is **the same three website actions present within each of those four website-related tabs**, not all grouped only in WELCOME, and no persistent large three-button row above the tabs. They are a single set of operations, not four independent publication records.

Implementation: `backroom/index.html`, GitHub commit `67705796a768`. The original elements/IDs `viewWebsite`, `save`, `publishLive` are moved to WELCOME and keep their original event handlers. About/Universe/Games have ID-free proxy buttons that invoke those same elements, while disabled/busy states and owner feedback are mirrored. Do not duplicate save/publish implementation or mislabel the three buttons as per-tab independent saves. The settings gear was removed from the top header by moving the original `backroomToolbarSettings` control (including text size, Reset, Lock) into a collapsed WEBSITE SETTINGS section in WELCOME. The navigation tabs remain sticky while the title/header scrolls away.

The user screenshot was of a previous deployed version; GitHub code and public deployment should be distinguished. Do not claim successful iPhone verification until checked on device.
