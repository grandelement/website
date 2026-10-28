# GE Studios — Text Layout and Alignment Rules
Updated 2026-10-28. Applies to the GE website, Radio, Music, Back Room and new UI.

## Permanent formatting rule
- If a phrase must occupy two lines, break at a meaningful word or phrase boundary. Favor visually balanced lines, not a long first line with a single orphan word.
- Centered headings, explanatory notices and centered status text use `text-wrap:balance` where supported, with an ordinary word-wrap fallback. Keep their original centered alignment.
- Content pinned to the left (form labels, song rows, playlist titles and names) remains left aligned even if wrapped. Do not accidentally center it.
- Don't force all text to wrap: marquees, small transport glyphs, scoreboards, timestamps and compact navigation have intentional one-line constraints.
- Do not duplicate labels or add a second control row just to fit text.
- Keep button labels accessible, readable on narrow iPhones, and avoid covering adjacent controls. Prefer a deliberate line break or reflow at narrow widths rather than clipping.
- Use explicit `\n` or small inline line spans when exact editorial breaks are required for a stable fixed label. For dynamic content (fan names, track titles), balance naturally at word boundaries; never insert breaks into account IDs, tokens or song paths.
- Never reveal access keys, tokens, or secret code hashes in user-visible labels. The Music header gets its listener name only from a verified Vault session's separate `display_name` property.

## Sitewide source audit — 2026-10-28
Reviewed `index.html`, `radio/index.html`, `backroom/index.html` and the Shadow DOM module `radio/ge-music-v5.js`.

The website source contained 36 `white-space:nowrap` declarations, Radio 23, and Back Room 6. Many govern ticker animation, orbit/scoring labels, fixed transport buttons or compact controls; wholesale replacement would break existing interfaces. None used `word-break:break-all`. These counts are a source audit, not a pixel-by-pixel browser viewport test.

Specific safe changes:
- Home Radio status: centered, balanced wrap; no clipping on narrow widths.
- Radio Gate title and Radio connection status: balanced and center aligned, allowing multi-line status messages when needed.
- Music header: a left-aligned, balanced listener name immediately to the left of the purple ACCESS CODE button. The song list stays left aligned and the original audio-title/Now Playing ticker behavior is untouched.

Regression guard: `tests/ge-unified-playlist-library.test.mjs` checks Music's listener display label and its separation from the secret. `tests/ge-safari-layout-mode.test.mjs` covers device layouts. Any further CSS changes to the game HUD, responsive control grids, animated ticker or main Radio title require dedicated iPhone portrait/landscape screenshots and comparisons before release.

## Security and ownership
In Back Room → Access Codes:
- `ACCESS CODE` is the private credential the guest enters and is managed separately from its name.
- `LISTENER NAME` is public-facing metadata (e.g. `John B`) and is attached to the same D1 code record by its stable code ID.
- Music's signed session and Radio Gate receipt carry only the listener name after successful validation. If no name was configured, show a generic active-code marker, not the secret.
- Changing a name must not rotate a code, change the selected songs/playlists, reset the expiration clock, or consume additional uses.
