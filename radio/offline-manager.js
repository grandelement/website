/* Grand Element Radio · Unified OFFLINE engine.
   MUSIC owns the only interface; Radio's OFFLINE button opens MUSIC.
   The service worker owns the startup shell. This engine owns authorized media downloads.
   Existing Cache Storage media, catalog, playlist, entitlement and selection keys are never cleared. */
(()=>{
'use strict';
const VERSION='2026.11.15-music-albums-offline-v2';
const AUDIO='ge-radio-media-v4';
const PLAN='GE_RADIO_OFFLINE_PLAN_V1';
const ACTIVATED='GE_RADIO_OFFLINE_ACTIVATED_V1';
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
const report=(fn,event)=>{try{fn?.(event)}catch(error){console.warn('Offline progress callback failed',error)}};
let busy=false,stopped=false,currentAbort=null;
function plan(){
 try{return unique(JSON.parse(localStorage.getItem(PLAN)||'null')?.paths).filter(x=>safe(x,SONG))}catch(_){return []}
}
function setPlan(paths){
 try{localStorage.setItem(PLAN,JSON.stringify({type:'music',paths:unique(paths).filter(x=>safe(x,SONG)),at:Date.now()}))}catch(_){}
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
  const worker=reg.waiting||reg.active||navigator.serviceWorker.controller;
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
  if(status?.version!==VERSION)return {ready:false,missing:['Radio app update required']};
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
 const all=savedPlan.length>0&&saved===savedPlan.length&&
  stations.length>0&&stationSaved===stations.length;
 const ready=all&&engine.ready&&(!ios()||installed())&&active();
 const result={ready,partial:!ready&&(saved>0||stationSaved>0),
  engine:engine.ready,engineMissing:engine.missing,
  saved,total:savedPlan.length,missing,stations:stationSaved,stationTotal:stations.length,
  installed:installed(),percent:ready?100:(savedPlan.length?Math.floor(saved/savedPlan.length*95):0)};
 report(onProgress,{phase:'status',ready,partial:result.partial,percent:result.percent});
 return result;
}
function stop(){
 stopped=true;
 try{currentAbort?.abort()}catch(_){}
}
async function downloadAudio(path,cache){
 const url=address(path);
 if(await alreadySaved(url))return;
 let last;
 for(let attempt=0;attempt<3&&!stopped;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
  currentAbort=controller;
  try{
   const response=await fetch(url,{cache:'no-store',signal:controller.signal,
    headers:{'X-GE-Offline-Download':'1'}});
   if(!audioResponse(response))throw Error('Music file did not download correctly');
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
 if(navigator.onLine===false)return {error:'offline',message:'Connect online to download new music'};
 if(!canDownload())return {error:'access',message:'Enter your OFFLINE access code before downloading. Saved music stays available.'};
 if(ios()&&!installed())return {error:'installation',message:'Open the Radio Home Screen app to download on iPhone.'};
 busy=true;stopped=false;
 let failures=[],completed=0;
 const start=Date.now();
 try{
  report(onProgress,{phase:'preparing',percent:0,etaSeconds:null});
  const engine=await shell({refresh:true});
  if(!engine.ready)return {error:'engine',message:'Offline startup files are incomplete. Reconnect and update Radio.'};
  const list=await catalog();
  if(!list.stations.length)return {error:'catalog',message:'Station identification files are missing from the catalog.'};
  const allowed=authorized(list.songs),allow=new Set(allowed),previous=plan();
  if(!allowed.length)return {error:'access',message:'Your access code does not include published songs.'};
  const chosen=mode==='all'?allowed:
   mode==='update'?allowed:unique(paths).filter(p=>safe(p,SONG)&&allow.has(p));
  if(!chosen.length)return {error:'selection',message:'Choose songs or a playlist inside MUSIC.'};
  // Preserve all earlier planned songs, even if today's access scope is narrower.
  const desired=unique([...previous,...chosen]);setPlan(desired);
  const permittedDownloads=desired.filter(p=>allow.has(p));
  const downloads=unique([...permittedDownloads,...list.stations]);
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
  const result={...checked,mode,failures,stopped,completed,attempted:total};
  report(onProgress,{phase:'finished',percent:checked.ready?100:checked.percent,
   ready:checked.ready,partial:checked.partial,stopped});
  return result;
 }catch(error){
  const message=String(error?.message||error);
  report(onProgress,{phase:'error',message:'Download interrupted. Use UPDATE MISSING to retry.'});
  return {error:'download',message:'Download interrupted. Use UPDATE MISSING to retry.',failures};
 }finally{busy=false;currentAbort=null}
}
async function repair(args={}){return save({...args,mode:'update'})}
window.GEOffline={isActive:active};
window.GEOfflineDownloads={inspect,save,repair,stop,catalog,plan,active,installed,canDownload,
 isBusy:()=>busy,promptCode:()=>bridge().promptCode?.()};
})();