/* Grand Element website offline worker.
   Owns the homepage/website scope; radio/sw.js continues to own /radio/.
   The manually downloaded library lives in GE_SHARED_OFFLINE_V2. */
'use strict';
const SITE_SHELL='GE_SITE_SHELL_V6_RECOVERY_20261109';
const SHARED_LIBRARY='GE_SHARED_OFFLINE_V2';
const HOME=new URL('./',self.registration.scope);
const HOME_INDEX=new URL('index.html',HOME);
const SHELL=['./','./index.html','./ge-offline-library.js','./config/site-live.json','./ge-vault-client.js','./ge-dream.js','./radio/website-live.js','./radio/ge-home-gate-stop.js','./radio/manifest.json','./ge-accessibility.js','./ge-accessibility.css','./manifest.webmanifest'];

async function validHomepage(response){
  if(!response||!response.ok)return false;
  try{
    const html=await response.clone().text();
    return html.includes('<html') && html.includes('id="offlinePanel"') &&
      html.includes('id="gameOfflineBtn"') && html.includes('</html>');
  }catch(_){return false;}
}
async function fromAnyCache(request){
  // Prefer the newest verified shell, not an older cache with a blank/partial HTML.
  const current=await caches.open(SITE_SHELL);
  const direct=await current.match(request,{ignoreSearch:true});
  if(direct)return direct;
  return (await caches.match(request,{ignoreSearch:true}))||null;
}
function offlineRecovery(){
  return new Response('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>GE Studios Offline Recovery</title><style>body{background:#071421;color:#e8f4ff;font:16px system-ui;padding:24px;line-height:1.5}button{background:#13476a;color:white;border:1px solid #75c6ee;border-radius:10px;padding:14px;margin:8px 4px 8px 0;font:inherit}p{max-width:560px}</style></head><body><h1>GRAND ELEMENT · OFFLINE</h1><p>The full saved website is unavailable on this device. Reconnect once and open the website to restore the offline files. Your Radio downloads and settings are preserved.</p><button onclick="location.reload()">TRY SAVED SITE</button><button onclick="location.href=\'/\'">HOME</button><button onclick="if(confirm(\'Delete GE website offline cache?\'))caches.keys().then(a=>Promise.all(a.filter(n=>n.startsWith(\'GE_SITE_SHELL_\')||n===\'GE_SHARED_OFFLINE_V2\').map(n=>caches.delete(n)))).then(()=>document.querySelector(\'p\').textContent=\'Offline website cache cleared. Reconnect to download again.\')">DELETE OFFLINE FILES</button></body></html>',{status:200,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}});
}
async function installShell(){
  const cache=await caches.open(SITE_SHELL);
  const response=await fetch(HOME.href,{cache:'reload'});
  if(!response.ok)throw new Error('Unable to cache Grand Element homepage');
  // The page may respond 200 with an incomplete deploy; never install that
  // as the offline application. Validate its core UI and recovery bootstrap.
  const html=await response.clone().text();
  if(!html.includes('id="offlinePanel"')||
     !html.includes('ge-offline-boot-recovery-v1')||
     !html.includes('id="gameOfflineBtn"')){
    throw new Error('Grand Element homepage is incomplete; retaining previous offline worker');
  }
  await cache.put(HOME.href,response.clone());
  await cache.put(HOME_INDEX.href,response.clone());
  await Promise.allSettled(SHELL.slice(2).map(async path=>{
    const url=new URL(path,HOME);
    const r=await fetch(url.href,{cache:'reload'});
    if(r.ok)await cache.put(url.href,r.clone());
  }));
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{await installShell();await self.skipWaiting()})());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{await self.clients.claim()})());
});

function acceptableAsset(url){
  if(url.origin===HOME.origin)return true;
  // GE artwork is hosted at this separate project-domain address.
  return url.hostname==='grandelement.github.io'&&url.pathname.startsWith('/website/');
}
async function partialResponse(request,response){
  const range=request.headers.get('range');
  if(!range||!response||response.status===206)return response;
  const m=/^bytes=(\d+)-(\d*)$/i.exec(range);
  if(!m)return response;
  const buffer=await response.arrayBuffer();
  const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),buffer.byteLength-1):buffer.byteLength-1;
  if(start>=buffer.byteLength||end<start){
    return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+buffer.byteLength}});
  }
  const body=buffer.slice(start,end+1);
  const headers=new Headers(response.headers);
  headers.set('Content-Range','bytes '+start+'-'+end+'/'+buffer.byteLength);
  headers.set('Content-Length',String(body.byteLength));
  headers.set('Accept-Ranges','bytes');
  return new Response(body,{status:206,headers});
}
function urlIsHome(value){const u=new URL(value);return u.pathname===HOME.pathname||u.pathname===HOME_INDEX.pathname;}
async function navigation(request){
  const url=new URL(request.url);
  const isHome=urlIsHome(url.href);
  try{
    const response=await fetch(request);
    if(response.ok){
      // Never promote a partial homepage into the device's offline backup.
      if(isHome){
        if(await validHomepage(response)){
          const cache=await caches.open(SITE_SHELL);
          await cache.put(HOME.href,response.clone());
          await cache.put(HOME_INDEX.href,response.clone());
        }else{
          const cached=await verifiedHome();
          if(cached)return cached;
          return offlineRecovery();
        }
      }else{
        const cache=await caches.open(SITE_SHELL);
        await cache.put(request.url,response.clone());
      }
    }else if(response.status>=500){
      const saved=isHome?await verifiedHome():await fromAnyCache(request);
      if(saved)return saved;
    }
    return response;
  }catch(_e){
    if(isHome){
      const saved=await verifiedHome();
      return saved||offlineRecovery();
    }
    const saved=await fromAnyCache(request);
    if(saved)return saved;
    if(url.pathname.endsWith('/radio')){
      return Response.redirect(new URL('radio/',HOME).href,302);
    }
    return offlineRecovery();
  }
}
async function verifiedHome(){
  const current=await caches.open(SITE_SHELL);
  for(const key of [HOME.href,HOME_INDEX.href]){
    const r=await current.match(key,{ignoreSearch:true});
    if(await validHomepage(r))return r;
  }
  // During migration, recover a known-good older cached shell.
  const keys=await caches.keys();
  for(const name of keys.filter(n=>n.startsWith('GE_SITE_SHELL_')||n==='GE_SHARED_OFFLINE_V2').reverse()){
    const cache=await caches.open(name);
    for(const key of [HOME.href,HOME_INDEX.href]){
      const r=await cache.match(key,{ignoreSearch:true});
      if(await validHomepage(r))return r;
    }
  }
  return null;
}
async function asset(request,url){
  const range=request.headers.get('range');
  if(range){
    const cached=await fromAnyCache(request);
    if(cached&&cached.ok&&cached.status!==206)return partialResponse(request,cached);
    return fetch(request);
  }
  try{
    const response=await fetch(request);
    if(response.status>=500){
      // Serve previously cached public assets when the host has an outage.
      const saved=await fromAnyCache(request);
      if(saved)return saved;
    }
    if(response.ok&&response.status===200&&url.origin===HOME.origin&&
      /\.(js|css|json|webmanifest|png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)){
      const cache=await caches.open(SITE_SHELL);
      eventlessPut(cache,request,response.clone());
    }
    return response;
  }catch(_e){
    const cached=await fromAnyCache(request);
    if(cached)return cached;
    return Response.error();
  }
}
function eventlessPut(cache,request,response){
  // Store completion is independent of the response, never block playback.
  cache.put(request,response).catch(()=>{});
}
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||!acceptableAsset(url))return;
  // Never retain or serve an owner-only Back Room page from public offline cache.
  if(url.origin===HOME.origin){
    const relative=url.pathname.startsWith(HOME.pathname)
      ?url.pathname.slice(HOME.pathname.length):'';
    if(relative==='backroom'||relative.startsWith('backroom/'))return;
  }
  if(req.mode==='navigate'){
    event.respondWith(navigation(req));return;
  }
  event.respondWith(asset(req,url));
});
