/* GE Radio OFFLINE V1: isolated cache manager; never grants permissions or erases saved data automatically. */
(()=>{
'use strict';
const launch=document.getElementById('offlineLaunchBtn');if(!launch)return;
const CACHE='ge-radio-media-v4',ART='ge-radio-art-v1',SELECTED='GE_MUSIC_V3_SELECTION_20261024',PLAN='GE_RADIO_OFFLINE_PLAN_V1';
const ALBUMS=['Aether','Fire','Spirit','Soul','Love','Intergy','Sessions II','Sessions I','Live','Trio','Fundamental Groove','Singles'];
let running=false,cancelled=false,abort=null,returnFocus=null;
const css=document.createElement('style');css.id='ge-radio-offline-manager-style';
css.textContent=[
'.geOfflineSurface[hidden]{display:none}',
'.geOfflineSurface{position:fixed;inset:0;z-index:80000;background:rgba(0,5,16,.88);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}',
'.geOfflineDialog{width:min(540px,100%);max-height:calc(100dvh - 24px);overflow-y:auto;background:#071b2e;border:2px solid #68baf1;border-radius:14px;padding:18px;color:#f0faff;font:16px/1.45 system-ui,sans-serif;box-shadow:0 12px 48px #000}',
'.geOfflineHead{display:flex;align-items:center;justify-content:space-between;gap:10px}.geOfflineHead h2{font-size:22px;margin:0}',
'.geOfflineDialog button{font:800 13px/1.3 system-ui,sans-serif;background:#103453;color:#fff;border:1px solid #77bde7;border-radius:9px;padding:10px 9px;min-height:44px;cursor:pointer}',
'.geOfflineDialog button:disabled{opacity:.5;cursor:not-allowed}.geOfflineActions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:14px}',
'.geOfflineActions button{min-width:0;white-space:normal}.geOfflineDialog p{margin:12px 0}',
'.geOfflineDialog progress{width:100%;height:18px;accent-color:#41d8cc}.geOfflineNote{font-size:13px;color:#c3ddec}',
'.geOfflineDanger{border-color:#e87e7e!important;color:#ffddd9!important}.geOfflineMeter{font-weight:800}.geOfflineStatus{min-height:44px;overflow-wrap:anywhere}',
'.geOfflineBusy{background:linear-gradient(90deg,#06374d,#2a9fd2,#06374d);background-size:200% 100%;animation:geOfflineComet 3.33s linear infinite}',
'@keyframes geOfflineComet{to{background-position:-200% 0}}@media(prefers-reduced-motion:reduce){.geOfflineBusy{animation:none}}'
].join('\n');document.head.append(css);
const surface=document.createElement('div');surface.id='geOfflineSurface';surface.className='geOfflineSurface';surface.hidden=true;
surface.innerHTML=
'<section class="geOfflineDialog" role="dialog" aria-modal="true" aria-labelledby="geOfflineTitle">'+
'<div class="geOfflineHead"><h2 id="geOfflineTitle">OFFLINE MUSIC</h2><button type="button" data-offline="close">CLOSE</button></div>'+
'<p class="geOfflineNote">Download authorized songs on this device. Saved playlists and purchases are preserved.</p>'+
'<p class="geOfflineMeter" id="geOfflineMeter">Checking saved music…</p>'+
'<progress id="geOfflineProgress" value="0" max="100" aria-label="Download progress"></progress>'+
'<p class="geOfflineStatus" id="geOfflineStatus" role="status" aria-live="polite"></p>'+
'<div class="geOfflineActions"><button type="button" data-offline="selected">SAVE SELECTED SONGS</button>'+
'<button type="button" data-offline="all">SAVE ALL ALLOWED</button>'+
'<button type="button" data-offline="art">SAVE ALBUM ART</button>'+
'<button type="button" data-offline="verify">CHECK DOWNLOADS</button>'+
'<button type="button" data-offline="stop" hidden>STOP DOWNLOAD</button>'+
'<button type="button" class="geOfflineDanger" data-offline="delete">DELETE SAVED SONGS</button></div>'+
'<p class="geOfflineNote">Partial downloads resume when SAVE is pressed again. Keep this open while downloading. On iPhone, Safari can remove saved files to reclaim storage. Test playback in Airplane Mode.</p></section>';
document.body.append(surface);
const find=id=>surface.querySelector('#'+id),btn=name=>surface.querySelector('[data-offline="'+name+'"]');
const status=message=>{find('geOfflineStatus').textContent=message};
const progress=(done,total)=>{find('geOfflineProgress').max=Math.max(1,total);find('geOfflineProgress').value=done};
const bridge=()=>window.GERadioOfflineBridge||{};
const fileURL=path=>new URL('../'+String(path).split('/').map(encodeURIComponent).join('/'),location.href).href;
const isAudio=response=>!!response&&response.ok&&response.status===200&&!/text\/html|application\/json|text\/plain|image\/|video\//i.test(response.headers.get('content-type')||'');
async function valid(cache,url){
 const item=await cache.match(url,{ignoreSearch:true});
 if(!isAudio(item))return false;
 if(Number(item.headers.get('content-length')||0)>128)return true;
 try{return (await item.blob()).size>128}catch(_){return false}
}
async function anySaved(url){
 for(const name of await caches.keys()){
  const c=await caches.open(name);
  if(await valid(c,url))return true;
 }
 return false;
}
async function manifest(){
 const url=new URL('./manifest.json',location.href).href;
 let r=null;
 if(navigator.onLine!==false){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  try{r=await fetch(url,{cache:'no-store',signal:controller.signal})}catch(_){}
  finally{clearTimeout(timer)}
 }
 if(!r?.ok)r=await caches.match(url,{ignoreSearch:true});
 if(!r?.ok)throw Error('No saved song catalog. Open Radio online once.');
 const data=await r.json();
 return (Array.isArray(data.files)?data.files:[]).filter(p=>typeof p==='string'&&/^ge-music\/music\/.+\.(mp3|wav|m4a|ogg)$/i.test(p));
}
function allowed(all){
 const rights=bridge().allowedPaths?.();
 if(rights===null)return all;
 if(!Array.isArray(rights))return [];
 const set=new Set(rights.map(p=>String(p).replace(/^\/+/,'')));
 return all.filter(path=>set.has(path));
}
function selected(all){
 let paths=[];try{paths=JSON.parse(localStorage.getItem(SELECTED)||'[]')}catch(_){}
 const set=new Set((Array.isArray(paths)?paths:[]).map(p=>String(p).replace(/^\/+/,'')));
 return all.filter(path=>set.has(path));
}
function busy(value){
 running=value;
 for(const action of ['selected','all','art','delete'])btn(action).disabled=value;
 btn('stop').hidden=!value;
 find('geOfflineProgress').classList.toggle('geOfflineBusy',value);
}
async function inspect(){
 if(!('caches'in window)){status('Browser storage is unavailable.');return}
 try{
  const all=await manifest();
  let count=0;
  for(const path of all)if(await anySaved(fileURL(path)))count++;
  find('geOfflineMeter').textContent=count+' of '+all.length+' published songs stored on this device';
  progress(count,all.length);
  if(!running)status('Choose songs in MUSIC, then SAVE SELECTED, or select SAVE ALL ALLOWED. Cached files do not guarantee Airplane Mode playback.');
 }catch(e){find('geOfflineMeter').textContent='Saved music status unavailable';status(String(e.message||e))}
}
async function download(kind){
 if(running)return;
 if(!bridge().canDownload?.()){status('OFFLINE download access is not verified. Enter CODE first.');bridge().promptCode?.();return}
 if(navigator.onLine===false){status('Reconnect to download. Stored songs remain available locally.');return}
 let target;
 try{const all=allowed(await manifest());target=kind==='selected'?selected(all):all}
 catch(e){status(String(e.message||e));return}
 if(!target.length){status(kind==='selected'?'No permitted songs selected in MUSIC.':'No songs permitted by this access code.');return}
 try{localStorage.setItem(PLAN,JSON.stringify({type:kind,paths:target,at:Date.now()}))}catch(_){}
 busy(true);cancelled=false;const cache=await caches.open(CACHE);
 let done=0,failed=0;progress(0,target.length);
 try{
  for(const path of target){
   if(cancelled)break;
   const url=fileURL(path);
   if(await anySaved(url)){done++;progress(done,target.length);continue}
   abort=new AbortController();const timer=setTimeout(()=>abort.abort(),45000);
   try{
    const response=await fetch(url,{cache:'no-store',signal:abort.signal});
    if(!isAudio(response))throw Error('Invalid audio response');
    const blob=await response.blob();
    if(blob.size<=128)throw Error('Empty audio response');
    const headers=new Headers(response.headers);headers.set('Content-Length',String(blob.size));
    await cache.put(url,new Response(blob,{status:200,headers}));
    if(!await valid(cache,url))throw Error('Storage verification failed');
    done++;
   }catch(e){failed++;status('Could not save '+path.split('/').pop()+': '+String(e.message||e))}
   finally{clearTimeout(timer);abort=null}
   progress(done,target.length);
   find('geOfflineMeter').textContent=done+' of '+target.length+' selected songs stored';
   if(!failed)status('Saving song '+done+' of '+target.length);
  }
 }finally{
  busy(false);
  await Promise.resolve(bridge().rescan?.()).catch(()=>{});
  status(cancelled?'Stopped. Earlier downloads were kept.':failed?failed+' songs failed. Press SAVE again to retry missing files.':'Audio stored and checked. Verify actual playback in Airplane Mode.');
 }
 const outcome={saved:done,failed,total:target.length,stopped:cancelled};
 try{await window.GEOfflineSetup?.onSaved?.(outcome)}catch(_){}
 return outcome;
}
async function saveArt(){
 if(running)return;
 if(!bridge().canDownload?.()){status('Enter CODE to save album art.');bridge().promptCode?.();return}
 if(navigator.onLine===false){status('Reconnect to save artwork.');return}
 busy(true);cancelled=false;let done=0,failed=0;progress(0,ALBUMS.length);const cache=await caches.open(ART);
 try{
  for(const name of ALBUMS){
   if(cancelled)break;
   const url=new URL('../ge-images/images/Grand%20Element%20-%20'+encodeURIComponent(name)+'.jpg',location.href).href;
   try{
    if((await cache.match(url))?.ok){done++;progress(done,ALBUMS.length);continue}
    abort=new AbortController();const timer=setTimeout(()=>abort.abort(),16000);
    try{
     const response=await fetch(url,{cache:'no-store',signal:abort.signal});
     if(!response.ok||!/image\//i.test(response.headers.get('content-type')||''))throw Error('No cover');
     await cache.put(url,response.clone());done++;
    }finally{clearTimeout(timer);abort=null}
   }catch(_){failed++}
   progress(done,ALBUMS.length);
  }
 }finally{busy(false);status(failed?failed+' album covers not saved. Retry while online.':'Album artwork saved.')}
 return {saved:done,failed,total:ALBUMS.length,stopped:cancelled};
}
async function erase(){
 if(running)return;
 if(!window.confirm('Delete downloaded AUDIO from this device? Your playlists, purchases and access rights stay intact.'))return;
 busy(true);let message='';
 try{
  let n=0;
  for(const name of await caches.keys()){
   const cache=await caches.open(name);
   for(const req of await cache.keys()){
    const pathname=new URL(req.url).pathname;
    if(!/\/ge-music\/(?:music|clips)\/.*\.(mp3|m4a|ogg|wav)$/i.test(pathname))continue;
    if(await cache.delete(req))n++;
   }
  }
  for(const key of ['GE_OFFLINE_PLAYABLE_V6','GE_OFFLINE_STATIONS_V6',PLAN,'GE_RADIO_OFFLINE_ACTIVATED_V1'])try{localStorage.removeItem(key)}catch(_){}
  await Promise.resolve(bridge().rescan?.()).catch(()=>{});
  message='Removed '+n+' cached audio copies across all browser caches. Playlists and permissions preserved.';
 }catch(e){message='Delete failed: '+String(e.message||e)}
 finally{busy(false);await inspect();status(message)}
}
function close(){if(running){status('Stop the download before closing.');return}surface.hidden=true;returnFocus?.focus?.()}
function open(){returnFocus=document.activeElement;surface.hidden=false;btn('close').focus();void inspect()}
launch.addEventListener('click',open);
surface.addEventListener('click',event=>{
 if(event.target===surface){close();return}
 const action=event.target.closest('[data-offline]')?.dataset.offline;
 if(action==='close')close();
 if(action==='selected'||action==='all')void download(action);
 if(action==='art')void saveArt();
 if(action==='verify')void inspect();
 if(action==='delete')void erase();
 if(action==='stop'){cancelled=true;abort?.abort()}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!surface.hidden)close()});
window.GERadioOfflineManager={open,inspect,download,saveArt,manifest,allowed,selected,anySaved,fileURL};
})();