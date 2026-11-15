/* GE Radio local visualizer: analyse saved audio without attaching Web Audio to the iPhone player. */
(()=>{
'use strict';
const CACHE='ge-radio-spectrum-v1',STEP_LIMIT=1800,FFT_SIZE=512,BANDS=16;
let current='',snapshot=null,pending=new Map(),lastError='';
const canonical=url=>{try{const u=new URL(url,location.href);return u.origin===location.origin && /\/ge-music\/music\/.*\.(mp3|wav|m4a|ogg)$/i.test(u.pathname)?u.href:''}catch(_){return ''}};
const key=url=>new URL('./eq-snapshots/'+encodeURIComponent(new URL(url).pathname)+'.json',location.href).href;
function fft(r,im){
 const n=r.length;
 for(let i=1,j=0;i<n;i++){
  let bit=n>>1;
  for(;j&bit;bit>>=1)j^=bit;
  j^=bit;
  if(i<j){let t=r[i];r[i]=r[j];r[j]=t;t=im[i];im[i]=im[j];im[j]=t}
 }
 for(let size=2;size<=n;size<<=1){
  const angle=-2*Math.PI/size,cs=Math.cos(angle),sn=Math.sin(angle);
  for(let offset=0;offset<n;offset+=size){
   let wr=1,wi=0;
   for(let j=0;j<size/2;j++){
    const a=offset+j,b=a+size/2,vr=r[b]*wr-im[b]*wi,vi=r[b]*wi+im[b]*wr;
    r[b]=r[a]-vr;im[b]=im[a]-vi;r[a]+=vr;im[a]+=vi;
    const next=wr*cs-wi*sn;wi=wr*sn+wi*cs;wr=next;
   }
  }
 }
}
function delay(){return new Promise(resolve=>setTimeout(resolve,0))}
async function compute(decoded){
 const duration=decoded.duration;
 if(!Number.isFinite(duration)||duration<=0||duration>900)throw Error('Song too long for iPhone visual analysis');
 const sr=decoded.sampleRate,channels=decoded.numberOfChannels;
 const left=decoded.getChannelData(0),right=channels>1?decoded.getChannelData(1):null;
 const hop=Math.max(.20,duration/STEP_LIMIT);
 const count=Math.min(STEP_LIMIT,Math.ceil(duration/hop));
 const stride=sr/16000, hzPerBin=16000/FFT_SIZE;
 const windows=Array.from({length:BANDS},(_,j)=>{
  const low=55*Math.pow(7800/55,j/BANDS),high=55*Math.pow(7800/55,(j+1)/BANDS);
  return [Math.max(1,Math.floor(low/hzPerBin)),Math.min(FFT_SIZE/2-1,Math.max(2,Math.ceil(high/hzPerBin)))];
 });
 const win=Float32Array.from({length:FFT_SIZE},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(FFT_SIZE-1)));
 const r=new Float64Array(FFT_SIZE),im=new Float64Array(FFT_SIZE),rows=[],peaks=Array(BANDS).fill(.00001);
 for(let index=0;index<count;index++){
  const center=Math.floor((index+.5)*hop*sr),start=center-(FFT_SIZE*stride)/2;
  for(let i=0;i<FFT_SIZE;i++){
   const sample=Math.floor(start+i*stride),signal=sample>=0&&sample<left.length?((left[sample]+(right?right[sample]:left[sample]))*.5):0;
   r[i]=signal*win[i];im[i]=0;
  }
  fft(r,im);
  const row=[];
  for(let j=0;j<BANDS;j++){
   const [lo,hi]=windows[j];let sum=0;
   for(let k=lo;k<=hi;k++)sum+=r[k]*r[k]+im[k]*im[k];
   const v=Math.sqrt(sum/Math.max(1,hi-lo+1))/FFT_SIZE;
   row.push(v);peaks[j]=Math.max(peaks[j],v);
  }
  rows.push(row);
  if(index%24===0)await delay();
 }
 // Individual frequency bands use their real decoded amplitudes. No invented
 // periodic animation and no secondary iOS media element/audio output.
 const frames=rows.map(row=>row.map((v,j)=>Math.min(255,Math.round(255*Math.pow(v/peaks[j],.7)))));
 return {duration,hop,frames};
}
async function prepare(input){
 const url=canonical(input);if(!url)return false;
 if(current!==url){current=url;snapshot=null}
 if(snapshot)return true;
 if(pending.has(url))return pending.get(url);
 const task=(async()=>{
  try{
   const cache=await caches.open(CACHE),response=await cache.match(key(url));
   if(response?.ok){
    const saved=await response.json();
    if(saved?.frames?.length&&Number(saved.hop)>0){
     if(current===url)snapshot=saved;
     return true;
    }
   }
   // Fetches the song already saved by OFFLINE. It never taps or changes the
   // audible player, which must remain the sole media element on iPhone.
   const source=await fetch(url,{cache:'force-cache'});
   if(!source.ok)throw Error('Audio file unavailable for local analysis');
   const bytes=await source.arrayBuffer();
   if(bytes.byteLength>28*1024*1024)throw Error('Large recording: visual analysis unavailable');
   const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
   const Audio=window.AudioContext||window.webkitAudioContext;
   if(!Offline&&!Audio)throw Error('Local audio decoder unavailable');
   const context=Offline?new Offline(1,1,44100):new Audio();
   let decoded;
   try{decoded=await context.decodeAudioData(bytes)}
   finally{if(typeof context.close==='function')try{await context.close()}catch(_){}}
   const data=await compute(decoded);
   await cache.put(key(url),new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));
   if(current===url)snapshot=data;
   lastError='';
   return true;
  }catch(error){lastError=String(error?.message||error);return false}
  finally{pending.delete(url)}
 })();
 pending.set(url,task);return task;
}
function read(input,time){
 const url=canonical(input);
 if(url!==current||!snapshot?.frames?.length)return null;
 const i=Math.max(0,Math.min(snapshot.frames.length-1,Math.floor(Math.max(0,Number(time)||0)/snapshot.hop)));
 const bands=snapshot.frames[i],output=new Uint8Array(256);
 // Expand authentic measured bands to the existing 256-bin renderer layout.
 // LOW is 0–18%, MID 18–52%, HIGH 52–100% in the existing SUN LAB.
 for(let k=0;k<256;k++){
  const band=k<46?Math.floor(k/46*5):k<133?5+Math.floor((k-46)/87*6):11+Math.floor((k-133)/123*5);
  output[k]=bands[Math.min(BANDS-1,band)]||0;
 }
 return output;
}
window.GEOfflineSpectrum={prepare,read,getError:()=>lastError,isReady:url=>canonical(url)===current&&!!snapshot};
})();
