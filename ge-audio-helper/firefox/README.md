# GE DJ Firefox Audio Source Helper

This helper gives the GE DJ page a clean list of Firefox audio sources instead of the operating-system screen/window list.

It reports:
- Firefox tabs that are currently audible.
- YouTube, SoundCloud, Bandcamp, and Spotify web tabs that are available as media sources.
- The real tab title, so GE DJ can display the current YouTube video name.

It does **not** bypass Firefox or Windows capture permissions and it does not silently capture a tab. Its first job is source discovery/filtering.

## Temporary install in Firefox

1. Open `about:debugging`.
2. Open **This Firefox**.
3. Choose **Load Temporary Add-on**.
4. Select this folder's `manifest.json`.
5. Reload GE DJ.

A permanent packaged/signed version can be created later.
