# GE AUTO — native offline Android prototype

Install the debug APK from the GE AUTO Android APK workflow artifact on a compatible Android head unit (Android 6+, first test target Android 13). The launcher uses the actual GE Radio icon and the sun uses the exact GE Radio logo from the website. No browser, Internet permission, analytics, or web runtime.

Transfer authorized existing GE MP3 files via USB or radio storage, organized into album folders. Select IMPORT MUSIC / USB and choose the parent folder using the radio's system document picker. Imports copy files sequentially to app-private radio storage; no original audio is recompressed or deleted. Optional cover.jpg, folder.jpg, front.jpg, album.jpg or artwork.jpg is imported and displayed at a bounded decoded size. Existing same-size files are skipped; conflicting names are not overwritten. Music library is stored locally and no network is used. App uninstall removes its private music; keep the original USB files.

Music uses native MediaPlayer, a media playback foreground service, MediaSession transport, audio focus and audio becoming noisy handling. Use Android's home/back or another app; playback is intended to continue subject to the firmware and audio focus. The app resumes its last saved track and position on Play rather than automatically starting after ignition. EQ is optional, defaults off, and only samples the app's own audio session when visible. Android requires RECORD_AUDIO permission for its Visualizer API; no microphone recording code is used. Firmware may not implement Visualizer or document picker. A failed visualizer falls back to audio only. Use EQ while parked/passenger; driving mode is audio only.

## Prototype limitations / release gates
- APK is a debug-signed test build, not a production-signed release. Stable upgrade signing, native Android Auto/CarPlay integration, and a website CAR export button are separate tasks.
- Native Android head-unit install only. Android Auto and Apple CarPlay do not install this APK directly.
- Test on the real head unit: sideload, USB folder picker, offline import, playback and switching apps, ignition cycle, audio focus, media buttons, and EQ on/off, with no network. Some head units kill background services.
- First version uses a compact album/song list and a native measured spectrum, not the full browser Sun Lab renderer or all modes. Adaptive visual quality starts at 5 FPS and can rise to 10 FPS or disable EQ on slow frames. No universal hardware detection or performance guarantee.
- The importer does not read browser caches or bypass website access controls; copy only authorized offline music. Existing authorized music transfers use local files.
