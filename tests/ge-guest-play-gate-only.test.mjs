import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const music=readFileSync('radio/ge-music-v5.js','utf8');
const radio=readFileSync('radio/index.html','utf8');
const preview=readFileSync('radio/preview-lab.html','utf8');
const worker=readFileSync('radio/sw.js','utf8');
new Script(music,{filename:'ge-music-v5.js'});
assert.doesNotMatch(radio,/geOpenMyMusicStore/,'Native or compact PLAY must not navigate directly to commerce');
assert.match(preview,/const AUDIO_LIMIT_SECONDS=2013/,'The original 33:33 listening limit must remain');
assert.match(preview,/if\(isLocked\(\)\)\{renderGate\(\);say\('33:33 listening complete/,'Preview must enforce the expired timer');
assert.match(worker,/const MEDIA_CACHE='ge-radio-media-v4'/,'Downloaded audio must survive the fix');
assert.match(music,/\.playSelected'\)\.addEventListener\('click',\(\)=>void playCheckedSongs\(true\)\)/,
 'MUSIC footer PLAY must still launch the checked song queue');
assert.match(music,/return await playTrack\(tracks\[0\],queue,showPlayer\)/,
 'MUSIC footer PLAY must use its selected queue in original order');
assert.match(music,/window\.GEMusicV5Bridge\?\.showMainPlayer\?\.\(\)/,
 'PLAY must reveal the existing primary player');
assert.match(radio,/function geShowMainPlaylistPlayer\(\)/,
 'The primary player handoff must remain available');
assert.match(radio,/geInlineMusicSend\('toggle'\)/,
 'Native PLAY must still toggle an active personal song');

// Execute the exact published MUSIC playAll body against a guest with no
// access token, then a restricted token, and finally an expired 33:33 Gate.
const parsed=music.match(/ playAll:\(direction='play'\)=>\{([\s\S]*?)\n \},\n refresh:/);
assert.ok(parsed,'Expected public MUSIC playAll entry point not found');
const playBody=parsed[1];
const builder=new Function(
 'musicAccessActive','window','open','say','state','selectedTracks','playTrack','preloadCatalog','direction',
 playBody
);
const makeTrack=name=>({path:'ge-music/music/Grand Element - 2026 - Aether/'+name+'.mp3',title:name,album:'Aether'});
const a=makeTrack('Aether_01_The Journey'),b=makeTrack('Aether_02-Polaris'),c=makeTrack('Aether_03-Daydream');
const all=[a,b,c];
let opened=0,preloaded=0,notes=[],played=[],gateRestores=0;
let access=null,selection=[b,a],expired=false;
const state={loaded:true,tracks:all};
const windowStub={GEGate:{isExpiredLocked:()=>expired,restore:()=>{gateRestores++}}};
const run=(direction='play')=>builder(
 ()=>access,windowStub,()=>{opened++},msg=>notes.push(msg),state,
 ()=>selection,(track,queue,show,shuffle)=>{
   played.push({path:track.path,queue,show,shuffle});
   return true;
 },()=>{preloaded++},direction
);
assert.equal(run(),true,'Guest pressing PLAY must start playback with no Vault code');
assert.deepEqual(played[0].queue,[b.path,a.path],'Checked queue order must be unchanged');
assert.equal(played[0].path,b.path,'First checked song must play first');
assert.equal(played[0].show,true,'Playing must return to the main player');
assert.equal(played[0].shuffle,false,'A checked playlist must never shuffle its saved order');
assert.equal(opened,0,'Guest PLAY must not bring up a code window');

selection=[];
assert.equal(run(),true,'Guest with no checks must still have a valid preview');
assert.equal(played.at(-1).path,a.path,'Fallback preview starts from the published catalog');
assert.deepEqual(played.at(-1).queue,[a.path,b.path,c.path]);

access={restricted:true,allowed:[c.path],token:'synthetic_test_receipt',until:Date.now()+3600000};
selection=[b,c];
assert.equal(run(),true,'Restricted receipt must still play its assigned song');
assert.deepEqual(played.at(-1).queue,[c.path],'Restricted receipt may not play unassigned tracks');
assert.equal(played.at(-1).path,c.path);

access=null;expired=true;
const before=played.length;
assert.equal(run(),false,'Expired guest must be blocked at the Gate');
assert.equal(played.length,before,'Expired preview must never start a song');
assert.equal(gateRestores,1,'Expired Gate must appear');
assert.ok(notes.at(-1).includes('33:33'),'Show the correct expiry reason');

expired=false;state.loaded=false;
assert.equal(run(),false,'Catalog not loaded yet cannot start playback');
assert.equal(opened,0,'Loading songs must not unnecessarily open the MUSIC editor');
assert.equal(preloaded,1,'Loading PLAY should request catalog preparation');
state.loaded=true;
selection=[b];
assert.equal(run('all'),true,'The main PLAY button must play all available songs');
assert.deepEqual(played.at(-1).queue,[a.path,b.path,c.path],
 'Main PLAY ALL must not silently reduce the library to previously checked songs');

selection=[b];
assert.equal(run('next'),true,'Next can initialize the full shuffled song library');
assert.deepEqual(played.at(-1).queue,[a.path,b.path,c.path],
 'Initial Next must ignore previously checked songs and use the entire allowed catalog');
assert.equal(run('previous'),true,'Previous can initialize the complete song library');
assert.deepEqual(played.at(-1).queue,[a.path,b.path,c.path],
 'Initial Previous must not route into a checked playlist');

// All transport controls remain on the Radio page. Only an actual Music
// selection or the licensed preview Gate may open the separate Music UI.
const nextSource=radio.slice(radio.indexOf('function nextTrack(userAction=false)'),
 radio.indexOf('function previousTrack(userAction=false)'));
const prevSource=radio.slice(radio.indexOf('function previousTrack(userAction=false)'),
 radio.indexOf('async function loadMusicManifest(',radio.indexOf('function previousTrack(userAction=false)')));
assert.ok(nextSource.length>0&&prevSource.length>0,'Native Next/Previous handlers must exist');
assert.doesNotMatch(nextSource,/geOpenMusicSelection/,'NEXT must never open MUSIC');
assert.doesNotMatch(prevSource,/geOpenMusicSelection/,'PREVIOUS must never open MUSIC');
assert.match(radio,/startMainMusicLibrary\('all'\)/,'Radio PLAY must start the whole library');
assert.match(radio,/function geInlineMusicSend\(action\)/,'Existing personal queue transport must remain');
assert.match(preview,/geRebuildShuffleVisitOrder\(trackIndex\)/,
 'The protected player must navigate a shuffled all-song queue');
assert.match(preview,/window\.GEControlMusicQueue=function\(action\)/,
 'Play, Next and Previous must navigate the protected song queue directly');

// Execute the native resumeAudio guest branch as an additional routing check.
const start=radio.indexOf('function resumeAudio(){');
const end=radio.indexOf('\nfunction selectNaturalNext(',start);
assert.ok(start>=0&&end>start,'Native PLAY/resume transport missing');
const resumeSource=radio.slice(start,end);
let nativePlay=0,nativeToggle=0;
let personal=false;
const nativeResume=new Function(
 'state','geOwnerDemoEnabled','offlinePlaybackMode','geRadioUtilityAllowed',
 'window','geInlineMusicActive','geInlineMusicSend','startMainMusicLibrary',
 resumeSource+'\nreturn resumeAudio;'
);
const playWindow={GEMusicV5:{playAll:()=>{nativePlay++}}};
nativeResume({live:false,livePreparing:false},()=>false,()=>false,()=>false,playWindow,false,()=>{},(mode)=>{assert.equal(mode,'all');nativePlay++})();
assert.equal(nativePlay,1,'Native guest PLAY must use preview, not commerce');
nativeResume({live:false,livePreparing:false},()=>false,()=>false,()=>false,playWindow,true,()=>{nativeToggle++},()=>{nativePlay++})();
assert.equal(nativeToggle,1,'Native PLAY must toggle existing personal song');
assert.equal(nativePlay,1,'Toggling personal music must not replace its queue');

state.loaded=true;state.tracks=[];selection=[];
assert.equal(run('all'),false,'An unavailable library does not open MUSIC');
assert.equal(opened,0,'Unavailable main Radio transport never redirects to the Music selector');


 
// The September radio built song labels from displayTitle(path,!shuffle).
// Protected previews emit numbered album titles, so the visible Radio title
// must still lose its album number immediately when SHUFFLE is chosen.
const displayStart=radio.indexOf('function geInlineMusicDisplayTitle(){');
const displayEnd=radio.indexOf('\\nfunction geInlineMusicSyncTransport(){',displayStart);
assert.ok(displayStart>=0&&displayEnd>displayStart,'Shuffle title formatter missing');
const displaySource=radio.slice(displayStart,displayEnd);
const titleFor=(shuffle,path,title)=>new Function(
 'state','canonicalSongPath','geInlineMusicCurrentPath','displayTitle','geInlineMusicTitle',
 displaySource+'\\nreturn geInlineMusicDisplayTitle();'
)({shuffle},p=>p,path,(p,numbered)=>'Intergy'+(numbered?' • 02':'')+' • Be Free',title);
const numbered='Intergy • 02 • Be Free';
assert.equal(titleFor(false,'ge-music/music/Grand Element - 2007 - Intergy/Intergy_02_Be Free.mp3',numbered),
 numbered,'Album order must show the original album track number');
assert.equal(titleFor(true,'ge-music/music/Grand Element - 2007 - Intergy/Intergy_02_Be Free.mp3',numbered),
 'Intergy • Be Free','Shuffle must immediately hide the album track number');
assert.equal(titleFor(true,'',numbered),'Intergy • Be Free',
 'Shuffle must hide the number even before a track path arrives');
assert.match(radio,/geInlineMusicSyncTransport\\(\\); \/\/ Refresh Album/,
 'Shuffle must refresh the main Radio title without waiting for another song');
assert.match(radio,/window\\.addEventListener\\('ge-music-catalog-ready',geRetryPendingMainMusic\\)/,
 'First PLAY must resume when the asynchronous music catalog is available');
assert.match(radio,/geInlineMusicFrame\\.addEventListener\\('load',[\\s\\S]*?geRetryPendingMainMusic\\(\\)/,
 'First PLAY must resume when the protected preview iframe loads');
assert.match(music,/function playTrack\\(track,queueOverride,showPlayer=false,shuffleAll=false\\)/,
 'First PLAY must return its actual synchronous success or failure');
assert.doesNotMatch(music,/async function playTrack\\(/,
 'A rejected first PLAY must not be mistaken for a truthy Promise');

console.log('PASS: guest PLAY, saved song order, no forced code/store redirect, restricted receipt, expired 33:33 Gate, native transport.');
