/* GE Studio iMac consolidated screenshot-friendly status.
   Read-only. Never includes DJ keys, device tokens, Google tokens or passwords.
   Supports Firefox on macOS El Capitan without modern JS APIs. */
(function(w,d){
"use strict";
function el(id){return d.getElementById(id)}
function read(id){
 var x=el(id);
 return x?String(x.textContent||"").replace(/\s+/g," ").slice(0,280):"not available";
}
function stamp(){
 var date=new Date();
 try{return date.toLocaleString()}catch(e){return String(date)}
}
function label(text){return text.replace(/[\r\n\t]/g," ").slice(0,240)}
function snapshot(){
 var radio=w.GEImacClassic, mixer=w.GEImacMixer;
 var radioConnected=!!(radio&&radio.loggedIn&&radio.loggedIn());
 var onAir=!!(mixer&&mixer.isOnAir&&mixer.isOnAir());
 var player=el("imacRadioAudio");
 var input=el("inputs"),chosen=input&&input.selectedIndex>=0?
  input.options[input.selectedIndex].textContent:"None";
 var pages=d.querySelectorAll?d.querySelectorAll('a[href*="grandelement.com/dj/imac.html"]').length:0;
 var lines=[
  "GE STUDIOS · CONNECTION STATUS",
  "DATE / TIME    "+stamp(),
  "STUDIO PAGE    "+(w.location&&w.location.hostname||"unknown"),
  "",
  "STUDIO DRIVE",
  "Connection     "+read("helperStatus"),
  "Drive online   "+read("driveQuotaStatus"),
  "Autostart      "+read("autoRepairState"),
  "MP3 converter  "+read("mp3Status"),
  "Drive listing  "+read("libraryStatus"),
  "File transfer  "+read("uploadResults"),
  "",
  "STUDIO AUDIO",
  "Selected input "+label(chosen),
  "Input status   "+read("meterStatus"),
  "Audio routing  "+read("inputStatus"),
  "Left / Right   "+read("leftDb")+" / "+read("rightDb"),
  "",
  "STUDIO RADIO",
  "Radio 1 auth   "+(radioConnected?"CONNECTED":"DISCONNECTED"),
  "LIVE state     "+(onAir?"LIVE ACTIVE IN THIS TAB":"OFF AIR IN THIS TAB"),
  "Connection     "+read("connection"),
  "LIVE status    "+read("liveStatus"),
  "Readiness      "+read("liveReadiness"),
  "Radio test     "+read("liveProbeResult"),
  "Public player  "+(player&&player.paused?"PAUSED":"PLAYING")+" · "+read("listenerState"),
  "Radio sources   BLITZ ONLY · Radio 2 listener switch disabled",
  "",
  "SECURITY       NO PASSWORDS OR ACCESS TOKENS IN THIS REPORT"
 ];
 var pre=el("geStudioSnapshot");
 if(pre)pre.textContent=lines.join("\n");
}
var checkingDrive=false;
function checkDriveRemote(){
 if(checkingDrive)return;
 checkingDrive=true;
 var target=el("driveQuotaStatus");
 if(target)target.textContent="Checking Google Drive remote access and available space…";
 var xhr=new XMLHttpRequest(),finished=false;
 function done(message){
  if(finished)return;finished=true;checkingDrive=false;
  if(target)target.textContent=message;
  snapshot();
 }
 try{
  xhr.open("GET","http://127.0.0.1:8765/check",true);
  xhr.timeout=15000;
  xhr.setRequestHeader("Accept","application/json");
  xhr.onreadystatechange=function(){
   if(xhr.readyState!==4)return;
   if(xhr.status===0){done("OFFLINE · Local helper not responding (HTTP 0)");return}
   if(xhr.status===404){done("NOT AVAILABLE · Updated local helper v3 required for full Drive check.");return}
   if(xhr.status!==200){done("DRIVE CHECK FAILED · Local helper HTTP "+xhr.status);return}
   var result={};try{result=JSON.parse(xhr.responseText||"{}")}catch(e){}
   if(!result.drive_accessible){done("GOOGLE DRIVE NOT VERIFIED · "+(result.reason||"Remote check failed."));return}
   done("GOOGLE DRIVE VERIFIED"+(result.free?" · FREE "+result.free:"")+
    (result.total?" / TOTAL "+result.total:"")+
    (result.used?" · USED "+result.used:""));
  };
  xhr.onerror=function(){done("LOCAL HELPER UNREACHABLE · Remote Drive quota not checked.")};
  xhr.ontimeout=function(){done("GOOGLE DRIVE CHECK TIMED OUT · Please try reconnecting.")};
  xhr.send(null);
 }catch(e){done("BROWSER BLOCKED LOCAL HELPER CHECK · No credentials changed.")}
}
function run(){
 var drive=el("retryHelper"),radio=el("testLive");
 if(drive&&drive.onclick)drive.click();
 checkDriveRemote();
 if(radio&&radio.onclick)radio.click();
 snapshot();
 w.setTimeout(snapshot,1600);
 w.setTimeout(snapshot,4500);
}
function init(){
 if(!el("geStudioSnapshot"))return;
 var b=el("runStudioChecks");if(b)b.onclick=run;
 var drive=el("retryHelperDiagnostics");
 if(drive)drive.onclick=function(){var b=el("retryHelper");if(b)b.click();snapshot()};
 snapshot();
 w.setTimeout(checkDriveRemote,1400);
 if(w.setInterval){w.setInterval(snapshot,2500);w.setInterval(checkDriveRemote,300000)}
 var diag=el("geDiagnostics");
 if(diag&&diag.addEventListener)diag.addEventListener("toggle",function(){if(diag.open)snapshot()});
}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
