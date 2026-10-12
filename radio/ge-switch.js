/* DJ-only remote control: buttons change the listener-wide GE Radio clock state.
 * A separate admin token stays in memory only; never persisted into website assets.
 */
(function(w,d){
"use strict";
var API="https://ge-radio-sync.grandelement.workers.dev";
var blitz=d.getElementById("geStationBlitz"),ge=d.getElementById("geStationGE"),
    read=d.getElementById("geStationStatus"),switchBusy=false,key="";
w.GERadioOwner={
 getKey:function(){return key;},
 authorize:function(){if(!key)key=w.prompt("GE Radio owner key (kept only in memory for this session)","")||"";return key;},
 clear:function(){key="";}
};
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
function choose(to){
 if(switchBusy)return;
 var fadeNode=d.getElementById("crossfade");
 var secs=fadeNode?Number(fadeNode.value):8;
 if(!isFinite(secs))secs=8;
 secs=Math.max(0,Math.min(30,secs));
 var source=to==="ge"?"GE RADIO":"BLITZ";
 var ask="Switch EVERY connected GE Clock listener to "+source+"?\n\nThe selected "+secs+"-second crossfade will begin after devices are given time to prepare.\n\nExisting BLITZ broadcasting is NOT shut down.";
 if(!w.confirm(ask))return;
 if(!w.GERadioOwner.authorize()){status("CANCELLED · Nothing switched");return;}
 switchBusy=true;
 function commitSwitch(){
  status("SENDING CONFIRMED SWITCH…");
  http("POST","/v1/admin/switch",{to:to,crossfade_seconds:secs},function(err,result){
   switchBusy=false;
   if(err){if(/authorization|token|401/i.test(err.message))w.GERadioOwner.clear();status("NOT SWITCHED · "+err.message);return;}
   show(result.station);
   status(result.unchanged?"ALREADY ON "+source:"SWITCH SCHEDULED · "+source+" · "+secs+"s");
  });
 }
 if(to==="ge"){
  if(!w.GEBangersSync||!w.GEBangersSync.publishNow){switchBusy=false;status("NOT SWITCHED · Bangers sync unavailable");return;}
  status("VERIFYING BANGERS ON RADIO 2…");
  w.GEBangersSync.publishNow({force:true}).then(commitSwitch).catch(function(e){
   switchBusy=false;status("NOT SWITCHED · "+String(e&&e.message||e))
  });
 }else commitSwitch();
}
blitz.onclick=function(){choose("blitz");};
ge.onclick=function(){choose("ge");};
refresh();w.setInterval(refresh,7500);
})(window,document);
