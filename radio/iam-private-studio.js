/* Grand Element I AM — private two-track studio v2.
   The normal Radio player is untouched until a private track has loaded.
   Music, dry microphone and mixed preview share one AudioContext clock. */
(function(){
"use strict";
window.GEIAmPrivateStudioBoot=function(api){
const {audio,state,CONFIG,displayTitle,allowedCatalog,pauseRadio,resumeRadio}=api;
const get=id=>document.getElementById(id);
const E={launch:get("iamLaunchBtn"),record:get("iamRecordBtn"),timer:get("iamTimer"),status:get("iamStatus"),
  take:get("iamTakeAudio"),meters:[get("iamMusicMeter"),get("iamMicMeter")],label:get("iamMusicSignalLabel"),
  music:get("iamMusicLevel"),voice:get("iamMicLevel"),gain:get("iamInputGain"),compression:get("iamCompression"),
  monitor:get("iamMonitorBtn"),sound:get("iamSoundBtn"),panel:get("iamSoundPanel"),
  edit:get("iamEditBtn"),again:get("iamAgainBtn"),listen:get("iamListenBtn"),
  back:get("iamEditBack"),save:get("iamEditSave")};
if(!E.launch||!E.record)return;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),value=x=>Number(x?.value||0);
const fmt=n=>{n=Math.max(0,Math.floor(n||0));return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")};
const micIcon='<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="17" y="7" width="14" height="24" rx="7"></rect><path d="M11 23c0 8 5 14 13 14s13-6 13-14"></path><path d="M24 37v7M17 44h14"></path></svg>';
const stopIcon='<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="13" y="13" width="22" height="22" rx="3"></rect></svg>';
const playIcon='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M17 11l22 13-22 13z"></path></svg>';
let open=false,loading=false,recording=false,reviewing=false,editing=false,headphones=false,monitoring=false,verified=false,sourceMode="player";
let ctx=null,privateAudio=null,musicInput=null,musicGain=null,musicOutput=null,musicMeter=null,voiceMeter=null,musicData=null,voiceData=null;
let dryInput=null,dryGain=null,compressedGain=null,compressor=null,voiceInput=null,voiceOutput=null,monitorGain=null;
let fxDelay=null,fxWet=null,fxFeedback=null,musicDest=null,voiceDest=null,mixDest=null,micStream=null;
let sourceURL="",sun=null,oldMuted=false,sessionToken=0,raf=0,startedAt=0,takeMeta=null,fxMode="clean";
let recMusic=null,recVoice=null,recMix=null,chunks={music:[],voice:[],mix:[]},take={music:null,voice:null,mix:null};
let reviewCtx=null,reviewSources=[],reviewNodes=null,reviewClock=0,savedWarning="";
let cachedSong=null,cachedSongTime=0;
let micPromise=null,micRequestToken=0,micConnected=false,micError="",micProcessingFallback=false;
let micSourceNode=null,micMonoNode=null,micAttachedAt=0,lastMicSignalAt=0,trackChangeToken=0;
let musicHandoffDone=false,musicSignalError="",oldMediaVolume=1,oldMediaAutoplay=false;
let radioSuspended=false,radioStoppedAt=0,matchRetryId=0,matchAttemptCount=0,matchInProgress=false;
let studioMusicStopped=false,recorderReady=false,recorderPrewarming=false,recordFinishing=false;
let micDetected=false,micSilenceWarned=false,recordArming=false;
let micFloatData=null,micLastDB=-90,micStrongFrames=0;
let micTestRecorder=null,micTestAudio=null,micTestBlob=null,micTestChunks=[],micTestRunning=false,micTestTimer=0;
let editZoom=1,editPan=0,editSelection=null,editDragStart=null,editDragging=false;
let editMute=[],editKeep=null,editUndo=[],editWaveBuffers=null,editVocalShift=-20;
let editLoadToken=0;

function say(s){E.status.textContent=s}
function mode(x){
 E.record.classList.toggle("record-ready",x==="record");E.record.classList.toggle("recording",x==="recording");
 E.record.classList.toggle("take-ready",x==="play"||x==="playing");
 E.record.innerHTML=x==="recording"||x==="playing"?stopIcon:x==="play"?playIcon:micIcon;
 E.record.setAttribute("aria-label",x==="recording"?"Stop recording":x==="playing"?"Stop review":x==="play"?"Listen to take":"Record");
 if(E.listen){
  E.listen.disabled=!(take.mix&&!recording&&!micTestRunning);
  E.listen.textContent=reviewing?"STOP PLAYBACK":"LISTEN AGAIN";
 }
 if(E.again)E.again.disabled=!!recording;
 if(E.edit)E.edit.disabled=!(take.mix&&take.voice&&take.music&&!recording);
}
function errorString(e){return String(e?.message||e?.name||e||"unknown error").slice(0,185)}
function makeSun(){
 const logo=get("geLogo"),r=logo?.getBoundingClientRect();if(!logo||!r)return;
 sun?.remove();sun=document.createElement("img");sun.className="iamSunFlight";sun.alt="";sun.src=logo.currentSrc||logo.src;
 Object.assign(sun.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px",opacity:"1"});
 document.body.appendChild(sun);
 requestAnimationFrame(()=>requestAnimationFrame(()=>sun?.classList.add("centered")));
}
function removeSun(){const node=sun;sun=null;if(node){node.style.opacity="0";setTimeout(()=>node.remove(),400)}}
function outputSettings(){
 get("iamMusicRead").textContent=value(E.music)+"%";
 get("iamMicRead").textContent=value(E.voice)+"%";
 get("iamInputGainRead").textContent=value(E.gain)+"%";
 get("iamCompressionRead").textContent=value(E.compression)===0?"OFF":value(E.compression)+"%";
 const privateLevel=get("iamPrivateMusicVolume");
 if(privateLevel&&Number(privateLevel.value)!==value(E.music))privateLevel.value=String(value(E.music));
 if(get("iamPrivateMusicRead"))get("iamPrivateMusicRead").textContent=value(E.music)+"%";
 const compression=clamp(value(E.compression)/100,0,1),music=clamp(value(E.music)/100,0,1.5),
   voice=clamp(value(E.voice)/100,0,1.5);
 if(ctx){
  musicGain?.gain.setTargetAtTime(music,ctx.currentTime,.015);
  voiceInput?.gain.setTargetAtTime(value(E.gain)/100,ctx.currentTime,.015);
  voiceOutput?.gain.setTargetAtTime(voice,ctx.currentTime,.015);
  dryGain?.gain.setTargetAtTime(1-compression,ctx.currentTime,.015);
  compressedGain?.gain.setTargetAtTime(compression,ctx.currentTime,.015);
  // Boost monitoring only, with original dry recording unchanged.
  monitorGain?.gain.setTargetAtTime(headphones&&monitoring?1.35:0,ctx.currentTime,.015);
 }
 // Studio volume changes affect only the private recording player.
 if(reviewCtx&&reviewNodes){
  reviewNodes.music.gain.setTargetAtTime(music,reviewCtx.currentTime,.01);
  reviewNodes.voice.gain.setTargetAtTime(voice*value(E.gain)/100,reviewCtx.currentTime,.01);
  reviewNodes.dry.gain.setTargetAtTime(1-compression,reviewCtx.currentTime,.01);
  reviewNodes.wet.gain.setTargetAtTime(compression,reviewCtx.currentTime,.01);
 }
}
function effectSettings(){
 let time=.01,wet=0,feedback=0;
 if(fxMode==="space"){time=.17;wet=.2;feedback=.17}
 if(fxMode==="echo"){time=.34;wet=.36;feedback=.28}
 if(ctx&&fxDelay){
  fxDelay.delayTime.setTargetAtTime(time,ctx.currentTime,.02);
  fxWet.gain.setTargetAtTime(wet,ctx.currentTime,.02);
  fxFeedback.gain.setTargetAtTime(feedback,ctx.currentTime,.02);
 }
 if(reviewCtx&&reviewNodes){
  reviewNodes.delay.delayTime.setTargetAtTime(time,reviewCtx.currentTime,.02);
  reviewNodes.fxWet.gain.setTargetAtTime(wet,reviewCtx.currentTime,.02);
  reviewNodes.feedback.gain.setTargetAtTime(feedback,reviewCtx.currentTime,.02);
 }
}
function meter(analyser,data){
 if(!analyser||!data)return 0;
 analyser.getByteTimeDomainData(data);
 let n=0,p=0;
 for(let i=0;i<data.length;i++){const z=(data[i]-128)/128;n+=z*z;p=Math.max(p,Math.abs(z))}
 return Math.min(1,Math.sqrt(n/data.length)*3+p*.16);
}
function micLevel(){
 if(!voiceMeter)return {db:-90,level:0,active:false};
 let sum=0,peak=0,n=0;
 if(typeof voiceMeter.getFloatTimeDomainData==="function"&&micFloatData){
  voiceMeter.getFloatTimeDomainData(micFloatData);n=micFloatData.length;
  for(let i=0;i<n;i++){const v=micFloatData[i];sum+=v*v;peak=Math.max(peak,Math.abs(v))}
 }else if(voiceData){
  voiceMeter.getByteTimeDomainData(voiceData);n=voiceData.length;
  for(let i=0;i<n;i++){const v=(voiceData[i]-128)/128;sum+=v*v;peak=Math.max(peak,Math.abs(v))}
 }
 const rms=n?Math.sqrt(sum/n):0;
 const db=rms>0?clamp(20*Math.log10(rms),-90,0):-90;
 return {db,level:clamp((db+65)/55,0,1),active:rms>=.007,peak};
}
let lastTransportUpdate=0;
function syncPrivateTransport(){
 if(!open)return;
 const element=privateAudio;
 const play=get("iamPrivatePlay"),seek=get("iamPrivateMusicSeek"),time=get("iamPrivateMusicTime");
 const toggle=get("iamStopMusic");
 if(toggle)toggle.textContent=studioMusicStopped?"START":"STOP";
 if(play)play.textContent=element&&!element.paused?"PAUSE":"PLAY";
 const duration=Number(element?.duration)||0,finite=Number.isFinite(duration)&&duration>0;
 if(seek){seek.disabled=!finite||recording||!element;
  if(finite&&document.activeElement!==seek){
   seek.value=String(Math.round(clamp((Number(element.currentTime)||0)/duration,0,1)*1000));
  }
 }
 if(time)time.textContent=finite?fmt(element.currentTime)+"/"+fmt(duration):"LIVE";
}
function updateRecordReady(){
 if(recording){E.record.disabled=false;return}
 if(recordArming||recordFinishing||micTestRunning){E.record.disabled=true;return}
 if(document.body.classList.contains("iam-take-error")){E.record.disabled=true;return}
 if(take.mix){E.record.disabled=false;return}
 // Being silent or having music paused must not silently disable the button.
 E.record.disabled=!(open&&verified&&micConnected&&micStream?.active&&!loading);
 if(verified&&micConnected&&micDetected&&!loading&&!recorderReady)prepareRecorders();
}
function meterLoop(){
 if(!open){raf=0;return}
 const tick=performance.now();
 if(tick-lastTransportUpdate>260){lastTransportUpdate=tick;syncPrivateTransport();}
 const m=meter(musicMeter,musicData),reading=micLevel();
 const v=reading.level,db=reading.db;
 micLastDB=db;
 if(reading.active){
  lastMicSignalAt=performance.now();micStrongFrames=Math.min(10,micStrongFrames+1);
  if(micConnected&&!micDetected&&micStrongFrames>=3){
   micDetected=true;micSilenceWarned=false;
   updateRecordReady();
   say("YOU microphone level confirmed ("+Math.round(db)+" dB). Ready when MUSIC is connected.");
  }
 }else micStrongFrames=0;
 E.meters[0].style.transform="scaleX("+Math.max(.015,m).toFixed(3)+")";
 E.meters[1].style.transform="scaleX("+Math.max(.006,v).toFixed(3)+")";
 E.label.textContent=musicSignalError?"MUSIC · NO CAPTURE":m>.03?"MUSIC · LIVE":loading?"MUSIC · CONNECTING":"MUSIC · NO SIGNAL";
 const micButton=get("iamMicRetryBtn");
 if(micButton){
  const tracks=micStream?.getAudioTracks?.()||[];
  const live=micConnected&&tracks.some(t=>t.readyState!=="ended"&&t.enabled!==false&&!t.muted);
  const muted=micConnected&&tracks.some(t=>t.muted);
  const silent=live&&micAttachedAt&&performance.now()-micAttachedAt>4500&&!micDetected;
  const dbText=db<=-85?"SILENT":Math.round(db)+"dB";
  micButton.textContent=live&&ctx?.state!=="running"?"YOU · AUDIO PAUSED":
   muted?"YOU · MUTED":live?(reading.active?"YOU · "+dbText:db>-72?"YOU · LOW "+dbText:"YOU · SILENT"):
   micError?"YOU · RETRY MIC":micPromise?"YOU · CONNECTING":"YOU · ENABLE MIC";
  if(silent&&!micSilenceWarned&&!recording){
   micSilenceWarned=true;
   say("Microphone permission is on, but no voice signal reached I AM. Check the iPhone microphone, then tap YOU to restart it.");
  }
  micButton.classList.toggle("mic-needs-help",!live);
  micButton.setAttribute("aria-label",live?"Microphone ready. Tap to check input":(micError||"Enable microphone"));
 }
 if(micConnected&&micStream&&!micStream.active){micConnected=false;micError="Microphone disconnected. Tap YOU to reconnect.";}
 if(recording)E.timer.textContent=fmt(performance.now()/1000-startedAt);
 else if(reviewing&&reviewCtx)E.timer.textContent=fmt(reviewCtx.currentTime-reviewClock);
 raf=requestAnimationFrame(meterLoop);
}
function createMusicGraph(){
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw Error("Web Audio unavailable");
 ctx=new AC();musicInput=ctx.createMediaElementSource(privateAudio);
 musicGain=ctx.createGain();musicOutput=ctx.createGain();
 musicMeter=ctx.createAnalyser();musicMeter.fftSize=512;musicData=new Uint8Array(musicMeter.fftSize);
 musicDest=ctx.createMediaStreamDestination();voiceDest=ctx.createMediaStreamDestination();mixDest=ctx.createMediaStreamDestination();
 musicInput.connect(musicDest);musicInput.connect(musicGain);musicGain.connect(musicMeter);
 musicGain.connect(mixDest);
 musicGain.connect(musicOutput);musicOutput.connect(ctx.destination);
 musicOutput.gain.value=0;
 outputSettings();
}
async function stationSong(){
 try{
  const url=new URL("/control/public-now",CONFIG.LIVE_STREAM_URL);
  const response=await fetch(url.href,{cache:"no-store"});if(!response.ok)return null;
  const body=await response.json(),now=body.now||{};
  const norm=s=>String(s||"").toLowerCase().replace(/\.[^/.]+$/,"").replace(/[^a-z0-9]/g,"");
  const base=norm(decodeURIComponent(String(now.path||"").split("/").pop()));
  // Match against the entire music library, not only the albums currently
  // enabled in the main Player filters. Radio may be playing other GE tracks.
  const songs=Array.isArray(state.catalog)&&state.catalog.length?state.catalog:allowedCatalog();
  const found=songs.find(s=>base&&norm(decodeURIComponent(s.split("/").pop().split("?")[0]))===base)
    ||songs.find(s=>norm(now.title).length>6&&norm(s).includes(norm(now.title)));
  if(body.live_active||!found)return null;
  const seconds=Number(body.now_started_at)||0;
  if(seconds){
   const age=Date.now()/1000-seconds;
   if(!(age>=0&&age<3600))return null;
  }
  return {url:found,title:String(now.title||""),seconds};
 }catch(_e){return null}
}
function suspendOriginalRadio(){
 if(!open)return;
 radioSuspended=true;
 try{audio.autoplay=false;audio.muted=true;audio.defaultMuted=true}catch(_e){}
 try{if((state.live||state.livePreparing)&&pauseRadio)pauseRadio();else audio.pause()}catch(_e){}
 try{audio.pause()}catch(_e){}
}
function sourceSelection(){
 const url=audio.currentSrc||audio.src||"";
 const isRadio=!!(state.live||state.livePreparing||!url||url.includes("/stream.mp3")||state.currentURL===CONFIG.LIVE_STREAM_URL);
 sourceMode=isRadio?"radio":"player";
 if(!isRadio)return {url,position:Number(audio.currentTime)||0,precise:true,kind:"player"};
 const match=(Date.now()-cachedSongTime<20000)?cachedSong:null;
 if(match){
  const offset=match.seconds?clamp(radioStoppedAt/1000-match.seconds-2,0,999999):0;
  return {url:match.url,position:offset,precise:false,kind:"radio-song",title:match.title};
 }
 // Do not substitute the catalog's first song when the Radio metadata is missing.
 // Wait for the real Radio song or let the listener explicitly choose SONGS.
 return {url:"",position:0,precise:false,kind:"radio-unmatched"};
}
async function refreshStationSong(){
 if(!state.live||open)return;
 const song=await stationSong();
 cachedSong=song;cachedSongTime=Date.now();
}
setInterval(()=>{void refreshStationSong()},12000);
setTimeout(()=>{void refreshStationSong()},1400);
async function refreshMatchForStudio(){
 if(!open||musicHandoffDone||matchInProgress||sourceURL)return;
 const token=sessionToken;matchInProgress=true;matchAttemptCount++;
 let song=null;
 try{song=await stationSong()}catch(_e){}
 matchInProgress=false;
 if(!open||token!==sessionToken||musicHandoffDone||sourceURL)return;
 cachedSong=song;cachedSongTime=Date.now();
 if(song){
  const position=song.seconds?clamp(radioStoppedAt/1000-song.seconds-2,0,999999):0;
  get("iamSourceIndicator").textContent="RADIO SONG FOUND · LOADING PLAYER";
  get("iamNowPlaying").textContent=song.title+" · "+(position?fmt(position):"starting at beginning");
  say("Loading the Radio song into your private recording player…");
  void selectPrivateSong(song.url,position,true);
  return;
 }
 // Try to match the live Radio track without playing an unrelated first song.
 if(matchAttemptCount<6){
  get("iamSourceIndicator").textContent="FINDING RADIO SONG";
  get("iamNowPlaying").textContent="Finding the Radio song…";
  say("Checking the current Radio song. You can tap SONGS to choose instead.");
  matchRetryId=setTimeout(()=>{matchRetryId=0;void refreshMatchForStudio()},950);
 }else{
  get("iamSourceIndicator").textContent="RADIO SONG NOT AVAILABLE";
  get("iamNowPlaying").textContent="Tap SONGS to choose music";
  say("The current Radio song cannot be matched. Tap SONGS to select a track.");
 }
}
async function preflight(timeout=4500){
 const samples=new Uint8Array(musicMeter.fftSize),end=performance.now()+timeout;
 while(open&&performance.now()<end){
  musicMeter.getByteTimeDomainData(samples);
  if(samples.some(n=>Math.abs(n-128)>=2))return true;
  await new Promise(r=>setTimeout(r,110));
 }
 return false;
}
// Request microphone immediately from the I AM or YOU button gesture,
 // while the private song connects. Do not wait for buffering or metadata.
 function primeMic(){
  if(!open)return Promise.resolve(null);
  const usable=micStream?.active&&micStream.getAudioTracks?.().some(t=>t.readyState==="live"&&t.enabled!==false);
  if(usable)return Promise.resolve(micStream);
  if(micPromise)return micPromise;
  micError="";micConnected=false;micProcessingFallback=false;
  const requestId=++micRequestToken;
  micPromise=(async()=>{
   let stream=null;
   try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("Safari microphone access unavailable. Open the HTTPS website directly in Safari.");
    const musicProfile={echoCancellation:false,noiseSuppression:false,autoGainControl:false};
    try{stream=await navigator.mediaDevices.getUserMedia({audio:musicProfile})}
    catch(err){
     // Only retry unsupported-constraint errors. Permission denial should
     // remain a single, clear request rather than repeatedly prompting.
     if(!["OverconstrainedError","TypeError","NotSupportedError"].includes(String(err?.name||"")))throw err;
     micProcessingFallback=true;
     stream=await navigator.mediaDevices.getUserMedia({audio:true});
    }
    if(!open||requestId!==micRequestToken){
     stream.getTracks().forEach(t=>t.stop());return null;
    }
    if(!stream.active||!stream.getAudioTracks?.().length)throw new Error("No live microphone audio track");
    micStream=stream;
    const track=stream.getAudioTracks()[0];
    track.addEventListener?.("ended",()=>{
     if(!open)return;
     micConnected=false;micError="Microphone disconnected. Tap YOU to reconnect.";
     say(micError);
    });
    return stream;
   }catch(err){
    if(stream)try{stream.getTracks().forEach(t=>t.stop())}catch(_e){}
    if(!open||requestId!==micRequestToken)return null;
    const name=String(err?.name||"");
    micError=(name==="NotAllowedError"||name==="PermissionDeniedError"||name==="SecurityError")
      ?"Microphone permission denied. Allow the mic for this website in Safari, then tap YOU to retry."
      :(name==="NotFoundError"?"No microphone detected. Connect or enable a microphone and tap YOU.":"Microphone error: "+errorString(err)+". Tap YOU to retry.");
    say(micError);
    return null;
   }finally{
    if(requestId===micRequestToken)micPromise=null;
   }
  })();
  return micPromise;
 }
 async function activateMic(){
  if(!open||!ctx)return false;
  if(micConnected&&voiceMeter&&micStream?.active)return true;
  // A rejected permission request is not repeated automatically after song
  // buffering; only another explicit tap on YOU retries it.
  if(micError&&!micStream?.active)return false;
  const stream=await (micStream?.active?Promise.resolve(micStream):primeMic());
  if(!stream||!open||!ctx)return false;
  try{
   // Safari may suspend the existing audio context when mic permissions or
   // the audio output route change.
   if(ctx.state!=="running")await ctx.resume();
   try{micSourceNode?.disconnect()}catch(_e){}
   const node=ctx.createMediaStreamSource(stream);micSourceNode=node;
   voiceInput=ctx.createGain();dryGain=ctx.createGain();compressedGain=ctx.createGain();
   voiceOutput=ctx.createGain();compressor=ctx.createDynamicsCompressor();
   compressor.threshold.value=-27;compressor.knee.value=12;compressor.ratio.value=4;
   compressor.attack.value=.005;compressor.release.value=.16;
   voiceMeter=ctx.createAnalyser();voiceMeter.fftSize=1024;
   voiceData=new Uint8Array(voiceMeter.fftSize);
   micFloatData=new Float32Array(voiceMeter.fftSize);
   // Some iPhone/headset inputs report stereo but only carry voice on LEFT.
   // Explicit downmix converts it to one dry MONO vocal before recording,
   // effects and monitoring; the output then upmixes to both headphones.
   micMonoNode=ctx.createGain();
   micMonoNode.channelCount=1;micMonoNode.channelCountMode="explicit";
   micMonoNode.channelInterpretation="speakers";
   node.connect(micMonoNode);
   micMonoNode.connect(voiceDest);micMonoNode.connect(voiceInput);
   voiceInput.channelCount=1;voiceInput.channelCountMode="explicit";
   voiceInput.connect(voiceMeter);voiceInput.connect(dryGain);
   voiceInput.connect(compressor);compressor.connect(compressedGain);
   const blend=ctx.createGain();dryGain.connect(blend);compressedGain.connect(blend);
   blend.connect(voiceOutput);
   fxDelay=ctx.createDelay(1.5);fxWet=ctx.createGain();fxFeedback=ctx.createGain();
   blend.connect(fxDelay);fxDelay.connect(fxWet);fxWet.connect(voiceOutput);
   fxDelay.connect(fxFeedback);fxFeedback.connect(fxDelay);
   voiceOutput.connect(mixDest);
   monitorGain=ctx.createGain();
   monitorGain.channelCount=1;monitorGain.channelCountMode="explicit";
   voiceOutput.connect(monitorGain);monitorGain.connect(ctx.destination);
   // Keep the muted microphone graph rendering on iPhone without audible bleed.
   const keepAlive=ctx.createGain();keepAlive.gain.value=.000001;
   voiceInput.connect(keepAlive);keepAlive.connect(ctx.destination);
   outputSettings();effectSettings();micConnected=true;micError="";
   micAttachedAt=performance.now();lastMicSignalAt=0;micDetected=false;micSilenceWarned=false;micStrongFrames=0;
   updateRecordReady();
   const track=stream.getAudioTracks?.()[0];
   const name=track?.label||"iPhone microphone";
   say("Mic connected: "+name+". Speak until the YOU meter shows SIGNAL. Recording will enable after a real signal.");
   return true;
  }catch(err){
   micConnected=false;micError="Could not connect mic to studio: "+errorString(err)+". Tap YOU to retry.";
   say(micError);return false;
  }
 }
 async function preparePrivate(){
 if(loading||!open)return;
 loading=true;const token=++sessionToken;
 say("Radio stopped. Preparing the private recording player.");
 try{
  const selection=sourceSelection();
  if(token!==sessionToken||!open)return;
  sourceURL=selection.url||"";privateAudio=new Audio();
  privateAudio.crossOrigin="anonymous";privateAudio.playsInline=true;privateAudio.preload="auto";
  if(selection.url){privateAudio.src=selection.url;privateAudio.load();}
  createMusicGraph();musicSignalError="";musicHandoffDone=false;
  // Mic is connected independently of song metadata / Radio buffering.
  void activateMic();
  const wake=ctx.resume().then(()=>null,e=>e);
  if(selection.kind==="radio-unmatched"){
   get("iamSourceIndicator").textContent="FINDING RADIO SONG";
   get("iamNowPlaying").textContent="Loading dedicated I AM player…";
   say("Radio stopped. Finding the song for your recording session.");
   void refreshMatchForStudio();
   await wake;
   return;
  }
  const playback=privateAudio.play().then(()=>null,e=>e);
  if(selection.kind!=="live-radio"){
   await new Promise(r=>{
    if(privateAudio.readyState>=1)return r();
    const done=()=>r();privateAudio.addEventListener("loadedmetadata",done,{once:true});setTimeout(done,1800);
   });
   let pos=selection.precise?(Number(audio.currentTime)||selection.position):selection.position;
   if(Number.isFinite(privateAudio.duration)&&privateAudio.duration>0)pos=clamp(pos,0,privateAudio.duration-.04);
   try{privateAudio.currentTime=pos}catch(_e){}
  }
  if(!open||token!==sessionToken)return;
  const wakeError=await wake,playError=await playback;
  if(wakeError)throw wakeError;
  if(playError)throw playError;
  const hasMusic=await preflight(3800);
  if(!open||token!==sessionToken)return;
  if(!hasMusic){
   verified=false;updateRecordReady();
   musicSignalError="Catalog song audio could not be captured. Try NEXT or SONGS.";
   get("iamSourceIndicator").textContent="MUSIC NOT CAPTURING · ORIGINAL RADIO UNCHANGED";
   say(musicSignalError+(micConnected?" YOU is connected.":" Tap YOU to enable microphone."));
   return; // Preserve microphone permission and the music graph for recovery.
  }
  musicSignalError="";musicHandoffDone=true;
  const matcher=get("iamMatchRadioSong");if(matcher)matcher.hidden=true;
  audio.muted=true;
  musicOutput.gain.setTargetAtTime(1,ctx.currentTime,.05);
  if(studioMusicStopped){privateAudio.pause();audio.pause();}
  get("iamSourceIndicator").textContent=selection.kind==="catalog-fallback"?"PRIVATE SONG · CATALOG FALLBACK (RADIO NOT MATCHED)":
   selection.precise?"PRIVATE · SAME SONG / POSITION":"RADIO SONG → PLAYER · ESTIMATED POSITION";
  get("iamNowPlaying").textContent=selection.title||displayTitle(selection.url,false)||"Private Radio";
  get("titleBtn").textContent=selection.title||displayTitle(selection.url,false)||"PRIVATE RADIO";
  verified=true;
  syncPrivateTransport();
  const connected=await activateMic();
  updateRecordReady();
  if(connected&&micDetected&&!selection.precise)say("Private music and YOU microphone signal ready.");
  else if(connected)say("Private music ready. Speak to confirm YOUR mic signal before recording.");
  if(!connected&&micError)say(micError);
 }catch(err){
  say("I AM handoff failed: "+String(err?.message||err));
  audio.muted=oldMuted;
  verified=false;await disposeAudio();
 }finally{
  loading=false;
  if(open)updateRecordReady();
 }
}
async function disposeAudio(){
 ++micRequestToken;micPromise=null;micConnected=false;micDetected=false;
 micAttachedAt=0;lastMicSignalAt=0;
 musicSignalError="";musicHandoffDone=false;verified=false;
 try{micSourceNode?.disconnect()}catch(_e){}micSourceNode=null;
 try{micMonoNode?.disconnect()}catch(_e){}micMonoNode=null;
 try{privateAudio?.pause()}catch(_e){}
 if(micStream)micStream.getTracks().forEach(t=>t.stop());
 micStream=null;privateAudio=null;
 recorderReady=false;recorderPrewarming=false;
 recMusic=null;recVoice=null;recMix=null;
 try{await ctx?.close()}catch(_e){}
 ctx=null;musicInput=null;musicGain=null;musicOutput=null;musicMeter=null;voiceMeter=null;micFloatData=null;micStrongFrames=0;
 musicData=null;voiceData=null;musicDest=null;voiceDest=null;mixDest=null;
 voiceInput=null;voiceOutput=null;compressor=null;monitorGain=null;verified=false;
}

function stopMicTest(){
 if(micTestTimer){clearTimeout(micTestTimer);micTestTimer=0}
 if(!micTestRunning)return;
 micTestRunning=false;
 try{if(micTestRecorder?.state==="recording")micTestRecorder.stop()}catch(err){
  say("Mic test could not stop: "+errorString(err));
 }
}
function startMicTest(){
 if(!open||recording||recordArming){
  say("Stop the current recording before testing the mic.");return;
 }
 if(!micStream?.active||!micConnected){
  say("Mic is not connected. Tap YOU to reconnect, then try TEST MIC.");return;
 }
 if(!window.MediaRecorder){say("This browser cannot record a microphone test.");return}
 stopReview();
 if(micTestAudio){micTestAudio.pause();micTestAudio=null}
 if(micTestBlob?.url){URL.revokeObjectURL(micTestBlob.url)}
 micTestBlob=null;micTestChunks=[];
 get("iamMicTestPlayBtn").hidden=true;
 // Isolate the mic: no music bleed. Don't silently restart Radio afterward.
 studioMusicStopped=true;
 try{privateAudio?.pause()}catch(_e){}
 try{if(state.live&&pauseRadio)pauseRadio();else audio.pause()}catch(_e){}
 syncPrivateTransport();
 try{
  const mime=recordMime();
  const rec=mime?new MediaRecorder(micStream,{mimeType:mime}):new MediaRecorder(micStream);
  micTestRecorder=rec;micTestRunning=true;
  rec.ondataavailable=e=>{if(e.data?.size)micTestChunks.push(e.data)};
  rec.onerror=e=>{say("Mic test error: "+errorString(e.error||e));stopMicTest()};
  rec.onstop=()=>{
   micTestRunning=false;micTestRecorder=null;
   const startButton=get("iamMicTestBtn");if(startButton)startButton.textContent="TEST MIC";
   const blob=new Blob(micTestChunks,{type:rec.mimeType||"audio/mp4"});
   if(!open)return;
   if(!blob.size){say("TEST MIC returned no audio. Check iPhone mic permission.");return}
   const url=URL.createObjectURL(blob);
   micTestBlob={blob,url};
   get("iamMicTestPlayBtn").hidden=false;
   updateRecordReady();
   say("Microphone-only test is ready. Tap PLAY MIC to listen. Music stays paused.");
  };
  rec.start();
  get("iamMicTestBtn").textContent="STOP TEST";
  updateRecordReady();
  say("TEST MIC: Sing or speak for 3 seconds. No music will play during the test.");
  micTestTimer=setTimeout(stopMicTest,3200);
 }catch(err){
  micTestRunning=false;
  get("iamMicTestBtn").textContent="TEST MIC";
  updateRecordReady();
  say("Mic test could not begin: "+errorString(err));
 }
}
function playMicTest(){
 if(!open||micTestRunning||!micTestBlob)return;
 try{
  if(!micTestAudio){
   micTestAudio=new Audio();
   micTestAudio.playsInline=true;micTestAudio.src=micTestBlob.url;
  }
  micTestAudio.currentTime=0;micTestAudio.volume=1;
  // The direct HTMLAudioElement test bypasses the I AM WebAudio monitor.
  // If this speaks clearly but HEAR ME does not, the monitor route is faulty.
  void micTestAudio.play().then(()=>{
   say("Playing raw microphone test. If this is clear, the microphone works and live monitoring is the problem.");
  }).catch(err=>say("Microphone test playback failed: "+errorString(err)));
 }catch(err){say("Microphone test playback failed: "+errorString(err))}
}

function recordMime(){
 const m=["audio/mp4","audio/webm;codecs=opus","audio/webm"];
 return m.find(type=>MediaRecorder.isTypeSupported?.(type))||"";
}
function recorder(dest,key){
 const mime=recordMime();
 const r=mime?new MediaRecorder(dest.stream,{mimeType:mime}):new MediaRecorder(dest.stream);
 chunks[key]=[];
 r.ondataavailable=e=>{
  if(e.data?.size>0)chunks[key].push(e.data);
 };
 return r;
}
function prepareRecorders(){
 if(recorderReady||recorderPrewarming||recording||!verified||!micConnected||!micDetected||!micStream?.active)return;
 if(!window.MediaRecorder){say("This browser cannot record studio audio.");return}
 recorderPrewarming=true;
 try{
  // Mixed recording is FIRST and REQUIRED. Safari may not sustain all three
  // encoders; failure of an optional stem must never sacrifice the mix.
  recMix=recorder(mixDest,"mix");
  recMusic=null;recVoice=null;
  try{recMusic=recorder(musicDest,"music")}catch(_e){}
  try{recVoice=recorder(voiceDest,"voice")}catch(_e){}
  recorderReady=true;
  say("Recording ready. MUSIC + YOU mixed audio will be captured first.");
 }catch(err){
  recMix=null;recorderReady=false;say("Cannot prepare mixed recording: "+errorString(err));
 }finally{recorderPrewarming=false}
}
function assemble(key,r){
 const parts=chunks[key]||[];
 if(!parts.length)return null;
 const blob=new Blob(parts,{type:r?.mimeType||recordMime()||"audio/mp4"});
 return blob.size>0?blob:null;
}
async function beginTake(){
 if(recording||recordArming||recordFinishing)return;
 if(!open||loading||micTestRunning||!ctx||!verified||!micConnected||!micStream?.active){
  say(micError||"I AM music or microphone isn't ready yet. Tap YOU if your mic is disconnected.");return;
 }
 if(!window.MediaRecorder){say("Recording is unsupported in this browser.");return}
 recordArming=true;updateRecordReady();stopReview();
 try{
  if(ctx.state!=="running")await ctx.resume();
  if(privateAudio?.paused){
   say("Starting song before Record…");
   await privateAudio.play();
  }
  if(!micDetected)throw Error("Speak into YOU to verify an input level, then press Record.");

  if(!recorderReady)prepareRecorders();
  if(!recMix||!recorderReady)throw Error("The mixed recording encoder is not ready");
  const clock=ctx.currentTime,offsets={},pressedAt=performance.now();
  // Start the playable mixed take BEFORE optional separate stems on iPhone.
  recMix.start();offsets.mix=ctx.currentTime-clock;
  for(const [r,key] of [[recMusic,"music"],[recVoice,"voice"]]){
   if(!r)continue;
   try{r.start();offsets[key]=ctx.currentTime-clock}
   catch(_e){
    if(key==="music")recMusic=null;else recVoice=null;
   }
  }
  recorderReady=false;recordArming=false;
  takeMeta={version:3,id:new Date().toISOString(),source:sourceURL,mode:sourceMode,
   sourcePosition:privateAudio.currentTime,clockStart:clock,offsets,
   encoderStartMilliseconds:Math.round(performance.now()-pressedAt),
   music:value(E.music),voice:value(E.voice),gain:value(E.gain),compression:value(E.compression),
   effect:fxMode,approximate:sourceMode==="radio"};
  startedAt=pressedAt/1000;recording=true;
  document.body.classList.remove("iam-take-error");
  mode("recording");
  say("RECORDING · MIX first"+(recMusic&&recVoice?" · dry YOU + MUSIC stems":" · separate stems may be unavailable")+".");
 }catch(err){
  recordArming=false;recorderReady=false;
  for(const r of [recMix,recMusic,recVoice])try{if(r?.state==="recording")r.stop()}catch(_e){}
  say("Recording could not start: "+errorString(err));
  mode("record");updateRecordReady();
 }
}
function stopOne(r,key){
 return new Promise(resolve=>{
  if(!r){take[key]=null;resolve({key,ok:false,why:"recorder unavailable"});return}
  let completed=false;
  const finish=why=>{
   if(completed)return;
   completed=true;clearTimeout(watchdog);
   // Some WebKit versions deliver the final data event in the next task
   // after 'stop'. Give it an additional tick before assembling the blob.
   setTimeout(()=>{
    take[key]=assemble(key,r);
    resolve({key,ok:!!take[key],bytes:take[key]?.size||0,why});
   },80);
  };
  const watchdog=setTimeout(()=>finish("recorder timeout"),9500);
  r.addEventListener("stop",()=>finish("stopped"),{once:true});
  r.addEventListener("error",e=>finish("error: "+errorString(e?.error||e)),{once:true});
  if(r.state==="inactive"){finish("already inactive");return}
  // Calling requestData() immediately before stop() can yield empty/invalid
  // fragments on Safari. stop() already flushes the final chunk.
  try{r.stop()}catch(err){finish(errorString(err))}
 });
}
async function recoverMixFromStems(){
 if(!take.music||!take.voice)return null;
 const AC=window.AudioContext||window.webkitAudioContext;
 const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
 if(!AC||!Offline)return null;
 let decoder=null;
 try{
  decoder=new AC();
  const encoded=await Promise.all([take.music.arrayBuffer(),take.voice.arrayBuffer()]);
  const [music,voice]=await Promise.all(encoded.map(buf=>decoder.decodeAudioData(buf)));
  const length=Math.max(music.duration,voice.duration);
  if(!(length>0&&length<=120))return null;
  const rate=44100,off=new Offline(2,Math.ceil((length+.08)*rate),rate);
  const sm=off.createBufferSource(),sv=off.createBufferSource(),gm=off.createGain(),gv=off.createGain();
  sm.buffer=music;sv.buffer=voice;
  gm.gain.value=clamp(value(E.music)/100,0,1.5);
  gv.gain.value=clamp(value(E.voice)*value(E.gain)/10000,0,4);
  sm.connect(gm);gm.connect(off.destination);sv.connect(gv);gv.connect(off.destination);
  sm.start(.012);sv.start(.012);
  const output=await off.startRendering(),frames=output.length,bytes=new ArrayBuffer(44+frames*4),v=new DataView(bytes);
  const write=(offset,txt)=>{for(let i=0;i<txt.length;i++)v.setUint8(offset+i,txt.charCodeAt(i))};
  write(0,"RIFF");v.setUint32(4,36+frames*4,true);write(8,"WAVE");write(12,"fmt ");
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
  v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);
  v.setUint16(32,4,true);v.setUint16(34,16,true);write(36,"data");v.setUint32(40,frames*4,true);
  const left=output.getChannelData(0),right=output.getChannelData(1);
  for(let i=0;i<frames;i++){
   const a=clamp(left[i],-1,1),b=clamp(right[i],-1,1);
   v.setInt16(44+i*4,a<0?a*32768:a*32767,true);
   v.setInt16(46+i*4,b<0?b*32768:b*32767,true);
  }
  return new Blob([bytes],{type:"audio/wav"});
 }catch(err){savedWarning="Could not rebuild a playback file: "+errorString(err);return null}
 finally{try{await decoder?.close()}catch(_e){}}
}
function showTakeReady(duration){
 const old=E.take.src||"";
 const next=URL.createObjectURL(take.mix);
 E.take.pause();E.take.removeAttribute("src");
 E.take.src=next;E.take.preload="metadata";E.take.controls=true;
 E.take.muted=false;E.take.volume=1;
 try{E.take.load()}catch(_e){}
 if(old.startsWith("blob:"))URL.revokeObjectURL(old);
 document.body.classList.remove("iam-take-error");
 document.body.classList.add("iam-has-take");
 E.timer.textContent=fmt(duration);mode("play");
 const hasStems=!!(take.voice&&take.music);
 say("TAKE READY ("+Math.round(take.mix.size/1024)+" KB) · Tap LISTEN AGAIN or the audio player. "+(hasStems?"EDIT and TRY AGAIN are ready.":"TRY AGAIN is ready; separate stems are incomplete."));
 if(hasStems){
  void saveTake().then(()=>{if(open&&take.mix&&!reviewing&&!editing)say(savedWarning||"Take saved. Tap LISTEN AGAIN, TRY AGAIN, or EDIT.")});
 }
}
async function stopTake(){
 if(!recording||recordFinishing)return;
 recordFinishing=true;
 try{
 recording=false;E.record.disabled=true;recorderReady=false;
 try{privateAudio?.pause()}catch(_e){}
 studioMusicStopped=true;syncPrivateTransport();
 const duration=performance.now()/1000-startedAt;
 say("STOPPED · Finalizing the audio file. Please wait…");
 // Prioritize an independently playable mix; optional stems can finish later.
 const mixResult=await stopOne(recMix,"mix");
 if(takeMeta)takeMeta.duration=duration;
 if(take.mix)showTakeReady(duration);
 else{
  say("Mixed recording failed ("+mixResult.why+"). Checking raw tracks…");
 }
 const [musicResult,voiceResult]=await Promise.all([stopOne(recMusic,"music"),stopOne(recVoice,"voice")]);
 if(!take.mix&&take.music&&take.voice){
  say("Rebuilding a playable recording from the raw MUSIC and YOU tracks…");
  take.mix=await recoverMixFromStems();
  if(take.mix)showTakeReady(duration);
 }
 if(!take.mix){
  // The interface still offers a reset even if iOS failed to produce a blob.
  document.body.classList.remove("iam-has-take");
  document.body.classList.add("iam-take-error");
  mode("record");
  E.timer.textContent=fmt(duration);
  say("NO PLAYABLE MIX FROM SAFARI · MUSIC "+(musicResult.bytes||0)+" B, YOU "+(voiceResult.bytes||0)+" B, MIX "+(mixResult.bytes||0)+" B. Tap TRY AGAIN.");
 }else if(take.mix&&take.music&&take.voice){
  // Mixed playback was already released; optional stems have now finished.
  // Make EDIT available only after both originals are present.
  if(!reviewing){
   mode("play");
   say("TAKE READY · LISTEN AGAIN, TRY AGAIN, and EDIT are available.");
  }
  if(mixResult.ok)void saveTake();
 }else if(take.mix&&open&&!reviewing){
  say("Take playable ("+Math.round(take.mix.size/1024)+" KB). Separate stems missing · LISTEN AGAIN and TRY AGAIN work.");
 }
 }catch(err){
  document.body.classList.add("iam-take-error");
  mode("record");
  say("Safari stopped finalizing this take: "+errorString(err)+". Tap TRY AGAIN. Any previously saved take remains available.");
 }finally{
  recordFinishing=false;updateRecordReady();
 }
}
async function saveTake(){
 savedWarning="";
 // Keep the finalized take stable if TRY AGAIN starts while storage is writing.
 const snapshot={id:takeMeta?.id,meta:takeMeta,music:take.music,voice:take.voice,mix:take.mix};
 if(!snapshot.id||!snapshot.mix)return;
 try{
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open("ge-iam-sessions-v2",1);
   req.onupgradeneeded=()=>req.result.createObjectStore("takes",{keyPath:"id"});
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  await new Promise((resolve,reject)=>{
   const tx=db.transaction("takes","readwrite");
   tx.objectStore("takes").put(snapshot);
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
  db.close();
 }catch(err){savedWarning="Take still in memory; permanent save failed. Export all stems now. "+errorString(err)}
}
async function restoreLatest(){
 try{
  const db=await new Promise((resolve,reject)=>{
   const q=indexedDB.open("ge-iam-sessions-v2",1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
  });
  const obj=await new Promise((resolve,reject)=>{
   const req=db.transaction("takes").objectStore("takes").openCursor(null,"prev");
   req.onsuccess=()=>resolve(req.result?.value||null);req.onerror=()=>reject(req.error);
  });
  db.close();
  if(!obj){say("No saved private take on this device.");return}
  take={music:obj.music,voice:obj.voice,mix:obj.mix};takeMeta=obj.meta;
  resetEditorForNewTake();
  if(Number.isFinite(Number(takeMeta?.vocalShiftMs)))editVocalShift=clamp(takeMeta.vocalShiftMs,-250,250);
  editMute=Array.isArray(takeMeta?.editor?.muted)?takeMeta.editor.muted.map(p=>p.slice(0,2)):[];
  editKeep=Array.isArray(takeMeta?.editor?.keep)?takeMeta.editor.keep.slice(0,2):null;
  const old=E.take.src;E.take.src=URL.createObjectURL(take.mix);
  if(old.startsWith("blob:"))URL.revokeObjectURL(old);
  mode("play");document.body.classList.add("iam-has-take");
  say("Latest saved private recording restored.");
 }catch(err){say("Could not restore take: "+errorString(err))}
}
async function exportEdited(){
 if(!take.music||!take.voice){say("Save a raw MUSIC and YOU take before creating an edited mix.");return}
 const elButton=get("iamExportEdited");
 if(elButton)elButton.disabled=true;
 say("Rendering an edited mix from the original clean tracks…");
 let decodeCtx=null;
 try{
  const AC=window.AudioContext||window.webkitAudioContext;
  const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!AC||!Offline)throw Error("Offline audio rendering unavailable in this browser");
  decodeCtx=new AC();
  const [musicBytes,voiceBytes]=await Promise.all([take.music.arrayBuffer(),take.voice.arrayBuffer()]);
  const [musicBuffer,voiceBuffer]=await Promise.all([decodeCtx.decodeAudioData(musicBytes),decodeCtx.decodeAudioData(voiceBytes)]);
  const starts=syncedStarts(.012),duration=Math.max(starts.music+musicBuffer.duration,starts.voice+voiceBuffer.duration)+.15;
  if(duration>180)throw Error("Edited WAV export currently supports recordings up to 3 minutes on phones. Original stems can still be saved.");
  const rate=44100,len=Math.ceil(duration*rate);
  const off=new Offline(2,len,rate);
  const song=off.createBufferSource(),voice=off.createBufferSource();
  song.buffer=musicBuffer;voice.buffer=voiceBuffer;
  const mGain=off.createGain(),vGain=off.createGain(),vMask=off.createGain();
  mGain.gain.value=clamp(value(E.music)/100,0,1.5);
  vGain.gain.value=clamp(value(E.voice)/100*value(E.gain)/100,0,3);
  const raw=off.createGain(),compressed=off.createGain(),compNode=off.createDynamicsCompressor();
  const compression=clamp(value(E.compression)/100,0,1);
  raw.gain.value=1-compression;compressed.gain.value=compression;
  compNode.threshold.value=-27;compNode.knee.value=12;compNode.ratio.value=4;
  compNode.attack.value=.005;compNode.release.value=.16;
  const voiceOut=off.createGain(),delayNode=off.createDelay(1.5),wet=off.createGain(),feedback=off.createGain();
  let delayTime=.01,wetAmount=0,fb=0;
  if(fxMode==="space"){delayTime=.17;wetAmount=.2;fb=.17}
  if(fxMode==="echo"){delayTime=.34;wetAmount=.36;fb=.28}
  delayNode.delayTime.value=delayTime;wet.gain.value=wetAmount;feedback.gain.value=fb;
  song.connect(mGain);mGain.connect(off.destination);
  voice.connect(vMask);vMask.connect(vGain);
  vGain.connect(raw);vGain.connect(compNode);compNode.connect(compressed);
  raw.connect(voiceOut);compressed.connect(voiceOut);
  raw.connect(delayNode);compressed.connect(delayNode);
  delayNode.connect(wet);wet.connect(voiceOut);delayNode.connect(feedback);feedback.connect(delayNode);
  voiceOut.connect(off.destination);
  applyVocalEnvelope(vMask,starts.voice,voiceBuffer.duration);
  song.start(starts.music);voice.start(starts.voice);
  const result=await off.startRendering();
  const frames=result.length;
  const bytes=new ArrayBuffer(44+frames*4),view=new DataView(bytes);
  const writeText=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))};
  writeText(0,"RIFF");view.setUint32(4,36+frames*4,true);writeText(8,"WAVE");writeText(12,"fmt ");
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);
  view.setUint16(32,4,true);view.setUint16(34,16,true);
  writeText(36,"data");view.setUint32(40,frames*4,true);
  const l=result.getChannelData(0),r=result.getChannelData(1);
  for(let i=0;i<frames;i++){
   const a=clamp(l[i],-1,1),b=clamp(r[i],-1,1);
   view.setInt16(44+i*4,a<0?a*32768:a*32767,true);
   view.setInt16(46+i*4,b<0?b*32768:b*32767,true);
  }
  const wav=new Blob([bytes],{type:"audio/wav"});
  const url=URL.createObjectURL(wav),link=document.createElement("a");
  link.href=url;link.download="Grand-Element-I-AM-EDITED-"+Date.now()+".wav";
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),6000);
  say("Edited WAV exported. Original dry YOU, music, and first mix are unchanged.");
 }catch(err){say("Edited mix: "+errorString(err))}
 finally{try{await decodeCtx?.close()}catch(_e){};if(elButton)elButton.disabled=false;}
}
function exportAudio(key){
 const blob=take[key];if(!blob){say("Record a take before exporting this track.");return}
 const ext=blob.type.includes("wav")?"wav":blob.type.includes("mp4")?"m4a":"webm",url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;
 a.download="Grand-Element-I-AM-"+key+"-"+Date.now()+"."+ext;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function stopReview(){
 if(reviewSources.length){for(const s of reviewSources)try{s.stop()}catch(_e){};reviewSources=[]}
 try{reviewCtx?.close()}catch(_e){}
 reviewCtx=null;reviewNodes=null;E.take.pause();reviewing=false;
 if(musicOutput&&ctx)musicOutput.gain.setTargetAtTime(1,ctx.currentTime,.065);
 if(take.mix)mode("play");
}
async function listenTake(){
 if(!take.mix)return;
 if(reviewing){stopReview();return}
 if(musicOutput&&ctx)musicOutput.gain.setTargetAtTime(0,ctx.currentTime,.055);
 if(!editing){
  try{
   E.take.currentTime=0;await E.take.play();
   reviewing=true;mode("playing");
   say("Playing your recording. Tap STOP PLAYBACK to stop.");
  }catch(err){say("Review unavailable: "+errorString(err));stopReview()}
  return;
 }
 try{
  const AC=window.AudioContext||window.webkitAudioContext;
  reviewCtx=new AC();await reviewCtx.resume();
  const buffers=await Promise.all([take.music.arrayBuffer(),take.voice.arrayBuffer()]);
  const [musicBuffer,voiceBuffer]=await Promise.all(buffers.map(x=>reviewCtx.decodeAudioData(x)));
  const rm=reviewCtx.createGain(),rv=reviewCtx.createGain(),vMask=reviewCtx.createGain();
  const dry=reviewCtx.createGain(),wet=reviewCtx.createGain(),comp=reviewCtx.createDynamicsCompressor();
  comp.threshold.value=-27;comp.knee.value=12;comp.ratio.value=4;comp.attack.value=.005;comp.release.value=.16;
  const delay=reviewCtx.createDelay(1.5),fxWet=reviewCtx.createGain(),feedback=reviewCtx.createGain();
  rm.connect(reviewCtx.destination);
  rv.connect(dry);rv.connect(comp);comp.connect(wet);
  dry.connect(reviewCtx.destination);wet.connect(reviewCtx.destination);
  dry.connect(delay);wet.connect(delay);delay.connect(fxWet);fxWet.connect(reviewCtx.destination);
  delay.connect(feedback);feedback.connect(delay);
  reviewNodes={music:rm,voice:rv,dry,wet,delay,fxWet,feedback};
  outputSettings();effectSettings();
  const mb=reviewCtx.createBufferSource(),vb=reviewCtx.createBufferSource();
  mb.buffer=musicBuffer;vb.buffer=voiceBuffer;mb.connect(rm);vb.connect(vMask);vMask.connect(rv);
  const starts=syncedStarts(reviewCtx.currentTime+.06);
  applyVocalEnvelope(vMask,starts.voice,voiceBuffer.duration);
  mb.start(starts.music,0);vb.start(starts.voice,0);
  reviewSources=[mb,vb];reviewClock=Math.min(starts.music,starts.voice);
  mb.onended=()=>{if(reviewing)stopReview()};
  reviewing=true;mode("playing");
  say("EDIT preview with voice "+(editVocalShift>0?"+":"")+editVocalShift+" ms and selected vocal edits. Tap PLAY EDIT again to stop.");
 }catch(err){say("Raw-stem playback failed: "+errorString(err));stopReview()}
}

function editFormat(t){return Math.max(0,t).toFixed(2)+" s"}
function editDuration(){
 return Math.max(Number(editWaveBuffers?.music?.duration)||0,Number(editWaveBuffers?.voice?.duration)||0,Number(takeMeta?.duration)||0,1);
}
function editorView(){
 const total=editDuration(),visible=total/clamp(editZoom,1,16);
 return {total,visible,start:clamp(editPan,0,1)*Math.max(0,total-visible)};
}
function currentVoiceShift(){
 return clamp(Number(editVocalShift)||0,-250,250);
}
function syncedStarts(base=0){
 // Preserve sample-relative start offsets of the ORIGINAL recording.
 // Negative shift means the vocal should be heard earlier.
 const offsets=takeMeta?.offsets||{};
 const delta=(Number(offsets.voice)||0)-(Number(offsets.music)||0)+currentVoiceShift()/1000;
 return {music:base+Math.max(0,-delta),voice:base+Math.max(0,delta)};
}
function editingRanges(duration){
 const d=Math.max(0,Number(duration)||0),intervals=editMute
  .map(x=>[clamp(x[0],0,d),clamp(x[1],0,d)]);
 if(editKeep){
  intervals.push([0,clamp(editKeep[0],0,d)],[clamp(editKeep[1],0,d),d]);
 }
 const result=[];
 for(const [a,b] of intervals.filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0])){
  const last=result[result.length-1];
  if(last&&a<=last[1])last[1]=Math.max(last[1],b);
  else result.push([a,b]);
 }
 return result;
}
function applyVocalEnvelope(gainNode,start,duration){
 const gain=gainNode.gain;
 gain.setValueAtTime(1,start);
 for(const [a,b] of editingRanges(duration)){
  // Smooth 3-ms boundaries prevent audible clicks without shifting the beat.
  const attack=Math.min(.003,(b-a)/4);
  const enter=start+a,leave=start+b;
  gain.setValueAtTime(1,Math.max(start,enter-attack));
  gain.linearRampToValueAtTime(0,enter+attack);
  gain.setValueAtTime(0,Math.max(enter+attack,leave-attack));
  gain.linearRampToValueAtTime(1,leave+attack);
 }
}
function refreshEditorControls(){
 const zoom=get("iamWaveZoom"),pan=get("iamWavePan"),shift=get("iamVocalShift");
 if(zoom)zoom.value=String(editZoom);
 if(pan)pan.value=String(Math.round(editPan*1000));
 if(shift)shift.value=String(editVocalShift);
 if(get("iamWaveZoomRead"))get("iamWaveZoomRead").textContent=editZoom+"×";
 if(get("iamVocalShiftRead"))get("iamVocalShiftRead").textContent=(editVocalShift>0?"+":"")+editVocalShift+" ms";
 const selection=get("iamSelectionTime");
 if(selection){
  const v=editorView();
  selection.textContent=editSelection?
   "YOU SELECTED: "+editFormat(editSelection[0])+" – "+editFormat(editSelection[1])+
   " · showing "+editFormat(v.start)+" – "+editFormat(v.start+v.visible):
   "Drag across YOU to select vocals · showing "+editFormat(v.start)+" – "+editFormat(v.start+v.visible);
 }
 for(const id of ["iamSilenceRange","iamCropVocal"]){
  const el=get(id);if(el)el.disabled=!editSelection||editSelection[1]-editSelection[0]<.015;
 }
 const undo=get("iamUndoVocal");if(undo)undo.disabled=!editUndo.length;
}
function drawEditorWaveforms(){
 const {visible,start}=editorView();
 const times=syncedStarts(0),vocalOffset=times.voice-times.music;
 for(const key of ["music","voice"]){
  const canvas=get("iamWave"+key),buffer=editWaveBuffers?.[key],pen=canvas?.getContext?.("2d");
  if(!canvas||!pen)continue;
  const w=canvas.width,h=canvas.height;
  pen.clearRect(0,0,w,h);
  pen.fillStyle="#03111d";pen.fillRect(0,0,w,h);
  pen.fillStyle=key==="music"?"#65cfff":"#89f8bd";
  if(buffer){
   const samples=buffer.getChannelData(0),rate=buffer.sampleRate;
   for(let x=0;x<w;x++){
    const shift=key==="voice"?vocalOffset:0;
    const first=Math.max(0,Math.floor((start+x/w*visible-shift)*rate));
    const last=Math.min(samples.length,Math.floor((start+(x+1)/w*visible-shift)*rate));
    let peak=0;
    const step=Math.max(1,Math.floor((last-first)/20));
    for(let i=first;i<last;i+=step)peak=Math.max(peak,Math.abs(samples[i]||0));
    const amp=Math.max(1,Math.min(h*.48,peak*h*.42));
    pen.fillRect(x,h/2-amp,1,amp*2);
   }
  }
  if(key==="voice"){
   for(const [a,b] of editingRanges(Number(buffer?.duration)||editDuration())){
    const x1=(a+vocalOffset-start)/visible*w,x2=(b+vocalOffset-start)/visible*w;
    pen.fillStyle="rgba(248,80,80,.32)";
    pen.fillRect(x1,0,Math.max(0,x2-x1),h);
   }
   if(editSelection){
    const [a,b]=editSelection;
    pen.fillStyle="rgba(255,211,84,.24)";
    pen.fillRect((a+vocalOffset-start)/visible*w,0,(b-a)/visible*w,h);
    pen.strokeStyle="#ffd15e";pen.lineWidth=2;
    for(const t of [a,b]){
     const x=(t+vocalOffset-start)/visible*w;if(x>=0&&x<=w){pen.beginPath();pen.moveTo(x,0);pen.lineTo(x,h);pen.stroke()}
    }
   }
  }
  pen.fillStyle="rgba(203,228,250,.8)";pen.font="10px system-ui";
  pen.fillText(editFormat(start),5,h-5);
  pen.fillText(editFormat(start+visible),Math.max(5,w-75),h-5);
 }
 refreshEditorControls();
}
function pushEditUndo(){
 editUndo.push({mute:editMute.map(pair=>pair.slice()),keep:editKeep?.slice()||null});
 if(editUndo.length>40)editUndo.shift();
}
function onEditorChange(){
 if(reviewing)stopReview();
 if(takeMeta){
  takeMeta.vocalShiftMs=editVocalShift;
  takeMeta.editor={muted:editMute.map(x=>x.slice()),keep:editKeep?.slice()||null};
 }
 drawEditorWaveforms();
}
function persistEditor(){
 onEditorChange();
 if(take?.mix&&takeMeta?.id)void saveTake();
}
function changeVoiceSelection(e,started=false){
 const canvas=get("iamWavevoice");if(!canvas)return;
 const rect=canvas.getBoundingClientRect(),pos=clamp((e.clientX-rect.left)/Math.max(1,rect.width),0,1);
 const {start,visible}=editorView(),times=syncedStarts(0);
 const relative=times.voice-times.music;
 const time=clamp(start+visible*pos-relative,0,Number(editWaveBuffers?.voice?.duration)||editDuration());
 if(started)editDragStart=time;
 if(editDragStart==null)return;
 editSelection=[Math.min(editDragStart,time),Math.max(editDragStart,time)];
 drawEditorWaveforms();
}
function setVocalSelectionAction(kind){
 if(!editSelection||editSelection[1]-editSelection[0]<.015){say("Drag across YOU to select a time range first.");return}
 pushEditUndo();
 if(kind==="silence")editMute.push(editSelection.slice());
 if(kind==="keep")editKeep=editSelection.slice();
 persistEditor();
 say(kind==="silence"?"Selected vocals erased non-destructively. PLAY EDIT to check.":"Only selected vocal section kept; MUSIC remains unchanged. PLAY EDIT to check.");
}
function resetEditorForNewTake(){
 editWaveBuffers=null;editZoom=1;editPan=0;editSelection=null;editDragStart=null;
 editMute=[];editKeep=null;editUndo=[];editVocalShift=-20;
 editLoadToken++;
 refreshEditorControls();
}
async function previewWaves(){
 if(!take.music||!take.voice)return;
 const token=++editLoadToken,AC=window.AudioContext||window.webkitAudioContext;
 if(!AC)return;
 const decode=new AC();
 get("iamSelectionTime").textContent="Building MUSIC and YOU waveforms…";
 try{
  const [a,b]=await Promise.all([take.music.arrayBuffer(),take.voice.arrayBuffer()]);
  const [music,voice]=await Promise.all([decode.decodeAudioData(a),decode.decodeAudioData(b)]);
  if(!open||token!==editLoadToken)return;
  editWaveBuffers={music,voice};drawEditorWaveforms();
 }catch(err){say("Cannot decode waveforms: "+errorString(err))}
 finally{try{await decode.close()}catch(_e){}}
}
function setHeadphones(on,keepManualChoice=false){
 headphones=!!on;
 // Headphone mode starts with live monitoring ON; the HEAR ME button can
 // still disable it. Speaker mode never loops the mic back into speakers.
 if(!keepManualChoice)monitoring=!!on;
 if(!on)monitoring=false;
 get("iamListenHeadphones")?.classList.toggle("selected",on);
 get("iamListenSpeaker")?.classList.toggle("selected",!on);
 get("iamHeadphones")?.classList.toggle("selected",on);
 get("iamHeadphones")?.setAttribute("aria-pressed",on?"true":"false");
 get("iamListenHeadphones")?.setAttribute("aria-pressed",on?"true":"false");
 get("iamListenSpeaker")?.setAttribute("aria-pressed",on?"false":"true");
 E.monitor.disabled=!on;
 E.monitor.textContent="HEAR ME: "+(monitoring?"ON":"OFF");
 E.monitor.setAttribute("aria-pressed",monitoring?"true":"false");
 outputSettings();
}
function editTake(){
 if(!take.mix||!take.music||!take.voice){say("Editing requires both original MUSIC and dry YOU recordings.");return}
 editing=true;document.body.classList.add("iam-edit-open");
 E.panel.classList.add("show");E.sound.setAttribute("aria-expanded","true");
 get("iamStemActions").hidden=false;
 editSelection=null;editUndo=[];editZoom=1;editPan=0;
 editVocalShift=Number.isFinite(Number(takeMeta?.vocalShiftMs))?clamp(takeMeta.vocalShiftMs,-250,250):-20;
 editMute=Array.isArray(takeMeta?.editor?.muted)?takeMeta.editor.muted.map(p=>p.slice(0,2)):[];
 editKeep=Array.isArray(takeMeta?.editor?.keep)?takeMeta.editor.keep.slice(0,2):null;
 refreshEditorControls();
 void previewWaves();
 say("Select part of YOU, zoom, crop or erase it. Adjust VOCAL TIMING and tap PLAY EDIT.");
}
function againTake(){
 const cue=Number(takeMeta?.sourcePosition);
 stopReview();
 if(privateAudio&&Number.isFinite(cue)&&cue>=0){
  try{privateAudio.pause();privateAudio.currentTime=cue}catch(_e){}
 }
 take={music:null,voice:null,mix:null};takeMeta=null;
 resetEditorForNewTake();
 document.body.classList.remove("iam-has-take","iam-edit-open","iam-take-error");editing=false;
 E.panel.classList.remove("show");E.sound?.setAttribute("aria-expanded","false");
 get("iamStemActions").hidden=true;
 recordFinishing=false;recordArming=false;
 E.timer.textContent="00:00";mode("record");
 updateRecordReady();syncPrivateTransport();
 say("Ready to try again from the same song position. Press PLAY, then Record.");
}
async function leave(){
 if(!open)return;
 if(recording)await stopTake();
 stopMicTest();
 if(micTestAudio){try{micTestAudio.pause()}catch(_e){}micTestAudio=null}
 if(micTestBlob?.url){try{URL.revokeObjectURL(micTestBlob.url)}catch(_e){}}
 micTestBlob=null;
 get("iamMicTestPlayBtn").hidden=true;
 get("iamMicTestBtn").textContent="TEST MIC";
 stopReview();
 open=false;sessionToken++;
 if(matchRetryId){clearTimeout(matchRetryId);matchRetryId=0}
 matchInProgress=false;matchAttemptCount=0;radioSuspended=false;
 document.body.classList.remove("iam-studio-open","iam-has-take","iam-edit-open");
 E.launch.setAttribute("aria-expanded","false");
 E.panel.classList.remove("show");E.sound?.setAttribute("aria-expanded","false");
 editing=false;
 removeSun();window.GEHUD?.resumeFromIAm?.();
 // A local file returns at the studio's position; the live stream returns
 // to its still-running original broadcast without seeking or rebuilding it.
 if(sourceMode==="player"&&privateAudio&&!audio.paused&&Number.isFinite(privateAudio.currentTime)){
  try{if(audio.currentSrc===sourceURL||audio.src===sourceURL)audio.currentTime=privateAudio.currentTime}catch(_e){}
 }
 await disposeAudio();audio.muted=oldMuted;
 try{audio.defaultMuted=oldMuted;audio.autoplay=oldMediaAutoplay;audio.volume=oldMediaVolume}catch(_e){}
 // The normal Radio stays paused until PLAY is pressed outside I AM.
 const title=state.live?(window.GELiveMetadata?.getTitle?.()||CONFIG.LIVE_STREAM_TITLE):displayTitle(state.currentURL,!state.shuffle);
 get("titleBtn").textContent=title||"Grand Element Radio";
 hideSongPicker();
 const matcher=get("iamMatchRadioSong");if(matcher)matcher.hidden=true;
 try{if("audioSession" in navigator)navigator.audioSession.type="playback"}catch(_e){}
 mode("record");say("Private I AM session closed.");
}
async function enter(){
 if(open)return;
 oldMuted=audio.muted;oldMediaVolume=Number.isFinite(Number(audio.volume))?Number(audio.volume):1;
 oldMediaAutoplay=audio.autoplay;
 radioStoppedAt=Date.now();matchAttemptCount=0;matchInProgress=false;
 if(matchRetryId){clearTimeout(matchRetryId);matchRetryId=0}
 studioMusicStopped=false;micDetected=false;micSilenceWarned=false;recordArming=false;
 // WebKit needs the simultaneous playback/capture session selected before
 // asking for its microphone. This can change speaker routing on iPhones.
 try{if("audioSession" in navigator)navigator.audioSession.type="play-and-record"}catch(_e){}
 window.GEHUD?.suspendForIAm?.();
 makeSun();open=true;sessionToken++;
 document.body.classList.add("iam-studio-open");
 suspendOriginalRadio();
 E.launch.setAttribute("aria-expanded","true");
 setHeadphones(false);E.record.disabled=true;mode(take.mix?"play":"record");
 const matcher=get("iamMatchRadioSong");if(matcher){matcher.hidden=true;matcher.disabled=true}
 if(take.mix)document.body.classList.add("iam-has-take");
 raf=requestAnimationFrame(meterLoop);
 // Begin microphone permission now, synchronously with the I AM user gesture.
 // Do not await here: music setup and microphone permission proceed in parallel.
 void primeMic();
 await preparePrivate();
}
function hideSongPicker(){
 const picker=get("iamPrivatePicker");if(picker)picker.hidden=true;
}
async function selectPrivateSong(url,position=0,radioMatched=false){
 if(!open||!privateAudio||recording){say("Stop the take before changing songs.");return}
 stopReview();if(take.mix)againTake();hideSongPicker();
 const request=++trackChangeToken;
 sourceURL=url;sourceMode=radioMatched?"radio":"player";
 verified=false;musicSignalError="";E.record.disabled=true;
 const matchButton=get("iamMatchRadioSong");
 if(matchButton)matchButton.hidden=true;
 privateAudio.src=url;privateAudio.load();
 if(position>0){
  const seekToMatch=()=>{
   if(request!==trackChangeToken||!open)return;
   const duration=Number(privateAudio.duration);
   const target=Number.isFinite(duration)&&duration>0?clamp(position,0,Math.max(0,duration-.08)):position;
   try{privateAudio.currentTime=target}catch(_e){}
  };
  if(privateAudio.readyState>=1)seekToMatch();
  else privateAudio.addEventListener("loadedmetadata",seekToMatch,{once:true});
 }
 say("Loading private song…");
 try{
  const wake=ctx.state==="running"?Promise.resolve():ctx.resume();
  const playback=privateAudio.play();
  await Promise.all([wake,playback]);
  if(!(await preflight(4800)))throw new Error("The new song is silent in the recording mixer.");
  if(!open||request!==trackChangeToken)return;
  if(!musicHandoffDone){
   audio.muted=true;
   musicOutput.gain.setTargetAtTime(1,ctx.currentTime,.05);
   musicHandoffDone=true;
   if(studioMusicStopped){privateAudio.pause();audio.pause();}
  }
  verified=true;updateRecordReady();
  const label=displayTitle(url,false)||"Private Song";
  get("titleBtn").textContent=label;get("iamNowPlaying").textContent=label;
  say("Private song ready: "+label+(micConnected?"":" · Tap YOU to enable mic."));
  get("iamSourceIndicator").textContent=radioMatched?"RADIO SONG → PRIVATE PLAYER · APPROXIMATE":"PRIVATE SONG · VERIFIED";
  syncPrivateTransport();
 }catch(err){
  verified=false;E.record.disabled=true;musicSignalError=errorString(err);
  say("Private song not started: "+musicSignalError+". Tap PLAY to retry, or choose SONGS.");
 }
}
function choosePrivateSong(direction){
 if(!open||!privateAudio||recording){say("Stop recording before changing songs.");return}
 const list=allowedCatalog();if(!list.length){say("No catalog tracks available.");return}
 const current=decodeURIComponent(sourceURL.split("/").pop());
 let index=list.findIndex(t=>decodeURIComponent(t.split("/").pop())===current);
 index=(index+(direction==="next"?1:-1)+list.length)%list.length;
 selectPrivateSong(list[index]);
}
function showSongPicker(){
 if(!open)return;
 if(recording){say("Stop recording before choosing another song.");return}
 const list=allowedCatalog(),picker=get("iamPrivatePicker"),holder=get("iamPrivatePickerList");
 if(!picker||!holder)return;
 holder.replaceChildren();
 for(const url of list){
  const button=document.createElement("button");
  button.type="button";button.className="iamPrivateTrackChoice";
  button.textContent=displayTitle(url,false)||decodeURIComponent(url.split("/").pop());
  if(sourceURL===url)button.classList.add("current");
  button.addEventListener("click",()=>selectPrivateSong(url));
  holder.appendChild(button);
 }
 picker.hidden=false;
}
get("iamMicTestBtn")?.addEventListener("click",()=>{
 if(micTestRunning)stopMicTest();else startMicTest();
});
get("iamMicTestPlayBtn")?.addEventListener("click",playMicTest);
get("iamMicRetryBtn")?.addEventListener("click",()=>{
 if(!open)return;
 const working=micConnected&&micStream?.active&&lastMicSignalAt>=micAttachedAt;
 if(working&&ctx?.state==="running"){
  say("YOU microphone signal confirmed. Record when MUSIC is ready.");return;
 }
 try{if(ctx?.state!=="running")void ctx?.resume?.()}catch(_e){}
 try{micSourceNode?.disconnect()}catch(_e){}
 try{micMonoNode?.disconnect()}catch(_e){}
 micSourceNode=null;micMonoNode=null;micConnected=false;micDetected=false;micError="";
 if(micStream)try{micStream.getTracks().forEach(t=>t.stop())}catch(_e){}
 micStream=null;
 const pending=primeMic();
 void pending.then(()=>{if(open&&ctx)void activateMic()});
 say("Reconnecting microphone. Speak to check the YOU meter.");
});
audio.addEventListener("play",()=>{if(open&&radioSuspended)suspendOriginalRadio()});
audio.addEventListener("volumechange",()=>{if(open&&radioSuspended&&!audio.muted){try{audio.muted=true}catch(_e){}}});
E.launch.addEventListener("click",()=>{if(open)void leave();else void enter()});
get("iamExitBtn")?.addEventListener("click",()=>void leave());
E.record.addEventListener("click",()=>{if(recording)void stopTake();else if(take.mix)void listenTake();else beginTake()});

const voiceCanvas=get("iamWavevoice");
voiceCanvas?.addEventListener("pointerdown",e=>{
 if(!editing||!editWaveBuffers?.voice)return;
 editDragging=true;changeVoiceSelection(e,true);
 try{voiceCanvas.setPointerCapture(e.pointerId)}catch(_e){}
 e.preventDefault();
});
voiceCanvas?.addEventListener("pointermove",e=>{
 if(!editDragging)return;
 changeVoiceSelection(e);e.preventDefault();
});
const finishVoiceDrag=e=>{
 if(!editDragging)return;
 changeVoiceSelection(e);editDragging=false;editDragStart=null;
 try{voiceCanvas.releasePointerCapture(e.pointerId)}catch(_e){}
};
voiceCanvas?.addEventListener("pointerup",finishVoiceDrag);
voiceCanvas?.addEventListener("pointercancel",finishVoiceDrag);
get("iamWaveZoom")?.addEventListener("input",e=>{
 editZoom=clamp(Number(e.target.value),1,16);drawEditorWaveforms();
});
get("iamZoomOut")?.addEventListener("click",()=>{
 editZoom=Math.max(1,editZoom-1);drawEditorWaveforms();
});
get("iamZoomIn")?.addEventListener("click",()=>{
 editZoom=Math.min(16,editZoom+1);drawEditorWaveforms();
});
get("iamWavePan")?.addEventListener("input",e=>{
 editPan=clamp(Number(e.target.value)/1000,0,1);drawEditorWaveforms();
});
get("iamVocalShift")?.addEventListener("input",e=>{
 editVocalShift=clamp(Number(e.target.value),-250,250);
 onEditorChange();
});
get("iamVocalShift")?.addEventListener("change",persistEditor);
get("iamSilenceRange")?.addEventListener("click",()=>setVocalSelectionAction("silence"));
get("iamCropVocal")?.addEventListener("click",()=>setVocalSelectionAction("keep"));
get("iamUndoVocal")?.addEventListener("click",()=>{
 const old=editUndo.pop();if(!old)return;
 editMute=old.mute;editKeep=old.keep;persistEditor();
 say("Last voice edit undone.");
});
get("iamResetVocal")?.addEventListener("click",()=>{
 pushEditUndo();editMute=[];editKeep=null;persistEditor();
 say("All vocal sections restored. Original raw tracks remain untouched.");
});

E.listen?.addEventListener("click",()=>void listenTake());
E.again?.addEventListener("click",againTake);
E.edit?.addEventListener("click",editTake);
get("iamEditPreview")?.addEventListener("click",()=>void listenTake());
E.back?.addEventListener("click",()=>{editing=false;document.body.classList.remove("iam-edit-open");stopReview()});
E.save?.addEventListener("click",()=>exportAudio("mix"));
get("iamSaveBtn")?.addEventListener("click",()=>exportAudio("mix"));
get("iamExportMusic")?.addEventListener("click",()=>exportAudio("music"));
get("iamExportVoice")?.addEventListener("click",()=>exportAudio("voice"));
get("iamExportMix")?.addEventListener("click",()=>exportAudio("mix"));
get("iamExportEdited")?.addEventListener("click",()=>void exportEdited());
get("iamRestoreTake")?.addEventListener("click",()=>void restoreLatest());
[E.music,E.voice,E.gain,E.compression].forEach(e=>e?.addEventListener("input",outputSettings));
document.querySelectorAll("#iamStudio [data-iam-effect]").forEach(b=>b.addEventListener("click",()=>{
 fxMode=b.dataset.iamEffect||"clean";
 document.querySelectorAll("#iamStudio [data-iam-effect]").forEach(x=>x.classList.toggle("selected",x===b));
 effectSettings();
}));
E.sound?.addEventListener("click",()=>{
 const showing=!E.panel.classList.contains("show");E.panel.classList.toggle("show",showing);
 E.sound.setAttribute("aria-expanded",showing?"true":"false");
});
get("iamSoundClose")?.addEventListener("click",()=>{
 E.panel.classList.remove("show");E.sound?.setAttribute("aria-expanded","false");
});
function enableHeadphoneMonitoring(){
 setHeadphones(true);
 try{if(ctx?.state!=="running")void ctx?.resume?.()}catch(_e){}
 say("HEADPHONES · HEAR ME ON automatically. Tap HEAR ME to turn it OFF.");
}
get("iamListenHeadphones")?.addEventListener("click",enableHeadphoneMonitoring);
get("iamHeadphones")?.addEventListener("click",enableHeadphoneMonitoring);
get("iamListenSpeaker")?.addEventListener("click",()=>{
 setHeadphones(false);
 say("SPEAKER: Music plays out loud; sing normally. Your mic records, but is not fed back through the speaker.");
});
E.monitor?.addEventListener("click",()=>{
 if(!headphones){say("Select HEADPHONES before enabling vocal monitoring.");return}
 monitoring=!monitoring;setHeadphones(true,true);
});
E.take.addEventListener("play",()=>{
 if(!take.mix||!open)return;
 reviewing=true;mode("playing");
 if(ctx){
  musicOutput?.gain.setTargetAtTime(0,ctx.currentTime,.05);
  monitorGain?.gain.setTargetAtTime(0,ctx.currentTime,.05);
 }
});
E.take.addEventListener("pause",()=>{
 if(!reviewing||!take.mix)return;
 reviewing=false;mode("play");outputSettings();
});
E.take.addEventListener("ended",()=>{
 reviewing=false;mode("play");outputSettings();
 say("Review finished · LISTEN AGAIN, TRY AGAIN, or EDIT.");
});
E.take.addEventListener("error",()=>{
 if(!open||!take.mix)return;
 const code=E.take.error?.code||"unknown";
 say("Safari could not play this take (decoder error "+code+"). The recording file can still be exported from EDIT. Tap TRY AGAIN for a new take.");
});
// All visible controls operate the PRIVATE song, not the muted original Radio.
get("iamPrivateMusicVolume")?.addEventListener("input",event=>{
 E.music.value=String(event.target.value);
 outputSettings();
});
get("iamPrivatePrev")?.addEventListener("click",()=>choosePrivateSong("prev"));
get("iamPrivateNext")?.addEventListener("click",()=>choosePrivateSong("next"));
get("iamPrivateChoose")?.addEventListener("click",showSongPicker);
get("iamPlayerSource")?.addEventListener("click",showSongPicker);
async function toggleStudioMusic(forceStop=false){
 if(!open||recordArming)return;
 if(!privateAudio||!sourceURL){
  say("No song loaded yet. I AM is searching; tap SONGS if needed.");
  return;
 }
 if(forceStop||(musicHandoffDone&&!privateAudio.paused)){
  studioMusicStopped=true;
  try{privateAudio.pause()}catch(_e){}
  say("Private music paused. Your microphone stays connected.");
 }else{
  studioMusicStopped=false;
  try{
   if(ctx?.state!=="running")await ctx.resume();
   await privateAudio.play();
   if(!musicHandoffDone){
    if(!(await preflight(4000)))throw Error("Song cannot be captured yet. Try SONGS.");
    audio.muted=true;
    musicOutput.gain.setTargetAtTime(1,ctx.currentTime,.05);
    musicHandoffDone=true;verified=true;musicSignalError="";
    updateRecordReady();
    get("iamSourceIndicator").textContent="PRIVATE PLAYER · READY";
   }
   say("Private recording music is playing.");
  }catch(err){studioMusicStopped=true;say("Private song needs a tap or another selection: "+errorString(err))}
 }
 syncPrivateTransport();updateRecordReady();
}
get("iamPrivatePlay")?.addEventListener("click",()=>void toggleStudioMusic());
get("iamStopMusic")?.addEventListener("click",()=>void toggleStudioMusic(true));
get("iamPrivateMusicSeek")?.addEventListener("input",event=>{
 if(!open||!privateAudio||recording)return;
 const duration=Number(privateAudio.duration);
 if(!(Number.isFinite(duration)&&duration>0))return;
 try{privateAudio.currentTime=clamp(Number(event.target.value)/1000,0,1)*duration}catch(err){say("Cannot seek: "+errorString(err))}
 syncPrivateTransport();
});
get("titleBtn")?.addEventListener("click",event=>{
 if(!open)return;
 event.stopImmediatePropagation();event.preventDefault();showSongPicker();
},true);
get("iamPrivatePickerClose")?.addEventListener("click",hideSongPicker);
for(const [id,kind] of [["prevBtn","prev"],["nextBtn","next"],["liveBtn","live"],["playBtn","play"]]){
 get(id)?.addEventListener("click",event=>{
  if(!open)return;
  event.stopImmediatePropagation();event.preventDefault();
  if(kind==="live"){void leave().then(()=>{if(!state.live)window.GELive?.enter?.()});return}
  if(kind==="prev"||kind==="next"){choosePrivateSong(kind);return}
  if(recording){say("Stop recording before pausing the music.");return}
  if(privateAudio){
   if(privateAudio.paused)privateAudio.play().catch(err=>say(errorString(err)));
   else privateAudio.pause();
  }
 },true);
}
window.GEIAmStudio={
 open:enter,close:leave,version:5,getSession:()=>takeMeta,
 isMusicStopped:()=>open,isRadioSuspended:()=>open&&radioSuspended,
 onCatalogReady:()=>{if(open&&!musicHandoffDone&&!sourceURL)void refreshMatchForStudio()}
};
outputSettings();
};
})();
