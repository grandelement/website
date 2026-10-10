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
function recordMime(){
 const m=["audio/mp4","audio/webm;codecs=opus","audio/webm"];
 return m.find(type=>MediaRecorder.isTypeSupported?.(type))||"";
}
function recorder(dest,key){
 const mime=recordMime(),r=mime?new MediaRecorder(dest.stream,{mimeType:mime}):new MediaRecorder(dest.stream);
 chunks[key]=[];r.ondataavailable=e=>{if(e.data?.size)chunks[key].push(e.data)};
 return r;
}
function assemble(key,r){
 const parts=chunks[key];return parts?.length?new Blob(parts,{type:r.mimeType||recordMime()||"audio/mp4"}):null;
}
function beginTake(){
 if(!open||loading||recording||!ctx||!verified||!micStream?.active){
  say("Connect both MUSIC and YOU before recording.");return;
 }
 if(!window.MediaRecorder){say("MediaRecorder is unavailable in this browser.");return}
 stopReview();
 try{
  recMusic=recorder(musicDest,"music");
  recVoice=recorder(voiceDest,"voice");
  recMix=recorder(mixDest,"mix");
  const clock=ctx.currentTime,offsets={};
  // All buses are driven by the SAME AudioContext clock, with measured offsets.
  recMusic.start(200);offsets.music=ctx.currentTime-clock;
  recVoice.start(200);offsets.voice=ctx.currentTime-clock;
  recMix.start(200);offsets.mix=ctx.currentTime-clock;
  takeMeta={version:2,id:new Date().toISOString(),source:sourceURL,mode:sourceMode,
   sourcePosition:privateAudio.currentTime,clockStart:clock,offsets,
   music:value(E.music),voice:value(E.voice),gain:value(E.gain),compression:value(E.compression),
   effect:fxMode,approximate:sourceMode==="radio"};
  startedAt=performance.now()/1000;recording=true;
  mode("recording");say("RECORDING · Clean MUSIC, dry YOU and mix are all being saved.");
 }catch(err){
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
  try{r.requestData();r.stop()}catch(_e){done()}
  setTimeout(resolve,2200);
 });
}
async function stopTake(){
 if(!recording)return;
 recording=false;E.record.disabled=true;
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
 E.record.disabled=false;
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
 say("Ready for a new take. Previous saved recordings remain available on this device.");
}
async function leave(){
 if(!open)return;
 if(recording)await stopTake();
 stopReview();
 open=false;sessionToken++;
 document.body.classList.remove("iam-studio-open","iam-has-take","iam-edit-open");
 E.launch.setAttribute("aria-expanded","false");
 removeSun();window.GEHUD?.resumeFromIAm?.();
 // A local file returns at the studio's position; the live stream returns
 // to its still-running original broadcast without seeking or rebuilding it.
 if(sourceMode==="player"&&privateAudio&&!audio.paused&&Number.isFinite(privateAudio.currentTime)){
  try{if(audio.currentSrc===sourceURL||audio.src===sourceURL)audio.currentTime=privateAudio.currentTime}catch(_e){}
 }
 await disposeAudio();audio.muted=oldMuted;
 try{if("audioSession" in navigator)navigator.audioSession.type="playback"}catch(_e){}
 mode("record");say("Private I AM session closed.");
}
async function enter(){
 if(open)return;
 oldMuted=audio.muted;window.GEHUD?.suspendForIAm?.();
 makeSun();open=true;sessionToken++;
 document.body.classList.add("iam-studio-open");
 E.launch.setAttribute("aria-expanded","true");
 setHeadphones(false);E.record.disabled=true;mode(take.mix?"play":"record");
 if(take.mix)document.body.classList.add("iam-has-take");
 raf=requestAnimationFrame(meterLoop);
 await preparePrivate();
}
function choosePrivateSong(direction){
 if(!open||!privateAudio||recording){say("Stop recording before changing songs.");return}
 const list=allowedCatalog();if(!list.length){say("No catalog tracks available.");return}
 const current=decodeURIComponent(sourceURL.split("/").pop());
 let index=list.findIndex(t=>decodeURIComponent(t.split("/").pop())===current);
 index=(index+(direction==="next"?1:-1)+list.length)%list.length;
 const url=list[index];sourceURL=url;sourceMode="player";verified=false;
 stopReview();if(take.mix)againTake();
 privateAudio.src=url;privateAudio.load();
 privateAudio.play().then(()=>{verified=true;E.record.disabled=false;say("Private song: "+displayTitle(url,false));}).catch(err=>say("Song change: "+errorString(err)));
 get("iamSourceIndicator").textContent="PRIVATE SONG · SELECTED";
}
E.launch.addEventListener("click",()=>{if(open)void leave();else void enter()});
E.record.addEventListener("click",()=>{if(recording)void stopTake();else if(take.mix)void listenTake();else beginTake()});
E.again?.addEventListener("click",againTake);
E.edit?.addEventListener("click",editTake);
E.back?.addEventListener("click",()=>{editing=false;document.body.classList.remove("iam-edit-open");stopReview()});
E.save?.addEventListener("click",()=>exportAudio("mix"));
get("iamSaveBtn")?.addEventListener("click",()=>exportAudio("mix"));
get("iamExportMusic")?.addEventListener("click",()=>exportAudio("music"));
get("iamExportVoice")?.addEventListener("click",()=>exportAudio("voice"));
get("iamExportMix")?.addEventListener("click",()=>exportAudio("mix"));
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
get("iamListenHeadphones")?.addEventListener("click",()=>setHeadphones(true));
get("iamListenSpeaker")?.addEventListener("click",()=>setHeadphones(false));
E.monitor?.addEventListener("click",()=>{
 if(!headphones){say("Select HEADPHONES before enabling vocal monitoring.");return}
 monitoring=!monitoring;setHeadphones(true);
});
E.take.addEventListener("ended",()=>{reviewing=false;mode("play");if(musicOutput&&ctx)musicOutput.gain.setTargetAtTime(1,ctx.currentTime,.06)});
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
window.GEIAmStudio={open:enter,close:leave,version:2,getSession:()=>takeMeta};
outputSettings();
};
})();
