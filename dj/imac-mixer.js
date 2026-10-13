/* GE iMAC CLASSIC — Safari 10/11 compatible input mixer and existing BLITZ live handoff.
 * Never starts microphone/Focusrite broadcasting without an explicit LIVE click.
 * Captures the SELECTED RECORDING INPUT, not the computer's output by magic.
 * Existing BLITZ v167 accepts 48 kHz stereo signed 16-bit little-endian PCM via WebSocket.
 * The BLITZ DROP transition crossfades automation and the DJ performance input.
 */
(function(w,d){
"use strict";
var API="https://radio.grandelement.blitz.cloud";
var OWNER="imac-live",a=null,stream=null,source=null,processor=null,silent=null,ctx=null,analyser=null,ws=null;
var localOn=false,busy=false,air=false,dropStarted=false,lastSignal=0,meterTimer=0,radioPoll=0,liveGain=1,raf=0,bufferedDropping=0,latestPeak=0,boardId="";
var actualInputName="",selectedInputName="",pcmFrames=0,connectedAt=0,diagnosticTimer=0,meterProbe=0,probeSeen=false,lastPcmFrames=0;
try{boardId=w.localStorage.getItem("geImacClassicBoardId")||"";if(!boardId){boardId="imac-classic-"+Date.now();w.localStorage.setItem("geImacClassicBoardId",boardId)}}catch(e){boardId="imac-classic"}
function el(s){return d.getElementById(s)}
function out(s,v){if(el(s))el(s).textContent=String(v)}
function klass(s,flag){if(el(s))el(s).disabled=!!flag}
function api(method,path,body,cb){
 var owner=w.GEImacClassic;
 if(!owner||!owner.api)return cb(new Error("DJ login is not connected."));
 owner.api(method,path,body,cb);
}
function requestDevices(){
 if(!navigator.mediaDevices||!navigator.mediaDevices.enumerateDevices){
  out("inputStatus","Safari cannot list devices. Try SELECT AUDIO INPUT and allow microphone access.");
  return;
 }
 navigator.mediaDevices.enumerateDevices().then(function(devices){
  var sel=el("inputs"),saved=sel.value,first="",count=0;
  sel.innerHTML="";
  var empty=d.createElement("option");empty.value="";empty.textContent="SYSTEM DEFAULT · macOS Sound Input";sel.appendChild(empty);
  for(var i=0;i<devices.length;i++){
   var x=devices[i];if(x.kind!=="audioinput")continue;
   var opt=d.createElement("option");opt.value=x.deviceId;
   opt.textContent=x.label||("Recording input "+String(++count));
   if(!count)count=1;
   sel.appendChild(opt);
   if(!first)first=x.deviceId;
  }
  if(saved){sel.value=saved;if(sel.value!==saved)sel.value="";}
  // Never silently select the first microphone; the DJ must choose Saffire or System Default.
  out("devicesFound","RECORDING INPUTS FOUND · "+(sel.options.length-1)+" · SELECTED: "+(sel.options[sel.selectedIndex]&&sel.options[sel.selectedIndex].textContent||"System Default"));
 }).catch(function(e){out("inputStatus","Device listing failed: "+String(e&&e.message||e))})
}
function getAudio(constraints){
 var md=navigator.mediaDevices;
 if(md&&md.getUserMedia)return md.getUserMedia(constraints);
 return new Promise(function(resolve,reject){
  var legacy=navigator.getUserMedia||navigator.webkitGetUserMedia;
  if(!legacy)return reject(new Error("This Safari lacks microphone capture. Requires Safari 11+ or compatible browser."));
  legacy.call(navigator,constraints,resolve,reject);
 });
}
function stopLocal(){
 clearTimeout(diagnosticTimer);diagnosticTimer=0;
 clearInterval(meterProbe);meterProbe=0;probeSeen=false;lastPcmFrames=0;
 localOn=false;pcmFrames=0;connectedAt=0;actualInputName="";
 if(processor){try{processor.disconnect();processor.onaudioprocess=null}catch(e){}}
 if(source){try{source.disconnect()}catch(e){}}
 if(silent){try{silent.disconnect()}catch(e){}}
 if(stream){try{stream.getTracks().forEach(function(t){t.stop()})}catch(e){}}
 processor=null;source=null;silent=null;stream=null;analyser=null;
 if(ctx){try{ctx.close()}catch(e){}}
 ctx=null;
 var b=el("inputBar");if(b)b.style.width="0%";
 var l=el("leftMeter"),r=el("rightMeter");if(l)l.style.width="0%";if(r)r.style.width="0%";
}
function onSamples(event){
 pcmFrames++;
 var ib=event.inputBuffer,ob=event.outputBuffer;
 var left=ib.getChannelData(0),right=ib.numberOfChannels>1?ib.getChannelData(1):left;
 var i,l=0,r=0;
 for(i=0;i<left.length;i+=4){l+=left[i]*left[i];r+=right[i]*right[i]}
 var n=Math.max(1,Math.ceil(left.length/4));
 var rmsL=Math.sqrt(l/n),rmsR=Math.sqrt(r/n),rms=Math.max(rmsL,rmsR);
 if(rms>0.0017)lastSignal=Date.now();
 if(pcmFrames===1){
  out("channelReadout","BROWSER CAPTURE · "+ib.numberOfChannels+" audio channel(s) · Saffire loopback on hardware inputs 19/20 may not be included");
  out("meterStatus","METER PROCESSING ACTIVE · Waiting for Ableton signal");
  updateLiveButton();
 }
 if(pcmFrames%20===0){
  out("meterStatus",rms>0.0017?"AUDIO SIGNAL DETECTED · "+(actualInputName||"Recording input"):"METER ACTIVE · SILENCE · Check Saffire MixControl routing");
  updateLiveButton();
 }
 var dB=function(s){return Math.max(-60,Math.min(0,s>0?20*Math.log(s)/Math.LN10:-60))};
 var ldb=dB(rmsL),rdb=dB(rmsR),pct=function(db){return Math.max(0,Math.min(100,Math.round((db+60)/60*100)))};
 if(el("leftMeter"))el("leftMeter").style.width=pct(ldb)+"%";
 if(el("rightMeter"))el("rightMeter").style.width=pct(rdb)+"%";
 latestPeak=Math.max(pct(ldb),pct(rdb));
 if(el("inputBar"))el("inputBar").style.width=latestPeak+"%";
 out("leftDb",ldb.toFixed(1)+" dB");out("rightDb",rdb.toFixed(1)+" dB");
 // Do not monitor the input in computer speakers: silent output keeps Safari's
 // legacy ScriptProcessor active without feeding the sound back to Focusrite.
 for(var ch=0;ch<ob.numberOfChannels;ch++){
  var o=ob.getChannelData(ch);for(i=0;i<o.length;i++)o[i]=0;
 }
 if(!air||!ws||ws.readyState!==1)return;
 if(ws.bufferedAmount>300000){
  bufferedDropping++;if(bufferedDropping>20){
   out("liveStatus","LIVE NETWORK TOO SLOW · Returning to Bangers");
   window.setTimeout(stopAir,0);
  }return;
 }
 bufferedDropping=0;
 // Resample 44.1/48 kHz or other device rates to the server's fixed 48k.
 var scale=48000/(ctx.sampleRate||48000),frames=Math.max(1,Math.round(left.length*scale));
 var payload=new ArrayBuffer(frames*4),dv=new DataView(payload),at=0;
 function sample(channel,index){var k=Math.max(0,Math.min(left.length-1,index)),lo=Math.floor(k),hi=Math.min(left.length-1,lo+1),t=k-lo;return channel[lo]+(channel[hi]-channel[lo])*t}
 for(i=0;i<frames;i++){
  var p=i/scale,vl=Math.max(-1,Math.min(1,sample(left,p)*liveGain)),vr=Math.max(-1,Math.min(1,sample(right,p)*liveGain));
  dv.setInt16(at,Math.max(-32768,Math.min(32767,Math.round(vl*32767))),true);
  dv.setInt16(at+2,Math.max(-32768,Math.min(32767,Math.round(vr*32767))),true);at+=4;
 }
 try{ws.send(payload)}catch(e){out("liveStatus","Audio send failed · "+(e.message||e));setTimeout(stopAir,0)}
}
function choiceName(){
 var sel=el("inputs"),opt=sel&&sel.options&&sel.options[sel.selectedIndex];
 return opt&&opt.textContent||"System Default";
}
function simplifyName(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"")}
function deviceMatches(track,expectedId,expectedName){
 if(!expectedId)return {ok:true}; // The macOS System Default is intentional.
 var actualId="",actualName=String(track&&track.label||"");
 try{var settings=track&&track.getSettings?track.getSettings():{};actualId=String(settings.deviceId||"")}catch(_){}
 if(actualId&&actualId!==expectedId)return {ok:false,why:"The browser returned a different device ID."};
 var actual=simplifyName(actualName),expected=simplifyName(expectedName);
 // Safari 10/11 sometimes ignores deviceId requests and returns the first mic.
 if(actual&&expected&&expected.indexOf("recordinginput")!==0&&
    actual.indexOf(expected)<0&&expected.indexOf(actual)<0)
  return {ok:false,why:"The browser substituted a different microphone."};
 if(!actualId&&!actual)return {ok:false,why:"Safari could not identify the selected recording input."};
 return {ok:true};
}
function connectInput(){
 if(busy||air){out("inputStatus","Take LIVE off air before changing the input.");return}
 busy=true;klass("selectInput",true);
 var choice=el("inputs").value,expected=choiceName();
 selectedInputName=expected;
 out("inputStatus","OPENING · "+expected+" · Verifying the actual audio device…");
 out("meterStatus","DEVICE CHECK IN PROGRESS · LIVE unavailable");
 // Use 'exact', never the previous 'ideal' deviceId that silently selected Built-in Mic.
 // Older Safari may ignore even 'exact'; verify the returned track below.
 var constraints={audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}};
 if(choice)constraints.audio.deviceId={exact:choice};
 getAudio(constraints).then(function(g){
  stopLocal();
  var track=g.getAudioTracks&&g.getAudioTracks()[0];
  var checked=deviceMatches(track,choice,expected);
  actualInputName=String(track&&track.label||"Unidentified input");
  if(!checked.ok){
   try{g.getTracks().forEach(function(t){t.stop()})}catch(_){}
   out("inputStatus","WRONG DEVICE · Selected "+expected+" but Safari opened "+actualInputName+". "+checked.why+" Select Saffire under macOS System Preferences > Sound > Input, then choose SYSTEM DEFAULT in this page and reconnect.");
   out("meterStatus","INPUT REJECTED · No broadcast enabled");
   return;
  }
  stream=g;
  var Audio=w.AudioContext||w.webkitAudioContext;
  if(!Audio)throw new Error("Safari Web Audio is unavailable.");
  ctx=new Audio();
  source=ctx.createMediaStreamSource(g);
  analyser=ctx.createAnalyser();analyser.fftSize=512;
  processor=ctx.createScriptProcessor?ctx.createScriptProcessor(4096,2,2):null;
  if(!processor)throw new Error("This Safari cannot capture audio samples in the DJ page.");
  // Safari can stop processing a ScriptProcessor that feeds a zero-gain node.
  // Connect the processor directly to the output instead. onSamples explicitly
  // fills every output buffer with zero, so the input is NEVER audible locally.
  silent=null;
  source.connect(analyser);analyser.connect(processor);
  processor.onaudioprocess=onSamples;
  processor.connect(ctx.destination);
  localOn=true;pcmFrames=0;connectedAt=Date.now();lastSignal=0;
  out("inputStatus","INPUT VERIFIED · "+actualInputName+" · "+Math.round(ctx.sampleRate)+" Hz. Play Ableton to test L/R.");
  var trackSettings={};
  try{trackSettings=track&&track.getSettings?track.getSettings():{}}catch(e){}
  out("channelReadout","SELECTED CAPTURE · "+actualInputName+" · Reported channels: "+String(trackSettings.channelCount||"unknown")+" · Browser channels will appear when audio processing starts");
  out("studioPresence","LOCAL IMAC STUDIO · AUDIO INPUT CONNECTED · Radio connection optional");
  out("meterStatus","WAITING FOR METER CALLBACKS · Play Ableton now");
  out("devicesFound","CONNECTED DEVICE · "+actualInputName);
  // Independent AnalyserNode probe remains useful if old Safari does not
  // invoke the ScriptProcessor callback. Probe is receive-only, never LIVE.
  var data=new Uint8Array(analyser.fftSize);
  meterProbe=setInterval(function(){
   if(!localOn||!analyser||!ctx)return;
   try{
    analyser.getByteTimeDomainData(data);
    var energy=0;
    for(var k=0;k<data.length;k++){var val=(data[k]-128)/128;energy+=val*val}
    var rms=Math.sqrt(energy/Math.max(1,data.length));
    var db=Math.max(-60,Math.min(0,rms>0?20*Math.log(rms)/Math.LN10:-60));
    var percent=Math.max(0,Math.min(100,Math.round((db+60)/60*100)));
    if(rms>0.0017){probeSeen=true;lastSignal=Date.now()}
    // If ScriptProcessor is not firing, show the directly received level so
    // the user can distinguish a Safari processing bug from silent routing.
    if(pcmFrames===0){
     if(el("leftMeter"))el("leftMeter").style.width=percent+"%";
     if(el("rightMeter"))el("rightMeter").style.width=percent+"%";
     out("leftDb",db.toFixed(1)+" dB");
     out("rightDb",db.toFixed(1)+" dB");
    }
    if(pcmFrames===0){
     out("meterStatus",rms>0.0017?"SIGNAL RECEIVED · Safari audio processor not running · LIVE disabled":
      "NO INPUT SIGNAL · Safari frames 0 · Check Saffire channels / loopback routing");
    }else if(pcmFrames!==lastPcmFrames){
     lastPcmFrames=pcmFrames;
     if(pcmFrames%20<3||Date.now()-lastSignal>2500){
      out("meterStatus",rms>0.0017?"SIGNAL PRESENT · "+pcmFrames+" processed frames":
       "PROCESSOR ACTIVE · "+pcmFrames+" frames · INPUT SILENT · Check Saffire channels");
     }
    }
    updateLiveButton();
   }catch(e){out("meterStatus","OLD SAFARI METER ERROR · "+String(e&&e.message||e))}
  },450);
  if(ctx.resume&&ctx.state==="suspended"){
   var resumed=ctx.resume();
   if(resumed&&typeof resumed.catch==="function")resumed.catch(function(e){out("meterStatus","AUDIO CONTEXT PAUSED · "+String(e&&e.message||e))});
  }
  diagnosticTimer=setTimeout(function(){
   if(!localOn)return;
   if(!pcmFrames){out("meterStatus",probeSeen?
    "SAFFIRE SIGNAL DETECTED · Safari LIVE processor not running · LIVE disabled":
    "NO AUDIO FRAMES · Saffire device recognized but no browser capture signal");}
   else if(Date.now()-lastSignal>3500)out("meterStatus","PROCESSING "+pcmFrames+" FRAMES · SILENCE · Saffire playback may be routed to LOOPBACK 19/20, not Safari 1/2");
   updateLiveButton();
  },3700);
 }).catch(function(e){
  stopLocal();out("inputStatus","INPUT FAILED · "+String(e&&e.message||e));
  out("meterStatus","CONNECT FAILED · Check macOS Sound Input and browser permission");
 }).then(function(){
  busy=false;klass("selectInput",false);updateLiveButton();
 });
}
function localAudioReady(){
 var track=stream&&stream.getAudioTracks&&stream.getAudioTracks()[0];
 return !!(localOn&&ctx&&pcmFrames>=2&&track&&track.readyState==="live"&&Date.now()-lastSignal<5000);
}
function radioAuthorized(){
 var owner=w.GEImacClassic;
 return !!(owner&&owner.loggedIn&&owner.loggedIn());
}
function updateLiveButton(){
 var b=el("liveToggle");if(!b)return;
 var audioReady=localAudioReady(),radioReady=radioAuthorized(),socketReady=!!w.WebSocket;
 b.textContent=busy?"WORKING…":air?"RETURN TO BANGERS":"GO LIVE ON BLITZ";
 b.className=air?"red":"green";
 b.disabled=busy||(!air&&(!audioReady||!radioReady||!socketReady));
 out("liveState",air?"ON AIR · BLITZ RADIO 1":"OFF AIR · BANGERS");
 if(!air&&!busy){
  out("liveReadiness",!localOn?"STUDIO INPUT DISCONNECTED · Connect Soundflower (2ch)":
   !audioReady?"STUDIO INPUT CONNECTED · Play Ableton and watch both meters":
   !socketReady?"THIS FIREFOX DOES NOT SUPPORT LIVE WEBSOCKETS":
   !radioReady?"STUDIO AUDIO READY · Radio 1 disconnected. CONNECT TO BLITZ RADIO only when you want to broadcast.":
   "LOCAL AUDIO + RADIO AUTH READY · TEST LIVE READINESS before pressing GO LIVE.");
 }else if(air)out("liveReadiness","ON AIR · Local stereo audio routed toward BLITZ");
}
function testReadiness(){
 var track=stream&&stream.getAudioTracks&&stream.getAudioTracks()[0];
 var selected=actualInputName||selectedInputName||"none";
 if(!localOn||!track||track.readyState!=="live"){
  out("liveProbeResult","LOCAL TEST: NO AUDIO INPUT. Choose Soundflower (2ch) and click CONNECT AUDIO INPUT. No broadcast attempted.");
  updateLiveButton();return;
 }
 if(!pcmFrames){
  out("liveProbeResult","LOCAL TEST: DEVICE OPEN, BUT NO AUDIO PROCESSOR FRAMES. Firefox is not yet processing audio. No broadcast attempted.");
  updateLiveButton();return;
 }
 if(!localAudioReady()){
  out("liveProbeResult","LOCAL TEST: "+selected+" connected ("+Math.round(ctx&&ctx.sampleRate||0)+" Hz), but Ableton sound was not detected in the past 5 seconds. No broadcast attempted.");
  updateLiveButton();return;
 }
 var localMessage="LOCAL AUDIO PASSED · "+selected+" · "+Math.round(ctx.sampleRate)+" Hz → 48,000 Hz stereo PCM";
 if(!w.WebSocket){
  out("liveProbeResult",localMessage+" · LIVE BLOCKED: browser WebSocket unavailable.");return;
 }
 if(!radioAuthorized()){
  out("liveProbeResult",localMessage+" · BLITZ disconnected. Your local studio works. Connect to Radio 1 separately when ready; BANGERS is untouched.");return;
 }
 out("liveProbeResult",localMessage+" · Checking BLITZ read-only status; not going live…");
 requestJSON("GET","/control/status",null).then(function(reply){
  var live=reply.broadcast||{},sources=live.sources||[];
  var another=false;
  for(var k=0;k<sources.length;k++){
   if(sources[k]&&sources[k].owner!==OWNER)another=true;
  }
  if(another){
   out("liveProbeResult",localMessage+" · BLITZ ALREADY HAS ANOTHER LIVE SOURCE. Do not take it over.");
  }else if(live.ready===false){
   out("liveProbeResult",localMessage+" · BLITZ is authenticated but its live audio FIFO is not ready. No broadcast attempted.");
  }else{
   out("liveProbeResult",localMessage+" · BLITZ AUTHENTICATED · LIVE ENDPOINT REPORTED READY · Safe to attempt GO LIVE. This was a read-only test, not proof of streamed audio.");
  }
 }).catch(function(e){
  out("liveProbeResult",localMessage+" · RADIO PREFLIGHT FAILED: "+String(e&&e.message||e)+". No broadcast attempted.");
 });
}
function showLive(s){out("liveStatus",s);updateLiveButton()}
function requestJSON(method,path,body){return new Promise(function(resolve,reject){api(method,path,body,function(err,obj){if(err||obj&&obj.ok===false)reject(err||new Error(obj.error||"Request failed"));else resolve(obj||{})})})}
function websocketOpen(token){
 return new Promise(function(resolve,reject){
  var finished=false,url=API.replace(/^http/,"ws")+"/control/live?token="+encodeURIComponent(token);
  try{ws=new WebSocket(url);ws.binaryType="arraybuffer"}catch(e){reject(e);return}
  var guard=setTimeout(function(){if(finished)return;finished=true;try{ws.close()}catch(e){}reject(new Error("Live audio socket timed out"))},12000);
  ws.onopen=function(){if(finished)return;finished=true;clearTimeout(guard);resolve()};
  ws.onerror=function(){if(finished)return;finished=true;clearTimeout(guard);reject(new Error("Live audio socket unavailable"))};
  ws.onclose=function(){if(!finished){finished=true;clearTimeout(guard);reject(new Error("Live audio connection closed"))}
   else if(air&&!busy){showLive("LIVE CONNECTION LOST · Returning to Bangers");stopAir()}
  };
 })
}
function waitForServerAudio(attempt){
 if(!air||!ws||ws.readyState!==1)return Promise.reject(new Error("Live WebSocket closed before BLITZ confirmed audio."));
 if(!localAudioReady())return Promise.reject(new Error("Ableton audio stopped during LIVE connection. BANGERS has not been faded."));
 return requestJSON("GET","/control/status",null).then(function(reply){
  var broadcast=reply&&reply.broadcast||{},sources=broadcast.sources||[];
  for(var j=0;j<sources.length;j++){
   var source=sources[j];
   if(source&&source.owner===OWNER&&Number(source.bytes_received||0)>1024&&
      source.last_chunk_age!=null&&Number(source.last_chunk_age)<4)
    return true;
  }
  if(attempt>=5)throw new Error("BLITZ did not confirm incoming iMac PCM audio. Keeping BANGERS on the air.");
  return new Promise(function(resolve){setTimeout(resolve,450)}).then(function(){return waitForServerAudio(attempt+1)});
 });
}
function startAir(){
 if(busy||air)return;
 if(!localAudioReady()){showLive("NOT READY · Play Ableton and confirm both local meters before LIVE.");return}
 if(!radioAuthorized()){showLive("RADIO DISCONNECTED · Connect to BLITZ first. Local audio stays available.");return}
 if(!w.WebSocket){showLive("LIVE UNAVAILABLE · This browser cannot open WebSocket audio.");return}
 if(!w.confirm("GO LIVE on BLITZ RADIO 1?\n\nThis sends your Soundflower stereo audio from Ableton to the public station, and fades BANGERS only AFTER BLITZ confirms receiving PCM.\n\nStop the local radio monitor to prevent feedback. Continue?"))return;
 busy=true;updateLiveButton();showLive("LIVE PRE-FLIGHT · Checking Radio 1 and local audio…");
 var launched=false;
 requestJSON("GET","/control/status",null).then(function(status){
  var current=status&&status.broadcast||{},sources=current.sources||[];
  for(var i=0;i<sources.length;i++){
   if(sources[i]&&sources[i].owner!==OWNER)throw new Error("Another studio or DJ is already LIVE. Disconnect it intentionally before broadcasting.");
  }
  if(current.active&&current.owner!==OWNER&&current.owner!=="multi")
   throw new Error("Another source is currently LIVE: "+String(current.owner||"unknown"));
  if(current.ready===false)throw new Error("BLITZ live mixer is not ready.");
  if(!localAudioReady())throw new Error("Ableton signal was lost during preflight.");
  return requestJSON("POST","/control/broadcast/session",{owner:OWNER});
 }).then(function(x){
  if(!x.token)throw new Error("BLITZ did not issue a live audio session.");
  return requestJSON("POST","/control/broadcast/start",{owner:OWNER,mode:"performance",transport:"websocket"}).then(function(){
   launched=true;return websocketOpen(x.token);
  });
 }).then(function(){
  air=true;
  var monitor=el("imacRadioAudio");
  if(monitor&&(!monitor.paused))monitor.pause();
  showLive("BLITZ LIVE SOCKET OPEN · Waiting for server confirmation of iMac audio…");
  return waitForServerAudio(0);
 }).then(function(){
  if(!air||!ws||ws.readyState!==1)throw new Error("Live WebSocket closed before the BANGERS handoff.");
  showLive("BLITZ CONFIRMED AUDIO · Crossfading from BANGERS to Ableton…");
  return requestJSON("POST","/control/drop/start",{mode:"stop"});
 }).then(function(){
  dropStarted=true;busy=false;updateLiveButton();
  showLive("ON AIR · ABLETON → BLITZ RADIO 1 · BANGERS faded out. Press RETURN TO BANGERS to end LIVE.");
  if(!ws||ws.readyState!==1)stopAir(true);
 }).catch(function(e){
  var message="LIVE NOT STARTED · "+String(e&&e.message||e);
  if(launched){
   air=true;busy=false;
   stopAir(true,message);
  }else{
   air=false;dropStarted=false;busy=false;updateLiveButton();
   out("liveStatus",message+" · BANGERS is unchanged.");
  }
 });
}
function stopAir(fast,priorError){
 if(busy&&fast!==true)return;
 if(!air&&!dropStarted)return;
 busy=true;updateLiveButton();showLive("RETURNING TO BANGERS · Restoring station music…");
 var dropError="";
 requestJSON("POST","/control/drop/stop",{fast:!!fast}).catch(function(e){
  dropError="Station fade could not be confirmed: "+String(e&&e.message||e);
 }).then(function(){
  return requestJSON("POST","/control/broadcast/stop",{owner:OWNER,force:false});
 }).then(function(){
  air=false;dropStarted=false;busy=false;
  if(ws){ws.onclose=null;try{ws.close()}catch(e){}ws=null}
  updateLiveButton();
  out("liveStatus",(priorError?priorError+" · ":"")+
   (dropError?"BLITZ SOURCE STOPPED BUT "+dropError+" · Verify BANGERS on the public stream.":
   "OFF AIR · BANGERS restored by the BLITZ server."));
 }).catch(function(e){
  // The radio may still have a live source. Keep a reconnect/return path.
  busy=false;
  updateLiveButton();
  out("liveStatus",(priorError?priorError+" · ":"")+
   "RETURN TO BANGERS NOT CONFIRMED · "+String(e&&e.message||e)+
   ". Check public radio and retry RETURN TO BANGERS. Do not close this tab.");
 });
}
function heartbeat(){
 if(!w.GEImacClassic||!w.GEImacClassic.loggedIn||!w.GEImacClassic.loggedIn())return;
 var input=el("inputs"),names=[];
 if(input)for(var i=1;i<input.options.length&&names.length<12;i++)names.push(input.options[i].textContent);
 var track=stream&&stream.getAudioTracks&&stream.getAudioTracks()[0];
 api("POST","/control/board/heartbeat",{
  board_id:boardId,role:"home",label:"iMAC · ABLETON",
  app_state:air?"live":"ready",
  channel_state:{
   device_kind:"mac",device_name:"iMac Ableton Focusrite",
   line_connected:localOn,line_air:air,line_source:track&&track.label||"",
   line_peak:latestPeak,audio_inputs:names,audio_permission:localOn?"granted":"unknown",
   line_track_state:track&&track.readyState||"none",
   audio_capture_supported:!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia),
   secure_context:location.protocol==="https:",user_agent:navigator.userAgent||""
  }
 },function(err,data){
  if(err)return;
  if(data&&data.boards&&el("deviceRoster")){
   var online=data.boards.filter(function(x){return x&&x.online}).map(function(x){return String(x.label||x.device_name||x.role)+" · "+(x.line_air||x.mic_air?"ON AIR":x.line_connected||x.mic_connected?"INPUT READY":"CONNECTED")});
   out("deviceRoster",online.length?online.join(" | "):"No linked GE DJ devices detected yet.");
  }
 })
}
function radioMeter(){
 if(!w.GEImacClassic||!w.GEImacClassic.loggedIn||!w.GEImacClassic.loggedIn())return;
 api("GET","/control/radio-meter",null,function(err,data){
  if(err||!data||!data.radio_meter)return;
  var m=data.radio_meter,pct=m.active?Number(m.pct||0):0;
  pct=Math.max(0,Math.min(100,pct));
  if(el("radioMeterBar"))el("radioMeterBar").style.width=pct+"%";
  out("radioDb",m.active?Number(m.db||-60).toFixed(1)+" dB":"OFF");
 })
}
function init(){
 if(!el("liveToggle"))return;
 el("selectInput").onclick=connectInput;
 el("inputs").onchange=function(){
 if(localOn)stopLocal();
 updateLiveButton();
 out("inputStatus","SELECTED · "+choiceName()+" · Click CONNECT AUDIO INPUT.");
 out("meterStatus","NOT CONNECTED · LIVE disabled");
};
 el("refreshInputs").onclick=requestDevices;
 el("liveToggle").onclick=function(){if(air)stopAir();else startAir()};
 if(el("testLive"))el("testLive").onclick=testReadiness;
 el("liveGain").oninput=function(){liveGain=Math.max(0,Math.min(1.5,Number(this.value)/100));out("liveGainRead",String(this.value)+"%")};
 if(el("stopInput"))el("stopInput").onclick=function(){if(air){showLive("Take LIVE off air first.");return}stopLocal();updateLiveButton();out("inputStatus","Recording input disconnected")};
 requestDevices();updateLiveButton();
 radioPoll=setInterval(radioMeter,1200);
 setInterval(heartbeat,5000);
 w.addEventListener("beforeunload",function(e){
  if(!air)return;
  // A navigation may cancel network commands and leave the radio muted.
  // Require the DJ to finish the explicit RETURN TO BANGERS handoff first.
  e.preventDefault();e.returnValue="The iMac is LIVE. Return to Bangers before leaving this page.";
 });
}
w.GEImacMixer={
 update:updateLiveButton,
 scan:requestDevices,
 stop:stopAir,
 announce:heartbeat,
 isOnAir:function(){return !!air||!!dropStarted;}
};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
