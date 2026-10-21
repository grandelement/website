/* GE iMac uploads. Firefox on OS X El Capitan (ES5 + XMLHttpRequest).
 * Selecting files queues them for review. Only an explicit UPLOAD click sends bytes.
 * BLITZ, BANGERS and Saffire are independent of this local Drive helper.
 */
(function(w,d){
"use strict";
var LOCAL="http://127.0.0.1:8765";
var chosen={draft:[],final:[],session:[]}, activeKind="draft";
var helperOnline=false, encoderAvailable=false, encoderName="", deleteAvailable=false, allFilesAvailable=false;
var mp3TestBusy=false,mp3TestFailed=false,helperVersion=0;
var busy=false, inCheck=false, queue=[], current=null, total=0, finished=0, succeeded=0, failed=0;
var listGeneration=0, uploadPoll=0, issueLines=[], monitorTimer=0, monitorVisible=false, lastProgress=null;
var validExtensions=/\.(mp3|mp4|wav|aif|aiff|m4a|aac|flac|ogg|oga)$/i;
function el(id){return d.getElementById(id)}
function text(id,s){var x=el(id);if(x)x.textContent=String(s===undefined||s===null?"":s)}
function nameOf(kind){return kind==="final"?"Finals":kind==="session"?"Sessions":kind==="all"?"All GE Files":"Drafts"}
function fmtSize(n){return (Number(n||0)/1048576).toFixed(2)+" MB"}
function uploadDisplayName(original){
 var match=/^(.*?)(\\.[^.]+)$/.exec(original||"");if(!match)return original;
 var now=new Date(),day=now.getFullYear()+"-"+("0"+(now.getMonth()+1)).slice(-2)+"-"+("0"+now.getDate()).slice(-2);
 var title=match[1].replace(/^\\d{4}[-_. ]\\d{1,2}[-_. ]\\d{1,2}\\s*[-_ .]+/,"").trim();
 return day+" - "+title+match[2];
}

function wait(fn,ms){return w.setTimeout(fn,ms)}
function monitorShow(){
 var m=el("geUploadMonitor");if(!m)return;
 if(monitorTimer){w.clearTimeout(monitorTimer);monitorTimer=0}
 m.style.display="block";monitorVisible=true;
}
function monitorHideLater(){
 if(monitorTimer)w.clearTimeout(monitorTimer);
 monitorTimer=wait(function(){
  if(busy)return;
  var m=el("geUploadMonitor");if(m)m.style.display="none";
  monitorVisible=false;monitorTimer=0;
  text("geUploadMonitorDetail","");
  text("geUploadMonitorDestination","");
  text("uploadResults","READY · Last upload finished. Choose files and press UPLOAD for the next transfer.");
  var big=el("geUploadBigResult");if(big)big.style.display="none";
  progress(0);
 },14000);
}
function monitorState(state){
 var m=el("geUploadMonitor");if(!m)return;
 m.className="geUploadMonitor geMonitor"+state+(m.parentNode&&m.parentNode.id==="geUploadStrip"?" geDockedMonitor":"");
 text("geUploadMonitorHeadline",state==="Done"?"COMPLETE":state==="Error"?"UPLOAD ERROR":"UPLOADING");
 /* Keep completed state visible until the next upload begins. */
}
function status(s){
 text("uploadResults",s);
 if(!monitorVisible)return;
 var headline=el("geUploadMonitorDetail");
 if(headline)headline.textContent=String(s||"");
}
function monitorStart(kind,count){
 monitorShow();monitorState("Working");
 text("geUploadMonitorDestination",nameOf(kind).toUpperCase()+" · "+count+" FILE"+(count===1?"":"S"));
 progress(null);
}
function monitorError(message){
 monitorShow();monitorState("Error");
 status(message);
}
function monitorFinish(){
 monitorShow();
 if(failed){monitorState("Error");text("geUploadMonitorHeadline",failed+" FAILED · "+succeeded+" UPLOADED")}
 else {progress(100);monitorState("Done");monitorHideLater()}
}

function issue(s){issueLines.push(s);text("uploadIssues",issueLines.join("\n"))}
function progress(value){
 var bar=el("uploadBar");if(!bar)return;
 var topBar=el("geUploadMonitorBar");
 if(topBar){
  topBar.className=value===null?"geUploadMonitorFill geUploadIndeterminate":"geUploadMonitorFill";
  topBar.style.width=value===null?"32%":Math.min(100,Math.max(0,Number(value)||0))+"%";
  topBar.style.marginLeft="0";
 }
 text("geUploadMonitorPercent",value===null?"WORKING":Math.min(100,Math.max(0,Math.round(Number(value)||0)))+"%");

 if(value===null){
  bar.className="geMeterFill geUploadIndeterminate";
  bar.style.width="32%";
  bar.style.marginLeft="";
  bar.setAttribute("aria-valuetext","Working; precise percentage not available");
  bar.removeAttribute("aria-valuenow");
 }else{
  value=Math.min(100,Math.max(0,Number(value)||0));
  bar.className="geMeterFill";
  bar.style.width=value+"%";
  bar.style.marginLeft="0";
  bar.setAttribute("aria-valuenow",String(value));
  bar.setAttribute("aria-valuetext",String(value)+" percent");
 }
}
function linkError(err){
 var code=err&&err.status;
 if(code===0||!code)return "CANNOT REACH THE IMAC UPLOAD HELPER (HTTP 0). "+
  "Firefox could not connect to 127.0.0.1:8765. Check that Terminal still shows "+
  "'GE STUDIOS UPLOAD HELPER READY' and remains open, then press RECHECK IMAC CONNECTION. "+
  "If Terminal is running, browser access to the local helper may be blocked.";
 if(code===409)return "ANOTHER UPLOAD IS IN PROGRESS (409). "+
  "Both GE DJ tabs share one helper. Let the first upload finish; do not retry blindly.";
 return String(err.message||"HTTP "+code);
}
function request(method,path,body,callback){
 var xhr=new XMLHttpRequest(),done=false;
 function complete(err,obj){
  if(done)return;done=true;callback(err,obj||{});
 }
 try{
  xhr.open(method,LOCAL+path,true);
  xhr.timeout=path.indexOf("/health")===0?8500:
    path.indexOf("/files")===0?60000:method==="GET"?30000:0;
  xhr.setRequestHeader("Accept","application/json");
  if(method==="POST"){
   xhr.setRequestHeader("X-GE-Local","1");
   xhr.setRequestHeader("Content-Type",typeof body==="string"?"application/json":
     (body&&body.type||"application/octet-stream"));
  }
  xhr.onreadystatechange=function(){
   if(xhr.readyState!==4)return;
   var obj={};try{obj=JSON.parse(xhr.responseText||"{}")}catch(ignore){}
   if(xhr.status===0){
    var disconnected=new Error("Local helper request failed (HTTP 0)");
    disconnected.status=0;complete(disconnected,obj);return;
   }
   if(xhr.status<200||xhr.status>=300||!obj.ok){
    var problem=new Error(obj.error||"Local helper HTTP "+xhr.status);
    problem.status=xhr.status;complete(problem,obj);return;
   }
   complete(null,obj);
  };
  xhr.onerror=function(){var e=new Error("Local helper connection failed");e.status=0;complete(e)};
  xhr.ontimeout=function(){var e=new Error("Local helper timed out");e.status=0;complete(e)};
 }catch(e){
  e.status=0;
  wait(function(){complete(e)},0);
 }
 return {
  xhr:xhr,
  send:function(){
   try{xhr.send(body===undefined?null:body)}catch(e){
    e.status=0;complete(e);
   }
  }
 };
}
function conversionMode(kind){
 if(kind==="session")return "original";
 var shortName=kind==="draft"?"Draft":"Final";
 var gh=el("githubMp3"+shortName);
 if(gh&&gh.checked)return "github25";
 var standard=el("convert"+shortName);
 return standard&&standard.checked?"320":"original";
}
function conversionModeLabel(mode){
 return mode==="github25"?"GITHUB MP3 · MAX 25 MB (AUTO BITRATE)":
        mode==="320"?"320 KBPS MP3":"KEEP ORIGINAL FORMAT";
}
function selectedLabel(kind){
 var files=chosen[kind],count=files.length,n=0;
 for(var i=0;i<count;i++)n+=files[i].size||0;
 text(kind+"Selection",!count?
  "NO TRACKS SELECTED · Browse to choose one or several tracks.":
  count+" track"+(count===1?"":"s")+" selected · "+fmtSize(n)+" · "+
  (count<=3?files.map(function(f){return f.name}).join(" | "):
  files[0].name+" and "+(count-1)+" more")+
  " · NOTHING HAS BEEN UPLOADED YET");
}
function setBusy(flag){
 busy=!!flag;
 ["fileDraft","fileFinal","fileSession","convertDraft","convertFinal","githubMp3Draft","githubMp3Final","uploadDraft","uploadFinal","uploadSession"].forEach(function(id){
  if(el(id))el(id).disabled=busy;
 });
 if(!busy){
  el("uploadDraft").disabled=!chosen.draft.length;
  el("uploadFinal").disabled=!chosen.final.length;
  if(el("uploadSession"))el("uploadSession").disabled=!chosen.session.length;
 }
}
function resetOldUploadDisplay(){
 if(monitorTimer){w.clearTimeout(monitorTimer);monitorTimer=0}
 monitorVisible=false;
 var m=el("geUploadMonitor");if(m)m.style.display="none";
 var big=el("geUploadBigResult");if(big)big.style.display="none";
 text("geUploadMonitorDetail","");
 progress(0);
}
function pendingMessage(kind){
 var count=chosen[kind].length;
 if(!count)return "READY · Choose files to upload. Nothing is uploading.";
 var mode=conversionMode(kind);
 return "READY TO UPLOAD · "+count+" "+nameOf(kind)+" file"+(count===1?"":"s")+
  " · "+conversionModeLabel(mode)+" · PRESS UPLOAD TO START.";
}
function fileChanged(kind,input){
 if(busy)return;
 resetOldUploadDisplay();
 var files=input.files||[],result=[];
 for(var i=0;i<files.length;i++)result.push(files[i]);
 chosen[kind]=result;
 // Keep the chooser's visible selection synchronized with the pending batch.
 // Clearing input.value made Firefox display "No files selected" while tracks
 // remained queued in memory, an especially confusing experience on El Capitan.
 selectedLabel(kind);
 el(kind==="draft"?"uploadDraft":kind==="final"?"uploadFinal":"uploadSession").disabled=!result.length;
 issueLines=[];text("uploadIssues","");
 progress(0);
 status(pendingMessage(kind));
}
function updateHealth(callback){
 if(inCheck){if(callback)wait(function(){updateHealth(callback)},500);return}
 inCheck=true;
 text("helperStatus","CHECKING LOCAL IMAC CONNECTION…");
 var req=request("GET","/health",null,function(err,data){
  inCheck=false;
  helperOnline=!err&&!!data.rclone_ready;
  encoderAvailable=helperOnline&&!!data.mp3_available;
  helperVersion=Number(data.helper_version||0);
  encoderName=encoderAvailable?String(data.mp3_converter||"MP3 encoder"):"";
  deleteAvailable=helperOnline&&!!data.delete_available;
  allFilesAvailable=helperOnline&&!!data.all_app_files_available;
  var autostart=helperOnline&&!!data.auto_start_configured;
  text("autoRepairState",helperOnline?
   (autostart?"Mac auto-start configuration found. Restart watchdog state not directly verified.":"LOCAL HELPER RUNNING · No automatic startup configuration detected. One-time setup available below."):
   "IMAC HELPER OFFLINE · Browser cannot restart a stopped local program. Install the one-time macOS auto-restart service below.");
  var sessionsReady=helperOnline&&!!data.session_uploads;
  text("sessionHelperStatus",sessionsReady?
   "SESSIONS READY · Archives and project files can upload to GE Studios/Sessions.":
   helperOnline?"SESSIONS NEED UPDATED HELPER · Existing helper supports only Drafts and Finals.":
   "SESSION DRIVE OFFLINE · Use RECONNECT DRIVE to check the uploader.");
  if(err){
   text("helperStatus",linkError(err));
   text("mp3Status","MP3 CONVERSION CANNOT BE VERIFIED · The local upload helper isn't responding. "+
     "LAME was installed earlier; do NOT reinstall it until the connection is restored.");
  }else if(!data.rclone_ready){
   text("helperStatus","HELPER RESPONDS, BUT RCLONE OR GOOGLE DRIVE CONFIG IS MISSING.");
   text("mp3Status","Drive connection needs repair before uploading.");
  }else{
   text("helperStatus","IMAC HELPER CONNECTED · Google Drive ready"+
     (data.helper_version?" · Helper v"+data.helper_version:""));
   text("mp3Status",encoderAvailable?
    "ENCODER DETECTED · "+encoderName+" · Actual conversion NOT YET VERIFIED by this check. Use TEST MP3 CONVERSION.":
    "NO MP3 ENCODER DETECTED · Original-file uploads can still work. Do not select MP3 conversion.");
  }
  if(callback)callback(err,data||{});
 });req.send();
}
function clear(node){while(node&&node.firstChild)node.removeChild(node.firstChild)}
function selectFolder(kind){
 var lookup={draft:"draftUploadCard",final:"finalUploadCard",session:"sessionUploadCard"};
 for(var k in lookup)if(lookup.hasOwnProperty(k)){
  var card=el(lookup[k]);if(card)card.style.display=k===kind?"block":"none";
  var tab=el(k==="draft"?"listDrafts":k==="final"?"listFinals":"listSessions");
  if(tab)tab.className=k===kind?"geSelectedTab":"";
 }
 var allTab=el("listAll");if(allTab)allTab.className=kind==="all"?"geSelectedTab":"";
 var note=el("geAllFilesLimit");if(note)note.style.display=kind==="all"?"block":"none";
}
function displayLibrary(kind){
 activeKind=kind;selectFolder(kind);
 var token=++listGeneration,area=el("musicLibrary");
 text("libraryTitle",kind==="all"?"ALL GE FILES · Available to this uploader":
  "GOOGLE DRIVE · GE Studios / "+nameOf(kind));
 text("libraryStatus","LOADING "+nameOf(kind).toUpperCase()+" FROM GOOGLE DRIVE…");
 if(area)clear(area);
 if(kind==="all"&&!allFilesAvailable){
  text("libraryStatus","ALL GE FILES needs the updated helper. Use the V5 readable-names installer above; Drafts, Finals and Sessions still work.");
  if(area){
   var message=d.createElement("p");
   message.textContent="Use COMPLETE GOOGLE DRIVE to browse everything now. When you're at the iMac, install V5, then restart after finishing uploads to enable this app-created file list.";
   area.appendChild(message);
  }
  return;
 }
 var req=request("GET","/files?kind="+kind,null,function(err,data){
  if(token!==listGeneration)return;
  if(err){
   text("libraryStatus","COULD NOT LOAD "+nameOf(kind).toUpperCase()+" · "+linkError(err));
   if(area){
    var p=d.createElement("p");
    p.textContent="Files have NOT been confirmed missing. Check the Drive connection and retry.";
    area.appendChild(p);
   }
   return;
  }
  var files=data.files||[],isAll=kind==="all";
  text("libraryStatus",files.length+(isAll?" file":" track")+
   (files.length===1?"":"s")+" in "+nameOf(kind)+
   (data.has_more?" · Showing first 1,500":"")+
   (isAll?" · App-accessible files only. Use COMPLETE GOOGLE DRIVE for everything else.":""));
  if(!area)return;
  if(!files.length){
   var empty=d.createElement("p");
   empty.textContent=isAll?"No app-created files found. See COMPLETE GOOGLE DRIVE for all others.":
    "No tracks found in GE Studios/"+nameOf(kind)+".";
   area.appendChild(empty);return;
  }
  for(var i=0;i<files.length;i++)(function(item){
   var row=d.createElement("div");row.className="geMusicFileRow";
   var info=d.createElement("div");info.className="geMusicFileName";
   var title=d.createElement("strong");title.textContent=item.name||"(unnamed)";
   var meta=d.createElement("span");meta.className="geMusicMeta";
   var path=isAll&&item.path?String(item.path):"";
   meta.textContent=(path?path+" · ":"")+fmtSize(item.bytes)+
      (item.modified?" · "+item.modified.substring(0,10):"");
   info.appendChild(title);info.appendChild(meta);row.appendChild(info);
   if(!isAll){
    var del=d.createElement("button");del.type="button";del.className="geDeleteMusic";
    del.textContent=deleteAvailable?"MOVE TO TRASH":"DELETE NEEDS CONNECTED HELPER";
    del.disabled=!deleteAvailable||busy;
    del.onclick=function(){moveToTrash(kind,item,del)};
    row.appendChild(del);
   }
   if(item.id&&/^[A-Za-z0-9_-]{10,}$/.test(item.id)){
    var open=d.createElement("button");open.type="button";
    open.className="geDriveOpen";open.textContent="OPEN IN DRIVE";
    open.onclick=function(){w.open("https://drive.google.com/file/d/"+item.id+"/view","_blank")};
    row.appendChild(open);
    var dl=d.createElement("button");dl.type="button";
    dl.className="geDriveDownload";dl.textContent="DOWNLOAD";
    dl.onclick=function(){w.open("https://drive.google.com/uc?export=download&id="+item.id,"_blank")};
    row.appendChild(dl);
   }
   area.appendChild(row);
  })(files[i]);
 });req.send();
}
function moveToTrash(kind,item,button){
 if(busy||!deleteAvailable)return;
 if(!w.confirm("Move this file from Google Drive "+nameOf(kind)+" to Trash?\n\n"+
  String(item.name||"")+"\n\nThe original on your iMac stays untouched."))return;
 button.disabled=true;
 text("libraryStatus","MOVING TO DRIVE TRASH · "+item.name);
 var req=request("POST","/delete",JSON.stringify({kind:kind,name:item.name}),function(err){
  if(err){
   button.disabled=false;text("libraryStatus","DELETE NOT CONFIRMED · "+linkError(err));
  }else displayLibrary(kind);
 });req.send();
}
function checkSelected(kind,mode){
 var files=chosen[kind];
 for(var i=0;i<files.length;i++){
  var f=files[i],name=f.name||"";
  if(kind!=="session"&&!validExtensions.test(name))return "Unsupported audio format: "+name;
  if(!f.size||f.size>4*1024*1024*1024)return "File size invalid: "+name;
  if(mode!=="original"&&encoderName.indexOf("LAME")>=0&&!/\.(wav|aif|aiff|mp3)$/i.test(name))
   return "LAME converts WAV/AIFF only. "+name+" requires FFmpeg or upload unchanged.";
  if(mode==="github25"&&encoderName.indexOf("LAME")>=0&&/\.mp3$/i.test(name)&&f.size>=25000000)
   return "MP3 files over 25 MB require FFmpeg to be converted. LAME cannot decode MP3.";

 }
 return "";
}
function uploadChosen(kind){
 if(busy){status("An upload is already running in this tab.");return}
 if(!chosen[kind].length){status("BROWSE FIRST · Choose one or several "+nameOf(kind)+" tracks.");return}
 var mode=conversionMode(kind),convert=mode==="320",github25=mode==="github25";
 monitorStart(kind,chosen[kind].length);
 status("CHECKING IMAC HELPER before starting "+nameOf(kind)+" upload…");
 updateHealth(function(err,data){
  if(err||!data.rclone_ready){
   monitorError("NO FILES UPLOADED · "+(err?linkError(err):"Drive is not ready on this Mac.")+
     " Files remain selected for retry.");
   return;
  }
  if(github25&&helperVersion<7){
   monitorError("NO FILES UPLOADED · GitHub MP3 needs iMac uploader v7. "+
    "Update the local helper first. Songs remain selected and unchanged.");return;
  }
  var fitsUnchanged=github25&&chosen[kind].every(function(item){
   return /\.mp3$/i.test(item.name||"")&&item.size<25000000
  });
  if((mode!=="original"&&mp3TestFailed)||((convert||github25&&!fitsUnchanged)&&!encoderAvailable)){
   monitorError("NO FILES UPLOADED · MP3 conversion is not ready. "+
    (mp3TestFailed?"The conversion test failed. Retest after repairing the encoder.":
     "No compatible encoder was detected on this iMac.")+
    " Files remain selected; Original Format remains available.");return;
  }
  var invalid=checkSelected(kind,mode);
  if(invalid){monitorError("NO FILES UPLOADED · "+invalid);return}
  issueLines=[];text("uploadIssues","");
  queue=chosen[kind].slice(0);current=null;
  total=queue.length;finished=0;succeeded=0;failed=0;
  setBusy(true);progress(null);
  status("STARTING "+total+" "+nameOf(kind).toUpperCase()+
   " TRACK"+(total===1?"":"S")+" · "+conversionModeLabel(mode));
  uploadNext(kind,mode);
 });
}
function removeChosen(kind,file){
 var saved=chosen[kind];
 for(var i=0;i<saved.length;i++){if(saved[i]===file){saved.splice(i,1);break}}
 if(!saved.length){
  var input=el(kind==="draft"?"fileDraft":kind==="final"?"fileFinal":"fileSession");
  if(input)try{input.value=""}catch(ignore){}
 }
 selectedLabel(kind);
}
function stopBatch(kind,message){
 queue=[];current=null;setBusy(false);progress(0);
 monitorError(message+" · Files not confirmed uploaded remain selected. "+
  "Check MY "+nameOf(kind).toUpperCase()+" before retrying to avoid duplicates.");
}
function uploadNext(kind,mode){
 var convert=mode==="320",github25=mode==="github25";
 if(!queue.length){
  current=null;setBusy(false);
  progress(failed?0:100);
  status("QUEUE FINISHED · "+succeeded+" uploaded · "+failed+" failed. "+
   "Files confirmed uploaded were removed from the selection. Originals on this iMac remain unchanged.");
  monitorFinish();
  displayLibrary(kind);return;
 }
 current=queue.shift();
 var item=current,file=item,number=finished+1,started=Date.now();
 var cloudName=uploadDisplayName(file.name);
 var path="/upload?kind="+kind+"&name="+encodeURIComponent(cloudName)+
  "&convert="+(convert?"1":"0")+(github25?"&mp3_mode=github25":"");
 status("TRACK "+number+"/"+total+" · SENDING TO IMAC · "+file.name);
 progress(null);
 var req=request("POST",path,file,function(err,data){
  if(err){
   failed++;finished++;
   issue("TRACK "+number+": "+file.name+" · "+linkError(err));
   if(!err.status||err.status===0||err.status===409){
    stopBatch(kind,"UPLOAD NOT CONFIRMED · "+linkError(err));return;
   }
   wait(function(){uploadNext(kind,mode)},120);return;
  }
  if(!data.id){
   failed++;finished++;stopBatch(kind,"UPLOAD NOT CONFIRMED · No job ID returned.");return;
  }
  progress(null);
  status("TRACK "+number+"/"+total+" · FILE RECEIVED BY IMAC · "+
   (mode==="original"?"":"MP3 processing / ")+"Preparing Google Drive upload…");
  pollJob(kind,mode,item,number,started,data.id);
 });
 req.xhr.upload.onprogress=function(e){
  if(e.lengthComputable){
   var pct=Math.min(99,Math.round(e.loaded/Math.max(e.total,1)*100));
   progress(pct);
   status("TRACK "+number+"/"+total+" · SENDING FILE TO LOCAL IMAC HELPER · "+
    pct+"% · "+file.name);
  }
 };
 req.send();
}
function pollJob(kind,mode,item,number,started,id){
 var convert=mode==="320",github25=mode==="github25";
 if(uploadPoll)w.clearTimeout(uploadPoll);
 uploadPoll=wait(function(){
  var req=request("GET","/status?id="+encodeURIComponent(id),null,function(err,data){
   if(err){
    stopBatch(kind,"UPLOAD STATUS UNKNOWN · "+linkError(err));return;
   }
   var job=data.job||{};
   if(job.phase==="complete"){
    if(github25&&(!job.file_size_bytes||Number(job.file_size_bytes)>=25000000||!/\.mp3$/i.test(job.name||""))){
     finished++;failed++;
     issue("GITHUB MP3 UPLOAD COULD NOT BE VERIFIED · Check Google Drive before retrying "+item.name);
     wait(function(){uploadNext(kind,mode)},300);return;
    }
    finished++;succeeded++;removeChosen(kind,item);progress(100);
    var detail=github25?"GitHub MP3 "+(Number(job.file_size_bytes)/1000000).toFixed(2)+
       " MB · "+(job.mp3_bitrate_kbps?job.mp3_bitrate_kbps+" kbps":"ORIGINAL MP3 PRESERVED"):
      convert&&!/\.mp3$/i.test(String(item.name||""))&&/\.mp3$/i.test(String(job.name||""))?
       "MP3 conversion confirmed":"Original file confirmed";
    status("TRACK "+number+"/"+total+" COMPLETE · "+detail+" · Google Drive verified · "+(job.name||item.name));
    wait(function(){uploadNext(kind,mode)},300);return;
   }
   if(job.phase==="error"){
    finished++;failed++;
    issue(item.name+" · "+(job.detail||"Google Drive upload failed"));
    progress(0);
    wait(function(){uploadNext(kind,mode)},300);return;
   }
   var pct=Number(job.percent||0);
   progress(pct>0&&pct<100?pct:null);
   var stage=job.phase==="converting"?"CONVERTING TO MP3":
    job.phase==="uploading"?"UPLOADING TO GOOGLE DRIVE":"PREPARING";
   status("TRACK "+number+"/"+total+" · "+stage+" · "+
    (pct>0&&pct<100?pct+"%":"WORKING; EXACT % UNAVAILABLE")+
    (github25&&job.phase==="converting"&&job.detail?" · "+job.detail:"")+
    " · "+Math.floor((Date.now()-started)/1000)+"s · "+item.name);
   pollJob(kind,mode,item,number,started,id);
  });req.send();
 },1700);
}
function installDrop(kind){
 var zone=el("drop"+kind.charAt(0).toUpperCase()+kind.slice(1));
 if(!zone||!zone.addEventListener)return;
 zone.addEventListener("dragover",function(e){
  e.preventDefault();zone.className="geDropZone geDragOver";
 });
 zone.addEventListener("dragleave",function(e){
  e.preventDefault();zone.className="geDropZone";
 });
 zone.addEventListener("drop",function(e){
  e.preventDefault();zone.className="geDropZone";
  if(busy)return;
  var list=e.dataTransfer&&e.dataTransfer.files||[],files=[];
  for(var i=0;i<list.length;i++)files.push(list[i]);
  if(!files.length){
   status("THIS FIREFOX CANNOT DROP THAT FOLDER DIRECTLY · Select multiple individual files, or compress the whole Ableton project folder as a ZIP and drop the ZIP.");
   return;
  }
  resetOldUploadDisplay();
  chosen[kind]=files;selectedLabel(kind);
  el(kind==="draft"?"uploadDraft":kind==="final"?"uploadFinal":"uploadSession").disabled=false;
  issueLines=[];text("uploadIssues","");
  status(pendingMessage(kind));
 });
}
function init(){
 if(!el("fileDraft")||!el("fileFinal")||!el("fileSession"))return;
 el("fileDraft").onchange=function(){fileChanged("draft",this)};
 el("fileFinal").onchange=function(){fileChanged("final",this)};
 el("fileSession").onchange=function(){fileChanged("session",this)};
 el("uploadDraft").onclick=function(){uploadChosen("draft")};
 el("uploadFinal").onclick=function(){uploadChosen("final")};
 el("uploadSession").onclick=function(){uploadChosen("session")};
 el("listDrafts").onclick=function(){displayLibrary("draft")};
 el("listFinals").onclick=function(){displayLibrary("final")};
 el("listSessions").onclick=function(){displayLibrary("session")};
 if(el("listAll"))el("listAll").onclick=function(){displayLibrary("all")};
 installDrop("draft");installDrop("final");installDrop("session");
 el("refreshMp3").onclick=function(){updateHealth()};
 if(el("testMp3Converter"))el("testMp3Converter").onclick=testMp3Converter;
 ["draft","final"].forEach(function(kind){
  var name=kind==="draft"?"Draft":"Final";
  var standard=el("convert"+name),github=el("githubMp3"+name);
  if(standard)standard.onchange=function(){
   if(standard.checked&&github)github.checked=false;
   if(!busy)status(pendingMessage(kind));
  };
  if(github)github.onchange=function(){
   if(github.checked&&standard)standard.checked=false;
   if(!busy)status(pendingMessage(kind));
  };
 });
 if(el("retryHelper"))el("retryHelper").onclick=function(){
  updateHealth(function(err){if(!err)displayLibrary(activeKind)});
 };
 el("convertDraft").checked=false;el("convertFinal").checked=false;
 el("githubMp3Draft").checked=false;el("githubMp3Final").checked=false;
 selectedLabel("draft");selectedLabel("final");selectedLabel("session");
 selectFolder("draft");
 setBusy(false);progress(0);
 status("READY · SELECT FILES → CHOOSE MP3 OR ORIGINAL → PRESS UPLOAD. FILE SELECTION NEVER UPLOADS.");
 updateHealth(function(err){if(!err)displayLibrary("draft")});
 // The old iMac can lose its manually started uploader while Firefox stays
 // open. Automatically recheck every 20 seconds with no Terminal commands or
 // extra clicking. Never run an automatic probe during an active upload.
 if(w.setInterval)w.setInterval(function(){
  if(busy||inCheck)return;
  var wasOnline=helperOnline;
  updateHealth(function(err){
   if(!err&&helperOnline&&!wasOnline)displayLibrary(activeKind);
   text("autoCheckStatus",helperOnline?
    "AUTOMATIC CHECK · iMac uploader detected · Ready for selected music files.":
    "AUTOMATIC CHECK · iMac uploader still unreachable. Use ONE-CLICK LOCAL HELPER TEST to tell whether it is running.");
  });
 },20000);
}
function testMp3Converter(){
 if(mp3TestBusy||busy)return;
 mp3TestBusy=true;
 var b=el("testMp3Converter");if(b){b.disabled=true;b.textContent="TESTING MP3…"}
 text("geMp3TestResult","RUNNING LOCAL MP3 CONVERSION TEST · No song or Google Drive file will be changed.");
 var req=request("GET","/mp3-test",null,function(err,data){
  mp3TestBusy=false;
  if(b){b.disabled=false;b.textContent="TEST MP3 CONVERSION"}
  if(err){
   text("geMp3TestResult",err.status===404?
    "MP3 TEST NOT AVAILABLE · Installed iMac helper is older than v6. Update the helper to use the safe test.":
    "MP3 TEST COULD NOT RUN · "+linkError(err));
   return;
  }
  mp3TestFailed=!data.passed;
  text("geMp3TestResult",data.passed?
   "PASS · "+(data.encoder||"MP3 encoder")+" encoded a small local WAV into an MP3. No upload was made. Actual music still needs its own check.":
   "FAIL · "+(data.reason||"Encoder did not generate a valid MP3.")+" · Original uploads are unaffected.");
 });
 req.send();
}
/* Public read-only file-browser refresh for the iMac Google tab. */
w.GEImacUploads={
 refreshFiles:function(){displayLibrary(activeKind)},
 clearFinishedDisplay:function(){
  if(busy){status("UPLOAD STILL RUNNING · Cannot clear progress until this transfer completes.");return false}
  if(monitorTimer){w.clearTimeout(monitorTimer);monitorTimer=0}
  monitorVisible=false;
  var m=el("geUploadMonitor");if(m)m.style.display="none";
  current=null;queue=[];progress(0);
  text("uploadIssues","");
  text("uploadResults","READY · Previous transfer display cleared. No files were deleted or uploads canceled.");
  var summary=el("geUploadBigResult");if(summary)summary.style.display="none";
  return true
 }
};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);
else init();
})(window,document);
