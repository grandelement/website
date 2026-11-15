import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync('radio/offline-manager.js','utf8');
const BASE='https://example.test/radio/index.html';
const songs=[
 'ge-music/music/Grand Element - Aether/Aether_01-Frequency.mp3',
 'ge-music/music/Grand Element - Aether/Aether_04-Prana.mp3',
 'ge-music/music/Grand Element - Aether/Aether_05-Nexus.mp3'
];
const station='ge-music/clips/GE Station Identification - 1.m4a';
const files=[...songs,station];
function makeHarness(){
 const storage=new Map(),cachesMap=new Map(),requests=new Map();
 let failPrana=true,authorized=true;
 const k=url=>new URL(typeof url==='string'?url:url.url||String(url),BASE).href;
 const cacheAPI={
  keys:async()=>[...cachesMap.keys()],
  async open(name){
   if(!cachesMap.has(name))cachesMap.set(name,new Map());
   const map=cachesMap.get(name);
   return {
    async match(url,{ignoreSearch=false}={}){
     const key=k(url);if(map.has(key))return map.get(key).clone();
     if(ignoreSearch){const path=new URL(key).pathname;for(const [u,v] of map)if(new URL(u).pathname===path)return v.clone()}
     return undefined;
    },
    put:async(url,response)=>{map.set(k(url),response.clone())},
    keys:async()=>[...map.keys()].map(url=>new Request(url))
   };
  },
  async match(url,opts){
   for(const name of cachesMap.keys()){
    const match=await (await this.open(name)).match(url,opts);
    if(match)return match;
   }
   return undefined;
  }
 };
 const localStorage={
  getItem:k=>storage.get(k)||null,
  setItem:(k,v)=>storage.set(k,String(v)),
  removeItem:k=>storage.delete(k)
 };
 const worker={
  postMessage(data,ports){
   if(data.type==='GE_RADIO_SHELL_STATUS'){
    ports[0].postMessage({
      type:data.type,ready:true,missing:[],
      version:'2026.11.15-offline-music-v118'
    });
   }
  }
 };
 const registration={active:worker,waiting:null,installing:null,update:async()=>{}};
 class MessageChannel{
  constructor(){
   this.port1={onmessage:null,postMessage:data=>this.port2.onmessage?.({data}),close(){}};
   this.port2={onmessage:null,postMessage:data=>this.port1.onmessage?.({data}),close(){}};
  }
 }
 async function fetch(url,options={}){
  const path=decodeURIComponent(new URL(url,BASE).pathname);
  requests.set(path,(requests.get(path)||0)+1);
  if(path==='/radio/manifest.json')
   return new Response(JSON.stringify({files}),{status:200,headers:{'Content-Type':'application/json'}});
  if(path==='/ge-images/img/manifest.json')
   return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
  if(path.startsWith('/ge-images/images/'))
   return new Response(new Uint8Array(260),{status:200,headers:{'Content-Type':'image/jpeg'}});
  if(path.includes('Aether_04-Prana')&&failPrana)throw Error('Load failed');
  if(path.endsWith('.mp3')||path.endsWith('.m4a')){
   const bytes=new Uint8Array(256);bytes.set([73,68,51]);
   return new Response(bytes,{status:200,headers:{'Content-Type':'audio/mpeg'}});
  }
  throw Error('unexpected network path '+path);
 }
 const window={
  GERadioOfflineBridge:{
   canDownload:()=>authorized,allowedPaths:()=>null,rescan:()=>{},
   promptCode:()=>{}
  },
  matchMedia:()=>({matches:true})
 };
 const navigator={
  onLine:true,userAgent:'Desktop Chrome',platform:'Linux',maxTouchPoints:0,
  serviceWorker:{getRegistration:async()=>registration,register:async()=>registration}
 };
 const context={window,navigator,localStorage,caches:cacheAPI,fetch,MessageChannel,
  URL,Response,Request,Headers,AbortController,setTimeout,clearTimeout,console,Date,
  location:{href:BASE}};
 runInNewContext(source,context);
 return {
  engine:window.GEOfflineDownloads,storage,requests,
  succeedPrana:()=>{failPrana=false},
  revoke:()=>{authorized=false},
  has:async path=>{
   const url=new URL('../'+path.split('/').map(encodeURIComponent).join('/'),BASE);
   return !!(await cacheAPI.match(url.href,{ignoreSearch:true}));
  },
  count:path=>requests.get(decodeURIComponent(new URL('../'+path.split('/').map(encodeURIComponent).join('/'),BASE).pathname))||0
 };
}

test('all music saves once, reports partial on failed Prana, repairs only missing files',async()=>{
 const h=makeHarness();
 const first=await h.engine.save({mode:'all'});
 assert.equal(first.ready,false);
 assert.equal(first.saved,2);
 assert.equal(first.total,3);
 assert.equal(first.missing.length,1);
 assert.match(first.missing[0],/Prana/);
 assert.equal(h.engine.active(),true,'Partial authorized saved files stay playable');
 assert.equal(await h.has(songs[0]),true);
 assert.equal(await h.has(songs[2]),true);
 assert.equal(await h.has(station),true);
 const oldFirstCount=h.count(songs[0]),oldNexusCount=h.count(songs[2]);
 h.succeedPrana();
 const second=await h.engine.repair();
 assert.equal(second.ready,true);
 assert.equal(second.saved,3);
 assert.equal(second.total,3);
 assert.equal(second.missing.length,0);
 assert.equal(h.count(songs[0]),oldFirstCount,'Update skips existing saved audio');
 assert.equal(h.count(songs[2]),oldNexusCount,'Update skips other saved audio');
 assert.equal(await h.has(songs[1]),true);
 assert.equal(h.engine.plan().length,3);
});

test('offline access check controls new downloads, not existing local playback',async()=>{
 const h=makeHarness();
 await h.engine.save({mode:'checked',paths:[songs[0]]});
 assert.equal(h.engine.active(),true);
 h.revoke();
 const denied=await h.engine.save({mode:'all'});
 assert.equal(denied.error,'access');
 assert.equal(await h.has(songs[0]),true);
 assert.equal(h.engine.active(),true);
});

test('saving new checked selection never deletes an earlier downloaded selection',async()=>{
 const h=makeHarness();
 const one=await h.engine.save({mode:'checked',paths:[songs[0]]});
 assert.equal(one.total,1);
 const two=await h.engine.save({mode:'playlist',paths:[songs[2]]});
 assert.equal(two.saved,2);
 assert.equal(two.total,2);
 assert.equal(await h.has(songs[0]),true);
 assert.equal(await h.has(songs[2]),true);
 assert.deepEqual([...h.engine.plan()], [songs[0],songs[2]]);
});
