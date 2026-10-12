/* GE BANGERS — website-side publisher for BLITZ v167 and Cloudflare Radio 2.
 * No Blitz build. No owner token stored on disk, in localStorage, or the URL.
 * Radio 2 continues with its last validated saved program if BLITZ is offline.
 * This browser is a sync agent WHILE the authenticated DJ booth is open.
 */
(function(w,d){
"use strict";
var WORKER="https://ge-radio-sync.grandelement.workers.dev";
var STATIC="https://grandelement.com/radio/track-durations.json";
var LEGACY_STATIC="https://grandelement.com/radio/sync-playlist.json";
var busy=false,lastSignature="",lastSent=0,lastSuccess=0,lastError="",timer=0;
var lastKeys="",metaCache=null,metaAt=0,lastNowKey="",lastNowEpoch=0;
var el=function(id){return d.getElementById(id)};
function say(message,failed){
 var node=el("geBangersSyncStatus");
 if(node){node.textContent=message;node.classList.toggle("error",!!failed);}
}
function pathsEqual(a,b){return String(a||"")===String(b||"");}
function norm(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function message(e){return String(e&&e.message||e||"Unknown error");}
function stage(label,e){return new Error(label+" · "+message(e));}
async function probe(label,request){
 try{return await request()}catch(e){throw stage(label,e)}
}
async function json(response){
 var data=await response.json().catch(function(){return {}});
 if(!response.ok||!data||data.ok===false)throw new Error((data&&data.error)||("HTTP "+response.status));
 return data;
}
async function jsonFromUrl(url){
 return json(await fetch(url,{cache:"no-store"}));
}
async function measuredTracks(){
 if(metaCache&&Date.now()-metaAt<3600000)return metaCache;
 var p=null,firstError="";
 try{
  p=await probe("WEBSITE SONG CATALOG",function(){return jsonFromUrl(STATIC)});
  if(p.format!=="ge-radio-track-durations-v1"||!Array.isArray(p.tracks))throw new Error("Track catalog format invalid.");
 }catch(e){
  firstError=String(e&&e.message||e);
  p=await probe("WEBSITE BACKUP CATALOG",function(){return jsonFromUrl(LEGACY_STATIC)});
  if(p.format!=="ge-radio-clock-v1"||!Array.isArray(p.tracks))throw new Error("Measured GE music catalog unavailable: "+firstError);
 }
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
 return probe("BLITZ DJ "+path,function(){return jsonFromDj(path)})
}
async function jsonFromDj(path){
 return json(await api(path));
}
function fromQueue(q,meta,library){
 var path=String(q&&q.path||"");
 if(path&&meta.byPath[path])return meta.byPath[path];
 var key=norm(q&&q.album)+"|"+norm(q&&q.title);
 if(meta.byTitle[key])return meta.byTitle[key];
 var item=(library||[]).find(function(i){return i.kind==="song"&&norm(i.album)===norm(q.album)&&norm(i.title)===norm(q.title)});
 return item&&meta.byPath[item.path]||null
}
function musicUrl(path){
 var s=String(path||"");
 if(s.indexOf("ge-music/music/")!==0||s.indexOf("..")>=0)throw new Error("Invalid backup song path.");
 return "/"+s.split("/").map(function(part){return encodeURIComponent(part)}).join("/");
}
function audioDurationMs(url){
 return new Promise(function(resolve,reject){
  var sound=d.createElement("audio"),done=false,timer=0;
  sound.preload="metadata";
  function finish(error,val){
   if(done)return;done=true;clearTimeout(timer);
   sound.onloadedmetadata=null;sound.ondurationchange=null;sound.onerror=null;
   sound.removeAttribute("src");try{sound.load()}catch(_){}
   if(error)reject(error);else resolve(val);
  }
  function check(){
   var duration=Number(sound.duration);
   if(isFinite(duration)&&duration>1&&duration<14400)finish(null,Math.round(duration*1000));
  }
  timer=setTimeout(function(){finish(new Error("Audio metadata timed out: "+url))},17000);
  sound.onloadedmetadata=check;sound.ondurationchange=check;
  sound.onerror=function(){finish(new Error("Backup song is unavailable: "+url))};
  sound.src=url;try{sound.load()}catch(e){finish(e)}
 });
}
async function measureMissing(meta,library,paths){
 var errors=[],work=paths.slice(),index=0;
 async function worker(){
  while(index<work.length){
   var path=String(work[index++]||"");
   var song=(library||[]).find(function(x){return x&&x.kind==="song"&&x.path===path});
   if(!song){errors.push("Unknown song in saved playlist: "+path);continue}
   try{
    var url=musicUrl(path);
    var duration=await audioDurationMs(url);
    var item={path:path,url:url,title:String(song.title||song.picker_title||""),album:String(song.album||""),duration_ms:duration,kind:"song"};
    meta.byPath[path]=item;
    meta.byTitle[norm(item.album)+"|"+norm(item.title)]=item;
   }catch(e){errors.push(message(e))}
  }
 }
 await Promise.all([worker(),worker(),worker()]);
 if(errors.length)throw new Error("Could not measure "+errors.length+" Bangers song(s). "+errors[0]);
}
async function build(){
 var results=await Promise.all([getBlitz("/control/status"),getBlitz("/control/playlists"),getBlitz("/control/library"),measuredTracks()]);
 var state=results[0],p=results[1],library=results[2].items||[],meta=results[3];
 var bangers=(p.items||[]).find(function(x){return norm(x.name)==="bangers"});
 if(!bangers)throw new Error("Bangers was not found on BLITZ. Save it in PLAYLISTS first.");
 if(!state.custom_mix_enabled||String(state.custom_mix_id||"")!==String(bangers.id||""))
  throw new Error("Activate Bangers in the BLITZ DJ Booth first. Radio 1 is not currently using it.");
 var missing=(bangers.paths||[]).filter(function(path){var x=meta.byPath[String(path||"")];return !x||x.kind!=="song"});
 if(missing.length){
  say("BANGERS · MEASURING "+missing.length+" EXTRA SONG(S)",false);
  await probe("BANGERS AUDIO DURATION",function(){return measureMissing(meta,library,missing)});
 }
 var base=[],missingAfter=[];
 (bangers.paths||[]).forEach(function(path){
  var track=meta.byPath[String(path||"")];
  if(track&&track.kind==="song")base.push(track);
  else missingAfter.push(path);
 });
 if(missingAfter.length)throw new Error(missingAfter.length+" Bangers track(s) lack backup audio. Nothing changed on Radio 2.");
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
  if(!owner||!owner.ensure||!owner.getHeaders)throw new Error("Updated DJ session not available. Refresh GE DJ.");
  await owner.ensure();
  var auth=owner.getHeaders();
  if(!auth)throw new Error("Sign in to GE DJ first. No separate Radio 2 code is needed.");
  say("BANGERS · READING RADIO 1",false);
  var snapshot=await build();
  if(!opts.force&&snapshot.signature===lastSignature){say("BANGERS · SYNCED "+new Date(lastSuccess).toLocaleTimeString(),false);return {ok:true,unchanged:true}}
  say("BANGERS · SENDING TO RADIO 2",false);
  var data=await probe("CLOUDFLARE RADIO 2 PUBLISH",async function(){
   var response=await fetch(WORKER+"/v1/admin/program",{
    method:"POST",headers:Object.assign({"Content-Type":"application/json"},auth),
    body:JSON.stringify({program:snapshot.program}),cache:"no-store"
   });
   return json(response);
  });
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
  if(!owner||!owner.getHeaders||!owner.getHeaders()||d.hidden||busy)return;
  publishNow().catch(function(){})
 },2000)
}
async function diagnose(){
 var btn=el("geRadioCheckLinks"),out=el("geRadioLinkHealth");
 if(btn)btn.disabled=true;
 if(out)out.textContent="Checking BLITZ, Cloudflare Radio 2 and music catalog…";
 var tests=[
  ["BLITZ DJ",function(){return jsonFromDj("/control/status")}],
  ["CLOUDFLARE RADIO 2",function(){return jsonFromUrl(WORKER+"/v1/state")}],
  ["BANGERS SONG CATALOG",function(){return jsonFromUrl(STATIC)}],
  ["BACKUP MUSIC CATALOG",function(){return jsonFromUrl(LEGACY_STATIC)}]
 ];
 var results=await Promise.all(tests.map(async function(t){
  try{var obj=await t[1]();
   return t[0]+" · OK"+(Array.isArray(obj.tracks)?" · "+obj.tracks.length+" tracks":"");
  }catch(e){return t[0]+" · FAILED · "+message(e)}
 }));
 if(out)out.textContent=results.join("\n");
 if(btn)btn.disabled=false;
 return results;
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
 var checker=d.createElement("button");checker.type="button";checker.id="geRadioCheckLinks";checker.textContent="CHECK CONNECTIONS";
 checker.style.cssText="min-height:30px;padding:0 8px;font-size:9px;font-weight:800;border:1px solid #3a647e;border-radius:6px;color:#dff5ff;background:#102532";
 checker.onclick=function(){diagnose().catch(function(e){say("CONNECTION CHECK ERROR · "+message(e),true)})};
 banner.appendChild(checker);
 var line=d.createElement("span");line.id="geBangersSyncStatus";line.textContent="BANGERS · NOT YET SYNCED";
 line.style.cssText="font-size:9px;color:#9bc7db;white-space:normal;max-width:320px";
 banner.appendChild(line);
 var health=d.createElement("div");health.id="geRadioLinkHealth";health.style.cssText="flex-basis:100%;font-size:10px;line-height:1.4;white-space:pre-line;color:#a6cedd";
 banner.appendChild(health);
 // Changes to the saved playlist or active queue are reflected within ~25 s while the booth remains open.
 w.setInterval(function(){if(!d.hidden&&w.GERadioOwner&&w.GERadioOwner.getHeaders&&w.GERadioOwner.getHeaders())schedule()},25000);
 d.addEventListener("visibilitychange",function(){if(!d.hidden)schedule()});
 // Scheduled fast refresh after normal DJ interactions, without intercepting or replacing the BLITZ handlers.
 d.addEventListener("click",function(e){
  var b=e.target&&e.target.closest&&e.target.closest("button");
  if(b&&(/^(playlistSave|playlistUse|playlistDelete|playlistDeleteSelected|reshuffleQueue|skipNow|skipTrack|usePlaylist|savePlaylist)$/.test(b.id||"")||!!b.closest("#queue")))schedule()
 },false);
}
w.GEBangersSync={publishNow:publishNow,schedule:schedule,diagnose:diagnose,state:function(){return {lastSuccess:lastSuccess,lastError:lastError}}};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
