/* Grand Element Radio service worker */
'use strict';

const VERSION='2026.09.11-radio-offline-shell-7';
const SHELL_CACHE=`ge-radio-shell-${VERSION}`;
const MEDIA_CACHE='ge-radio-media-v4'; // preserve the listener's existing downloaded music

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
  './cockpit-landscape.png',
  '../ge-images/images/ge-logo-2.jpg',
  '../ge-images/img/31.gif',
  './manifest.json',
  '../ge-images/img/manifest.json'
];

async function fetchFresh(requestOrURL){
  return fetch(requestOrURL,{cache:'no-store'});
}

async function putShell(requestOrURL,response){
  if(!response || !response.ok) return;
  const cache=await caches.open(SHELL_CACHE);
  await cache.put(requestOrURL,response.clone());
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL_CACHE);

    // index.html is critical. Do not report a successful service-worker install
    // unless the actual radio page itself is available offline.
    const indexResponse=await fetch('./index.html',{cache:'reload'});
    if(!indexResponse.ok) throw new Error(`index.html ${indexResponse.status}`);
    await cache.put('./index.html',indexResponse.clone());
    await cache.put('./',indexResponse.clone());

    // The remaining shell files are useful but one missing icon must not block
    // the radio from becoming usable offline.
    const optional=SHELL.filter(url=>url!=='./' && url!=='./index.html');
    await Promise.allSettled(optional.map(async url=>{
      const response=await fetch(url,{cache:'reload'});
      if(response.ok) await cache.put(url,response.clone());
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(
      names
        .filter(name=>name.startsWith('ge-radio-shell-') && name!==SHELL_CACHE)
        .map(name=>caches.delete(name))
    );
    await self.clients.claim();
  })());
});

function isMedia(request){
  const url=new URL(request.url);
  return request.destination==='audio' || request.destination==='image' || /\.(mp3|m4a|ogg|wav|gif|png|jpe?g|webp)$/i.test(url.pathname);
}

async function cachedResponse(request){
  return (await caches.match(request,{ignoreSearch:true})) ||
         (await caches.match(request.url,{ignoreSearch:true}));
}

async function rangeFromCache(request,response){
  const range=request.headers.get('range');
  if(!range || !response) return response;
  const match=/bytes=(\d+)-(\d+)?/.exec(range);
  if(!match) return response;

  const buffer=await response.arrayBuffer();
  const start=Number(match[1]);
  const end=match[2] ? Math.min(Number(match[2]),buffer.byteLength-1) : buffer.byteLength-1;
  if(start>=buffer.byteLength || end<start){
    return new Response(null,{status:416,headers:{'Content-Range':`bytes */${buffer.byteLength}`}});
  }

  const headers=new Headers(response.headers);
  headers.set('Content-Range',`bytes ${start}-${end}/${buffer.byteLength}`);
  headers.set('Accept-Ranges','bytes');
  headers.set('Content-Length',String(end-start+1));
  return new Response(buffer.slice(start,end+1),{status:206,statusText:'Partial Content',headers});
}

async function offlineNavigationFallback(){
  const shell=await caches.open(SHELL_CACHE);
  return (await shell.match('./index.html',{ignoreSearch:true})) ||
         (await shell.match('./',{ignoreSearch:true})) ||
         (await caches.match('./index.html',{ignoreSearch:true})) ||
         (await caches.match('./',{ignoreSearch:true})) ||
         new Response('Grand Element Radio is not downloaded yet.',{
           status:503,
           headers:{'Content-Type':'text/plain;charset=utf-8'}
         });
}

async function navigationResponse(request){
  // A dead cellular connection can take a long time to reject. Give the network
  // a short chance, then open the cached radio instead of leaving Android Home
  // Screen / car mode sitting on a blank page.
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),3500);
  try{
    const network=await fetch(request,{cache:'no-store',signal:controller.signal});
    clearTimeout(timeout);
    if(network.ok){
      const cache=await caches.open(SHELL_CACHE);
      await cache.put('./index.html',network.clone()).catch(()=>{});
      await cache.put('./',network.clone()).catch(()=>{});
    }
    return network;
  }catch(_error){
    clearTimeout(timeout);
    return offlineNavigationFallback();
  }
}

async function mediaResponse(request){
  const url=new URL(request.url);
  const versioned=url.searchParams.has('v');

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
    fetch(request,{cache:'no-store'}).then(async response=>{
      if(response.ok){
        const cache=await caches.open(SHELL_CACHE);
        cache.put(request,response.clone()).catch(()=>{});
      }
    }).catch(()=>{});
    return cached;
  }

  const response=await fetch(request);
  if(response.ok){
    const cache=await caches.open(SHELL_CACHE);
    cache.put(request,response.clone()).catch(()=>{});
  }
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  if(request.headers.get('X-GE-Offline')==='1'){
    event.respondWith(fetchFresh(request));
    return;
  }

  if(request.headers.get('X-GE-Reload-Media')==='1'){
    event.respondWith((async()=>{
      const network=await fetchFresh(request);
      if(network.ok && network.status===200){
        const cache=await caches.open(MEDIA_CACHE);
        await cache.put(request.url,network.clone()).catch(()=>{});
      }
      return network;
    })());
    return;
  }

  // Reload Library uses this header. It must bypass stale shell responses and
  // replace the template while leaving ge-radio-media-v4 (downloaded music) intact.
  if(request.headers.get('X-GE-Template-Reload')==='1' || request.headers.get('X-GE-Reload')==='1'){
    event.respondWith((async()=>{
      const network=await fetchFresh(request);
      if(network.ok){
        const shell=await caches.open(SHELL_CACHE);
        const media=await caches.open(MEDIA_CACHE);
        await Promise.allSettled([
          shell.put(request.url,network.clone()),
          media.put(request.url,network.clone())
        ]);
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
