// GE Studios sharing regression: portable album, Radio, personal and GE lists.
// This runs without Vault, GitHub API, browser storage or Cloudflare credentials.
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('radio/index.html','utf8');
const music=fs.readFileSync('radio/ge-music-v5.js','utf8');
const a=html.indexOf('// GE music shares: portable');
const b=html.indexOf('function shareURL(){',a);
assert(a>0&&b>a,'Portable share helper must be present');
const source=html.slice(a,b);
const musicPaths=[
 'ge-music/music/Grand Element - 2026 - Aether/Aether_01_Gravity.mp3',
 'ge-music/music/Grand Element - 2026 - Aether/Aether_02_Drift.mp3',
 'ge-music/music/Grand Element - 2024 - Fire/Fire_06_Smoke.mp3'
];
const sandbox={
 URL,URLSearchParams,Math,Date,Set,Map,
 location:{href:'https://grandelement.com/radio/'},
 state:{catalog:musicPaths.slice()},
 window:{},
 navigator:{clipboard:{writeText:async()=>{}}},
 prompt:()=>{},setStatus:()=>{},
 canonicalSongPath:(v)=>String(v||'').replace(/^https?:\/\/[^/]+\//,'').replace(/^\//,''),
 fileName:v=>String(v).split('/').pop(),
 appendShareState:url=>{url.searchParams.set('bg','47.gif');url.searchParams.set('bgper','1');return url;},
 matchingStartSong:()=>{
  const name=new URL(sandbox.location.href).searchParams.get('song');
  return musicPaths.find(x=>x.split('/').pop()===name)||'';
 }
};
Object.defineProperty(sandbox.location,'search',{get(){return new URL(this.href).search;}});
const api=vm.runInNewContext(source+';({share:geShareURLForSelection,read:geReadSharedSelection});',sandbox);
for(const selection of [
 {kind:'album',name:'Aether',paths:[musicPaths[0],musicPaths[1]]},
 {kind:'playlist',name:'Bangers',paths:[musicPaths[2],musicPaths[0],musicPaths[1]],id:'bangers_main',startPath:musicPaths[0]},
 {kind:'user',name:'Listener mix',paths:[musicPaths[1],musicPaths[2]],startPath:musicPaths[1]},
 {kind:'selection',name:'My chosen songs',paths:[musicPaths[0]]}
]){
 const url=api.share(selection),parsedURL=new URL(url);
 if(selection.kind==='album'){
  assert.equal(parsedURL.href,'https://grandelement.com/album/aether/');
  assert.equal(parsedURL.search,'','Album share link has no playback or private query string');
  sandbox.location.href='https://grandelement.com/radio/?album=Aether';
 }else{
  sandbox.location.href=url;
  assert.equal(parsedURL.searchParams.get('bg'),'47.gif');
  assert.equal(parsedURL.searchParams.get('bgper'),'1');
 }
 const received=api.read();
 assert.deepEqual(Array.from(received.paths),selection.paths,selection.kind+' order preserved');
 assert.equal(received.startPath,selection.startPath||selection.paths[0]);
 assert(!/token=|secret=|code=|authorization=/i.test(url),'No private credential in link');
 assert(url.length<5000,'Portable share link within URL limit');
}
sandbox.location.href='https://grandelement.com/radio/?mix=not-valid';
assert.match(api.read().error,/Invalid shared playlist/);
sandbox.location.href='https://grandelement.com/radio/?song=Aether_02_Drift.mp3';
assert.deepEqual(Array.from(api.read().paths),[musicPaths[1]]);
assert.match(html,/function geActiveShareSelection\(\)/);
assert.match(html,/geIncomingShare=geReadSharedSelection\(\)/);
assert.match(html,/frame\.GEPlayLibraryQueue\(songs,start,title\)/);
assert.match(html,/sharedFirstBackgroundPending/);
assert.match(music,/window\.GEMusicV5=\{open,close,preload:preloadCatalog,shareSelection/);
assert.match(music,/SHARE ALBUM/);
assert.match(music,/Share selected songs or current playlist/);
// Main Radio SHARE must use the active PLAYER queue and never a bare homepage.
const shareFnStart=html.indexOf('function geActiveShareSelection(){');
const shareFnEnd=html.indexOf("$('shareBtn').addEventListener('click'",shareFnStart);
assert(shareFnStart>0&&shareFnEnd>shareFnStart,'Main SHARE selection function present');
const activeShareVM={
 ...sandbox,window:{GEMusicV5:{shareSelection:()=>({name:'Stale browser selection',paths:[musicPaths[2]],kind:'selection'})}},
 gePlaylistQuickQueue:[musicPaths[1],musicPaths[0]],
 gePlaylistQuickName:'Active playlist',gePlaylistQuickShareKind:'user',
 gePlaylistQuickIdentity:{id:'fan-example',source:'fan'},
 geInlineMusicCurrentPath:musicPaths[1],gePlaylistQuickPath:musicPaths[1],
 geInlineMusicTitle:'Song',state:{currentURL:''},
 isStationID:()=>false,parseTrack:()=>({song:'Song'})
};
const chooseActive=vm.runInNewContext(html.slice(shareFnStart,shareFnEnd)+';geActiveShareSelection',activeShareVM);
let active=chooseActive();
assert.deepEqual(Array.from(active.paths),[musicPaths[1],musicPaths[0]],'Active playlist takes priority');
assert.equal(active.kind,'user');
assert.equal(active.id,'fan-example');
activeShareVM.gePlaylistQuickQueue=[];
active=chooseActive();
assert.equal(active.name,'Stale browser selection','MUSIC selection only used when no active queue');
assert(!html.slice(shareFnEnd,html.indexOf("$('homeLink').addEventListener",shareFnEnd)).includes('resolvedShareURL()'),
 'Main SHARE never replaces music with the generic homepage link');
for(const [name,content] of [['ge-music-v5',music]]){
 new vm.Script(content,{filename:name+'.js'});
}
for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 if(/\bsrc\s*=|application\/json|importmap|ld\+json/i.test(script[1]))continue;
 if(script[2].trim())new vm.Script(script[2],{filename:'radio inline'});
}

// Every supported album permalink must include real art, canonical and social metadata.
for(const slug of ['aether','fire','spirit','soul','love','intergy','sessions-ii','sessions-i','live','trio','fundamental-groove']){
 const page=fs.readFileSync('album/'+slug+'/index.html','utf8');
 assert(page.includes('https://grandelement.com/album/'+slug+'/'),'Canonical album URL missing: '+slug);
 assert(page.includes('property="og:image"'),'Album social artwork missing: '+slug);
 assert(page.includes('id="albumTracks"'),'Album song links missing: '+slug);
 assert(page.includes('PLAY THIS ALBUM'),'Album play link missing: '+slug);
 assert(!/user-scalable=no|maximum-scale=1/.test(page),'Album page must allow browser zoom: '+slug);
}
console.log('PASS: GE music shares preserve song order, background, album and user playlists; no access credentials copied.');
