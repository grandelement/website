import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const radio=readFileSync('radio/index.html','utf8');
const music=readFileSync('radio/ge-music-v5.js','utf8');
const worker=readFileSync('radio/sw.js','utf8');
const offline=readFileSync('radio/offline-manager.js','utf8');
const spectrum=readFileSync('radio/offline-spectrum.js','utf8');
const home=readFileSync('radio/offline-home.html','utf8');
for(const id of ['reloadBtn','geDebugOpen','offlineBtn','geOfflineDecision','geOfflineReadiness','offlinePanel'])
 assert.doesNotMatch(radio,new RegExp(id+'\\b'),'Retired Radio button, pane or source still present: '+id);
for(const token of ['createOfflineController','refreshTemplateAssetsForOffline','ge-radio-temporary-debug','GE_MUSIC_OFFLINE_'])
 assert.doesNotMatch(radio,new RegExp(token),'Retired controller still present: '+token);
for(const token of ['offlineSelected','geMusicOfflineRow','musicOfflineDialog','reloadCatalogBtn','GE_MUSIC_OFFLINE_'])
 assert.doesNotMatch(music,new RegExp(token),'Retired MUSIC control still present: '+token);
assert.match(radio,/id="offlineLaunchBtn"[^>]*aria-controls="geMusicV5Host"/,'Front OFFLINE is a MUSIC shortcut, not a second downloader');
assert.match(radio,/id="sunLabBtn"/,'Sun Lab preserved');
assert.match(radio,/id="accessLaunchBtn"/,'CODE preserved');
assert.match(radio,/id="contactLaunchBtn"/,'CONTACT preserved');
assert.match(radio,/id="shareBtn"/,'SHARE preserved');
assert.match(radio,/id="playBtn"/,'Main PLAY preserved');
assert.match(radio,/id="liveBtn"/,'Radio stream preserved');
assert.match(music,/class="musicCodeTools"/,'MUSIC access code preserved');
assert.match(worker,/const MEDIA_CACHE='ge-radio-media-v4'/,'Existing saved-song cache must not be deleted');
assert.match(radio,/GE_RADIO_UI_BUILD_20261116_COLD_CATALOG_FIT_V8/);
assert.match(worker,/GE_RADIO_UI_BUILD_20261116_COLD_CATALOG_FIT_V8/);
assert.match(worker,/\.\/offline-manager\.js/,'Offline manager cached in required Radio shell');
assert.match(offline,/canDownload/,'Offline requires existing scoped permission');
assert.match(offline,/ge-radio-media-v4/,'Existing audio storage remains canonical');
assert.doesNotMatch(worker,/offline-control\.js/,'Duplicate offline controller must not load in the worker shell');
assert.doesNotMatch(radio,/offline-control\.js|geOfflineSurface/,'Radio cannot create a separate offline screen');
assert.match(music,/class="geOfflineWorkspace"/,'Offline workspace must live inside MUSIC');
assert.match(music,/data-ge-offline="all"/,'One-tap full library download is the default');
assert.match(music,/data-ge-offline="checked"/,'Checked song option retained');
assert.match(music,/data-ge-offline="playlist"/,'Playlist option retained');
assert.match(music,/data-ge-offline="update"/,'Missing song update option retained');
assert.match(music,/class="geOfflineDockToggle"/,'Exactly one small OFFLINE control in MUSIC');
assert.doesNotMatch(music,/class="geOfflineStart"/,'No duplicate DOWNLOAD button');
assert.match(music,/const all=\[\.\.\.visibleSharedLists\(\)/,'Offline playlist choices must obey published/assigned visibility');
assert.match(music,/document\.getElementById\('offlineLaunchBtn'\)\?\.addEventListener\('click',openOffline\)/,
  'Front OFFLINE must open the one MUSIC offline workspace');
assert.match(offline,/window\.GEOfflineDownloads=\{/,'One canonical download API');
assert.doesNotMatch(offline,/surface\.innerHTML|geOfflineSurface/,'Download engine must not render a duplicate window');
assert.match(worker,/'.\/offline-spectrum\.js'/,'Local spectrum engine cached as required shell');
assert.match(home,/index\.html\?ge_home=1/,'Home Screen launcher reopens saved player');

assert.match(radio,/data-sun-mode="waterfall"/,'Original WATERFALL mode preserved');
assert.match(radio,/data-sun-mode="spectrum"/,'Original SPECTRUM mode preserved');
const scripts=[...radio.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
 .filter(m=>!/\bsrc\s*=|type\s*=\s*["'](?:application\/json|application\/ld\+json)/i.test(m[1]));
for(let i=0;i<scripts.length;i++)
 new Script(scripts[i][2],{filename:'radio/index.html script '+i});
new Script(music,{filename:'radio/ge-music-v5.js'});
new Script(worker,{filename:'radio/sw.js'});
new Script(offline,{filename:'radio/offline-manager.js'});
new Script(spectrum,{filename:'radio/offline-spectrum.js'});
console.log('PASS: one MUSIC-owned offline workspace, footer shortcut, preserved playback and permissions');