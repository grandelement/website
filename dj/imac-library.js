/* GE Music Library on iMac Firefox / OS X 10.11. ES5 only.
 * Public inventory: radio/manifest.json. Publishing: private loopback helper.
 * No GitHub token or write permission ever reaches this page.
 */
(function(w,d){"use strict";
var ROOT="/",API="http://127.0.0.1:8765",root=null,all=[],radioPaths={},bangers={},loading=false,uploading=false,selectedPath="",selection=null,painted=false,activeAlbum="",albumKeys=[];
function el(id){return d.getElementById(id)}
function elem(tag,klass,value){var n=d.createElement(tag);if(klass)n.className=klass;if(value!==undefined)n.textContent=value;return n}
function label(message){if(el("geLibStatus"))el("geLibStatus").textContent=message}
function progress(message){if(el("geLibUploadStatus"))el("geLibUploadStatus").textContent=message}
function xhr(method,url,body,done){
 var x=new XMLHttpRequest(),once=false;
 function finish(err,data){if(once)return;once=true;done(err,data||{})}
 try{
 x.open(method,url,true);x.timeout=method==="GET"?30000:0;
 x.setRequestHeader("Accept","application/json");
 if(method==="POST")x.setRequestHeader("X-GE-Local","1");
 x.onreadystatechange=function(){
  if(x.readyState!==4)return;
  var obj={};try{obj=JSON.parse(x.responseText||"{}")}catch(ignore){}
  if(x.status<200||x.status>=300||obj.ok===false)finish(new Error(obj.error||"HTTP "+x.status),obj);
  else finish(null,obj);
 };
 x.onerror=function(){finish(new Error("Connection unavailable"))};
 x.ontimeout=function(){finish(new Error("Connection timed out"))};
 if(body)x.send(body);else x.send();
 }catch(e){finish(e)}
 return x;
}
function musicUrl(path){var items=path.split("/"),escaped=[];for(var i=0;i<items.length;i++)escaped.push(encodeURIComponent(items[i]));return "/"+escaped.join("/")}
function niceName(path){var name=path.split("/").pop()||path;return name.replace(/\.mp3$/i,"").replace(/_/g," ")}
function routeTo(path){return Object.prototype.hasOwnProperty.call(radioPaths,path)}
// The folder holding a song is its album. Keep keys as exact repository paths.
function albumOf(path){
 var relative=String(path||"").substring("ge-music/music/".length);
 var pieces=relative.split("/");
 return pieces.length>1?pieces.slice(0,-1).join("/"):"Singles";
}
function albumName(key){
 if(key==="Radio Uploads")return "NEW UPLOADS";
 if(key==="Singles")return "SINGLES";
 return String(key).replace(/^Grand Element - (?:19|20)\d{2} - /i,"").replace(/^Grand Element - /i,"").toUpperCase();
}
function albumYear(key){
 var m=String(key).match(/^Grand Element - (\d{4}) - /);
 return m?Number(m[1]):0;
}
function paintAlbumTabs(){
 var tabs=el("geLibAlbumTabs");if(!tabs)return;
 while(tabs.firstChild)tabs.removeChild(tabs.firstChild);
 var counts={};
 for(var i=0;i<all.length;i++){var a=albumOf(all[i]);counts[a]=(counts[a]||0)+1}
 var names=[""].concat(albumKeys);
 for(var j=0;j<names.length;j++)(function(key){
  var button=elem("button",key===activeAlbum?"geLibAlbumActive":"",key===""?"ALL SONGS ("+all.length+")":albumName(key)+" ("+(counts[key]||0)+")");
  button.type="button";button.setAttribute("role","tab");
  button.setAttribute("aria-selected",key===activeAlbum?"true":"false");
  button.onclick=function(){
   activeAlbum=key;
   el("geLibSearch").value="";
   el("geLibPage").value="0";
   paintAlbumTabs();paint();
  };
  tabs.appendChild(button);
 })(names[j]);
}

function listFilter(){
 var q=(el("geLibSearch")&&el("geLibSearch").value||"").toLowerCase(),filtered=[];
 for(var i=0;i<all.length;i++)if((!activeAlbum||albumOf(all[i])===activeAlbum)&&all[i].toLowerCase().indexOf(q)>=0)filtered.push(all[i]);
 return filtered;
}
function paint(){
 var out=el("geLibSongs");if(!out)return;
 while(out.firstChild)out.removeChild(out.firstChild);
 var matches=listFilter(),page=Number(el("geLibPage").value||"0"),size=30,pages=Math.max(1,Math.ceil(matches.length/size));
 if(page>=pages)page=pages-1;
 if(page<0)page=0;
 el("geLibPage").value=String(page);
 el("geLibCount").textContent=(activeAlbum?albumName(activeAlbum)+" · ":"")+matches.length+" songs · Page "+(page+1)+" of "+pages;
 el("geLibPrev").disabled=page===0;
 el("geLibNext").disabled=page===pages-1;
 if(!matches.length){out.appendChild(elem("p",null,"No songs match this search."));return}
 for(var i=page*size;i<Math.min(matches.length,(page+1)*size);i++)(function(path){
  var row=elem("div","geLibSong"),info=elem("div","geLibSongInfo"),title=elem("strong",null,niceName(path));
  var album=path.substring("ge-music/music/".length).split("/").slice(0,-1).join(" / ");
  var status=(routeTo(path)?"RADIO 2 SCHEDULE · ":"")+(bangers[path]?"BANGERS · ":"")+(album||"Radio Uploads");
  info.appendChild(title);info.appendChild(elem("small",null,status));row.appendChild(info);
  var preview=elem("button",null,"PREVIEW");preview.type="button";
  preview.onclick=function(){
   var a=el("geLibPlayer");a.src=musicUrl(path);a.style.display="block";
   el("geLibPreviewName").textContent="PREVIEW · "+niceName(path);
   try{a.load();a.play()}catch(ignore){}
  };
  var replace=elem("button",null,"REPLACE");replace.type="button";
  replace.onclick=function(){chooseReplacement(path)};
  row.appendChild(preview);row.appendChild(replace);out.appendChild(row);
 })(matches[i]);
}
function load(){
 if(loading)return;loading=true;label("Loading the GE Music catalog…");
 xhr("GET",ROOT+"radio/manifest.json?library="+new Date().getTime(),null,function(err,manifest){
  loading=false;
  if(err||!manifest||!manifest.files){label("Music catalog unavailable. No files were changed.");return}
  var source=manifest.files;all=[];
  for(var i=0;i<source.length;i++)if(/^ge-music\/music\/.+\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(source[i]))all.push(source[i]);
  all.sort(function(a,b){return a.toLowerCase()<b.toLowerCase()?-1:a.toLowerCase()>b.toLowerCase()?1:0});
  var found={};
  for(var a=0;a<all.length;a++)found[albumOf(all[a])]=true;
  // Keep the incoming uploads tab visible even before the first new release.
  found["Radio Uploads"]=true;
  albumKeys=Object.keys(found);
  albumKeys.sort(function(a,b){
   if(a==="Radio Uploads")return -1;
   if(b==="Radio Uploads")return 1;
   var year=albumYear(b)-albumYear(a);if(year)return year;
   return albumName(a)<albumName(b)?-1:albumName(a)>albumName(b)?1:0;
  });
  if(activeAlbum&&!found[activeAlbum])activeAlbum="";
  paintAlbumTabs();
  label("GE Music catalog connected · "+all.length+" files. Select an album to find its songs.");
  xhr("GET",ROOT+"radio/sync-playlist.json?library="+new Date().getTime(),null,function(e,data){
   radioPaths={};if(!e&&data&&data.tracks)for(var j=0;j<data.tracks.length;j++)if(data.tracks[j].path)radioPaths[data.tracks[j].path]=true;
   xhr("GET",ROOT+"playlists/registry.json?library="+new Date().getTime(),null,function(er,registry){
    bangers={};
    if(!er&&registry&&registry.playlists)for(var k=0;k<registry.playlists.length;k++){
     var p=registry.playlists[k];
     if(String(p.name||"").toLowerCase()==="bangers"&&p.songs)for(var t=0;t<p.songs.length;t++)bangers[p.songs[t]]=true;
    }
    paint();
   });
  });
 });
}
function chooseReplacement(path){
 if(uploading)return;
 selectedPath=path;
 el("geLibTarget").textContent="REPLACING · "+path+"\nThe public song keeps this exact library filename and its existing playlist references.";
 el("geLibFile").value="";
 el("geLibUpload").textContent="REPLACE THIS SONG";
 el("geLibFile").focus();
 progress("Select the replacement AIF, AIFF, WAV or MP3. The original Mac file will not be changed.");
}
function chooseNew(){
 if(uploading)return;
 selectedPath="";
 el("geLibTarget").textContent="NEW SONG · Upload to GE Music Library / Radio Uploads. Not automatically added to Radio 1 or Radio 2 rotation.";
 el("geLibFile").value="";
 el("geLibUpload").textContent="UPLOAD NEW SONG";
 progress("Choose an AIF, AIFF, WAV or MP3. Automatic MP3 conversion requires FFmpeg or LAME on this iMac.");
}
function check(cb){
 progress("Checking local Mac uploader and GitHub authorization…");
 xhr("GET",API+"/health",null,function(err,health){
  if(err){progress("NOT CONNECTED · iMac upload helper is not installed or running. Open INSTALL LIBRARY HELPER below.");if(cb)cb(false);return}
  if(!health.mp3_available){progress("MP3 CONVERTER MISSING · This Mac needs LAME or FFmpeg for AIF files.");if(cb)cb(false);return}
  xhr("GET",API+"/github/check",null,function(e,data){
   if(e){progress("GITHUB NOT CONNECTED · "+e.message+". Open INSTALL LIBRARY HELPER below.");if(cb)cb(false);return}
   progress("GITHUB CONNECTION VERIFIED · Audio converter: "+health.mp3_converter+". Write permission will be checked during your actual upload.");
   if(cb)cb(true);
  });
 });
}
function startUpload(){
 if(uploading)return;
 selection=el("geLibFile").files;
 if(!selection||selection.length!==1){progress("Choose one AIF, AIFF, WAV or MP3 file first.");return}
 var file=selection[0],name=file.name||"";
 if(!/\.(aif|aiff|wav|mp3|flac|m4a|aac|ogg|oga)$/i.test(name)){progress("Unsupported format. Choose an audio file.");return}
 if(selectedPath&&!w.confirm("REPLACE THE WEBSITE SONG?\n"+selectedPath+"\n\nA new audio revision will be published at the existing path. Existing playlists keep that path."))return;
 check(function(ok){
  if(!ok)return;
  uploading=true;el("geLibUpload").disabled=true;
  progress("Sending "+name+" to the iMac for conversion…");
  var url=API+"/upload?kind=radio&convert=1&name="+encodeURIComponent(name);
  if(selectedPath)url+="&replace="+encodeURIComponent(selectedPath);
  var request=xhr("POST",url,file,function(err,data){
   if(err||!data.id){uploading=false;el("geLibUpload").disabled=false;progress("UPLOAD FAILED · "+(err?err.message:"No upload ID returned. Do not retry blindly."));return}
   var id=data.id,tries=0;
   function poll(){
    xhr("GET",API+"/status?id="+encodeURIComponent(id),null,function(e,result){
     if(e){uploading=false;el("geLibUpload").disabled=false;progress("STATUS UNKNOWN · Check GitHub before retrying. "+e.message);return}
     var job=result.job||{};
     if(job.phase==="complete"){
      uploading=false;el("geLibUpload").disabled=false;
      progress("GITHUB UPLOAD COMPLETE · "+(job.detail||"Commit confirmed")+". The public catalog may take a few minutes to refresh. Radio rotation is separate.");
      w.setTimeout(load,2500);return;
     }
     if(job.phase==="error"){
      uploading=false;el("geLibUpload").disabled=false;
      progress("UPLOAD FAILED · "+(job.detail||"No GitHub confirmation"));return;
     }
     tries++;
     progress(String(job.detail||"Working on audio…")+" · "+String(job.percent||"?")+"%");
     if(tries>360){uploading=false;el("geLibUpload").disabled=false;progress("STATUS TIMED OUT · Check GitHub before retrying.");return}
     w.setTimeout(poll,1500);
    });
   }
   poll();
  });
  request.upload.onprogress=function(ev){if(ev.lengthComputable)progress("Sending AIF to iMac · "+Math.round(100*ev.loaded/ev.total)+"%")};
 });
}
function open(host){
 if(!root){
  root=elem("div","panel geLibPanel");root.id="geLibraryPanel";
  root.appendChild(elem("h2",null,"GE MUSIC LIBRARY"));
  root.appendChild(elem("p",null,"One shared website catalog. Find, preview, upload or replace songs. Google Drive stays separate."));
  var actions=elem("div","geLibActions");
  var newButton=elem("button",null,"NEW SONG");newButton.onclick=chooseNew;actions.appendChild(newButton);
  var refresh=elem("button",null,"REFRESH SONGS");refresh.onclick=load;actions.appendChild(refresh);
  var checkBtn=elem("button",null,"CHECK GITHUB");checkBtn.onclick=function(){check()};actions.appendChild(checkBtn);
  root.appendChild(actions);
  var upload=elem("div","geLibEditor");
  var target=elem("p",null,"NEW SONG · Upload to the shared website music library.");target.id="geLibTarget";upload.appendChild(target);
  var file=elem("input");file.type="file";file.id="geLibFile";file.accept=".aif,.aiff,.wav,.mp3,.m4a,.aac,.flac,.ogg,.oga,audio/*";file.setAttribute("aria-label","Select replacement or new song from this Mac");upload.appendChild(file);
  var doUpload=elem("button",null,"UPLOAD NEW SONG");doUpload.type="button";doUpload.id="geLibUpload";doUpload.onclick=startUpload;upload.appendChild(doUpload);
  var uploadStatus=elem("p",null,"Select a song to publish, or choose REPLACE on an existing song.");uploadStatus.id="geLibUploadStatus";uploadStatus.setAttribute("role","status");upload.appendChild(uploadStatus);
  root.appendChild(upload);
  var setup=elem("details","geLibSetup");setup.appendChild(elem("summary",null,"INSTALL LIBRARY HELPER · FIRST TIME ONLY"));
  setup.appendChild(elem("p",null,"For OS X El Capitan. Download the ZIP on your iMac, unzip it, then Control-click Install GE Library.command and choose Open. A private GitHub token is still required."));
  var link=elem("a",null,"DOWNLOAD IMAC LIBRARY INSTALLER");link.href="/dj/GE_Studios_Library_Installer.zip";link.download="GE_Studios_Library_Installer.zip";link.className="link";setup.appendChild(link);root.appendChild(setup);
  root.appendChild(elem("h3",null,"FIND SONGS BY ALBUM"));
  var albumTabs=elem("div","geLibAlbumTabs");albumTabs.id="geLibAlbumTabs";
  albumTabs.setAttribute("role","tablist");albumTabs.setAttribute("aria-label","Choose an album");
  root.appendChild(albumTabs);
  var search=elem("input");search.id="geLibSearch";search.type="search";search.placeholder="Find song, album or filename";search.setAttribute("aria-label","Search GE Music songs");search.oninput=function(){el("geLibPage").value="0";paint()};root.appendChild(search);
  var count=elem("p",null,"Loading…");count.id="geLibCount";root.appendChild(count);
  var state=elem("p",null,"Loading GE Music catalog…");state.id="geLibStatus";state.setAttribute("role","status");root.appendChild(state);
  var a=elem("audio");a.id="geLibPlayer";a.controls=true;a.preload="none";a.style.display="none";root.appendChild(a);
  var previewName=elem("p");previewName.id="geLibPreviewName";root.appendChild(previewName);
  var songs=elem("div","geLibSongs");songs.id="geLibSongs";root.appendChild(songs);
  var pagers=elem("div","geLibActions"),prev=elem("button",null,"PREVIOUS"),next=elem("button",null,"NEXT");
  var pg=elem("input");pg.id="geLibPage";pg.type="hidden";pg.value="0";
  prev.id="geLibPrev";next.id="geLibNext";prev.onclick=function(){pg.value=String(Math.max(0,Number(pg.value)-1));paint()};
  next.onclick=function(){pg.value=String(Number(pg.value)+1);paint()};
  pagers.appendChild(prev);pagers.appendChild(next);pagers.appendChild(pg);root.appendChild(pagers);
  host.appendChild(root);load();
 }else if(root.parentNode!==host)host.appendChild(root);
}
w.GEImacLibrary={open:open,refresh:load};
})(window,document);
