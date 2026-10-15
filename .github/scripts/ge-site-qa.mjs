import fs from 'node:fs';
import vm from 'node:vm';

let passed = 0;
const load = path => fs.readFileSync(path, 'utf8');
function test(condition, description) {
  if (!condition) throw new Error('GE QA FAILURE: ' + description);
  console.log('PASS ' + description);
  passed++;
}
function allIn(source, needles, label) {
  for (const needle of needles)
    test(source.includes(needle), label + ': ' + needle.slice(0, 60));
}
function guarded(source, signature, guard, label) {
  const pos = source.indexOf(signature);
  test(pos >= 0 && source.slice(pos, pos + signature.length + 240).includes(guard), label);
}

// Compile all embedded application scripts. This detects broken brackets and
// malformed handlers before an update can be accepted on main.
for (const path of ['index.html','radio/index.html','radio/preview-lab.html','support/index.html','radio/ge-dj.html','radio/release-studio.html']) {
  const html = load(path);
  const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  let count = 0;
  for (const [,attrs,script] of blocks) {
    if (!script.trim() || /\bsrc\s*=/.test(attrs) || /\btype\s*=\s*["'](?:application\/json|application\/ld\+json|importmap)/i.test(attrs)) continue;
    new vm.Script(script, {filename:path+'#inline-'+(++count)});
  }
  test(count > 0, path + ': ' + count + ' inline scripts compile');
}
for (const path of ['radio/iam-private-studio.js','radio/ge-clock.js','radio/sw.js']) {
  new vm.Script(load(path), {filename:path});
  test(true,path+' compiles');
}

const radio=load('radio/index.html');
const home=load('index.html');
const iam=load('radio/iam-private-studio.js');
const lab=load('radio/preview-lab.html');
const store=load('support/index.html');
const catalog=JSON.parse(load('support/catalog.json'));

test(catalog.radio?.id==='radio-monthly' && catalog.radio.price===6 &&
  catalog.radio.billing_period==='month' && catalog.radio.subscription===true,
  'Store catalog has $6/month Radio membership');
allIn(store,['radio-monthly','$6.00 / month','myMusicCode','myMusicUnlock'],
  'Store renders subscription and My Music code');
test(store.includes('Not connected') && store.includes('Preview only'),
  'Unverified payments remain disabled');

allIn(radio,['hardLimitSeconds: 2013','fadeSeconds: 66',
  "trigger('listening-3333')","reason==='listening-3333'",
  'function holdGateTimeline(){','function resumeGateTimeline(){'],
  'Radio Gate finishes at 33:33, with 66-second fade and pause handling');
test(!radio.includes('triggerTrack: 6,') && !radio.includes('hardLimitSeconds: 1800'),
  'Old sixth-song and 30-minute triggers removed');
// Offline downloads require an explicit listener action and must not
// silently restart on every return from the GE website / Home button.
const radioOfflineBoot=radio.slice(
  radio.indexOf('  (async()=>{\\n    try{\\n      const planned=await scanApprovedPlan();'.replace(/\\n/g,'\n')),
  radio.indexOf('  window.GEOffline={')
);
test(radioOfflineBoot.includes('if(planned.plan.autoResume) await setOfflinePlanAutoResume(false);') &&
  !radioOfflineBoot.includes('cacheMissingAssets(') &&
  !radioOfflineBoot.includes('showPreDownloadEstimate('),
  'Radio entry audits existing offline files without restarting downloads or prompts');
test(radio.includes('await saveOfflinePlan(prepared.assets,{autoResume:false});') &&
  radio.includes('async function saveOfflinePlan(assets,{autoResume=false}={})'),
  'Manual offline downloads never re-arm auto-resume for future visits');

// A full song library is offline-ready even when optional backgrounds or
// redundant station/template URLs cannot be cached on a constrained iPhone.
allIn(radio,[
  "if(audit?.musicComplete){",
  "if(prepared.audit.musicComplete || prepared.audit.requiredReady || prepared.audit.complete)",
  "button.textContent='Offline Ready'",
  "button.textContent=audit?.missingSongs>0?'Resume '+audit.missingSongs+' Songs':'Finish Offline'",
  "id=\"sunLabResetCodes\"",
  "function resetLocalAccessCodes(){",
  "'GE_PLAYER_OWNER_DEMO_V1'",
  "'GE_PLAYER_3333_TEST_V1'"
], 'Offline completeness and Sun Lab guest reset');
const resetFunction=radio.slice(radio.indexOf('function resetLocalAccessCodes(){'),radio.indexOf('function initSunLab(){'));
test(resetFunction.includes('localStorage.removeItem(key)') &&
  resetFunction.includes('location.reload()') &&
  !resetFunction.includes('caches.delete') && !resetFunction.includes('GEOffline.remove'),
  'Reset Codes clears test permissions without deleting downloaded songs');
test(radio.includes('</style>\n<style id="ge-sunlab-code-reset-20261015">'),
  'Sun Lab Reset Codes layout CSS is a separate valid style element');

// iOS offline Resume is a song-only repair, never an app reinstall.
// Files cached by a different GE cache are counted without copying huge MP3s.
allIn(radio,[
  "const missingSongFiles=audit.missing.filter(item=>item.type==='song');",
  "for(const item of missingSongFiles){",
  "hit=found.response;",
  "await cache.put(item.url,response);",
  "if(/iPad|iPhone|iPod/i.test(navigator.userAgent||''))",
  "failedFiles.push(filename+' ('+cause+')');",
  "const result=await cacheMissingAssets({",
  "if(!prepared.audit.cachedSongs){",
  "button.classList.remove('downloading');"
], 'iOS song-only resumable offline downloader');
const downloadPath=radio.slice(radio.indexOf('async function cacheMissingAssets({'),radio.indexOf('  async function remove(){'));
test(!downloadPath.includes('await registerServiceWorker()') &&
  !downloadPath.includes('await navigator.storage.persist()') &&
  !downloadPath.includes('for(const item of audit.missing){'),
  'Offline Resume never updates app shell or downloads background GIFs');
const auditPath=radio.slice(radio.indexOf('async function auditAssets('),radio.indexOf('async function cacheResponseStreaming('));
test(!auditPath.includes('active.put(item.url,hit.clone())'),
  'Offline scan does not double cache audio');
const retryPath=radio.slice(radio.indexOf('async function fetchWithRetry('),radio.indexOf('async function cacheMissingAssets('));
test(!retryPath.includes('purgeStaleSongVersions('),
  'A failed song replacement cannot purge the previous cached version');

// Owner demo ACCESS controls and quiet public Gate must remain separated
// from real server-verified membership and must never clear cached media.
allIn(radio,[
  "id=\"accessLaunchBtn\"",
  "id=\"geGateEnter\" type=\"button\">ACCESS",
  "ge-gate-contact",
  "function geRadioLocalTestAccess(){",
  "window.GERadioSyncOfflineAccess=syncRadioOfflineAccessUI",
  "if(show&&!geRadioLocalTestAccess())return",
  "if(!geRadioLocalTestAccess())return; // Future production",
  "body:not(.ge-offline-entitled) #sunLabBtn",
  "body:not(.ge-offline-entitled) #offlineBtn",
  "#radioPreviewClock{display:none!important}",
  "removeOfflineOnTimeout: false",
  "window.GEGateFX={setFadeProgress:gateFxProgress",
  "function ensureLiveEQ(){",
  "const missingSongFiles=audit.missing.filter(item=>item.type==='song');",
  "if((gs.expired&&!authorized())||!state.live||!GATE_CONFIG.liveMetadataURL)return"
], 'LOVE developer-only Radio UI and quiet native-safe Gate');
test(!radio.includes("if(entered!==String(GATE_CONFIG.password||'').trim().toLowerCase()){wrongWord();return;}") ||
 radio.includes("location.assign('../support/?section=radio&flow=shop');"),
 'An incorrect Gate code routes to membership instead of granting access');
const eqPath=radio.slice(radio.indexOf('async function ensureLiveEQ(){'),radio.indexOf('  // Kept for the existing song-change hook.'));
test(eqPath.includes("if(!eqTapIsNeeded()") && !eqPath.includes("    return false;\n    try{"),
  'Analyser no longer disabled and does not create second stream for ordinary guests');
test(radio.includes("if(/iPad|iPhone|iPod/i.test(navigator.userAgent||''))"),
  'Native iPhone media path preserved');
const preview=load('radio/preview-lab.html');
test(preview.includes('#previewCometMeter,#gate{display:none!important}') &&
  preview.includes("button('33s',function(){sample(t,33)}"),
  'Personal preview hides duplicate 33:33 Gate but retains track samples');
test(!radio.includes("const hints=["),
  'No Gate riddle/questions');
// Album planets never replace or remove the original centered Blue Sun.
allIn(radio,[
  'id="shipAlbumPlanetLayer"',
  'id="shipPlanetLayer"',
  'id="shipLogo"',
  'function updateAlbumPlanets(dt){',
  'albumFlight.position=Math.max(-80,albumFlight.position+travel',
  'const travel=throttle>=0?1.5+throttle*25:1.5+throttle*32',
  'updateAlbumPlanets(dt);',
  'function currentPlanetZoom(){',
  'function updateApproachUI(){',
  'if(distance<=30 && arrival>.90',
  'arrivalContact.classList.add(\'open\')',
  'sunIsPermanent:true',
  'arrivalUnchanged:true'
], 'Reversible album planets and permanent Blue Sun arrival');
test(radio.indexOf('id="shipAlbumPlanetLayer"')<radio.indexOf('id="shipPlanetLayer"') &&
 radio.includes("#shipPlanetLayer{position:absolute;inset:0;z-index:4;"),
 'Blue Sun remains visually in front of album planets');
test(!radio.includes("const escaped=name.replace(/[.*+?^$") ,
  'Album title matcher cannot inject a broken replacement string');

allIn(radio,['RADIO 1 UNAVAILABLE — SWITCHING TO RADIO 2','switchToRadio2',
  'function geOpenMyMusicStore(){','function geOpenMusicSelection(){'],
  'Radio fallback and guest music routing');
for (const [signature,guard,label] of [
  ['function nextTrack(userAction=false){','if(!geOwnerDemoEnabled())','Radio Next'],
  ['function previousTrack(userAction=false){','if(!geOwnerDemoEnabled())','Radio Previous'],
  ['async function advanceFromEnded(){','if(!geOwnerDemoEnabled())','Radio automatic next'],
  ['function openTrackPicker(){','if(!geOwnerDemoEnabled())','Radio track picker'],
  ['function resumeAudio(){','!geOwnerDemoEnabled()','Radio Play']
]) guarded(radio,signature,guard,label+' checks access');
for (const [signature,guard,label] of [
  ['async function startCurrent(){','if(!geHasOwnerMusicDemo())','Homepage Play'],
  ['function next(){','if(!geHasOwnerMusicDemo())','Homepage Next'],
  ['function prev(){','if(!geHasOwnerMusicDemo())','Homepage Previous']
]) guarded(home,signature,guard,label+' checks access');

allIn(iam,['function canAccessIAmCatalog(){',"GE_PLAYER_OWNER_DEMO_V1",
  'voiceEffectChain(ctx','voiceEffectChain(reviewCtx','voiceEffectChain(off',
  'iamFxMusicMeter','iamFxMicMeter','MIC MONITOR: '],
  'I AM access, live FX, recording-review FX, export FX, and separate meters');
for (const signature of [
  'async function enter(){','async function preparePrivate(){',
  'async function selectPrivateSong(url,position=0,radioMatched=false){',
  'function choosePrivateSong(direction){','function showSongPicker(){',
  'async function toggleStudioMusic(forceStop=false){'
]) guarded(iam,signature,'if(!canAccessIAmCatalog())','I AM music guard '+signature);

for (const id of [
  'iamFxBass','iamFxMid','iamFxHigh','iamFxFilter','iamFxPhaser',
  'iamFxDelay','iamFxTime','iamFxFeedback','iamFxReverb','iamFxMonitor'
]) test(radio.includes('id="'+id+'"'),'I AM slider '+id);
allIn(lab,['LIMIT=2013','SAMPLE=33','function showAlbums(){',
  'function openAlbum(name){','GE_PLAYER_OWNER_DEMO_V1'],
  '33:33 album-first preview and local owner demo');
console.log('\nGE site static regression checks passed: '+passed);
