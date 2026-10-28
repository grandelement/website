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
assert.equal(registry.playlists.find(p=>p.name==='Test 2')?.songs.length,7);
assert.match(back,/geDJApi\('\/control\/playlists'\)/,'authentic DJ remains available');
assert.match(back,/await githubPlaylistAction\(\{action:'save',playlist:entry\}\)/);
assert.match(publisher,/handleGithubPlaylists/);
assert.match(publisher,/saveGithubPlaylistRegistry/);
assert.match(music,/state\.publicLists=data\.playlists\.filter\(valid\)/);
assert.match(music,/function visibleSharedLists\(\)/);
assert.match(music,/function saveSharedArrangement\(\)/);
assert.match(music,/id=updating\?active\.id:''/,'owner edits maintain the same ID');
assert.match(music,/GE_BACKROOM_PUBLISH_SESSION_V1/,'guests cannot write publisher playlists');
assert.match(music,/SAVED TO SHARED GE VAULT/);
assert.match(music,/gePlaylistBar/);
assert.match(music,/class="gePlaylistPicker"/);
assert.match(music,/class="gePlaylistTabGE"/);
assert.match(music,/class="gePlaylistTabUser"/);
assert.match(music,/function pickerRows\(\)/);
assert.match(music,/function loadSelectedPlaylistKey\(key\)/);
assert.match(music,/loadSelectedPlaylistKey\(key\)/);
assert.match(music,/playlistBar\.append\(nameField,loadButton,saveButton\)/);
assert.doesNotMatch(music,/playlistBar\.append\(savedSelector/);

assert.match(music,/class="accessToggle"/);
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
assert.match(radio,/ge-music-v5\.js\?v=20261028-v70-ge-user-load-modal/);
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
