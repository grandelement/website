/* Grand Element Radio: true frequency bins from the SAME native player
   and SAME Web Audio graph used for Gate and reverb. No prerecorded mapping,
   second HTMLAudioElement, or second MediaElementAudioSourceNode. */
(()=>{
'use strict';
const EQ_BUILD='20261127-radio53-eq-v4';
const FFT_SIZE=2048;
const GE_IS_IOS=/iPad|iPhone|iPod/i.test(navigator.userAgent)||
  (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const GE_IOS_PREVIEW=new URLSearchParams(location.search).get('eq_preview')==='1';
// Default ON for every listener. Only an explicit OFF survives reloads.
const EQ_OFF_KEY='GE_SUN_EQ_EXPLICIT_OFF_V1';
let enabled=true,lastError='',lastSignal=0;
try{enabled=localStorage.getItem(EQ_OFF_KEY)!=='1';}catch(_){}
const bins=new Uint8Array(256);
const element=()=>document.getElementById('player');
function localSong(){
  const audio=element();
  if(!audio)return false;
  const src=audio.getAttribute('src')||audio.currentSrc||'';
  if(!src)return true;
  try{
    const url=new URL(src,location.href);
    return url.origin===location.origin &&
      /\/ge-music\/music\/.*\.(mp3|m4a|ogg|wav)$/i.test(url.pathname);
  }catch(_){return false;}
}
function arm(){
  if(!enabled)return false;
  if(!localSong())return false;
  const gate=window.GEAudioGain;
  if(!gate?.arm||!gate?.getSpectrumFrame){
    lastError='Shared native audio analyzer unavailable';
    return false;
  }
  const armed=gate.arm();
  const status=gate.getStatus?.();
  if(!armed||!status?.spectrumReady){
    lastError=String(status?.spectrumError||status?.lastError||'Audio FFT unavailable');
    return false;
  }
  lastError='';
  return true;
}
function read(){
  const audio=element();
  if(!audio||audio.paused||audio.ended||document.hidden||!localSong()||
     !enabled)return null;
  const frame=window.GEAudioGain?.getSpectrumFrame?.();
  if(!frame?.bins?.length)return null;
  const raw=frame.bins;
  const fftSize=Number(frame.fftSize)||FFT_SIZE;
  const sampleRate=Number(frame.sampleRate)||44100;
  const resolution=sampleRate/fftSize;
  const ceiling=Math.min(16000,sampleRate/2);
  for(let i=0;i<bins.length;i++){
    const lower=32*Math.pow(ceiling/32,i/bins.length);
    const upper=32*Math.pow(ceiling/32,(i+1)/bins.length);
    const lo=Math.min(raw.length-1,Math.max(0,Math.floor(lower/resolution)));
    const hi=Math.min(raw.length,Math.max(lo+1,Math.ceil(upper/resolution)));
    let total=0,peak=0;
    for(let j=lo;j<hi;j++){const value=raw[j];total+=value;peak=Math.max(peak,value);}
    bins[i]=Math.round(total/(hi-lo)*.65+peak*.35);
  }
  if(!bins.some(value=>value>1))return null;
  lastSignal=performance.now();
  return bins;
}
function status(){
  const graph=window.GEAudioGain?.getStatus?.();
  return {
    mode:graph?.spectrumReady?'gate-shared':'none',
    context:graph?.contextState||'off',
    live:lastSignal>0&&performance.now()-lastSignal<1500,
    iosPreview:GE_IOS_PREVIEW,
    iosEnabled:enabled,enabled,
    error:lastError||graph?.spectrumError||''
  };
}
function showEnableControl(){
  for(const id of ['sunLabBtn','shipSunLabBtn']){
    const button=document.getElementById(id);
    if(!button)continue;
    button.setAttribute('aria-pressed',String(enabled));
    button.setAttribute('aria-label','Open EQ Effects — '+(enabled?'effects on':'effects off'));
  }
}
function setEnabled(value){
  enabled=!!value;
  try{localStorage.setItem(EQ_OFF_KEY,enabled?'0':'1');}catch(_){}
  lastError='';lastSignal=0;showEnableControl();
  if(enabled){arm();window.GEResumeLiveEQ?.();}
  else window.GEStopEQTapIfUnused?.();
  return enabled;
}
function enable(){return setEnabled(true);}
const triggers='#liveBtn,#playBtn,#shipPlay,#shipLive,#shipStage [data-proxy="liveBtn"],#sunLabBtn,#shipSunLabBtn,.sunlab-modebtn,#trackList';
document.addEventListener('click',event=>{
  if(enabled&&event.isTrusted&&event.target?.closest?.(triggers))arm();
},true);
function recover(){
  const audio=element();
  if(!enabled||document.hidden||!audio||audio.paused||audio.ended)return;
  // Resume the existing graph; never create a competing audio element.
  const graph=window.GEAudioGain?.getStatus?.();
  if(localSong()&&(!graph?.spectrumReady||graph.contextState!=='running'))arm();
  if(!localSong())window.GEResumeLiveEQ?.();
}
showEnableControl();
for(const event of ['play','playing','loadeddata','seeked','canplay'])element()?.addEventListener(event,recover);
document.addEventListener('visibilitychange',recover);
window.addEventListener('pageshow',recover);
window.addEventListener('focus',recover);
setInterval(recover,1500);
window.GELiveAudioEQ={build:EQ_BUILD,arm,enable,setEnabled,isEnabled:()=>enabled,read,status};
window.addEventListener('online',recover);
recover();
})();