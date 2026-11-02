import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const music=readFileSync('radio/ge-music-v5.js','utf8');
const radio=readFileSync('radio/index.html','utf8');
const worker=readFileSync('radio/sw.js','utf8');
new vm.Script(music,{filename:'ge-music-v5.js'});
assert.match(music,/<div class="brand" aria-label="Grand Element Music">MUSIC<\/div>/,
  'MUSIC window heading must be a single word');
assert.doesNotMatch(music,/GRAND ELEMENT · MUSIC<\/div>/,
  'Old wrapping title must be removed');
assert.match(music,/.header .brand\{flex:0 0 auto;white-space:nowrap/,
  'Title must remain on one line');
assert.match(music,/status\.hidden=true;\s*status\.textContent='';/,
  'Verified access must not expose expiry or a countdown');
assert.doesNotMatch(music,/'CODE ACTIVE · '.*' · EXPIRES '/,
  'No pre-gate warning in active Music view');
assert.match(music,/Number\(state\.musicAccess\.until\)>Date\.now\(\)/,
  'Vault code expiration enforcement must remain intact');
assert.match(music,/Number\(data\.session_expires_at\)\*1000/,
  'Signed session expiry should still be stored');
assert.match(music,/musicSessionEndpoint='https:\/\/vault\.grandelement\.com\/v1\/public\/access\/music-session'/,
  'Vault verification endpoint must remain intact');
assert.match(radio,/ge-music-v5\.js\?v=20261101-v717-compact-music/,
  'Radio must load new Music UI');
assert.match(worker,/2026\.11\.01-music-compact-top-v84/,
  'Radio application shell must be versioned for Safari');
assert.match(worker,/MEDIA_CACHE='ge-radio-media-v4'/,
  'Existing offline songs must not be erased');
console.log('PASS MUSIC header: no public countdown, smaller buttons, signed Gate preserved');
