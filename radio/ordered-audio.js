/* One bounded transient next-recording buffer for ordered playback.
   No second player, permanent download, crossfade or recording modification.
   Native decoder switching may still introduce a gap. */
(()=>{
'use strict';
const MAX_BYTES=24*1024*1024,LEAD_SECONDS=45;
// Owner-confirmed continuous transitions; exact catalog paths, not fuzzy titles.
const AETHER='ge-music/music/Grand Element - 2026 - Aether/';
const INTERGY='ge-music/music/Grand Element - 2010 - Intergy/';
const IMMEDIATE=new Map([
 [AETHER+'Aether_01-The Journey I.mp3',AETHER+'Aether_01-The Journey II.mp3'],
 [AETHER+'Aether_01-The Journey II.mp3',AETHER+'Aether_01-The Journey III.mp3'],
 [INTERGY+'Intergy_02_Intergy.mp3',INTERGY+'Intergy_03_Amuse.mp3'],
 [INTERGY+'Intergy_06_You Cant Change Me.mp3',INTERGY+'Intergy_07_Selfishteem.mp3']
]);
function catalogPath(url){
 try{const path=decodeURIComponent(new URL(url,location.href).pathname);
  const at=path.indexOf('/ge-music/music/');return at>=0?path.slice(at+1):''}
 catch(_){return ''}
}
function immediate(from,to){const next=IMMEDIATE.get(catalogPath(from));return !!next&&next===catalogPath(to)}
function create(audio,nextURL){
 let pending=null,active=null;
 const canonical=url=>{try{if(!url)return '';const u=new URL(url,location.href);return u.origin===location.origin&&/\/ge-music\/music\/.*\.(?:mp3|m4a|wav|ogg)$/i.test(u.pathname)?u.href:''}catch(_){return ''}};
 function indicator(value){
  if(!audio.dataset||audio.dataset.geNextTrackState===value)return;
  audio.dataset.geNextTrackState=value;
  if(typeof audio.dispatchEvent==='function')audio.dispatchEvent(new Event('ge-next-track-state'));
 }
 function clear(){if(pending){pending.controller.abort();pending=null}indicator('')}
 function release(){if(active){URL.revokeObjectURL(active.objectURL);active=null}}
 function actual(){return audio.getAttribute('src')||audio.currentSrc||''}
 function source(){return active&&actual()===active.objectURL?active.url:actual()}
 function prepare(){
  const url=canonical(nextURL());
  if(!url||url===source()){clear();return}
  const priority=immediate(source(),url);
  if(pending&&pending.url!==url)clear();
  if(audio.paused||audio.ended||(!priority&&(!Number.isFinite(audio.duration)||audio.duration-audio.currentTime>LEAD_SECONDS)))return;
  if(pending?.url===url)return;
  clear();
  const item={url,controller:new AbortController(),blob:null,priority};pending=item;
  if(priority)indicator('preparing');
  void (async()=>{
   try{
    const response=await fetch(url,{cache:'no-store',signal:item.controller.signal});
    const length=Number(response.headers.get('content-length'));
    if(!response.ok||response.status!==200||/text\/|json|image\/|video\//i.test(response.headers.get('content-type')||'')||length>MAX_BYTES)throw Error('Not a bounded full recording');
    const reader=response.body?.getReader?.();if(!reader)return;
    const chunks=[];let total=0;
    try{
     while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;
      if(total>MAX_BYTES){await reader.cancel();throw Error('Recording exceeds buffer limit')}chunks.push(value)}
    }finally{reader.releaseLock()}
    if(total<=128)throw Error('Incomplete recording');
    if(pending===item){item.blob=new Blob(chunks,{type:response.headers.get('content-type')||'audio/mpeg'});if(item.priority)indicator('ready')}
   }catch(_){if(pending===item&&item.priority)indicator('unavailable');/* Keep native fallback. */}
  })();
 }
 function select(url,{ordered=true,force=false}={}){
  const key=canonical(url),item=pending;
  const blob=ordered&&!force&&key&&item?.url===key?item.blob:null;
  clear();release();
  if(!blob)return url;
  try{const objectURL=URL.createObjectURL(blob);active={url:key,objectURL};return objectURL}catch(_){return url}
 }
 audio.addEventListener('timeupdate',prepare);
 audio.addEventListener('playing',prepare);
 audio.addEventListener('loadstart',()=>{if(active&&actual()!==active.objectURL)release();clear()});
 window.addEventListener('pagehide',event=>{clear();if(!event.persisted)release()});
 return {prepare,select,clear,source};
}
window.GEOrderedAudio={create,immediate};
})();
