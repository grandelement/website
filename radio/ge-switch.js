/* DJ-only remote control: buttons change the listener-wide GE Radio clock state.
 * A separate admin token stays in memory only; never persisted into website assets.
 */
(function(w,d){
"use strict";
var API="https://ge-radio-sync.grandelement.workers.dev";
var blitz=d.getElementById("geStationBlitz"),ge=d.getElementById("geStationGE"),
    read=d.getElementById("geStationStatus"),switchBusy=false,key="";
if(!blitz||!ge)return;
function status(t){if(read)read.textContent=t;}
function http(method,url,body,cb){
 var x=new XMLHttpRequest();
 x.open(method,API+url,true);
 x.setRequestHeader("Accept","application/json");
 if(method==="POST"){x.setRequestHeader("Content-Type","application/json");x.setRequestHeader("Authorization","Bearer "+key);}
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
function postAdmin(path,body,cb){
 if(!key){
  key=w.prompt("Enter your private GE RADIO DJ key (used for station and playlist controls).","")||"";
  if(!key){status("CANCELLED · No DJ key entered");cb(new Error("Cancelled"));return;}
 }
 http("POST",path,body,function(err,result){
  if(err&&/authorization|token|401/i.test(err.message))key="";
  cb(err,result);
 });
}
w.GERadioDJAuth={post:postAdmin};
function choose(to){
 if(switchBusy)return;
 var fadeNode=d.getElementById("crossfade");
 var secs=fadeNode?Number(fadeNode.value):8;
 if(!isFinite(secs))secs=8;
 secs=Math.max(0,Math.min(30,secs));
 var source=to==="ge"?"GE RADIO":"BLITZ";
 var ask="Switch EVERY connected GE Clock listener to "+source+"?\n\nThe selected "+secs+"-second crossfade will begin after devices are given time to prepare.\n\nExisting BLITZ broadcasting is NOT shut down.";
 if(!w.confirm(ask))return;
 switchBusy=true;status("SENDING CONFIRMED SWITCH…");
 postAdmin("/v1/admin/switch",{to:to,crossfade_seconds:secs},function(err,d){
  switchBusy=false;
  if(err){
    if(/authorization|token|401/i.test(err.message))key="";
    status("NOT SWITCHED · "+err.message);
    return;
  }
  show(d.station);
  if(d.unchanged)status("ALREADY ON "+source);
  else status("SWITCH SCHEDULED · "+source+" · "+secs+"s");
 });
}
blitz.onclick=function(){choose("blitz");};
ge.onclick=function(){choose("ge");};
refresh();w.setInterval(refresh,7500);
})(window,document);
