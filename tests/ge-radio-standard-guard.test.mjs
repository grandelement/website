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

// Owner revision 2026-10-30: BLITZ Radio 1 exclusively, auto-attempt on
// arrival, visible neutral RADIO control until real forward audio progress.
const pulseStyleStart=radio.indexOf('<style id="ge-radio-connected-red-dimmer-20261028">');
assert.ok(pulseStyleStart>=0,'REGRESSION: connected-only red dimmer stylesheet removed');
const pulseStyleEnd=radio.indexOf('</style>',pulseStyleStart);
assert.ok(pulseStyleEnd>pulseStyleStart,'REGRESSION: RADIO dimmer style not closed');
const pulseStyle=radio.slice(pulseStyleStart,pulseStyleEnd);
for(const text of [
 '@keyframes geRadioRedDimmerLubDub',
 'animation:geRadioRedDimmerLubDub 6.7s ease-in-out infinite!important',
 'opacity:1!important;pointer-events:auto!important',
 'background:rgba(9,30,49,.55)!important',
 'border-color:rgba(97,185,233,.47)!important',
 'prefers-reduced-motion:reduce',
 'width:max-content!important',
 'overflow-wrap:anywhere!important',
 'body #liveStatus,body #liveStatus.show',
 'display:none!important'
])assert.ok(pulseStyle.includes(text),'REGRESSION: missing approved RADIO behavior '+text);
requireText(radio,/const GE_RADIO2_DISABLED=true/,'Radio 2 must remain disabled for all public listeners');
const radioBackend=read('radio-backend/start-radio.sh');
const spectrumServer=read('radio-backend/spectrum-server.py');
const radioDocker=read('Dockerfile.radio');
// iPhone uses real Radio 1 FFT without creating a second HTMLAudioElement.
requireText(radio,/async function pollBlitzSpectrum\(\)/,'iPhone BLITZ FFT poll removed');
requireText(radio,/https:\/\/radio\.grandelement\.blitz\.cloud\/eq\/spectrum\.json/,'Real BLITZ spectrum endpoint removed');
requireText(radio,/if\(GE_IOS_AUDIO\)\{[\s\S]*?void pollBlitzSpectrum\(\)/,'Safari spectrum path removed');
requireText(radioBackend,/location = \/eq\/spectrum\.json \{/,'Nginx spectrum proxy removed');
requireText(radioBackend,/start_spectrum\(\)/,'Optional spectrum supervisor removed');
requireText(radioDocker,/radio-backend\/spectrum-server\.py/,'BLITZ build omitted spectrum server');
requireText(spectrumServer,/\/stream\.mp3/,'Spectrum must analyze actual BLITZ master');
requireText(spectrumServer,/def fft_spectrum\(/,'Real audio FFT removed');
requireText(radioBackend,/location = \/wake-radio \{/,'BLITZ listener wake and return route missing');
requireText(radioBackend,/return 302 https:\/\/grandelement\.com\/radio\/\?radio=1&ge_blitz_return=1/,'BLITZ must return a real listener to Radio');
requireText(radio,/function wakeBlitzFromPageVisit\(\)/,'Radio must attempt a visitor browser navigation on arrival');
requireText(radio,/wakeBlitzFromPageVisit\(\);/,'Radio page load must trigger host wake attempt');
requireText(radio,/frame\.src='https:\/\/radio\.grandelement\.blitz\.cloud\/'/,'Wake must be a real browser iframe navigation to live BLITZ root');
requireText(radio,/function browserWakeOnRadioTap\(\)\{return false\}/,'Un-deployed wake route 404 must never redirect a listener');

requireText(radio,/if\(GE_RADIO2_DISABLED\)return retryRadio1Only\(reason\)/,'Radio 2 failover bypass removed');
requireText(radio,/void requestRadioStart\(\{deferPlay:qrArrival\}\)/,'Radio must try BLITZ on page arrival');
requireText(home,/website-live\.js\?v=3/,'Homepage must load automatic BLITZ controller');
const homeRadio=read('radio/website-live.js');
requireText(homeRadio,/if\(allowed\(\)\)start\(\)/,'Homepage must attempt original BLITZ station on arrival');
requireText(homeRadio,/STREAM='https:\/\/radio\.grandelement\.blitz\.cloud\/stream\.mp3'/,'Homepage stream must remain BLITZ');
requireText(home,/ge-home-radio-connected/,'Homepage heartbeat only after verified stream');
requireText(radio,/document\.body\.classList\.toggle\('ge-radio-audible'/,'Radio heartbeat not tied to actual player');
requireText(radio,/button\.textContent='RADIO'/,'RADIO text must always be visible, even when reconnecting');
requireText(radio,/document\.body\.classList\.add\('ge-radio-pulse-ack'\)/,'First listener RADIO tap must acknowledge the heartbeat');
requireText(radio,/liveState\.hadVerifiedStream=true/,'Radio connection must require forward-time progress');
requireText(radio,/audio\.muted=!liveState\.userActivated/,'Radio page must start silently before user plays');
requireText(radio,/ge-radio-verified\.ge-radio-pulse-ack/,'Acknowledged Radio must stay solid red on voluntary pause');
requireText(radio,/function restoreRememberedRadioDevice\(/,'Verified device restoration must run after reload');
requireText(radio,/Date\.now\(\)-lastRadio1Progress>8000/,'RADIO tap must retry a stalled primary');
requireText(radio,/function setLiveStatus\(text,show=true\)/,'Underlying live status removed');
requireText(radio,/115000/,'Radio 1 watchdog shortened');
requireText(radio,/RADIO 1 · STARTING · PLEASE KEEP THIS PAGE OPEN/,'Long startup message removed');
requireText(radio,/RADIO 1 · STILL CONNECTING · AUDIO WILL START WHEN READY/,'Radio 1 warm-up window removed');
requireText(radio,/#shipStage button\[data-proxy="liveBtn"\]/,'Ship RADIO button state removed');
requireNot(radio,/id="ge-protected-radio-red-pulse-v1"/,'Old always-red style restored');

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
requireText(radio,/id="ge-radio-ios-visible-viewport"/,'iPhone Safari toolbar height detection removed');
requireText(radio,/ge-safari-browser-compact/,'Dynamic Safari compact layout removed');
requireText(radio,/id="radioCopyright"/,'Copyright footer removed');
requireText(radio,/id="reloadBtn" hidden/,'Reload button removed');
requireText(radio,/id="offlineBtn" type="button"/,'Permanent OFFLINE button missing');
requireNot(radio,/id="offlineBtn" hidden/,'OFFLINE must not start hidden');
requireText(radio,/offlineButton\.hidden=false/,'OFFLINE must remain visible when the Gate is locked');
requireText(radio,/offlineButton\.setAttribute\('aria-disabled',String\(!permissions.offline\)\)/,'OFFLINE locked state must follow verified Vault permission');
requireText(radio,/if\(!geRadioUtilityAllowed\('offline'\)\)\{/,'OFFLINE actions must require verified Vault permission');
requireText(radio,/window.GEGate\.openCodeEntry\(\)/,'Locked OFFLINE button must offer CODE entry');
requireText(radio,/ge-radio-offline-always-visible-20261031/,'Always-visible OFFLINE layout missing');
requireText(radio,/shipOffline\.hidden=false/,'Ship OFFLINE control must remain visible');
requireText(radio,/setUtility\(\$\('reloadBtn'\),permissions.reload\)/,'Reload must require verified Vault scope');
requireText(radio,/const verified=!!r&&r.verifiedFor==='radio'/,'Offline and Reload must require a verified Vault radio receipt');
assert.ok(radio.includes("((feature==='offline'||feature==='reload')&&r.sunLab===true)"),'Verified original LOVE must restore its Offline and Reload tools');
assert.ok(radio.includes('return new URL(CONFIG.LIVE_STREAM_URL,location.href).href;'),'Radio must request the canonical BLITZ mount');
assert.ok(homeRadio.includes('return STREAM;'),'Homepage must request the canonical BLITZ mount');
assert.ok(!radio.includes("searchParams.set('_ge_live_edge'"),'Radio mount must not have proxy-breaking cache-busting query');
requireText(radio,/#bottomActions #reloadBtn:not\(\[hidden\]\)\{display:flex!important/,'Verified Reload must be visible');
requireText(radio,/#bottomActions #offlineBtn\[hidden\]/,'Unauthorized Offline button must remain hidden');
// Preserve the one-frame iPhone Radio contract and the rebuilt EQ space.
requireText(radio,/id="ge-radio-iphone-border-anchors-v1"/,'iPhone border-lock stylesheet removed');
requireText(radio,/ge-radio-iphone-locked/,'Safari visual viewport lock removed');
requireText(radio,/--ge-radio-visible-h/,'Safari height-to-layout binding removed');
requireText(radio,/#geDesktopUtilityStrip\{/,'Bottom utilities must anchor to the frame');
requireText(radio,/bottom:calc\(39px \+ env\(safe-area-inset-bottom\)\)/,'Bottom utility dimension must use safe inset');
requireText(radio,/#iamLaunchRow\[hidden\]/,'IAM defaults off until a code grants it');
requireText(radio,/sunLab:result\.capabilities\?\.sun_lab===true/,'Sun Lab must use authenticated Vault capability');
requireText(radio,/permissions\.iam,?/,'IAM must be checked before display');
requireText(radio,/geRadioSunLabAllowed/,'LOVE Sun Lab permission must be independently checked');
const vaultAccess=read('vault-worker/src/index.js');
requireText(vaultAccess,/capabilities:\{sun_lab:sunLabAuthorized\}/,'Original LOVE Sun Lab grant must originate in Vault');
requireText(vaultAccess,/"reload","iam"\]/,'I AM must be an independently opt-in Vault scope');
const backroomAccess=read('backroom/index.html');
requireText(backroomAccess,/name="brAccessScope" value="iam"/,'Back Room IAM scope selector missing');
requireText(music,/class="selectAllSongs"/,'Music select all must remain available');
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
console.log('PASS GE RADIO PROTECTED STANDARD: BLITZ Radio1 only, visible neutral retry, auto-attempt, progress-verified red heartbeat, music, Safari, Gate and cache');
