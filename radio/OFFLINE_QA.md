# Grand Element Radio OFFLINE: one MUSIC workflow

## Architecture

- MUSIC is the only owner of the offline download controls and listener song/playlist selections.
- The Radio footer OFFLINE button opens MUSIC's OFFLINE workspace. There is no second download window.
- `ge-music-v5.js` owns presentation, the four choices, progress and STOP.
- `offline-manager.js` owns permitted download planning, saved-file checks, retry, song caching, station IDs, art and offline readiness. It owns no screen and cannot change purchases, playlists or codes.
- `sw.js` owns offline startup shell and byte-range delivery; it never invalidates downloaded MP3s on an interface update.
- Required package: published authorized songs selected in MUSIC, 8 station ID clips, the Radio shell (player, scripts, catalog and playlists), 12 album covers, the GE logo, and the default 31.gif background. Download the essential graphics once; do not fetch the entire 200+ MiB decorative GIF gallery.
- READY requires verified cache entries for songs, station IDs, essential graphics, and startup shell. Report individual missing categories as PARTIAL, not READY. Browser checks cannot establish iPhone physical persistence.

## iPhone listener flow

1. Open Radio from the installed Home Screen icon, connected to Wi-Fi.
2. Tap OFFLINE (front Radio or inside MUSIC). Both open the SAME MUSIC workspace.
3. Choose one of ALL MUSIC (default), CHECKED SONGS, PLAYLIST or UPDATE MISSING.
4. Tap **DOWNLOAD** once. Already saved music is skipped. A valid OFFLINE code is required to add new songs, not to listen to saved songs.
5. Wait until the status says READY. PARTIAL means it is not complete; existing downloaded songs remain usable.
6. Close Radio, enable Airplane Mode, reopen the Home Screen icon. Check startup, PLAY, NEXT, playlist, SUN LAB SPECTRUM and WATERFALL.
7. When connected, select UPDATE MISSING to fetch only absent or newly published authorized files. Do not delete saved music.

## Regression acceptance gates

- The front OFFLINE button must open the MUSIC shadow-root OFFLINE workspace; the MUSIC OFFLINE button must open exactly that same screen.
- One primary DOWNLOAD button, four choices and visible progress; no separate OFFLINE CONTROL CENTER or destructively labeled DELETE action.
- MUSIC song selection, playlist identity and saved order must remain intact after downloads.
- Unverified users cannot fetch new restricted audio; saved authorized music remains playable locally even after the online session ends.
- The installed engine must verify the current HTML and required scripts before reporting READY.
- Incomplete audio, missing station clips or an outdated engine is NOT READY. STOP keeps previously saved recordings.
- Full iPhone Airplane Mode startup, storage eviction and visualization performance must be validated on the physical device. Desktop browser and Node checks cannot certify iOS storage limits.
