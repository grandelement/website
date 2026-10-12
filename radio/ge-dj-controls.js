/* GE Radio shared-DJ playlist controls. Separate from the existing BLITZ mixer. */
(function(w,d){
"use strict";
var API="https://ge-radio-sync.grandelement.workers.dev";
var rail=d.getElementById("geClockRail");
if(!rail)return;
var style=d.createElement("style");
style.textContent=[
"#geDJOpen{flex:none;min-height:30px;padding:3px 7px;border:1px solid #55d8c1;border-radius:7px;color:#e7fffa;background:#123c38;font-size:10px;font-weight:900}",
"#geDJOverlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:999999;display:none;align-items:center;justify-content:center;padding:12px}",
"#geDJOverlay.show{display:flex}",
"#geDJPanel{box-sizing:border-box;background:#0a121d;border:1px solid #478e99;border-radius:13px;color:#ecf7ff;width:min(100%,640px);max-height:90vh;display:flex;flex-direction:column;gap:10px;padding:15px;font:14px Arial,sans-serif}",
"#geDJPanel *{box-sizing:border-box}",
"#geDJPanel h3{font:900 18px Arial;margin:0;letter-spacing:1px;color:#77dde4}",
"#geDJPanel .geDJHead{display:flex;justify-content:space-between;align-items:center;gap:8px}",
"#geDJPanel .geDJButtons{display:flex;gap:7px;flex-wrap:wrap}",
"#geDJPanel button{cursor:pointer;background:#1b394c;color:white;border:1px solid #55778b;border-radius:7px;padding:9px;font:800 12px Arial}",
"#geDJPanel button:disabled{opacity:.4;cursor:default}",
"#geDJPanel .geDJDanger{border-color:#b45b68;background:#542533}",
"#geDJPanel .geDJGood{border-color:#52bba6;background:#205142}",
"#geDJRead{color:#9ce8d9;min-height:20px}",
"#geDJPanel .geDJNote{font:12px/1.35 Arial;color:#a9b9c4}",
"#geDJQueue{overflow:auto;min-height:100px;border:1px solid #344451;border-radius:8px}",
"#geDJQueue .geDJRow{display:grid;grid-template-columns:42px minmax(0,1fr) 33px 33px;align-items:center;gap:6px;padding:5px 7px;border-bottom:1px solid #263747;min-height:46px}",
"#geDJQueue .geDJCurrent{background:#15372e}",
"#geDJQueue .geDJRow b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}",
"#geDJQueue .geDJRow small{display:block;color:#8cabb7;font-size:10px}",
"#geDJQueue .geDJRow button{padding:3px;min-height:30px;font-size:15px}",
"#geDJQueue .geDJNum{font-size:11px;color:#a1c5d1;text-align:center}"
].join("\n");
d.head.appendChild(style);
var open=d.createElement("button");open.id="geDJOpen";open.type="button";open.textContent="GE SONGS";
rail.parentNode.insertBefore(open,rail.nextSibling);
var overlay=d.createElement("div");overlay.id="geDJOverlay";
overlay.innerHTML='<section id="geDJPanel" role="dialog" aria-modal="true" aria-label="GE Radio playlist controls">'
 +'<div class="geDJHead"><h3>GE RADIO · DJ PLAYLIST</h3><button id="geDJClose" type="button">CLOSE</button></div>'
 +'<div class="geDJNote">These controls change GE RADIO for ALL listeners using the GE Clock player. The BLITZ mixer stays separate.</div>'
 +'<div id="geDJRead" role="status">Loading playlist…</div>'
 +'<div class="geDJButtons"><button type="button" id="geDJStart" class="geDJGood">START</button><button type="button" id="geDJStop" class="geDJDanger">STOP</button>'
 +'<button type="button" id="geDJSkip">SKIP</button><button type="button" id="geDJShuffle">RESHUFFLE</button><button type="button" id="geDJRefresh">REFRESH</button></div>'
 +'<div class="geDJNote">COMING UP · Use ↑ and ↓ to remix the song order. Changes synchronize with all GE Clock listeners.</div>'
 +'<div id="geDJQueue"></div></section>';
d.body.appendChild(overlay);
function el(id){return d.getElementById(id);}
var program=null,ge=null,station=null,serverOffset=0,busy=false;
function esc(s){return String(s===undefined?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function msg(s){el("geDJRead").textContent=s;}
function get(path,cb){
 var x=new XMLHttpRequest();x.open("GET",API+path,true);x.onreadystatechange=function(){
  if(x.readyState!==4)return;
  try{var v=JSON.parse(x.responseText);if(x.status!==200||!v.ok)throw Error(v.error||"Server error");
   if(v.server_now_ms)serverOffset=v.server_now_ms-Date.now();
   cb(null,v);
  }catch(e){cb(e);}
 };x.onerror=function(){cb(Error("Cannot reach radio clock"));};x.send(null);
}
function latest(cb){
 get("/v1/program",function(err,p){
  if(err){msg(err.message);if(cb)cb(err);return;}
  program=p.program;
  get("/v1/state",function(e,s){
   if(e){msg(e.message);if(cb)cb(e);return;}
   station=s.station;ge=s.ge_dj||null;render();if(cb)cb(null);
  });
 });
}
function position(){
 if(!program||!program.tracks||!program.tracks.length)return {slot:0,offset:0};
 var order=ge&&ge.playlist_hash===program.playlist_hash&&ge.order&&ge.order.length===program.tracks.length?ge.order:null;
 var total=Number(program.cycle_duration_ms)||1,now=Date.now()+serverOffset;
 var elapsed=order?(Number(ge.position_ms)+(ge.running?now-Number(ge.anchor_at_ms):0)):now-Number(program.epoch_utc_ms);
 var pos=((elapsed%total)+total)%total;
 for(var i=0;i<program.tracks.length;i++){
  var idx=order?order[i]:i,ln=Number(program.tracks[idx].duration_ms);
  if(pos<ln)return {slot:i,offset:pos};
  pos-=ln;
 }
 return {slot:0,offset:0};
}
function render(){
 if(!program)return;
 var songs=program.tracks,order=ge&&ge.playlist_hash===program.playlist_hash&&ge.order&&ge.order.length===songs.length?ge.order:null;
 if(!order){order=[];for(var k=0;k<songs.length;k++)order.push(k);}
 var here=position(),running=!ge||ge.running!==false;
 var mode=station&&station.to==="ge"?"GE RADIO ON AIR":"BLITZ ON AIR";
 msg(mode+" · GE playlist "+(running?"RUNNING":"STOPPED")+" · "+songs.length+" tracks");
 el("geDJStart").disabled=busy||running;
 el("geDJStop").disabled=busy||!running;
 var h="";
 for(var i=0;i<order.length;i++){
  var slot=(here.slot+i)%order.length,t=songs[order[slot]];
  var curr=i===0,prev=slot,next=slot,kind=t.kind||"song";
  if(kind!=="station_id"){
   for(var step=1;step<order.length;step++){var p=(slot-step+order.length)%order.length;
    if(songs[order[p]].kind!=="station_id"){prev=p;break;}}
   for(var step2=1;step2<order.length;step2++){var q=(slot+step2)%order.length;
    if(songs[order[q]].kind!=="station_id"){next=q;break;}}
  }
  var locked=kind==="station_id"?' disabled title="Station IDs stay spaced between songs"':'';
  h+='<div class="geDJRow'+(curr?' geDJCurrent':'')+'">'
   +'<span class="geDJNum">'+(curr?"NOW":String(i+1))+'</span>'
   +'<span><b>'+esc(t.title||"Untitled")+'</b><small>'+esc(t.album||"Grand Element")+'</small></span>'
   +'<button type="button"'+locked+' data-from="'+slot+'" data-to="'+prev+'" aria-label="Move up">↑</button>'
   +'<button type="button"'+locked+' data-from="'+slot+'" data-to="'+next+'" aria-label="Move down">↓</button></div>';
 }
 el("geDJQueue").innerHTML=h;
}
function command(action,extra){
 if(busy||!program)return;
 if(action==="stop"&&!w.confirm("STOP GE RADIO music for everyone listening to the GE Clock player?"))return;
 if(action==="reshuffle"&&!w.confirm("Reshuffle the GE RADIO playlist for everyone listening?"))return;
 if(!w.GERadioDJAuth||!w.GERadioDJAuth.post){msg("DJ authorization controls unavailable. Reload this page.");return;}
 var body={action:action,expected_revision:ge?ge.revision:0};
 if(extra)for(var k in extra)if(Object.prototype.hasOwnProperty.call(extra,k))body[k]=extra[k];
 busy=true;msg("Sending GE RADIO DJ command…");
 w.GERadioDJAuth.post("/v1/admin/ge",body,function(err,result){
  busy=false;
  if(err){msg(err.message||"Command did not complete.");latest();return;}
  ge=result.ge_dj;render();
  msg("Updated for GE Clock listeners · "+action.toUpperCase());
 });
}
el("geDJClose").onclick=function(){overlay.className="";};
open.onclick=function(){overlay.className="show";latest();};
el("geDJStart").onclick=function(){command("play");};
el("geDJStop").onclick=function(){command("stop");};
el("geDJSkip").onclick=function(){command("skip");};
el("geDJShuffle").onclick=function(){command("reshuffle");};
el("geDJRefresh").onclick=function(){latest();};
el("geDJQueue").onclick=function(e){
 var target=e.target,from=target.getAttribute("data-from"),to=target.getAttribute("data-to");
 if(from===null||to===null)return;
 command("move",{from_pos:Number(from),to_pos:Number(to)});
};
overlay.onclick=function(e){if(e.target===overlay)overlay.className="";};
d.addEventListener("keydown",function(e){if(e.key==="Escape"&&overlay.className==="show")overlay.className="";});
})(window,document);
