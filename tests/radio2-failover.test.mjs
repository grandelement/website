import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
const radio=readFileSync('radio/index.html','utf8');
const clock=JSON.parse(readFileSync('radio/sync-playlist.json','utf8'));
const a=radio.indexOf('function radio2ValidTrack(track){');
const b=radio.indexOf('function radio2PlayCurrent(){',a);
assert.ok(a>=0&&b>a,'radio2 validation functions must exist');
const ctx={URL,location:{origin:'https://grandelement.com'}};
const {radio2ValidTrack,radio2ProgramKind}=runInNewContext(radio.slice(a,b)+'\n({radio2ValidTrack,radio2ProgramKind})',ctx);
assert.equal(clock.tracks.length,50,'existing 50-track backup unchanged');
assert.equal(radio2ProgramKind(clock),'backup','exact legacy backup accepted, not called Bangers');
assert.equal(clock.tracks.every(radio2ValidTrack),true,'all clock tracks same-origin music files');
assert.equal(radio2ProgramKind({...clock,playlist_hash:'tampered'}),'','unknown music program rejected');
assert.equal(radio2ProgramKind({...clock,playlist_name:'Bangers'}),'bangers','real Bangers prioritized');
assert.equal(radio2ProgramKind({...clock,playlist_name:'Test 2'}),'','personal playlists cannot replace station');
assert.match(radio,/const kind=radio2ProgramKind\(program\)/);
assert.match(radio,/radio2.program=program;radio2.kind=kind/);
assert.match(radio,/userGesture&&!radio2.active&&!observedRadio1Progress/);
assert.match(radio,/if\(radio2.active\)\{[\s\S]*?radio2PlayCurrent\(\);[\s\S]*?\}else\{/);
assert.match(radio,/!state.live\|\|radio2.active\|\|!GATE_CONFIG.liveMetadataURL/);
for(const [n,match] of [...radio.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
  if(/src=|application\/json|type=["']module/.test(match[1]))continue;
  new Script(match[2],{filename:'radio-inline-'+n+'.js'});
}
console.log('PASS: exact 50-track backup is allowed without pretending to be Bangers; Gate, PLAY, metadata and radio script guards valid');
