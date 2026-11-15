import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const music=readFileSync('radio/ge-music-v5.js','utf8');
const radio=readFileSync('radio/index.html','utf8');

// This is a contract test for the shipped MUSIC Shadow DOM screen.
// Syntax is checked independently by the workflow's node --check.
assert.match(music,/function isArrangeView\(\)\{return state\.view==='playlist-display'\|\|/);
assert.doesNotMatch(music,/const playlistArrangeTop=elem\(/);
assert.match(music,/gePlaylistReorderHint/);
assert.match(music,/geSongsAlbumSquare[\s\S]*?aspect-ratio:auto!important/);
assert.match(music,/geSongsAlbumSquare[\s\S]*?height:46px!important/);
assert.match(music,/state\.view==='access-code'\|\|state\.view\.startsWith\('album:'\)/);
assert.match(music,/MUSIC CODE NOT ACTIVE[\s\S]*?finally/);
assert.doesNotMatch(music,/catch\(error\)\{\s*clearMusicAccess\(\);say\('MUSIC CODE NOT ACTIVE/);

// The small bar is gated by a verified Music access scope and sits in flex flow
// before the full-size playback footer, not floating above the song list.
assert.match(music,/geOfflineRow\.hidden=!enabled/);
assert.match(music,/el\('\.selectionBar'\)\.before\(geOfflineRow\)/);
assert.match(music,/geMusicOfflineComet/);
assert.match(music,/geOfflineVerified/);
assert.match(music,/p\.verified===true&&percent===100/);

// Progress after transfer completes is based on verified cached song counts.
// Selected target persists through reconnects until another request resets it.
assert.match(radio,/GE_MUSIC_OFFLINE_TARGET_V1/);
assert.match(radio,/publishVerifiedMusicOfflineStatus/);
assert.match(radio,/100\*cached\/audit\.totalSongs/);
assert.match(radio,/auditAssets\(scoped,\{copyExisting:true,readOnly:true\}\)/);
assert.match(radio,/if\(!readOnly\)\{[\s\S]*?offlineAvailability\.songs=songs/);
assert.equal(Math.round(100*10/12),83);
console.log('GE MUSIC song spacing, direct playlist order, Gate and verified OFFLINE dock contracts OK');
