/* GE Studios offline library: device-local, manifest-driven, preserves Radio caches. */
(function(){
'use strict';
const ROOT=new URL('./',location.href), CACHE='GE_SHARED_OFFLINE_V2';
const CORE=['./','index.html','sw.js','manifest.webmanifest','config/site-live.json',
 'ge-vault-client.js','ge-dream.js','ge-accessibility.js','ge-accessibility.css',
 'radio/','radio/index.html','radio/offline-player.html','radio/sw.js','radio/website-live.js','radio/ge-home-gate-stop.js',
 'radio/ge-music-v5.js','radio/ge-purchase-demo.js','radio/manifest.json',
 'radio/ge-gate-audio.js','radio/ge-gate-settings.js','radio/iam-private-studio.js',
 'radio/track-durations.json','radio/loudness.json','radio/manifest.webmanifest',
 'ge-images/img/manifest.json','ge-offline-library.js',
 'radio/cockpit-landscape.png','ge-images/images/ge-logo-2.jpg'];
const ALBUMS=['Aether','Fire','Spirit','Soul','Love','Intergy','Sessions II','Sessions I','Live','Trio','Fundamental Groove','Singles'];
const cover=name=>'ge-images/images/Grand Element - '+name+'.jpg';
const status=()=>document.getElementById('offlinePanelStatus');
const count=()=>document.getElementById('offlineCount');
const bar=()=>document.getElementById('offlineProgress');
const say=s=>{if(status())status().textContent=s;const about=document.getElementById('offlineAboutStatus');if(about)about.textContent=s;};
const fullButton=()=>document.getElementById('offlineDownloadBtn');
let downloading=false;
function localPath(value,root=ROOT){
 try{
  const url=new URL(value,root);
  return url.origin===ROOT.origin&&url.pathname.startsWith(ROOT.pathname)?url.href:null;
 }catch(_){return null;}
}
function add(set,value,root){const u=localPath(value,root);if(u)set.add(u);}
async function discover(){
 const critical=new Set(), visual=new Set(), audio=new Set();
 CORE.forEach(p=>add(critical,p));
 ALBUMS.forEach(p=>add(visual,cover(p)));
 // Site artwork and dynamic CSS background URLs, including game canvases.
 const resources=[ROOT.href,new URL('radio/index.html',ROOT).href];
 for(const url of resources){
  try{
   const r=await fetch(url,{cache:'no-store'});
   if(!r.ok)continue;
   const html=await r.text();
   for(const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"'#]+)["']/gi))add(visual,m[1],url);
   for(const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi))add(visual,m[1],url);
   for(const m of html.matchAll(/["']((?:ge-images|radio\/icons|icons)\/[^"']+\.(?:png|jpe?g|webp|gif|svg))["']/gi))add(visual,m[1],url);
  }catch(_){}
 }
 try{
  const r=await fetch(new URL('ge-images/img/manifest.json',ROOT),{cache:'no-store'});
  if(r.ok){const data=await r.json();if(Array.isArray(data))data.forEach(f=>add(visual,f,new URL('ge-images/img/',ROOT)));}
 }catch(_){}
 try{
  const r=await fetch(new URL('radio/manifest.json',ROOT),{cache:'no-store'});
  if(r.ok){
   const data=await r.json();
   const files=Array.isArray(data)?data:(data.files||[]);
   for(const f of files){
    if(typeof f!=='string')continue;
    if(/\.(mp3|m4a|aac|wav|ogg|flac)(\?|$)/i.test(f))add(audio,f);
    else if(/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(f))add(visual,f);
   }
  }
 }catch(_){}
 // The website's existing images and file references are additional sources.
 document.querySelectorAll('img[src],script[src],source[src],audio[src],link[href]').forEach(el=>{
  const path=el.getAttribute('src')||el.getAttribute('href');
  if(path)add(visual,path);
 });
 // Never download owner-only pages or third-party streams.
 const safe=set=>[...set].filter(u=>!new URL(u).pathname.slice(ROOT.pathname.length).startsWith('backroom/'));
 return {critical:safe(critical),visual:safe(visual),audio:safe(audio)};
}
async function save(url,cache){
 const req=new Request(url,{credentials:'same-origin'});
 if(await cache.match(req,{ignoreSearch:true}))return 'cached';
 const r=await fetch(req,{cache:'no-store'});
 if(!r.ok||r.type==='opaque')throw new Error('HTTP '+r.status);
 const mime=r.headers.get('content-type')||'';
 if(mime.includes('text/html')&&!/\/(?:index\.html)?$/i.test(new URL(url).pathname)&&!new URL(url).pathname.endsWith('/')){
  throw new Error('Unexpected HTML instead of asset');
 }
 // Cache Storage streams large recordings without building an extra JS Blob.
 await cache.put(req,r);
 return 'saved';
}
async function run(){
 if(downloading||!navigator.onLine)return;
 downloading=true;const btn=fullButton();if(btn)btn.disabled=true;
 let done=0,fail=0,skipped=0;
 try{
  if(!('caches' in window)){say('This browser does not support offline file storage.');return;}
  say('Automatically scanning website, artwork and music folders…');
  await navigator.serviceWorker?.register(new URL('sw.js',ROOT).href,{scope:ROOT.pathname});
  const groups=await discover();
  const urls=[...new Set([...groups.critical,...groups.visual,...groups.audio])];
  const cache=await caches.open(CACHE);
  const errors=[];
  for(let i=0;i<urls.length;i++){
   const url=urls[i];
   try{
    const estimate=await navigator.storage?.estimate?.();
    if(estimate?.quota&&estimate.usage/estimate.quota>0.88){
     skipped=urls.length-i;errors.push('Device storage limit reached');break;
    }
    await save(url,cache);done++;
   }catch(e){fail++;if(errors.length<5)errors.push(new URL(url).pathname+': '+String(e.message||e));}
   if(bar())bar().style.width=Math.round((i+1)/urls.length*100)+'%';
   if(count())count().textContent=(i+1)+'/'+urls.length+' checked · '+done+' available · '+fail+' failed';
   if(i%8===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  const required=groups.critical.filter(u=>!/\/$/.test(new URL(u).pathname));
  const missing=[];
  for(const url of required){if(!await cache.match(url,{ignoreSearch:true})&&!await caches.match(url,{ignoreSearch:true}))missing.push(url);}
  if(!missing.length){
   try{localStorage.setItem('GE_OFFLINE_READY','1')}catch(_){}
   say('OFFLINE SITE READY · '+done+' files saved/available, '+fail+' failed, '+skipped+' not downloaded. Live radio and online services still require internet.');
  }else{
   try{localStorage.removeItem('GE_OFFLINE_READY')}catch(_){}
   say('OFFLINE INCOMPLETE · '+missing.length+' essential files missing. '+done+' saved/available; '+fail+' failed. Reconnect and retry.');
  }
  if(errors.length)console.warn('GE offline missing assets',errors);
 }catch(e){say('Offline download interrupted: '+String(e.message||e));}
 finally{downloading=false;if(btn)btn.disabled=false;}
}
function intercept(){
 const btn=fullButton();
 if(btn){
  btn.textContent='DOWNLOAD FULL SITE + ART + MUSIC';
  btn.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();void run();},true);
 }
}
function init(){
 intercept();
 if(navigator.onLine){
  // Automatically prepare the compact critical site shell. Full music needs
  // the explicit download button because mobile storage may be limited.
  navigator.serviceWorker?.register(new URL('sw.js',ROOT).href,{scope:ROOT.pathname}).catch(()=>{});
 }
 window.GEOfflineLibrary={downloadAll:run,discover:discover};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();