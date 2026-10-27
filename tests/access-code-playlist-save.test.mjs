import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync('backroom/index.html','utf8');
const start=html.indexOf('  function selectedAccessAssignments(){');
const end=html.indexOf('  function codePayload(){',start);
assert.ok(start>0&&end>start,'find exact production playlist save logic');
const script=html.slice(start,end)+'\nselectedAccessAssignments()';
const songs=Array.from({length:7},(_,i)=>'ge-music/music/Test2/Track_'+(i+1)+'.mp3');
const playlist={id:'playlist_test2',name:'Test 2',tracks:songs.map(track_path=>({track_path}))};
const catalog=songs.map(track_path=>({track_path}));
function run(o={}){
 const env={
  accessSelectedPlaylistIds:new Set(o.selected||[]),
  appliedPlaylistIds:new Set(o.applied||[]),
  playlistLoaded:o.loaded!==false,
  playlists:o.playlists||[playlist],
  catalog:o.catalog||catalog,
  assignedSongPaths:o.assigned||[]
 };
 return runInNewContext(script,env);
}
let x=run({selected:[playlist.id]});
assert.equal(JSON.stringify(x.playlist_ids),JSON.stringify([playlist.id]));
assert.equal(JSON.stringify(x.track_paths),JSON.stringify(songs),'checkbox + SAVE assigns all seven tracks');
x=run({selected:[playlist.id],applied:[playlist.id],assigned:songs});
assert.equal(x.track_paths.length,7,'unchanged selection preserves saved track snapshot');
const manual='ge-music/music/Other/Manual.mp3';
x=run({selected:[],applied:[playlist.id],assigned:[...songs,manual]});
assert.equal(JSON.stringify(x.track_paths),JSON.stringify([manual]),'uncheck removes old playlist tracks while preserving manual songs');
x=run({selected:[],assigned:[manual]});
assert.equal(JSON.stringify(x.track_paths),JSON.stringify([manual]),'no playlist selection preserves manual songs');
assert.throws(()=>run({selected:[playlist.id],loaded:false}),/Refresh GE playlists/);
assert.throws(()=>run({selected:[playlist.id],catalog:catalog.slice(0,6)}),/Playlist songs missing/);
assert.throws(()=>run({selected:['playlist_unknown']}),/no longer saved/);
const tooMany=Array.from({length:251},(_,i)=>'ge-music/music/Other/Track_'+i+'.mp3');
assert.throws(()=>run({selected:[playlist.id],assigned:tooMany,catalog:[...catalog,...tooMany.map(track_path=>({track_path}))]}),/at most 250/);
console.log('PASS: actual Access Code playlist snapshot handles checked save, removal, manual songs, stale catalog and limits');
