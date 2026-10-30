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
const storeCatalog=JSON.parse(read('support/catalog.json'));
const siteConfig=JSON.parse(read('config/site-live.json'));

const requireText=(src,exp,what)=>assert.match(src,exp,'REGRESSION: '+what);
const requireNot=(src,exp,what)=>assert.doesNotMatch(src,exp,'REGRESSION: '+what);

// The published audio library is independent of the small saved-playlist lists.
assert.ok(Array.isArray(catalog.tracks)&&catalog.tracks.length>=90,'Track durations catalog unexpectedly lost songs');
assert.ok(Array.isArray(manifest.files)&&manifest.files.length>=90,'Music manifest unexpectedly lost songs');
assert.ok(catalog.tracks.some(x=>String(x.path).startsWith('ge-music/music/')),'Actual songs missing');
assert.equal(registry.playlists.find(p=>p.name==='Bangers')?.songs.length,33,'Bangers 33-song master changed without approval');
assert.equal(registry.playlists.find(p=>p.name==='Johnb')?.songs.length,15,'Johnb 15-song master changed without approval');
const legacyAlbums=['Fundamental Groove','Trio','Live!','Sessions I','Sessions II'];
for(const album of legacyAlbums)
 assert.ok(!storeCatalog.music.some(a=>a.title===album),'Legacy album improperly on sale: '+album);
const approved=new Set(siteConfig.music.radioMasterSongPaths);
for(const added of [
 'ge-music/music/Grand Element - 2010 - Intergy/Intergy_01_Stay In Union.mp3',
 'ge-music/music/Grand Element - 2011 - Love/Love_04_Love.mp3',
 'ge-music/music/Grand Element - 2021 - Spirit/Spirit_04_Celestial Dance.mp3'
])assert.ok(!approved.has(added),'New library-only song automatically approved for Radio: '+added);
requireText(music,/LEGACY_ALBUMS=new Set/,'Legacy album classification removed');
requireText(music,/className='legacyToggle'|elem\('button','legacyToggle'/,'Legacy album reveal control missing');
requireText(music,/showLegacyAlbums/,'Legacy albums no longer collapse');
requireText(music,/api\.github\.com\/repos\/grandelement\/website\/git\/trees\/main/,'Committed music discovery missing');
requireText(radio,/function radioDisplayMetadataTitle\(/,'Live Radio title parser missing');
// Extract only the standalone formatter so both Shuffle states can be checked.
const fnStart=radio.indexOf('function radioDisplayMetadataTitle(');
const fnEnd=radio.indexOf('function randomInt(',fnStart);
assert.ok(fnStart>=0&&fnEnd>fnStart,'Radio metadata formatter cannot be extracted');
const testState={shuffle:false};
const formatTitle=new Function('state',radio.slice(fnStart,fnEnd)+'return radioDisplayMetadataTitle;')(testState);
assert.equal(formatTitle('10 Prelude','Intergy'),'Intergy • 10 • Prelude');
assert.equal(formatTitle('Intergy • 10 Prelude'),'Intergy • 10 • Prelude');
testState.shuffle=true;
assert.equal(formatTitle('10 Prelude','Intergy'),'Intergy • Prelude');
assert.equal(formatTitle('Intergy • 10 Prelude'),'Intergy • Prelude');
assert.equal(formatTitle('04 Celestial Dance','Spirit'),'Spirit • Celestial Dance');


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

// The approved heartbeat is a dimmer-like red fill and restrained outward
// glow. It only appears after advancing native audio, and becomes steady red
// on the listener's first tap. The status DOM and messages remain in place,
// but the black banner is visually hidden until the user asks to restore it.
const pulseStyleStart=radio.indexOf('<style id="ge-radio-connected-red-dimmer-20261028">');
assert.ok(pulseStyleStart>=0,'REGRESSION: current connected-only RADIO dimmer stylesheet removed');
const pulseStyleEnd=radio.indexOf('</style>',pulseStyleStart);
assert.ok(pulseStyleEnd>pulseStyleStart,'REGRESSION: RADIO dimmer style not closed');
const pulseStyle=radio.slice(pulseStyleStart,pulseStyleEnd);
for(const text of [
 '@keyframes geRadioRedDimmerLubDub',
 'animation:geRadioRedDimmerLubDub 6.7s ease-in-out infinite!important',
 '.ge-radio-audible.ge-radio-pulse-ack',
 'pointer-events:none!important',
 'prefers-reduced-motion:reduce',
 'width:max-content!important',
 'overflow-wrap:anywhere!important',
 'body #liveStatus,body #liveStatus.show',
 'display:none!important'
])assert.ok(pulseStyle.includes(text),'REGRESSION: missing approved RADIO behavior '+text);
assert.ok(radio.includes("document.body.classList.toggle('ge-radio-audible'"),'REGRESSION: native audio-verified indicator missing');
assert.ok(radio.includes("document.body.classList.add('ge-radio-pulse-ack')"),'REGRESSION: listener cannot stop pulse');
assert.ok(radio.includes("if(!connected)document.body.classList.remove('ge-radio-pulse-ack')"),'REGRESSION: pulse does not reset on disconnect');
assert.ok(radio.includes("button.textContent=connected?'RADIO':''"),'REGRESSION: RADIO appears before connection');
assert.ok(radio.includes('function setLiveStatus(text,show=true)'), 'REGRESSION: underlying radio status handling deleted');
requireText(radio,/115000/,'Radio 1 startup watchdog is too short');
requireText(radio,/RADIO 1 · STARTING · PLEASE KEEP THIS PAGE OPEN/,'extended Radio 1 startup notice missing');
requireText(radio,/RADIO 1 · STILL CONNECTING · AUDIO WILL START WHEN READY/,'long-running Radio 1 notice missing');
requireNot(radio,/id="ge-protected-radio-red-pulse-v1"/,'obsolete always-red heartbeat stylesheet restored');
requireText(radio,/#shipStage button\[data-proxy="liveBtn"\]/,'Ship RADIO indicator must follow audio state');

// First paint must use the saved Radio layout before deferred scripts
// style the MUSIC button or accessibility-fit desktop more than once.
const accessClient=read('ge-accessibility.js');
requireText(radio,/id="ge-radio-first-paint-mode"/,'Prepaint Radio view selection removed');
requireText(radio,/class="ge-radio-initializing"/,'Radio initial-layout lock removed');
requireText(radio,/id="ge-radio-first-style"/,'Radio styles not ready before first paint');
requireText(radio,/document\.body\.classList\.remove\('ge-radio-initializing'\)/,'Radio initial-layout lock never released');
requireText(accessClient,/min-width:820px.*hover:hover.*pointer:fine/,'Desktop fit must not repeatedly recompute mobile sizes');
requireText(music,/class="selectAllSongs" type="checkbox"/,'Global SONGS select-all checkbox removed');
requireText(music,/allCheck\.indeterminate=/,'Partial SONGS selection state removed');
requireText(music,/el\('\.selectAllSongs'\)\.addEventListener\('change'/,'Global SONGS select-all behavior missing');
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
console.log('PASS GE RADIO PROTECTED STANDARD: catalog, playlists, controls, bounded Radio1 warmup, verified connected red dimmer, hidden status, Safari, Gate and cache');
