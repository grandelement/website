/* Grand Element Radio · Unified OFFLINE engine.
   MUSIC owns the only interface; Radio's OFFLINE button opens MUSIC.
   The service worker owns the startup shell. This engine owns authorized media downloads.
   Existing Cache Storage media, catalog, playlist, entitlement and selection keys are never cleared. */
(()=>{
'use strict';
const VERSION='2026.11.26-offline-manager-v12-deep-removal';
const AUDIO='ge-radio-media-v4';
const PLAN='GE_RADIO_OFFLINE_PLAN_V1';
const ACTIVATED='GE_RADIO_OFFLINE_ACTIVATED_V1';
const PENDING='GE_RADIO_OFFLINE_PENDING_V2';
const STATUS='GE_RADIO_OFFLINE_STATUS_V2';
const SONG=/^ge-music\/music\/.+\.(?:mp3|wav|m4a|ogg)$/i;
const STATION=/^ge-music\/clips\/GE Station Identification - \d+\.(?:mp3|wav|m4a|ogg)$/i;
const safe=(value,pattern)=>typeof value==='string'&&value.length<1024&&
  !value.split('/').some(x=>x==='.'||x==='..'||!x)&&pattern.test(value);
const unique=a=>[...new Set((Array.isArray(a)?a:[]).filter(x=>typeof x==='string'))];
const bridge=()=>window.GERadioOfflineBridge||{};
const active=()=>{try{return localStorage.getItem(ACTIVATED)==='yes'}catch(_){return false}};
const installed=()=>!!(window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true);
const ios=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||
  (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const canDownload=()=>navigator.onLine!==false&&bridge().canDownload?.()===true;
const address=path=>new URL('../'+path.split('/').map(encodeURIComponent).join('/'),location.href).href;
let lastStatus={state:'missing',percent:0,etaSeconds:null,message:''};
try{
 const saved=JSON.parse(localStorage.getItem(STATUS)||'null');
 if(saved&&['ready','partial','downloading','missing'].includes(saved.state)){
  lastStatus={state:saved.state==='downloading'?'partial':saved.state,
   percent:Math.max(0,Math.min(100,Number(saved.percent)||0)),
   etaSeconds:null,message:''};
 }
}catch(_){}
function report(fn,event){
 try{fn?.(event)}catch(error){console.warn('Offline progress callback failed',error)}
 if(!event||!['preparing','audio','verifying','finished','error','status','stopped'].includes(event.phase))return;
 const state=event.phase==='audio'||event.phase==='preparing'||event.phase==='verifying'?'downloading':
  event.phase==='finished'||event.phase==='status'?(event.ready?'ready':event.partial?'partial':'missing'):
  event.phase==='error'||event.phase==='stopped'?'partial':lastStatus.state;
 const percent=Number.isFinite(event.percent)?Math.max(0,Math.min(100,Math.round(event.percent))):
  (state==='ready'?100:lastStatus.percent);
 lastStatus={state,percent,etaSeconds:event.etaSeconds??null,
  message:String(event.message||'').slice(0,150)};
 try{localStorage.setItem(STATUS,JSON.stringify({...lastStatus,updatedAt:Date.now()}))}catch(_){}
 try{window.dispatchEvent?.(new CustomEvent('ge-radio-offline-status',{detail:lastStatus}))}catch(_){}
}
let busy=false,stopped=false,currentAbort=null;
function pending(){
 try{const v=JSON.parse(localStorage.getItem(PENDING)||'null');
  return v&&['all','checked','playlist','update'].includes(v.mode)&&
   Array.isArray(v.paths)?v:null;
 }catch(_){return null}
}
function savePending(value){try{localStorage.setItem(PENDING,JSON.stringify(value))}catch(_){}}
function clearPending(){try{localStorage.removeItem(PENDING)}catch(_){}}

function plan(){
 try{return unique(JSON.parse(localStorage.getItem(PLAN)||'null')?.paths).filter(x=>safe(x,SONG))}catch(_){return []}
}
function planMode(){
 try{const mode=JSON.parse(localStorage.getItem(PLAN)||'null')?.mode;
  return ['all','checked','playlist'].includes(mode)?mode:'all';
 }catch(_){return 'all'}
}
function setPlan(paths,mode='all'){
 try{localStorage.setItem(PLAN,JSON.stringify({type:'music',mode,paths:unique(paths).filter(x=>safe(x,SONG)),at:Date.now()}))}catch(_){}
}
function audioResponse(response){
 return !!response?.ok&&response.status===200&&
  !/text\/html|application\/json|text\/plain|image\/|video\//i.test(response.headers.get('content-type')||'');
}
async function validAudio(cache,url){
 const r=await cache.match(url,{ignoreSearch:true});
 if(!audioResponse(r))return false;
 const length=Number(r.headers.get('content-length'));
 if(Number.isFinite(length)&&length>128)return true;
 try{return (await r.blob()).size>128}catch(_){return false}
}
async function alreadySaved(url){
 // All old audio caches remain valid after the rebuild. Do not duplicate blobs.
 for(const name of await caches.keys()){
  const cache=await caches.open(name);
  if(await validAudio(cache,url))return true;
 }
 return false;
}
async function catalog(){
 const url=new URL('./manifest.json',location.href).href;
 let response;
 if(navigator.onLine!==false){
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);
  try{response=await fetch(url,{cache:'no-store',signal:abort.signal})}catch(_){}
  finally{clearTimeout(timeout)}
 }
 if(!response?.ok)response=await caches.match(url,{ignoreSearch:true});
 if(!response?.ok)throw Error('Offline library catalog is unavailable. Connect online once.');
 let manifest;
 try{manifest=await response.json()}catch(_){throw Error('Music catalog is invalid. Reconnect and repair.')}
 const files=unique(manifest?.files);
 return {songs:files.filter(p=>safe(p,SONG)),stations:files.filter(p=>safe(p,STATION))};
}
function authorized(paths){
 const given=bridge().allowedPaths?.();
 if(given===null)return paths;
 if(!Array.isArray(given))return [];
 const permitted=new Set(given);
 return paths.filter(x=>permitted.has(x));
}
async function shell({refresh=false}={}){
 if(!navigator.serviceWorker)return {ready:false,missing:['Offline startup not supported']};
 try{
  let reg=await navigator.serviceWorker.getRegistration('./');
  if(!reg&&navigator.onLine!==false)reg=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  if(!reg)return {ready:false,missing:['Offline startup not installed']};
  if(refresh&&navigator.onLine!==false)await reg.update().catch(()=>{});
  if(reg.installing){
   const worker=reg.installing;
   await Promise.race([new Promise(done=>{
    const changed=()=>{if(['installed','activated','redundant'].includes(worker.state)){
     worker.removeEventListener('statechange',changed);done();
    }};
    worker.addEventListener('statechange',changed);changed();
   }),new Promise(done=>setTimeout(done,16000))]);
  }
  reg=await navigator.serviceWorker.getRegistration('./')||reg;
  // Check the active Radio worker first, not an update still waiting to activate.
  const worker=reg.active||navigator.serviceWorker.controller||reg.waiting;
  if(!worker)return {ready:false,missing:['Offline startup inactive']};
  const status=await new Promise(done=>{
   const chan=new MessageChannel();
   let finished=false;
   const settle=value=>{if(finished)return;finished=true;clearTimeout(timer);chan.port1.close?.();done(value)};
   const timer=setTimeout(()=>settle({ready:false,missing:['Offline startup check timed out']}),6500);
   chan.port1.onmessage=e=>settle(e.data);
   try{worker.postMessage({type:'GE_RADIO_SHELL_STATUS'},[chan.port2])}
   catch(_){settle({ready:false,missing:['Offline startup check failed']})}
  });
  // Manager and service worker have independent release versions. The worker
  // verifies its own cached shell; matching their version strings is incorrect.
  if(status?.type!=='GE_RADIO_SHELL_STATUS'||typeof status.version!=='string'||!status.version)
   return {ready:false,missing:['Offline startup response invalid']};
  return {ready:status?.ready===true,missing:status?.missing||[]};
 }catch(_){return {ready:false,missing:['Offline startup check failed']}}
}
async function inspect({onProgress}={}){
 const engine=await shell();
 const savedPlan=plan(),missing=[];
 let saved=0;
 for(let i=0;i<savedPlan.length;i++){
  if(await alreadySaved(address(savedPlan[i])))saved++;
  else missing.push(savedPlan[i]);
  if(i%8===0)report(onProgress,{phase:'checking',percent:savedPlan.length?Math.floor((i+1)/savedPlan.length*100):0});
 }
 let stations=[],stationSaved=0;
 try{stations=(await catalog()).stations;
  for(const path of stations)if(await alreadySaved(address(path)))stationSaved++;
 }catch(_){}
 const requireStations=planMode()==='all';
 const all=savedPlan.length>0&&saved===savedPlan.length&&
  (!requireStations||(stations.length>0&&stationSaved===stations.length));
 // Safari and installed Home Screen Radio each own their own Cache Storage.
 // Downloading and playback are allowed in either; never refuse Safari by platform.
 const ready=all&&engine.ready&&active();
 const result={ready,partial:!ready&&(saved>0||stationSaved>0),
  engine:engine.ready,engineMissing:engine.missing,
  saved,total:savedPlan.length,missing,stations:stationSaved,stationTotal:stations.length,
  installed:installed(),percent:ready?100:(savedPlan.length?Math.floor(saved/savedPlan.length*95):0)};
 if(!busy)report(onProgress,{phase:'status',ready,partial:result.partial,percent:result.percent});
 return result;
}
function stop(){
 stopped=true;
 clearPending();
 report(null,{phase:'stopped',message:'Stopped. Previously saved recordings remain available.'});
 try{currentAbort?.abort()}catch(_){}
}
async function downloadAudio(path,cache,{force=false}={}){
 const url=address(path);
 if(!force&&await alreadySaved(url))return;
 let last;
 for(let attempt=0;attempt<3&&!stopped;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
  currentAbort=controller;
  try{
   const response=await fetch(url,{cache:'no-store',signal:controller.signal,
    headers:{'X-GE-Offline-Download':'1'}});
   if(!audioResponse(response))throw Error('Music download returned HTTP '+response.status+' ('+(response.headers.get('content-type')||'unknown type')+')');
   const blob=await response.blob();
   if(blob.size<=128)throw Error('Music file is incomplete');
   const headers=new Headers(response.headers);
   headers.set('Content-Length',String(blob.size));
   await cache.put(url,new Response(blob,{status:200,headers}));
   if(!(await validAudio(cache,url)))throw Error('Downloaded file could not be verified');
   return;
  }catch(error){
   last=error;
   if(stopped||/quota|storage|space|disk/i.test(String(error?.message||error)))break;
   if(attempt<2)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
  }finally{clearTimeout(timer);currentAbort=null}
 }
 throw last||Error('Download interrupted');
}
async function save({mode='all',paths=[],onProgress}={}){
 if(busy)return {error:'busy',message:'Download already running'};
 if(!['all','checked','playlist','update'].includes(mode))
  return {error:'selection',message:'Choose a valid download option.'};
 if(navigator.onLine===false)return {error:'offline',message:'Connect online to download new music'};
 if(!canDownload())return {error:'access',message:'Enter your OFFLINE access code before downloading. Saved music stays available.'};
 // Best-effort browser persistence, requested only during an explicit download.
 // A denied request must not interrupt downloads or imply storage is guaranteed.
 if(mode!=='update'){try{void navigator.storage?.persist?.()?.catch(()=>{});}catch(_){}}
 busy=true;stopped=false;
 let failures=[],completed=0;
 const start=Date.now();
 try{
  report(onProgress,{phase:'preparing',percent:0,etaSeconds:null});
  const engine=await shell({refresh:true});
  if(!engine.ready)return {error:'engine',
   message:'Radio startup did not verify: '+String(engine.missing?.[0]||'Unknown file')+
    '. Reconnect, reopen Radio, and retry. Existing music is safe.'};
  const list=await catalog();
  if(!list.stations.length)return {error:'catalog',message:'Station identification files are missing from the catalog.'};
  const allowed=authorized(list.songs),allow=new Set(allowed),previous=plan();
  if(!allowed.length)return {error:'access',message:'Your access code does not include published songs.'};
  const chosen=mode==='all'?allowed:
   mode==='update'?previous.filter(p=>allow.has(p)):
   unique(paths).filter(p=>safe(p,SONG)&&allow.has(p));
  if(mode==='checked'||mode==='playlist'){
   const requested=unique(paths);
   const known=new Set(list.songs);
   const missing=requested.filter(p=>!known.has(p));
   const denied=requested.filter(p=>known.has(p)&&!allow.has(p));
   if(missing.length||denied.length)return {error:'selection',message:
    (missing.length?missing.length+' selected song(s) not in the current catalog. ':'')+
    (denied.length?denied.length+' selected song(s) not covered by this offline code. ':'')+
    'Selection kept; no partial download started.'};
  }
  if(!chosen.length)return {error:'selection',message:'No authorized selected songs. Check your selection and offline code.'};
  // A valid MUSIC code alone is not proof of OFFLINE entitlement. Ask the
  // existing server to verify a signed OFFLINE-enabled session before saving.
  if(typeof bridge().verify==='function'){
   try{
    const verified=await bridge().verify(chosen[0]);
    if(verified!==true)return {error:'access',message:'OFFLINE permission was not verified for this code.'};
   }catch(error){
    return {error:'access',message:String(error?.message||'OFFLINE permission could not be verified.')};
   }
  }
  // Preserve all earlier planned songs, even if today's access scope is narrower.
  // The plan describes only the current choice. Cached earlier music stays
  // untouched but must never be silently added to this request.
  const priorMode=planMode();
  setPlan(chosen,mode==='update'?priorMode:mode);
  const previousPending=pending();
  savePending({mode,paths:mode==='all'||mode==='update'?[]:chosen,
   tries:Math.min(5,Number(previousPending?.tries||0)+1),updatedAt:Date.now()});
  const withStations=mode==='all'||(mode==='update'&&priorMode==='all');
  const downloads=unique([...chosen,...(withStations?list.stations:[])]);
  const cache=await caches.open(AUDIO);
  const total=downloads.length;
  for(const path of downloads){
   if(stopped)break;
   try{await downloadAudio(path,cache)}catch(error){
    const message=String(error?.message||error);
    failures.push({path,error:message});
    if(/quota|storage full|out of space|disk full/i.test(message)){stopped=true}
   }
   completed++;
   const fraction=Math.min(0.98,completed/Math.max(1,total));
   const percent=Math.floor(fraction*99);
   const elapsed=(Date.now()-start)/1000;
   const etaSeconds=completed>0?Math.max(0,Math.ceil(elapsed*(total-completed)/completed)):null;
   report(onProgress,{phase:'audio',percent,etaSeconds});
  }
  if(completed>0){
   try{localStorage.setItem(ACTIVATED,'yes')}catch(_){}
   try{await bridge().rescan?.()}catch(_){}
  }
  report(onProgress,{phase:'verifying',percent:99,etaSeconds:null});
  const checked=await inspect();
  const quota=failures.some(f=>/quota|storage|space|disk/i.test(f.error));
  const result={...checked,mode,failures,stopped,completed,attempted:total,
   message:quota?'Device storage limit reached. Saved songs are safe. Free some space and use UPDATE MISSING.':
    failures.length?failures.length+' file(s) failed: '+failures[0].path.split('/').pop()+' · '+failures[0].error:''
  };
  if(checked.ready||stopped||quota)clearPending();
  report(onProgress,{phase:'finished',percent:checked.ready?100:checked.percent,
   ready:checked.ready,partial:checked.partial,stopped,message:result.message});
  return result;
 }catch(error){
  const message=String(error?.message||error);
  const detail=/quota|storage|space|disk/i.test(message)?
   'Device storage is full. Previously saved music remains available.':
   'Download stopped: '+message.slice(0,140);
  report(onProgress,{phase:'error',message:detail});
  return {error:'download',message:detail,failures};
 }finally{busy=false;currentAbort=null}
}
// Inventory is read from actual Cache Storage keys, including earlier cache
// versions. Never infer downloaded files from the current selection or plan.
// Scan all browser cache namespaces, including historical GE repository URLs.
const LEGACY_AUDIO=/^ge-music\/(?:music|clips)\/.+\.(?:mp3|wav|m4a|ogg|aac|flac|opus|webm)$/i;
function recordingPath(request){
 try{
  const url=new URL(typeof request==='string'?request:request.url,location.href);
  let path=decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if(url.origin===location.origin)path=path.replace(/^(?:website|radio)\/(?=ge-music\/)/i,'');
  else if(url.hostname==='raw.githubusercontent.com'){
   const match=path.match(/^grandelement\/website\/[^/]+\/(ge-music\/.+)$/i);
   if(!match)return '';path=match[1];
  }else if(url.hostname==='grandelement.github.io')path=path.replace(/^website\//i,'');
  else return '';
  return safe(path,LEGACY_AUDIO)?path:'';
 }catch(_){return ''}
}
async function recordingEntries(errors=[]){
 const entries=[];
 if(typeof caches==='undefined')throw Error('This browser does not expose website Cache Storage.');
 for(const name of await caches.keys()){
  try{
   const cache=await caches.open(name);
   for(const request of await cache.keys()){
    const path=recordingPath(request);
    if(path)entries.push({cache,request,path,name});
   }
  }catch(error){errors.push(name+': '+String(error?.message||error))}
 }
 return entries;
}
async function storageEstimate(){
 try{const e=await navigator.storage?.estimate?.();return Number.isFinite(e?.usage)?e.usage:null}
 catch(_){return null}
}
async function entryBytes(cache,request){
 const response=await cache.match(request,{ignoreSearch:false,ignoreVary:true});
 const n=Number(response?.headers.get('content-length'));
 return Number.isFinite(n)&&n>0?n:0;
}
async function inspectStorage(){
 const errors=[],entries=await recordingEntries(errors),files=new Map();
 let bytes=0,unknown=0;
 for(const {cache,request,path} of entries){
  let size=0;
  try{size=await entryBytes(cache,request)}catch(error){errors.push(path+': '+String(error?.message||error))}
  if(!size)unknown++;
  bytes+=size;
  const record=files.get(path)||{path,bytes:0,copies:0,unknownCopies:0,station:!safe(path,SONG)};
  record.bytes+=size;record.copies++;if(!size)record.unknownCopies++;
  files.set(path,record);
 }
 return {files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)),copies:entries.length,bytes,unknown,
  cachesScanned:(await caches.keys()).length,errors,usage:await storageEstimate()};
}
async function listSaved(){return (await inspectStorage()).files}
async function removeSaved(paths=null){
 if(busy)return {error:'busy',message:'Stop the current download first.'};
 busy=true;
 try{
  const beforeUsage=await storageEstimate();
  const targets=paths===null?null:new Set(unique(paths).filter(p=>safe(p,LEGACY_AUDIO)));
  const removed=new Set(),errors=[];
  let removedCopies=0,removedBytes=0,unknownBytes=0;
  for(let pass=0;pass<3;pass++){
   const entries=(await recordingEntries(errors)).filter(e=>!targets||targets.has(e.path));
   if(!entries.length)break;
   for(const {cache,request,path} of entries){
    try{
     const size=await entryBytes(cache,request).catch(()=>0);
     if(await cache.delete(request,{ignoreSearch:false,ignoreVary:true})){
      removed.add(path);removedCopies++;removedBytes+=size;if(!size)unknownBytes++;
     }
    }catch(error){errors.push(path+': '+String(error?.message||error))}
   }
  }
  if(paths===null){setPlan([],'checked');clearPending();try{localStorage.removeItem(ACTIVATED)}catch(_){}}
  else{setPlan(plan().filter(p=>!targets.has(p)),planMode());clearPending();}
  try{await bridge().rescan?.()}catch(_){}
  const remaining=await inspectStorage();
  if(!remaining.copies)try{localStorage.removeItem(ACTIVATED)}catch(_){}
  const left=targets?remaining.files.filter(f=>targets.has(f.path)).reduce((n,f)=>n+f.copies,0):remaining.copies;
  return {removed:removed.size,removedCopies,removedBytes,unknownBytes,remaining:remaining.files.length,
   remainingCopies:remaining.copies,targetCopiesRemaining:left,cachesScanned:remaining.cachesScanned,
   beforeUsage,afterUsage:remaining.usage,errors:[...new Set([...errors,...remaining.errors])]};
 }catch(error){return {error:'remove',message:String(error?.message||error)}}
 finally{busy=false;void syncStatus()}
}
async function reloadSaved({paths=null,onProgress}={}){
 if(busy)return {error:'busy',message:'Download already running'};
 if(!canDownload())return {error:'access',message:'Connect online with an OFFLINE-enabled code to reload files.'};
 busy=true;stopped=false;
 const failures=[];let completed=0;
 try{
  const inventory=await listSaved(),catalogue=await catalog();
  const chosen=paths===null?inventory.map(f=>f.path):unique(paths);
  const present=new Set(inventory.map(f=>f.path)),allowed=new Set(authorized(catalogue.songs));
  const stations=new Set(catalogue.stations);
  const permitted=chosen.filter(p=>present.has(p)&&(allowed.has(p)||stations.has(p)));
  if(!permitted.length)return {error:'selection',message:'No saved files eligible for reload.'};
  if(typeof bridge().verify==='function'){
   const first=permitted.find(p=>allowed.has(p))||[...allowed][0];
   if(!first||await bridge().verify(first)!==true)return {error:'access',message:'OFFLINE permission could not be verified.'};
  }
  const cache=await caches.open(AUDIO);
  report(onProgress,{phase:'preparing',percent:0});
  for(const path of permitted){
   if(stopped)break;
   try{
    // Replace only after a complete successful fetch, leaving the old copy on failure.
    await downloadAudio(path,cache,{force:true});
    const url=address(path);
    // Remove older duplicate variants only AFTER the canonical replacement verifies.
    for(const entry of await recordingEntries()){
     if(entry.path===path&&!(entry.name===AUDIO&&entry.request.url===url))
      await entry.cache.delete(entry.request,{ignoreSearch:false});
    }
   }catch(error){failures.push({path,error:String(error?.message||error)});}
   completed++;
   report(onProgress,{phase:'audio',percent:Math.floor(completed/permitted.length*98)});
  }
  try{await bridge().rescan?.()}catch(_){}
  const checked=await inspect();
  return {...checked,completed,failures,skipped:chosen.length-permitted.length,stopped};
 }catch(error){return {error:'reload',message:String(error?.message||error),failures}}
 finally{busy=false;void syncStatus()}
}
async function repair(args={}){return save({...args,mode:'update'})}
async function syncStatus(){
 if(busy)return;
 try{await inspect()}catch(_){}
}
async function resume(){
 // Never restart a stale ALL MUSIC request in the background.
 // Downloads require a fresh user choice, including UPDATE MISSING.
 return false;
}
function onReturn(){
 // iOS can suspend JS when switching apps. Reopening resumes missing files,
 // but never bypasses a new or expired code authorization.
 void syncStatus();
}
try{
 window.addEventListener?.('pageshow',onReturn);
 window.addEventListener?.('focus',onReturn);
 window.addEventListener?.('online',onReturn);
 document?.addEventListener?.('visibilitychange',()=>{if(!document.hidden)onReturn()});
 if(document?.readyState==='complete')setTimeout(onReturn,0);
}catch(_){}
window.GEOffline={isActive:active};
window.GEOfflineDownloads={inspect,save,repair,stop,catalog,plan,active,installed,canDownload,listSaved,inspectStorage,removeSaved,reloadSaved,
 isBusy:()=>busy,resume,syncStatus,status:()=>({...lastStatus}),pending,
 promptCode:()=>bridge().promptCode?.()};
})();