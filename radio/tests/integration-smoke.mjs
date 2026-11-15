import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const radio=read('index.html');
const home=read('../index.html');
const sharedViewDetector=/<script id="ge-safari-request-website-mode">([\s\S]*?)<\/script>/;
assert.equal(radio.match(sharedViewDetector)?.[1],home.match(sharedViewDetector)?.[1],
  'Home and Radio must classify iPhone/tablet/desktop identically');

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
has(radio,'id="sunLabBtn"','Sun Lab');
has(radio,'id="offlineBtn"','Offline control');
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
assert.ok(radio.includes("if(GE_STATIC_RADIO_PRIMARY||!GE_IOS_AUDIO"),'Never read BLITZ spectrum when static BANGERS plays');
has(radio,'ensureSafePlayerEQCapture()','Safe EQ source');
has(radio,'readMeasuredSongSpectrum()','Safari measured song EQ reader');
has(radio,"'./eq/library-spectrum.json'",'Safari measured song EQ file URL');
const analysisFile=new URL('../eq/library-spectrum.json',import.meta.url);
assert.ok(existsSync(analysisFile),
  'Measured per-song spectrum data must be generated before deploying iPhone EQ');
const analysis=JSON.parse(readFileSync(analysisFile,'utf8'));
assert.equal(analysis.format,'ge-song-3band-timeline-v1');
assert.equal(analysis.frame_ms,100);
assert.ok(Object.keys(analysis.tracks||{}).length>=25,
  'At least 25 genuine song timelines must be generated');
for(const [url,entry] of Object.entries(analysis.tracks)){
  assert.ok(url.startsWith('/ge-music/music/'),'Timeline song path invalid');
  assert.ok(entry.frames?.length>=4 && Number.isInteger(entry.count)&&entry.count>0,
    'Missing or empty measured song timeline for '+url);
}

has(radio,"button.classList.toggle('radio-start-cue',!connected)",'Heartbeat guard');
has(worker,'integrated-recovery-v112','New Radio service worker');
has(worker,'return offlineNavigationFallback();','Offline navigation fallback');
assert.ok(!worker.includes('await Promise.allSettled(optional'), 'Do not block worker install on optional artwork');
has(homeWorker,'new AbortController()','Bounded homepage offline network');
console.log('PASS: integrated Radio source, Music, EQ, offline and footer regression checks');
