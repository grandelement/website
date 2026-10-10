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
  edit:get("iamEditBtn"),again:get("iamAgainBtn"),back:get("iamEditBack"),save:get("iamEditSave")};
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
let micSourceNode=null,micAttachedAt=0,lastMicSignalAt=0,trackChangeToken=0;
let musicHandoffDone=false,musicSignalError="",oldMediaVolume=1;
let studioMusicStopped=false,recorderReady=false,recorderPrewarming=false;
let micDetected=false,micSilenceWarned=false,recordArming=false;
function say(s){E.status.textContent=s}
function mode(x){
 E.record.classList.toggle("record-ready",x==="record");E.record.classList.toggle("recording",x==="recording");
 E.record.classList.toggle("take-ready",x==="play"||x==="playing");
 E.record.innerHTML=x==="recording"||x==="playing"?stopIcon:x==="play"?playIcon:micIcon;
 E.record.setAttribute("aria-label",x==="recording"?"Stop recording":x==="playing"?"Stop review":x==="play"?"Listen to take":"Record");
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
  monitorGain?.gain.setTargetAtTime(headphones&&monitoring?.75:0,ctx.currentTime,.015);
 }
 // While a LIVE radio stream cannot feed the studio recording mixer,
 // keep MUSIC VOL useful for the native listener, where platform supported.
 if(open&&!musicHandoffDone&&audio&&!audio.muted){
  try{audio.volume=clamp(oldMediaVolume*music,0,1)}catch(_e){}
 }
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
let lastTransportUpdate=0;
function syncPrivateTransport(){
 if(!open)return;
 const element=musicHandoffDone?privateAudio:audio;
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
 // Permission is not the same thing as receiving voice samples.
 if(!recording&&!recordArming){
  if(take.mix){E.record.disabled=false;return}
  E.record.disabled=!(verified&&micConnected&&micStream?.active&&micDetected&&!loading);
  if(verified&&micConnected&&micDetected&&!loading&&!recorderReady)void prepareRecorders();
 }
}
function meterLoop(){
 if(!open){raf=0;return}
 const tick=performance.now();
 if(tick-lastTransportUpdate>260){lastTransportUpdate=tick;syncPrivateTransport();}
 const m=meter(musicMeter,musicData),v=meter(voiceMeter,voiceData);
 // Do not enable Record until the music capture source is actually verified.
 if(v>.015){
  lastMicSignalAt=performance.now();
  if(micConnected&&!micDetected){
   micDetected=true;micSilenceWarned=false;
   updateRecordReady();
   say("YOU microphone signal confirmed. Ready to record when MUSIC is connected.");
  }
 }
 E.meters[0].style.transform="scaleX("+Math.max(.015,m).toFixed(3)+")";
 E.meters[1].style.transform="scaleX("+Math.max(.015,v).toFixed(3)+")";
 E.label.textContent=musicSignalError?"MUSIC · NO CAPTURE":m>.03?"MUSIC · LIVE":loading?"MUSIC · CONNECTING":"MUSIC · NO SIGNAL";
 const micButton=get("iamMicRetryBtn");
 if(micButton){
  const tracks=micStream?.getAudioTracks?.()||[];
  const live=micConnected&&tracks.some(t=>t.readyState!=="ended"&&t.enabled!==false&&!t.muted);
  const muted=micConnected&&tracks.some(t=>t.muted);
  const silent=live&&micAttachedAt&&performance.now()-micAttachedAt>4500&&!micDetected;
  micButton.textContent=live&&ctx?.state!=="running"?"YOU · AUDIO PAUSED":silent?"YOU · NO INPUT":live?(v>.015?"YOU · SIGNAL":micDetected?"YOU · SIGNAL OK":"YOU · READY"):muted?"YOU · MUTED":micError?"YOU · RETRY MIC":micPromise?"YOU · CONNECTING":"YOU · ENABLE MIC";
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
  const songs=allowedCatalog();
  const found=songs.find(s=>base&&norm(decodeURIComponent(s.split("/").pop()))===base)
    ||songs.find(s=>norm(now.title).length>6&&norm(s).includes(norm(now.title)));
  // Never jump to the beginning of a radio song without timing information.
  if(!found||!Number(body.now_started_at))return null;
  const seconds=Number(body.now_started_at),age=Date.now()/1000-seconds;
  if(!(age>=0&&age<3600))return null;
  return {url:found,title:String(now.title||""),seconds};
 }catch(_e){return null}
}
function sourceSelection(){
 sourceMode=state.live?"radio":"player";
 const url=audio.currentSrc||audio.src||"";
 if(!state.live)return {url,position:Number(audio.currentTime)||0,precise:true,kind:"player"};
 const match=(Date.now()-cachedSongTime<17000)?cachedSong:null;
 if(match){
  const offset=clamp(Date.now()/1000-match.seconds-2,0,999999);
  return {url:match.url,position:offset,precise:false,kind:"radio-song",title:match.title};
 }
 // No metadata wait inside a user gesture: prefer an immediate stream handoff.
 return {url:CONFIG.LIVE_STREAM_URL,position:0,precise:false,kind:"live-radio"};
}
async function refreshStationSong(){
 if(!state.live||open)return;
 const song=await stationSong();
 cachedSong=song;cachedSongTime=Date.now();
}
setInterval(()=>{void refreshStationSong()},12000);
setTimeout(()=>{void refreshStationSong()},1400);
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
   voiceMeter=ctx.createAnalyser();voiceMeter.fftSize=512;voiceData=new Uint8Array(voiceMeter.fftSize);
   // Preserve a separate, unprocessed dry voice stem.
   node.connect(voiceDest);node.connect(voiceInput);
   voiceInput.connect(voiceMeter);voiceInput.connect(dryGain);
   voiceInput.connect(compressor);compressor.connect(compressedGain);
   const blend=ctx.createGain();dryGain.connect(blend);compressedGain.connect(blend);
   blend.connect(voiceOutput);
   fxDelay=ctx.createDelay(1.5);fxWet=ctx.createGain();fxFeedback=ctx.createGain();
   blend.connect(fxDelay);fxDelay.connect(fxWet);fxWet.connect(voiceOutput);
   fxDelay.connect(fxFeedback);fxFeedback.connect(fxDelay);
   voiceOutput.connect(mixDest);
   monitorGain=ctx.createGain();voiceOutput.connect(monitorGain);monitorGain.connect(ctx.destination);
   // Keep the muted microphone graph rendering on iPhone without audible bleed.
   const keepAlive=ctx.createGain();keepAlive.gain.value=.000001;
   voiceInput.connect(keepAlive);keepAlive.connect(ctx.destination);
   outputSettings();effectSettings();micConnected=true;micError="";
   micAttachedAt=performance.now();lastMicSignalAt=0;micDetected=false;micSilenceWarned=false;
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
 say("Preparing private music. Your Radio stays audible until the handoff.");
 try{
  const selection=sourceSelection();
  if(token!==sessionToken||!open)return;
  if(!selection.url)throw Error("Start a song before opening I AM.");
  sourceURL=selection.url;privateAudio=new Audio();
  privateAudio.crossOrigin="anonymous";privateAudio.playsInline=true;privateAudio.preload="auto";
  privateAudio.src=selection.url;privateAudio.load();
  createMusicGraph();musicSignalError="";musicHandoffDone=false;
  // Connect the microphone during music buffering, not after a radio preflight.
  void activateMic();
  // Prime both calls within the original user tap. iPhone Safari can reject
  // audio started only after waiting for loadedmetadata / asynchronous fetch.
  const wake=ctx.resume().then(()=>null,e=>e);
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
  const hasMusic=await preflight(selection.kind==="live-radio"?5000:3800);
  if(!open||token!==sessionToken)return;
  if(!hasMusic){
   verified=false;updateRecordReady();
   musicSignalError=selection.kind==="live-radio"?"Live Radio is audible but Safari is not delivering its audio to I AM. Tap NEXT or CHOOSE SONG.":"The selected song is not reaching I AM.";
   get("iamSourceIndicator").textContent="MUSIC NOT CAPTURING · ORIGINAL RADIO UNCHANGED";
   say(musicSignalError+(micConnected?" YOU is connected.":" Tap YOU to enable microphone."));
   return; // Preserve microphone permission and the music graph for recovery.
  }
  musicSignalError="";musicHandoffDone=true;
  audio.muted=true;
  musicOutput.gain.setTargetAtTime(1,ctx.currentTime,.05);
  if(studioMusicStopped){privateAudio.pause();audio.pause();}
  get("iamSourceIndicator").textContent=selection.precise?"PRIVATE · SAME SONG / POSITION":"PRIVATE · LIVE RADIO HANDOFF APPROXIMATE";
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
 try{privateAudio?.pause()}catch(_e){}
 if(micStream)micStream.getTracks().forEach(t=>t.stop());
 micStream=null;privateAudio=null;
 recorderReady=false;recorderPrewarming=false;
 recMusic=null;recVoice=null;recMix=null;
 try{await ctx?.close()}catch(_e){}
 ctx=null;musicInput=null;musicGain=null;musicOutput=null;musicMeter=null;voiceMeter=null;
 musicData=null;voiceData=null;musicDest=null;voiceDest=null;mixDest=null;
 voiceInput=null;voiceOutput=null;compressor=null;monitorGain=null;verified=false;
}
function recordMime(){
 const m=["audio/mp4","audio/webm;codecs=opus","audio/webm"];
 return m.find(type=>MediaRecorder.isTypeSupported?.(type))||"";
}
function recorder(dest,key){
 const mime=recordMime(),r=mime?new MediaRecorder(dest.stream,{mimeType:mime}):new MediaRecorder(dest.stream);
 chunks[key]=[];r.ondataavailable=e=>{if(e.data?.size)chunks[key].push(e.data)};
 return r;
}
function prepareRecorders(){
 if(recorderReady||recorderPrewarming||recording||!verified||!micConnected||!micDetected||!micStream?.active)return;
 if(!window.MediaRecorder){say("Recording unavailable in this browser.");return}
 recorderPrewarming=true;
 try{
  recMusic=recorder(musicDest,"music");
  recVoice=recorder(voiceDest,"voice");
  recMix=recorder(mixDest,"mix");
  recorderReady=true;
  say("Music and microphone verified. Tap Record when ready.");
 }catch(err){recorderReady=false;say("Cannot prepare recorders: "+errorString(err))}
 finally{recorderPrewarming=false}
}
function assemble(key,r){
 const parts=chunks[key];return parts?.length?new Blob(parts,{type:r.mimeType||recordMime()||"audio/mp4"}):null;
}
function beginTake(){
 if(!open||loading||recording||!ctx||!verified||!micConnected||!micStream?.active||!micDetected){
  say(micError||"Speak until YOU shows SIGNAL before pressing Record.");return;
 }
 if(!window.MediaRecorder){say("MediaRecorder is unavailable in this browser.");return}
 stopReview();
 try{
  if(!recorderReady)prepareRecorders();
  if(!recorderReady)throw new Error("The recording encoders are not ready");
  const clock=ctx.currentTime,offsets={},pressedAt=performance.now();
  recordArming=true;
  // Minimize work on the Record tap and avoid three repeated timeslice events.
  recMusic.start();offsets.music=ctx.currentTime-clock;
  recVoice.start();offsets.voice=ctx.currentTime-clock;
  recMix.start();offsets.mix=ctx.currentTime-clock;
  recorderReady=false;recordArming=false;
  takeMeta={version:2,id:new Date().toISOString(),source:sourceURL,mode:sourceMode,
   sourcePosition:privateAudio.currentTime,clockStart:clock,offsets,
   encoderStartMilliseconds:Math.round(performance.now()-pressedAt),
   music:value(E.music),voice:value(E.voice),gain:value(E.gain),compression:value(E.compression),
   effect:fxMode,approximate:sourceMode==="radio"};
  startedAt=pressedAt/1000;recording=true;
  mode("recording");
  const latency=takeMeta.encoderStartMilliseconds||0;
  say("RECORDING · "+(latency>300?"Recorder started in "+latency+" ms. ":"")+"MUSIC + dry YOU + mix.");
 }catch(err){
  recordArming=false;recorderReady=false;
  for(const r of [recMusic,recVoice,recMix])try{if(r?.state==="recording")r.stop()}catch(_e){}
  say("Recording failed: "+errorString(err));mode("record");
 }
}
function stopOne(r,key){
 return new Promise(resolve=>{
  if(!r){resolve();return}
  if(r.state==="inactive"){take[key]=assemble(key,r);resolve();return}
  const done=()=>{take[key]=assemble(key,r);resolve()};
  r.addEventListener("stop",done,{once:true});
  try{r.requestData()}catch(_e){}
  try{r.stop()}catch(_e){done()}
  setTimeout(resolve,2200);
 });
}
async function stopTake(){
 if(!recording)return;
 recording=false;E.record.disabled=true;recorderReady=false;
 const duration=performance.now()/1000-startedAt;
 say("Finalizing your raw tracks and mixed preview…");
 await Promise.all([stopOne(recMusic,"music"),stopOne(recVoice,"voice"),stopOne(recMix,"mix")]);
 if(takeMeta)takeMeta.duration=duration;
 if(take.mix&&take.voice&&take.music){
  const old=E.take.src;E.take.src=URL.createObjectURL(take.mix);
  if(old.startsWith("blob:"))URL.revokeObjectURL(old);
  document.body.classList.add("iam-has-take");mode("play");
  E.timer.textContent=fmt(duration);
  await saveTake();
  say(savedWarning||"Take ready. MIX + original dry YOU + MUSIC saved. Tap center to listen.");
 }else{
  mode("record");say("One or more tracks were empty. Check your signal. Existing recorded data remains available.");
 }
 updateRecordReady();
}
async function saveTake(){
 savedWarning="";
 try{
  const db=await new Promise((resolve,reject)=>{
   const req=indexedDB.open("ge-iam-sessions-v2",1);
   req.onupgradeneeded=()=>req.result.createObjectStore("takes",{keyPath:"id"});
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  await new Promise((resolve,reject)=>{
   const tx=db.transaction("takes","readwrite");
   tx.objectStore("takes").put({id:takeMeta.id,meta:takeMeta,music:take.music,voice:take.voice,mix:take.mix});
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
  const duration=Math.max(musicBuffer.duration,voiceBuffer.duration)+1.2;
  if(duration>180)throw Error("Edited WAV export currently supports recordings up to 3 minutes on phones. Original stems can still be saved.");
  const rate=44100,len=Math.ceil(duration*rate);
  const off=new Offline(2,len,rate);
  const song=off.createBufferSource(),voice=off.createBufferSource();
  song.buffer=musicBuffer;voice.buffer=voiceBuffer;
  const mGain=off.createGain(),vGain=off.createGain();
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
  voice.connect(vGain);vGain.connect(raw);vGain.connect(compNode);compNode.connect(compressed);
  raw.connect(voiceOut);compressed.connect(voiceOut);
  raw.connect(delayNode);compressed.connect(delayNode);
  delayNode.connect(wet);wet.connect(voiceOut);delayNode.connect(feedback);feedback.connect(delayNode);
  voiceOut.connect(off.destination);
  const base=.012,offsets=takeMeta?.offsets||{},musicOffset=Math.max(0,Number(offsets.music)||0),voiceOffset=Math.max(0,Number(offsets.voice)||0);
  song.start(base+musicOffset);voice.start(base+voiceOffset);
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
 const ext=blob.type.includes("mp4")?"m4a":"webm",url=URL.createObjectURL(blob);
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
   say("Listening to your mix. Tap center again to return to the private song.");
  }catch(err){say("Review unavailable: "+errorString(err));stopReview()}
  return;
 }
 try{
  const AC=window.AudioContext||window.webkitAudioContext;
  reviewCtx=new AC();await reviewCtx.resume();
  const buffers=await Promise.all([take.music.arrayBuffer(),take.voice.arrayBuffer()]);
  const [musicBuffer,voiceBuffer]=await Promise.all(buffers.map(x=>reviewCtx.decodeAudioData(x)));
  const rm=reviewCtx.createGain(),rv=reviewCtx.createGain();
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
  mb.buffer=musicBuffer;vb.buffer=voiceBuffer;mb.connect(rm);vb.connect(rv);
  const start=reviewCtx.currentTime+.06;
  mb.start(start,0);vb.start(start,0);
  reviewSources=[mb,vb];reviewClock=start;
  mb.onended=()=>{if(reviewing)stopReview()};
  reviewing=true;mode("playing");
  say("EDIT preview. Move compression, effects or volumes while the raw tracks play.");
 }catch(err){say("Raw-stem playback failed: "+errorString(err));stopReview()}
}
async function previewWaves(){
 const targets=[["music",take.music],["voice",take.voice]];
 const AC=window.AudioContext||window.webkitAudioContext;
 if(!AC||!take.music||!take.voice)return;
 const temp=new AC();
 try{
  for(const [kind,blob] of targets){
   const canvas=get("iamWave"+kind),pen=canvas?.getContext("2d");if(!pen)continue;
   const buf=await temp.decodeAudioData(await blob.arrayBuffer());
   const samples=buf.getChannelData(0),w=canvas.width,h=canvas.height;
   pen.clearRect(0,0,w,h);
   pen.fillStyle=kind==="music"?"#62caff":"#81f5bd";
   const stride=Math.max(1,Math.floor(samples.length/w));
   for(let x=0;x<w;x++){
    let high=0;
    for(let i=x*stride;i<Math.min(samples.length,(x+1)*stride);i+=Math.max(1,Math.floor(stride/18)))
     high=Math.max(high,Math.abs(samples[i]));
    let amp=Math.max(1,high*h*.92);
    pen.fillRect(x,(h-amp)/2,1,amp);
   }
  }
 }catch(_e){}finally{try{await temp.close()}catch(_e){}}
}
function setHeadphones(on){
 headphones=!!on;
 get("iamListenHeadphones")?.classList.toggle("selected",on);
 get("iamListenSpeaker")?.classList.toggle("selected",!on);
 get("iamListenHeadphones")?.setAttribute("aria-pressed",on?"true":"false");
 get("iamListenSpeaker")?.setAttribute("aria-pressed",on?"false":"true");
 if(!on)monitoring=false;
 E.monitor.disabled=!on;
 E.monitor.textContent="HEAR ME: "+(monitoring?"ON":"OFF");
 E.monitor.setAttribute("aria-pressed",monitoring?"true":"false");
 outputSettings();
}
function editTake(){
 if(!take.mix){say("Record or restore a take first.");return}
 editing=true;document.body.classList.add("iam-edit-open");
 E.panel.classList.add("show");E.sound.setAttribute("aria-expanded","true");
 get("iamStemActions").hidden=false;
 void previewWaves();
 say("Dry YOU and clean MUSIC preserved. Edit compression or effects and play again.");
}
function againTake(){
 stopReview();take={music:null,voice:null,mix:null};takeMeta=null;
 document.body.classList.remove("iam-has-take","iam-edit-open");editing=false;
 E.timer.textContent="00:00";mode("record");
 updateRecordReady();
 say("Ready for a new take. Previous saved recordings remain available on this device.");
}
async function leave(){
 if(!open)return;
 if(recording)await stopTake();
 stopReview();
 open=false;sessionToken++;
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
 try{audio.volume=oldMediaVolume}catch(_e){}
 const title=state.live?(window.GELiveMetadata?.getTitle?.()||CONFIG.LIVE_STREAM_TITLE):displayTitle(state.currentURL,!state.shuffle);
 get("titleBtn").textContent=title||"Grand Element Radio";
 hideSongPicker();
 try{if("audioSession" in navigator)navigator.audioSession.type="playback"}catch(_e){}
 mode("record");say("Private I AM session closed.");
}
async function enter(){
 if(open)return;
 oldMuted=audio.muted;oldMediaVolume=Number(audio.volume)||1;
 studioMusicStopped=false;micDetected=false;micSilenceWarned=false;recordArming=false;
 // WebKit needs the simultaneous playback/capture session selected before
 // asking for its microphone. This can change speaker routing on iPhones.
 try{if("audioSession" in navigator)navigator.audioSession.type="play-and-record"}catch(_e){}
 window.GEHUD?.suspendForIAm?.();
 makeSun();open=true;sessionToken++;
 document.body.classList.add("iam-studio-open");
 E.launch.setAttribute("aria-expanded","true");
 setHeadphones(false);E.record.disabled=true;mode(take.mix?"play":"record");
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
async function selectPrivateSong(url){
 if(!open||!privateAudio||recording){say("Stop the take before changing songs.");return}
 stopReview();if(take.mix)againTake();hideSongPicker();
 const request=++trackChangeToken;
 sourceURL=url;sourceMode="player";verified=false;musicSignalError="";E.record.disabled=true;
 privateAudio.src=url;privateAudio.load();
 say("Loading private song…");
 try{
  if(ctx?.state!=="running")await ctx.resume();
  await privateAudio.play();
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
  get("iamSourceIndicator").textContent="PRIVATE SONG · VERIFIED";
  syncPrivateTransport();
 }catch(err){
  verified=false;E.record.disabled=true;musicSignalError=errorString(err);
  say("Cannot record this song: "+musicSignalError);
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
get("iamMicRetryBtn")?.addEventListener("click",()=>{
 if(!open)return;
 const working=micConnected&&micStream?.active&&lastMicSignalAt>=micAttachedAt;
 if(working&&ctx?.state==="running"){
  say("YOU microphone signal confirmed. Record when MUSIC is ready.");return;
 }
 try{if(ctx?.state!=="running")void ctx?.resume?.()}catch(_e){}
 try{micSourceNode?.disconnect()}catch(_e){}
 micSourceNode=null;micConnected=false;micDetected=false;micError="";
 if(micStream)try{micStream.getTracks().forEach(t=>t.stop())}catch(_e){}
 micStream=null;
 const pending=primeMic();
 void pending.then(()=>{if(open&&ctx)void activateMic()});
 say("Reconnecting microphone. Speak to check the YOU meter.");
});
E.launch.addEventListener("click",()=>{if(open)void leave();else void enter()});
get("iamExitBtn")?.addEventListener("click",()=>void leave());
E.record.addEventListener("click",()=>{if(recording)void stopTake();else if(take.mix)void listenTake();else beginTake()});
E.again?.addEventListener("click",againTake);
E.edit?.addEventListener("click",editTake);
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
get("iamListenHeadphones")?.addEventListener("click",()=>setHeadphones(true));
get("iamListenSpeaker")?.addEventListener("click",()=>setHeadphones(false));
E.monitor?.addEventListener("click",()=>{
 if(!headphones){say("Select HEADPHONES before enabling vocal monitoring.");return}
 monitoring=!monitoring;setHeadphones(true);
});
E.take.addEventListener("ended",()=>{reviewing=false;mode("play");if(musicOutput&&ctx)musicOutput.gain.setTargetAtTime(1,ctx.currentTime,.06)});
// All visible controls operate the PRIVATE song, not the muted original Radio.
get("iamPrivateMusicVolume")?.addEventListener("input",event=>{
 E.music.value=String(event.target.value);
 outputSettings();
});
get("iamPrivatePrev")?.addEventListener("click",()=>choosePrivateSong("prev"));
get("iamPrivateNext")?.addEventListener("click",()=>choosePrivateSong("next"));
get("iamPrivateChoose")?.addEventListener("click",showSongPicker);
async function toggleStudioMusic(forceStop=false){
 if(!open||recordArming)return;
 const active=musicHandoffDone?privateAudio:audio;
 if(!active){say("No music source connected.");return}
 if(forceStop||!active.paused){
  studioMusicStopped=true;
  try{privateAudio?.pause()}catch(_e){}
  try{if(state.live&&pauseRadio)pauseRadio();else audio?.pause()}catch(_e){}
  say("MUSIC STOPPED. YOU can remain connected. Tap PLAY or START to resume.");
 }else{
  studioMusicStopped=false;
  try{
   if(ctx?.state!=="running")await ctx.resume();
   if(musicHandoffDone){
    // The normal radio is kept muted while the private song is playing.
    audio.muted=true;
    await privateAudio.play();
   }else{
    // Safari could not capture the stream. Control the audible original.
    audio.muted=false;
    if(state.live&&resumeRadio)await resumeRadio();
    else await audio.play();
   }
   say("Music playing. "+(musicHandoffDone?"Private song active.":"Original Radio active."));
  }catch(err){studioMusicStopped=true;say("Music could not resume: "+errorString(err))}
 }
 syncPrivateTransport();
}
get("iamPrivatePlay")?.addEventListener("click",()=>void toggleStudioMusic());
get("iamStopMusic")?.addEventListener("click",()=>void toggleStudioMusic(true));
get("iamPrivateRadio")?.addEventListener("click",()=>{
 if(recording){say("Stop recording before returning to Radio.");return}
 void leave().then(()=>{if(!state.live)window.GELive?.enter?.()});
});
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
window.GEIAmStudio={open:enter,close:leave,version:4,getSession:()=>takeMeta,isMusicStopped:()=>open&&studioMusicStopped};
outputSettings();
};
})();
