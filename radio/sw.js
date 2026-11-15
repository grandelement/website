/* Grand Element Radio service worker */
'use strict';

const VERSION='2026.11.15-offline-recovery-v116';
const UI_MARKER='GE_RADIO_UI_BUILD_20261115_OFFLINE_READY_V2';
const SHELL_CACHE=`ge-radio-shell-${VERSION}`;
const MEDIA_CACHE='ge-radio-media-v4'; // preserve the listener's existing downloaded music

const SHELL=[
  './',
  './index.html',
  './preview-lab.html',
  './offline-home.html',
  '../playlists/registry.json',
  './ge-music-v5.js',
  './offline-manager.js',
  './offline-spectrum.js',
  './offline-control.js',
  './ge-purchase-demo.js',
  '../ge-vault-client.js',
  '../ge-accessibility.js',
  '../ge-accessibility.css',
  './track-durations.json',
  './loudness.json',
  './manifest.json',
  './iam-private-studio.js',
  './ge-gate-audio.js',
  './ge-gate-settings.js',
  './manifest.webmanifest',
  './favicon.ico',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './cockpit-landscape.png',
  './cockpit-landscape.png?v=20260930-heartbeat-steering-1',
  '../ge-images/images/ge-logo-2.jpg',
  '../ge-images/img/31.gif',
  './manifest.json',
  '../config/site-live.json',
  './loudness.json',
  '../ge-images/img/manifest.json',
  // Album artwork is optional for service-worker installation, but should
  // be ready when MUSIC is opened offline after a full download.
  ...['Aether','Fire','Spirit','Soul','Love','Intergy','Sessions II','Sessions I','Live','Trio','Fundamental Groove','Singles']
    .map(name=>'../ge-images/images/Grand Element - '+encodeURIComponent(name)+'.jpg')
];

// A new offline worker must never replace the existing worker unless all
// essential pages, scripts, styles, and local catalogs are stored.
const REQUIRED_SHELL=[
  './offline-home.html','./ge-music-v5.js','./offline-manager.js','./offline-spectrum.js','./offline-control.js',
  './manifest.json','./iam-private-studio.js','./ge-gate-audio.js',
  './ge-gate-settings.js','./ge-purchase-demo.js',
  '../ge-vault-client.js','../ge-accessibility.js','../ge-accessibility.css',
  '../config/site-live.json','../playlists/registry.json'
];

async function fetchFresh(requestOrURL){
  return fetch(requestOrURL,{cache:'no-store'});
}
// Safari may misreport online state after Airplane Mode. Bound recovery fetches.
async function fetchWithTimeout(requestOrURL,options={},timeoutMs=3500){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(requestOrURL,{...options,signal:controller.signal})}
  finally{clearTimeout(timeout)}
}

async function isValidRadioHTML(response,{requireCurrent=false}={}){
  if(!response || !response.ok) return false;
  try{
    const text=await response.clone().text();
    const head=text.slice(0,24000).toLowerCase();
    return head.includes('<!doctype html') &&
           head.includes('<title>grand element radio</title>') &&
           text.includes('id="shipStage"') &&
           text.includes('id="player"') &&
           (!requireCurrent || text.includes(UI_MARKER));
  }catch(_e){
    return false;
  }
}

async function fetchValidatedIndex(tag='recovery'){
  const url=new URL('./index.html',self.location.href);
  url.searchParams.set('_ge_'+tag,VERSION+'-'+Date.now());
  const response=await fetchWithTimeout(url.href,{cache:'no-store'},tag==='install'?20000:3500);
  if(!(await isValidRadioHTML(response,{requireCurrent:true}))) throw new Error('Radio UI build is outdated or incomplete');
  return response;
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
    const indexResponse=await fetchValidatedIndex('install');
    await cache.put('./index.html',indexResponse.clone());
    await cache.put('./',indexResponse.clone());

    // Required shell assets are atomic. If one is missing, keep the prior
    // installed worker and its existing caches rather than claiming readiness.
    await Promise.all(REQUIRED_SHELL.map(async url=>{
      const response=await fetch(url,{cache:'reload'});
      if(!response.ok) throw new Error('Offline engine missing: '+url);
      await cache.put(url,response.clone());
    }));

    // Decorative assets are optional; never block a valid offline engine.
    const required=new Set(['./','./index.html',...REQUIRED_SHELL]);
    const optional=SHELL.filter(url=>!required.has(url));
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
    // Preserve the most recent previous shell as a recovery copy. Audio and
    // artwork caches are not touched. Never erase every known working startup.
    const previous=names.filter(name=>name.startsWith('ge-radio-shell-')&&name!==SHELL_CACHE);
    const keepPrevious=previous.at(-1);
    await Promise.all(previous.filter(name=>name!==keepPrevious).map(name=>caches.delete(name)));
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

  // Blob.slice serves only the requested range without constructing a second
  // full-song ArrayBuffer in the service-worker JavaScript heap on iPhones.
  const blob=await response.blob();
  const total=blob.size;
  const start=Number(match[1]);
  const end=match[2] ? Math.min(Number(match[2]),total-1) : total-1;
  if(start>=total || end<start){
    return new Response(null,{status:416,headers:{'Content-Range':`bytes */${total}`}});
  }

  const headers=new Headers(response.headers);
  headers.set('Content-Range',`bytes ${start}-${end}/${total}`);
  headers.set('Accept-Ranges','bytes');
  headers.set('Content-Length',String(end-start+1));
  return new Response(blob.slice(start,end+1),{status:206,statusText:'Partial Content',headers});
}

async function offlineNavigationFallback(){
  const shell=await caches.open(SHELL_CACHE);
  const candidates=[
    await shell.match('./index.html',{ignoreSearch:true}),
    await shell.match('./',{ignoreSearch:true}),
    await caches.match('./index.html',{ignoreSearch:true}),
    await caches.match('./',{ignoreSearch:true})
  ];
  for(const candidate of candidates){
    if(candidate && await isValidRadioHTML(candidate)) return candidate;
  }
  return new Response('Grand Element Radio needs to be opened once online to repair its offline app.',{
    status:503,
    headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}
  });
}

async function secondaryPageNavigationResponse(request){
  // Offline must not attempt the network before using an already saved page.
  if(self.navigator?.onLine===false){
    return (await cachedResponse(request)) ||
      new Response('This page has not been saved offline',{status:503});
  }
  // Preview Lab and other Radio HTML pages must not be validated against the
  // main Radio index markup. The old handler replaced them with index.html.
  try{
    const response=await fetchWithTimeout(request,{cache:'no-store'});
    if(response.ok && /text\/html/i.test(response.headers.get('content-type')||'')){
      const cache=await caches.open(SHELL_CACHE);
      await cache.put(request,response.clone()).catch(()=>{});
    }
    return response;
  }catch(_error){
    const cached=await cachedResponse(request);
    if(cached)return cached;
    return new Response('Music selection is unavailable offline until opened online.',{
      status:503,
      headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}
    });
  }
}

async function navigationResponse(request){
  const path=new URL(request.url).pathname;
  // Installed Home Screen entry stays cache-first. It must never wait for
  // the server when Safari relaunches this app with no connection.
  if(path.endsWith('/radio/offline-home.html')){
    const shell=await caches.open(SHELL_CACHE);
    const saved=await shell.match('./offline-home.html',{ignoreSearch:true}) ||
      await caches.match('./offline-home.html',{ignoreSearch:true});
    if(saved?.ok)return saved;
    return secondaryPageNavigationResponse(request);
  }
  // The Home Screen entry opens the last known-good player immediately;
  // RELOAD/UPDATE performs its own network refresh afterward.
  if(new URL(request.url).searchParams.has('ge_home')){
    const saved=await offlineNavigationFallback();
    if(saved?.ok)return saved;
  }
  // Only the home page can use the strict Grand Element Radio index validator.
  // The separate music/preview page is a legitimate HTML document.
  if(!path.endsWith('/radio/') && !path.endsWith('/radio/index.html')){
    return secondaryPageNavigationResponse(request);
  }
  // Cold start in Airplane Mode: serve the installed app immediately.
  if(self.navigator?.onLine===false)return offlineNavigationFallback();
  // Network first, but never cache or display a poisoned/plain-text index.html.
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),3500);
  try{
    const network=await fetch(request,{cache:'no-store',signal:controller.signal});
    clearTimeout(timeout);
    if(await isValidRadioHTML(network,{requireCurrent:true})){
      const cache=await caches.open(SHELL_CACHE);
      await cache.put('./index.html',network.clone()).catch(()=>{});
      await cache.put('./',network.clone()).catch(()=>{});
      return network;
    }

    // The CDN/browser may still have an old poisoned HTML body. Retry index.html
    // with a unique recovery query before falling back to offline storage.
    try{
      const recovery=await fetchValidatedIndex('nav');
      const cache=await caches.open(SHELL_CACHE);
      await cache.put('./index.html',recovery.clone()).catch(()=>{});
      await cache.put('./',recovery.clone()).catch(()=>{});
      return recovery;
    }catch(_e){}

    return offlineNavigationFallback();
  }catch(_error){
    clearTimeout(timeout);
    try{
      const recovery=await fetchValidatedIndex('timeout');
      const cache=await caches.open(SHELL_CACHE);
      await cache.put('./index.html',recovery.clone()).catch(()=>{});
      await cache.put('./',recovery.clone()).catch(()=>{});
      return recovery;
    }catch(_e){}
    return offlineNavigationFallback();
  }
}

async function mediaResponse(request){
  const url=new URL(request.url);
  // Saved audio explicitly requests local-first, even if Safari reports online.
  if(self.navigator?.onLine===false||url.searchParams.has('ge_offline')){
    const local=await cachedResponse(request);
    return local?rangeFromCache(request,local):
      new Response('This audio file was not saved',{status:503});
  }
  // Same-path song replacements must win while ONLINE. The earlier
  // cache-first path kept playing obsolete recordings after an upload.
  // Offline still falls back to the listener's existing saved music.
  try{
    const fresh=await fetchWithTimeout(request,{cache:'no-store'});
    if(fresh.ok){
      if(fresh.status===200 && request.method==='GET' &&
         /^\/ge-music\/(?:music|clips)\//i.test(url.pathname)){
        // Save audio, not every decorative JPG/GIF. Radio visuals can otherwise
        // fill the browser cache before deliberate offline music downloads.
        const cache=await caches.open(MEDIA_CACHE);
        cache.put(request.url,fresh.clone()).catch(()=>{});
      }
      return fresh;
    }
  }catch(_e){}
  const cached=url.searchParams.has('v')
    ? (await caches.match(request,{ignoreSearch:false}))
    : await cachedResponse(request);
  if(cached)return rangeFromCache(request,cached);
  return new Response('Media not available without a connection',{status:503});
}

async function staticResponse(request){
  if(self.navigator?.onLine===false){
    return (await cachedResponse(request)) ||
      new Response('This app file was not saved',{status:503});
  }
  // Always fetch the studio engine freshly, even when a versioned URL was
  // previously cached with ignoreSearch:true.
  if(new URL(request.url).pathname.endsWith('/iam-private-studio.js')){
    try{
      const fresh=await fetchWithTimeout(request,{cache:'no-store'});
      if(fresh.ok){
        const cache=await caches.open(SHELL_CACHE);
        cache.put(request,fresh.clone()).catch(()=>{});
        return fresh;
      }
    }catch(_e){}
  }
  // UI architecture must update whenever online; cached UI is an
  // offline fallback only. Audio downloads stay in MEDIA_CACHE.
  try{
    const response=await fetchWithTimeout(request,{cache:'no-store'});
    if(response.ok){
      const cache=await caches.open(SHELL_CACHE);
      await cache.put(request,response.clone()).catch(()=>{});
      return response;
    }
    if(response.status!==503 && response.status!==504)return response;
  }catch(_e){}
  const cached=await cachedResponse(request);
  if(cached)return cached;
  return new Response('Radio app file unavailable offline',{status:503});
}

// MessageChannel readiness check never requires a live Vault or remote API.
self.addEventListener('message',event=>{
  if(event.data?.type!=='GE_RADIO_SHELL_STATUS')return;
  event.waitUntil((async()=>{
    const result={type:'GE_RADIO_SHELL_STATUS',version:VERSION,ready:false,missing:[]};
    try{
      const shell=await caches.open(SHELL_CACHE);
      for(const path of [...new Set(['./','./index.html','./offline-home.html',...REQUIRED_SHELL])]){
        const response=await shell.match(path,{ignoreSearch:true});
        if(!response?.ok){result.missing.push(path);continue;}
        if(path==='./index.html' && !(await isValidRadioHTML(response,{requireCurrent:true}))){
          result.missing.push(path+' (invalid Radio page)');
        }
      }
      result.ready=result.missing.length===0;
    }catch(error){result.missing.push(String(error?.message||error))}
    try{event.ports?.[0]?.postMessage(result)}catch(_){}
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET') return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  // Explicit OFFLINE downloads are stored once by the download manager.
  // Do not silently duplicate huge MP3s in the service-worker media cache.
  if(request.headers.get('X-GE-Offline-Download')==='1'){
    event.respondWith(fetchWithTimeout(request,{cache:'no-store'},60000));
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
        await shell.put(request.url,network.clone()).catch(()=>{});
      }
      return network;
    })());
    return;
  }

  if(request.mode==='navigate'){
    event.respondWith(navigationResponse(request));
    return;
  }

  // Shared UI assets MUST be network-first. Previously they were cache-first
  // with ignoreSearch:true, so iPhones could keep an old icon/layout stylesheet
  // despite a fresh HTML page and a new ?v= cache-busting URL.
  if(url.pathname==='/ge-accessibility.css' || url.pathname==='/ge-accessibility.js'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetchFresh(request);
        if(fresh.ok){
          const shell=await caches.open(SHELL_CACHE);
          await shell.put(request,fresh.clone()).catch(()=>{});
          return fresh;
        }
      }catch(_e){}
      return await cachedResponse(request) ||
        new Response('GE accessibility resource unavailable',{status:503});
    })());
    return;
  }

  // Song catalogs and published MUSIC playlists must be network-first,
  // so newly published selections appear without stale SW shell caches.
  if(/\/radio\/(?:manifest|track-durations)\.json$/i.test(url.pathname) || url.pathname==='/config/site-live.json'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetchFresh(request);
        if(fresh.ok){
          const shell=await caches.open(SHELL_CACHE);
          await shell.put(request,fresh.clone()).catch(()=>{});
          return fresh;
        }
      }catch(_e){}
      return await cachedResponse(request) || new Response('Music catalog unavailable',{status:503});
    })());
    return;
  }

  if(isMedia(request)){
    event.respondWith(mediaResponse(request));
    return;
  }

  event.respondWith(staticResponse(request));
});
