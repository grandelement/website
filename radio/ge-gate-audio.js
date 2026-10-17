/* GE Studios - individual listener Gate fade + reverb. Never changes BLITZ. */
(function(){
  'use strict';
  const main=document.getElementById('player');
  if(!main)return;
  const AudioContextType=window.AudioContext||window.webkitAudioContext;
  let ctx=null,source=null,master=null,wet=null,dry=null,hasReverb=false;
  let scheduled=null,blocked=false,lastError='',pendingResume=null;
  const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
  const gateLocked=()=>!!window.GEGate?.isExpiredLocked?.();

  function impulseFor(context){
    // One modest stereo room impulse. This replaces the separate iPhone
    // analyser stream (which was explicitly disabled on iOS).
    const rate=context.sampleRate||44100,length=Math.max(1,Math.round(rate*.72));
    const impulse=context.createBuffer(2,length,rate);
    let seed=0x17a233;
    for(let channel=0;channel<2;channel++){
      const samples=impulse.getChannelData(channel);
      for(let i=0;i<length;i++){
        seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
        const t=i/length;
        samples[i]=((seed>>>0)/2147483648-1)*Math.pow(1-t,2.4)*.22;
      }
    }
    return impulse;
  }

  function applyExistingGate(){
    const gs=window.GEGate?.getState?.();
    if(gs?.active&&!gs.expired&&Number(gs.expireAt)>Date.now()){
      scheduleFade(gs.fadeAt,gs.expireAt);
    }
  }

  // IMPORTANT: Only invoked from a listener's trusted PLAY or TEST GATE tap.
  // Never createMediaElementSource at the start of the automatic Blue Sun
  // entrance. Doing so without user activation can suspend iPhone playback.
  function arm(){
    if(blocked||gateLocked())return false;
    if(!AudioContextType){lastError='Web Audio unavailable';return false;}
    if(!ctx){
      try{
        const created=new AudioContextType();
        const output=created.createGain();output.gain.value=1;
        const dryBus=created.createGain();dryBus.gain.value=1;
        dryBus.connect(output);output.connect(created.destination);
        let wetBus=null,reverbReady=false,reverbInput=null;
        try{
          const filter=created.createBiquadFilter();filter.type='lowpass';
          filter.frequency.value=6500;
          const room=created.createConvolver();room.normalize=true;
          room.buffer=impulseFor(created);
          wetBus=created.createGain();wetBus.gain.value=0;
          filter.connect(room);room.connect(wetBus);wetBus.connect(output);
          reverbInput=filter;reverbReady=true;
        }catch(error){
          lastError='Reverb unavailable: '+String(error?.message||error);
        }
        // Connect the already-prepared graph only after it is complete.
        const elementSource=created.createMediaElementSource(main);
        elementSource.connect(dryBus);
        if(reverbInput)elementSource.connect(reverbInput);
        ctx=created;source=elementSource;master=output;dry=dryBus;
        wet=wetBus;hasReverb=reverbReady;
      }catch(error){
        lastError='Listener Web Audio unavailable: '+String(error?.message||error);
        return false;
      }
    }
    if(ctx.state!=='running'&&!pendingResume){
      try{
        pendingResume=Promise.resolve(ctx.resume()).then(()=>{
          pendingResume=null;applyExistingGate();
        }).catch(error=>{
          pendingResume=null;
          lastError='AudioContext resume: '+String(error?.message||error);
        });
      }catch(error){lastError=String(error?.message||error);}
    }
    applyExistingGate();
    return !!master;
  }

  function stopAutomation(value){
    scheduled=null;
    if(!master||!ctx)return false;
    const t=ctx.currentTime,gain=clamp(value);
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(gain,t);
    if(wet){wet.gain.cancelScheduledValues(t);wet.gain.setValueAtTime(0,t);}
    if(dry){dry.gain.cancelScheduledValues(t);dry.gain.setValueAtTime(1,t);}
    return true;
  }

  function setImmediate(value){return stopAutomation(value);}
  function scheduleFade(startEpoch,endEpoch){
    const start=Number(startEpoch),end=Number(endEpoch),now=Date.now();
    if(!(end>start)||end<=now)return false;
    // No arm() here. An automatic Gate MUST NOT create or hijack the
    // player's media source, particularly on iPhone Safari.
    if(!ctx||!master||blocked)return false;
    if(scheduled?.start===start&&scheduled?.end===end)return true;
    const current=ctx.currentTime,span=end-start;
    const progress=clamp((now-start)/span);
    const level=1-progress;
    const fadeStart=current+Math.max(0,(start-now)/1000);
    const fadeEnd=current+Math.max(.001,(end-now)/1000);

    master.gain.cancelScheduledValues(current);
    master.gain.setValueAtTime(level,current);
    if(start>now)master.gain.setValueAtTime(1,fadeStart);
    master.gain.linearRampToValueAtTime(0,fadeEnd);

    if(wet&&hasReverb){
      wet.gain.cancelScheduledValues(current);
      // Reverb grows from nothing to a clearly audible room effect, but
      // shares the exact same final master fade as the original music.
      const wetAt=p=>p<=.7?.55*(p/.7):.55-(p-.7)*.50;
      wet.gain.setValueAtTime(wetAt(progress),current);
      if(start>now)wet.gain.setValueAtTime(0,fadeStart);
      const peakAt=start+span*.7;
      if(peakAt>now)wet.gain.linearRampToValueAtTime(.55,current+(peakAt-now)/1000);
      wet.gain.linearRampToValueAtTime(.40,fadeEnd);
    }
    if(dry){
      dry.gain.cancelScheduledValues(current);
      dry.gain.setValueAtTime(1-.22*progress,current);
      if(start>now)dry.gain.setValueAtTime(1,fadeStart);
      dry.gain.linearRampToValueAtTime(.78,fadeEnd);
    }
    scheduled={start,end};
    return true;
  }

  function syncProgress(value){
    // The Web Audio clock owns the full fade; never cancel it from an
    // animation frame, timer tick, or iPhone visibility callback.
    if(scheduled&&Date.now()<scheduled.end)return true;
    return setImmediate(value);
  }

  function resetReverb(){
    if(!wet||!ctx)return;
    const t=ctx.currentTime;
    wet.gain.cancelScheduledValues(t);
    wet.gain.setValueAtTime(0,t);
  }

  function stopAll(){
    blocked=true;
    stopAutomation(0);
    for(const media of document.querySelectorAll('audio,video')){
      try{media.muted=true;media.defaultMuted=true;media.pause();}catch(_e){}
      if(media===main){
        try{media.removeAttribute('src');media.load();}catch(_e){}
      }
    }
    try{void window.GEIAmStudio?.close?.();}catch(_e){}
  }

  function restore(){
    blocked=false;
    stopAutomation(1);
  }

  // Install only on trusted controls; the same graph plays Radio and songs.
  document.addEventListener('click',event=>{
    if(!event.isTrusted||blocked)return;
    if(event.target?.closest?.('#playBtn,#liveBtn,#shipPlay,#shipStage [data-proxy="liveBtn"],#gateTestBtn,#shipGateTestBtn,#trackList,#geGate')){
      arm();
    }
  },true);
  document.addEventListener('play',event=>{
    if(blocked||gateLocked()){
      try{event.target.muted=true;event.target.pause();}catch(_e){}
    }
  },true);

  window.GEAudioGain={
    arm,scheduleFade,syncProgress,setImmediate,resetReverb,stopAll,restore,
    getStatus:()=>({
      active:!!master,contextState:ctx?.state||'uninitialized',
      reverb:hasReverb,scheduled,lastError
    })
  };
})();
