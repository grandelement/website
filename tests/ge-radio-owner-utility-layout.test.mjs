import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const radio=readFileSync('radio/index.html','utf8');
const music=readFileSync('radio/ge-music-v5.js','utf8');
const worker=readFileSync('radio/sw.js','utf8');

const bottom=(radio.match(/<div id="bottomActions">([\s\S]*?)<\/div>/)||[])[1];
const utility=(radio.match(/<div id="geUtilityRow"[^>]*>([\s\S]*?)<\/div>/)||[])[1];
assert.ok(bottom&&utility,'Public Radio footer groups exist');
assert.doesNotMatch(bottom,/id="offlineBtn"/,'Offline must not render on Radio front');
assert.doesNotMatch(utility,/reloadBtn|geDebugOpen|offlineBtn/,'Owner utilities must not render on Radio front');
assert.match(utility,/id="sunLabBtn"[\s\S]*?SUPPORT/,'SUN LAB belongs to the left of SUPPORT');
assert.match(radio,/<div id="geRadioInternalControls" hidden[^>]*>[\s\S]*?id="offlineBtn"[^>]*hidden/,'Offline controller must remain internal');
assert.doesNotMatch(radio,/id="reloadBtn"/,'Old RELOAD DOM proxy must stay removed');
assert.doesNotMatch(radio,/<button data-proxy="(?:offlineBtn|reloadBtn)"/,'Ship must not resurrect old buttons');
assert.match(radio,/window\.GERadioReloadLibrary=geReloadLibrary/,'Direct reload function required');
assert.match(radio,/window\.GERadioOpenDiagnostics=function/,'Direct DEBUG function required');
assert.match(radio,/geRadioUtilityAllowed\('reload'\)/,'Existing reload action still checks real authorization');
assert.match(radio,/geRadioUtilityAllowed\('debug'\)/,'Existing debug action still checks real authorization');
assert.match(music,/const geOwnerReload=geOwnerButton\('RELOAD','reload'\)/,'Reload belongs in MUSIC');
assert.match(music,/const geOwnerDebug=geOwnerButton\('DEBUG','debug'\)/,'Debug belongs in MUSIC');
assert.match(music,/syncMusicOwnerTools\(\)/,'Music owner buttons must recheck permissions');
assert.match(music,/window\.GERadioReloadLibrary\(control\)/,'RELOAD invokes the function directly');
assert.match(music,/window\.GERadioOpenDiagnostics\(\)/,'DEBUG invokes the function directly');
assert.doesNotMatch(music,/source\.click\(\)/,'No hidden DOM button proxy');
assert.match(worker,/const MEDIA_CACHE='ge-radio-media-v4'/,'Downloaded music cache must be untouched');
assert.match(worker,/GE_RADIO_UI_BUILD_20261115_OWNER_UTILITIES_V3/,'Service worker must require new UI shell');
assert.match(radio,/GE_RADIO_UI_BUILD_20261115_OWNER_UTILITIES_V3/,'New UI must advertise shell marker');
assert.match(worker,/owner-utility-layout-v111/,'Service worker shell cache must be rotated');

const inlineStyles=[...radio.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]);
assert.ok(inlineStyles.length<=88,'Do not add more inline CSS patch blocks; edit the canonical layout');
const staticCSS=inlineStyles.join('\n');
for(const oldId of ['reloadBtn','geDebugOpen','offlineBtn'])
 assert.doesNotMatch(staticCSS,new RegExp('#'+oldId+'\\b'),'Dead legacy '+oldId+' CSS must not return');
assert.match(radio,/PUBLIC RADIO BUTTONS: one owner for geometry/,'Canonical public button geometry missing');
assert.match(radio,/geReloadBusy/,'RELOAD requests need a concurrency guard');
assert.ok(radio.includes("requestAll:requestAllOffline")&&radio.includes("requestSelection:requestSelectedOffline"),'MUSIC must share one direct offline downloader');
assert.ok(music.includes("window.GEOffline?.requestSelection?.(paths)")&&music.includes("window.GEOffline?.requestAll?.()"),'MUSIC must call the offline downloader directly');
assert.ok(music.includes("return window.GERadioOfflineAllowed?.()===true;"),'MUSIC and Radio must agree on the verified Offline grant');
assert.ok(!music.includes("window.postMessage({type:'GE_MUSIC_OFFLINE_"),'No synthetic offline command messages in the Music UI');
const inlineScripts=[...radio.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
 .filter(m=>!/\bsrc\s*=|\btype\s*=\s*["'](?:application\/json|application\/ld\+json)/i.test(m[1]));
for(let i=0;i<inlineScripts.length;i++)
 new Script(inlineScripts[i][2],{filename:'radio/index.html inline script '+(i+1)});

new Script(music,{filename:'radio/ge-music-v5.js'});
new Script(worker,{filename:'radio/sw.js'});
console.log('Radio owner utility placement, permission, JS parse and offline cache contract passed');
