import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const sw=readFileSync('radio/sw.js','utf8');
const radio=readFileSync('radio/index.html','utf8');
const player=readFileSync('radio/offline-player.html','utf8');

test('offline worker keeps media cache and requires essential app files',()=>{
 assert.match(sw,/const MEDIA_CACHE='ge-radio-media-v4'/);
 assert.match(sw,/const REQUIRED_SHELL=\[/);
 assert.match(sw,/Promise\.all\(REQUIRED_SHELL\.map/);
 assert.match(sw,/await self\.skipWaiting\(\)/);
 assert.ok(sw.indexOf('await Promise.all(REQUIRED_SHELL.map')<sw.indexOf('await self.skipWaiting()'));
 assert.match(sw,/offlineNavigationFallback/);
});
test('radio cold start checks stored identity with no Vault request',()=>{
 assert.match(radio,/window\.GEVault\?\.anonId\|\|localStorage\.getItem\('ge_vault_anon_id'\)/);
 assert.match(radio,/discoverOfflineMediaFromCaches\(\)/);
 assert.match(radio,/Number\(receipt\?\.until\|\|grant\?\.until\|\|0\)/);
 assert.match(radio,/geRadioUtilityAllowed\('offline'\)/);
});
test('offline player registers independently and enforces expiry and song scope',()=>{
 assert.match(player,/navigator\.serviceWorker\.register\('\.\/sw\.js/);
 assert.match(player,/Number\(receipt\.until\)>now/);
 assert.match(player,/Number\(grant\.until\)>now/);
 assert.match(player,/\.filter\(url=>!allowed\|\|allowed\.has\(normalizedPath\(url\)\)\)/);
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
  [origin+'/radio/',new Response(html,{status:200,headers:{'Content-Type':'text/html'}})]
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
 const media=await respond({method:'GET',mode:'cors',destination:'audio',url:song,headers:new Headers({'Range':'bytes=2-5'})});
 assert.equal(media.status,206);assert.equal(media.headers.get('Content-Range'),'bytes 2-5/8');
 assert.deepEqual([...new Uint8Array(await media.arrayBuffer())],[3,4,5,6]);
 assert.equal(networkCalls,0,'No network requests allowed in Airplane Mode');
});
