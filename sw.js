/* Grand Element website offline worker.
   Owns the homepage/website scope; radio/sw.js continues to own /radio/.
   The manually downloaded library lives in GE_SHARED_OFFLINE_V2. */
'use strict';
const SITE_SHELL='GE_SITE_SHELL_V2_LOCAL_BRAND_ART';
const SHARED_LIBRARY='GE_SHARED_OFFLINE_V2';
const HOME=new URL('./',self.registration.scope);
const HOME_INDEX=new URL('index.html',HOME);
const SHELL=['./','./index.html','./radio/website-live.js','./manifest.webmanifest'];

async function fromAnyCache(request){
  return (await caches.match(request,{ignoreSearch:true}))||null;
}
async function installShell(){
  const cache=await caches.open(SITE_SHELL);
  const response=await fetch(HOME.href,{cache:'reload'});
  if(!response.ok)throw new Error('Unable to cache Grand Element homepage');
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
async function navigation(request){
  try{
    const response=await fetch(request);
    if(response.ok){
      // Fresh HTML on every online visit; retain the last valid offline copy.
      const cache=await caches.open(SITE_SHELL);
      await cache.put(request.url,response.clone());
    }
    return response;
  }catch(_e){
    const saved=await fromAnyCache(request);
    if(saved)return saved;
    const pathname=new URL(request.url).pathname;
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
  if(req.mode==='navigate'){
    event.respondWith(navigation(req));return;
  }
  event.respondWith(asset(req,url));
});
