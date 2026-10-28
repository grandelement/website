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

const mediaErrorStart=radio.indexOf("audio.addEventListener('error',()=>{");
const mediaErrorEnd=radio.indexOf("audio.addEventListener('pause'",mediaErrorStart);
assert.ok(mediaErrorStart>=0,'media-error failover entry exists');
const mediaErrorBody=radio.slice(mediaErrorStart,mediaErrorEnd>mediaErrorStart?mediaErrorEnd:mediaErrorStart+1600);
assert.match(mediaErrorBody,/if\(state.live\|\|state.livePreparing\)/,'startup error is not ignored');
assert.match(mediaErrorBody,/switchToRadio2\('radio1_hard_media_error'\)/,'hard error goes directly to backup');
assert.doesNotMatch(mediaErrorBody,/reconnectLiveStream\(\)/,'hard error must not retry dead BLITZ endpoint');
console.log('PASS: startup media failures skip obsolete Radio1 retries and start verified backup directly');

assert.match(radio,/RADIO 1 · CONNECTING…/,'Radio 1 must announce connection');
assert.match(radio,/RADIO 2 · CONNECTING…/,'Radio 2 must announce failover connection');
assert.match(radio,/RADIO 1 · CONNECTED/,'Radio 1 confirmation requires media progress');
assert.match(radio,/RADIO 2 · CONNECTED/,'Radio 2 confirmation requires media progress');
assert.match(radio,/RADIO 2 · TAP PLAY TO CONNECT/,'Safari blocked autoplay must show actionable instruction');
assert.doesNotMatch(radio,/RADIO 2 READY · iPhone: tap PLAY/,'do not call Radio 2 connected before playback');
assert.doesNotMatch(radio,/RADIO 2 · preparing backup rotation/,'no backup-rotation status');
const progressStart=radio.indexOf("audio.addEventListener('timeupdate',()=>{");
const progressEnd=radio.indexOf("audio.addEventListener('playing'",progressStart);
assert.ok(progressStart>=0&&progressEnd>progressStart,'audio progress event observed');
const progress=radio.slice(progressStart,progressEnd);
assert.match(progress,/observedRadio2Progress=true;[\s\S]*?setLiveStatus\('RADIO 2 · CONNECTED'\)/);
assert.match(progress,/observedRadio1Progress=true;[\s\S]*?setLiveStatus\('RADIO 1 · CONNECTED'\)/);
assert.match(radio,/id="ge-radio-connection-indicator-v1"/,'connecting visual indicator retained');
assert.match(radio,/id="ge-radio-audible-only-heartbeat-v2"/,'verified-audio-only RADIO heartbeat must remain');
assert.match(radio,/geRadioContainedHeartbeat67/,'contained double-beat cycle must remain');
assert.match(radio,/115000/,'cold Radio 1 must not fall back after 10 seconds');
console.log('PASS: station statuses reflect connecting/connected actual audio and audible-only contained red heartbeat is intact');

