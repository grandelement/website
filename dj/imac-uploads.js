/* GE iMac uploads. Firefox on OS X El Capitan (ES5 + XMLHttpRequest).
 * Selecting files queues them for review. Only an explicit UPLOAD click sends bytes.
 * BLITZ, BANGERS and Saffire are independent of this local Drive helper.
 */
(function(w,d){
"use strict";
var LOCAL="http://127.0.0.1:8765";
var chosen={draft:[],final:[],radio:[],session:[]}, activeKind="draft";
var audioKinds=["draft","final","radio"];
var helperOnline=false, encoderAvailable=false, encoderName="", deleteAvailable=false, allFilesAvailable=false, editFilesAvailable=false;
var helperVersion=0;
var busy=false, inCheck=false, queue=[], current=null, total=0, finished=0, succeeded=0, failed=0;
var listGeneration=0, uploadPoll=0, issueLines=[], monitorTimer=0, monitorVisible=false, lastProgress=null;
var validExtensions=/\.(mp3|mp4|wav|aif|aiff|m4a|aac|flac|ogg|oga)$/i;
function el(id){return d.getElementById(id)}
function text(id,s){var x=el(id);if(x)x.textContent=String(s===undefined||s===null?"":s)}
function nameOf(kind){return kind==="final"?"Finals":kind==="radio"?"Radio":kind==="session"?"Sessions":kind==="all"?"All GE Files":"Drafts"}
function fmtSize(n){return (Number(n||0)/1048576).toFixed(2)+" MB"}
function uploadDisplayName(file){
 return w.GEImacUploadSettings?w.GEImacUploadSettings.nameFor(file):file.name;
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
 progress(0);
 text("geUploadMonitorPercent","STOPPED");
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
 var shortName=kind==="draft"?"Draft":kind==="radio"?"Radio":"Final";
 
 var standard=el("convert"+shortName);
 return standard&&standard.checked?"320":"original";
}
function conversionModeLabel(mode){
 return mode==="320"?"320 KBPS MP3":"KEEP ORIGINAL FORMAT";
}
function selectedLabel(kind){
 var files=chosen[kind],count=files.length,n=0;
 for(var i=0;i<count;i++)n+=files[i].size||0;
 text(kind+"Selection",!count?"":count+" SELECTED · "+fmtSize(n)+" · "+
  (count<=2?files.map(function(f){return f.name}).join(" | "):
   files[0].name+" + "+(count-1)+" more"));
}
function syncAudioFiles(files){
 // Same authorized File objects can be uploaded to any audio destination.
 for(var ai=0;ai<audioKinds.length;ai++){
  var k=audioKinds[ai];chosen[k]=files.slice(0);selectedLabel(k);
 }
 if(w.GEImacUploadSettings)w.GEImacUploadSettings.refreshPreview();
 setBusy(busy);
}
function placeAudioChooser(kind){
 if(kind!=="draft"&&kind!=="final"&&kind!=="radio")return;
 var input=el("fileDraft"),zone=el("drop"+kind.charAt(0).toUpperCase()+kind.slice(1));
 if(input&&zone&&input.parentNode!==zone)zone.appendChild(input);
}
function setBusy(flag){
 busy=!!flag;
 ["fileDraft","fileFinal","fileRadio","fileSession","convertDraft","convertFinal","convertRadio","uploadDraft","uploadFinal","uploadRadio","uploadSession"].forEach(function(id){
  if(el(id))el(id).disabled=busy;
 });
 if(!busy){
  el("uploadDraft").disabled=!chosen.draft.length;
  el("uploadFinal").disabled=!chosen.final.length;
  if(el("uploadRadio"))el("uploadRadio").disabled=!chosen.radio.length;
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
 if(!count)return "READY";
 return nameOf(kind).toUpperCase()+" · "+count+" SELECTED · "+conversionModeLabel(conversionMode(kind));
}
function fileChanged(kind,input){
 if(busy)return;
 resetOldUploadDisplay();
 var files=input.files||[],result=[];
 for(var i=0;i<files.length;i++)result.push(files[i]);
 if(kind==="session"){
  chosen.session=result;selectedLabel("session");
  if(w.GEImacUploadSettings)w.GEImacUploadSettings.refreshPreview();
 }else{
  syncAudioFiles(result);
  kind=(activeKind==="final"||activeKind==="radio")?activeKind:"draft";
 }
 setBusy(false);
 issueLines=[];text("uploadIssues","");
 progress(0);
 status(pendingMessage(kind));
}

var reconnectPoll=0,reconnectBusy=false;
function reconnectMessage(value){text("driveAuthStatus",value)}
function stopReconnect(){
 if(reconnectPoll){w.clearInterval(reconnectPoll);reconnectPoll=0}
 reconnectBusy=false;if(el("reconnectDriveAuth"))el("reconnectDriveAuth").disabled=false;
}
function pollReconnect(){
 var q=request("GET","/drive/reconnect/status",null,function(err,result){
  if(err){stopReconnect();reconnectMessage("GOOGLE SIGN IN STATUS UNAVAILABLE · "+linkError(err));return}
  var state=result.state||{},phase=String(state.phase||"");
  reconnectMessage(String(state.detail||"Waiting for Google sign-in…"));
  if(phase==="complete"){stopReconnect();updateHealth(function(e){if(!e)displayLibrary(activeKind)})}
  else if(phase==="error"||phase==="idle")stopReconnect();
 });q.send();
}
function downloadOfflineRepair(){
 var link=el("geDriveRepairDownload");
 if(!link){reconnectMessage("OFFLINE REPAIR DOWNLOAD IS UNAVAILABLE.");return}
 reconnectMessage("FIRST SETUP: Open the ZIP in Downloads. Control-click GE Studios OFFLINE Repair.app, choose Open, then Update. Return here and press FIX GOOGLE DRIVE again.");
 // Download only; Firefox cannot install software on macOS.
 w.location.href=link.href;
}
function reconnectGoogle(){
 if(busy){reconnectMessage("FINISH THE CURRENT UPLOAD FIRST.");return}
 if(reconnectBusy)return;
 // Existing Helper V3 lacks the local reconnect endpoint.
 if(helperVersion>0&&helperVersion<10){downloadOfflineRepair();return}
 reconnectMessage("CHECKING GOOGLE DRIVE CONNECTION…");
 updateHealth(function(err,result){
  if(err){reconnectMessage("IMAC HELPER NOT RESPONDING. See ADVANCED for checks.");return}
  if(Number(result.helper_version||0)<8||!result.drive_reconnect_available){
   downloadOfflineRepair();return;
  }
  if(!w.confirm("Reconnect Google Drive? Google sign-in may open on this iMac. No music files will be changed."))return;
  reconnectBusy=true;el("reconnectDriveAuth").disabled=true;
  reconnectMessage("STARTING GOOGLE SIGN-IN…");
  var req=request("POST","/drive/reconnect","{}",function(error,data){
   if(error){stopReconnect();reconnectMessage("GOOGLE SIGN-IN COULD NOT START · "+linkError(error));return}
   reconnectMessage(String(data.detail||"Complete sign-in in the iMac browser."));
   reconnectPoll=w.setInterval(pollReconnect,2500);pollReconnect();
  });req.send();
 });
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
  // FIX changes from a one-time installer to direct Google sign-in.
  var primary=el("reconnectDriveAuth");if(primary)primary.textContent="FIX GOOGLE DRIVE";
  var repair=el("geDriveRepairDownload");
  if(repair)repair.style.display=helperVersion>=10?"none":"inline-block";
  encoderName=encoderAvailable?String(data.mp3_converter||"MP3 encoder"):"";
  deleteAvailable=helperOnline&&!!data.delete_available;
  editFilesAvailable=helperOnline&&!!data.rename_available&&!!data.copy_to_folder;
  allFilesAvailable=helperOnline&&!!data.all_app_files_available;
  var autostart=helperOnline&&!!data.auto_start_configured;
  text("autoRepairState",helperOnline?
   (autostart?"Mac auto-start configuration found. Restart watchdog state not directly verified.":"LOCAL HELPER RUNNING · No automatic startup configuration detected. One-time setup available below."):
   "IMAC HELPER OFFLINE · Browser cannot restart a stopped local program. Install the one-time macOS auto-restart service below.");
  var sessionsReady=helperOnline&&!!data.session_uploads;
  text("sessionHelperStatus",sessionsReady?"SESSIONS READY":
   helperOnline?"SESSIONS · HELPER V8 REQUIRED":"SESSIONS · DRIVE OFFLINE");
  if(err){
   text("helperStatus",linkError(err));
   text("mp3Status","MP3 CONVERSION CANNOT BE VERIFIED · The local upload helper isn't responding. "+
     "LAME was installed earlier; do NOT reinstall it until the connection is restored.");
  }else if(!data.rclone_ready){
   text("helperStatus","HELPER RESPONDS, BUT RCLONE OR GOOGLE DRIVE CONFIG IS MISSING.");
   text("mp3Status","Drive connection needs repair before uploading.");
  }else{
   text("helperStatus",helperVersion<10?
     "HELPER V"+helperVersion+" · UPDATE TO V10 FOR NAMING & FILE ACTIONS":
     "HELPER V10 · NAMING / RADIO / RENAME AVAILABLE");
   text("mp3Status",encoderAvailable?
    "ENCODER DETECTED · "+encoderName+" · Actual conversion NOT YET VERIFIED by this check. Use TEST MP3 CONVERSION.":
    "NO MP3 ENCODER DETECTED · Original-file uploads can still work. Do not select MP3 conversion.");
  }
  if(callback)callback(err,data||{});
 });req.send();
}
function clear(node){while(node&&node.firstChild)node.removeChild(node.firstChild)}
function selectFolder(kind){
 placeAudioChooser(kind);
 var lookup={draft:"draftUploadCard",final:"finalUploadCard",radio:"radioUploadCard",session:"sessionUploadCard"};
 for(var k in lookup)if(lookup.hasOwnProperty(k)){
  var card=el(lookup[k]);if(card)card.style.display=k===kind?"flex":"none";
  var tab=el(k==="draft"?"listDrafts":k==="final"?"listFinals":k==="radio"?"listRadio":"listSessions");
  if(tab)tab.className=k===kind?"geSelectedTab":"";
 }
 var allTab=el("listAll");if(allTab)allTab.className=kind==="all"?"geSelectedTab":"";
 var targets=d.querySelectorAll(".geUploadTarget");
 for(var i=0;i<targets.length;i++){
  var selected=targets[i].getAttribute("data-upload-kind")===kind;
  targets[i].className=selected?"geUploadTarget geSelectedTarget":"geUploadTarget";
  targets[i].setAttribute("aria-pressed",selected?"true":"false");
 }
 var note=el("geAllFilesLimit");if(note)note.style.display=kind==="all"?"block":"none";
}
function displayLibrary(kind){
 activeKind=kind;selectFolder(kind);
 var token=++listGeneration,area=el("musicLibrary");
 text("libraryTitle",kind==="all"?"ALL GE FILES":"GE STUDIOS / "+nameOf(kind).toUpperCase());
 text("libraryStatus","LOADING "+nameOf(kind).toUpperCase()+" FROM GOOGLE DRIVE…");
 if(area)clear(area);
 if(kind==="all"&&!allFilesAvailable){
  text("libraryStatus","ALL GE FILES · Helper V8 required.");
  if(area){
   var message=d.createElement("p");
   message.textContent="Open COMPLETE GOOGLE DRIVE for all files.";
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
  var page=0,pageSize=Math.max(4,Math.min(9,Math.floor((w.innerHeight-345)/43)));
  var folderTabs=el("musicLibraryPanel").querySelector(".geFolderTabs");
  var pager=el("geFilesPager");
  if(!pager&&folderTabs){pager=d.createElement("span");pager.id="geFilesPager";pager.className="geFilesPager";folderTabs.appendChild(pager);}
  function paint(){
    clear(area);
    var pages=Math.max(1,Math.ceil(files.length/pageSize));
    page=Math.min(pages-1,Math.max(0,page));
    if(pager){
      clear(pager);
      var prev=d.createElement("button");prev.type="button";prev.textContent="PREV";prev.disabled=page===0;
      prev.onclick=function(){page--;paint()};pager.appendChild(prev);
      var num=d.createElement("span");num.textContent=(page+1)+"/"+pages;pager.appendChild(num);
      var next=d.createElement("button");next.type="button";next.textContent="NEXT";
      next.disabled=page>=pages-1;next.onclick=function(){page++;paint()};pager.appendChild(next);
    }
    for(var i=page*pageSize;i<Math.min(files.length,(page+1)*pageSize);i++)(function(item){
   var row=d.createElement("div");row.className="geMusicFileRow";
   var info=d.createElement("div");info.className="geMusicFileName";
   var title=d.createElement("strong");title.textContent=item.name||"(unnamed)";
   var meta=d.createElement("span");meta.className="geMusicMeta";
   var path=isAll&&item.path?String(item.path):"";
   meta.textContent=(path?path+" · ":"")+fmtSize(item.bytes)+
      (item.modified?" · "+item.modified.substring(0,10):"");
   info.appendChild(title);info.appendChild(meta);row.appendChild(info);
   if(!isAll&&editFilesAvailable){
     var rename=d.createElement("button");rename.type="button";rename.className="geRenameMusic";
     rename.textContent="RENAME";rename.onclick=function(){renameMusic(kind,item)};
     row.appendChild(rename);
     var toKind=kind==="final"?"radio":"final";
     var copy=d.createElement("button");copy.type="button";copy.className="geCopyMusic";
     copy.textContent=toKind==="final"?"TO FINALS":"TO RADIO";
     copy.onclick=function(){copyMusic(kind,toKind,item)};row.appendChild(copy);
   }
   if(!isAll){
    var del=d.createElement("button");del.type="button";del.className="geDeleteMusic";
    del.textContent=deleteAvailable?"MOVE TO TRASH":"DELETE NEEDS CONNECTED HELPER";
    del.disabled=!deleteAvailable||busy;
    del.onclick=function(){moveToTrash(kind,item,del)};
    row.appendChild(del);
   }
   if(item.id&&/^[A-Za-z0-9_-]{10,}$/.test(item.id)){
    var open=d.createElement("a");
    open.className="geDriveOpen";open.textContent="OPEN IN DRIVE";
    open.href="https://drive.google.com/file/d/"+encodeURIComponent(item.id)+"/view";
    open.target="_blank";open.rel="noopener noreferrer";
    row.appendChild(open);
    var dl=d.createElement("a");
    dl.className="geDriveDownload";dl.textContent="DOWNLOAD";
    dl.href="https://drive.google.com/uc?export=download&id="+encodeURIComponent(item.id);
    dl.target="_blank";dl.rel="noopener noreferrer";
    row.appendChild(dl);
   }
   area.appendChild(row);
  })(files[i]);
  }
  paint();
 });req.send();
}
function renameMusic(kind,item){
 if(busy||!editFilesAvailable)return;
 var current=item.name||"";
 var desired=w.prompt("Rename Google Drive file:",current);
 if(desired===null||desired===current)return;
 desired=String(desired).trim();
 if(!desired||/[\\/\r\n]/.test(desired)){status("INVALID FILE NAME");return}
 if(!w.confirm("Rename in GE Studios/"+nameOf(kind)+"?\n"+current+"\nTO\n"+desired+"\n\nPlaylist references are not automatically updated."))return;
 var req=request("POST","/rename",JSON.stringify({kind:kind,name:current,new_name:desired}),function(err,result){
  if(err){status("RENAME FAILED · "+linkError(err));return}
  status("RENAMED · "+result.name);displayLibrary(kind);
 });req.send();
}
function copyMusic(kind,target,item){
 if(busy||!editFilesAvailable)return;
 if(!w.confirm("Copy "+item.name+" to "+nameOf(target)+"?\nThe original remains unchanged."))return;
 var req=request("POST","/copy-to",JSON.stringify({kind:kind,target_kind:target,name:item.name}),function(err,result){
  if(err){status("COPY FAILED · "+linkError(err));return}
  status("COPIED · "+result.name);displayLibrary(target);
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

 }
 return "";
}
function uploadChosen(kind){
 if(busy){status("An upload is already running in this tab.");return}
 if(!chosen[kind].length){status("BROWSE FIRST · Choose one or several "+nameOf(kind)+" tracks.");return}
 // A preflight failure never transferred audio; do not show a red UPLOAD ERROR.
 resetOldUploadDisplay();
 var mode=conversionMode(kind),convert=mode==="320";
 status("CHECKING IMAC HELPER before starting "+nameOf(kind)+" upload…");
 updateHealth(function(err,data){
  if(err||(kind!=="radio"&&!data.rclone_ready)){
   status("UPLOAD NOT STARTED · "+(err?linkError(err):"Drive configuration unavailable on this Mac.")+
     " No audio was sent. The selected files remain on this Mac.");
   return;
  }
  if(helperVersion<10||!data.filename_options_v2){
   status("UPLOAD NOT STARTED · HELPER V10 REQUIRED. Open STATUS to repair the iMac helper.");
   return;
  }
  var preset=w.GEImacUploadSettings;
  if(kind!=="session"&&preset){
   var format=preset.pendingMode?preset.pendingMode():"";
   if(format&&format!==kind&&format!=="custom"&&
      !w.confirm("DESTINATION: "+nameOf(kind).toUpperCase()+
       "\nFILENAME FORMAT: "+format.toUpperCase()+
       "\n\nUse this different filename format? Cancel to choose the matching format in METADATA.")){
      status("UPLOAD NOT STARTED · Choose the matching filename format in METADATA.");return;
   }
   // One explicit upload click can safely save the pending filename settings.
   if(preset.hasUnsaved()&&(!preset.savePending||!preset.savePending())){
    status("UPLOAD NOT STARTED · METADATA cannot be saved in this Firefox. No audio sent.");
    return;
   }
  }
  if(convert&&!encoderAvailable){
   status("UPLOAD NOT STARTED · MP3 conversion is unavailable. Select original format or repair the encoder.");return;
  }
  var invalid=checkSelected(kind,mode);
  if(!invalid&&kind!=="session"&&w.GEImacUploadSettings){
    for(var si=0;si<chosen[kind].length;si++){
      invalid=w.GEImacUploadSettings.validate(chosen[kind][si]);if(invalid)break;
    }
  }
  if(invalid){status("UPLOAD NOT STARTED · "+invalid);return}
  // Never send a large original recording just to discover that FFmpeg is missing.
  // Preserve the selected metadata preset; never silently drop requested tags.
  if(kind!=="session"&&encoderName.indexOf("FFmpeg")<0&&preset){
   for(var pi=0;pi<chosen[kind].length;pi++){
    var pendingFile=chosen[kind][pi],isMp3=/\.mp3$/i.test(pendingFile.name||"");
    var tags=preset.tagsFor?preset.tagsFor(pendingFile):{},hasTags=false;
    for(var tagName in tags)if(tags.hasOwnProperty(tagName)){hasTags=true;break}
    if(hasTags&&(mode==="original"||isMp3)){
     status("UPLOAD NOT STARTED · This iMac needs FFmpeg to embed selected tags into original audio. "+
      "In METADATA, uncheck EMBED CHECKED TAGS to upload the unchanged original AIFF/WAV/MP3, "+
      "or install FFmpeg for embedded tags. No audio sent.");
     return;
    }
    if(mode==="320"&&hasTags&&(tags.composer||tags.copyright||tags.album_artist)){
     status("UPLOAD NOT STARTED · Selected composer/copyright tags require FFmpeg. "+
      "Turn off those embedded tags or install FFmpeg. No audio sent.");
     return;
    }
   }
   if(kind==="final"&&preset.coverFor&&preset.coverFor()){
    status("UPLOAD NOT STARTED · Embedded cover art needs FFmpeg. "+
     "Turn off cover art in METADATA or install FFmpeg. No audio sent.");
    return;
   }
  }
  issueLines=[];text("uploadIssues","");
  queue=chosen[kind].slice(0);current=null;
  total=queue.length;finished=0;succeeded=0;failed=0;
  monitorStart(kind,total);
  setBusy(true);progress(null);
  status("STARTING "+total+" "+nameOf(kind).toUpperCase()+
   " TRACK"+(total===1?"":"S")+" · "+conversionModeLabel(mode));
  uploadNext(kind,mode);
 });
}
function removeChosen(kind,file){
 var kinds=kind==="session"?["session"]:audioKinds;
 for(var ki=0;ki<kinds.length;ki++){
  var group=kinds[ki],saved=chosen[group];
  for(var i=0;i<saved.length;i++){if(saved[i]===file){saved.splice(i,1);break}}
  selectedLabel(group);
 }
 if(!chosen[kind].length){
  var input=el(kind==="session"?"fileSession":"fileDraft");
  if(input)try{input.value=""}catch(ignore){}
 }
 if(w.GEImacUploadSettings)w.GEImacUploadSettings.refreshPreview();
}
function stopBatch(kind,message){
 queue=[];current=null;setBusy(false);progress(0);
 monitorError(message+" · Files not confirmed uploaded remain selected. "+
  "Check MY "+nameOf(kind).toUpperCase()+" before retrying to avoid duplicates.");
}
function uploadNext(kind,mode){
 var convert=mode==="320";
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
 var cloudName=kind==="session"?file.name:uploadDisplayName(file);
 var metadata=kind==="session"?{}:(w.GEImacUploadSettings?w.GEImacUploadSettings.tagsFor(file):{});
 var path="/upload?kind="+kind+"&name="+encodeURIComponent(cloudName)+
  "&convert="+(convert?"1":"0")+"&format=2&metadata="+encodeURIComponent(JSON.stringify(metadata));
 status("TRACK "+number+"/"+total+" · SENDING TO IMAC · "+file.name);
 progress(null);
 function sendAudioUpload(){
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
 var cover=kind==="final"&&w.GEImacUploadSettings?w.GEImacUploadSettings.coverFor():null;
 function coverFailed(message){
  failed++;finished++;issue("COVER: "+message);
  stopBatch(kind,"COVER NOT ATTACHED · Upload cancelled · "+message);
 }
 function stageCover(blob){
  if(!blob||!blob.size||blob.size>8*1024*1024){
   coverFailed("Selected cover is empty or larger than 8 MB.");return;
  }
  var art=request("POST","/cover",blob,function(err,data){
   if(err||!data.cover_token){
    coverFailed(linkError(err||new Error("Cover was not received")));return;
   }
   path+="&cover="+encodeURIComponent(data.cover_token);
   sendAudioUpload();
  });
  art.send();
 }
 if(cover&&cover.url){
  // Same-origin image file served from Grand Element's GitHub repository.
  // Never request remote GitHub APIs, raw tokens or cross-origin artwork.
  var verified=w.GEImacUploadSettings&&w.GEImacUploadSettings.albumCovers&&
    w.GEImacUploadSettings.albumCovers(),allowed=false;
  for(var ai=0;verified&&ai<verified.length;ai++)
   if(verified[ai].path===cover.url){allowed=true;break}
  if(!allowed){coverFailed("Album artwork is not in the verified GE GitHub catalog.");return}
  var imageReq=new XMLHttpRequest();
  try{
   imageReq.open("GET",cover.url,true);
   imageReq.responseType="blob";imageReq.timeout=30000;
   imageReq.onload=function(){
    if(imageReq.status!==200||!imageReq.response||!imageReq.response.size){
     coverFailed("Could not load the selected GitHub album cover.");return;
    }
    var binary=imageReq.response;
    if(binary.type!=="image/jpeg")binary=new Blob([binary],{type:"image/jpeg"});
    stageCover(binary);
   };
   imageReq.onerror=function(){coverFailed("Cannot reach the album image on the GE website.")};
   imageReq.ontimeout=function(){coverFailed("Album artwork download timed out.")};
   imageReq.send();
  }catch(e){coverFailed("Firefox could not open the album artwork: "+String(e.message||e))}
 }else if(cover){
  stageCover(cover);
 }else sendAudioUpload();
}
function pollJob(kind,mode,item,number,started,id){
 var convert=mode==="320";
 if(uploadPoll)w.clearTimeout(uploadPoll);
 uploadPoll=wait(function(){
  var req=request("GET","/status?id="+encodeURIComponent(id),null,function(err,data){
   if(err){
    stopBatch(kind,"UPLOAD STATUS UNKNOWN · "+linkError(err));return;
   }
   var job=data.job||{};
   if(job.phase==="complete"){
    finished++;succeeded++;removeChosen(kind,item);progress(100);
    var detail=convert&&!/\.mp3$/i.test(String(item.name||""))&&/\.mp3$/i.test(String(job.name||""))?
       "MP3 conversion confirmed":"Original file confirmed";
    status("TRACK "+number+"/"+total+" COMPLETE · "+detail+" · "+(kind==="radio"?"GitHub file committed; playlist rotation separate":"Google Drive verified")+" · "+(job.name||item.name));
    wait(function(){uploadNext(kind,mode)},300);return;
   }
   if(job.phase==="error"){
    finished++;failed++;
    issue(item.name+" · "+(job.detail||(kind==="radio"?"GitHub upload failed":"Google Drive upload failed")));
    progress(0);
    wait(function(){uploadNext(kind,mode)},300);return;
   }
   var pct=Number(job.percent||0);
   progress(pct>0&&pct<100?pct:null);
   var stage=job.phase==="converting"?"CONVERTING TO MP3":
    job.phase==="uploading"?"UPLOADING TO "+(kind==="radio"?"GITHUB":"GOOGLE DRIVE"):"PREPARING";
   status("TRACK "+number+"/"+total+" · "+stage+" · "+
    (pct>0&&pct<100?pct+"%":"WORKING; EXACT % UNAVAILABLE")+
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
  if(kind==="session"){
   chosen.session=files;selectedLabel("session");
   if(w.GEImacUploadSettings)w.GEImacUploadSettings.refreshPreview();
  }else{
   var chooser=el("fileDraft");
   if(chooser)try{chooser.value=""}catch(ignore){}
   syncAudioFiles(files);
  }
  setBusy(false);
  issueLines=[];text("uploadIssues","");
  status(pendingMessage(kind));
 });
}
function init(){
 if(!el("fileDraft")||!el("fileFinal")||!el("fileRadio")||!el("fileSession"))return;
 // An apparent filename restored by Firefox must not be mistaken for authorized
 // File objects. On a new page load, choose again; switching tabs does not reload.
 ["fileDraft","fileFinal","fileRadio","fileSession"].forEach(function(id){
  var input=el(id);if(input)try{input.value=""}catch(ignore){}
 });
 el("fileFinal").style.display="none";
 el("fileRadio").style.display="none";
 el("fileDraft").onchange=function(){fileChanged("draft",this)};
 el("fileSession").onchange=function(){fileChanged("session",this)};
 el("uploadDraft").onclick=function(){uploadChosen("draft")};
 el("uploadFinal").onclick=function(){uploadChosen("final")};
 el("uploadRadio").onclick=function(){uploadChosen("radio")};
 el("uploadSession").onclick=function(){uploadChosen("session")};
 el("listDrafts").onclick=function(){displayLibrary("draft")};
 el("listFinals").onclick=function(){displayLibrary("final")};
 el("listRadio").onclick=function(){displayLibrary("radio")};
 el("listSessions").onclick=function(){displayLibrary("session")};
 if(el("listAll"))el("listAll").onclick=function(){displayLibrary("all")};
 installDrop("draft");installDrop("final");installDrop("radio");installDrop("session");
 el("refreshMp3").onclick=function(){updateHealth()};
 ["draft","final","radio"].forEach(function(kind){
  var name=kind==="draft"?"Draft":kind==="radio"?"Radio":"Final";
  var standard=el("convert"+name);
  if(standard)standard.onchange=function(){if(!busy)status(pendingMessage(kind));};
 });
 if(el("retryHelper"))el("retryHelper").onclick=function(){
  updateHealth(function(err){if(!err)displayLibrary(activeKind)});
 };
 if(el("checkLocalHelperInStatus"))el("checkLocalHelperInStatus").onclick=function(){
  text("checkLocalHelperResult","CHECKING…");
  // Browser address-bar navigation has no Origin header and is deliberately denied.
  // This check instead uses the approved grandelement.com page origin.
  updateHealth(function(err,data){
   if(err)text("checkLocalHelperResult","HELPER CHECK FAILED · "+linkError(err));
   else text("checkLocalHelperResult","HELPER V"+String(data.helper_version||"?")+
       " RESPONDING · "+(data.rclone_ready?"DRIVE CONFIG FOUND":"DRIVE CONFIG MISSING")+
       " · GOOGLE SIGN-IN NOT VERIFIED");
  });
 };
 if(el("reconnectDriveAuth"))el("reconnectDriveAuth").onclick=reconnectGoogle;
 el("convertDraft").checked=false;el("convertFinal").checked=false;
 selectedLabel("draft");selectedLabel("final");selectedLabel("radio");selectedLabel("session");
 selectFolder("draft");
 setBusy(false);progress(0);
 status("READY · Choose a song once for Drafts, Finals or Radio.");
 // Firefox can restore a painted filename without the real file after Back.
 w.addEventListener("pageshow",function(e){
  if(e.persisted&&!busy){
   var input=el("fileDraft");
   if(input&&(!input.files||!input.files.length)){
    try{input.value=""}catch(ignore){}
    syncAudioFiles([]);
   }
   resetOldUploadDisplay();
   status(chosen.draft.length?"READY · "+chosen.draft.length+" SONG(S) SELECTED":
    "READY · Choose a song once for Drafts, Finals or Radio.");
  }
 },false);
 if(w.GEImacUploadSettings)w.GEImacUploadSettings.refreshPreview();
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
    "AUTOMATIC CHECK · Local helper responds; Google Drive sign-in not verified by this check.":
    "AUTOMATIC CHECK · Local helper unreachable. Open ADVANCED for connection checks.");
  });
 },20000);
}
/* Public read-only file-browser refresh for the iMac Google tab. */
w.GEImacUploads={
 refreshFiles:function(){displayLibrary(activeKind)},
 firstSelected:function(){
  var x=chosen[activeKind]||[];if(x.length)return x[0];
  for(var k in chosen)if(chosen.hasOwnProperty(k)&&chosen[k].length)return chosen[k][0];
  return null;
 },
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
