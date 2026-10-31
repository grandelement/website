/* GE iMac compact workstation: ES5 for Firefox on OS X El Capitan.
   Presentation only. BLITZ broadcasting and rclone upload logic remain unchanged. */
(function(w,d){
"use strict";
function by(id){return d.getElementById(id)}
function node(tag,cls,txt){var n=d.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n}
function move(n,to){if(n&&to)to.appendChild(n)}
function help(parent,title,body){
 var details=node("details","geHelp"),s=node("summary",null,"? HELP · "+title),p=node("p",null,body);
 details.appendChild(s);details.appendChild(p);parent.appendChild(details);
}
function diagnostics(parent,title,ids){
 var details=node("details","geHelp geDiag"),s=node("summary",null,"DIAGNOSTICS · "+title),pre=node("pre");
 details.appendChild(s);details.appendChild(pre);
 var b=node("button",null,"REFRESH DIAGNOSTICS");b.type="button";
 function refresh(){
  var lines=["GE STUDIOS · "+title.toUpperCase(),"Time: "+new Date().toLocaleString()];
  for(var i=0;i<ids.length;i++){var el=by(ids[i]);if(el)lines.push(ids[i]+": "+String(el.textContent||el.value||"").replace(/\s+/g," ").slice(0,220))}
  lines.push("Passwords and authorization tokens are excluded.");
  pre.textContent=lines.join("\n");
 }
 b.onclick=refresh;details.appendChild(b);parent.appendChild(details);refresh();
}
function init(){
 var main=d.getElementsByTagName("main")[0],header=d.querySelector(".geStudioHeader"),radio=by("studioRadio"),drive=by("studioDrive"),diagnostic=by("geDiagnostics");
 if(!main||!header||!radio||!drive)return;
 var top=node("nav","geDeviceNav");
 top.setAttribute("aria-label","GE DJ device navigation");
 var links=[["iMAC · THIS DEVICE","/dj/imac.html"],["DJ BOOTH / DEVICES","/radio/ge-dj.html"],["STUDIO","/studio/"],["BLITZ FALLBACK","https://radio.grandelement.blitz.cloud/dj/"]];
 for(var i=0;i<links.length;i++){var a=node("a",i===0?"active":"",links[i][0]);a.href=links[i][1];top.appendChild(a)}
 main.insertBefore(top,header);header.getElementsByTagName("p")[0].style.display="none";
 /* Persistent compact upload status immediately below the device row. */
 var uploadStrip=node("div","geUploadStrip");uploadStrip.id="geUploadStrip";
 var stripTitle=node("span","geUploadStripTitle","UPLOAD · READY");
 var stripStatus=node("span","geUploadStripStatus","No transfer in progress");
 uploadStrip.appendChild(stripTitle);uploadStrip.appendChild(stripStatus);
 var clearShown=node("button","geClearUploadDisplay","CLEAR OLD STATUS");clearShown.type="button";
 clearShown.title="Clear the old upload message only. Does not cancel a transfer or remove a Drive file.";
 clearShown.onclick=function(){
  if(w.GEImacUploads&&w.GEImacUploads.clearFinishedDisplay&&w.GEImacUploads.clearFinishedDisplay()){
   stripTitle.textContent="UPLOAD · READY";stripStatus.textContent="No upload in this browser";
   uploadStrip.className="geUploadStrip";
  }
 };
 uploadStrip.appendChild(clearShown);
 main.insertBefore(uploadStrip,header);
 var existingMonitor=by("geUploadMonitor");
 /* Keep progress outside the hidden Google tab and any collapsed file panels. */
 if(existingMonitor){uploadStrip.appendChild(existingMonitor);existingMonitor.className+=" geDockedMonitor";}
 function syncUploadStrip(){
  if(!existingMonitor)return;
  var showing=existingMonitor.style.display==="block";
  var headline=by("geUploadMonitorHeadline"),detail=by("geUploadMonitorDetail");
  stripTitle.textContent=showing&&headline?headline.textContent:"UPLOAD · READY";
  stripStatus.textContent=showing&&detail?detail.textContent:"No transfer in progress";
  uploadStrip.className=showing?"geUploadStrip active":"geUploadStrip";
  if(nav&&google&&google.style.display!=="none")fitGoogleToWindow();
 }
 syncUploadStrip();
 if(w.setInterval)w.setInterval(syncUploadStrip,1200);
 var content=node("div","geWorkstation"),studio=node("section","geTab"),mixer=node("section","geTab"),effects=node("section","geTab"),google=node("section","geTab");
 studio.id="geTabStudio";mixer.id="geTabMixer";effects.id="geTabEffects";google.id="geTabGoogle";
 main.insertBefore(content,radio);
 content.appendChild(studio);content.appendChild(mixer);content.appendChild(effects);content.appendChild(google);
 move(radio,studio);move(drive,google);
 var mx=node("div","panel"),fx=node("div","panel");
 mx.appendChild(node("h2",null,"MIXER · IMAC"));fx.appendChild(node("h2",null,"EFFECTS · IMAC"));
 mx.appendChild(node("p",null,"Stereo input and gain controls for the iMac. Broadcasting stays OFF until you explicitly go live."));
 var meters=radio.querySelector(".geMeters");move(meters,mx);
 var gain=by("liveGain"),gainLabel=d.querySelector('label[for="liveGain"]'),gainRead=by("liveGainRead");
 move(gainLabel,mx);move(gain,mx);move(gainRead,mx);
 var mixlink=node("a","link","OPEN FULL DJ MIXER");mixlink.href="/radio/ge-dj.html";mx.appendChild(mixlink);
 help(mx,"Mixer","Connect Soundflower (2ch) in Studio first. This page shows the iMac stereo meters and live input gain. The full DJ Booth contains the expanded mixer.");
 diagnostics(mx,"Mixer",["meterStatus","leftDb","rightDb","liveGainRead","channelReadout"]);
 fx.appendChild(node("p",null,"Advanced DJ effects and stem controls are in the full GE DJ Booth. No effects are inserted into the live iMac audio path from this tab."));
 var effectsControls=by("radioControls");
 if(effectsControls){move(effectsControls,fx);fx.getElementsByTagName("p")[0].textContent="BLITZ music transitions. Fade, skip and stop controls activate after connecting Radio 1. Live studio audio remains protected.";}
 var fxlink=node("a","link","ADVANCED DJ EFFECTS");fxlink.href="/radio/ge-dj.html";fx.appendChild(fxlink);
 help(fx,"Effects","Use the full GE DJ Booth for filters, EQ, stems and deck effects. This classic iMac console keeps the existing Soundflower audio route unchanged.");
 diagnostics(fx,"Effects",["connection","liveStatus","meterStatus"]);
 mixer.appendChild(mx);effects.appendChild(fx);
 help(radio,"Studio","Choose Soundflower (2ch), press CONNECT STUDIO AUDIO, verify left and right meters, then connect Radio 1 only when needed. GO LIVE is always a separate deliberate action.");
 diagnostics(radio,"Studio",["connection","liveState","liveReadiness","liveStatus","meterStatus","leftDb","rightDb","trustedStatus"]);

  /* GE GOOGLE: usable controls first; no redundant introductory paragraphs. */
  var driveTitle=drive.querySelector("h2");
  if(driveTitle)driveTitle.textContent="GOOGLE DRIVE";
  var driveTop=node("div","geDriveTop"),driveQuick=node("div","geDriveQuickLinks");
  if(driveTitle)move(driveTitle,driveTop);
  var sourceActions=drive.querySelector(".geMainActions");
  if(sourceActions){
    var sourceLinks=sourceActions.querySelectorAll("a");
    for(var qi=0;qi<sourceLinks.length;qi++){
      var link=sourceLinks[qi];
      if(/COMPLETE GOOGLE DRIVE|EMPTY DRIVE TRASH|RELEASE STUDIO/i.test(link.textContent||""))move(link,driveQuick);
    }
  }
  move(by("driveQuotaStatus"),driveTop);
  driveTop.appendChild(driveQuick);
  drive.insertBefore(driveTop,drive.firstChild);
  /* Keep only actionable labels and live statuses on the working surface. */
  var paragraphs=drive.querySelectorAll("p");
  for(var pi=paragraphs.length-1;pi>=0;pi--){
    var para=paragraphs[pi];
    if(para.id==="libraryHelp")para.parentNode.removeChild(para);
    else if(!para.id&&/EMPTY DRIVE TRASH opens|MANUAL UPLOAD:|For a whole session including samples:/i.test(para.textContent||""))
      para.parentNode.removeChild(para);
  }
  /* Destination buttons are always visible, independent of the folder browser. */
  var draftCard=by("draftUploadCard"),finalCard=by("finalUploadCard"),radioCard=by("radioUploadCard"),sessionCard=by("sessionUploadCard");
  var addTitle=null,oldNodes=Array.prototype.slice.call(drive.children);
  for(var di=0;di<oldNodes.length;di++)
    if(oldNodes[di].tagName==="H3"&&/ADD FILES/i.test(oldNodes[di].textContent||"")){addTitle=oldNodes[di];break}
  var uploadSection=node("div","geUploadSection");
  var destinations=node("div","geUploadDestinations");
  destinations.appendChild(node("strong","geUploadSectionLabel","ADD FILES"));
  var targets=[
    ["draft","UPLOAD TO DRAFTS","listDrafts"],
    ["final","UPLOAD TO FINALS","listFinals"],
    ["radio","UPLOAD RADIO","listRadio"],
    ["session","UPLOAD SESSION","listSessions"]
  ];
  for(var ui=0;ui<targets.length;ui++)(function(info){
    var button=node("button","geUploadTarget",info[1]);button.type="button";
    button.setAttribute("data-upload-kind",info[0]);
    var selectedTab=by(info[2]);
    var active=!!(selectedTab&&selectedTab.className.indexOf("geSelectedTab")>=0);
    if(active)button.className="geUploadTarget geSelectedTarget";
    button.setAttribute("aria-pressed",active?"true":"false");
    button.onclick=function(){var tab=by(info[2]);if(tab)tab.click()};
    destinations.appendChild(button);
  })(targets[ui]);
  uploadSection.appendChild(destinations);
  move(draftCard,uploadSection);move(finalCard,uploadSection);move(radioCard,uploadSection);move(sessionCard,uploadSection);move(by("geUploadNameQuick"),uploadSection);
  if(addTitle)addTitle.parentNode.removeChild(addTitle);
  drive.insertBefore(uploadSection,driveTop.nextSibling);
  /* Folder tabs + REFRESH occupy the same single row. */
  var library=by("musicLibraryPanel"),folderTabs=library&&library.querySelector(".geFolderTabs");
  var driveRefresh=node("button","geRefreshDriveFiles","REFRESH");driveRefresh.type="button";
  driveRefresh.title="Refresh the current Drive file list";
  driveRefresh.onclick=function(){if(w.GEImacUploads&&w.GEImacUploads.refreshFiles)w.GEImacUploads.refreshFiles()};
  if(folderTabs)folderTabs.appendChild(driveRefresh);
  if(library)drive.insertBefore(library,uploadSection.nextSibling);
  /* Top progress monitor is already persistent. Hide only the duplicate bottom bar. */
  var secondaryBar=by("uploadBar");
  if(secondaryBar&&secondaryBar.parentNode)secondaryBar.parentNode.className+=" geSecondaryUploadBar";
  /* Google settings are below the working file list. */
  var extra=node("details","geDriveExtras");
  extra.appendChild(node("summary",null,"GOOGLE SETTINGS · TROUBLESHOOTING"));
  drive.appendChild(extra);
  var leftovers=Array.prototype.slice.call(drive.children);
  for(var ei=0;ei<leftovers.length;ei++){
    var child=leftovers[ei];
    if(child!==extra&&child!==driveTop&&child!==uploadSection&&child!==library&&child.className==="geMainActions")
      move(child,extra);
  }
  /* FIX GOOGLE DRIVE remains available but belongs AFTER Google settings. */
  var studioConnection=node("div","geStudioDriveConnection");
  var repairRow=node("div","geGooglePrimaryActions");
  move(by("reconnectDriveAuth"),repairRow);studioConnection.appendChild(repairRow);
  move(by("helperStatus"),studioConnection);move(by("driveAuthStatus"),studioConnection);
  var advanced=node("details","geDriveRepairMore");
  advanced.appendChild(node("summary",null,"ADVANCED · CONNECTION / DESKTOP BACKUP"));
  var oldCheck=by("retryHelper");
  if(oldCheck){oldCheck.textContent="CHECK GOOGLE DRIVE";move(oldCheck,advanced)}
  move(by("geDriveRepairInstructions"),advanced);
  move(by("geDesktopReconnectDownload"),advanced);
  move(by("geDesktopReconnectInfo"),advanced);
  move(by("geDriveRepairDownload"),advanced);move(by("autoCheckStatus"),advanced);
  var ghead=node("div","geGoogleIntro"),auth=node("div","geAuthPanel");
  var check=node("button",null,"CHECK CONNECTION");check.type="button";
  check.onclick=function(){if(oldCheck)oldCheck.click();var x=by("runStudioChecks");if(x)x.click()};
  auth.appendChild(check);
  diagnostics(auth,"Google",["helperStatus","driveQuotaStatus","libraryStatus","uploadResults","uploadIssues","mp3Status","autoRepairState"]);
  ghead.appendChild(auth);advanced.appendChild(ghead);studioConnection.appendChild(advanced);
  drive.appendChild(studioConnection);
  /* Upload above tabbed, viewport-contained workspace. */
  var tabsBar=node("div","geGoogleWorkTabs"),views=node("div","geGoogleViews");
  var filesView=node("section","geGoogleView"),metadataView=node("section","geGoogleView"),statusView=node("section","geGoogleView");
  filesView.id="geGoogleFilesView";metadataView.id="geGoogleMetadataView";statusView.id="geGoogleStatusView";
  move(driveTop,filesView);move(library,filesView);
  move(by("geUploadMetadataPanel"),metadataView);
  /* No redundant Google Settings block beneath the upload controls.
     Everything repair/connection related is inside STATUS TROUBLESHOOTING. */
  var statusDetails=diagnostic;
  if(statusDetails) {
    statusDetails.open=true;
    // Place FIX GOOGLE DRIVE immediately under STATUS rather than below
    // the long device diagnostics, so it is visible without scrolling.
    var summary=statusDetails.querySelector("summary");
    if(summary)statusDetails.insertBefore(studioConnection,summary.nextSibling);
    else move(studioConnection,statusDetails);
    move(extra,statusDetails);
    move(statusDetails,statusView);
  } else {
    move(studioConnection,statusView);
    move(extra,statusView);
  }
  var viewSet=[["FILES",filesView],["METADATA",metadataView],["STATUS",statusView]];
  function openGoogleView(index){
    for(var j=0;j<viewSet.length;j++){
      viewSet[j][1].style.display=j===index?"block":"none";
      tabsBar.children[j].className=j===index?"geGoogleWorkActive":"";
      tabsBar.children[j].setAttribute("aria-selected",j===index?"true":"false");
    }
    try{w.sessionStorage.setItem("geImacGoogleView",String(index))}catch(ignore){}
  }
  for(var vi=0;vi<viewSet.length;vi++)(function(i){
    var button=node("button",null,viewSet[i][0]);button.type="button";
    button.setAttribute("role","tab");button.onclick=function(){openGoogleView(i)};
    tabsBar.appendChild(button);views.appendChild(viewSet[i][1]);
  })(vi);
  drive.insertBefore(tabsBar,uploadSection.nextSibling);
  drive.insertBefore(views,tabsBar.nextSibling);
  var initialView=0;try{initialView=Number(w.sessionStorage.getItem("geImacGoogleView")||0)}catch(ignore){}
  if(initialView<0||initialView>2)initialView=0;
  openGoogleView(initialView);
  /* A distance-readable result remains visible after upload completion. */
  var bigResult=node("div","geUploadBigResult");
  bigResult.setAttribute("role","status");
  bigResult.setAttribute("aria-live","polite");
  bigResult.style.display="none";
  uploadStrip.parentNode.insertBefore(bigResult,uploadStrip.nextSibling);
  var lastResult="",resultTimer=0;
  function showResult(message,source){
    if(source===lastResult)return;
    lastResult=source;bigResult.textContent=message;bigResult.style.display="block";
    if(resultTimer)w.clearTimeout(resultTimer);
    resultTimer=w.setTimeout(function(){bigResult.style.display="none";resultTimer=0},4800);
  }
  function syncBigResult(){
    var result=by("uploadResults"),message=result?result.textContent:"";
    var line=by("geUploadMonitorHeadline"),lineText=line?line.textContent:"";
    var source=message+" "+lineText;
    if(/QUEUE FINISHED|UPLOAD COMPLETE|ALL FILES UPLOADED/i.test(source)&&
       !/failed[^0-9]*[1-9]|ERROR|FAILED[^0-9]*[1-9]/i.test(source)){
      showResult("COMPLETE",source);
    }else if(/UPLOAD NOT CONFIRMED|UPLOAD FAILED/i.test(source)){
      showResult("UPLOAD FAILED",source);
    }else if(/STARTING|SENDING TO IMAC|UPLOADING|TRACK [0-9]+\\//i.test(source)&&source!==lastResult){
      bigResult.style.display="none";lastResult="";
    }
  }
  if(w.setInterval)w.setInterval(syncBigResult,1200);

 var nav=node("nav","geBottomDock");nav.setAttribute("aria-label","iMac workstation sections");
 var tabs=[["STUDIO",studio],["MIXER",mixer],["EFFECTS",effects],["GOOGLE",google]];
 function fitGoogleToWindow(){
  if(!nav||google.style.display==="none")return;
  // Reserve the actual bottom dock space, rather than a guessed 150px.
  // This also handles a taller upload progress bar or resized Firefox.
  var top=google.getBoundingClientRect().top;
  var dockTop=nav.getBoundingClientRect().top;
  var available=Math.floor(dockTop-top-7);
  if(available<260){
    // Never strand controls off-screen on a short Firefox window.
    // Permit emergency page scrolling if the viewport is too small.
    d.documentElement.classList.remove("geImacGoogleActive");
    d.body.classList.remove("geImacGoogleActive");
    google.style.height="420px";
  }else{
    d.documentElement.classList.add("geImacGoogleActive");
    d.body.classList.add("geImacGoogleActive");
    var height=available+"px";
    if(google.style.height!==height)google.style.height=height;
  }
  google.style.minHeight="0";
 }
 function select(index){
  for(var j=0;j<tabs.length;j++){
    tabs[j][1].style.display=j===index?"block":"none";
    nav.children[j].className=j===index?"selected":"";
  }
  if(index===3){
    fitGoogleToWindow();
  }else{
    d.documentElement.classList.remove("geImacGoogleActive");
    d.body.classList.remove("geImacGoogleActive");
  }
  try{w.sessionStorage.setItem("geImacTab",String(index))}catch(e){}
  w.scrollTo(0,0);
}
 for(i=0;i<tabs.length;i++)(function(k){var b=node("button",null,tabs[k][0]);b.type="button";b.onclick=function(){select(k);if(k===3&&w.GEImacUploads&&w.GEImacUploads.refreshFiles)w.GEImacUploads.refreshFiles()};nav.appendChild(b)})(i);
 d.body.appendChild(nav);
 w.addEventListener("resize",fitGoogleToWindow,false);
 var requestedGoogle=/(?:[?&])tab=google(?:&|$)/i.test(w.location.search||'');select(requestedGoogle?3:0);
 /* Connection report, login repair and its advanced tools now share STATUS. */
 /* Keep upload failure banner inside Google, not covering Studio/Mixer. */
 var monitor=by("geUploadMonitor");if(monitor){monitor.className+=" geCompactUploadMonitor"}

}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
