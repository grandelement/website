/* GE iMac DJ Booth uploads to Google Drive through a local rclone helper.
 * Compatible with Firefox/Safari on OS X El Capitan (ES5/XHR).
 * The private Google credentials stay ONLY in ~/.config/rclone/rclone.conf.
 * Never touches BLITZ, BANGERS, the Saffire, or public radio storage.
 */
(function(w,d){
"use strict";
var LOCAL="http://127.0.0.1:8765",busy=false,jobPoll=0;
function el(id){return d.getElementById(id)}
function status(s){if(el("uploadResults"))el("uploadResults").textContent=String(s||"")}
function humanSize(n){return (Number(n||0)/1048576).toFixed(2)+" MB"}
function progress(p){if(el("uploadBar"))el("uploadBar").style.width=Math.max(0,Math.min(100,p))+"%"}
function setBusy(on){
 busy=!!on;
 ["uploadDraft","uploadFinal","listDrafts","listFinals"].forEach(function(id){if(el(id))el(id).disabled=busy});
 if(el("convertMp3"))el("convertMp3").disabled=busy;
}
function sendRequest(method,path,body,callback){
 var xhr=new XMLHttpRequest();
 xhr.open(method,LOCAL+path,true);
 xhr.timeout=method==="GET"?30000:0;
 xhr.setRequestHeader("Accept","application/json");
 if(method==="POST"){
  xhr.setRequestHeader("X-GE-Local","1");
  xhr.setRequestHeader("Content-Type",body&&body.type||"application/octet-stream");
 }
 xhr.onreadystatechange=function(){
  if(xhr.readyState!==4)return;
  var data={};
  try{data=JSON.parse(xhr.responseText||"{}")}catch(e){}
  if(xhr.status<200||xhr.status>=300||!data.ok){
   callback(new Error(data.error||"Local upload helper HTTP "+xhr.status),data);
  }else callback(null,data);
 };
 xhr.onerror=function(){callback(new Error("Cannot reach the iMac upload helper. Start it in Terminal first."))};
 xhr.ontimeout=function(){callback(new Error("Local uploader timed out"))};
 return xhr;
}
function openChooser(kind){
 if(busy)return;
 status("CHECKING GE STUDIOS UPLOADER…");
 var xhr=sendRequest("GET","/health",null,function(err,data){
  if(err){status(err.message);return}
  if(!data.rclone_ready){status("Google Drive connection is missing on this iMac. Check rclone configuration.");return}
  var fileInput=el(kind==="final"?"fileFinal":"fileDraft");
  status("Choose "+kind.toUpperCase()+" file. Google Drive: GE Studios/"+(kind==="final"?"Finals":"Drafts")+".");
  if(fileInput)fileInput.click();
 });
 xhr.send();
}
function waitForJob(id){
 if(jobPoll)clearTimeout(jobPoll);
 jobPoll=setTimeout(function(){
  var xhr=sendRequest("GET","/status?id="+encodeURIComponent(id),null,function(err,data){
   if(err){setBusy(false);status("UPLOAD STATUS UNKNOWN · "+err.message+". Check Google Drive before retrying.");return}
   var job=data.job||{};
   if(job.phase==="complete"){
    progress(100);setBusy(false);
    status("UPLOAD COMPLETE · "+job.detail+". Original file on iMac unchanged. NOT added to BANGERS.");
    return;
   }
   if(job.phase==="error"){
    setBusy(false);status("UPLOAD FAILED · "+job.detail+". Your original file was not changed.");return;
   }
   progress(job.percent||0);
   status((job.phase==="converting"?"CONVERTING TO MP3":job.phase==="uploading"?"UPLOADING TO GOOGLE DRIVE":"PREPARING UPLOAD")+
          " · "+(job.percent||0)+"% · "+(job.name||"")+(job.detail?" · "+job.detail:""));
   waitForJob(id);
  });
  xhr.send();
 },1800);
}
function send(kind,file){
 if(busy||!file)return;
 if(!/\.(mp3|mp4|wav|aif|aiff|m4a|aac|flac|ogg|oga)$/i.test(file.name||"")){
  status("Choose an MP3, MP4, WAV, AIFF, M4A, AAC, FLAC or OGG file.");return;
 }
 var convert=!!(el("convertMp3")&&el("convertMp3").checked);
 if(file.size>4*1024*1024*1024){
  status("The upload helper supports files up to 4 GB.");return;
 }
 var path="/upload?kind="+encodeURIComponent(kind)+"&name="+encodeURIComponent(file.name)+"&convert="+(convert?"1":"0");
 var xhr=sendRequest("POST",path,file,function(err,data){
  if(err){
   setBusy(false);status("UPLOAD NOT COMPLETED · "+err.message+". Original file unchanged.");return;
  }
  if(!data.id){setBusy(false);status("Upload helper did not return a job ID.");return}
  status("RECEIVED BY IMAC · "+file.name+" · Starting Google Drive transfer…");
  waitForJob(data.id);
 });
 setBusy(true);progress(0);
 status("SENDING FILE TO IMAC HELPER · "+file.name+" · "+humanSize(file.size));
 xhr.upload.onprogress=function(e){
  if(e.lengthComputable){
   var pct=Math.min(99,Math.round(100*e.loaded/Math.max(1,e.total)));
   progress(pct);
   status("PREPARING LOCAL TRANSFER · "+pct+"% · "+file.name+" · "+humanSize(file.size));
  }
 };
 xhr.send(file);
}
function list(kind){
 if(busy)return;
 setBusy(true);
 status("READING GOOGLE DRIVE "+kind.toUpperCase()+"S…");
 var xhr=sendRequest("GET","/files?kind="+encodeURIComponent(kind),null,function(err,data){
  setBusy(false);
  if(err){status("FILE LIST UNAVAILABLE · "+err.message);return}
  var files=data.files||[];
  if(!files.length){status("No files found in GE Studios/"+(kind==="final"?"Finals":"Drafts")+".");return}
  var rows=files.slice(0,25).map(function(x){return (x.name||"Untitled")+" · "+humanSize(x.bytes)});
  status("GOOGLE DRIVE "+kind.toUpperCase()+"S ("+files.length+")\n"+rows.join("\n")+
   (data.has_more?"\nMore files stored…":""));
 });
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
 // Every page load starts with original (no conversion) selected.
 if(el("convertMp3"))el("convertMp3").checked=false;
 status("GOOGLE DRIVE UPLOADS · Select Draft or Final after starting the local GE upload helper. Convert to MP3 is optional.");
}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
