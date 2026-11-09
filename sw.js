/* Grand Element website offline worker.
   Owns the homepage/website scope; radio/sw.js continues to own /radio/.
   The manually downloaded library lives in GE_SHARED_OFFLINE_V2. */
'use strict';
const SITE_SHELL='GE_SITE_SHELL_V4_OFFLINE_BOOT_20261109';
const SHARED_LIBRARY='GE_SHARED_OFFLINE_V2';
const HOME=new URL('./',self.registration.scope);
const HOME_INDEX=new URL('index.html',HOME);
const SHELL=['./','./index.html','./config/site-live.json','./ge-vault-client.js','./ge-dream.js','./radio/website-live.js','./radio/ge-home-gate-stop.js','./radio/manifest.json','./ge-accessibility.js','./ge-accessibility.css','./manifest.webmanifest'];

async function fromAnyCache(request){
  return (await caches.match(request,{ignoreSearch:true}))||null;
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
  try{
    const response=await fetch(request);
    if(response.ok){
      // Fresh HTML on every online visit; retain the last valid offline copy.
      const cache=await caches.open(SITE_SHELL);
      // Cache HTML only when it is an actual GE application, not a partial
      // hosting response. Keep the last known good offline page otherwise.
      if(urlIsHome(request.url)){
        const html=await response.clone().text();
        if(html.includes('ge-offline-boot-recovery-v1')&&html.includes('id="offlinePanel"')){
          await cache.put(request.url,response.clone());
          await cache.put(HOME.href,response.clone());
          await cache.put(HOME_INDEX.href,response.clone());
        }
      }else{
        await cache.put(request.url,response.clone());
      }
    }else if(response.status>=500){
      // A hosting outage must not replace a previously working homepage.
      const saved=await fromAnyCache(request);
      if(saved)return saved;
    }
    return response;
  }catch(_e){
    const saved=await fromAnyCache(request);
    if(saved)return saved;
    const pathname=new URL(request.url).pathname;
    // Bare /radio bookmarks cannot enter the child /radio/ worker scope
    // without a network redirect. Serve the cached Radio application directly.
    if(pathname==='/radio'||pathname==='/radio/'||pathname==='/radio/index.html'){
      const page=await fromAnyCache(new URL('/radio/index.html',HOME).href)||
        await fromAnyCache(new URL('/radio/',HOME).href);
      if(page){
        // /radio lacks a trailing slash, so relative JavaScript, styles and
        // music URLs would point to / instead of /radio/. Redirect locally
        // into the saved /radio/ page; no network or download is required.
        if(pathname==='/radio')return Response.redirect(new URL('/radio/',HOME).href,302);
        return page;
      }
    }
    if(pathname===HOME.pathname||pathname===HOME_INDEX.pathname){
      const base=await fromAnyCache(HOME.href)||await fromAnyCache(HOME_INDEX.href);
      if(base)return base;
    }
    return new Response('Grand Element is not available offline yet. Open the site online and choose MAKE AVAILABLE OFFLINE.',{
      status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}
    });
  }
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
