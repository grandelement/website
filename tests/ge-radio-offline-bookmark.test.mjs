import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const radio=readFileSync('radio/index.html','utf8');
const sw=readFileSync('radio/sw.js','utf8');
const home=readFileSync('sw.js','utf8');
const must=(source,regex,reason)=>assert.match(source,regex,'OFFLINE REGRESSION: '+reason);
must(radio,/async function ensureOfflineLaunchAssets\(\)/,'offline shell saver missing');
must(radio,/await ensureOfflineLaunchAssets\(\)/,'songs downloaded without saving application shell');
must(radio,/offlineLaunchReady\?'Offline Ready':'Finish Offline Setup'/,'music-only cache must not claim Ready');
must(radio,/if\(!offlinePlaybackMode\(\)\)void requestRadioStart/,'cold offline opens must not dial live BLITZ');
must(radio,/if\(offlinePlaybackMode\(\) && geRadioUtilityAllowed\('offline'\)/,'saved offline catalog ignores Vault scope');
must(radio,/GE_OFFLINE_DEVICE_GRANT_KEY/,'saved rights lost on tab close');
must(radio,/device\?\.token&&Number\(device\.expires_at\)/,'offline claim not bound to accepted device grant');
must(radio,/window\.GEOffline\?\.isActive\?\.\(\)/,'downloaded song player does not honor offline mode');
must(radio,/register\('\.\.\/sw\.js',\{scope:'\/'/,'root bookmark worker registration missing');
must(home,/pathname==='\/radio'/,'bare /radio bookmark fallback missing');

const validHTML='<!doctype html><html><head><title>Grand Element Radio</title></head><body id="shipStage"><audio id="player"></audio></body></html>';
const radioResponse=()=>new Response(validHTML,{status:200,headers:{'Content-Type':'text/html'}});
async function checkWorker(script,workerURL,scope,bookmark,expectedStatus){
  const handlers={};
  const saved=new Map([['https://grandelement.com/radio/index.html',radioResponse()]]);
  function normalized(request,base){
    const raw=typeof request==='string'?request:request?.url||String(request);
    return new URL(raw,base).href.split('?')[0];
  }
  const cache={
    match:async req=>saved.get(normalized(req,scope))?.clone()||null,
    put:async (req,res)=>saved.set(normalized(req,scope),res.clone()),
    keys:async()=>[]
  };
  const sandbox={
    self:{
      location:new URL(workerURL),
      registration:{scope},
      addEventListener:(name,handler)=>{handlers[name]=handler}
    },
    caches:{
      open:async()=>cache,
      match:async req=>saved.get(normalized(req,scope))?.clone()||null,
      keys:async()=>[]
    },
    URL,Response,Headers,Request,console,Date,Promise,
    setTimeout:()=>1,clearTimeout:()=>{},
    fetch:async()=>{throw new TypeError('offline')}
  };
  vm.runInNewContext(script,sandbox,{timeout:1000});
  assert.equal(typeof handlers.fetch,'function','worker did not register fetch');
  let output=null;
  const request={url:bookmark,method:'GET',mode:'navigate',headers:new Headers()};
  handlers.fetch({request,respondWith:p=>{output=Promise.resolve(p)}});
  assert.ok(output,'worker did not respond to offline bookmark '+bookmark);
  const response=await output;
  assert.equal(response.status,expectedStatus,'offline bookmark status '+bookmark);
  if(expectedStatus===302){
    assert.equal(response.headers.get('location'),'https://grandelement.com/radio/',
      'offline URL must redirect locally for correct relative asset URLs');
  }else assert.match(await response.text(),/Grand Element Radio/);
}
await checkWorker(sw,'https://grandelement.com/radio/sw.js',
  'https://grandelement.com/radio/','https://grandelement.com/radio/',200);
await checkWorker(home,'https://grandelement.com/sw.js',
  'https://grandelement.com/','https://grandelement.com/radio',302);
await checkWorker(home,'https://grandelement.com/sw.js',
  'https://grandelement.com/','https://grandelement.com/radio/',200);
console.log('PASS GE Radio offline bookmark: /radio, /radio/, protected downloaded shell and saved rights');
