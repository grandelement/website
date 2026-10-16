/* GE Gate Studio — DJ-authenticated editor. Does not touch the broadcast queue. */
(function(){
"use strict";
const API="/control/gate/";
const PHOTO_BASE="https://www.grandelement.com/ge-images/img/";
const $=id=>document.getElementById(id);
const safe=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let programs=[],images={},library=[],stationPlaylists=[],steps=[],editing="",galleryIndex=0,galleryStep=-1;
let settings={fade_delay_seconds:11,fade_seconds:60,reverb_level:2.4};
const galleryFiles=["0.gif","1.gif","2.gif","3.gif","4.gif","5.gif","6.gif","7.gif","8.gif","9.gif","10.gif","10.png","12.gif","13.gif","14.gif","15.gif","16.gif","17.gif","18.gif","19.gif","20.gif","21.gif","22.gif","23.gif","24.gif","25.gif","26.gif","27.gif","28.gif","29-1.gif","29.gif","30-1.gif","30.gif","31.gif","32.jpeg","33.png","34.gif","35.gif","36.gif","36.png","37.gif","37.jpeg","38.gif","38.jpg","39.gif","40.gif","41.gif","42.gif","43.gif","44.gif","45.gif","46.gif","47.gif","slp.gif"];
const css=`
#geStudioOpen{border-color:#52a8db!important;background:#10314a!important;color:#fff!important}
#geStudio{display:none;position:fixed;inset:0;background:#02070beF;color:#e7f5ff;z-index:20000;overflow:auto;padding:max(12px,env(safe-area-inset-top)) 12px max(20px,env(safe-area-inset-bottom))}
#geStudio.show{display:block}
#geStudio .gsShell{max-width:900px;margin:auto}
#geStudio h2{font-size:18px;margin:0}
#geStudio h3{font-size:13px;margin:12px 0 6px}
#geStudio p,#geStudio small{font-size:11px;color:#a9bfd0;line-height:1.4}
#geStudio .gsCard{background:#09131b;border:1px solid #294556;border-radius:12px;padding:10px;margin:9px 0}
#geStudio .gsHead{display:flex;justify-content:space-between;align-items:center;gap:8px}
#geStudio .gsGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:7px}
#geStudio button,#geStudio select,#geStudio input{min-height:41px;background:#0c2030;color:white;border:1px solid #3c617a;border-radius:9px;padding:7px;font-size:12px;max-width:100%;width:100%}
#geStudio button.gsPrimary{border-color:#53ba91;background:#104c3d;font-weight:800}
#geStudio input[type=checkbox]{width:auto;height:20px;min-height:20px}
#geStudio button.gsDanger{border-color:#9e4a58;background:#431822}
#geStudio button.gsTiny{width:auto;min-height:28px;padding:4px 8px;font-size:10px}
#geStudio label{display:grid;gap:5px;font-size:10px;color:#c9dfee}
#geStudio .gsControls{display:flex;gap:6px;flex-wrap:wrap}
#geStudio .gsControls button{width:auto;flex:1}
#geStudio #gsRails{display:grid;gap:4px;min-height:50px}
#geStudio .gsRow{display:grid;grid-template-columns:25px 38px minmax(0,1fr) 58px 30px;gap:5px;align-items:center;min-height:47px;border:1px solid #2e566d;border-radius:8px;background:#112536;padding:4px;touch-action:none;user-select:none;cursor:grab;max-width:100%;overflow:hidden}
#geStudio .gsRow.dragging{background:#1e4c65;border-color:#8ad8ff;opacity:.85;cursor:grabbing}
#geStudio .gsRow .gsGrip{text-align:center;color:#8dd5f3;font-size:16px}
#geStudio .gsRow img{width:36px;height:36px;object-fit:cover;background:#000;border-radius:5px}
#geStudio .gsRow b{display:block;font-size:11px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
#geStudio .gsRow small{display:block;font-size:9px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}
#geStudio .gsRow button{font-size:9px;min-height:33px;padding:2px 3px}
#geStudio .gsTail{border:1px dashed #5c9fca;background:#0c293a;border-radius:8px;padding:10px;text-align:center;font-size:11px;font-weight:bold}
#geStudio .gsGallery{display:none;position:fixed;inset:0;z-index:20005;background:#01070bed;align-items:center;justify-content:center;padding:14px}
#geStudio .gsGallery.show{display:flex}
#geStudio .gsGalleryBox{border:1px solid #476982;border-radius:13px;background:#0b1720;padding:12px;width:min(500px,100%)}
#geStudio #gsImage{width:100%;height:min(49vh,320px);object-fit:contain;background:#000;border-radius:10px}
#geStudio #gsToast{position:sticky;top:0;z-index:2;font-size:12px;color:#8beaca;background:#09131b;border-radius:7px;padding:7px}
@media(max-width:480px){#geStudio .gsRow{grid-template-columns:20px 32px minmax(0,1fr) 50px 26px}#geStudio .gsRow img{width:30px;height:30px}}
`;
function toast(txt,bad=false){const el=$("gsToast");el.textContent=txt;el.style.color=bad?"#ff8ca0":"#8beaca"}
function byPath(path){return library.find(x=>String(x.path)===path)||null}
function albums(){return [...new Set(library.map(x=>String(x.album||"Other")))]}
function pickURL(step){
 let photo=step.image;
 if(!photo&&step.kind==="song")photo=images[step.path]||"";
 return photo?PHOTO_BASE+encodeURIComponent(photo):"";
}
function title(step){return step.kind==="album"?"FULL ALBUM · "+step.album:(byPath(step.path)?.title||step.path.split("/").pop()||"SONG")}
function freshStep(s){return {...s,_uid:Math.random().toString(36).slice(2)}}
function renderPrograms(){
 const select=$("gsPrograms"),prev=select.value;
 select.innerHTML='<option value="">NEW GATE PROGRAM</option>'+programs.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.name)+'</option>').join("");
 select.value=programs.some(p=>p.id===prev)?prev:"";
 const old=$("gsImport").value;
 $("gsImport").innerHTML='<option value="">IMPORT A DJ PLAYLIST</option>'+stationPlaylists.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.name)+'</option>').join("");
 $("gsImport").value=stationPlaylists.some(p=>p.id===old)?old:"";
}
function renderLibrary(){
 const as=albums();$("gsAlbum").innerHTML=as.map(a=>'<option value="'+safe(a)+'">'+safe(a)+'</option>').join("");
 filterSongs();
}
function filterSongs(){
 const query=$("gsSearch").value.trim().toLowerCase();
 const rows=library.filter(x=>!query||String(x.title+" "+x.album).toLowerCase().includes(query));
 $("gsSong").innerHTML=rows.slice(0,500).map(x=>'<option value="'+safe(x.path)+'">'+safe(x.album+" · "+x.title)+'</option>').join("");
}
function renderRails(){
 $("gsRails").innerHTML=steps.map((s,i)=>{
 const pic=pickURL(s),num=i+1;
 return '<div class="gsRow" data-uid="'+safe(s._uid)+'" data-i="'+i+'">'+
 '<span class="gsGrip">⋮⋮</span><img src="'+safe(pic)+'" alt="">'+
 '<span><b>'+num+'. '+safe(title(s))+'</b><small>'+safe(s.kind==="album"?"Single continuous album block":byPath(s.path)?.album||"Song")+'</small></span>'+
 '<button data-gs="image" data-i="'+i+'">IMAGE</button><button data-gs="remove" data-i="'+i+'">×</button></div>'
 }).join("")||'<p>Add songs or full albums, then drag their entire rows into order.</p>';
 const ending=$("gsEndMode").value||"radio";
 $("gsTail").textContent=ending==="radio"?"AFTER THE LAST TRACK → LIVE RADIO":ending==="shuffle"?"AFTER THE LAST TRACK → SHUFFLE":"AFTER THE LAST TRACK → STOP";
}
function fresh(){
 editing="";steps=[];$("gsPrograms").value="";
 $("gsName").value="";$("gsPassword").value="";$("gsPassword").placeholder="New password (at least 6 characters)";
 $("gsEndMode").value="radio";renderRails();toast("NEW PROGRAM · nothing is changed until SAVE");
}
function load(id){
 const p=programs.find(p=>p.id===id);if(!p)return fresh();
 editing=p.id;steps=(p.steps||[]).map(freshStep);
 $("gsName").value=p.name||"";$("gsPassword").value="";$("gsPassword").placeholder="Leave blank to keep existing password";
 $("gsEndMode").value=p.end_mode||"radio";renderRails();toast("EDITING "+p.name);
}
async function req(url,opts){const r=await api(url,opts),v=await r.json().catch(()=>({}));if(!r.ok||v.ok===false)throw Error(v.error||"Request failed");return v}
async function refresh(){
 const [g,l,p]=await Promise.all([
  req(API+"studio"),req("/control/library"),req("/control/playlists")
 ]);
 programs=g.programs||[];images=g.image_defaults||{};settings=g.settings||settings;
 library=(l.items||[]).filter(x=>x.kind==="song");stationPlaylists=p.items||[];
 $("gsDelay").value=settings.fade_delay_seconds;$("gsFade").value=settings.fade_seconds;$("gsReverb").value=settings.reverb_level;
 renderPrograms();renderLibrary();if(editing&&programs.some(p=>p.id===editing))load(editing);else fresh();
}
async function saveSettings(){
 const payload={fade_delay_seconds:Number($("gsDelay").value),fade_seconds:Number($("gsFade").value),reverb_level:Number($("gsReverb").value)};
 const v=await req(API+"settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
 settings=v.settings;toast("GATE TIMING SAVED · applies to new listener sessions");
}
async function saveProgram(){
 const name=$("gsName").value.trim(),password=$("gsPassword").value,end_mode=$("gsEndMode").value;
 if(!name||!steps.length){toast("Name the program and add music first",true);return}
 const payload={id:editing,name,password,end_mode,steps:steps.map(({_uid,...rest})=>rest)};
 const v=await req(API+"program/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
 programs=v.programs;images=v.image_defaults;editing=v.saved_id||editing;
 renderPrograms();$("gsPrograms").value=editing;load(editing);toast("SAVED · The Gate password will launch this exact order");
}
async function delProgram(){
 if(!editing)return;
 if(!confirm("Delete this Gate program and disable its password?"))return;
 const v=await req(API+"program/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:editing})});
 programs=v.programs;renderPrograms();fresh();toast("PROGRAM DELETED");
}
function galleryOpen(i){
 galleryStep=i;const current=pickURL(steps[i]||{});
 const basename=current.split("/").pop()||"";
 galleryIndex=Math.max(0,galleryFiles.indexOf(decodeURIComponent(basename)));
 $("gsGallery").classList.add("show");galleryPaint();
}
function galleryPaint(){
 const name=galleryFiles[galleryIndex];$("gsImage").src=PHOTO_BASE+encodeURIComponent(name);
 $("gsImageCount").textContent=(galleryIndex+1)+" / "+galleryFiles.length+" · "+name;
 $("gsDefaultWrap").hidden=steps[galleryStep]?.kind!=="song";
}
async function galleryChoose(){
 const s=steps[galleryStep];if(!s)return;
 s.image=galleryFiles[galleryIndex];
 if($("gsMakeDefault").checked&&s.kind==="song"){
   const v=await req(API+"image-default",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:s.path,image:s.image})});
   images=v.image_defaults||images;
 }
 $("gsGallery").classList.remove("show");$("gsMakeDefault").checked=false;renderRails();toast("PICTURE SELECTED · save program to keep it");
}
function init(){
 const button=document.createElement("button");button.id="geStudioOpen";button.type="button";button.textContent="GATE";button.title="Gate timing, private playlists, passwords and pictures";
 const playlist=document.getElementById("playlistOpen");
 if(playlist&&playlist.parentElement)playlist.insertAdjacentElement("afterend",button);
 else{button.style.cssText="position:fixed;right:8px;top:64px;z-index:100";document.body.append(button)}
 const style=document.createElement("style");style.textContent=css;document.head.appendChild(style);
 const modal=document.createElement("div");modal.id="geStudio";modal.setAttribute("aria-label","GE Gate Back Room");
 modal.innerHTML=`
 <div class="gsShell">
 <div class="gsHead"><h2>GATE · BACK ROOM</h2><button class="gsTiny" id="gsClose">CLOSE</button></div>
 <div id="gsToast">Gate Studio</div>
 <section class="gsCard"><h3>GATE AUDIO · INVISIBLE LISTENER FADERS</h3>
 <p>The Gate starts after the Blue Sun reaches its full entrance. The listener's private dry volume decreases as reverb increases. The public broadcast is not touched.</p>
 <div class="gsGrid">
 <label>Delay after centered Gate (seconds)<input id="gsDelay" type="number" min="0" max="120" value="11"></label>
 <label>Fade duration (seconds)<input id="gsFade" type="number" min="10" max="180" value="60"></label>
 <label>Maximum reverb strength<input id="gsReverb" type="number" min="0" max="4" step=".1" value="2.4"></label>
 </div><button class="gsPrimary" id="gsSaveTiming">SAVE GATE AUDIO</button></section>
 <section class="gsCard"><h3>PRIVATE PROGRAMS · ONE PASSWORD PER LISTENING EXPERIENCE</h3>
 <div class="gsGrid"><label>Existing program<select id="gsPrograms"></select></label>
 <label>Import from DJ playlists<select id="gsImport"></select></label></div>
 <div class="gsGrid"><label>Program name<input id="gsName" placeholder="Name for this visitor"></label>
 <label>Visitor password<input type="password" id="gsPassword" autocomplete="new-password" placeholder="6+ characters"></label></div>
 <div class="gsControls"><button id="gsNew">NEW</button><button class="gsPrimary" id="gsSave">SAVE PROGRAM</button><button class="gsDanger" id="gsDelete">DELETE</button></div>
 </section>
 <section class="gsCard"><h3>ADD MUSIC</h3>
 <div class="gsGrid"><label>Album<select id="gsAlbum"></select></label><label>Find a song<input id="gsSearch" placeholder="Search song or album"></label></div>
 <div class="gsControls"><button id="gsAddAlbum">ADD FULL ALBUM</button></div>
 <label>Individual song<select id="gsSong"></select></label><button id="gsAddSong">ADD SELECTED SONG</button>
 </section>
 <section class="gsCard"><h3>PLAY ORDER · DRAG ANY ROW UP OR DOWN</h3>
 <p>Every complete row is a grab surface. Items remain inside these rails; other rows shift to make room. FULL ALBUM stays together as one movable block.</p>
 <div id="gsRails"></div>
 <label>What happens after the last song?<select id="gsEndMode"><option value="radio">LIVE RADIO · continue into BLITZ</option><option value="shuffle">SHUFFLE · keep this program playing</option><option value="stop">STOP · finish quietly</option></select></label>
 <div class="gsTail" id="gsTail"></div>
 </section>
 <div class="gsGallery" id="gsGallery"><div class="gsGalleryBox">
 <div class="gsHead"><b>SONG BACKGROUND</b><button class="gsTiny" id="gsImageClose">CLOSE</button></div>
 <img id="gsImage" alt="Selected background preview"><p id="gsImageCount"></p>
 <div class="gsControls"><button id="gsImagePrev">PREVIOUS</button><button id="gsImageNext">NEXT</button></div>
 <label id="gsDefaultWrap"><input id="gsMakeDefault" type="checkbox">Use this as the default image for this song in future programs</label>
 <button class="gsPrimary" id="gsImageUse">USE THIS IMAGE</button>
 </div></div>
 </div>`;
 document.body.appendChild(modal);
 button.onclick=()=>{modal.classList.add("show");refresh().catch(e=>toast("GATE COULD NOT LOAD · "+e.message,true))};
 $("gsClose").onclick=()=>modal.classList.remove("show");
 $("gsSaveTiming").onclick=()=>saveSettings().catch(e=>toast(e.message,true));
 $("gsPrograms").onchange=e=>load(e.target.value);
 $("gsNew").onclick=fresh;
 $("gsSave").onclick=()=>saveProgram().catch(e=>toast(e.message,true));
 $("gsDelete").onclick=()=>delProgram().catch(e=>toast(e.message,true));
 $("gsImport").onchange=e=>{
  const p=stationPlaylists.find(x=>String(x.id)===e.target.value);
  if(!p)return;
  steps=(p.paths||[]).filter(path=>byPath(String(path))).map(path=>freshStep({kind:"song",path:String(path),image:""}));
  $("gsName").value=p.name+" · Gate";renderRails();toast("IMPORTED ORDER · set a password and SAVE");
 };
 $("gsAlbum").onchange=()=>{$("gsSearch").value=$("gsAlbum").value;filterSongs()};
 $("gsSearch").oninput=filterSongs;
 $("gsAddAlbum").onclick=()=>{const name=$("gsAlbum").value;if(!name)return;steps.push(freshStep({kind:"album",album:name,image:""}));renderRails()};
 $("gsAddSong").onclick=()=>{const path=$("gsSong").value;if(!path)return;steps.push(freshStep({kind:"song",path,image:""}));renderRails()};
 $("gsEndMode").onchange=renderRails;
 $("gsRails").onclick=e=>{
  const btn=e.target.closest("button[data-gs]");if(!btn)return;
  const i=Number(btn.dataset.i);
  if(btn.dataset.gs==="remove"){steps.splice(i,1);renderRails()}
  if(btn.dataset.gs==="image")galleryOpen(i);
 };
 $("gsImageClose").onclick=()=>$("gsGallery").classList.remove("show");
 $("gsImagePrev").onclick=()=>{galleryIndex=(galleryIndex-1+galleryFiles.length)%galleryFiles.length;galleryPaint()};
 $("gsImageNext").onclick=()=>{galleryIndex=(galleryIndex+1)%galleryFiles.length;galleryPaint()};
 $("gsImageUse").onclick=()=>galleryChoose().catch(e=>toast(e.message,true));
 let dragging=null;
 $("gsRails").addEventListener("pointerdown",e=>{
  if(e.target.closest("button"))return;
  const row=e.target.closest(".gsRow");if(!row||e.button>0)return;
  e.preventDefault();dragging=row;dragging.classList.add("dragging");
 });
 window.addEventListener("pointermove",e=>{
  if(!dragging)return;e.preventDefault();
  const container=$("gsRails");
  const others=[...container.querySelectorAll(".gsRow")].filter(x=>x!==dragging);
  const over=others.find(x=>{const r=x.getBoundingClientRect();return e.clientY>=r.top&&e.clientY<=r.bottom});
  if(over){const middle=over.getBoundingClientRect().top+over.offsetHeight/2;container.insertBefore(dragging,e.clientY<middle?over:over.nextSibling)}
 },{passive:false});
 function finishDrag(){
  if(!dragging)return;
  dragging.classList.remove("dragging");
  const byUid=new Map(steps.map(x=>[x._uid,x]));
  steps=[...$("gsRails").querySelectorAll(".gsRow")].map(x=>byUid.get(x.dataset.uid)).filter(Boolean);
  dragging=null;renderRails();
 }
 window.addEventListener("pointerup",finishDrag);
 window.addEventListener("pointercancel",finishDrag);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
