/* DJ-only remote control: buttons change the listener-wide GE Radio clock state.
 * Authorized controls reuse the DJ trusted-device token from the signed-in browser.
 * The short DJ login code and Cloudflare owner secret are not embedded in these assets.
 */
(function(w,d){
"use strict";
var API="https://ge-radio-sync.grandelement.workers.dev";
function djAuthHeaders(){
 try{
  var id=w.localStorage.getItem("geDjTrustedIdV1")||"";
  var token=w.localStorage.getItem("geDjTrustedTokenV1")||"";
  if(id&&token)return {"X-GE-DJ-Device-ID":id,"X-GE-DJ-Device-Token":token};
 }catch(_){}
 return null;
}
var blitz=d.getElementById("geStationBlitz"),ge=d.getElementById("geStationGE"),
    read=d.getElementById("geStationStatus"),switchBusy=false;
w.GERadioOwner={
 getHeaders:djAuthHeaders,
 getKey:function(){return djAuthHeaders()?"trusted-dj-device":"";},
 authorize:function(){return !!djAuthHeaders();},
 ensure:async function(){
  var found=djAuthHeaders();if(found)return found;
  // DJ v167 can issue a high-entropy trusted-device token after normal login.
  if(typeof rememberDjDevice==="function")await rememberDjDevice();
  found=djAuthHeaders();
  if(!found)throw new Error("Sign in to the website GE DJ Booth first. No separate Radio 2 code is needed.");
  return found;
 },
 clear:function(){}
};
if(!blitz||!ge)return;
function status(t){if(read)read.textContent=t;}
function http(method,url,body,cb){
 var x=new XMLHttpRequest();
 x.open(method,API+url,true);
 x.setRequestHeader("Accept","application/json");
 if(method==="POST"){
  var auth=djAuthHeaders();
  if(!auth){cb(new Error("Sign in to GE DJ first."));return;}
  x.setRequestHeader("Content-Type","application/json");
  Object.keys(auth).forEach(function(k){x.setRequestHeader(k,auth[k]);});
 }
 x.onreadystatechange=function(){if(x.readyState!==4)return;
  try{var data=JSON.parse(x.responseText);
      if(!data.ok)throw new Error(data.error||"Radio switch failed");
      cb(null,data);
  }catch(e){cb(e);}
 };
 x.onerror=function(){cb(new Error("Radio clock unreachable"));};
 x.send(body?JSON.stringify(body):null);
}
function show(state){
 if(!state)return;
 var now=Date.now(),transition=now>=state.start_at_ms&&now<state.start_at_ms+state.duration_ms;
 blitz.className=state.to==="blitz"?"geStationOn":"";
 ge.className=state.to==="ge"?"geStationOn":"";
 if(transition)status("CROSSFADE · "+String(state.from).toUpperCase()+" → "+String(state.to).toUpperCase());
 else if(now<state.start_at_ms&&state.from!==state.to)status("QUEUED · "+String(state.from).toUpperCase()+" → "+String(state.to).toUpperCase());
 else status("LISTENERS · "+(state.to==="ge"?"GE RADIO":"BLITZ"));
}
function refresh(){
 http("GET","/v1/state",null,function(err,d){
  if(err){status("GE CLOCK OFFLINE · Blitz unchanged");return;}
  show(d.station);
 });
}
function choose(to){
 if(switchBusy)return;
 var fadeNode=d.getElementById("crossfade");
 var secs=fadeNode?Number(fadeNode.value):8;
 if(!isFinite(secs))secs=8;
 secs=Math.max(0,Math.min(30,secs));
 var source=to==="ge"?"GE RADIO":"BLITZ";
 var ask="Switch EVERY connected GE Clock listener to "+source+"?\n\nThe selected "+secs+"-second crossfade will begin after devices are given time to prepare.\n\nExisting BLITZ broadcasting is NOT shut down.";
 if(!w.confirm(ask))return;
 switchBusy=true;
 function commitSwitch(){
  status("SENDING CONFIRMED SWITCH…");
  http("POST","/v1/admin/switch",{to:to,crossfade_seconds:secs},function(err,result){
   switchBusy=false;
   if(err){status("NOT SWITCHED · "+err.message);return;}
   show(result.station);
   status(result.unchanged?"ALREADY ON "+source:"SWITCH SCHEDULED · "+source+" · "+secs+"s");
  });
 }
 w.GERadioOwner.ensure().then(function(){
  if(to==="ge"){
   if(!w.GEBangersSync||!w.GEBangersSync.publishNow){
    switchBusy=false;status("NOT SWITCHED · Bangers sync unavailable");return;
   }
   status("VERIFYING BANGERS ON RADIO 2…");
   w.GEBangersSync.publishNow({force:true}).then(commitSwitch).catch(function(e){
    switchBusy=false;status("NOT SWITCHED · "+String(e&&e.message||e));
   });
  }else commitSwitch();
 }).catch(function(e){switchBusy=false;status("NOT SWITCHED · "+String(e&&e.message||e));});
}
blitz.onclick=function(){choose("blitz");};
ge.onclick=function(){choose("ge");};
refresh();w.setInterval(refresh,7500);
})(window,document);
