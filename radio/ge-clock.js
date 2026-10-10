/* GE RADIO clock listener, ES5 compatible for iPhone 5 Safari.
 * Clock/master station controller: ge-radio-sync Cloudflare Worker.
 * Public listener has no administrative credentials or station-switch permission.
 */
(function(w,d){
"use strict";
var SETTINGS={
  api:"https://ge-radio-sync.grandelement.workers.dev",
  blitz:"https://radio.grandelement.blitz.cloud/stream.mp3",
  musicBase:"https://grandelement.com"
};
var aBlitz=d.getElementById("geClockBlitz");
var aGe=d.getElementById("geClockGE");
var button=d.getElementById("geClockPlay");
var msg=d.getElementById("geClockStatus");
var info=d.getElementById("geClockInfo");
var info2=d.getElementById("geClockSecondary");
var program=null,station={from:"blitz",to:"blitz",start_at_ms:0,duration_ms:0,revision:0},offset=0,playing=false,ready=false,loadedURL="";
var clockSample=false,ctx=null,gb=null,gg=null,softFade=false,lastRevision=-1,lastMode="";
var currentTrackIndex=-1,pendingSeek=false,lastError="";
var errors=0,legacyLastTrack="",legacyListenStart=0,legacyLastReport=0,legacySid="session-ge-"+Date.now();
function fallbackVault(type,meta){
 if(w.GEVault)return; // New Safari uses the existing full Vault client.
 var anon="";
 try{
  anon=localStorage.getItem("GE_VAULT_ANON_V1");
  if(!anon){anon="visitor-ge-"+Date.now()+"-"+Math.random().toString(36).slice(2);
    localStorage.setItem("GE_VAULT_ANON_V1",anon);}
 }catch(_){anon="visitor-ge-anon";}
 var payload={anon_id:anon,session_id:legacySid,surface:"radio",event_type:type,
   page_url:location.origin+location.pathname,page_path:location.pathname,
   track_title:meta&&meta.track_title||"",track_id:meta&&meta.track_id||"",
   album:meta&&meta.album||"",metadata:meta||{}};
 try{
  var x=new XMLHttpRequest();x.open("POST","https://vault.grandelement.com/v1/public/event",true);
  x.setRequestHeader("Content-Type","application/json");x.send(JSON.stringify(payload));
 }catch(_){}
}
function status(s){if(msg)msg.textContent=s;}
function pad(n){return n<10?"0"+n:String(n);}
function clock(){return Date.now()+offset;}
function request(path,cb){
 var sent=Date.now(),xhr=new XMLHttpRequest();
 xhr.open("GET",SETTINGS.api+path,true);
 xhr.setRequestHeader("Accept","application/json");
 xhr.onreadystatechange=function(){if(xhr.readyState!==4)return;
  if(xhr.status<200||xhr.status>=300){cb(new Error("Station server "+xhr.status));return;}
  try{var data=JSON.parse(xhr.responseText);if(!data.ok)throw new Error(data.error||"Unready station");
   var rx=Date.now(),sample=Number(data.server_now_ms)-(sent+rx)/2;
   if(isFinite(sample)&&Math.abs(sample)<86400000){offset=clockSample?(offset*.75+sample*.25):sample;clockSample=true;}
   cb(null,data);
  }catch(e){cb(e)}
 };
 xhr.onerror=function(){cb(new Error("Network unavailable"));};
 xhr.send(null);
}
function label(t){return t?(t.title||"Station Identification")+" · "+(t.album||"Grand Element"):"Waiting for music";}
function geAt(ms){
 if(!program||!program.tracks||!program.tracks.length)return null;
 var t=program.tracks,total=Number(program.cycle_duration_ms);
 if(!(total>0))return null;
 var pos=(ms-Number(program.epoch_utc_ms))%total;
 if(pos<0)pos+=total;
 for(var i=0;i<t.length;i++){
  var length=Number(t[i].duration_ms);
  if(pos<length-1)return {index:i,track:t[i],seconds:Math.max(0,pos/1000),remaining:(length-pos)/1000};
  pos-=length;
 }
 return {index:0,track:t[0],seconds:0,remaining:Number(t[0].duration_ms)/1000};
}
function musicURL(t){
 var s=String(t.url||"");
 if(/^https:\/\//i.test(s))return s;
 return SETTINGS.musicBase+s;
}
function setGain(el,val,gain){
 val=Math.max(0,Math.min(1,val));
 if(gain){gain.gain.value=val;return;}
 try{el.volume=val;}catch(_){}
}
function initAudio(){
 aBlitz.crossOrigin="anonymous";
 aGe.crossOrigin="anonymous";
 try{
  var AC=w.AudioContext||w.webkitAudioContext;
  var oldIOS=/iPhone OS (?:9|10|11|12)[_\.]|CPU (?:iPhone )?OS (?:9|10|11|12)[_\.]/.test(navigator.userAgent||"");
  if(AC&&!oldIOS){
   ctx=new AC();
   var nodeB=ctx.createMediaElementSource(aBlitz),nodeG=ctx.createMediaElementSource(aGe);
   gb=ctx.createGain();gg=ctx.createGain();
   nodeB.connect(gb);nodeG.connect(gg);gb.connect(ctx.destination);gg.connect(ctx.destination);
   if(ctx.resume)ctx.resume();
   softFade=true;
  }
 }catch(e){gb=null;gg=null;softFade=false;ctx=null}
 aBlitz.src=SETTINGS.blitz;
 setGain(aBlitz,0,gb);setGain(aGe,0,gg);
}
function syncGe(){
 var t=geAt(clock());if(!t||!playing)return;
 var url=musicURL(t.track);
 if(url!==loadedURL){
  loadedURL=url;currentTrackIndex=t.index;pendingSeek=true;
  aGe.src=url;
  aGe.load();
  if(info)info.textContent=label(t.track);
  try{w.GEVault&&w.GEVault.setTrackMetadata&&w.GEVault.setTrackMetadata(aGe,{
   title:t.track.title,album:t.track.album,track_id:t.track.path,
   source:"ge-radio-clock",station_id:t.track.kind==="station_id"
  });}catch(_){}
  legacyLastTrack=t.track.path||url;
  legacyListenStart=Date.now();
  fallbackVault("track_start",{track_title:t.track.title,track_id:legacyLastTrack,
    album:t.track.album,source:"ge-radio-clock",station_id:t.track.kind==="station_id"});
 }
 if(aGe.readyState>=1){
  var wanted=Math.max(0,Math.min(Number(t.track.duration_ms)/1000-.35,t.seconds));
  if(pendingSeek||Math.abs((Number(aGe.currentTime)||0)-wanted)>1.7){
   try{aGe.currentTime=wanted;pendingSeek=false;}catch(_){}
  }
 }
}
function switchShape(){
 var s=station||{from:"blitz",to:"blitz",start_at_ms:0,duration_ms:0};
 var now=clock(),start=Number(s.start_at_ms)||0,dur=Number(s.duration_ms)||0;
 if(now<start)return {blitz:s.from==="blitz"?1:0,ge:s.from==="ge"?1:0,mode:s.from};
 if(dur>0&&now<start+dur){
  var progress=Math.max(0,Math.min(1,(now-start)/dur));
  // Equal-power curve reduces perceived mid-fade loudness drop on newer phones.
  var from=Math.cos(progress*Math.PI/2),to=Math.sin(progress*Math.PI/2);
  return {blitz:(s.from==="blitz"?from:to),ge:(s.from==="ge"?from:to),mode:"switching"};
 }
 return {blitz:s.to==="blitz"?1:0,ge:s.to==="ge"?1:0,mode:s.to};
}
function ensurePlaying(el){
 if(el.paused){
  try{var p=el.play();if(p&&p.catch)p.catch(function(e){lastError=e&&e.message||"Tap PLAY to resume";});}catch(e){lastError=e.message||"Play blocked";}
 }
}
function stopUnneeded(el){if(!el.paused)el.pause();}
function nowRender(){
 if(!station||!playing)return;
 syncGe();
 var shape=switchShape(),b=shape.blitz,g=shape.ge;
 if(softFade&&station.from!==station.to&&clock()<station.start_at_ms&&clock()>station.start_at_ms-12000){
  // Prime the next channel at zero gain on browsers that allow background audio preparation.
  if(station.to==="ge"&&aGe.readyState>=2){setGain(aGe,0,gg);ensurePlaying(aGe);}
  if(station.to==="blitz"){setGain(aBlitz,0,gb);ensurePlaying(aBlitz);}
 }
 var isOld=/iPhone OS (9|10)[_\.]|CPU (?:iPhone )?OS (9|10)[_\.]/.test(navigator.userAgent||"");
 var canFade=softFade||(!isOld&&typeof aBlitz.volume==="number");
 // Start target before turning off the previous station to prevent dead air.
 if(b>0.005)ensurePlaying(aBlitz);
 if(g>0.005&&aGe.readyState>=1)ensurePlaying(aGe);
 var bReady=b<=0.005||(!aBlitz.paused&&aBlitz.readyState>=2);
 var gReady=g<=0.005||(!aGe.paused&&aGe.readyState>=2);
 if(canFade){
  if(!gReady && station.to==="ge"){
   ensurePlaying(aBlitz);setGain(aBlitz,1,gb);setGain(aGe,0,gg);
  }else if(!bReady && station.to==="blitz"){
   if(gReady)ensurePlaying(aGe);setGain(aGe,1,gg);setGain(aBlitz,0,gb);
  }else{
   setGain(aBlitz,b,gb);setGain(aGe,g,gg);
  }
 }else{
  // iPhone 5 fallback: Safari may enforce one audible audio element and ignore volume.
  // Keep an existing audible track until the new one has data, then switch.
  var useG=(g>=b)&&gReady;
  if(useG){if(aBlitz&&!aBlitz.paused)stopUnneeded(aBlitz);ensurePlaying(aGe);}
  else if(bReady){if(!aGe.paused)stopUnneeded(aGe);ensurePlaying(aBlitz);}
 }
 if(shape.mode==="ge"&&gReady){if(!aBlitz.paused)stopUnneeded(aBlitz);}
 if(shape.mode==="blitz"&&bReady){if(!aGe.paused)stopUnneeded(aGe);}
 if(info2){
  var active=shape.mode==="switching"?"CROSSFADE ACTIVE":shape.mode==="ge"?"GE RADIO CLOCK":"BLITZ LIVE STREAM";
  info2.textContent=active+" · UTC synchronized · "+(softFade?"SMOOTH AUDIO":"DEVICE FADE IF SUPPORTED");
 }
}
function pollState(){
 request("/v1/state",function(err,result){
  if(err){errors++;status(playing?"Last known source maintained · checking clock":"Clock unavailable · BLITZ fallback available");return;}
  errors=0;station=result.station;ready=true;
  var shape=switchShape();
  if(playing)status(shape.mode==="switching"?"Switching stations…":shape.mode==="ge"?"GE RADIO · ON":"BLITZ · ON");
  else status("Ready · tap PLAY · "+(shape.mode==="ge"?"GE RADIO":"BLITZ"));
  if(station&&station.revision!==lastRevision){
   lastRevision=station.revision;
   try{w.GEVault&&w.GEVault.radio&&w.GEVault.radio("station_mode_seen",{revision:lastRevision,to:station.to});}catch(_){}
  }
 });
}
function pollProgram(){
 request("/v1/program",function(err,result){
  if(err){status("GE RADIO playlist not ready: "+err.message);return;}
  program=result.program;syncGe();
 });
}
function begin(){
 if(playing){playing=false;stopUnneeded(aBlitz);stopUnneeded(aGe);button.textContent="PLAY";status("Paused");return;}
 playing=true;button.textContent="PAUSE";
 if(!ready)pollState();
 if(!program)pollProgram();
 if(!aBlitz.src)initAudio();
 if(ctx&&ctx.resume)ctx.resume();
 status("Tuning shared stations…");
 nowRender();
 try{w.GEVault&&w.GEVault.radio&&w.GEVault.radio("radio_clock_join",{source:"ge-radio-clock"});}catch(_){}
 fallbackVault("radio_open",{source:"ge-radio-clock"});
}
if(button)button.onclick=begin;
aGe.addEventListener("loadedmetadata",function(){pendingSeek=true;syncGe();});
aGe.addEventListener("canplay",function(){if(playing)nowRender();});
aGe.addEventListener("error",function(){status("GE RADIO track failed to load · maintaining available audio");});
aBlitz.addEventListener("error",function(){status("Blitz stream unavailable · retrying");});
pollState();pollProgram();
w.setInterval(pollState,7500);
w.setInterval(function(){if(playing)nowRender();},500);
w.setInterval(function(){if(playing&&program)syncGe();},4500);
w.setInterval(function(){
 if(!playing||!program||!legacyLastTrack||aGe.paused||!w.GEVault===false)return;
 // Only old Safari needs the fallback. Never send duplicate events on modern devices.
 if(w.GEVault)return;
 var now=Date.now();if(now-legacyLastReport<30000)return;legacyLastReport=now;
 var t=geAt(clock());if(!t)return;
 fallbackVault("track_progress",{track_title:t.track.title,track_id:t.track.path,
   album:t.track.album,source:"ge-radio-clock",
   listened_seconds:Math.max(0,Math.round((now-legacyListenStart)/1000)),
   position_seconds:Number(aGe.currentTime)||0});
},10000);
d.addEventListener("visibilitychange",function(){if(!d.hidden){pollState();if(playing)nowRender();}});
})(window,document);
