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
  "Radio 2        BACKUP MUSIC ONLY · Studio LIVE ingest not implemented",
  "",
  "SECURITY       NO PASSWORDS OR ACCESS TOKENS IN THIS REPORT"
 ];
 var pre=el("geStudioSnapshot");
 if(pre)pre.textContent=lines.join("\n");
}
function run(){
 var drive=el("retryHelper"),radio=el("testLive");
 if(drive&&drive.onclick)drive.click();
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
 if(w.setInterval)w.setInterval(snapshot,2500);
 var diag=el("geDiagnostics");
 if(diag&&diag.addEventListener)diag.addEventListener("toggle",function(){if(diag.open)snapshot()});
}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
