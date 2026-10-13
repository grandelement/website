/* GE iMac DJ Booth - local Google Drive drafts/finals library.
 * Compatible with Firefox on OS X El Capitan (ES5/XHR).
 * No BLITZ login and no effect on broadcast, Saffire or Ableton.
 * Files stay on the iMac; only selected copies go to private Google Drive.
 */
(function(w,d){
"use strict";
var LOCAL="http://127.0.0.1:8765";
var busy=false, queue=[], complete=0, failures=0, total=0, current=null;
var activeKind="draft",deleteAvailable=false,converterName="",converterAvailable=false,libraryBusy=false,lastUploadKind="draft";
var pollTimer=0, queuePaused=false;
function el(id){return d.getElementById(id)}
function text(id,value){var x=el(id);if(x)x.textContent=String(value||"")}
function status(s){text("uploadResults",s)}
function mb(n){return (Number(n||0)/1048576).toFixed(2)+" MB"}
function progress(n){
 var x=el("uploadBar");if(!x)return;
 // rclone may not publish percentages while authenticating or finishing a Drive
 // upload; LAME --quiet does not publish conversion percentages at all.
 // Show a visibly animated INDETERMINATE bar instead of a false 0%.
 if(n===null||typeof n!=="number"||!isFinite(n)){
  x.className="geMeterFill geUploadIndeterminate";
  x.style.width="32%";
  x.style.marginLeft="";
  x.setAttribute("aria-valuetext","Working; exact percentage unavailable");
  x.removeAttribute("aria-valuenow");
 }else{
  x.className="geMeterFill";
  x.style.marginLeft="0";
  var pct=Math.max(0,Math.min(100,n));
  x.style.width=pct+"%";
  x.setAttribute("aria-valuenow",String(pct));
  x.setAttribute("aria-valuetext",String(pct)+" percent");
 }
}
function folder(kind){return kind==="final"?"Finals":"Drafts"}
function setBusy(flag){
 busy=!!flag;
 ["uploadDraft","uploadFinal","convertMp3","fileDraft","fileFinal"].forEach(function(id){
  if(el(id))el(id).disabled=busy;
 });
 if(el("listDrafts"))el("listDrafts").disabled=false;
 if(el("listFinals"))el("listFinals").disabled=false;
}
function request(method,path,body,callback){
 var xhr=new XMLHttpRequest(),called=false;
 function done(err,data){
  if(called)return;called=true;callback(err,data||{});
 }
 xhr.open(method,LOCAL+path,true);
 xhr.timeout=method==="GET"?60000:0;
 xhr.setRequestHeader("Accept","application/json");
 if(method==="POST"){
  xhr.setRequestHeader("X-GE-Local","1");
  xhr.setRequestHeader("Content-Type",typeof body==="string"?"application/json":(body&&body.type||"application/octet-stream"));
 }
 xhr.onreadystatechange=function(){
  if(xhr.readyState!==4)return;
  var data={};try{data=JSON.parse(xhr.responseText||"{}")}catch(e){}
  if(xhr.status<200||xhr.status>=300||!data.ok)
   done(new Error(data.error||"Local upload helper HTTP "+xhr.status),data);
  else done(null,data);
 };
 xhr.onerror=function(){done(new Error("The local iMac helper is unavailable. Keep its Terminal window open."))};
 xhr.ontimeout=function(){done(new Error("Local helper request timed out"))};
 return {xhr:xhr,send:function(){try{xhr.send(body||null)}catch(e){done(e)}}};
}
function refreshHealth(){
 text("mp3Status","CHECKING LOCAL MP3 ENCODER…");
 var req=request("GET","/health",null,function(err,data){
  var toggle=el("convertMp3");
  if(err){
   converterAvailable=false;converterName="";
   if(toggle){toggle.checked=false;toggle.disabled=true}
   text("mp3Status","MP3 CONVERSION UNAVAILABLE · The local iMac helper is not responding. Original-file uploads require the helper to run.");
   return;
  }
  deleteAvailable=!!data.delete_available;
  converterAvailable=!!data.mp3_available;
  converterName=data.mp3_converter||"not installed";
  if(toggle){
   toggle.disabled=!converterAvailable;
   if(!converterAvailable)toggle.checked=false;
  }
  text("mp3Status",converterAvailable?
   "MP3 CONVERTER READY · "+converterName+" · 320 kbps. Check the box to convert before uploading.":
   "MP3 CONVERTER NOT INSTALLED ON THIS IMAC · Conversion is disabled until a compatible encoder is installed. Click INSTALL MP3 ENCODER below. Normal WAV/AIFF/MP3 uploads still work.");
  if(!deleteAvailable)text("libraryHelp","File listing works with the current helper. Move to Trash requires the updated helper.");
  else text("libraryHelp","Files stored privately in Google Drive. MOVE TO TRASH removes only the selected Drive copy; originals on this iMac remain unchanged.");
  list(activeKind,true);
 });req.send();
}
function openChooser(kind){
 if(busy){status("Wait for the current upload queue to finish.");return}
 status("Choose one or more "+folder(kind).toUpperCase()+" tracks, or use the visible CHOOSE FILE control below.");
 var input=el(kind==="final"?"fileFinal":"fileDraft");
 if(input)try{input.click()}catch(e){status("Use the visible CHOOSE FILE control below.")}
}
function addFiles(kind,files){
 if(busy){status("Wait for current uploads to finish.");return}
 if(!files||!files.length)return;
 var convert=!!(el("convertMp3")&&el("convertMp3").checked);
 if(convert&&!converterAvailable){
  status("MP3 CONVERSION IS NOT INSTALLED · The file has NOT been uploaded. Click INSTALL MP3 ENCODER, then restart the updated iMac helper. Or uncheck conversion to upload the original.");
  return;
 }
 var fresh=[],invalid=[];
 for(var i=0;i<files.length;i++){
  var file=files[i];
  if(!file||!/\.(mp3|mp4|wav|aif|aiff|m4a|aac|flac|ogg|oga)$/i.test(file.name||"")){
   invalid.push(file&&file.name||"unknown file");continue;
  }
  if(convert&&converterName.indexOf("LAME")!==-1&&!/\.(wav|aiff|aif|mp3)$/i.test(file.name||"")){
   invalid.push(file.name+" (LAME converts WAV/AIFF; MP4/M4A needs FFmpeg)");continue;
  }
  if(file.size<1||file.size>4*1024*1024*1024){
   invalid.push(file.name+" (size out of range)");continue;
  }
  fresh.push({kind:kind,file:file,convert:convert});
 }
 if(invalid.length)text("uploadIssues","SKIPPED unsupported files: "+invalid.join(", "));
 if(!fresh.length){status("No compatible music files selected.");return}
 queue=fresh;
 lastUploadKind=kind;
 total=fresh.length;complete=0;failures=0;queuePaused=false;
 setBusy(true);progress(null);
 status("QUEUED "+total+" track"+(total===1?"":"s")+" for GE Studios/"+folder(kind)+".");
 next();
}
function finishQueue(){
 setBusy(false);
 var successes=complete-failures;
 status("UPLOAD QUEUE FINISHED · "+successes+" successful · "+failures+" failed. Originals on your iMac were not changed. Not added to BANGERS.");
 if(!failures)progress(100);
 list(lastUploadKind,true);
 queue=[];current=null;
}
function failOne(message){
 failures++;complete++;
 progress(0);
 text("uploadIssues",textValue("uploadIssues")+"\n"+(current?current.file.name+": ":"")+message);
 current=null;setTimeout(next,100);
}
function textValue(id){var x=el(id);return x?String(x.textContent||""):""}
function next(){
 if(queuePaused)return;
 if(!queue.length){finishQueue();return}
 current=queue.shift();
 var item=current,file=item.file;
 item.startedAt=Date.now();
 var idx=complete+1;
 var url="/upload?kind="+encodeURIComponent(item.kind)+"&name="+encodeURIComponent(file.name)+
         "&convert="+(item.convert?"1":"0");
 var req=request("POST",url,file,function(err,data){
  if(err){failOne("UPLOAD FAILED · "+err.message);return}
  if(!data.id){failOne("Uploader did not return a job ID");return}
  progress(null);
  status("TRACK "+idx+"/"+total+" · LOCAL TRANSFER COMPLETE · "+file.name+" · Waiting for conversion / Google Drive transfer…");
  waitForJob(data.id,item,idx);
 });
 req.xhr.upload.onprogress=function(e){
  if(e.lengthComputable){
   var pct=Math.min(99,Math.round(100*e.loaded/Math.max(e.total,1)));
   progress(pct);
   status("TRACK "+idx+"/"+total+" · PREPARING LOCAL FILE · "+pct+"% · "+file.name+" ("+mb(file.size)+")");
  }
 };
 status("TRACK "+idx+"/"+total+" · TRANSFERRING TO IMAC · "+file.name+" · "+mb(file.size));
 progress(null);req.send();
}
function waitForJob(id,item,idx){
 if(pollTimer)clearTimeout(pollTimer);
 pollTimer=setTimeout(function(){
  var req=request("GET","/status?id="+encodeURIComponent(id),null,function(err,data){
   if(err){
    queuePaused=true;setBusy(false);progress(0);
    status("UPLOAD STATUS UNKNOWN for "+item.file.name+" · "+err.message+
     ". Check Google Drive before retrying; "+queue.length+" remaining track(s) were not started.");
    return;
   }
   var job=data.job||{},pct=Number(job.percent||0);
   if(job.phase==="complete"){
    complete++;progress(100);
    status("TRACK "+idx+"/"+total+" COMPLETE · "+item.file.name);
    current=null;setTimeout(next,100);return;
   }
   if(job.phase==="error"){failOne("GOOGLE DRIVE FAILED · "+String(job.detail||"Unknown error"));return}
   var numericProgress=pct>0&&pct<=100;
   progress(numericProgress?pct:null);
   var elapsed=Math.max(0,Math.floor((Date.now()-item.startedAt)/1000));
   var stage=job.phase==="converting"?"CONVERTING TO 320 kbps MP3":
      job.phase==="uploading"?"UPLOADING TO GOOGLE DRIVE":"PREPARING LOCAL FILE";
   status("TRACK "+idx+"/"+total+" · "+stage+
    " · "+(numericProgress?pct+"%":"WORKING · Exact % unavailable")+
    " · "+elapsed+"s elapsed · "+item.file.name+
    (job.detail?" · "+job.detail:""));
   waitForJob(id,item,idx);
  });req.send();
 },1800);
}
function clearNode(node){while(node&&node.firstChild)node.removeChild(node.firstChild)}
function list(kind,quiet){
 activeKind=kind;
 text("libraryTitle","GOOGLE DRIVE · GE Studios / "+folder(kind));
 if(libraryBusy)return;
 libraryBusy=true;
 var area=el("musicLibrary");
 if(!area)return;
 if(!quiet)text("libraryStatus","Loading "+folder(kind)+" from Google Drive…");
 var req=request("GET","/files?kind="+encodeURIComponent(kind),null,function(err,data){
  libraryBusy=false;clearNode(area);
  if(err){
   text("libraryStatus","Could not open "+folder(kind)+": "+err.message);
   return;
  }
  var files=data.files||[];
  text("libraryStatus",files.length+" track"+(files.length===1?"":"s")+" in "+folder(kind)+
   (data.has_more?" · Showing first 100":""));
  if(!files.length){
   var empty=d.createElement("p");empty.textContent="No tracks in this folder yet.";area.appendChild(empty);return;
  }
  for(var i=0;i<files.length;i++){
   (function(item){
    var row=d.createElement("div");
    row.className="geMusicFileRow";
    var description=d.createElement("div");
    description.className="geMusicFileName";
    var title=d.createElement("strong");title.textContent=item.name||"(unnamed)";
    var meta=d.createElement("span");meta.className="geMusicMeta";
    meta.textContent=mb(item.bytes)+(item.modified?" · "+item.modified.slice(0,10):"");
    description.appendChild(title);description.appendChild(meta);
    row.appendChild(description);
    var del=d.createElement("button");
    del.type="button";del.className="geDeleteMusic";
    del.textContent=deleteAvailable?"MOVE TO TRASH":"UPDATE HELPER TO DELETE";
    del.disabled=!deleteAvailable||busy;
    del.onclick=function(){removeFile(kind,item,del)};
    row.appendChild(del);area.appendChild(row);
   })(files[i]);
  }
 });req.send();
}
function removeFile(kind,item,button){
 if(busy||!deleteAvailable)return;
 var name=String(item.name||"");
 if(!w.confirm("Move this Google Drive "+folder(kind)+" track to Trash?\n\n"+name+
  "\n\nYour original audio file on this iMac will NOT be deleted."))return;
 button.disabled=true;
 text("libraryStatus","Moving "+name+" to Google Drive Trash…");
 var req=request("POST","/delete",JSON.stringify({kind:kind,name:name}),function(err,data){
  if(err){
   button.disabled=false;
   text("libraryStatus","DELETE FAILED · "+err.message+". File was not confirmed deleted.");
   return;
  }
  text("libraryStatus","MOVED TO GOOGLE DRIVE TRASH · "+name);
  list(kind,true);
 });req.send();
}
function init(){
 if(!el("uploadDraft"))return;
 el("uploadDraft").onclick=function(){openChooser("draft")};
 el("uploadFinal").onclick=function(){openChooser("final")};
 el("fileDraft").onchange=function(){
  var f=[];for(var i=0;i<this.files.length;i++)f.push(this.files[i]);
  this.value="";addFiles("draft",f);
 };
 el("fileFinal").onchange=function(){
  var f=[];for(var i=0;i<this.files.length;i++)f.push(this.files[i]);
  this.value="";addFiles("final",f);
 };
 el("listDrafts").onclick=function(){list("draft",false)};
 el("listFinals").onclick=function(){list("final",false)};
 if(el("convertMp3")){
  el("convertMp3").checked=false;
  el("convertMp3").disabled=true;
  el("convertMp3").onchange=function(){
   if(this.checked&&!converterAvailable){
    this.checked=false;
    text("mp3Status","MP3 CONVERTER NOT INSTALLED · Download the compatible legacy encoder below before selecting conversion.");
   }
  };
 }
 if(el("refreshMp3"))el("refreshMp3").onclick=refreshHealth;
 text("uploadIssues","");
 status("GOOGLE DRIVE UPLOADS · Select several tracks with Command-click or Shift-click; they will upload one at a time.");
 refreshHealth();
 list("draft",false);
}
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
