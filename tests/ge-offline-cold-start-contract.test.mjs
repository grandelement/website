import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sw=read('radio/sw.js');
const siteSW=read('sw.js');
const library=read('ge-offline-library.js');
const radio=read('radio/index.html');
const offline=read('radio/offline-player.html');
const boot=offline.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
assert.ok(boot,'Standalone OFFLINE player inline script exists');
new vm.Script(sw,{filename:'radio/sw.js'});
new vm.Script(siteSW,{filename:'sw.js'});
new vm.Script(library,{filename:'ge-offline-library.js'});
new vm.Script(boot,{filename:'radio/offline-player.html'});
assert.match(library,/const fullySaved=urls.length>0 && !missing.length && fail===0 && skipped===0 && done===urls.length/,'Full-site READY requires every file');
assert.match(library,/response.status!==200/,'Offline download rejects partial audio responses');
assert.match(library,/Cached file failed local verification/,'Saved audio is checked after Cache.put');
assert.match(siteSW,/const REQUIRED_OFFLINE_FILES=/,'Website worker defines its own required startup files');
for(const file of ['./radio/','./radio/index.html','./radio/offline-player.html','./ge-offline-library.js']){
 assert.ok(siteSW.includes("'"+file+"'"),'Website offline core contains '+file);
}
assert.match(siteSW,/for\(const path of REQUIRED_OFFLINE_FILES\)/,'Website checks required files before activation');
assert.match(siteSW,/blob\.slice\(start,end\+1\)/,'Website serves media byte ranges without large ArrayBuffer copies');
assert.match(sw,/const OFFLINE_CORE=/,'Service worker defines minimum offline startup bundle');
for(const file of ['./offline-player.html','./ge-music-v5.js','./manifest.json','../ge-vault-client.js']){
 assert.ok(sw.includes("'"+file+"'"),'Required offline asset listed: '+file);
}
assert.match(sw,/for\(const url of OFFLINE_CORE\)/,'Core is cached before activation');
assert.match(sw,/throw new Error\('Missing required offline asset/,'Core failures stop worker activation');
assert.match(sw,/const MEDIA_CACHE='ge-radio-media-v4'/,'Existing song cache is preserved');
assert.match(sw,/offlineNavigationFallback\(\)/,'Offline navigation fallback retained');
assert.match(offline,/async function prepareOfflineLaunch\(\)/,'Offline player can install itself');
assert.match(offline,/navigator\.serviceWorker\.register/,'OFFLINE installation uses a service worker');
assert.match(offline,/!navigator\.onLine/,'OFFLINE boot does not require re-registration over network');
assert.match(offline,/Number\(receipt\.until\)>Date\.now\(\)/,'Offline entitlements remain expiry-checked');
assert.match(offline,/receipt\.device_id===id/,'Offline entitlement is scoped to this browser device');
assert.match(radio,/window\.GEVault\?\.anonId\|\|localStorage\.getItem\('ge_vault_anon_id'\)/,'Offline radio recovers persisted identity');
assert.doesNotMatch(radio,/if\(isSingles\(request\.url\) \|\| isStationID\(request\.url\)\)/,'Saved Singles must not be excluded from offline catalog');
const version=sw.match(/const VERSION='([^']+)'/)?.[1];
assert.ok(version&&radio.includes(version)&&offline.includes(version),'Radio and Offline player register the same worker version');
console.log('OFFLINE cold-start and authorization contracts OK');
