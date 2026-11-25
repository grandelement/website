import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const music=readFileSync(new URL('../radio/ge-music-v5.js',import.meta.url),'utf8');
const offline=readFileSync(new URL('../radio/offline-manager.js',import.meta.url),'utf8');
const songs=[
 'ge-music/music/Grand Element - 2026 - Aether/Aether_03-Free Energy.mp3',
 'ge-music/music/Grand Element - 2026 - Aether/Aether_04-Prana.mp3',
 'ge-music/music/Grand Element - 2026 - Aether/Aether_05-Nexus.mp3'
];
const station='ge-music/clips/GE Station Identification - 0.m4a';
const planKey='GE_RADIO_OFFLINE_PLAN_V1';

test('SONGS is a permanent all-songs button; code does not check every assigned track',()=>{
 assert.match(music,/el\('\.albumDetailSongs'\)\.textContent='SONGS'/);
 assert.match(music,/el\('\.albumDetailSongs'\)\.addEventListener\('click',\(\)=>setView\('browse-songs'\)\)/);
 assert.doesNotMatch(music,/state\.selected=new Set\(allowed\)/);
 assert.doesNotMatch(music,/state\.selected=new Set\(access\.allowed\)/);
 assert.match(music,/checkbox\.dispatchEvent\(new Event\('change'/);
 assert.match(music,/\.song:not\(\.selectedSong\) \.songInfo input\[type=checkbox\]/);
});

function makeRuntime({previous=[]}={}){
 const store=new Map();
 if(previous.length)store.set(planKey,JSON.stringify({type:'music',mode:'all',paths:previous}));
 const savedFiles=new Map(),audioRequests=[];
 const cache={
  async match(url){return savedFiles.get(String(url))||null;},
  async put(url,response){savedFiles.set(String(url),response);}
 };
 const caches={
  async keys(){return ['ge-radio-media-v4'];},
  async open(){return cache;},
  async match(){return null;}
 };
 const localStorage={
  getItem(key){return store.has(key)?store.get(key):null;},
  setItem(key,val){store.set(key,String(val));},
  removeItem(key){store.delete(key);}
 };
 class MessageChannel {
  constructor(){
   this.port1={onmessage:null,close(){}};
   const first=this.port1;
   this.port2={send(data){queueMicrotask(()=>first.onmessage?.({data}));}};
  }
 }
 const activeWorker={postMessage(message,[port]){
  port.send({type:'GE_RADIO_SHELL_STATUS',version:'test',ready:true,missing:[]});
 }};
 const registration={active:activeWorker,async update(){}};
 const navigator={
  onLine:true,userAgent:'TestBrowser',platform:'test',
  serviceWorker:{async getRegistration(){return registration;}}
 };
 const window={
  matchMedia(){return {matches:false};},addEventListener(){},dispatchEvent(){},
  GERadioOfflineBridge:{
   canDownload:()=>true,allowedPaths:()=>null,verify:async()=>true,rescan:async()=>{}
  }
 };
 const fetch=async url=>{
  const target=String(url);
  if(target.endsWith('/manifest.json'))
   return new Response(JSON.stringify({files:[...songs,station]}),{
    status:200,headers:{'Content-Type':'application/json'}});
  const path=decodeURIComponent(new URL(target).pathname).replace(/^\//,'');
  audioRequests.push(path);
  return new Response(new Uint8Array(512),{
   status:200,headers:{'Content-Type':'audio/mpeg'}});
 };
 const context={
  window,document:{readyState:'loading',addEventListener(){}},
  navigator,localStorage,caches,fetch,MessageChannel,
  Response,Headers,URL,AbortController,Date,Promise,Set,JSON,Number,
  String,Array,Math,console,setTimeout,clearTimeout,
  location:{href:'https://grandelement.com/radio/'}
 };
 runInNewContext(offline,context,{filename:'offline-manager.js',timeout:5000});
 return {engine:window.GEOfflineDownloads,store,audioRequests};
}

test('CHECKED SONGS downloads only one chosen track, not the previous library plan',async()=>{
 const {engine,store,audioRequests}=makeRuntime({previous:songs});
 const result=await engine.save({mode:'checked',paths:[songs[1]]});
 assert.equal(result.error,undefined,result.message||'save failed');
 assert.deepEqual(audioRequests,[songs[1]]);
 assert.deepEqual(Array.from(engine.plan()),[songs[1]]);
 assert.equal(JSON.parse(store.get(planKey)).mode,'checked');
 const ready=await engine.inspect();
 assert.equal(ready.ready,true,'one checked song must not require all Radio station clips');
});

test('stale prior ALL MUSIC requests never restart without a fresh click',async()=>{
 const {engine,store,audioRequests}=makeRuntime();
 store.set('GE_RADIO_OFFLINE_PENDING_V2',JSON.stringify({mode:'all',paths:[],tries:1}));
 assert.equal(await engine.resume(),false);
 assert.deepEqual(audioRequests,[]);
});

test('ALL MUSIC remains an explicit operation, while CHECKED SONGS is exact',async()=>{
 const {engine,audioRequests}=makeRuntime();
 const result=await engine.save({mode:'all'});
 assert.equal(result.error,undefined,result.message||'save failed');
 assert.deepEqual(audioRequests,[...songs,station]);
});

test('UPDATE MISSING with no prior plan does not silently download the entire catalog',async()=>{
 const {engine,audioRequests}=makeRuntime();
 const result=await engine.save({mode:'update'});
 assert.equal(result.error,'selection');
 assert.deepEqual(audioRequests,[]);
});
