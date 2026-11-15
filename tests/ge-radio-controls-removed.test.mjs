import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const radio=readFileSync('radio/index.html','utf8');
const music=readFileSync('radio/ge-music-v5.js','utf8');
const worker=readFileSync('radio/sw.js','utf8');
for(const id of ['reloadBtn','geDebugOpen','offlineBtn','geOfflineDecision','geOfflineReadiness','offlinePanel'])
 assert.doesNotMatch(radio,new RegExp(id+'\\b'),'Retired Radio button, pane or source still present: '+id);
for(const token of ['createOfflineController','refreshTemplateAssetsForOffline','ge-radio-temporary-debug','GE_MUSIC_OFFLINE_'])
 assert.doesNotMatch(radio,new RegExp(token),'Retired controller still present: '+token);
for(const token of ['offlineSelected','geMusicOfflineRow','musicOfflineDialog','reloadCatalogBtn','GE_MUSIC_OFFLINE_'])
 assert.doesNotMatch(music,new RegExp(token),'Retired MUSIC control still present: '+token);
assert.match(radio,/id="sunLabBtn"/,'Sun Lab preserved');
assert.match(radio,/id="accessLaunchBtn"/,'CODE preserved');
assert.match(radio,/id="contactLaunchBtn"/,'CONTACT preserved');
assert.match(radio,/id="shareBtn"/,'SHARE preserved');
assert.match(radio,/id="playBtn"/,'Main PLAY preserved');
assert.match(radio,/id="liveBtn"/,'Radio stream preserved');
assert.match(music,/class="musicCodeTools"/,'MUSIC access code preserved');
assert.match(worker,/const MEDIA_CACHE='ge-radio-media-v4'/,'Existing saved-song cache must not be deleted');
assert.match(radio,/GE_RADIO_UI_BUILD_20261115_CONTROL_REMOVAL_V1/);
assert.match(worker,/GE_RADIO_UI_BUILD_20261115_CONTROL_REMOVAL_V1/);
const scripts=[...radio.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
 .filter(m=>!/\bsrc\s*=|type\s*=\s*["'](?:application\/json|application\/ld\+json)/i.test(m[1]));
for(let i=0;i<scripts.length;i++)
 new Script(scripts[i][2],{filename:'radio/index.html script '+i});
new Script(music,{filename:'radio/ge-music-v5.js'});
new Script(worker,{filename:'radio/sw.js'});
console.log('PASS: three broken feature interfaces, handlers and CSS removed; player/permission/stream source still parse');