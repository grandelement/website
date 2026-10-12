/* GE BANGERS — website-side publisher for BLITZ v167 and Cloudflare Radio 2.
 * No Blitz build. No owner token stored on disk, in localStorage, or the URL.
 * Radio 2 continues with its last validated saved program if BLITZ is offline.
 * This browser is a sync agent WHILE the authenticated DJ booth is open.
 */
(function(w,d){
"use strict";
var WORKER="https://ge-radio-sync.grandelement.workers.dev";
var STATIC="https://grandelement.com/radio/sync-playlist.json";
var busy=false,lastSignature="",lastSent=0,lastSuccess=0,lastError="",timer=0;
var lastKeys="",metaCache=null,metaAt=0,lastNowKey="",lastNowEpoch=0;
var el=function(id){return d.getElementById(id)};
function say(message,failed){
 var node=el("geBangersSyncStatus");
 if(node){node.textContent=message;node.classList.toggle("error",!!failed);}
}
function pathsEqual(a,b){return String(a||"")===String(b||"");}
function norm(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");}
async function json(response){
 var data=await response.json().catch(function(){return {}});
 if(!response.ok||!data||data.ok===false)throw new Error((data&&data.error)||("HTTP "+response.status));
 return data;
}
async function measuredTracks(){
 if(metaCache&&Date.now()-metaAt<3600000)return metaCache;
 var r=await fetch(STATIC,{cache:"no-store"});
 var p=await json(r);
 if(p.format!=="ge-radio-clock-v1"||!Array.isArray(p.tracks))throw new Error("Measured music catalog is missing.");
 var m={byPath:{},byTitle:{},clips:[]};
 p.tracks.forEach(function(t){
  if(!t.path||!t.url||!(Number(t.duration_ms)>1000))return;
  m.byPath[t.path]=t;
  if(t.kind==="station_id")m.clips.push(t);
  var key=norm(t.album)+"|"+norm(t.title);
  if(!m.byTitle[key])m.byTitle[key]=t;
 });
 metaCache=m;metaAt=Date.now();return m
}
async function getBlitz(path){
 if(typeof api!=="function")throw new Error("Open the website GE DJ Booth to synchronize Bangers.");
 return json(await api(path))
}
function fromQueue(q,meta,library){
 var path=String(q&&q.path||"");
 if(path&&meta.byPath[path])return meta.byPath[path];
 var key=norm(q&&q.album)+"|"+norm(q&&q.title);
 if(meta.byTitle[key])return meta.byTitle[key];
 var item=(library||[]).find(function(i){return i.kind==="song"&&norm(i.album)===norm(q.album)&&norm(i.title)===norm(q.title)});
 return item&&meta.byPath[item.path]||null
}
async function build(){
 var results=await Promise.all([getBlitz("/control/status"),getBlitz("/control/playlists"),getBlitz("/control/library"),measuredTracks()]);
 var state=results[0],p=results[1],library=results[2].items||[],meta=results[3];
 var bangers=(p.items||[]).find(function(x){return norm(x.name)==="bangers"});
 if(!bangers)throw new Error("Bangers was not found on BLITZ. Save it in PLAYLISTS first.");
 if(!state.custom_mix_enabled||String(state.custom_mix_id||"")!==String(bangers.id||""))
  throw new Error("Activate Bangers in the BLITZ DJ Booth first. Radio 1 is not currently using it.");
 var base=[],missing=[];
 (bangers.paths||[]).forEach(function(path){
  var track=meta.byPath[String(path||"")];
  if(track&&track.kind==="song")base.push(track);
  else missing.push(path);
 });
 if(missing.length)throw new Error(missing.length+" Bangers track(s) lack measured backup audio. Nothing changed on Radio 2.");
 if(base.length<3)throw new Error("Bangers needs at least 3 measured songs.");
 var valid=new Set(base.map(function(x){return x.path}));
 var clips=meta.clips.slice(),clipNumber=0,songs=0,out=[],used={};
 function add(x){
  if(!x||used[x.path])return false;
  out.push(x);used[x.path]=true;
  if(x.kind==="song"){songs++;
   // Clips preserve BLITZ's 4–6-song identification pattern on the independent backup.
   if(songs%5===0&&clips.length){var clip=clips[clipNumber++%clips.length];out.push(clip);}
  }
  return true
 }
 var current=fromQueue(state.now,meta,library);
 if(current&&(current.kind==="station_id"||valid.has(current.path)))add(current);
 var incoming=[state.next].concat(state.coming||[]);
 incoming.forEach(function(q){
  var x=fromQueue(q,meta,library);
  if(x&&(x.kind==="station_id"||valid.has(x.path)))add(x)
 });
 base.forEach(add);
 if(out.length<3)throw new Error("Bangers backup has no playable schedule.");
 // Anchor the clock to the actual BLITZ NOW track only if its observed start is credible.
 var now=Date.now(),slotKey=String(state.now&&state.now.slot||"")+"|"+String(current&&current.path||"");
 var epoch=(slotKey===lastNowKey&&lastNowEpoch>0)?lastNowEpoch:now;
 if(current&&out[0]&&pathsEqual(current.path,out[0].path)&&Number(state.now_started_at)>0){
  var begun=Math.round(Number(state.now_started_at)*1000),elapsed=now-begun;
  if(elapsed>=0&&elapsed<Math.max(1000,Number(current.duration_ms)-1000))epoch=begun
 }
 lastNowKey=slotKey;lastNowEpoch=epoch;
 var total=out.reduce(function(sum,x){return sum+Number(x.duration_ms)},0);
 var program={format:"ge-radio-clock-v1",playlist_name:"Bangers",playlist_id:String(bangers.id),
  epoch_utc_ms:epoch,cycle_duration_ms:total,tracks:out,
  playlist_hash:"bangers-"+out.map(function(x){return x.path}).join("|").length+"-"+Math.floor(epoch/1000)};
 var signature=JSON.stringify({playlist_id:bangers.id,paths:bangers.paths,epoch:epoch,now:state.now&&state.now.slot,
  queue:incoming.map(function(q){return q&&q.slot}),tracks:out.map(function(x){return x.path})});
 return {program:program,signature:signature,name:bangers.name,count:out.length}
}
async function publishNow(opts){
 opts=opts||{};
 if(busy)throw new Error("Bangers synchronization is already running.");
 busy=true;
 try{
  var owner=w.GERadioOwner;
  var secret=owner&&(opts.interactive?owner.authorize():owner.getKey());
  if(!secret)throw new Error("Owner key required. Tap SYNC BANGERS or RADIO 2 to authorize this DJ session.");
  say("BANGERS · READING RADIO 1",false);
  var snapshot=await build();
  if(!opts.force&&snapshot.signature===lastSignature){say("BANGERS · SYNCED "+new Date(lastSuccess).toLocaleTimeString(),false);return {ok:true,unchanged:true}}
  say("BANGERS · SENDING TO RADIO 2",false);
  var response=await fetch(WORKER+"/v1/admin/program",{
   method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+secret},
   body:JSON.stringify({program:snapshot.program}),cache:"no-store"
  });
  var data=await json(response);
  lastSignature=snapshot.signature;lastSent=Date.now();lastSuccess=lastSent;lastError="";
  say("BANGERS · SYNCED TO RADIO 2 · "+snapshot.count+" TRACKS",false);
  return data
 }catch(e){
  lastError=String(e&&e.message||e);say("RADIO 2 NOT SYNCED · "+lastError,true);
  throw e
 }finally{busy=false}
}
function schedule(){
 clearTimeout(timer);
 timer=setTimeout(function(){
  var owner=w.GERadioOwner;
  if(!owner||!owner.getKey()||d.hidden||busy)return;
  publishNow().catch(function(){})
 },2000)
}
function init(){
 var rail=el("geClockRail"),header=d.querySelector(".wrap .top");if(!rail||!header)return;
 var banner=d.createElement("div");banner.id="geBangersSyncBar";
 banner.style.cssText="display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:4px 8px;margin:0 0 6px;background:#0b1a25;border:1px solid #29475b;border-radius:7px";
 header.parentNode.insertBefore(banner,header.nextSibling);
 var btn=d.createElement("button");btn.type="button";btn.id="geBangersSyncNow";btn.textContent="SYNC BANGERS";
 btn.style.cssText="min-height:30px;padding:0 8px;font-size:9px;font-weight:900;border:1px solid #3a647e;border-radius:6px;color:#fff;background:#102532";
 btn.onclick=function(){publishNow({interactive:true,force:true}).catch(function(e){w.alert(e.message||e)})};
 banner.appendChild(btn);
 var line=d.createElement("span");line.id="geBangersSyncStatus";line.textContent="BANGERS · NOT YET SYNCED";
 line.style.cssText="font-size:9px;color:#9bc7db;white-space:normal;max-width:320px";
 banner.appendChild(line);
 // Changes to the saved playlist or active queue are reflected within ~25 s while the booth remains open.
 w.setInterval(function(){if(!d.hidden&&w.GERadioOwner&&w.GERadioOwner.getKey())schedule()},25000);
 d.addEventListener("visibilitychange",function(){if(!d.hidden)schedule()});
 // Scheduled fast refresh after normal DJ interactions, without intercepting or replacing the BLITZ handlers.
 d.addEventListener("click",function(e){
  var b=e.target&&e.target.closest&&e.target.closest("button");
  if(b&&/^(playlistSave|playlistUse|reshuffleQueue|skipNow|playlistDelete|usePlaylist|savePlaylist)$/.test(b.id||""))schedule()
 },false);
}
w.GEBangersSync={publishNow:publishNow,schedule:schedule,state:function(){return {lastSuccess:lastSuccess,lastError:lastError}}};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
