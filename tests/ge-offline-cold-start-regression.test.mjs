import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sw=readFileSync('radio/sw.js','utf8');
const radio=readFileSync('radio/index.html','utf8');
const manager=readFileSync('radio/offline-manager.js','utf8');
const music=readFileSync('radio/ge-music-v5.js','utf8');
const spectrum=readFileSync('radio/offline-spectrum.js','utf8');
const launcher=readFileSync('radio/offline-home.html','utf8');
const webmanifest=JSON.parse(readFileSync('radio/manifest.webmanifest','utf8'));

test('offline worker keeps media cache and requires essential app files',()=>{
 assert.match(sw,/const MEDIA_CACHE='ge-radio-media-v4'/);
 assert.match(sw,/const REQUIRED_SHELL=\[/);
 assert.match(sw,/Promise\.all\(REQUIRED_SHELL\.map/);
 assert.match(sw,/await self\.skipWaiting\(\)/);
 assert.ok(sw.indexOf('await Promise.all(REQUIRED_SHELL.map')<sw.indexOf('await self.skipWaiting()'));
 assert.match(sw,/offlineNavigationFallback/);
 assert.match(sw,/'.\/offline-home\.html'/);
 assert.doesNotMatch(sw,/'.\/offline-control\.js'/,'Duplicate offline controller must not be cached');
 assert.match(sw,/'.\/offline-manager\.js'/);
 assert.match(sw,/'.\/offline-spectrum\.js'/);
 assert.match(sw,/GE_RADIO_SHELL_STATUS/);
});
test('network recovery is bounded even if Safari reports online incorrectly',()=>{
 assert.match(sw,/async function fetchWithTimeout\(/);
 assert.match(sw,/tag==='install'\?20000:3500/);
 for(const path of [
  'secondaryPageNavigationResponse','mediaResponse','staticResponse'
 ]){
  const start=sw.indexOf('async function '+path+'(');
  assert.ok(start>=0);
  const segment=sw.slice(start,start+1500);
  assert.match(segment,/fetchWithTimeout\(request/);
 }
 assert.match(sw,/return new Response\('Media not available without a connection',\{status:503\}\)/);
});
test('radio cold start checks stored identity with no Vault request',()=>{
 assert.match(radio,/window\.GEVault\?\.anonId\|\|localStorage\.getItem\('ge_vault_anon_id'\)/);
 assert.match(radio,/discoverOfflineMediaFromCaches\(\)/);
 assert.match(radio,/Number\(receipt\?\.until\|\|grant\?\.until\|\|0\)/);
 assert.match(radio,/geRadioUtilityAllowed\('offline'\)/);
});
test('single MUSIC offline engine is scoped to verified Radio grants',()=>{
 assert.match(sw,/'.\/offline-manager\.js'/);
 assert.match(radio,/window\.GERadioOfflineBridge=\{/);
 assert.match(radio,/canDownload:\(\)=>geRadioUtilityAllowed\('offline'\)/);
 assert.match(radio,/allowedPaths:\(\)=>\{const allowed=geOfflineSongAllowance\(\)/);
 assert.match(manager,/const AUDIO='ge-radio-media-v4'/);
 assert.match(manager,/bridge\(\)\.canDownload\?\.\(\)/);
 assert.match(manager,/cache\.put\(url,new Response\(blob,\{status:200,headers\}\)\)/);
 assert.doesNotMatch(manager,/window\.confirm\('Delete downloaded AUDIO/,'No destructive action in the single OFFLINE download screen');
 assert.doesNotMatch(manager,/geOfflineSurface|surface\.innerHTML/,'MUSIC owns the sole UI');
 assert.doesNotMatch(sw,/offline-player\.html/);
});
test('MUSIC owns offline actions and local playback activation survives access expiry',()=>{
 assert.equal(webmanifest.start_url,'./index.html?ge_home=1','New Home Screen apps must open Radio directly');
 assert.match(launcher,/index\.html\?ge_home=1/);
 assert.match(manager,/GE_RADIO_OFFLINE_ACTIVATED_V1/);
 assert.match(manager,/window\.GEOfflineDownloads=\{/,'Exposes one MUSIC downloader API');
 assert.match(manager,/GE Station Identification/,'Station IDs must be saved for true offline Radio');
 assert.match(manager,/stationSaved===stations\.length/,'Ready status requires station clips');
 assert.match(music,/PARTIAL ·/,'MUSIC must clearly report partial downloads');
 assert.match(manager,/missing,/,'Engine returns missing recording paths');
 assert.match(manager,/X-GE-Offline-Download/,'Downloads must bypass service-worker duplicate caching');
 assert.match(sw,/X-GE-Offline-Download/,'Streaming worker must preserve a single cached download');
 assert.match(manager,/attempt<=3/,'Transient mobile download failures need bounded retries');
 assert.match(music,/data-ge-offline="all"/,'MUSIC owns the default one-tap full download');
 assert.match(music,/data-ge-offline="checked"/,'MUSIC has checked songs');
 assert.match(music,/data-ge-offline="playlist"/,'MUSIC has playlists');
 assert.match(music,/data-ge-offline="update"/,'MUSIC has missing song update');
 assert.match(music,/class="geOfflineStart"/,'One download action in MUSIC');
 assert.match(radio,/offlinePlaybackMode\(\)&&window\.GEOffline\?\.isActive\?\.\(\)/);
 assert.match(radio,/SUN_MODE_PUBLIC_CONTROLS/);
 assert.match(radio,/geRadioSunLabPrivateAllowed/);
 assert.match(spectrum,/decodeAudioData/);
 assert.match(spectrum,/getChannelData/);
 assert.match(spectrum,/GEOfflineSpectrum/);
});
test('legacy pinned iPhone launcher restores saved Radio shell in Airplane Mode without a redirect',async()=>{
 const script=launcher.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'Legacy PWA launcher must keep an inline recovery script');
 const html='<!doctype html><html><head><title>Grand Element Radio</title></head><body><div id="shipStage"></div><audio id="player"></audio></body></html>';
 let written='',opens=0,closes=0,deletions=0,network=0;
 const status={textContent:''},open={href:'https://example.test/radio/index.html?ge_home=1'};
 const document={
  getElementById(id){return id==='status'?status:id==='open'?open:null},
  open(){opens++},write(text){written=text},close(){closes++}
 };
 const cache={
  async match(req){
   return req.startsWith('https://example.test/radio/')?{ok:true,text:async()=>html}:undefined
  }
 };
 const caches={
  keys:async()=>['ge-radio-media-v4','ge-radio-shell-2026.11.15-old'],
  open:async(name)=>name.startsWith('ge-radio-shell-')?cache:{match:async()=>undefined},
  match:async()=>undefined,
  delete:async()=>{deletions++;throw Error('Never erase saved songs')}
 };
 const window={matchMedia:()=>({matches:true})};
 const location={href:'https://example.test/radio/offline-home.html',replace(){network++;throw Error('No navigation in Airplane Mode')}};
 vm.runInNewContext(script,{document,window,navigator:{standalone:true},location,caches,URL,console,Promise});
 // The inline recovery is async; let CacheStorage and response.text microtasks drain.
 for(let i=0;i<20&&!written;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(opens,1);
 assert.equal(closes,1);
 assert.equal(written,html,'The previously cached real player must replace the broken launcher');
 assert.equal(network,0,'Opening the saved player must not require another navigation');
 assert.equal(deletions,0,'Recovery must never clear songs, playlists or caches');
});
test('legacy pinned launcher gives a non-destructive recovery message if no shell is stored',async()=>{
 const script=launcher.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 let wrote=false,network=0;
 const status={textContent:''};
 const document={
  getElementById(id){return id==='status'?status:{href:'https://example.test/radio/index.html?ge_home=1'}},
  open(){wrote=true},write(){wrote=true},close(){}
 };
 const caches={keys:async()=>[],match:async()=>undefined};
 const window={matchMedia:()=>({matches:true})};
 const location={href:'https://example.test/radio/offline-home.html',replace(){network++}};
 vm.runInNewContext(script,{document,window,navigator:{standalone:true},location,caches,URL,console,Promise});
 for(let i=0;i<20&&!status.textContent.includes('not found');i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(wrote,false);
 assert.equal(network,0);
 assert.match(status.textContent,/reconnect once online/i);
});

test('OFFLINE membership permits approved Radio recordings without a separate MUSIC code',()=>{
 const start=radio.indexOf('function geOfflineSongAllowance(){');
 const end=radio.indexOf('function geRadioUtilityAllowed(',start);
 assert.ok(start>=0&&end>start);
 const access=JSON.stringify({verifiedFor:'radio',until:Date.now()+120000,scopes:['radio','offline']});
 const sessions={'GE_VAULT_SCOPED_ACCESS_V1':access};
 const authorized=['ge-music/music/Grand Element - Aether/approved.mp3'];
 const privateTrack='ge-music/music/Grand Element - Aether/private.mp3';
 const get=Function('geRadioLocalTestAccess','publicPlayerProfile','sessionStorage','approvedAutoPaths',
  'offlinePlaybackMode','geOfflineDeviceGrantValid','canonicalSongPath','localStorage','GE_OFFLINE_LOCAL_ENTITLEMENT',
  radio.slice(start,end)+'return geOfflineSongAllowance;')(
    ()=>false,{scopes:[]},{getItem:k=>sessions[k]||null},new Set(authorized),
    ()=>false,()=>false,p=>p,{getItem:()=>null},'unused');
 const granted=get();
 assert.ok(granted instanceof Set);
 assert.ok(granted.has(authorized[0]));
 assert.ok(!granted.has(privateTrack),'OFFLINE code must never grant private or non-master files');
 sessions['GE_MUSIC_CODE_SESSION_V1']=JSON.stringify({
    token:'test',until:Date.now()+120000,restricted:true,allowed:[privateTrack]
 });
 const restricted=get();
 assert.deepEqual([...restricted],[privateTrack],
  'An explicit restricted MUSIC grant controls its own allowed catalog');
});
test('airplane-mode worker serves cached navigation and ranged audio with no network',async()=>{
 const handlers=new Map();
 const cacheData=new Map();
 const origin='https://example.test';
 const song=origin+'/ge-music/music/Aether/01_song.mp3';
 const html='<!doctype html><html><head><title>grand element radio</title></head><body><div id="shipStage"></div><audio id="player"></audio></body></html>';
 const workerVersion=/const VERSION='([^']+)'/.exec(sw)?.[1];
 assert.ok(workerVersion);
 const shell='ge-radio-shell-'+workerVersion;
 cacheData.set(shell,new Map([
  [origin+'/radio/index.html',new Response(html,{status:200,headers:{'Content-Type':'text/html'}})],
  [origin+'/radio/',new Response(html,{status:200,headers:{'Content-Type':'text/html'}})],
  [origin+'/radio/offline-home.html',new Response(launcher,{status:200,headers:{'Content-Type':'text/html'}})]
 ]));
 cacheData.set('ge-radio-media-v4',new Map([
  [song,new Response(new Uint8Array([1,2,3,4,5,6,7,8]),{status:200,headers:{'Content-Type':'audio/mpeg'}})]
 ]));
 function keyOf(v){return typeof v==='string'?new URL(v,origin+'/radio/').href:new URL(v.url,origin+'/radio/').href}
 function lookup(map,req,options){const key=keyOf(req);if(map.has(key))return map.get(key).clone();if(options?.ignoreSearch){for(const [k,v] of map){if(new URL(k).pathname===new URL(key).pathname)return v.clone()}}return undefined}
 const caches={
  async keys(){return [...cacheData.keys()]},
  async open(name){if(!cacheData.has(name))cacheData.set(name,new Map());const map=cacheData.get(name);return {
   match:async(req,opts)=>lookup(map,req,opts),
   put:async(req,res)=>map.set(keyOf(req),res.clone()),
   keys:async()=>[...map.keys()].map(url=>new Request(url))
  }},
  async match(req,opts){for(const map of cacheData.values()){const hit=lookup(map,req,opts);if(hit)return hit}return undefined},
  async delete(name){return cacheData.delete(name)}
 };
 let networkCalls=0;
 const self={
  location:{href:origin+'/radio/sw.js',origin},
  navigator:{onLine:false},
  addEventListener(name,callback){handlers.set(name,callback)},
  skipWaiting:async()=>{},
  clients:{claim:async()=>{}}
 };
 vm.runInNewContext(sw,{self,caches,fetch:async()=>{networkCalls++;throw Error('OFFLINE')},URL,Response,Request,Headers,AbortController,setTimeout,clearTimeout,Date,Promise,console});
 const respond=async req=>{
  let pending;handlers.get('fetch')({request:req,respondWith(p){pending=p}});
  assert.ok(pending,'Service worker must intercept request');
  return await pending;
 };
 const page=await respond({method:'GET',mode:'navigate',url:origin+'/radio/',headers:new Headers()});
 assert.equal(page.status,200);assert.match(await page.text(),/id="shipStage"/);
 const entry=await respond({method:'GET',mode:'navigate',url:origin+'/radio/offline-home.html',headers:new Headers()});
 assert.equal(entry.status,200);assert.match(await entry.text(),/id="shipStage"/,'Existing Home Screen icons must launch Radio directly');
 const media=await respond({method:'GET',mode:'cors',destination:'audio',url:song,headers:new Headers({'Range':'bytes=2-5'})});
 assert.equal(media.status,206);assert.equal(media.headers.get('Content-Range'),'bytes 2-5/8');
 assert.deepEqual([...new Uint8Array(await media.arrayBuffer())],[3,4,5,6]);
 // Safari sometimes continues reporting online after Airplane Mode. Both the
 // installed launcher and tagged saved music must still be 100% cache-first.
 self.navigator.onLine=true;
 const tagged=await respond({method:'GET',mode:'cors',destination:'audio',url:song+'?ge_offline=1',headers:new Headers()});
 assert.equal(tagged.status,200);
 const homeAgain=await respond({method:'GET',mode:'navigate',url:origin+'/radio/offline-home.html',headers:new Headers()});
 assert.equal(homeAgain.status,200);
 assert.match(await homeAgain.text(),/id="shipStage"/);
 assert.equal(networkCalls,0,'Installed offline launch and saved music must not retry the network');
});
