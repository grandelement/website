import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html=readFileSync('backroom/index.html','utf8');
const sourceStart=html.indexOf('  function accessPlaylistSource(){');
const sourceEnd=html.indexOf('  async function refreshVaultAccessPlaylists(){',sourceStart);
const start=html.indexOf('  function selectedAccessAssignments(){');
const end=html.indexOf('  function codePayload(){',start);
assert.ok(sourceStart>0&&sourceEnd>sourceStart,'find production Vault-first playlist source');
assert.ok(start>0&&end>start,'find production Access Code save logic');
const sourceScript=html.slice(sourceStart,sourceEnd);
const assignmentScript=sourceScript+'\n'+html.slice(start,end)+'\nselectedAccessAssignments()';
const songs=Array.from({length:7},(_,i)=>'ge-music/music/Test2/Track_'+(i+1)+'.mp3');
const playlist={id:'playlist_test2',name:'Test 2',tracks:songs.map(track_path=>({track_path}))};
const catalog=songs.map(track_path=>({track_path}));
function run(o={}){
 const env={
  accessSelectedPlaylistIds:new Set(o.selected||[]),
  appliedPlaylistIds:new Set(o.applied||[]),
  accessVaultLoaded:o.loaded!==false,
  accessVaultPlaylists:o.vault||[playlist],
  playlistLoaded:!!o.legacy,
  playlists:o.legacy||[],
  catalog:o.catalog||catalog,
  assignedSongPaths:o.assigned||[]
 };
 return runInNewContext(assignmentScript,env);
}
let x=run({selected:[playlist.id]});
assert.equal(JSON.stringify(x.playlist_ids),JSON.stringify([playlist.id]));
assert.equal(JSON.stringify(x.track_paths),JSON.stringify(songs),'checked Vault playlist saves all seven ordered tracks');
x=run({selected:[playlist.id],applied:[playlist.id],assigned:songs});
assert.equal(x.track_paths.length,7,'unchanged selection preserves saved song snapshot');
const manual='ge-music/music/Other/Manual.mp3';
x=run({selected:[],applied:[playlist.id],assigned:[...songs,manual]});
assert.equal(JSON.stringify(x.track_paths),JSON.stringify([manual]),'unchecking removes playlist tracks but keeps manual songs');
x=run({selected:[],assigned:[manual]});
assert.equal(JSON.stringify(x.track_paths),JSON.stringify([manual]),'manual songs are preserved without a playlist');
assert.throws(()=>run({selected:[playlist.id],loaded:false}),/Live GE Vault playlists/);
assert.throws(()=>run({selected:[playlist.id],catalog:catalog.slice(0,6)}),/Playlist songs missing/);
assert.throws(()=>run({selected:['playlist_unknown']}),/missing from loaded GE playlists/);
const tooMany=Array.from({length:251},(_,i)=>'ge-music/music/Other/Track_'+i+'.mp3');
assert.throws(()=>run({selected:[playlist.id],assigned:tooMany,catalog:[...catalog,...tooMany.map(track_path=>({track_path}))]}),/at most 250/);

// The live Vault playlist always wins over an outdated GitHub playlist with the same ID.
const bangersTracks=Array.from({length:41},(_,i)=>({track_path:'ge-music/music/Bangers/Track_'+i+'.mp3'}));
const oldBangers={id:'9dfb10c5eb5d',name:'Bangers',tracks:bangersTracks.slice(0,33)};
const liveBangers={...oldBangers,tracks:bangersTracks};
const env={accessVaultLoaded:true,accessVaultPlaylists:[liveBangers],
  playlistLoaded:true,playlists:[oldBangers,{id:'older',name:'Historic Mix',tracks:songs.map(track_path=>({track_path}))}],
  accessSelectedPlaylistIds:new Set(['older'])};
const available=runInNewContext(sourceScript+'\naccessPlaylistSource()',env);
assert.equal(available.find(p=>p.id==='9dfb10c5eb5d').tracks.length,41);
assert.ok(available.some(p=>p.id==='older'),'GitHub-only historic assignments are retained');
console.log('PASS: live Vault playlist permissions, song-order snapshots, allow/deny, catalogue guards, and safe 41-track Bangers priority');
