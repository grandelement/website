# Grand Element Radio OFFLINE: one MUSIC workflow

## Architecture

- MUSIC is the only owner of the offline download controls and listener song/playlist selections.
- The Radio footer OFFLINE button opens MUSIC's OFFLINE workspace. There is no second download window.
- MUSIC's compact OFFLINE strip is another shortcut to that same workspace. It mirrors one progress callback, percent and time remaining, without a second engine.
- `ge-music-v5.js` owns presentation, the four choices, progress and STOP.
- `offline-manager.js` owns permitted download planning, saved-file checks, retry, song caching, station IDs, art and offline readiness. It owns no screen and cannot change purchases, playlists or codes.
- `sw.js` owns offline startup shell and byte-range delivery; it never invalidates downloaded MP3s on an interface update.

## iPhone listener flow

1. Open Radio from the installed Home Screen icon, connected to Wi-Fi.
2. Tap OFFLINE (front Radio or inside MUSIC). Both open the SAME MUSIC workspace.
3. Choose one of ALL MUSIC (default), CHECKED SONGS, PLAYLIST or UPDATE MISSING.
4. Tap **DOWNLOAD** once. Already saved music is skipped. A valid OFFLINE code is required to add new songs, not to listen to saved songs.
5. Wait until the status says READY. PARTIAL means it is not complete; existing downloaded songs remain usable.
6. Close Radio, enable Airplane Mode, reopen the Home Screen icon. Check startup, PLAY, NEXT, playlist, SUN LAB SPECTRUM and WATERFALL.
   - Older installed icons may open `/radio/offline-home.html`; the updated launcher must reuse a stored `/radio/index.html` directly before any network navigation.
   - If the older launcher persists, reconnect while **inside the installed Home Screen app**, tap OPEN RADIO online to update its service worker, then test again. Do **not** remove the Home Screen icon or clear website storage before safeguarding downloads.
7. When connected, select UPDATE MISSING to fetch only absent or newly published authorized files. Do not delete saved music.

## Regression acceptance gates

- The front OFFLINE button must open the MUSIC shadow-root OFFLINE workspace; the MUSIC OFFLINE button must open exactly that same screen.
- One primary DOWNLOAD button, four choices and visible progress; no separate OFFLINE CONTROL CENTER or destructively labeled DELETE action.
- MUSIC song selection, playlist identity and saved order must remain intact after downloads.
- Unverified users cannot fetch new restricted audio; saved authorized music remains playable locally even after the online session ends.
- The installed engine must verify the current HTML and required scripts before reporting READY.
- Incomplete audio, missing station clips or an outdated engine is NOT READY. STOP keeps previously saved recordings.
- Full iPhone Airplane Mode startup, storage eviction and visualization performance must be validated on the physical device. Desktop browser and Node checks cannot certify iOS storage limits.
