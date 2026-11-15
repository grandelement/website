/* GE Radio OFFLINE engine. MUSIC owns all controls; Radio's OFFLINE is a shortcut.
   Never creates a second dialog/player. Never deletes authorized cached songs on update. */
(()=>{
'use strict';
const AUDIO='ge-radio-media-v4',ART='ge-radio-art-v1',BACKGROUNDS='ge-radio-backgrounds-v1';
const PLAN='GE_RADIO_OFFLINE_PLAN_V1',ACTIVATED='GE_RADIO_OFFLINE_ACTIVATED_V1';
const SONG=/^ge-music\/music\/.+\.(mp3|wav|m4a|ogg)$/i;
const STATION=/^ge-music\/clips\/GE Station Identification - \d+\.(mp3|wav|m4a|ogg)$/i;
const ALBUMS=['Aether','Fire','Spirit','Soul','Love','Intergy','Sessions II','Sessions I','Live','Trio','Fundamental Groove','Singles'];
const workerVersion='2026.11.15-offline-music-v117';
let busy=false,stopRequested=false,abort=null;
const bridge=()=>window.GERadioOfflineBridge||{};
const active=()=>{try{return localStorage.getItem(ACTIVATED)==='yes'}catch(_){return false}};
window.GEOffline={isActive:active};
const installed=()=>!!(window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true);
const ios=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const canDownload=()=>bridge().canDownload?.()===true&&navigator.onLine!==false;
const fileURL=path=>new URL('../'+String(path).split('/').map(encodeURIComponent).join('/'),location.href).href;
const unique=items=>[...new Set((Array.isArray(items)?items:[]).filter(x=>typeof x==='string'&&x.length))];
const safePath=path=>String(path||'').replace(/^\/+/,'');
const notify=(cb,event)=>{try{cb?.(event)}catch(error){console.warn('Offline progress callback',error)}};
function plan(){
 try{const value=JSON.parse(localStorage.getItem(PLAN)||'null');return unique(value?.paths).filter(p=>SONG.test(p))}catch(_){return []}
}
function setPlan(paths){
 try{localStorage.setItem(PLAN,JSON.stringify({type:'music',paths:unique(paths).filter(p=>SONG.test(p)),at:Date.now()}))}catch(_){}
}
function audioResponse(r){
 return !!r&&r.ok&&r.status===200&&!/text\/html|application\/json|text\/plain|image\/|video\//i.test(r.headers.get('content-type')||'');
}
async function valid(cache,url){
 const r=await cache.match(url,{ignoreSearch:true});
 if(!audioResponse(r))return false;
 if(Number(r.headers.get('content-length')||0)>128)return true;
 try{return (await r.blob()).size>128}catch(_){return false}
}
async function stored(url){
 for(const name of await caches.keys()){
  const cache=await caches.open(name);
  if(await valid(cache,url))return true;
 }
 return false;
}
async function catalog(){
 const url=new URL('./manifest.json',location.href).href;
 let response=null;
 if(navigator.onLine!==false){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7500);
  try{response=await fetch(url,{cache:'no-store',signal:controller.signal})}catch(_){}
  finally{clearTimeout(timer)}
 }
 if(!response?.ok)response=await caches.match(url,{ignoreSearch:true});
 if(!response?.ok)throw Error('Music catalog unavailable. Connect online once.');
 const data=await response.json();
 const files=unique(data?.files);
 return {songs:files.filter(p=>SONG.test(p)),stations:files.filter(p=>STATION.test(p))};
}
function approved(songs){
 const permitted=bridge().allowedPaths?.();
 if(permitted===null)return songs;
 if(!Array.isArray(permitted))return [];
 const set=new Set(permitted.map(safePath));
 return songs.filter(p=>set.has(p));
}
async function workerStatus({refresh=false}={}){
 if(!('serviceWorker' in navigator))return {ready:false,missing:['Offline engine unsupported']};
 try{
  let reg=await navigator.serviceWorker.getRegistration('./');
  if(!reg&&navigator.onLine!==false)
   reg=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  if(!reg)return {ready:false,missing:['Offline engine not installed']};
  if(refresh&&navigator.onLine!==false)await reg.update().catch(()=>{});
  if(reg.installing){
   const s=reg.installing;
   await Promise.race([
    new Promise(resolve=>{
     const fn=()=>{if(['installed','activated','redundant'].includes(s.state)){s.removeEventListener('statechange',fn);resolve()}};
     s.addEventListener('statechange',fn);fn();
    }),
    new Promise(resolve=>setTimeout(resolve,14000))
   ]);
  }
  reg=await navigator.serviceWorker.getRegistration('./')||reg;
  const sw=reg.waiting||reg.active||navigator.serviceWorker.controller;
  if(!sw)return {ready:false,missing:['Engine not active']};
  const result=await new Promise(resolve=>{
   const chan=new MessageChannel();
   let settled=false;
   const finish=data=>{if(settled)return;settled=true;clearTimeout(timer);chan.port1.close();resolve(data)};
   const timer=setTimeout(()=>finish({ready:false,missing:['Engine check timed out']}),6000);
   chan.port1.onmessage=e=>finish(e.data);
   try{sw.postMessage({type:'GE_RADIO_SHELL_STATUS'},[chan.port2])}
   catch(e){finish({ready:false,missing:[String(e.message||e)]})}
  });
  if(result?.version!==workerVersion)return {ready:false,missing:['Install updated Radio engine online'],version:result?.version};
  return result;
 }catch(error){return {ready:false,missing:[String(error?.message||error)]}}
}
async function inspect({onProgress}={}){
 const engine=await workerStatus();
 const paths=plan();
 let saved=0;const missing=[];
 for(let i=0;i<paths.length;i++){
  if(await stored(fileURL(paths[i])))saved++;
  else missing.push(paths[i]);
  if(i%12===0)notify(onProgress,{phase:'checking',completed:i+1,total:paths.length});
 }
 let stations=[],stationSaved=0;
 try{
  stations=(await catalog()).stations;
  for(const p of stations)if(await stored(fileURL(p)))stationSaved++;
 }catch(_){}
 const full=paths.length>0&&saved===paths.length&&stations.length>0&&stationSaved===stations.length;
 const ready=!!engine.ready&&full&&(!ios()||installed())&&active();
 const result={ready,partial:saved>0&&!ready,engine:!!engine.ready,engineMissing:engine.missing||[],
   saved,total:paths.length,missing,stations:stationSaved,stationTotal:stations.length,installed:installed()};
 notify(onProgress,{phase:'status',...result});
 return result;
}
function stop(){stopRequested=true;try{abort?.abort()}catch(_){}}
async function downloadOne(path,cache){
 const url=fileURL(path);
 if(await stored(url))return;
 let last;
 for(let attempt=1;attempt<=3&&!stopRequested;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  abort=controller;
  try{
   // The worker forwards explicit downloads without its automatic duplicate
   // media cache.put. A saved MP3 is written exactly once here.
   const response=await fetch(url,{cache:'no-store',signal:controller.signal,
     headers:{'X-GE-Offline-Download':'1'}});
   if(!audioResponse(response))throw Error('HTTP '+response.status+' or invalid audio');
   const blob=await response.blob();
   if(blob.size<128)throw Error('Empty audio file');
   const headers=new Headers(response.headers);headers.set('Content-Length',String(blob.size));
   await cache.put(url,new Response(blob,{status:200,headers}));
   if(!(await valid(cache,url)))throw Error('Storage verification failed');
   return;
  }catch(e){
   last=e;
   if(stopRequested)break;
   if(/quota|storage|space|disk/i.test(String(e.message||e)))break;
   if(attempt<3)await new Promise(resolve=>setTimeout(resolve,attempt*500));
  }finally{clearTimeout(timer);abort=null}
 }
 throw last||Error('Stopped');
}
async function saveImages(onProgress){
 // Artwork and backgrounds never decide whether saved audio can play.
 const covers=ALBUMS.map(n=>new URL('../ge-images/images/Grand Element - '+encodeURIComponent(n)+'.jpg',location.href).href);
 let backgrounds=[];
 try{
  const response=await fetch(new URL('../ge-images/img/manifest.json',location.href),{cache:'no-store'});
  if(response.ok){
   const names=await response.json();
   if(Array.isArray(names))backgrounds=names.filter(x=>typeof x==='string'&&/^[\w .-]+\.(png|jpe?g|gif|webp)$/i.test(x))
    .map(n=>new URL('../ge-images/img/'+encodeURIComponent(n),location.href).href);
  }
 }catch(_){}
 const files=[...covers.map(url=>({url,cache:ART})),...backgrounds.map(url=>({url,cache:BACKGROUNDS}))];
 let done=0,errors=0;
 for(const file of files){
  if(stopRequested)break;
  const cache=await caches.open(file.cache);
  if((await cache.match(file.url))?.ok){done++;continue}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  abort=controller;
  try{
   const r=await fetch(file.url,{cache:'no-store',signal:controller.signal});
   if(!r.ok||!/image\//i.test(r.headers.get('content-type')||''))throw Error('Invalid image');
   await cache.put(file.url,r);
   done++;
  }catch(_){errors++}
  finally{clearTimeout(timer);abort=null}
  if(done%8===0)notify(onProgress,{phase:'images',completed:done,total:files.length});
 }
 return {saved:done,total:files.length,failed:errors};
}
async function save({mode='all',paths=[],onProgress}={}){
 if(busy)return {error:'A download is already running'};
 if(navigator.onLine===false)return {error:'Connect online to download new songs',...await inspect()};
 if(!canDownload())return {error:'access',message:'Enter a valid OFFLINE access code before downloading. Saved songs still work.'};
 if(ios()&&!installed())return {error:'installation',message:'Open the Radio Home Screen app before downloading music.'};
 busy=true;stopRequested=false;
 const failures=[];let completed=0,oldPlan=plan();
 try{
  notify(onProgress,{phase:'starting',mode});
  const worker=await workerStatus({refresh:true});
  if(!worker.ready)return {error:'engine',message:'Offline startup engine needs repair: '+(worker.missing||[]).join(', ')};
  const list=await catalog(),authorized=approved(list.songs);
  if(!authorized.length)return {error:'access',message:'This access code has no published songs available'};
  const permitted=new Set(authorized);
  const chosen=mode==='all'?authorized:
   mode==='update'?unique([...oldPlan,...authorized]).filter(p=>permitted.has(p)||oldPlan.includes(p)):
   unique(paths).filter(p=>permitted.has(p));
  if(!chosen.length)return {error:'selection',message:'No authorized songs selected. Choose songs or a playlist in MUSIC.'};
  // Keep every previous plan entry when saving a new selection. Never
  // narrow or erase an existing music package on change of mode.
  const desired=unique([...oldPlan,...chosen]);setPlan(desired);
  const cache=await caches.open(AUDIO);
  const stations=list.stations;
  const downloads=[...unique(chosen),...stations];
  let remaining=0;
  for(const path of downloads)if(!(await stored(fileURL(path))))remaining++;
  notify(onProgress,{phase:'starting-download',completed:0,total:downloads.length,remaining});
  for(const path of downloads){
   if(stopRequested)break;
   try{await downloadOne(path,cache)}catch(error){
    failures.push({path,error:String(error.message||error)});
   }
   completed++;
   notify(onProgress,{phase:'audio',completed,total:downloads.length,
     remaining:Math.max(0,downloads.length-completed),
     current:path.split('/').pop(),failed:failures.length});
  }
  if(completed>0 && !stopRequested){
   try{localStorage.setItem(ACTIVATED,'yes')}catch(_){}
   try{await bridge().rescan?.()}catch(_){}
  }
  let images={saved:0,total:0,failed:0};
  if(!stopRequested)images=await saveImages(onProgress);
  const audited=await inspect();
  const result={...audited,mode,failures,images,stopped:stopRequested,
    completed,attempted:downloads.length};
  notify(onProgress,{phase:'finished',...result});
  return result;
 }catch(error){
  const message=String(error?.message||error);
  notify(onProgress,{phase:'error',message});
  return {error:'download',message,failures};
 }finally{busy=false;abort=null}
}
async function repair(args={}){return save({...args,mode:'update'})}
window.GEOfflineDownloads={inspect,save,repair,stop,catalog,plan,active,installed,canDownload,
  isBusy:()=>busy,promptCode:()=>bridge().promptCode?.()};
})();
