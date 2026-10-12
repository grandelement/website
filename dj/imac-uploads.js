/* GE iMAC CLASSIC · private file upload to Cloudflare R2.
 * Never publishes a draft or final recording to the public radio automatically.
 * Old Safari-compatible JavaScript: no fetch, modern syntax, or Google Drive UI.
 */
(function(w,d){
"use strict";
var API="https://ge-radio-sync.grandelement.workers.dev/v1/dj-uploads";
var MAX_BYTES=60*1024*1024,busy=false;
function el(id){return d.getElementById(id)}
function status(s){if(el("uploadResults"))el("uploadResults").textContent=String(s||"")}
function auth(xhr){
 var old=w.GEImacClassic;
 if(!old||!old.loggedIn||!old.loggedIn())throw new Error("Sign in to GE DJ before uploading.");
 var a=old.getAuth();
 if(a.key)xhr.setRequestHeader("X-GE-DJ-Key",a.key);
 if(a.id&&a.token){xhr.setRequestHeader("X-GE-DJ-Device-ID",a.id);xhr.setRequestHeader("X-GE-DJ-Device-Token",a.token)}
 if(!a.key&&!(a.id&&a.token))throw new Error("Trusted iMac DJ session is not ready. Sign in again.");
}
function safeJson(xhr){try{return JSON.parse(xhr.responseText||"{}")}catch(e){return {}}}
function humanSize(n){return (Number(n||0)/1048576).toFixed(2)+" MB"}
function setBusy(on){
 busy=!!on;
 ["uploadDraft","uploadFinal","listDrafts","listFinals"].forEach(function(id){if(el(id))el(id).disabled=busy})
}
function openChooser(kind){
 if(busy)return;
 try{
  var old=w.GEImacClassic;
  if(!old||!old.loggedIn||!old.loggedIn()){status("Sign in to GE DJ with your usual code before uploading.");return}
  var id=kind==="final"?"fileFinal":"fileDraft";if(el(id))el(id).click()
 }catch(e){status(e.message||e)}
}
function send(kind,file){
 if(busy||!file)return;
 if(!/\.(mp3|m4a|aac|wav|aif|aiff|flac|ogg|oga)$/i.test(file.name||"")){
  status("Unsupported audio format. Choose MP3, WAV, M4A, AAC, AIFF, FLAC or OGG.");return
 }
 if(file.size>MAX_BYTES){status("File is "+humanSize(file.size)+". Maximum per upload is 60 MB.");return}
 var url=API+"?kind="+encodeURIComponent(kind)+"&name="+encodeURIComponent(file.name);
 var xhr=new XMLHttpRequest();
 try{
  xhr.open("POST",url,true);
  xhr.timeout=180000;
  auth(xhr);
  xhr.setRequestHeader("Accept","application/json");
  xhr.setRequestHeader("Content-Type",file.type||"application/octet-stream");
 }catch(e){status("UPLOAD NOT STARTED · "+String(e&&e.message||e));return}
 setBusy(true);
 status("UPLOADING PRIVATE "+kind.toUpperCase()+" · "+file.name+" · "+humanSize(file.size));
 xhr.upload.onprogress=function(e){
  if(e.lengthComputable){var pct=Math.min(99,Math.round(100*e.loaded/Math.max(1,e.total)));
   if(el("uploadBar"))el("uploadBar").style.width=pct+"%";
   status("UPLOADING PRIVATE "+kind.toUpperCase()+" · "+pct+"% · "+file.name);
  }
 };
 function finished(){setBusy(false)}
 xhr.onreadystatechange=function(){
  if(xhr.readyState!==4)return;
  var data=safeJson(xhr);finished();
  if(xhr.status===201&&data.ok){
   if(el("uploadBar"))el("uploadBar").style.width="100%";
   status("UPLOAD COMPLETE · PRIVATE "+kind.toUpperCase()+" · "+(data.name||file.name)+" · "+humanSize(data.bytes)+". NOT published on radio.");
  }else{
   status("UPLOAD FAILED · "+(data.error||"HTTP "+xhr.status)+". Your local file was not deleted.");
  }
 };
 xhr.onerror=function(){finished();status("UPLOAD FAILED · Network or browser connection error. Nothing has been confirmed stored.")};
 xhr.ontimeout=function(){finished();status("UPLOAD TIMED OUT · Confirm storage before retrying to avoid a duplicate.")};
 xhr.send(file);
}
function list(kind){
 if(busy)return;
 var xhr=new XMLHttpRequest();
 try{xhr.open("GET",API+"?kind="+encodeURIComponent(kind),true);xhr.timeout=16000;auth(xhr);xhr.setRequestHeader("Accept","application/json")}
 catch(e){status(String(e&&e.message||e));return}
 setBusy(true);
 status("READING PRIVATE "+kind.toUpperCase()+" FILES…");
 xhr.onreadystatechange=function(){
  if(xhr.readyState!==4)return;setBusy(false);
  var data=safeJson(xhr);
  if(xhr.status!==200||!data.ok){status("PRIVATE FILE LIST FAILED · "+(data.error||"HTTP "+xhr.status));return}
  if(!data.files||!data.files.length){status("NO PRIVATE "+kind.toUpperCase()+" FILES UPLOADED YET.");return}
  var rows=data.files.slice(0,25).map(function(x){return (x.name||"Untitled")+" · "+humanSize(x.bytes)});
  status("PRIVATE "+kind.toUpperCase()+" FILES ("+data.files.length+")\n"+rows.join("\n")+(data.has_more?"\nMore files stored…":""));
 };
 xhr.onerror=function(){setBusy(false);status("Private file list unavailable in this Safari session.")};
 xhr.send();
}
function init(){
 if(!el("uploadDraft"))return;
 el("uploadDraft").onclick=function(){openChooser("draft")};
 el("uploadFinal").onclick=function(){openChooser("final")};
 el("fileDraft").onchange=function(){var file=this.files&&this.files[0];this.value="";send("draft",file)};
 el("fileFinal").onchange=function(){var file=this.files&&this.files[0];this.value="";send("final",file)};
 el("listDrafts").onclick=function(){list("draft")};
 el("listFinals").onclick=function(){list("final")};
}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
