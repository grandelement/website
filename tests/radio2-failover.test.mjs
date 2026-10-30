// Filename retained for historical CI references. Radio 2 is now deliberately
// DISABLED for listeners under the 2026-10-30 owner instruction.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const radio=readFileSync('radio/index.html','utf8');
const home=readFileSync('index.html','utf8');
const control=readFileSync('radio/website-live.js','utf8');
assert.match(radio,/const GE_RADIO2_DISABLED=true/,'Radio 2 must never play for the public');
assert.match(radio,/if\(GE_RADIO2_DISABLED\)return retryRadio1Only\(reason\)/,'All fallback paths must remain on BLITZ');
assert.match(radio,/LIVE_STREAM_URL:\s*'https:\/\/radio\.grandelement\.blitz\.cloud\/stream\.mp3'/,'Radio 1 original stream changed');
assert.match(radio,/void requestRadioStart\(\{deferPlay:qrArrival\}\)/,'Radio page must initiate connection on arrival');
assert.match(radio,/button\.textContent='RADIO'/,'Radio button must remain visible while connecting');
assert.match(radio,/Date\.now\(\)-lastRadio1Progress>8000/,'Listeners must be able to retry stalled BLITZ');
assert.match(radio,/observedRadio1Progress=true/,'Heartbeat must wait for real forward progress');
assert.match(control,/if\(allowed\(\)\)start\(\)/,'Homepage must start attempting BLITZ automatically');
assert.match(home,/ge-home-radio-connected/,'Homepage connected heartbeat missing');
assert.doesNotMatch(control,/ge-radio-sync\.grandelement\.workers\.dev/,'Homepage accidentally uses Radio 2');
for(const [index,match] of [...radio.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
 if(/src=|application\/json|type=["']module/.test(match[1]))continue;
 new Script(match[2],{filename:'radio-inline-'+index+'.js'});
}
new Script(control,{filename:'website-live.js'});
console.log('PASS: public playback uses only BLITZ Radio 1, auto-attempts on arrival and allows repeat RADIO retry.');
