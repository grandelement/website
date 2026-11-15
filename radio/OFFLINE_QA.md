# Grand Element Radio 40: Installed Offline Player QA

Status: draft pull request. Do not call this tested on iPhone until the Airplane Mode steps below pass on a real device.

## Preparation
1. From iPhone Safari, visit Grand Element Radio while connected.
2. Share > Add to Home Screen > Add. Open the new Grand Element Radio Home Screen icon.
3. Do NOT prepare downloads in the Safari tab. Home Screen web apps can use separate storage.
4. In the installed app, open OFFLINE. Verify it reports HOME SCREEN APP.
5. Enter the authorized CODE. Return to OFFLINE and choose PREPARE FOR OFFLINE.
6. Keep the app foregrounded until downloads finish. The package includes the service-worker shell, published authorized songs, station IDs, album art, and published backgrounds.
7. Run CHECK READINESS. Verify the installed startup engine, the planned music count, and the station ID count. Read the status; it must say READY FOR OFFLINE before proceeding.

## No-connection restart
1. Close the installed app completely.
2. Enable Airplane Mode, disable Wi-Fi, and reopen the app from its Home Screen icon.
3. Confirm the full Radio player opens from its locally cached entry without requiring Safari, Vault, a login, or a network connection.
4. Press PLAY. Confirm saved audio actually plays and NEXT / PREVIOUS work.
5. Open MUSIC. Select saved tracks or a previously created playlist. Confirm it plays through the main Radio transport with no preview iframe or online gate.
6. Open SUN LAB. Test PLASMA, SPECTRUM, GLOW, WATERFALL. Confirm local audio analysis drives SPECTRUM and WATERFALL without muting playback. A visual analyser error must never silence music.
7. While still in Airplane Mode, choose OFFLINE > RELOAD / UPDATE. Confirm the saved app reopens and music still plays.

## Connected updates
1. Re-enable internet. Upload a new published recording and regenerate its published catalog.
2. Open OFFLINE > RELOAD / UPDATE.
3. Confirm the new song is available online. Enter CODE for an authorized offline download if prompted; the previously saved music must remain available.
4. Save or prepare the updated offline package. Recheck readiness, then repeat the Airplane Mode restart.
5. Verify existing playlist names, song selections, SUN LAB profiles, and purchased rights were not erased.

## Recovery and safety
- Interrupt a download with STOP. Restart it and confirm already saved music is kept.
- Run CHECK & REPAIR with a missing component and confirm it repairs only when connected.
- Verify DELETE SAVED SONGS requires confirmation and does not erase playlists.
- On low storage, iOS may remove web app files; the readiness check must detect missing files. Neither Apple nor the website guarantees permanent storage.
- Full native iPhone audio session and storage behavior cannot be certified by Node/Chrome tests. Preserve this as a separate physical-device gate.
