import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const load=path=>readFileSync(path,'utf8');
const back=load('backroom/index.html');
const music=load('radio/ge-music-v5.js');
const preview=load('radio/preview-lab.html');
const radio=load('radio/index.html');
const publisher=load('backroom/publisher-worker.js');
const vault=load('vault-worker/src/index.js');
const registry=JSON.parse(load('playlists/registry.json'));
assert.equal(registry.format,'ge-playlist-registry-v1');
assert.equal(registry.playlists.find(p=>p.name==='Bangers')?.songs.length,33,'original BLITZ Bangers must remain intact');
assert.equal(registry.playlists.find(p=>p.name==='Johnb')?.songs.length,15,'publisher playlist Johnb remains intact');
// Test 2 is optional test data, not a protected publisher master.
// Never fail live Radio QA because an owner deletes a disposable test playlist.
const optionalTest2=registry.playlists.find(p=>p.name==='Test 2');
if(optionalTest2)assert.ok(Array.isArray(optionalTest2.songs),'Test 2 playlist songs must be valid when present');
assert.match(back,/geDJApi\('\/control\/playlists'\)/,'authentic DJ remains available');
assert.match(back,/await githubPlaylistAction\(\{action:'save',playlist:entry\}\)/);
assert.match(publisher,/handleGithubPlaylists/);
assert.match(publisher,/saveGithubPlaylistRegistry/);
assert.match(music,/state\.publicLists=data\.playlists\.filter\(valid\)/);
assert.match(music,/function visibleSharedLists\(\)/);
const allSongSelector=music.slice(music.indexOf('function chosenSongs(){'),music.indexOf('function albumSelectAll(',music.indexOf('function chosenSongs(){')));
assert.match(allSongSelector,/const allowed=new Set\(access\.allowed\)/,'restricted code permissions remain enforced');
assert.match(allSongSelector,/return state\.tracks\.filter\(track=>allowed\.has\(track\.path\)\)/,'ALL SONGS follows original album catalog order');
assert.doesNotMatch(allSongSelector,/access\.allowed\.map\(/,'playlist-first assignment order must never become all-song display order');
assert.doesNotMatch(allSongSelector,/if\(state\.accessPlaylistFilter\)/,'assigned playlist must not silently filter ALL SONGS');

assert.match(music,/function saveSharedArrangement\(\)/);
assert.match(music,/const id=current\?active\.id:previous\?\.id\|\|''/,'user SAVE reuses the existing fan playlist ID');
assert.match(music,/GE_BACKROOM_PUBLISH_SESSION_V1/,'guests cannot write publisher playlists');
assert.match(music,/USER PLAYLIST SAVED/);
assert.match(music,/active\.name\+' User'/,'GE playlist SAVE uses a User suffix');
assert.match(music,/Listener SAVE never alters the Back Room GE publisher master/);
assert.match(music,/workingKey\+':'\+workingScope\(\)/,'working playlist persists per code/browser');
assert.match(music,/function restoreWorkingOrder\(\)/);
assert.match(music,/if\(!restoreWorkingOrder\(\)\)/);

assert.match(music,/gePlaylistBar/);
assert.match(music,/class="geCodeIdentity"/,'Music header shows a separate listener name');
assert.match(music,/access\.displayName/,'Music must use only the signed session display name');
assert.match(back,/id="brAccessDisplayName"/,'Back Room owner can name the listener');
assert.match(back,/display_name:displayName/,'Back Room submits the distinct display name');
assert.match(vault,/access_code_display_names/,'Vault stores names separately from secrets');
assert.match(vault,/display_name:await codeListenerDisplayName\(env,row\.id\)/,'Radio Gate passes verified name');
assert.match(radio,/displayName:String\(m\.display_name/,'Radio carries name into Music receipt');
assert.match(radio,/ge-balanced-readable-text-20261028/,'Radio centered status uses balanced wrapping');

assert.match(music,/class="gePlaylistPicker"/);
assert.match(music,/class="gePlaylistTabGE"/);
assert.match(music,/class="gePlaylistTabUser"/);
assert.match(music,/function pickerRows\(\)/);
assert.match(music,/function loadSelectedPlaylistKey\(key\)/);
assert.match(music,/class="arrangeDone" aria-label="Play this playlist in the Music player">PLAY/);
assert.match(music,/el\('\.arrangeDone'\)\.addEventListener\('click',\(\)=>void playCheckedSongs\(true\)\)/);
assert.match(music,/GEMusicV5Bridge\?\.showMainPlayer\?\.\(\)/);
assert.match(radio,/showMainPlayer:\(\)=>geShowMainPlaylistPlayer\(\)/);
assert.match(radio,/frame\.GEPlayLibraryQueue\(queue,path,playlistName\)/);
assert.match(radio,/function geShowMainPlaylistPlayer\(\)/);
assert.match(radio,/id="gePlaylistQuick" hidden/,'playlist quick strip defaults to hidden');
assert.match(radio,/gePlaylistQuickQueue\.forEach/,'ordered songs displayed in quick list');
assert.match(radio,/frame\.GEJumpLibraryQueue\(i\)/,'song tap jumps through existing player');
assert.match(radio,/gePlaylistQuickSet\(playlistName,queue,playlistDetails\)/);
assert.match(preview,/window\.GEJumpLibraryQueue=function\(index\)/);
assert.match(preview,/path:currentTrack\?cleanMusicPath/);
assert.match(music,/custom=Array\.isArray\(queueOverride\)&&queueOverride\.length>0&&/,'single song playback must not open a playlist quick strip');
assert.match(music,/\{custom,labels\}/);

assert.match(radio,/if\(geInlineMusicActive\)\{\s*state\.shuffle=false;syncModeButtons\(\)/);
assert.match(radio,/state\.shuffle=false;syncModeButtons\(\);/);
assert.doesNotMatch(radio,/showPlayer:\(\)=>geInlineMusicShow/);
assert.doesNotMatch(music,/GEMusicV5Bridge\?\.showPlayer\?\.\(\)/);
assert.doesNotMatch(radio,/frame\.GEPlayLibraryTrack\(path\)/);
const mainQueue=preview.slice(preview.indexOf('window.GEPlayLibraryQueue=function'),preview.indexOf('window.GEPlayLibraryTrack=function'));
assert.ok(mainQueue.length>100,'Playlist queue handler must exist');
assert.match(mainQueue,/albumTracks=tracks;trackIndex=idx/);
assert.match(mainQueue,/tracks\.some\(track=>!valid\(track\)\)/);
assert.doesNotMatch(mainQueue,/openMusicList\(/,'Do not open a nested playlist screen on PLAY');

assert.match(preview,/window\.GEPlayLibraryQueue=function\(paths,startPath,playlistName=''/);
assert.match(preview,/selectedSongs=tracks\.slice\(\)/);
assert.match(preview,/selectedSongs=tracks\.slice\(\)/);
assert.match(radio,/ge-music-v5\.js\?v=20261029-v715-song-queue-loop/);
assert.match(music,/loadSelectedPlaylistKey\(key\)/);
assert.match(music,/playlistBar\.append\(nameField,loadButton,saveButton\)/);
assert.doesNotMatch(music,/playlistBar\.append\(savedSelector/);

assert.match(music,/class="accessToggle"/);
assert.doesNotMatch(music,/data-access-view="order"/,'redundant code MY ORDER removed');
assert.doesNotMatch(music,/AUTHORIZED MUSIC · MY ORDER/,'access breadcrumb removed');
assert.match(music,/el\('\.gePlaylistBar'\)\.hidden=cat!=='playlists'&&!state\.arranging/,'playlist name LOAD SAVE hidden on SONGS tab');
assert.match(music,/el\('\.arrangeBtn'\)\.addEventListener/,'Arrange button preserved');
assert.match(music,/function activateDrag\(/,'drag reorder preserved');
assert.match(music,/const up=elem\('button','reorder','↑'\)/,'move-up control preserved');
assert.match(music,/const down=elem\('button','reorder','↓'\)/,'move-down control preserved');
assert.match(music,/class="songFilter"/,'ALL SONGS filter preserved');
assert.match(music,/data-tab="songs"/,'SONGS tab preserved');
assert.match(music,/data-tab="playlists"/,'PLAYLISTS tab preserved');

assert.match(music,/class="clearSelected"/);
assert.match(music,/class="arrangeOwnerAuth"/);
assert.match(music,/fanVaultEndpoint/);
assert.match(music,/saveFanArrangement/);
assert.match(music,/loadFanPlaylists/);
assert.doesNotMatch(music,/SAVE COPY/);
assert.doesNotMatch(music,/function saveMine\(/);
assert.doesNotMatch(music,/class="buySelected buyBtn"/);
assert.doesNotMatch(music,/const buy=elem\('button','buyBtn'/);
assert.match(music,/UNLISTED · CODE REQUIRED TO PLAY/);
assert.match(music,/else setView\('ge-playlists'\)/);
assert.match(preview,/readGithub\(\),readVault\('\/v1\/public\/music-playlists'\)/);
assert.match(preview,/const AUDIO_LIMIT_SECONDS=2013/,'music remains on the existing 33:33 preview');
assert.match(radio,/ge-music-v5\.js\?v=20261028-v714-legacy-discovery/);
assert.match(vault,/fanMusicBearer/);
assert.match(vault,/ge-fan-playlists-v1:/);
assert.match(vault,/\/v1\/public\/fan-playlists/);
assert.match(vault,/\/v1\/admin\/fan-playlists/);
assert.match(publisher,/\/manage\/fan-playlists/);
assert.match(back,/brFanPlaylistsRefresh/);
assert.match(back,/id="brAccessFanCategory"/);
assert.match(back,/brAccessFanLinkSave/);
assert.match(back,/Public in GE Music:/);
assert.match(back,/PUBLIC SETTING NOT VERIFIED/);

for(const [name,html] of [['back',back],['radio',radio],['preview',preview]]){
 for(const [i,m] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
  if(/src=|application\/json/i.test(m[1]))continue;
  new Script(m[2],{filename:name+'-inline-'+i});
 }
}
new Script(music,{filename:'radio/ge-music-v5.js'});
new Function(vault.replace(/export default\s*\{/,'return {'));

new Function(publisher.replace(/export default\s*\{/,'return {'));

console.log('PASS unified GE playlists: authentic Bangers, owner master, private fan Vault, compact UI, 33:33 Gate');
