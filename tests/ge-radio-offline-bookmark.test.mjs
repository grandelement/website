import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const radio=readFileSync('radio/index.html','utf8');
const sw=readFileSync('radio/sw.js','utf8');
const home=readFileSync('sw.js','utf8');
const must=(source,regex,reason)=>assert.match(source,regex,'OFFLINE REGRESSION: '+reason);
must(radio,/async function ensureOfflineLaunchAssets\(\)/,'offline shell saver missing');
must(radio,/async function finishOfflineSetupWithDialog\(\)/,
  'Finish Offline Setup must show a visible repair/progress dialog');
must(radio,/askIncompleteOfflineChoice\(currentAudit,\{setupOnly:true\}\)/,
  'complete saved music must offer Finish Setup, Start Over and Cancel');
must(radio,/if\(choice==='setup'\)\{\s*await finishOfflineSetupWithDialog\(\)/,
  'Finish Setup tap must run the visible repair routine');
must(radio,/function inspectOfflineLaunchAssets\(\)/,
  'offline repair must report missing files and worker readiness');
must(radio,/onProgress\(\{stage,completed,total,failures:failures\.slice\(\)\}\)/,
  'offline repair must provide progress updates');
must(radio,/showOfflineAccessNotice\(\)/,
  'expired offline access must be explained visibly without deleting files');
must(radio,/#geOfflineDecision button\[hidden\]\{display:none!important\}/,
  'offline dialog loading buttons must actually hide on iPhone');


must(radio,/id="geOfflineDecision"[^>]*role="dialog"/,'offline recovery choice dialog missing');
must(radio,/if\(isEnabled\(\) && !\(currentAudit\?\.missingSongs>0\)\)/,
  'partial Resume action mistakenly enters Offline OFF/Setup path');
must(radio,/choice=await askIncompleteOfflineChoice\(prepared\.audit\)/,
  'Resume, Start Over and Cancel choices missing for incomplete songs');
must(radio,/choice==='restart'[\s\S]*?await remove\(\);[\s\S]*?prepared=await scanExistingAssets\(\)/,
  'confirmed Start Over must clear only saved GE media and rebuild the song plan');
must(radio,/if\(button\.classList\.contains\('downloading'\)\)\{[\s\S]*?abortController\?\.abort\(\)/,
  'Stop Download must abort ongoing downloads without deleting saved songs');
must(radio,/audit=await auditAssets\(assets,\{copyExisting:true\}\)/,
  'download completion must recognize songs already saved in older GE caches');

must(radio,/await ensureOfflineLaunchAssets\(\)/,'songs downloaded without saving application shell');
must(radio,/offlineLaunchReady\?'Offline Ready':'Finish Offline Setup'/,'music-only cache must not claim Ready');
must(radio,/if\(!offlineLaunchReady\)\{[\s\S]*?askIncompleteOfflineChoice\(currentAudit,\{setupOnly:true\}\)[\s\S]*?await finishOfflineSetupWithDialog\(\)/,
  'Finish Offline Setup must open the visible shell repair without deleting saved music');
must(radio,/if\(!offlinePlaybackMode\(\)\)void requestRadioStart/,'cold offline opens must not dial live BLITZ');
must(radio,/if\(offlinePlaybackMode\(\) && geRadioUtilityAllowed\('offline'\)/,'saved offline catalog ignores Vault scope');
must(radio,/GE_OFFLINE_DEVICE_GRANT_KEY/,'saved rights lost on tab close');
must(radio,/device\?\.token&&Number\(device\.expires_at\)/,'offline claim not bound to accepted device grant');
must(radio,/window\.GEOffline\?\.isActive\?\.\(\)/,'downloaded song player does not honor offline mode');
must(radio,/register\?\.\('\.\.\/sw\.js',\{scope:'\/'/,'root bookmark worker registration missing');
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
    URL,Response,Headers,Request,AbortController,console,Date,Promise,
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
