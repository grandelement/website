import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const radio=read('index.html');
const music=read('ge-music-v5.js');
const worker=read('sw.js');
const homeWorker=read('../sw.js');

function has(source,needle,label){
  assert.ok(source.includes(needle),label+' missing: '+needle);
}
function javascriptParses(source,name){
  assert.doesNotThrow(()=>new Function(source),name+' syntax invalid');
}
javascriptParses(music,'Music');
javascriptParses(worker,'Radio worker');
javascriptParses(homeWorker,'Homepage worker');
const scripts=[...radio.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
for(const [,attrs,body] of scripts){
  if(!body.trim()||/application\/(?:ld\+json|json)/i.test(attrs))continue;
  javascriptParses(body,'Radio inline script');
}
const footer=radio.split('<div id="geUtilityRow"')[1]?.split('</div>')[0]||'';
for(const name of ['sunLabBtn','offlineBtn','reloadBtn'])has(footer,'id="'+name+'"','Shared footer');
assert.ok(footer.indexOf('id="sunLabBtn"')<footer.indexOf('id="offlineBtn"'),'Sun Lab must precede OFFLINE');
assert.ok(footer.indexOf('>SUPPORT</span>')<footer.indexOf('id="offlineBtn"'),'SUPPORT must precede OFFLINE');
has(radio,'ge-radio-mobile-canonical-footer-20261114','Mobile footer');
has(radio,'grid-area:2/2!important','Centered DEBUG');
has(radio,"window.GERadioReloadAllowed",'Restricted Reload bridge');
has(music,'geMusicReload','Music Reload only');
has(music,"state.view='albums';state.arranging=false",'Open Albums first');
has(music,"el('.albumDetailSongs').textContent='SONGS';",'SONGS label');
has(music,"(albumDetail?'albums':cat)",'Album tab remains selected');
has(music,"data-action=\"open\"",'Saved offline player link');
has(radio,"geMusicOfflineInternalRequest",'Music downloads bypass Radio shortcut');
has(radio,"autoResume:true",'Saved offline queue');
has(radio,'resumeCommittedOfflineDownload()','Auto resume');
assert.ok(!radio.includes("if(GE_STATIC_RADIO_PRIMARY||!GE_IOS_AUDIO"),'iPhone EQ must not be disabled by constant guard');
has(radio,'ensureSafePlayerEQCapture()','Safe EQ source');
has(radio,"button.classList.toggle('radio-start-cue',!connected)",'Heartbeat guard');
has(worker,'integrated-recovery-v112','New Radio service worker');
has(worker,'return offlineNavigationFallback();','Offline navigation fallback');
assert.ok(!worker.includes('await Promise.allSettled(optional'), 'Do not block worker install on optional artwork');
has(homeWorker,'new AbortController()','Bounded homepage offline network');
console.log('PASS: integrated Radio source, Music, EQ, offline and footer regression checks');
