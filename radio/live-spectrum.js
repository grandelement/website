/* GE Radio: real-time FFT of the actual native player, without prerecorded song maps.
   Prefer captureStream() so playback stays native. Safari fallback uses the SAME
   media element (one audio session), routed once through a transparent Web Audio
   destination. Never use a second HTMLAudioElement or alter the station URL. */
(()=>{
'use strict';
const FFT_SIZE=2048;
// Safari can reroute native media audio when attached to an AudioContext.
// Enable it only in an explicitly requested iPhone preview. Normal iPhone
// Radio listening stays untouched until this is validated on a real device.
const GE_IS_IOS=/iPad|iPhone|iPod/i.test(navigator.userAgent)||
  (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const GE_IOS_PREVIEW=new URLSearchParams(location.search).get('eq_preview')==='1';
let geIOSLiveOptIn=GE_IOS_PREVIEW;
let context=null,analyser=null,source=null,sourceKind='none',lastError='',lastSignal=0;
let track=null,graphReady=false,setupPending=false;
let bins=new Uint8Array(256),rawBins=new Uint8Array(FFT_SIZE/2);
const element=()=>document.getElementById('audio');
const AC=()=>window.AudioContext||window.webkitAudioContext;
function localSong(){
  const audio=element();
  if(!audio)return false;
  const src=audio.currentSrc||audio.src||'';
  // Empty on the first RADIO tap: the selected Bangers track loads asynchronously.
  if(!src)return true;
  try{
    const url=new URL(src,location.href);
    return url.origin===location.origin && /\/ge-music\/music\/.*\.(mp3|m4a|ogg|wav)$/i.test(url.pathname);
  }catch(_){return false}
}
function start(){
  if(graphReady)return true;
  if(setupPending)return false;
  const audio=element(),AudioContextCtor=AC();
  if(!audio||!AudioContextCtor||!localSong())return false;
  setupPending=true;
  try{
    context=new AudioContextCtor();
    analyser=context.createAnalyser();
    analyser.fftSize=FFT_SIZE;
    analyser.smoothingTimeConstant=.25;
    analyser.minDecibels=-95;
    analyser.maxDecibels=-24;
    rawBins=new Uint8Array(analyser.frequencyBinCount);
    // Chromium and Firefox can inspect media output without rerouting speakers.
    // Capture streams sometimes expose no track before playback begins.
    const capture=audio.captureStream||audio.mozCaptureStream;
    if(typeof capture==='function'){
      try{
        track=capture.call(audio);
        if(track&&track.getAudioTracks().length){
          source=context.createMediaStreamSource(track);
          sourceKind='capture';
          source.connect(analyser);
          // captureStream replaces its audio track when the synchronized
          // station advances to another MP3. Rebind the ANALYSIS fork only;
          // native audible playback is never stopped or reloaded.
          const rebind=()=>{
            if(sourceKind!=='capture'||!track?.getAudioTracks().length)return;
            try{
              const next=context.createMediaStreamSource(track);
              source.disconnect();
              source=next;
              source.connect(analyser);
              lastSignal=0;
            }catch(error){lastError=String(error?.name||error)}
          };
          track.addEventListener('addtrack',rebind);
          const silent=context.createGain();
          silent.gain.value=0;
          analyser.connect(silent);
          silent.connect(context.destination);
        }
      }catch(_){track=null;source=null}
    }
    if(!source){
      // One native player only. The audible route is 1:1, with the analyzer
      // on a silent fork, so visual parameters cannot change the sound.
      source=context.createMediaElementSource(audio);
      sourceKind='media-element';
      source.connect(context.destination);
      source.connect(analyser);
      const silent=context.createGain();
      silent.gain.value=0;
      analyser.connect(silent);
      silent.connect(context.destination);
    }
    graphReady=true;
    lastError='';
    return true;
  }catch(error){
    lastError=String(error?.name||error||'Unable to initialize live FFT');
    // Never call pause(), load(), or change the playing source on failure.
    try{context?.close()}catch(_){}
    context=null;analyser=null;source=null;sourceKind='none';
    return false;
  }finally{setupPending=false}
}
function arm(){
  if(GE_IS_IOS&&!geIOSLiveOptIn){
    lastError='Tap ENABLE LIVE EQ in Sun Lab to activate on iPhone';
    return false;
  }
  if(!localSong())return false;
  if(!start())return false;
  if(context?.state==='suspended'){
    // Invoked synchronously from the actual user tap for Safari activation.
    try{void context.resume().catch(error=>{lastError=String(error?.name||error)})}
    catch(error){lastError=String(error?.name||error)}
  }
  return true;
}
function read(){
  const audio=element();
  if(!audio||audio.paused||audio.ended||document.hidden||!localSong()||
    !graphReady||!analyser||context?.state!=='running')return null;
  try{
    analyser.getByteFrequencyData(rawBins);
    // The visualizers expect real low/mid/high groups, not linear Hz bins.
    // Remap the current FFT into 256 logarithmic frequency bands (32 Hz-16 kHz).
    const resolution=context.sampleRate/FFT_SIZE;
    const ceiling=Math.min(16000,context.sampleRate/2);
    for(let i=0;i<bins.length;i++){
      const low=32*Math.pow(ceiling/32,i/bins.length);
      const high=32*Math.pow(ceiling/32,(i+1)/bins.length);
      const a=Math.min(rawBins.length-1,Math.max(0,Math.floor(low/resolution)));
      const b=Math.min(rawBins.length,Math.max(a+1,Math.ceil(high/resolution)));
      let total=0,peak=0;
      for(let k=a;k<b;k++){const v=rawBins[k];total+=v;peak=Math.max(peak,v);}
      bins[i]=Math.round(total/(b-a)*.65+peak*.35);
    }
    const strong=bins.some(value=>value>1);
    if(strong)lastSignal=performance.now();
    return strong?bins:null;
  }catch(error){lastError=String(error?.name||error);return null}
}
function status(){
  return {mode:sourceKind,context:context?.state||'off',
    live:!!lastSignal&&performance.now()-lastSignal<1500,
    iosPreview:GE_IOS_PREVIEW,iosEnabled:!GE_IS_IOS||geIOSLiveOptIn,error:lastError};
}
function showEnableControl(){
  const button=document.getElementById('geSunEQEnable');
  if(!button)return;
  button.hidden=!GE_IS_IOS;
  if(!GE_IS_IOS)return;
  button.textContent=geIOSLiveOptIn?'RECONNECT LIVE EQ':'ENABLE LIVE EQ';
  button.setAttribute('aria-label',geIOSLiveOptIn?
    'Reconnect real time iPhone audio analyzer':'Enable real time iPhone music visualizer');
}
function enable(){
  geIOSLiveOptIn=true;
  lastError='';
  showEnableControl();
  return arm();
}
const triggers='#liveBtn,#playBtn,#shipPlay,#shipLive,#sunLabBtn,#shipSunLabBtn';
document.addEventListener('click',event=>{
  if(event.target?.closest?.('#geSunEQEnable')){enable();return;}
  if(event.target?.closest?.(triggers))arm();
},true);
showEnableControl();
const audio=element();
audio?.addEventListener('playing',()=>{if(localSong())arm();});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&!element()?.paused&&localSong())arm();
});
// An opt-in rescue for Safari if user returns from lock screen.
window.GELiveAudioEQ={arm,enable,read,status};
})();
