import assert from 'node:assert/strict';
import fs from 'node:fs';

const radio=fs.readFileSync('radio/index.html','utf8');
const fft=fs.readFileSync('radio/live-spectrum.js','utf8');
const gate=fs.readFileSync('radio/ge-gate-audio.js','utf8');
const sw=fs.readFileSync('radio/sw.js','utf8');
const labels=['plasma','spectrum','glow','waterfall','pulse','ripples','orbit','aurora'];
for(const mode of labels){
 assert.match(radio,new RegExp('data-sun-mode="'+mode+'"'));
 assert.match(radio,new RegExp(mode+":\\{\\.\\.\\.SUN_LAB_DEFAULTS"));
}
assert.match(radio,/const SUN_MODE_SELECTED_KEY=/);
assert.match(radio,/window\.GELiveAudioEQ\?\.read\?\.\(\)/);
assert.match(radio,/window\.GELiveAudioEQ\?\.arm\?\.\(\)/);
assert.match(radio,/live-spectrum\.js\?v=/);
assert.match(sw,/\.\/live-spectrum\.js/);
assert.match(gate,/createAnalyser/);
assert.match(gate,/getByteFrequencyData/);
assert.match(gate,/createMediaElementSource\(main\)/);
assert.match(fft,/getElementById\('player'\)/,'analyser must sample the real Radio player');
assert.doesNotMatch(fft,/getElementById\('audio'\)/,'never sample the preview-only audio element');
assert.match(fft,/getSpectrumFrame/);
assert.match(fft,/gate\.arm\(\)/);
assert.doesNotMatch(fft,/createMediaElementSource|new AudioContext|new Audio\s*\(/);
assert.doesNotMatch(fft,/new\s+Audio\s*\(/);
assert.doesNotMatch(fft,/offline-spectrum|eq-snapshot|sine|Math\.random/);
assert.match(fft,/url\.origin===location\.origin/);
assert.match(radio,/if\(GE_STATIC_RADIO_PRIMARY\|\|!GE_IOS_AUDIO/); // BLITZ polling remains blocked for the Bangers clock
assert.match(radio,/id="geSunEQEnable"/);
assert.match(fft,/function enable\(\)/);
assert.match(fft,/geIOSLiveOptIn/);
assert.match(radio,/SUN_LAB_BALANCE_KEY/);
assert.match(radio,/sunEQAura\.style\.opacity=live\?'1':'.075'/);
assert.doesNotMatch(radio,/upgradeSunLabVisibility\(\);/);
assert.match(sw,/ge-radio-media-v4/);
console.log('PASS: native-player real FFT and eight stored effects, no song map or duplicate media element.');
