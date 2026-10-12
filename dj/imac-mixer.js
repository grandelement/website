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
  var empty=d.createElement("option");empty.value="";empty.textContent="SELECT RECORDING INPUT";sel.appendChild(empty);
  for(var i=0;i<devices.length;i++){
   var x=devices[i];if(x.kind!=="audioinput")continue;
   var opt=d.createElement("option");opt.value=x.deviceId;
   opt.textContent=x.label||("Recording input "+String(++count));
   if(!count)count=1;
   sel.appendChild(opt);
   if(!first)first=x.deviceId;
  }
  if(saved){sel.value=saved;if(sel.value!==saved)sel.value="";}
  if(!sel.value&&first)sel.value=first;
  out("devicesFound","RECORDING INPUTS FOUND · "+(sel.options.length-1));
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
 localOn=false;
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
 var ib=event.inputBuffer,ob=event.outputBuffer;
 var left=ib.getChannelData(0),right=ib.numberOfChannels>1?ib.getChannelData(1):left;
 var i,l=0,r=0;
 for(i=0;i<left.length;i+=4){l+=left[i]*left[i];r+=right[i]*right[i]}
 var n=Math.max(1,Math.ceil(left.length/4));
 var rmsL=Math.sqrt(l/n),rmsR=Math.sqrt(r/n),rms=Math.max(rmsL,rmsR);
 if(rms>0.0017)lastSignal=Date.now();
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
function connectInput(){
 if(busy||air){out("inputStatus","Take LIVE off air before changing the input.");return}
 busy=true;klass("selectInput",true);out("inputStatus","Requesting recording-input permission…");
 var choice=el("inputs").value;
 var constraints={audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}};
 if(choice)constraints.audio.deviceId={ideal:choice};
 getAudio(constraints).then(function(g){
  stopLocal();
  stream=g;
  var Audio=w.AudioContext||w.webkitAudioContext;
  if(!Audio)throw new Error("Safari Web Audio not available.");
  ctx=new Audio();
  source=ctx.createMediaStreamSource(g);
  analyser=ctx.createAnalyser();analyser.fftSize=512;
  processor=ctx.createScriptProcessor?ctx.createScriptProcessor(4096,2,2):null;
  if(!processor)throw new Error("This Safari cannot capture stereo PCM in the DJ page.");
  silent=ctx.createGain();silent.gain.value=0;
  source.connect(analyser);analyser.connect(processor);processor.connect(silent);silent.connect(ctx.destination);
  processor.onaudioprocess=onSamples;
  localOn=true;requestDevices();
  var track=g.getAudioTracks()[0];
  out("inputStatus","INPUT CONNECTED · "+(track&&track.label||"Recording input")+" · "+Math.round(ctx.sampleRate)+" Hz. Play Ableton and watch L/R.");
  out("devicesFound","READY · Input connected. LIVE will crossfade to this input.");
 }).catch(function(e){stopLocal();out("inputStatus","INPUT FAILED · "+String(e&&e.message||e))})
 .then(function(){busy=false;klass("selectInput",false);updateLiveButton()});
}
function updateLiveButton(){
 var b=el("liveToggle");if(!b)return;
 b.textContent=busy?"WORKING…":air?"RETURN TO BANGERS":"LIVE";
 b.className=air?"red":"green";b.disabled=busy||(!air&&!localOn);
 out("liveState",air?"ON AIR · FOCUSRITE":"OFF AIR · BANGERS");
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
function startAir(){
 if(busy||air)return;
 if(!localOn){showLive("SELECT FOCUSRITE INPUT FIRST");return}
 if(Date.now()-lastSignal>6500){showLive("NO INPUT AUDIO DETECTED · Play Ableton before going LIVE");return}
 if(!w.confirm("GO LIVE on BLITZ RADIO 1?\n\nBangers will crossfade into the iMac Focusrite input. The live audio is heard by listeners. Keep local radio monitoring off or use headphones."))return;
 busy=true;updateLiveButton();showLive("LIVE · Preparing audio connection…");
 var launched=false;
 // Never take over an iPhone or another Studio contribution without its consent.
 requestJSON("GET","/control/status",null).then(function(status){
  var current=status&&status.broadcast||{};
  if(current.active&&current.owner!==OWNER)throw new Error("Another DJ input is already live ("+String(current.owner||"other device")+"). Take it off air first.");
  return requestJSON("POST","/control/broadcast/session",{owner:OWNER});
 }).then(function(x){
  if(!x.token)throw new Error("BLITZ did not issue a live session.");
  return requestJSON("POST","/control/broadcast/start",{owner:OWNER,mode:"performance",transport:"websocket"}).then(function(){launched=true;return websocketOpen(x.token)})
 }).then(function(){
  air=true;updateLiveButton();
  // Mute only the local monitor. This does not stop listener audio on Radio 1.
  var monitor=el("imacRadioAudio");if(monitor&&(!monitor.paused))monitor.pause();
  showLive("LIVE · Audio connected · Crossfading from Bangers…");
  return new Promise(function(resolve){setTimeout(resolve,550)})
 }).then(function(){
  return requestJSON("POST","/control/drop/start",{mode:"stop"})
 }).then(function(){
  dropStarted=true;busy=false;updateLiveButton();
  showLive("LIVE · FOCUSRITE ON AIR · Bangers faded out");
  if(!ws||ws.readyState!==1)stopAir(true);
 }).catch(function(e){
  showLive("LIVE FAILED · "+String(e&&e.message||e));
  if(launched){air=true;busy=false;stopAir(true)}
  else {busy=false;air=false;updateLiveButton()}
 })
}
function stopAir(fast){
 if(busy&&fast!==true)return;
 if(!air&&!dropStarted)return;
 busy=true;updateLiveButton();showLive("RETURNING TO BANGERS · Fading live out…");
 requestJSON("POST","/control/drop/stop",{fast:!!fast}).catch(function(e){
  showLive("RETURN FADE ERROR · "+String(e&&e.message||e));
 }).then(function(){return requestJSON("POST","/control/broadcast/stop",{owner:OWNER,force:false})}).then(function(){
  showLive("OFF AIR · BANGERS restored");
 }).catch(function(e){showLive("LIVE STOP ERROR · "+String(e&&e.message||e))})
 .then(function(){air=false;dropStarted=false;busy=false;
  if(ws){ws.onclose=null;try{ws.close()}catch(e){}ws=null}
  updateLiveButton();
 })
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
 el("inputs").onchange=function(){if(localOn)stopLocal();updateLiveButton();out("inputStatus","Recording input selected. Click CONNECT INPUT to activate it.")};
 el("refreshInputs").onclick=requestDevices;
 el("liveToggle").onclick=function(){if(air)stopAir();else startAir()};
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
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
