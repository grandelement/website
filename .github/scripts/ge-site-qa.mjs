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
  test(pos >= 0 && source.slice(pos, pos + signature.length + 640).includes(guard), label);
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
const backroom=load('backroom/index.html');
const liveSiteConfig=JSON.parse(load('config/site-live.json'));
const testSiteConfig=JSON.parse(load('config/site-test.json'));
const savedBackroomPresets=JSON.parse(load('config/backroom-presets.json'));
test(home.includes("ge_game_setup") &&
     home.includes("requestedGame==='gravity'||requestedGame==='flight'") &&
     home.includes("if(button)button.click()"),
     'Back Room deep links open Gravity and Flight through their actual game controls');
test(backroom.includes('id="brGameGeneralDefaults"') &&
     backroom.includes('id="brGameDefaultPlayers"') &&
     !backroom.includes('class="brGameOptionsButton"'),
     'Back Room uses expandable general defaults instead of game-specific settings');

for(const [label,cfg] of [['live',liveSiteConfig],['test',testSiteConfig],
  ...savedBackroomPresets.presets.map((p,i)=>['preset '+i,p.config])]){
  test(cfg.music?.startupEnabled===false&&!cfg.music?.firstTrack,
    label+' starts silent without a default The Source song');
}
test(home.includes('const startupMusicEnabled=false;') &&
     home.includes('id="geHomeRadioTransport"') &&
     home.includes("radio/preview-lab.html") &&
     home.includes("(!startupMusicEnabled&&s.userSelected!==true)") &&
     home.includes("nowPlaying.textContent='CHOOSE MUSIC'"),
     'homepage starts without a forced first track; radio and song selection remain visitor-initiated');
test(backroom.includes('<option value="">LET VISITOR CHOOSE MUSIC</option>') &&
     !backroom.includes('find(o=>/Fire_11_The Source'),
     'Back Room can publish no opening song without reselecting The Source');
const iam=load('radio/iam-private-studio.js');
const lab=load('radio/preview-lab.html');
const store=load('support/index.html');
const catalog=JSON.parse(load('support/catalog.json'));
allIn(radio,[
  "function eqTapIsNeeded(){",
  "document.body.classList.contains('view-ship')&&geRadioLocalTestAccess()",
  "const eqRingLines=$('shipEQOrbLines')",
  "function bandLevel(i,count){",
  "const level=bandLevel(i,bars.length)",
  "id=\"shipEQOrb\"",
  "id=\"shipSunLabBtn\"",
  "id=\"shipGateTestBtn\"",
  "body.view-ship .sunlab-panel.show",
  "let developerGatePreview=false",
  "developerGatePreview=true",
  "developerGatePreview=false",
  "function molecularScanNote(){",
  "window.GEShip={syncAll,applyMode};",
  "function enqueueAlbumPlanet(label){",
  "function updateAlbumPlanets(dt){",
  "if(album.name==='Singles')picture.style.filter='grayscale(1) contrast(1.15)'",
  "albumFlight.position=Math.max(-80"
], 'Ship EQ real-bin displays, Gate preview, science-themed fictional radar, album flyby events');
test(!radio.includes('ship-album-flybys.js') &&
  radio.includes('id="shipAlbumPlanetLayer"') &&
  radio.includes("el.className='ship-album-planet'") &&
  radio.includes("window.GEAlbumPlanets={enqueue:enqueueAlbumPlanet"),
  'Exactly one album-planet flight system remains and original Blue Sun arrival is preserved');
test(!radio.includes("const a=(Math.sin(t*(3.1+side*.35)") &&
  !radio.includes("else level=.16+.72*((Math.sin(t*3.2+i*.72)"),
  'Ship dashboard and ring do not show simulated audio waves');


test(catalog.radio?.id==='radio-monthly' && catalog.radio.price===6 &&
  catalog.radio.billing_period==='month' && catalog.radio.subscription===true,
  'Store catalog has $6/month Radio membership');
allIn(store,['radio-monthly','$6.00 / month','myMusicCode','myMusicUnlock'],
  'Store renders subscription and My Music code');
test(store.includes('Not connected') && store.includes('Preview only'),
  'Unverified payments remain disabled');

allIn(radio,['hardLimitSeconds: 2013','graceSeconds: 11','fadeSeconds: 33',
  "trigger('listening-3333')","reason==='listening-3333'",
  'function holdGateTimeline(){','function resumeGateTimeline(){'],
  'Radio Gate: 11s after centered Sun then 33s fade, fixed deadline after lock');
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
  "if((gs.expired&&!authorized())||!state.live||radio2.active||!GATE_CONFIG.liveMetadataURL)return"
], 'LOVE developer-only Radio UI and quiet native-safe Gate');

// Native iPhone playback takes priority over the separate Sun Lab tap.
// A successful play()/playing event is NOT evidence that the MP3 is audible.
const iosAudioPath=radio.slice(radio.indexOf('async function ensureLiveEQ(){'),
                              radio.indexOf('window.GEStopEQTapIfUnused='));
test(iosAudioPath.includes('if(GE_IOS_AUDIO){') &&
     iosAudioPath.includes('eqTapAudio?.pause()') &&
     iosAudioPath.indexOf('if(GE_IOS_AUDIO){')<iosAudioPath.indexOf('eqTapAudio=new Audio()'),
     'iPhone Radio never creates a competing silent EQ player');
const primaryWatch=radio.slice(radio.indexOf('function watchRadioConnection(){'),
                               radio.indexOf('function radioPlayFailure('));
test(primaryWatch.includes('if(observedRadio1Progress)return;') &&
     !primaryWatch.includes('if(!audio.paused&&audio.readyState>=3)return;') &&
     primaryWatch.includes("switchToRadio2('radio1_timeout')") &&
     primaryWatch.includes("!liveState.wantedPlayback"),
     'Radio 1 falls back when readyState is positive but audio does not advance');
const radioButton=radio.slice(radio.indexOf("$('liveBtn').addEventListener('click',()=>{"),
                             radio.indexOf("$('shuffleBtn').addEventListener('click',()=>{"));
test(radioButton.includes("void requestRadioStart({userGesture:true});") &&
     !radioButton.includes("exitLiveMode(") &&
     !radioButton.includes("resumeLiveAtEdge()") &&
     radio.includes("let radioStartInFlight=null,radioTapUnlockInFlight=null;") &&
     radio.includes("if(radioStartInFlight){"),
     'RADIO button is a non-destructive, single-flight start/retry control');
const coordinator=radio.slice(radio.indexOf('function requestRadioStart({'),
                              radio.indexOf('async function resumeRadio(){'));
test(coordinator.includes("if(userGesture&&audio.paused") &&
     coordinator.includes("radioTapUnlockInFlight=unlocking") &&
     coordinator.includes("Promise.race([work,limit])") &&
     coordinator.includes("timeout=setTimeout(resolve,12500)") &&
     coordinator.includes("radioStartInFlight=operation"),
     'iPhone tap unlocks a pending autoplay on the same audio; a hung promise cannot block retry forever');
const startCue=radio.slice(radio.indexOf('function updateRadioStartupCue(){'),
                           radio.indexOf('function liveStreamConfigured(){'));
test(startCue.includes('observedRadio2Progress:observedRadio1Progress') &&
     startCue.includes("button.classList.toggle('radio-start-cue',cue)"),
     'Startup pulse stays until actual forward audio progress');
test(radio.includes('geRadioSingleArrivalPulse 6.7s') &&
     radio.includes('grid-column:3 / span 2!important') &&
     radio.indexOf('id="shuffleBtn" aria-pressed="true">Shuffle</button>')<
       radio.indexOf('id="liveBtn" aria-pressed="true">RADIO</button>'),
     'RADIO is centered and uses one slow glow-and-flash cycle');
const recovery=radio.slice(radio.indexOf('function watchRadioConnection(){'),
                            radio.indexOf('function radioPlayFailure('));
test(recovery.includes('if(radioWatchTimer&&!radioTimedOut)return;'),
     'Repeated waiting events do not reset Radio failover deadline');

const playingEvent=radio.slice(radio.indexOf("audio.addEventListener('playing',()=>{\n  if(state.live||state.livePreparing){"),
                                radio.indexOf("audio.addEventListener('waiting',()=>{"));
test(playingEvent.includes('checking stream audio') &&
     !playingEvent.includes("setStatus('Grand Element Radio is playing.')") &&
     radio.includes("setLiveStatus('RADIO 1 · audio stream advancing')"),
     'Radio displays checking until stream time advances');

const gateFxSource=radio.slice(radio.indexOf('function createGateFxGraph(ctx){'),radio.indexOf('window.GEGateFX={'));
test(!/fxDelay|fxFeedback|delayGain|createDelay\(|delayTime/.test(gateFxSource) &&
  gateFxSource.includes('fxReverb=ctx.createConvolver()') &&
  gateFxSource.includes("fxAllpass.type='allpass'") &&
  gateFxSource.includes("fxFilter.type='lowpass'") &&
  gateFxSource.includes('fxWet.gain.setTargetAtTime(wet,now,.10)') &&
  radio.includes('window.GEAudioGain?.syncProgress?.(safe)') &&
  radio.includes('window.GEAudioGain?.scheduleGate?.(gs.wavesAt,gs.fadeAt,gs.expireAt,GATE_CONFIG.reverbMax)') &&
  !radio.includes("audio.removeAttribute('crossorigin')") &&
  radio.includes("audio.crossOrigin='anonymous'"),
  'Single-source Gate audio, water-to-cutoff reverb and configurable 33-second fade remain');

test(!radio.includes("if(entered!==String(GATE_CONFIG.password||'').trim().toLowerCase()){wrongWord();return;}") ||
 radio.includes("location.assign('../support/?section=radio&flow=shop');"),
 'An incorrect Gate code routes to membership instead of granting access');
const eqPath=radio.slice(radio.indexOf('async function ensureLiveEQ(){'),radio.indexOf('  // Kept for the existing song-change hook.'));
test(eqPath.includes("if(!eqTapIsNeeded()") && !eqPath.includes("    return false;\n    try{"),
  'Analyser no longer disabled and does not create second stream for ordinary guests');
test(radio.includes("if(/iPad|iPhone|iPod/i.test(navigator.userAgent||''))"),
  'Native iPhone media path preserved');
const preview=load('radio/preview-lab.html');
const archivedMerchPreview=load('radio/preview-merch-legacy.html');
test(preview.includes("LEGACY_MERCH_PREVIEW_BUILDER_ENABLED=false") &&
  preview.includes('AUDIO_LIMIT_SECONDS=2013') &&
  preview.includes('GRACE_SECONDS=t.graceSeconds;FADE_SECONDS=t.fadeSeconds') &&
  preview.includes('GATE_AT=AUDIO_LIMIT_SECONDS-APPROACH_SECONDS-GRACE_SECONDS-FADE_SECONDS') &&
  preview.includes('if(data.used>=AUDIO_LIMIT_SECONDS)expireGate()') &&
  preview.includes('audio.addEventListener(\'timeupdate\',syncListening)') &&
  preview.includes('id="geGate"') &&
  archivedMerchPreview.includes('function selectedTime(){') &&
  archivedMerchPreview.includes("button('33s',function(){sample(t,33)}"),
  'Music player direct song choice, 33:33 real playback limit and full visual Gate; legacy merchandise builder archived');
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

test(radio.includes('const GE_RADIO2_DISABLED=false;') &&
     radio.includes('const kind=radio2ProgramKind(program);') &&
     radio.includes("if(name==='bangers')return 'bangers';") &&
     radio.includes("program?.playlist_hash==='6ffcaf4206e25c78'") &&
     radio.includes('void retryRadio1Only(reason);'),
     'Radio 2 plays published Bangers or only the verified 50-track fallback, while retaining bounded Radio 1 retries');
allIn(radio,['RADIO 1 UNAVAILABLE — SWITCHING TO RADIO 2','switchToRadio2',
  'function geOpenMyMusicStore(){','function geOpenMusicSelection(){'],
  'Radio fallback and guest music routing');
for (const [signature,guard,label] of [
  ['function nextTrack(userAction=false){','if(!geOwnerDemoEnabled())','Radio Next'],
  ['function previousTrack(userAction=false){','if(!geOwnerDemoEnabled())','Radio Previous'],
  ['async function advanceFromEnded(){','if(!geOwnerDemoEnabled())','Radio automatic next'],
  ['async function playURL(url,','if(!geOwnerDemoEnabled())','Radio actual library playback'],
  ['function resumeAudio(){','!geOwnerDemoEnabled()','Radio Play']
]) guarded(radio,signature,guard,label+' checks access');
test(radio.includes('function openTrackPicker(){') && radio.includes('if(fullMusicPickerCatalog.length)renderTrackList();'),
  'Guests can browse the full music catalog while actual playback remains access-controlled');
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
allIn(lab,['AUDIO_LIMIT_SECONDS=2013','function showAlbums(){',
  'function openAlbum(name){','GE_PLAYER_OWNER_DEMO_V1',
  'function isCounting(){','function stopCounting(){',
  'function renderGate(){','function renderVolume(){','function nextTrack(){'],
  '33:33 album-first full-song listening, native audio and Gate with pause/buffer accounting');
test(radio.includes('id="arrivalReplyPrompt"') &&
  radio.includes("async function submitArrivalMessage(){") &&
  radio.includes("void submitArrivalMessage()") &&
  radio.includes("id=\"arrivalReplyEmail\"") &&
  !radio.includes("arrivalSend?.addEventListener('click',async()=>{"),
  'Inner horizon SEND and POST call real submit handler; reply email is optional');
test(radio.includes('ge-responsive-radio-ship-reflections-20261015') &&
  radio.includes('#shipReflectionWall.open #reflectionBubble.open') &&
  radio.includes('getElementById') &&
  radio.includes("soul-reflection-dot.selected"),
  'Ship responsive controls and readable Soul bubbles');
test(radio.includes("const rate=.00275*Math.pow(speed,1.2)*warpMultiplier*(approach.throttle>0?2:1)") &&
  radio.includes('FREQUENCY SWEEP') &&
  radio.includes("requestRadioStart({userGesture:true})") &&
  radio.includes('id="contactLaunchBtn" type="button" aria-label="Contact Grand Element">CONTACT') &&
  radio.includes('id="accessLaunchBtn" type="button" aria-label="Enter your Inner Frequency access code">CODE') &&
  radio.includes('hardLimitSeconds: 2013'),
  'Blue Sun accelerated, moving radar sweep, safe gesture PLAY, CONTACT and 33:33 limit remain');

test(radio.includes("HOME_URL: 'https://www.grandelement.com/'") &&
     radio.includes("href=\"https://www.grandelement.com/\"") &&
     radio.includes("location.assign(document.getElementById('homeLink')?.href") &&
     radio.includes("id=\"homeLink\""),
     'Main and floating Blue Suns route to canonical GE website');
test(radio.includes('ge-radio-anchored-footer-spacing-20261015') &&
     radio.includes('body.view-player:not(.iam-studio-open) #bgGroup{') &&
     radio.includes('flex:1 1 0px!important;min-height:clamp(100px,16dvh,220px)') &&
     radio.includes('margin:0 auto!important') &&
     radio.includes('grid-area:1 / 1 / 2 / 2!important') &&
     radio.includes('grid-area:1 / 2 / 2 / 3!important') &&
     radio.includes('grid-area:1 / 3 / 2 / 4!important'),
     'Responsive Sun-to-text spacing and bottom-anchored Backgrounds with three-button row');
test(radio.includes('id="contactLaunchBtn"') &&
     radio.includes('id="accessLaunchBtn" type="button" aria-label="Enter your Inner Frequency access code">CODE') &&
     radio.includes("if(controller?.openCodeEntry)controller.openCodeEntry();") &&
     radio.includes("mailto:info@grandelement.com?subject=Grand%20Element%20Contact") &&
     radio.includes("password: 'love'") &&
     radio.includes("hardLimitSeconds: 2013"),
     'CONTACT email, SUPPORT shopping, original LOVE test CODE, and 33:33 timing preserved');
test(radio.includes("buttons.prev.addEventListener('click'") &&
     radio.includes("buttons.next.addEventListener('click'") &&
     radio.includes("buttons.off.addEventListener('click'") &&
     radio.includes("buttons.per.addEventListener('click'") &&
     radio.includes("buttons.shuffle.addEventListener('click'") &&
     radio.includes("playBtn?.addEventListener('click'") &&
     radio.includes("$('liveBtn').addEventListener('click'") &&
     radio.includes("$('shareBtn').addEventListener('click'"),
     'Visible music and background buttons retain click handlers');
const gateBackroom=load('backroom/index.html');
const gateSettings=load('radio/ge-gate-settings.js');
test(gateBackroom.includes('id="gateGraceSeconds"') &&
     gateBackroom.includes('id="gateFadeSeconds"') &&
     gateBackroom.includes('id="gateReverbMax"') &&
     gateBackroom.includes('cfg.gateTiming=readGateFields()') &&
     gateSettings.includes("fetch('../config/site-live.json'") &&
     radio.includes('window.GEAudioGain?.scheduleGate?.(gs.wavesAt,gs.fadeAt,gs.expireAt,GATE_CONFIG.reverbMax)') &&
     preview.includes('schedulePreviewGateAudio()') &&
     preview.includes('ge-gate-settings.js'),
     'Back Room publishes editable Gate hold/fade/reverb to Radio and music-preview player');
const refreshedRadioWorker=load('radio/sw.js');
const workerCacheVersion=/const VERSION='([^']+)'/.exec(refreshedRadioWorker)?.[1]||'';
const workerURLVersion=workerCacheVersion.replace(/^(\d{4})\.(\d{2})\.(\d{2})/,'$1$2$3');
test(/^20\d{2}\.\d{2}\.\d{2}-.+/.test(workerCacheVersion) &&
     radio.includes('./sw.js?v='+workerURLVersion) &&
     refreshedRadioWorker.includes("'./ge-gate-settings.js'") &&
     refreshedRadioWorker.includes("'./ge-gate-audio.js'") &&
     refreshedRadioWorker.includes("const MEDIA_CACHE='ge-radio-media-v4'"),
     'New radio shell cache loads updated layout without deleting offline downloads');

test(!home.includes('https://grandelement.github.io/website/ge-images/') &&
     !home.includes('https://grandelement.github.io/website/data/') &&
     home.includes("url('ge-images/images/ge-logo-2.jpg')") &&
     home.includes('src="ge-images/images/ge-radio-logo.png"') &&
     fs.existsSync('ge-images/images/ge-logo-2.jpg') &&
     fs.existsSync('ge-images/images/ge-radio-logo.png'),
     'GE homepage loads Blue Sun and Radio Moon locally, without old GitHub-hosted assets');
test(radio.includes("flex:1 1 0px!important;min-height:clamp(100px,16dvh,220px)!important") &&
     radio.includes("min-height:clamp(90px,15dvh,155px)!important") &&
     radio.includes("max(48px,calc(42px + env(safe-area-inset-bottom)))") &&
     radio.includes("margin:0 auto clamp(26px,3.6dvh,42px)") &&
     radio.includes("margin:0 auto clamp(23px,3.1dvh,38px)") &&
     radio.includes('#radioCopyright{') &&
     radio.includes('position:fixed;'),
     'GE Radio places I AM midway, adds Sun/title space, reserves copyright footer strip');
test(load('sw.js').includes("GE_SITE_SHELL_V2_LOCAL_BRAND_ART") &&
     radio.includes('./sw.js?v='+workerURLVersion) &&
     load('radio/sw.js').includes("ge-radio-media-v4"),
     'Home and Radio refresh app shell without deleting downloaded music');
test(radio.includes('mailto:access@grandelement.com?subject=Grand%20Element%20Access%20Request') &&
     radio.includes('GET ACCESS BY EMAIL') &&
     radio.includes("helpEmail: 'access@grandelement.com'") &&
     radio.includes("helpSubject: 'Grand Element Access Request'") &&
     radio.includes("location.href=\`mailto:\${GATE_CONFIG.helpEmail}?subject=\${subject}&body=\${body}\`;") &&
     radio.includes("mailto:info@grandelement.com?subject=Grand%20Element%20Contact") &&
     !radio.includes('mailto:info@grandelement.com?subject=Grand%20Element%20Radio'),
     'Gate access requests use access@, separate from general CONTACT info@');
test(radio.includes('remaining=Math.max(0,(Number(gs.expireAt)-Date.now())/1000)') &&
     radio.includes('const wet=usable&&p>0?.60*Math.pow(p,1.25)') &&
     radio.includes('lastForegroundReconcileAt<750') &&
     !radio.includes("gs[key]=Number(gs[key])+stopped") &&
     radio.includes('if(audio.paused||!gateAudioFlowing||!state.live)return false;')===false,
     'Radio Gate wall-clock deadline unaffected by iPhone background or disconnection');
test(preview.includes('effectiveListeningSeconds()') &&
     preview.includes('gateStartedAtMs') &&
     preview.includes('startSongGateIfReady()'),
     'Independent personal music Gate persists after backgrounding');
test(home.includes('approved.has(item.clean)') &&
     home.includes("const masterUrl=location.origin+BASE_PATH+'config/site-live.json'") &&
     home.includes('if(approved.size!==approvedPaths.length)') &&
     home.includes("const RADIO_ALBUM_ORDER=['Singles','Aether'"),
     'Homepage fallback Player/Shuffle plays only Master-approved paths, Singles first');
// One Back Room MUSIC surface; no accidental publish of unrelated draft settings.
test(backroom.includes('<section data-br-tab="music">\n  <section id="brMasterSection"') &&
     backroom.includes('id="brMasterRefresh"') &&
     backroom.includes('id="brMasterSave"') &&
     backroom.includes('id="brMasterSongs"') &&
     backroom.includes("await api('/publish',{method:'POST',body:JSON.stringify({config:published}),timeoutMs:25000})") &&
     backroom.includes("radioMasterRevision:(Number(live.music?.radioMasterRevision)||0)+1") &&
     backroom.includes("const live=await repoLive()") &&
     backroom.includes('<section data-br-tab="playlists" id="brDJPlaylistEditor">') &&
     !backroom.includes('id="brMusicGoPlaylists"') &&
     !backroom.includes('id="brMusicPublicLists"'),
     'MUSIC offers one saved Master Song List and keeps PLAYLISTS separate');
const approvedList=liveSiteConfig.music?.radioMasterSongPaths;
const files=JSON.parse(load('radio/manifest.json')).files;
test(Array.isArray(approvedList)&&approvedList.length>0&&
     approvedList.length===new Set(approvedList).size&&
     approvedList.every(path=>files.includes(path)),
     'Published GE Radio Master Song List has no duplicates or unavailable paths');
test(radio.includes('approvedAutoPaths.has(canonicalSongPath(url))') &&
     radio.includes('radioMasterSongPaths') &&
     !radio.includes('GE_AUTO_SOURCE_COMMIT') &&
     backroom.includes('id="brMasterSongs"'),
     'Radio Player/Shuffle shares a path-based allowlist editable in Back Room');
test(radio.includes('DJ PLAYLISTS') &&
     radio.includes('MY PLAYLISTS') &&
     radio.includes('GE_MUSIC_PERSONAL_PLAYLISTS_V1') &&
     radio.includes("geInlineMusicFrame?.contentWindow?.GEPlayLibraryTrack") &&
     load('radio/preview-lab.html').includes("const MUSIC_ALBUM_ORDER=['Singles','Aether'"),
     'Listener MUSIC provides published and named personal playlists and single-song preview');


const radioShuffleHandler=radio.slice(radio.indexOf("('shuffleBtn').addEventListener('click'"),radio.indexOf("('legacyBtn').addEventListener('click'"));
test(radioShuffleHandler.includes("state.shuffle=!state.shuffle")&&
     !radioShuffleHandler.includes("geOpenMusicSelection()")&&
     radioShuffleHandler.includes("Radio continues unchanged."),
     'SHUFFLE no longer opens MUSIC or interrupts shared live playback');
test(radio.includes("function geOpenContact(){")&&
     radio.includes("COPY EMAIL")&&
     radio.includes("('contactLaunchBtn')?.addEventListener('click',geOpenContact)"),
     'CONTACT displays a copyable address when mailto is unavailable');
test(radio.includes("if(geRadioLocalTestAccess()||vaultRedeemBusy)return;")&&
     radio.includes("if(controller?.openCodeEntry)controller.openCodeEntry();")&&
     radio.includes("#bottomActions #offlineBtn:not([hidden])"),
     'CODE accepts later owner access, showing offline tools only after owner unlock');
const musicPicker=load('radio/preview-lab.html');
test(musicPicker.includes("function playWholeAlbum(name)")&&
     musicPicker.includes("'PLAY ALBUM','playAlbumTile'")&&
     musicPicker.includes("('playBrowserCollection').addEventListener('click',()=>playWholeAlbum(selectedAlbum))"),
     'Whole albums play from the album browser');
test(musicPicker.includes('id="saveAlbumOffline"')&&
     musicPicker.includes("caches.open('ge-radio-media-v4')")&&
     musicPicker.includes("if(!isAuthorized()){renderGate();return;}"),
     'Owner offline album save reuses the media cache');
test(load('docs/RADIO23-REPAIR-LEDGER.md').includes('BANGERS is **just a saved playlist**'),
     'Radio 23 preserves BANGERS as one saved playlist');

const homepagePWA=JSON.parse(load('manifest.webmanifest'));
test(home.includes('href="./favicon-32x32.png"') &&
     home.includes('href="./favicon-16x16.png"') &&
     home.includes('href="./apple-touch-icon.png"') &&
     fs.existsSync('favicon-32x32.png') &&
     fs.existsSync('favicon-16x16.png') &&
     fs.existsSync('apple-touch-icon.png') &&
     Array.isArray(homepagePWA.icons) &&
     homepagePWA.icons.length>=2 &&
     homepagePWA.icons.every(icon=>fs.existsSync(icon.src.replace(/^\.\//,''))),
     'Homepage favicon and all PWA/Home Screen icons resolve to actual files');


const vaultDJ=load('vault-worker/src/index.js');
test(Array.isArray(liveSiteConfig.music?.publicDJPlaylistNames)&&
     liveSiteConfig.music.publicDJPlaylistNames.length===1&&
     liveSiteConfig.music.publicDJPlaylistNames[0]==='Bangers'&&
     vaultDJ.includes('publishedByName')&&
     vaultDJ.includes('if(meta.source!=="ge-radio")continue;')&&
     radio.includes("publishedNames.has(String(item?.name||'').trim().toLowerCase())"),
     'MUSIC reads only owner-approved Bangers from the existing original DJ Vault table');
test(radio.includes("geTrackScroller")&&
     radio.includes("trackList.scrollTop=priorPanelScroll")&&
     radio.includes("scrollArea.scrollTop=priorSongScroll")&&
     radio.includes("#trackList>#geTrackScroller")&&
     radio.includes("html.ge-radio-ui #trackList.open{")&&
     radio.includes("top:max(43px,calc(env(safe-area-inset-top) + 8px))"),
     'iPhone MUSIC uses one native scrolling panel and preserves position below the status bar');
 test(radio.includes("OWNER-PUBLISHED ORIGINAL DJ SNAPSHOT")&&
     radio.includes("publishedConfigNames.get(id)")&&
     radio.includes("allowed.get(item.id).has(path)")&&
     backroom.includes("cfg.music.publicDJPlaylistNames=visible?['Bangers']:[]"),
     'Original DJ Bangers publication survives Vault replication lag without exposing private playlists');
test(radio.includes('ge-radio-mobile-layout-scroll-20261023')&&
     radio.includes('width:clamp(108px,17.3dvh,156px)')&&
     radio.includes('<div id="radioCopyright">Copyright GE Studios and Grand Element. All rights reserved.</div>\n</main>') &&
     radio.includes('#bottomActions #offlineBtn{display:none!important}'),
     'Radio keeps a smaller EQ Sun and a non-overlapping footer while hiding pre-purchase tools');

console.log('\nGE site static regression checks passed: '+passed);
