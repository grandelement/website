/* Grand Element Radio service worker */
'use strict';
const VERSION='2026.08.10-sha-versioned-audio-1';
const SHELL_CACHE=`ge-radio-shell-${VERSION}`;
const MEDIA_CACHE='ge-radio-media-v4';
const SHELL=[
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  '../ge-images/images/ge-logo-2.jpg'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);
    await Promise.allSettled(SHELL.map(url=>cache.add(new Request(url,{cache:'reload'}))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith('ge-radio-shell-') && name!==SHELL_CACHE).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

function isMedia(request){
  const url=new URL(request.url);
  return request.destination==='audio' || request.destination==='image' || /\.(mp3|m4a|ogg|wav|gif|png|jpe?g|webp)$/i.test(url.pathname);
}
async function cachedResponse(request){
  return (await caches.match(request,{ignoreSearch:true})) || (await caches.match(request.url,{ignoreSearch:true}));
}
async function rangeFromCache(request,response){
  const range=request.headers.get('range');
  if(!range || !response) return response;
  const match=/bytes=(\d+)-(\d+)?/.exec(range);
  if(!match) return response;
  const buffer=await response.arrayBuffer();
  const start=Number(match[1]);
  const end=match[2]?Math.min(Number(match[2]),buffer.byteLength-1):buffer.byteLength-1;
  if(start>=buffer.byteLength || end<start){
    return new Response(null,{status:416,headers:{'Content-Range':`bytes */${buffer.byteLength}`}});
  }
  const headers=new Headers(response.headers);
  headers.set('Content-Range',`bytes ${start}-${end}/${buffer.byteLength}`);
  headers.set('Accept-Ranges','bytes');
  headers.set('Content-Length',String(end-start+1));
  return new Response(buffer.slice(start,end+1),{status:206,statusText:'Partial Content',headers});
}
async function navigationResponse(request){
  try{
    const network=await fetch(request);
    const cache=await caches.open(SHELL_CACHE);
    if(network.ok) cache.put('./index.html',network.clone()).catch(()=>{});
    return network;
  }catch(_error){
    return (await caches.match('./index.html')) || (await caches.match('./')) || new Response('Grand Element Radio is not downloaded yet.',{status:503,headers:{'Content-Type':'text/plain'}});
  }
}
async function mediaResponse(request){
  const url=new URL(request.url);
  const versioned=url.searchParams.has('v');

  // SHA-versioned media must match its FULL URL. Using ignoreSearch:true here
  // would allow an older same-filename MP3 to satisfy the new request.
  const cached=versioned
    ? ((await caches.match(request,{ignoreSearch:false})) ||
       (await caches.match(request.url,{ignoreSearch:false})))
    : await cachedResponse(request);

  if(cached) return rangeFromCache(request,cached);

  const network=await fetch(request,{cache:versioned?'no-store':'default'});
  if(network.ok && network.status===200 && request.method==='GET'){
    const cache=await caches.open(MEDIA_CACHE);
    cache.put(request.url,network.clone()).catch(()=>{});
  }
  return network;
}
async function staticResponse(request){
  const cached=await cachedResponse(request);
  if(cached){
    fetch(request).then(async response=>{
      if(response.ok){ const cache=await caches.open(SHELL_CACHE); cache.put(request,response.clone()).catch(()=>{}); }
    }).catch(()=>{});
    return cached;
  }
  const response=await fetch(request);
  if(response.ok){ const cache=await caches.open(SHELL_CACHE); cache.put(request,response.clone()).catch(()=>{}); }
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  if(request.headers.get('X-GE-Reload-Media')==='1'){
    event.respondWith((async()=>{
      const network=await fetch(request,{cache:'no-store'});
      if(network.ok && network.status===200){
        const cache=await caches.open(MEDIA_CACHE);
        cache.put(request.url,network.clone()).catch(()=>{});
      }
      return network;
    })());
    return;
  }

  if(request.headers.get('X-GE-Reload')==='1'){
    event.respondWith((async()=>{
      const network=await fetch(request,{cache:'no-store'});
      if(network.ok){
        const cache=await caches.open(SHELL_CACHE);
        cache.put(request,network.clone()).catch(()=>{});
      }
      return network;
    })());
    return;
  }
  if(request.mode==='navigate'){
    event.respondWith(navigationResponse(request));
    return;
  }
  if(isMedia(request)){
    event.respondWith(mediaResponse(request));
    return;
  }
  event.respondWith(staticResponse(request));
});
