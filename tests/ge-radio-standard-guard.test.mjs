import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

// PROTECTED WORKING STANDARD. Do not delete a required feature in an unrelated edit.
// Review GE_RADIO_PROTECTED_STANDARD.md before changing the assertions.
const read=path=>readFileSync(path,'utf8');
const music=read('radio/ge-music-v5.js');
const radio=read('radio/index.html');
const home=read('index.html');
const player=read('radio/preview-lab.html');
const sw=read('radio/sw.js');
const catalog=JSON.parse(read('radio/track-durations.json'));
const manifest=JSON.parse(read('radio/manifest.json'));
const registry=JSON.parse(read('playlists/registry.json'));
const requireText=(src,exp,what)=>assert.match(src,exp,'REGRESSION: '+what);
const requireNot=(src,exp,what)=>assert.doesNotMatch(src,exp,'REGRESSION: '+what);

// The published audio library is independent of the small saved-playlist lists.
assert.ok(Array.isArray(catalog.tracks)&&catalog.tracks.length>=90,'Track durations catalog unexpectedly lost songs');
assert.ok(Array.isArray(manifest.files)&&manifest.files.length>=90,'Music manifest unexpectedly lost songs');
assert.ok(catalog.tracks.some(x=>String(x.path).startsWith('ge-music/music/')),'Actual songs missing');
assert.equal(registry.playlists.find(p=>p.name==='Bangers')?.songs.length,33,'Bangers 33-song master changed without approval');
assert.equal(registry.playlists.find(p=>p.name==='Johnb')?.songs.length,15,'Johnb 15-song master changed without approval');

requireText(radio,/id="geMusicV5Button"/,'MUSIC launch button removed from Radio');
requireText(radio,/id="liveBtn"/,'RADIO mode button removed');
requireText(radio,/id="chooseSongsBtn"/,'Original Radio SONGS control removed');
requireText(music,/data-tab="songs"/,'SONGS tab removed');
requireText(music,/data-tab="playlists"/,'PLAYLISTS tab removed');
requireText(music,/state\.view='all';state\.arranging=false;state\.term='';/,'Reopen Music must restore SONGS without deleting selection');
requireText(music,/\.window\.arranging \.tools>\.browse\{display:grid!important/,'SONGS/PLAYLISTS tabs hidden during Arrange');
requireNot(music,/\.window\.arranging \.tools>\.browse[^\n]*display:none!important/,'Do not hide Music workspaces in Arrange');
requireText(music,/\.window\.arranging \.selectionBar\{display:flex!important/,'CLEAR/ARRANGE/PLAY footer hidden when arranging');
requireText(music,/class="clearSelected"/,'CLEAR footer button removed');
requireText(music,/class="arrangeBtn"/,'ARRANGE footer button removed');
requireText(music,/class="playSelected"/,'PLAY footer button removed');
requireText(music,/class="accessToggle"/,'Purple collapsible access control removed');
requireText(music,/class="arrangeDone"[^>]*>PLAY<\/button>/,'Arrange top PLAY button removed');
requireText(music,/class="arrangeLoadBtn"/,'LOAD button removed');
requireText(music,/class="arrangeSave"/,'SAVE button removed');
requireText(music,/class="gePlaylistTabGE"/,'GE playlist LOAD category removed');
requireText(music,/class="gePlaylistTabUser"/,'USER playlist LOAD category removed');
requireText(music,/class="gePlaylistConfirm"/,'LOAD SELECTED action removed');
requireText(music,/state\.selected=new Set\(p\.songs\.map\(canonical\)/,'Loading playlist must load original song order');
requireText(music,/const sorting=isArrangeView\(\)/,'Arrange mode must mark sortable rows');
requireText(music,/new Set\(ordered\)/,'Arrow reorder must preserve a unique ordered selection');
requireText(music,/setTimeout\(\(\)=>\{[\s\S]*?activateDrag\(session\)/,'Touch long press to slide must remain');
requireText(music,/scroller\.addEventListener\('touchmove'/,'Touch reorder movement must remain');
requireText(music,/scroller\.addEventListener\('mousedown'/,'Mouse drag reorder must remain');
requireText(music,/Move '\+track\.title\+' up'/,'Up button removed');
requireText(music,/Move '\+track\.title\+' down'/,'Down button removed');
requireText(music,/playCheckedSongs\(true\)/,'Arrange top PLAY must launch selected playlist');
requireText(radio,/GEPlayLibraryQueue\(queue,path,playlistName\)/,'Radio must hand exact ordered queue to Music player');
requireText(player,/selectedSongs=tracks\.slice\(\)/,'Music player must show current queue');
requireText(player,/openMusicList\(false\)/,'Music player must open the arranged list');

requireText(radio,/id="ge-protected-radio-red-pulse-v1"/,'RADIO inactive red fill/pulse protection removed');
requireText(radio,/#liveBtn\[aria-pressed="false"\]/,'RADIO must remain visibly red outside live mode');
requireText(radio,/geRadioLubDub/,'RADIO live heartbeat removed');
requireText(radio,/radio-start-cue/,'RADIO startup glow removed');
requireText(radio,/id="geMusicV5Button"/,'Music open control must remain in Radio');
requireText(radio,/id="geGate"/,'Music Gate must remain');
requireText(player,/AUDIO_LIMIT_SECONDS=2013/,'33:33 preview timer changed unexpectedly');
requireText(music,/GEGate\?\.isExpiredLocked/,'Music player Gate lock bypassed');

for(const [name,html] of [['home',home],['radio',radio]]){
 requireText(html,/id="ge-safari-request-website-mode"/,name+' Safari device override handling removed');
 requireText(html,/mobileUA\?'mobile'/,name+' ordinary iPhone mobile detection removed');
 requireText(html,/ge-safari-desktop-request/,name+' native Safari desktop mode choice removed');
 for(const [i,m] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
  if(/\bsrc\s*=|application\/json/i.test(m[1]))continue;
  new Script(m[2],{filename:name+' script '+i});
 }
}
new Script(music,{filename:'radio/ge-music-v5.js'});
new Script(player.match(/<script\b[^>]*>([\s\S]*?)<\/script>/)?.[1]||'',{filename:'Music player'});
requireText(sw,/const MEDIA_CACHE='ge-radio-media-v4'/,'Do not erase or rename cached listener audio');
requireText(sw,/ge-radio-shell-\$\{VERSION\}/,'Service Worker UI cache rotation missing');
assert.ok(read('GE_RADIO_PROTECTED_STANDARD.md').includes('## Mandatory Music interface'),'Protected standard document missing');
console.log('PASS GE RADIO PROTECTED STANDARD: full catalog, Bangers/Johnb, both tabs, drag+arrows, Music launch, red RADIO, Safari, Gate, media cache');
