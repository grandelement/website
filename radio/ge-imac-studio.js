/* GE DJ iMac Studio layout and live LINE controls, website-hosted (no BLITZ build).
 * An iMac's Ableton/Focusrite master must be exposed to the BROWSER AS AN AUDIO INPUT.
 * Selecting an output-only Focusrite device does not create a loopback automatically.
 * Song drafts remain private in the existing GE Google Drive folder.
 */
(function(w,d){
"use strict";
var DRIVE_DRAFTS="https://drive.google.com/drive/folders/1bwIYEj_WoUd0QWS-IGxrBw2uUnWWJKKe";
var DRIVE_MUSIC="https://drive.google.com/drive/folders/1RP9PLXSUoI9rSr7lYMKwg2d1fFtNN1Ml";
function $(id){return d.getElementById(id)}
function macLocal(){return typeof GE_PHYSICAL_KIND!=="undefined"&&GE_PHYSICAL_KIND==="mac"&&typeof GE_BOARD_ROLE!=="undefined"&&GE_BOARD_ROLE==="home"}
function hostList(){
 var rows=(typeof status!=="undefined"&&status&&status.dj_boards)||[];
 return rows.filter(function(x){return x&&x.online&&x.role==="home"});
}
function macHost(){
 return hostList().filter(function(x){return /imac|mac/i.test(String(x.label||"")+" "+String(x.device_name||"")+" "+String(x.device_kind||""))})
  .sort(function(a,b){return Number(b.last_seen||0)-Number(a.last_seen||0)})[0]||null;
}
function style(){
 if($("geImacStyle"))return;
 var el=d.createElement("style");el.id="geImacStyle";el.textContent=
  "#mixImacStudio{border-color:#42718d}" +
  "#mixImacStudio .mixBtns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}" +
  "#mixImacStudio .imacStudioNote{font-size:8px;color:#a0bdce;line-height:1.35;white-space:normal}" +
  "#mixImacStudio .imacLive{background:#61202b;border-color:#f97086;color:#fff}" +
  "#geImacSetup{position:fixed;inset:0;z-index:240;background:rgba(0,0,0,.9);display:none;overflow:auto;padding:20px 12px;box-sizing:border-box;color:#eaf3ff}" +
  "#geImacSetup.show{display:block}" +
  "#geImacSetup .panel{max-width:610px;margin:0 auto;border:1px solid #42718d;border-radius:12px;background:#08131d;padding:14px}" +
  "#geImacSetup h2{font-size:21px;margin:0 0 8px}" +
  "#geImacSetup .help{font-size:13px;line-height:1.5;color:#b9cbdb;margin:8px 0}" +
  "#geImacSetup .line{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0}" +
  "#geImacSetup button{border:1px solid #4c7595;border-radius:8px;min-height:46px;padding:6px;background:#12293b;color:#f5faff;font-size:13px;font-weight:bold}" +
  "#geImacSetup button:disabled{opacity:.48}" +
  "#geImacSetup .close{float:right;min-height:36px}" +
  "#geImacSetup .danger{border-color:#cb5962;background:#512029}" +
  "#geImacSetup .notice{border:1px solid #36556c;border-radius:8px;padding:9px;font-size:12px;line-height:1.5;white-space:normal}" +
  "#geImacSetup a{color:#93d5ff}";
 d.head.appendChild(el)
}
function openDrive(url,what){
 var box=$("geImacUploadNote");if(box)box.textContent=what+" · Opening your private Google Drive folder. Drag the audio file into that folder or choose New > File upload. The upload is complete only when Google Drive confirms it.";
 var tab=w.open(url,"_blank","noopener");
 if(!tab&&box)box.textContent=what+" · Browser blocked the new tab. Open this folder manually: "+url;
}
function openInputs(){
 if(!macLocal()){var note=$("geImacSetupStatus");if(note)note.textContent="Connect the Focusrite audio INPUT from the DJ Booth on the iMac itself.";return}
 if(typeof openComputerInputControlsV125==="function")openComputerInputControlsV125(1);
 else {var note=$("geImacSetupStatus");if(note)note.textContent="Computer input controls are not available in this DJ build."}
}
function openSetup(){
 var m=$("geImacSetup");if(!m)return;
 m.classList.add("show");update();
}
function closeSetup(){var m=$("geImacSetup");if(m)m.classList.remove("show")}
function update(){
 var strip=$("mixImacStudio"),host=macHost(),local=macLocal(),check=$("geAddImac");
 var connected=local?(typeof hasAnyComputerSourceV125==="function"&&hasAnyComputerSourceV125()):!!(host&&host.line_connected);
 var air=local?(typeof lineAirOn!=="undefined"&&!!lineAirOn):!!(host&&host.line_air);
 if(strip){
  var wanted=local||!!host||!!(check&&check.checked);
  var hidden=strip.classList.contains("channelHidden");
  strip.classList.toggle("channelHidden",!wanted);
  var source=local?(typeof localLineSourceName==="function"?String(localLineSourceName()||""):""):String(host&&host.line_source||"");
  var level=(typeof settings!=="undefined"&&settings&&settings.line)?Number(settings.line.level||100):100;
  var shared=(typeof status!=="undefined"&&status&&status.dj_controls)||{};
  if(shared.line_level!=null)level=Number(shared.line_level);
  level=Math.max(0,Math.min(150,level));
  var peak=local?(typeof lineInputPct!=="undefined"?Number(lineInputPct||0):0):Number(host&&host.line_peak||0);
  if($("imacStudioSource"))$("imacStudioSource").textContent=connected?(source||"FOCUSRITE INPUT CONNECTED"):"ABLETON / FOCUSRITE · SELECT AUDIO INPUT";
  if($("imacStudioNote"))$("imacStudioNote").textContent=!host&&!local?"iMAC OFFLINE · OPEN DJ ON iMAC":!connected?"SELECT FOCUSRITE INPUT OR ABLETON RETURN":hostList().length>1&&!local?"MULTIPLE HOME SOURCES · CONTROL AT iMAC":air?"iMAC LIVE ON RADIO 1":"iMAC READY · OFF AIR";
  var b=$("imacStudioAir");if(b){b.disabled=!connected||(hostList().length>1&&!local);b.textContent=air?"TAKE OFF AIR":"PUT ON AIR";b.classList.toggle("imacLive",air)}
  var monitor=$("imacStudioMonitor");if(monitor){monitor.hidden=!local;monitor.disabled=!connected;monitor.textContent=typeof lineCueOn!=="undefined"&&lineCueOn?"STOP MONITOR":"MONITOR"}
  if($("imacStudioLevel")&&d.activeElement!==$("imacStudioLevel"))$("imacStudioLevel").value=String(level);
  if($("imacStudioRead"))$("imacStudioRead").textContent=Math.round(level)+"%";
  if(typeof setMeterLevel==="function")setMeterLevel("imacStudioMeter",connected?peak:0);
  if(check){var choose=d.querySelector('[data-add-mixer-channel="imac"]');if(choose){choose.classList.toggle("added",!!check.checked);choose.setAttribute("aria-pressed",check.checked?"true":"false")}}
  if(hidden===wanted&&typeof refreshMixerLayout==="function")refreshMixerLayout()
 }
 var note=$("geImacSetupStatus");if(note)note.textContent=!local&&!host?"iMac not connected. Open this DJ page on your iMac.":!connected?"iMac identified. Select the actual recording/return input carrying Ableton audio.":air?"iMac audio is ON AIR on Radio 1.":"iMac is OFF AIR. Check the input meter before broadcasting.";
 var live=$("geImacSetupAir");if(live){live.textContent=air?"TAKE OFF AIR":"PUT iMAC ON AIR";live.disabled=!connected||(hostList().length>1&&!local)}
}
function toggleAir(){
 if(macLocal()){
  if(typeof toggleLineOnAir==="function")toggleLineOnAir().then(update).catch(function(e){w.alert(e.message||e)});
  return
 }
 var host=macHost();if(!host||!host.line_connected||hostList().length!==1)return;
 if(typeof pushSharedDjControls==="function")pushSharedDjControls({line_air:!host.line_air},true);
 setTimeout(update,1200)
}
function init(){
 style();
 var picker=$("mixerChannelPicker"),grid=d.querySelector("#mixerSheet .mixerGrid"),master=grid&&grid.querySelector('[data-channel-strip="master"]');
 if(picker&&!$("geAddImac")){
  var pref=d.createElement("input");pref.id="geAddImac";pref.type="checkbox";pref.hidden=true;pref.setAttribute("data-device-channel","imac");
  try{var saved=JSON.parse(localStorage.getItem("geDjVisibleChannelsV4")||"{}");pref.checked=!!saved.imac}catch(_){}
  picker.appendChild(pref);
 }
 if(picker&&!picker.querySelector('[data-add-mixer-channel="imac"]')){
  var btn=d.createElement("button");btn.type="button";btn.textContent="iMAC STUDIO";btn.setAttribute("data-add-mixer-channel","imac");
  var choices=picker.querySelector(".mixerAddChoices");if(choices)choices.appendChild(btn)
 }
 if(grid&&master&&!$("mixImacStudio")){
  var strip=d.createElement("div");strip.className="mixStrip channelHidden";strip.id="mixImacStudio";strip.setAttribute("data-channel-strip","imac");
  strip.innerHTML='<h3><i class="stripStatusDot" id="imacStudioDot"></i>iMAC STUDIO</h3>'+
    '<button type="button" class="mixSourceLabel" id="imacStudioSource">FOCUSRITE / ABLETON</button>'+
    '<div class="hmeter"><div class="hmeterFill" id="imacStudioMeter"></div></div>'+
    '<input class="vf" id="imacStudioLevel" type="range" min="0" max="150" value="100">'+
    '<div class="mixRead" id="imacStudioRead">100%</div>'+
    '<div class="mixBtns"><button type="button" id="imacStudioInputs">INPUTS</button><button type="button" id="imacStudioMonitor">MONITOR</button></div>'+
    '<button type="button" class="trackStageBtn" id="imacStudioAir" disabled>OFF AIR</button>'+
    '<small class="imacStudioNote" id="imacStudioNote">OPEN DJ ON iMAC</small>';
  grid.insertBefore(strip,master)
 }
 var dialog=d.createElement("div");dialog.id="geImacSetup";dialog.setAttribute("role","dialog");dialog.setAttribute("aria-label","iMac Studio setup");
 dialog.innerHTML='<div class="panel"><button type="button" class="close" id="geImacClose">CLOSE</button>'+
  '<h2>iMAC · ABLETON STUDIO</h2>'+
  '<div class="help">2007 iMac · Ableton Live · Focusrite Saffire Pro 40 · Axiom Pro MIDI. Choose iMAC in the device screen to use the computer layout and studio controls.</div>'+
  '<div class="notice" id="geImacSetupStatus">Checking iMac Studio connection…</div>'+
  '<div class="line"><button type="button" id="geImacInputs">SELECT FOCUSRITE INPUT</button><button type="button" id="geImacMixer">OPEN DJ MIXER</button>'+
  '<button type="button" id="geImacSetupAir" disabled>PUT iMAC ON AIR</button><button type="button" id="geImacStudioApp">OPEN GE STUDIO</button></div>'+
  '<div class="help">Ableton Master → a Focusrite input or configured loopback → DJ iMAC STUDIO meter → ON AIR. Focusrite output alone is not a browser input. Keep monitoring OFF until the return is routed safely to avoid feedback. Axiom Pro MIDI is controlled inside Ableton.</div>'+
  '<h2>SONG FILES</h2><div class="line">'+
  '<button type="button" id="geImacDraftUpload">UPLOAD DRAFT</button><button type="button" id="geImacFinalUpload">UPLOAD FINAL</button>'+
  '<button type="button" id="geImacDrafts">SONG DRAFTS</button><button type="button" id="geImacFiles">DJ FILES</button></div>'+
  '<div class="notice" id="geImacUploadNote">UPLOAD DRAFT opens Grand Element Drive → 00 Music → ‘NEW SONGS. UPLOAD FINAL opens 00 Music so you can select the destination. A file is not uploaded merely by clicking these buttons.</div></div>';
 d.body.appendChild(dialog);
 if($("geImacClose"))$("geImacClose").onclick=closeSetup;
 if($("geImacInputs"))$("geImacInputs").onclick=function(){closeSetup();openInputs()};
 if($("geImacMixer"))$("geImacMixer").onclick=function(){closeSetup();if(typeof openSheet==="function")openSheet("mixerSheet");else $("mixerSheet").classList.add("show")};
 if($("geImacSetupAir"))$("geImacSetupAir").onclick=toggleAir;
 if($("geImacStudioApp"))$("geImacStudioApp").onclick=function(){w.open("https://grandelement.com/studio/","_blank","noopener")};
 if($("geImacDraftUpload"))$("geImacDraftUpload").onclick=function(){openDrive(DRIVE_DRAFTS,"DRAFT UPLOAD")};
 if($("geImacFinalUpload"))$("geImacFinalUpload").onclick=function(){openDrive(DRIVE_MUSIC,"FINAL UPLOAD")};
 if($("geImacDrafts"))$("geImacDrafts").onclick=function(){openDrive(DRIVE_DRAFTS,"SONG DRAFTS")};
 if($("geImacFiles"))$("geImacFiles").onclick=function(){closeSetup();if(typeof openDjFilesModal==="function")openDjFilesModal()};
 if($("imacStudioSource"))$("imacStudioSource").onclick=openInputs;
 if($("imacStudioInputs"))$("imacStudioInputs").onclick=openInputs;
 if($("imacStudioAir"))$("imacStudioAir").onclick=toggleAir;
 if($("imacStudioMonitor"))$("imacStudioMonitor").onclick=function(){
  if(macLocal()&&typeof toggleCue==="function")toggleCue("line").then(update).catch(function(e){w.alert(e.message||e)})
 };
 if($("imacStudioLevel")){
  $("imacStudioLevel").oninput=function(){if($("imacStudioRead"))$("imacStudioRead").textContent=Math.round(Number(this.value))+"%"};
  $("imacStudioLevel").onchange=function(){
   var n=Math.max(0,Math.min(150,Number(this.value)||0));
   if(macLocal()&&typeof settings!=="undefined"){settings.line.level=n;if(typeof applyChannel==="function")applyChannel("line");if(typeof saveSettings==="function")saveSettings()}
   if(typeof pushSharedDjControls==="function")pushSharedDjControls({line_level:n},true);update()
  }
 }
 var files=$("djFilesOpen");if(files&&!$("geSongDraftsButton")){
  var draftButton=d.createElement("button");draftButton.id="geSongDraftsButton";draftButton.className=files.className;draftButton.type="button";draftButton.textContent="SONG DRAFTS";
  draftButton.onclick=function(){openDrive(DRIVE_DRAFTS,"SONG DRAFTS")};
  files.parentNode.insertBefore(draftButton,files.nextSibling)
 }
 update();setInterval(update,1200)
}
w.GEImacStudio={openSetup:openSetup,openInputs:openInputs,update:update};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
