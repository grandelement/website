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
