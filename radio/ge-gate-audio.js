/* GE Studios · listener-only Gate audio. Never changes the BLITZ station. */
(function(){
  'use strict';
  const main=document.getElementById('player');
  if(!main)return;
  const AudioContextType=window.AudioContext||window.webkitAudioContext;
  let ctx=null,source=null,fadeGain=null,scheduled=null,blocked=false;
  let lastError='';
  const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
  const gateLocked=()=>!!window.GEGate?.isExpiredLocked?.();

  // Install on a real listener interaction, never during page boot.
  // Source CORS is set on the <audio> tag BEFORE the radio stream loads.
  function arm(){
    if(blocked||gateLocked())return false;
    if(!AudioContextType){lastError='AudioContext unavailable';return false;}
    if(!ctx){
      try{
        ctx=new AudioContextType();
        source=ctx.createMediaElementSource(main);
        fadeGain=ctx.createGain();
        fadeGain.gain.value=1;
        source.connect(fadeGain);
        fadeGain.connect(ctx.destination);
      }catch(error){
        lastError=String(error?.message||error);
        // If Safari rejects Web Audio, keep the native audio usable.
        return false;
      }
    }
    try{
      if(ctx.state!=='running')void ctx.resume().catch(error=>{
        lastError='AudioContext resume: '+String(error?.message||error);
      });
    }catch(error){lastError=String(error?.message||error);}
    return !!fadeGain;
  }

  function setImmediate(value){
    scheduled=null;
    if(!fadeGain||!ctx)return false;
    const when=ctx.currentTime;
    fadeGain.gain.cancelScheduledValues(when);
    fadeGain.gain.setValueAtTime(clamp(value),when);
    return true;
  }

  // The audio-clock ramp runs independently of requestAnimationFrame and
  // setInterval; background timers must not be responsible for every step.
  function scheduleFade(startEpoch,endEpoch){
    const start=Number(startEpoch),end=Number(endEpoch),now=Date.now();
    if(!(end>start)||end<=now)return false;
    if(!arm())return false;
    const when=ctx.currentTime;
    const level=now<=start?1:clamp((end-now)/(end-start));
    fadeGain.gain.cancelScheduledValues(when);
    fadeGain.gain.setValueAtTime(level,when);
    if(start>now)fadeGain.gain.setValueAtTime(1,when+(start-now)/1000);
    fadeGain.gain.linearRampToValueAtTime(0,when+Math.max(.001,(end-now)/1000));
    scheduled={start,end};
    return true;
  }

  function syncProgress(value){
    // Never cancel the pre-scheduled audio-clock fade in an animation frame.
    if(scheduled&&Date.now()<scheduled.end)return true;
    return setImmediate(value);
  }

  function stopAll(){
    blocked=true;
    setImmediate(0);
    // The cutoff is unconditional even if a browser refuses Web Audio.
    for(const media of document.querySelectorAll('audio,video')){
      try{media.muted=true;media.defaultMuted=true;media.pause();}catch(_e){}
      if(media===main){
        try{media.removeAttribute('src');media.load();}catch(_e){}
      }
    }
    // The private music studio may own detached Audio elements.
    try{void window.GEIAmStudio?.close?.();}catch(_e){}
  }

  function restore(){
    blocked=false;
    scheduled=null;
    setImmediate(1);
  }
  document.addEventListener('click',event=>{
    if(!event.isTrusted||blocked)return;
    if(event.target?.closest?.('#playBtn,#liveBtn,#gateTestBtn,#shipGateTestBtn,#trackList')){
      arm();
    }
  },true);
  document.addEventListener('play',event=>{
    if(blocked||gateLocked()){
      try{event.target.muted=true;event.target.pause();}catch(_e){}
    }
  },true);
  window.GEAudioGain={
    arm,scheduleFade,syncProgress,setImmediate,stopAll,restore,
    getStatus:()=>({active:!!fadeGain,contextState:ctx?.state||'uninitialized',scheduled,lastError})
  };
})();
