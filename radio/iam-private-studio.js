/* Grand Element I AM — private two-track studio v2.
   The normal Radio player is untouched until a private track has loaded.
   Music, dry microphone and mixed preview share one AudioContext clock. */
(function(){
"use strict";
window.GEIAmPrivateStudioBoot=function(api){
const {audio,state,CONFIG,displayTitle,allowedCatalog}=api;
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
function meterLoop(){
 if(!open){raf=0;return}
 const m=meter(musicMeter,musicData),v=meter(voiceMeter,voiceData);
 if(m>.03)verified=true;
 E.meters[0].style.transform="scaleX("+Math.max(.015,m).toFixed(3)+")";
 E.meters[1].style.transform="scaleX("+Math.max(.015,v).toFixed(3)+")";
 E.label.textContent=m>.03?"MUSIC · LIVE":loading?"MUSIC · CONNECTING":"MUSIC · NO SIGNAL";
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
 musicInput.connect(musicGain);musicGain.connect(musicMeter);
 musicGain.connect(musicDest);musicGain.connect(mixDest);
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
  if(!found)return null;
  return {url:found,title:String(now.title||""),seconds:Number(body.now_started_at)||0};
 }catch(_e){return null}
}
async function sourceSelection(){
 sourceMode=state.live?"radio":"player";
 const url=audio.currentSrc||audio.src||"";
 if(!state.live)return {url,position:Number(audio.currentTime)||0,precise:true,kind:"player"};
 const match=await stationSong();
 if(match){
  const offset=match.seconds?clamp(Date.now()/1000-match.seconds-2,0,999999):0;
  return {url:match.url,position:offset,precise:false,kind:"radio-song",title:match.title};
 }
 return {url:CONFIG.LIVE_STREAM_URL,position:0,precise:false,kind:"live-radio"};
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
async function activateMic(){
 if(!open||!ctx||micStream)return;
 try{
  // Music performance profile: never enable call-style noise suppression,
  // automatic gain control or echo cancellation unless the browser forces it.
  const preferred={echoCancellation:false,noiseSuppression:false,autoGainControl:false};
  try{micStream=await navigator.mediaDevices.getUserMedia({audio:preferred})}
  catch(_e){micStream=await navigator.mediaDevices.getUserMedia({audio:true})}
  const node=ctx.createMediaStreamSource(micStream);
  voiceInput=ctx.createGain();dryGain=ctx.createGain();compressedGain=ctx.createGain();
  voiceOutput=ctx.createGain();compressor=ctx.createDynamicsCompressor();
  compressor.threshold.value=-27;compressor.knee.value=12;compressor.ratio.value=4;
  compressor.attack.value=.005;compressor.release.value=.16;
  voiceMeter=ctx.createAnalyser();voiceMeter.fftSize=512;voiceData=new Uint8Array(voiceMeter.fftSize);
  // Dry raw stream does NOT pass through gain, compression, delay, or reverb.
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
  outputSettings();effectSettings();
  say("Private studio ready. MUSIC and YOU share one audio clock.");
 }catch(err){say("Music ready. Microphone connection failed: "+String(err?.message||err?.name||err))}
}
async function preparePrivate(){
 if(loading||!open)return;
 loading=true;const token=++sessionToken;
 say("Preparing private music. Your Radio stays audible until the handoff.");
 try{
  const selection=await sourceSelection();
  if(token!==sessionToken||!open)return;
  if(!selection.url)throw Error("Start a song before opening I AM.");
  sourceURL=selection.url;privateAudio=new Audio();
  privateAudio.crossOrigin="anonymous";privateAudio.playsInline=true;privateAudio.preload="auto";
  privateAudio.src=selection.url;privateAudio.load();
  createMusicGraph();
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
  await ctx.resume();
  await privateAudio.play();
  if(!(await preflight()))throw Error("Private audio signal is silent. The original Radio is still available.");
  // Only after verified audio: transition into independent private playback.
  oldMuted=audio.muted;
  audio.muted=true;
  musicOutput.gain.setTargetAtTime(1,ctx.currentTime,.05);
  get("iamSourceIndicator").textContent=selection.precise?"PRIVATE · SAME SONG / POSITION":"PRIVATE · LIVE RADIO HANDOFF APPROXIMATE";
  get("iamNowPlaying").textContent=selection.title||displayTitle(selection.url,false)||"Private Radio";
  verified=true;
  E.record.disabled=false;
  await activateMic();
  if(!selection.precise)say("Private audio ready. Radio position is approximate, not sample-locked.");
 }catch(err){
  say("I AM handoff failed: "+String(err?.message||err));
  audio.muted=oldMuted;
  verified=false;await disposeAudio();
 }finally{loading=false}
}
async function disposeAudio(){
 try{privateAudio?.pause()}catch(_e){}
 if(micStream)micStream.getTracks().forEach(t=>t.stop());
 micStream=null;privateAudio=null;
 try{await ctx?.close()}catch(_e){}
 ctx=null;musicInput=null;musicGain=null;musicOutput=null;musicMeter=null;voiceMeter=null;
 musicData=null;voiceData=null;musicDest=null;voiceDest=null;mixDest=null;
 voiceInput=null;voiceOutput=null;compressor=null;monitorGain=null;verified=false;
}
