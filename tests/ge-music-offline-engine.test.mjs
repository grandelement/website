import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync('radio/offline-manager.js','utf8');
const sw=readFileSync('radio/sw.js','utf8');
const music=readFileSync('radio/ge-music-v5.js','utf8');
const html=readFileSync('radio/index.html','utf8');
const BASE='https://example.test/radio/index.html';
const songs=[
 'ge-music/music/Grand Element - Aether/Aether_01-Frequency.mp3',
 'ge-music/music/Grand Element - Aether/Aether_04-Prana.mp3',
 'ge-music/music/Grand Element - Aether/Aether_05-Nexus.mp3'
];
const station='ge-music/clips/GE Station Identification - 1.m4a';
const files=[...songs,station];
function makeHarness({safari=false}={}){
 const values=new Map(),maps=new Map(),hits=new Map();
 let failPrana=true,authorized=true,allowed=null,verifyGranted=true;
 const k=value=>new URL(typeof value==='string'?value:value.url,BASE).href;
 const cacheAPI={
  keys:async()=>[...maps.keys()],
  async open(name){
   if(!maps.has(name))maps.set(name,new Map());
   const map=maps.get(name);
   return {
    async match(url,{ignoreSearch=false}={}){
     const key=k(url);
     if(map.has(key))return map.get(key).clone();
     if(ignoreSearch)for(const [u,response] of map)
      if(new URL(u).pathname===new URL(key).pathname)return response.clone();
     return undefined;
    },
    async put(url,response){map.set(k(url),response.clone())},
    keys:async()=>[...map.keys()].map(u=>new Request(u))
   };
  },
  async match(url,opts){
   for(const name of maps.keys()){
    const found=await (await this.open(name)).match(url,opts);
    if(found)return found;
   }
   return undefined;
  }
 };
 const localStorage={
  getItem:key=>values.get(key)||null,
  setItem:(key,value)=>values.set(key,String(value)),
  removeItem:key=>values.delete(key)
 };
 const worker={
  postMessage(data,ports){
   if(data.type==='GE_RADIO_SHELL_STATUS')ports[0].postMessage({
    type:data.type,ready:true,missing:[],version:'2026.11.16-safari-offline-v4'
   });
  }
 };
 const registration={active:worker,waiting:null,installing:null,update:async()=>{}};
 class MessageChannel{
  constructor(){
   this.port1={onmessage:null,postMessage:data=>this.port2.onmessage?.({data}),close(){}};
   this.port2={onmessage:null,postMessage:data=>this.port1.onmessage?.({data}),close(){}};
  }
 }
 async function fetch(url){
  const path=decodeURIComponent(new URL(url,BASE).pathname);
  hits.set(path,(hits.get(path)||0)+1);
  if(path==='/radio/manifest.json')
   return new Response(JSON.stringify({files}),{status:200,headers:{'content-type':'application/json'}});
  if(path.includes('Aether_04-Prana')&&failPrana)throw Error('Test network interruption');
  if(/\.(mp3|m4a)$/i.test(path)){
   const data=new Uint8Array(256);data.set([73,68,51]);
   return new Response(data,{status:200,headers:{'content-type':'audio/mpeg'}});
  }
  throw Error('Unexpected network path: '+path);
 }
 const window={GERadioOfflineBridge:{
   canDownload:()=>authorized,
   allowedPaths:()=>allowed,
   verify:async()=>verifyGranted,
   rescan:()=>{},
   promptCode:()=>{}
  },matchMedia:()=>({matches:!safari})};
 const navigator={
  onLine:true,userAgent:safari?'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile':'Desktop Chrome',platform:safari?'iPhone':'Linux',maxTouchPoints:safari?5:0,
  serviceWorker:{getRegistration:async()=>registration,register:async()=>registration}
 };
 const context={window,navigator,localStorage,caches:cacheAPI,fetch,MessageChannel,
  URL,Response,Request,Headers,AbortController,setTimeout,clearTimeout,console,Date,location:{href:BASE}};
 runInNewContext(source,context);
 return {
  engine:window.GEOfflineDownloads,
  succeedPrana:()=>{failPrana=false},
  revoke:()=>{authorized=false},
  setVerify:value=>{verifyGranted=value},
  setAllowed:paths=>{allowed=paths},
  setOnline:value=>{navigator.onLine=value},
  has:async path=>!!(await cacheAPI.match(new URL('../'+path.split('/').map(encodeURIComponent).join('/'),BASE).href,{ignoreSearch:true})),
  count:path=>hits.get(decodeURIComponent(new URL('../'+path.split('/').map(encodeURIComponent).join('/'),BASE).pathname))||0,
  storage:values,
  primeCatalog:async()=>{
   const shell=await cacheAPI.open('ge-radio-shell-2026.11.16-safari-offline-v4');
   await shell.put(new URL('./manifest.json',BASE).href,
    new Response(JSON.stringify({files}),{status:200,headers:{'content-type':'application/json'}}));
  }
 };
}
test('download retains previous songs; partial failure repairs only missing media',async()=>{
 const h=makeHarness();
 const events=[];
 const first=await h.engine.save({mode:'all',onProgress:e=>events.push(e)});
 assert.equal(first.ready,false);
 assert.equal(first.saved,2);
 assert.equal(first.total,3);
 assert.equal(first.missing.length,1);
 assert.equal(h.engine.active(),true);
 assert.equal(await h.has(station),true);
 assert.equal(await h.has(songs[0]),true);
 assert.equal(await h.has(songs[2]),true);
 const n1=h.count(songs[0]),n3=h.count(songs[2]);
 h.succeedPrana();
 const fixed=await h.engine.repair();
 assert.equal(fixed.ready,true);
 assert.equal(fixed.saved,3);
 assert.equal(fixed.missing.length,0);
 assert.equal(h.count(songs[0]),n1);
 assert.equal(h.count(songs[2]),n3);
 assert.equal(await h.has(songs[1]),true);
 assert.equal(h.engine.plan().length,3);
 assert.ok(events.some(e=>e.phase==='audio'&&Number.isInteger(e.percent)));
 assert.ok(events.every(e=>!('current' in e)&&!('total' in e)&&!('completed' in e)));
});
test('revoked access blocks new downloads but retains existing saved music',async()=>{
 const h=makeHarness();
 h.succeedPrana();
 await h.engine.save({mode:'checked',paths:[songs[0]]});
 assert.equal(h.engine.active(),true);
 h.revoke();
 const denied=await h.engine.save({mode:'all'});
 assert.equal(denied.error,'access');
 assert.equal(await h.has(songs[0]),true);
 assert.equal(h.engine.active(),true);
});
test('a new playlist never deletes older downloaded music or selections',async()=>{
 const h=makeHarness();
 h.succeedPrana();
 await h.engine.save({mode:'checked',paths:[songs[0]]});
 const next=await h.engine.save({mode:'playlist',paths:[songs[2]]});
 assert.equal(next.ready,true);
 assert.equal(next.saved,2);
 assert.equal(next.total,2);
 assert.equal(await h.has(songs[0]),true);
 assert.equal(await h.has(songs[2]),true);
 assert.deepEqual([...h.engine.plan()], [songs[0],songs[2]]);
});
test('restricted codes cannot fetch unassigned songs or remove prior files',async()=>{
 const h=makeHarness();
 h.succeedPrana();
 h.setAllowed([songs[0]]);
 await h.engine.save({mode:'all'});
 assert.equal(await h.has(songs[0]),true);
 assert.equal(await h.has(songs[1]),false);
 h.setAllowed([songs[2]]);
 const result=await h.engine.save({mode:'playlist',paths:[songs[2]]});
 assert.equal(await h.has(songs[0]),true);
 assert.equal(await h.has(songs[2]),true);
 assert.equal(result.ready,true);
});
test('new downloads require connectivity; cached downloads are never erased',async()=>{
 const h=makeHarness();
 h.succeedPrana();
 await h.engine.save({mode:'checked',paths:[songs[0]]});
 await h.primeCatalog();
 h.setOnline(false);
 assert.equal((await h.engine.inspect()).ready,true);
 assert.equal((await h.engine.save({mode:'all'})).error,'offline');
 assert.equal(await h.has(songs[0]),true);
});
test('iPhone Safari can download from its own browser tab and play offline',async()=>{
 const h=makeHarness({safari:true});
 h.succeedPrana();
 assert.equal(h.engine.installed(),false,'Safari tab is not a Home Screen application');
 const saved=await h.engine.save({mode:'checked',paths:[songs[0]]});
 assert.equal(saved.error,undefined,'Safari is not blocked by installation status');
 assert.equal(saved.ready,true,'Verified Safari download is ready');
 assert.equal(await h.has(songs[0]),true);
 await h.primeCatalog();h.setOnline(false);
 assert.equal((await h.engine.inspect()).ready,true,'Safari cached recording remains ready while offline');
});
test('unverified OFFLINE code never starts a download or changes saved selection',async()=>{
 const h=makeHarness({safari:true});
 h.succeedPrana();h.setVerify(false);
 const denied=await h.engine.save({mode:'checked',paths:[songs[0]]});
 assert.equal(denied.error,'access');
 assert.equal(await h.has(songs[0]),false);
 assert.deepEqual([...h.engine.plan()],[]);
 h.setVerify(true);
 const accepted=await h.engine.save({mode:'checked',paths:[songs[0]]});
 assert.equal(accepted.ready,true,'server-authorized code allows Safari download');
});
test('MUSIC OFFLINE shows only percent, ETA, progress bar, not counts or filenames',()=>{
 const start=music.indexOf('async function offlineCheck(){');
 const end=music.indexOf("el('.musicOfflineLaunch').addEventListener('click',openOffline)",start);
 const ui=music.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.ok(music.includes('class="geOfflinePercent"'));
 assert.ok(music.includes('class="geOfflineEta"'));
 assert.ok(music.includes('class="geOfflineProgress"'));
 assert.doesNotMatch(ui,/result\.saved\s*\+|result\.total|result\.missing\.length|event\.current|event\.total|event\.completed/);
 assert.match(ui,/READY/);
 assert.match(ui,/PARTIAL/);
 assert.match(ui,/UPDATE MISSING/);
 assert.match(music,/document\.getElementById\('offlineLaunchBtn'\)\?\.addEventListener\('click',openOffline\)/);
});
test('one service worker caches essential art, startup code and catalog; not all backgrounds',()=>{
 assert.match(sw,/GE_RADIO_SHELL_STATUS/);
 assert.match(sw,/ge-radio-media-v4/);
 assert.match(sw,/ge-music-v5\.js/);
 assert.match(sw,/offline-spectrum\.js/);
 assert.match(sw,/iam-private-studio\.js/);
 assert.match(sw,/playlists\/registry\.json/);
 assert.match(sw,/ge-images\/img\/31\.gif/);
 assert.match(sw,/const ARTWORK=/);
 assert.doesNotMatch(sw,/backgrounds\.map|ge-radio-backgrounds-v1/);
 assert.match(html,/\.\/offline-manager\.js\?v=20261116-safari-offline-v4/);
 assert.match(html,/\.\/ge-music-v5\.js\?v=20261116-safari-offline-v4/);
 assert.match(html,/sw\.js\?v=20261116-safari-offline-v4/);
 assert.match(sw,/const VERSION='2026\.11\.16-safari-offline-v4'/);
 assert.match(source,/const VERSION='2026\.11\.16-safari-offline-v4'/);
});
