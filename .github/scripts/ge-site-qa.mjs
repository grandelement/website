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
