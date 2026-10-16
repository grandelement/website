(function(){
  'use strict';
  const audio=document.getElementById('gePlayer');
  const play=document.getElementById('play');
  const stopButton=document.getElementById('geHomeStop');
  const label=document.getElementById('geHomeRadioLink');
  const status=document.getElementById('geHomeRadioStatus');
  if(!audio||!play)return;
  const RADIO1='https://radio.grandelement.blitz.cloud/stream.mp3';
  const PROGRAM='https://ge-radio-sync.grandelement.workers.dev/v1/program';
  const ctl=window.GE_MUSIC_CONTROLLER||{};
  const oldCatalog=typeof ctl.fallbackCatalog==='function'?ctl.fallbackCatalog.bind(ctl):()=>[];
  let mode='idle',wants=false,run=0,seen=false,waitingGesture=false;
  let lastTime=NaN,lastAdvance=0,startedAt=0,program=null,serverOffset=0,trackIndex=-1;
  let watcher=0,shuffleHistory=[],failedShuffles=0,stopRequested=false;
  const isAllowed=()=>!document.body.classList.contains('ge-broadcast-background');
  const setStatus=(s)=>{if(status)status.textContent=s;};
  function display(){
    if(label)label.textContent='GRAND ELEMENT RADIO';
    // The homepage intentionally uses separate PLAY and STOP controls:
    // a playing broadcast must never change PLAY into a Pause button.
    play.textContent=(wants&&!audio.paused)?'STOP':'PLAY';
    play.setAttribute('aria-label','Play Grand Element Radio');
    if(stopButton){stopButton.hidden=true;stopButton.disabled=(!wants&&mode==='idle');}
  }
  function media(){
    try{if('mediaSession' in navigator){
      navigator.mediaSession.metadata=new MediaMetadata({title:'Grand Element Radio',artist:'Grand Element',album:mode==='radio2'?'RADIO 2 · Bangers':(mode==='shuffle'?'Shuffle backup':'RADIO 1 · LIVE')});
      navigator.mediaSession.setActionHandler('play',()=>{void startRadio1();});
      navigator.mediaSession.setActionHandler('pause',()=>pause());
      navigator.mediaSession.setActionHandler('nexttrack',null);
      navigator.mediaSession.setActionHandler('previoustrack',null);
    }}catch(_e){}
  }
  function clearTimers(){if(watcher){clearTimeout(watcher);watcher=0;}}
  function begin(source,kind,nonce){
    if(nonce!==run||!wants)return;
    mode=kind;seen=false;waitingGesture=false;lastTime=NaN;lastAdvance=Date.now();startedAt=Date.now();
    audio.pause();audio.autoplay=false;audio.removeAttribute('crossorigin');
    audio.preload='auto';audio.muted=false;audio.src=source;audio.load();
    media();display();
    try{
      const promise=audio.play();
      if(promise&&promise.catch)promise.catch(err=>{
        if(nonce!==run||!wants||mode!==kind)return;
        if(err&&err.name==='NotAllowedError'){
          waitingGesture=true;clearTimers();setStatus('TAP PLAY AGAIN · iPad/iPhone audio permission');return;
        }
        void failure(nonce,kind,'play_error');
      });
    }catch(e){void failure(nonce,kind,'play_error')}
  }
  function arm(nonce,kind,ms){
    clearTimers();
    watcher=setTimeout(()=>{
      if(nonce===run&&wants&&mode===kind&&!seen&&!waitingGesture)
        void failure(nonce,kind,'no_audio_progress');
    },ms);
  }
  async function startRadio1(){
    if(!isAllowed())return;
    const nonce=++run;wants=true;stopRequested=false;
    clearTimers();program=null;trackIndex=-1;
    setStatus('RADIO 1 · CONNECTING TO LIVE BROADCAST…');
    // Fresh request avoids a stale iOS buffered copy when retrying Radio 1.
    const u=new URL(RADIO1);u.searchParams.set('_ge_live_edge',Date.now().toString());
    begin(u.href,'radio1',nonce);
    if(nonce===run&&wants&&mode==='radio1')arm(nonce,'radio1',10500);
  }
  function validRadio2Track(t){
    if(!t||!Number.isFinite(Number(t.duration_ms))||Number(t.duration_ms)<1000)return false;
    try{
      const u=new URL(t.url,location.origin);
      return u.origin===location.origin&&u.pathname.startsWith('/ge-music/')&&!u.pathname.includes('..');
    }catch(_e){return false}
  }
  function currentRadio2(){
    if(!program||!Array.isArray(program.tracks)||!program.tracks.length)return null;
    const total=Number(program.cycle_duration_ms);
    if(!(total>0))return null;
    let elapsed=(Date.now()+serverOffset-Number(program.epoch_utc_ms))%total;
    if(elapsed<0)elapsed+=total;
    for(let i=0;i<program.tracks.length;i++){
      const t=program.tracks[i],dur=Number(t.duration_ms);
      if(elapsed<dur)return {index:i,track:t,seconds:elapsed/1000};
      elapsed-=dur;
    }
    return {index:0,track:program.tracks[0],seconds:0};
  }
  function playRadio2Slot(nonce){
    if(nonce!==run||!wants)return;
    const slot=currentRadio2();
    if(!slot||!validRadio2Track(slot.track)){void startShuffle(nonce);return}
    if(mode==='radio2'&&slot.index===trackIndex)return;
    trackIndex=slot.index;
    const url=new URL(slot.track.url,location.origin).href;
    setStatus('RADIO 2 · BANGERS SYNCHRONIZED BACKUP');
    begin(url,'radio2',nonce);
    const seek=()=>{
      if(nonce!==run||mode!=='radio2'||trackIndex!==slot.index)return;
      const current=currentRadio2();
      if(!current||current.index!==slot.index)return;
      const max=Math.max(0,Number(slot.track.duration_ms)/1000-.35);
      try{audio.currentTime=Math.min(max,current.seconds)}catch(_e){}
    };
    if(audio.readyState>=1)seek();
    else audio.addEventListener('loadedmetadata',seek,{once:true});
    if(nonce===run&&wants&&mode==='radio2')arm(nonce,'radio2',10500);
  }
  async function startRadio2(nonce){
    if(nonce!==run||!wants)return;
    clearTimers();setStatus('RADIO 1 UNAVAILABLE · CHECKING RADIO 2…');
    const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),8500);
    try{
      const sent=Date.now();
      const response=await fetch(PROGRAM,{cache:'no-store',signal:ac.signal});
      if(!response.ok)throw Error('program unavailable');
      const data=await response.json(),received=Date.now(),p=data&&data.program;
      if(!data?.ok||p?.format!=='ge-radio-clock-v1'||
         String(p.playlist_name||'').toLowerCase()!=='bangers'||
         !Array.isArray(p.tracks)||p.tracks.length<3||
         !Number.isFinite(Number(p.epoch_utc_ms))||
         !Number.isFinite(Number(p.cycle_duration_ms))||
         Number(p.cycle_duration_ms)<=0||
         !p.tracks.every(validRadio2Track))throw Error('invalid Bangers program');
      if(nonce!==run||!wants)return;
      program=p;
      const diff=Number(data.server_now_ms)-(sent+received)/2;
      serverOffset=Number.isFinite(diff)&&Math.abs(diff)<86400000?diff:0;
      playRadio2Slot(nonce);
    }catch(_e){
      if(nonce===run&&wants)void startShuffle(nonce);
    }finally{clearTimeout(timer)}
  }
  async function startShuffle(nonce){
    if(nonce!==run||!wants)return;
    clearTimers();mode='shuffle';
    setStatus('RADIO 1 AND 2 UNAVAILABLE · SHUFFLE BACKUP');
    shuffleHistory=[];
    failedShuffles=0;
    await nextShuffle(nonce);
  }
  async function nextShuffle(nonce){
    if(nonce!==run||!wants)return;
    const tracks=oldCatalog().filter(it=>it&&typeof it.url==='string');
    if(!tracks.length){
      mode='idle';wants=false;
      setStatus('RADIO UNAVAILABLE · TAP PLAY TO RETRY OR OPEN RADIO');
      display();return;
    }
    const choices=tracks.filter(it=>!shuffleHistory.includes(it.url));
    const pool=choices.length?choices:tracks;
    const pick=pool[Math.floor(Math.random()*pool.length)];
    shuffleHistory=[pick.url,...shuffleHistory.filter(s=>s!==pick.url)].slice(0,4);
    begin(pick.url,'shuffle',nonce);
    setStatus('GRAND ELEMENT RADIO · SHUFFLE BACKUP');
    if(nonce===run&&wants&&mode==='shuffle')arm(nonce,'shuffle',10000);
  }
  async function failure(nonce,kind,reason){
    if(nonce!==run||!wants||mode!==kind||waitingGesture)return;
    if(kind==='radio1'){void startRadio2(nonce);return}
    if(kind==='radio2'){void startShuffle(nonce);return}
    if(kind==='shuffle'){
      if(++failedShuffles>8){pause();setStatus('MUSIC UNAVAILABLE · TAP PLAY TO RETRY RADIO');return}
      await nextShuffle(nonce);
    }
  }
  function pause(){
    wants=false;stopRequested=true;run++;clearTimers();
    audio.pause();setStatus('GRAND ELEMENT RADIO · PAUSED');display();
  }
  function playPause(){
    if(!audio.paused&&wants){pause();return}
    // Shared Game Mode transport may still toggle pause, but the homepage
    // PLAY button below is play-only, with an independent STOP button.
    void startRadio1();
  }
  function playOnly(){
    if(wants&&!audio.paused)return;
    // A fresh explicit PLAY always attempts Radio 1 before its fallback chain.
    void startRadio1();
  }
  function stop(){
    // Unlike PAUSE, STOP disconnects the live MP3 and prevents all delayed
    // failover callbacks from restarting playback.
    wants=false;stopRequested=true;run++;clearTimers();
    mode='idle';seen=false;waitingGesture=false;program=null;trackIndex=-1;
    lastTime=NaN;lastAdvance=0;shuffleHistory=[];failedShuffles=0;
    try{audio.pause();audio.removeAttribute('src');audio.load()}catch(_e){}
    try{if('mediaSession' in navigator)navigator.mediaSession.playbackState='none'}catch(_e){}
    setStatus('GRAND ELEMENT RADIO · STOPPED');
    display();
  }
  audio.addEventListener('playing',()=>{if(!wants)return;display();media();});
  audio.addEventListener('pause',display);
  audio.addEventListener('timeupdate',()=>{
    if(!wants||audio.paused)return;
    const t=Number(audio.currentTime);
    if(!Number.isFinite(t))return;
    if(Number.isFinite(lastTime)&&t>lastTime+.08){
      seen=true;lastAdvance=Date.now();failedShuffles=0;clearTimers();
      if(mode==='radio1')setStatus('GRAND ELEMENT RADIO · RADIO 1 LIVE');
      else if(mode==='radio2')setStatus('GRAND ELEMENT RADIO · RADIO 2 BANGERS');
      else if(mode==='shuffle')setStatus('GRAND ELEMENT RADIO · SHUFFLE BACKUP');
    }
    lastTime=t;
  });
  audio.addEventListener('error',()=>{if(wants)void failure(run,mode,'media_error')});
  audio.addEventListener('ended',()=>{
    if(!wants)return;
    if(mode==='radio2'){trackIndex=-1;playRadio2Slot(run)}
    else if(mode==='shuffle')void nextShuffle(run);
    else void failure(run,mode,'stream_ended');
  });
  // A radio stream may signal playing yet never advance. Confirm REAL audio progress.
  setInterval(()=>{
    if(!wants||document.hidden||waitingGesture||!isAllowed())return;
    if(mode==='radio2'&&program){
      const slot=currentRadio2();
      if(slot&&slot.index!==trackIndex){playRadio2Slot(run);return}
      if(slot&&Number.isFinite(Number(audio.currentTime))&&
         Math.abs(Number(audio.currentTime)-slot.seconds)>12&&audio.readyState>=1){
        try{audio.currentTime=slot.seconds}catch(_e){}
      }
    }
    if(seen&&Date.now()-lastAdvance>14000)
      void failure(run,mode,'stalled');
  },3500);
  const previous=window.GE_MUSIC_CONTROLLER||{};
  previous.playPause=playPause;
  previous.next=()=>{};
  previous.prev=()=>{};
  previous.setShuffle=()=>true;
  previous.getShuffle=()=>true;
  previous.selectTrackNumber=()=>false;
  previous.playAlbum=()=>{location.assign(new URL('radio/',location.href).href);return false};
  previous.ensurePlaying=async()=>{if(wants&&!audio.paused)return true;if(wants)await startRadio1();return wants&&!audio.paused};
  previous.wantsPlayback=()=>wants;
  window.GE_MUSIC_CONTROLLER=previous;
  play.onclick=()=>{if(wants&&!audio.paused)stop();else playOnly();};
  stopButton?.addEventListener('click',stop);
  window.GE_HOME_RADIO={play:playOnly,pause,stop,playPause,
    isLiveMode:()=>true,mode:()=>mode,playing:()=>wants&&!audio.paused,
    status:()=>status?.textContent||''};
  document.getElementById('geHomeRadioLink')?.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    if(typeof openGrandElementRadio==='function')openGrandElementRadio();
    else location.assign(new URL('radio/',location.href).href);
  });
  display();setStatus('TAP PLAY · GRAND ELEMENT RADIO');
})();