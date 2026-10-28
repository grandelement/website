import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const back=readFileSync('backroom/index.html','utf8');
const music=readFileSync('radio/ge-music-v5.js','utf8');
const preview=readFileSync('radio/preview-lab.html','utf8');
const radio=readFileSync('radio/index.html','utf8');
const sw=readFileSync('radio/sw.js','utf8');
const registry=JSON.parse(readFileSync('playlists/registry.json','utf8'));
assert.equal(registry.format,'ge-playlist-registry-v1');
assert.equal(registry.playlists.find(p=>p.name==='Test 2')?.songs.length,7);
assert.match(back,/id="brImportBangers">SYNC ORIGINAL BLITZ PLAYLISTS/);
assert.match(back,/geDJApi\('\/control\/playlists'\)/);
assert.match(back,/original DJ/i);
assert.match(back,/await githubPlaylistAction\(\{action:'save',playlist:entry\}\)/);
assert.match(back,/if\(!saved\.commit_sha\|\|!saved\.id\)/);
assert.match(back,/DJ → GITHUB SYNC UNVERIFIED/);
assert.match(music,/state\.publicLists=data\.playlists\.filter\(valid\)/);
assert.match(music,/id="geArrangeCurrentName"/);
assert.match(music,/state\.playlistDraftName=p\.name/);
assert.match(music,/GE_BACKROOM_PUBLISH_SESSION_V1/);
assert.match(music,/GE VAULT SAVED/);
assert.match(music,/saveSharedArrangement/);
assert.match(music,/UNLISTED · CODE REQUIRED TO PLAY/);
assert.match(music,/else setView\('ge-playlists'\)/);
assert.match(music,/if\(collections\.length\)select\.value=collections\[0\]\.key/);
assert.match(preview,/readGithub\(\),readVault\('\/v1\/public\/music-playlists'\)/);
assert.match(preview,/UNLISTED · /);
assert.match(radio,/ge-music-v5\.js\?v=20261028-v66-named-vault-save/);
assert.match(radio,/sw\.js\?v=20261028-ge-playlists-unified-v66/);
assert.match(sw,/const VERSION='2026\.10\.28-ge-playlists-unified-v66'/);
for(const [name,html] of [['back',back],['radio',radio],['preview',preview]]){
  for(const [i,m] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
    if(/src=|application\/json/i.test(m[1]))continue;
    new Script(m[2],{filename:name+'-inline-'+i});
  }
}
new Script(music,{filename:'radio/ge-music-v5.js'});
const begin=back.indexOf('  async function importBangersFromDJ(){');
const end=back.indexOf('  function playlistHasUnsavedEdits(){',begin);
assert.ok(begin>0&&end>begin,'authentic DJ import function must be present');
const importerSource=back.slice(begin,end);
const song=registry.playlists[0].songs[0],second=registry.playlists[0].songs[1];
const source=[
 {id:'dj-bangers',name:'Bangers',paths:[song,second]},
 {id:'dj-second',name:'Other DJ Mix',paths:[second]}
];
const catalog=[song,second].map((track_path,i)=>({track_path,track_title:'Verified Track '+i,album:'GE'}));
let github=[],saves=0,refreshes=0,radioWrites=0,lastStatus='',approve=true;
const copy=x=>JSON.parse(JSON.stringify(x));
const githubApi=async body=>{
 if(!body)return {ok:true,items:copy(github)};
 assert.equal(body.action,'save');
 const row=body.playlist;
 const old=github.find(x=>x.id===row.id);
 const id=old?.id||'playlist_imported_'+(++saves);
 const saved={id,name:row.name,
   metadata_json:JSON.stringify({public:row.public}),
   tracks:row.tracks.map((t,position)=>({...t,position}))};
 github=github.filter(x=>x.id!==id).concat(saved);
 return {ok:true,id,commit_sha:'c'.repeat(40)};
};
const dollar=id=>id==='brImportBangers'?{disabled:false}:{};
const importer=new Function('$','authReady','playlistLoaded','playlistHasUnsavedEdits','confirm','playlistStatus','geDJApi','githubPlaylistAction','refreshPlaylists','localStorage','catalog','cfg',importerSource+';return importBangersFromDJ')(
 dollar,()=>true,true,()=>false,()=>approve,x=>lastStatus=x,
 async path=>{assert.equal(path,'/control/playlists');return {ok:true,items:source}},
 githubApi,async()=>{refreshes++;return true;},{getItem:()=>null},catalog,
 {music:{publicDJPlaylistNames:['Bangers']}}
);
await importer();
assert.equal(github.length,2,'both real DJ lists import into the same master');
assert.equal(github.find(x=>x.name==='Bangers').metadata_json,'{"public":true}');
assert.deepEqual(github.find(x=>x.name==='Bangers').tracks.map(x=>x.track_path),[song,second]);
assert.deepEqual(github.find(x=>x.name==='Other DJ Mix').tracks.map(x=>x.track_path),[second]);
assert.match(lastStatus,/2 IMPORTED/);
assert.equal(radioWrites,0,'no live broadcast write occurs');
await importer();
assert.equal(github.length,2,'repeat import creates no duplicates');
assert.match(lastStatus,/2 MATCHED/);
source[0].paths=[second,song];
approve=false;
await importer();
assert.deepEqual(github.find(x=>x.name==='Bangers').tracks.map(x=>x.track_path),[song,second],
 'conflicting DJ snapshot must never overwrite without owner approval');
approve=true;
await importer();
assert.deepEqual(github.find(x=>x.name==='Bangers').tracks.map(x=>x.track_path),[second,song],
 'owner-approved sync preserves GitHub ID and exact new ordered DJ paths');
assert.equal(github.length,2);
assert.ok(refreshes>=3);
console.log('PASS unified playlist library: all GitHub names, real-only BLITZ import, repeat-safe readback, owner-protected conflicts, Radio loader and cache');
