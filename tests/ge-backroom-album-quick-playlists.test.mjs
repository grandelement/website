import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script,createContext} from 'node:vm';

const router=await readFile(new URL('../backroom/music-router.js',import.meta.url),'utf8');
const backroom=await readFile(new URL('../backroom/index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../backroom/music-router.css',import.meta.url),'utf8');
const manifest=JSON.parse(await readFile(new URL('../radio/manifest.json',import.meta.url),'utf8'));
const publisher=await readFile(new URL('../backroom/publisher-worker.js',import.meta.url),'utf8');
new Script(router,{filename:'music-router.js'});
assert.match(backroom,/id="brRoutePlaylistName"/);
assert.match(backroom,/id="brRoutePlaylistColumn"/);
assert.match(backroom,/id="brRouteSavePlaylist"/);
assert.match(backroom,/id="brRouteSavedPlaylist"/);
assert.match(backroom,/id="brRouteLoadPlaylist"/);
assert.match(backroom,/id="brRouteSave" class="primary" disabled/);
assert.match(css,/brRoutePlaylistQuick/);
assert.match(publisher,/if\(action==='save'\)/);
assert.match(router,/API\+'\/manage\/github-playlists'/);
assert.match(router,/playlistRevision=proof.commit_sha/);
assert.match(router,/const proof=await playlistApi\('GET'\)/);
assert.match(router,/\.sort\(songOrder\)/);

const required=(pattern,label)=>{
 const m=router.match(pattern);assert.ok(m,'Missing '+label);return m[0];
};
const comparatorParts=[
 required(/const ORDER=\[[^\n]+\];/,'album order'),
 required(/const order=\(a,b\)=>\{[^\n]+\};/,'album comparator'),
 required(/const trackNumber=path=>\{[\s\S]*?\n\};/,'track number parser'),
 required(/const songOrder=\(a,b\)=>[\s\S]*?;/,'song comparator')
].join('\n');
const compare=new Function('rows',comparatorParts+'\nreturn rows.sort(songOrder);');
const files=manifest.files.filter(p=>p.startsWith('ge-music/music/'));
const rows=files.map(path=>{
 const album=(path.split('/')[2]||'').replace(/^Grand Element - (?:\d{4} - )?/,'');
 return {path,album,title:path.split('/').pop()};
});
const ordered=compare([...rows].reverse());
const albums=[...new Set(ordered.map(r=>r.album))];
assert.equal(albums[0],'Fundamental Groove','first album is earliest');
assert.equal(albums.at(-1),'Singles','non-chronological Singles stays last');
assert.ok(albums.indexOf('Intergy')<albums.indexOf('Love'));
assert.ok(albums.indexOf('Love')<albums.indexOf('Aether'));
const intergy=ordered.filter(r=>r.album==='Intergy').map(r=>r.path);
assert.ok(intergy.length>=10,'Intergy songs are in the published manifest');
const trackNums=intergy.map(p=>Number(p.split('/').pop().match(/_(\d+)[_-]/)?.[1]||0));
assert.deepEqual(trackNums,[...trackNums].sort((a,b)=>a-b),
 'Intergy track titles must display in numbered album order, not alphabetically');
assert.ok(ordered.findIndex(r=>r.path.includes('Intergy_02_Intergy'))<
 ordered.findIndex(r=>r.path.includes('Intergy_09_Creature')));
const triples=ordered.filter(r=>r.album==='Fundamental Groove').slice(0,3).map(r=>r.title);
assert.deepEqual(triples,[
 'Fundamental Groove_01_Intro.mp3',
 'Fundamental Groove_02_Prelude.mp3',
 'Fundamental Groove_03_Daydream.mp3'
]);

// Exercise the actual save/load functions with an inert GitHub backend.
// Do not update real GitHub or change any public music routing.
const a=router.indexOf('async function saveCheckedPlaylist(){');
const b=router.indexOf('async function save(){',a);
assert.ok(a>0&&b>a);
const actualFunctions=router.slice(a,b);
const selected=ordered.filter(r=>r.album==='Intergy').slice(0,3).map(r=>r.path);
const fields={
 brRoutePlaylistName:{value:'Album Sequence Test'},
 brRoutePlaylistColumn:{value:'radio'},
 brRouteSavedPlaylist:{value:''},
 brRouteSavePlaylist:{disabled:false}
};
const flags={radioSongPaths:new Set(selected),playerSongPaths:new Set(),storeSongPaths:new Set(),storeAlbums:new Set()};
const assignments={radio:'',player:'',store:'',front:''};
let status='',commitCalls=0,refetches=0,renderCount=0,countUpdates=0;
let saved=null,registryRevision='old-registry-blob';
const ctx=createContext({
 console,Set,JSON,
 loaded:true,serverReady:true,busy:false,
 playlists:[],playlistRevision:registryRevision,entries:ordered,flags,assignments,
 COLUMN:{radio:'radioSongPaths',player:'playerSongPaths',store:'storeSongPaths'},
 $:id=>fields[id]||{value:''},
 albumOf:path=>(path.split('/')[2]||'').replace(/^Grand Element - (?:\d{4} - )?/,''),
 effective:key=>new Set(flags[key]),
 changed:()=>false,
 render:()=>{renderCount++},
 updateCount:()=>{countUpdates++},
 playlistStatus:message=>{status=message},
 selectedColumnSongs:()=>ordered.filter(r=>flags.radioSongPaths.has(r.path)).map(r=>r.path),
 populatePlaylistChoices:()=>{},
 confirm:()=>true,
 playlistApi:async(method,body)=>{
  if(method==='POST'){
   commitCalls++;
   assert.equal(body.action,'save');
   assert.equal(body.playlist.name,'Album Sequence Test');
   assert.equal(body.playlist.public,false,'new playlist stays unlisted');
   assert.deepEqual(Array.from(body.playlist.tracks,track=>track.track_path),selected);
   saved={id:'playlist_mocknew1',name:body.playlist.name,
     metadata_json:JSON.stringify({source:'ge-github',visibility:'unlisted'}),
     tracks:body.playlist.tracks};
   return {ok:true,id:saved.id,commit_sha:'commit_saved'};
  }
  refetches++;assert.equal(method,'GET');
  return {ok:true,commit_sha:'blob_saved',items:[saved]};
 }
});
new Script(actualFunctions+'\nthis.performSave=saveCheckedPlaylist;this.performLoad=loadSavedPlaylistIntoCheckboxes;').runInContext(ctx);
await ctx.performSave();
assert.equal(commitCalls,1);
assert.equal(refetches,1,'successful GitHub save must be verified with a fresh registry GET');
assert.match(status,/PLAYLIST SAVED AND VERIFIED/);
assert.equal(ctx.playlists[0].name,'Album Sequence Test');
assert.equal(ctx.playlistRevision,'blob_saved');
assert.equal(fields.brRouteSavedPlaylist.value,'playlist_mocknew1');
assert.equal(flags.radioSongPaths.size,3,'playlist save leaves the original radio checkboxes unchanged');
assert.equal(assignments.radio,'','playlist save does not assign public routing');
assert.equal(countUpdates,1);
fields.brRoutePlaylistColumn.value='player';
ctx.performLoad();
assert.equal(renderCount,1);
assert.equal(flags.playerSongPaths.size,3,'saved playlist can be recalled into another destination');
assert.equal(flags.radioSongPaths.size,3,'loading PLAYER does not erase the RADIO column');
assert.equal(assignments.player,'','recalled selection is editable CUSTOM, not published automatically');
assert.match(status,/LOADED "Album Sequence Test"/);
assert.equal(commitCalls,1,'loading playlist does not write GitHub');
console.log('PASS: chronological album and numbered track order, real Save/Load flow, registry readback, no implicit publishing');
