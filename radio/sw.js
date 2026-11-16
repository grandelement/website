/* Grand Element Radio · One offline service worker.
 * Atomic verified shell + existing media cache. No listener media/cache deletion.
 * MUSIC is the only download interface; the worker only serves startup and files.
 */
'use strict';
const VERSION='2026.11.16-large-albums-v3';
const UI_MARKER='GE_RADIO_UI_BUILD_20261116_LARGE_ALBUMS_V5';
const SHELL_CACHE='ge-radio-shell-'+VERSION;
const MEDIA_CACHE='ge-radio-media-v4'; // Preserve all existing saved music.
const ARTWORK=['Aether','Fire','Spirit','Soul','Love','Intergy',
 'Sessions II','Sessions I','Live','Trio','Fundamental Groove','Singles'];
const REQUIRED=[
 './offline-home.html',
 './ge-music-v5.js','./offline-manager.js','./offline-spectrum.js',
 './ge-purchase-demo.js','./iam-private-studio.js',
 './ge-gate-audio.js','./ge-gate-settings.js',
 '../ge-vault-client.js','../ge-accessibility.js','../ge-accessibility.css',
 './manifest.json','./track-durations.json','./loudness.json',
 '../playlists/registry.json','../config/site-live.json',
 './manifest.webmanifest',
 '../ge-images/images/ge-logo-2.jpg','../ge-images/img/31.gif',
 ...ARTWORK.map(name=>'../ge-images/images/Grand Element - '+encodeURIComponent(name)+'.jpg')
];
const OPTIONAL=['./preview-lab.html','./favicon.ico',
 './icons/favicon-16.png','./icons/favicon-32.png',
 './icons/apple-touch-icon.png','./icons/icon-192.png','./icons/icon-512.png',
 './icons/icon-maskable-512.png','./cockpit-landscape.png',
 '../ge-images/img/manifest.json'];
const IMAGE=/\.(?:gif|png|jpe?g|webp)$/i;
const AUDIO=/\.(?:mp3|m4a|ogg|wav)$/i;
const STATIC_JSON=/\.json$/i;
function requestURL(path){return new URL(path,self.location.href).href;}
async function timeoutFetch(request,options={},ms=4200){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),ms);
 try{return await fetch(request,{...options,signal:controller.signal})}
 finally{clearTimeout(timeout)}
}
async function validIndex(response,strict=false){
 if(!response?.ok||response.status!==200)return false;
 try{
  const html=await response.clone().text();
  return html.slice(0,30000).toLowerCase().includes('<!doctype html')&&
   html.includes('<title>Grand Element Radio</title>')&&
   html.includes('id="shipStage"')&&html.includes('id="player"')&&
   (!strict||html.includes(UI_MARKER));
 }catch(_){return false}
}
async function validAsset(path,response){
 if(!response?.ok||response.status!==200)return false;
 const type=response.headers.get('content-type')||'';
 const pathname=new URL(requestURL(path)).pathname;
 if(IMAGE.test(pathname)&&!type.toLowerCase().startsWith('image/'))return false;
 if(STATIC_JSON.test(pathname)&&!/json/i.test(type))return false;
 if(/\.js$/i.test(pathname)&&/text\/html|application\/json/i.test(type))return false;
 if(/\.css$/i.test(pathname)&&/text\/html|application\/json/i.test(type))return false;
 try{
  const length=Number(response.headers.get('content-length'));
  if(Number.isFinite(length)&&length>0)return true;
  return (await response.clone().blob()).size>0;
 }catch(_){return false}
}
async function installShell(){
 const cache=await caches.open(SHELL_CACHE);
 const home=requestURL('./index.html');
 const update=new URL(home);
 update.searchParams.set('_ge_offline_install',VERSION);
 const index=await timeoutFetch(update.href,{cache:'no-store'},25000);
 if(!(await validIndex(index,true)))throw Error('Radio startup page did not pass validation');
 // The app entry points reuse this one verified HTML body.
 await cache.put('./index.html',index.clone());
 await cache.put('./',index.clone());
 // Required startup files, catalog and essential artwork all have to verify.
 // An interrupted install fails instead of replacing the prior working worker.
 await Promise.all(REQUIRED.map(async path=>{
  const response=await timeoutFetch(requestURL(path),{cache:'reload'},25000);
  if(!(await validAsset(path,response)))throw Error('Required offline file not verified: '+path);
  await cache.put(path,response.clone());
 }));
 await Promise.allSettled(OPTIONAL.map(async path=>{
  const response=await timeoutFetch(requestURL(path),{cache:'reload'},12000);
  if(await validAsset(path,response))await cache.put(path,response.clone());
 }));
}
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{await installShell();await self.skipWaiting()})());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  // Keep one previous working shell. Never delete any music, art or playlists.
  const prior=names.filter(name=>name.startsWith('ge-radio-shell-')&&name!==SHELL_CACHE);
  const keep=prior.at(-1);
  await Promise.all(prior.filter(x=>x!==keep).map(x=>caches.delete(x)));
  await self.clients.claim();
 })());
});
async function cached(request,{media=false}={}){
 const url=typeof request==='string'?request:request.url;
 if(media){
  const audio=await caches.open(MEDIA_CACHE);
  const result=await audio.match(url,{ignoreSearch:true});
  if(result?.ok)return result;
 }
 const shell=await caches.open(SHELL_CACHE);
 const saved=await shell.match(url,{ignoreSearch:true});
 if(saved?.ok)return saved;
 const old=await caches.match(url,{ignoreSearch:true});
 return old?.ok?old:null;
}
async function savedIndex(){
 const shell=await caches.open(SHELL_CACHE);
 for(const response of [
  await shell.match('./index.html',{ignoreSearch:true}),
  await shell.match('./',{ignoreSearch:true}),
  await caches.match('./index.html',{ignoreSearch:true}),
  await caches.match('./',{ignoreSearch:true})
 ])if(await validIndex(response))return response;
 return new Response('Open Radio online once to repair the saved app.',{status:503,
  headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
}
async function rangeResponse(request,response){
 const range=request.headers.get('range');
 if(!range||!response)return response;
 const match=/^bytes=(\d+)-(\d*)$/.exec(range);
 if(!match)return response;
 const blob=await response.blob(),size=blob.size;
 const from=Number(match[1]),to=match[2]?Number(match[2]):size-1;
 if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from>=size||to<from)
  return new Response(null,{status:416,headers:{'content-range':'bytes */'+size}});
 const end=Math.min(to,size-1),headers=new Headers(response.headers);
 headers.set('content-range','bytes '+from+'-'+end+'/'+size);
 headers.set('accept-ranges','bytes');
 headers.set('content-length',String(end-from+1));
 return new Response(blob.slice(from,end+1),{status:206,headers});
}
async function navigation(request){
 const url=new URL(request.url),path=url.pathname;
 // Existing iPhone Home Screen icons sometimes launch offline-home.html.
 // Open the actual cached Radio player without a redirect or timer.
 if(path.endsWith('/radio/offline-home.html')||url.searchParams.has('ge_home')){
  const saved=await savedIndex();
  if(saved.ok)return saved;
 }
 if(!path.endsWith('/radio/')&&!path.endsWith('/radio/index.html')){
  if(self.navigator?.onLine===false)return await cached(request)||new Response('Page not saved offline',{status:503});
  try{
   const response=await timeoutFetch(request,{cache:'no-store'});
   if(response.ok){
    const cache=await caches.open(SHELL_CACHE);
    await cache.put(request,response.clone()).catch(()=>{});
    return response;
   }
  }catch(_){}
  return await cached(request)||new Response('Page not saved offline',{status:503});
 }
 if(self.navigator?.onLine===false)return savedIndex();
 try{
  const fresh=await timeoutFetch(request,{cache:'no-store'});
  if(await validIndex(fresh,true)){
   const cache=await caches.open(SHELL_CACHE);
   await cache.put('./index.html',fresh.clone()).catch(()=>{});
   await cache.put('./',fresh.clone()).catch(()=>{});
   return fresh;
  }
 }catch(_){}
 return savedIndex();
}
async function media(request){
 const url=new URL(request.url);
 if(self.navigator?.onLine===false||url.searchParams.has('ge_offline')){
  const saved=await cached(request,{media:true});
  return saved?rangeResponse(request,saved):new Response('This file has not been downloaded',{status:503});
 }
 // Online playback uses the current published recording. Offline stays local-first.
 try{
  const network=await timeoutFetch(request,{cache:'no-store'},7500);
  if(network.ok){
   if(AUDIO.test(url.pathname)&&network.status===200&&!request.headers.has('range')){
    const cache=await caches.open(MEDIA_CACHE);
    cache.put(url.href,network.clone()).catch(()=>{});
   }
   return network;
  }
 }catch(_){}
 const saved=await cached(request,{media:true});
 return saved?rangeResponse(request,saved):new Response('Media unavailable',{status:503});
}
async function staticFile(request){
 if(self.navigator?.onLine===false)return await cached(request)||
  new Response('Offline app file missing. Reconnect and repair.',{status:503});
 try{
  const fresh=await timeoutFetch(request,{cache:'no-store'});
  if(fresh.ok){
   const url=new URL(request.url);
   if(await validAsset(url.pathname,fresh)){
    const cache=await caches.open(SHELL_CACHE);
    await cache.put(request,fresh.clone()).catch(()=>{});
   }
   return fresh;
  }
  if(fresh.status!==503&&fresh.status!==504)return fresh;
 }catch(_){}
 return await cached(request)||new Response('App resource unavailable',{status:503});
}
async function shellStatus(){
 const result={type:'GE_RADIO_SHELL_STATUS',version:VERSION,ready:false,missing:[]};
 try{
  const shell=await caches.open(SHELL_CACHE);
  const index=await shell.match('./index.html',{ignoreSearch:true});
  if(!(await validIndex(index,true)))result.missing.push('Radio page');
  for(const file of REQUIRED){
   const saved=await shell.match(file,{ignoreSearch:true});
   if(!(await validAsset(file,saved)))result.missing.push(file);
  }
  result.ready=result.missing.length===0;
 }catch(_){result.missing.push('Offline startup cache unavailable')}
 return result;
}
self.addEventListener('message',event=>{
 if(event.data?.type!=='GE_RADIO_SHELL_STATUS')return;
 event.waitUntil((async()=>{
  const result=await shellStatus();
  try{event.ports?.[0]?.postMessage(result)}catch(_){}
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 // The one MUSIC offline engine alone writes explicit downloaded audio.
 if(request.headers.get('X-GE-Offline-Download')==='1'){
  event.respondWith(timeoutFetch(request,{cache:'no-store'},90000));
  return;
 }
 if(request.headers.get('X-GE-Reload-Media')==='1'){
  event.respondWith((async()=>{
   const fresh=await timeoutFetch(request,{cache:'no-store'},90000);
   if(fresh.ok&&fresh.status===200){
    const cache=await caches.open(MEDIA_CACHE);
    await cache.put(request.url,fresh.clone()).catch(()=>{});
   }
   return fresh;
  })());
  return;
 }
 if(request.headers.get('X-GE-Template-Reload')==='1'||request.headers.get('X-GE-Reload')==='1'){
  event.respondWith((async()=>{
   const fresh=await timeoutFetch(request,{cache:'no-store'},15000);
   if(fresh.ok){
    const cache=await caches.open(SHELL_CACHE);
    await cache.put(request.url,fresh.clone()).catch(()=>{});
   }
   return fresh;
  })());
  return;
 }
 if(request.mode==='navigate'){event.respondWith(navigation(request));return}
 if(AUDIO.test(url.pathname)||IMAGE.test(url.pathname)||request.destination==='audio'||request.destination==='image'){
  event.respondWith(media(request));return;
 }
 event.respondWith(staticFile(request));
});