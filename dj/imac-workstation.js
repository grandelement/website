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
 main.insertBefore(uploadStrip,header);
 var existingMonitor=by("geUploadMonitor");
 function syncUploadStrip(){
  if(!existingMonitor)return;
  var showing=existingMonitor.style.display==="block";
  var headline=by("geUploadMonitorHeadline"),detail=by("geUploadMonitorDetail");
  stripTitle.textContent=showing&&headline?headline.textContent:"UPLOAD · READY";
  stripStatus.textContent=showing&&detail?detail.textContent:"No transfer in progress";
  uploadStrip.className=showing?"geUploadStrip active":"geUploadStrip";
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
 /* Google: all Drive-related operations and repair guidance stay in one tab. */
 var ghead=node("div","geGoogleIntro");
 ghead.appendChild(node("h2",null,"GOOGLE · DRIVE & UPLOADS"));
 var state=node("p","geGoogleState","Drive status: run diagnostics to verify.");
 ghead.appendChild(state);
 var auth=node("div","geAuthPanel");
 auth.appendChild(node("h3",null,"GOOGLE CONNECTION"));
 var retry=node("button",null,"CHECK GOOGLE CONNECTION");retry.type="button";retry.onclick=function(){var b=by("retryHelper");if(b)b.click();var c=by("runStudioChecks");if(c)c.click()};
 auth.appendChild(retry);
 var renew=node("a","link geReauthorize","1 · REAUTHORIZE GOOGLE DRIVE");
 renew.href="/dj/ge-google-reauthorize.command";renew.download="ge-google-reauthorize.command";
 renew.style.display="inline-block";renew.style.margin="5px";renew.style.padding="11px 13px";renew.style.background="#166753";renew.style.color="#fff";renew.style.borderRadius="5px";renew.style.fontWeight="bold";
 auth.appendChild(renew);
 var renewNote=node("p",null,"Download the repair file on the iMac. macOS may block downloaded scripts or remove executable permissions. If double-click does not run it, use COPY RUN COMMAND, open Terminal, paste, and press Return. Your rclone configuration is backed up first.");
 var runCopy=node("button",null,"COPY GOOGLE REPAIR · NO TYPING");runCopy.type="button";runCopy.onclick=function(){var cmd="bash \"$HOME/Downloads/ge-google-reauthorize.command\"";var t=node("textarea");t.value=cmd;t.style.position="fixed";t.style.left="-9999px";d.body.appendChild(t);t.select();try{d.execCommand("copy")}catch(e){w.prompt("Copy this command:",cmd)}d.body.removeChild(t);runCopy.textContent="COPIED · PASTE IN TERMINAL";};auth.appendChild(runCopy);
 auth.appendChild(renewNote);
 var instructions=node("details","geHelp");
 instructions.appendChild(node("summary",null,"? HELP · RENEW GOOGLE AUTHORIZATION"));
 var p=node("p",null,"An expired Google token must be renewed in the iMac rclone configuration. RECONNECT DRIVE only retries the existing token; it does not sign in. On the iMac, open Terminal and run the command below. Follow the Google sign-in prompts. If rclone offers a headless authorization URL, use the iPhone to sign in and finish the prompted transfer back to the iMac. Never paste tokens or passwords into the DJ Booth.");
 instructions.appendChild(p);
 var command=node("code",null,"~/Downloads/rclone-v1.52.0-osx-amd64/rclone config reconnect GEStudios:");
 instructions.appendChild(command);
 var copy=node("button",null,"SELECT COMMAND");copy.type="button";copy.onclick=function(){var sel=w.getSelection&&w.getSelection();if(sel&&d.createRange){var r=d.createRange();r.selectNodeContents(command);sel.removeAllRanges();sel.addRange(r)}};
 instructions.appendChild(copy);auth.appendChild(instructions);
 help(auth,"Google security","Google authentication belongs to rclone on the iMac. A remote iPhone button cannot silently modify local credentials. The future paired-device authorization requires an authenticated server relay and one-time pairing; no tokens should appear in diagnostics.");
 diagnostics(auth,"Google",["helperStatus","driveQuotaStatus","libraryStatus","uploadResults","uploadIssues","mp3Status","autoRepairState"]);
 ghead.appendChild(auth);google.insertBefore(ghead,drive);
 var nav=node("nav","geBottomDock");nav.setAttribute("aria-label","iMac workstation sections");
 var tabs=[["STUDIO",studio],["MIXER",mixer],["EFFECTS",effects],["GOOGLE",google]];
 function select(index){for(var j=0;j<tabs.length;j++){tabs[j][1].style.display=j===index?"block":"none";nav.children[j].className=j===index?"selected":""}try{w.sessionStorage.setItem("geImacTab",String(index))}catch(e){}w.scrollTo(0,0)}
 for(i=0;i<tabs.length;i++)(function(k){var b=node("button",null,tabs[k][0]);b.type="button";b.onclick=function(){select(k)};nav.appendChild(b)})(i);
 d.body.appendChild(nav);
 var requestedGoogle=/(?:[?&])tab=google(?:&|$)/i.test(w.location.search||'');select(requestedGoogle?3:0);
 /* Keep the original diagnostics as a separate collapsible section under Google. */
 move(diagnostic,google);
 var statusBtn=node("button",null,"FULL CONNECTION REPORT");statusBtn.type="button";statusBtn.onclick=function(){select(3);diagnostic.open=true;var b=by("runStudioChecks");if(b)b.click();diagnostic.scrollIntoView()};
 auth.appendChild(statusBtn);
 /* Keep upload failure banner inside Google, not covering Studio/Mixer. */
 var monitor=by("geUploadMonitor");if(monitor){monitor.className+=" geCompactUploadMonitor"}
 /* Remove repeated verbose explanations from default view without deleting them. */
 var sections=drive.querySelectorAll("p.small");
 for(i=0;i<sections.length;i++){var para=sections[i];if(para.id||para.parentNode.className.indexOf("geUploadCard")>=0)continue;
  var wrap=node("details","geHelp geContextHelp"),summary=node("summary",null,"? HELP · "+(para.textContent||"Google Drive").slice(0,45)+"…");
  para.parentNode.insertBefore(wrap,para);wrap.appendChild(summary);wrap.appendChild(para);
 }
}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);  /* Google: two primary actions; advanced repair stays collapsed. */
  var ghead=node("div","geGoogleIntro");
  var auth=node("div","geAuthPanel");
  var actions=node("div","geGooglePrimaryActions");
  var repair=node("button","green","RECONNECT GOOGLE · REPAIR");repair.type="button";
  var advanced=node("details","geGoogleAdvanced");
  var summary=node("summary",null,"MANUAL REPAIR · OPTIONS");
  advanced.appendChild(summary);
  var advancedBody=node("div","geGoogleAdvancedBody");
  var check=node("button",null,"CHECK CONNECTION");check.type="button";
  check.onclick=function(){var b=by("retryHelper");if(b)b.click();var x=by("runStudioChecks");if(x)x.click()};
  advancedBody.appendChild(check);
  var download=node("a","link","DOWNLOAD REPAIR SCRIPT");download.href="/dj/ge-google-reauthorize.command";download.download="ge-google-reauthorize.command";advancedBody.appendChild(download);
  var copy=node("button",null,"COPY TERMINAL COMMAND");copy.type="button";
  copy.onclick=function(){var cmd="bash \\"$HOME/Downloads/ge-google-reauthorize.command\\"";var t=node("textarea");t.value=cmd;t.style.position="fixed";t.style.left="-9999px";d.body.appendChild(t);t.select();var ok=false;try{ok=d.execCommand("copy")}catch(e){}d.body.removeChild(t);if(!ok)w.prompt("Copy:",cmd);else copy.textContent="COPIED";};
  advancedBody.appendChild(copy);
  help(advancedBody,"Google authorization","The iMac helper must be upgraded before a website button can launch the local repair script. Until then, download the repair script and run it on the Mac. Google sign-in always requires your approval.");
  diagnostics(advancedBody,"Google",["helperStatus","driveQuotaStatus","libraryStatus","uploadResults","uploadIssues","mp3Status","autoRepairState"]);
  advanced.appendChild(advancedBody);
  repair.onclick=function(){
    var status=by("geGoogleRepairNotice");
    if(status)status.textContent="LOCAL LAUNCHER REQUIRED · Open GE Google Repair.app on the iMac. The current helper cannot launch it from Firefox.";
  };
  actions.appendChild(repair);actions.appendChild(advanced);
  auth.appendChild(actions);
  var notice=node("p","geGoogleRepairNotice");notice.id="geGoogleRepairNotice";auth.appendChild(notice);
  ghead.appendChild(auth);google.insertBefore(ghead,drive);
  /* Studio Drive connection belongs with the Studio controls. Keep Google uploads under Google. */
  var studioConnection=node("div","geStudioDriveConnection");
  var originalRetry=by("retryHelper");if(originalRetry){move(originalRetry,studioConnection);originalRetry.textContent="CHECK STUDIO DRIVE";}
  var helper=by("helperStatus");move(helper,studioConnection);
  var autoCheck=by("autoCheckStatus");move(autoCheck,studioConnection);
  studio.appendChild(studioConnection);
  var studioDriveTitle=drive.querySelector("h2");if(studioDriveTitle)studioDriveTitle.textContent="GOOGLE FILES & UPLOADS";

