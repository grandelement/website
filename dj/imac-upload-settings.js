/* GE iMac naming and tag presets. ES5 compatible with Firefox on OS X 10.11.
 * Settings are intentionally never represented as Vault-synced without a
 * confirmed authenticated Vault write. No credentials are stored here.
 */
(function(w,d){
"use strict";
var KEY="GE_IMAC_UPLOAD_PRESET_V1";
// The selectable album images are actual files in GitHub: grandelement/website,
// ge-images/images/. The website serves these files on the SAME origin as DJ.
var ALBUM_COVERS=[{"album":"Aether","path":"/ge-images/images/Grand%20Element%20-%20Aether.jpg"},{"album":"Fire","path":"/ge-images/images/Grand%20Element%20-%20Fire.jpg"},{"album":"Fundamental Groove","path":"/ge-images/images/Grand%20Element%20-%20Fundamental%20Groove.jpg"},{"album":"Intergy","path":"/ge-images/images/Grand%20Element%20-%20Intergy.jpg"},{"album":"Live","path":"/ge-images/images/Grand%20Element%20-%20Live.jpg"},{"album":"Love","path":"/ge-images/images/Grand%20Element%20-%20Love.jpg"},{"album":"Sessions I","path":"/ge-images/images/Grand%20Element%20-%20Sessions%20I.jpg"},{"album":"Sessions II","path":"/ge-images/images/Grand%20Element%20-%20Sessions%20II.jpg"},{"album":"Soul","path":"/ge-images/images/Grand%20Element%20-%20Soul.jpg"},{"album":"Spirit","path":"/ge-images/images/Grand%20Element%20-%20Spirit.jpg"},{"album":"Trio","path":"/ge-images/images/Grand%20Element%20-%20Trio.jpg"}];
function albumByPath(path){
 for(var i=0;i<ALBUM_COVERS.length;i++)if(ALBUM_COVERS[i].path===path)return ALBUM_COVERS[i];
 return null;
}
var fields=[
 ["title","TITLE","Original filename"],["artist","ARTIST","Grand Element"],
 ["album","ALBUM","Album"],["genre","GENRE","Genre"],
 ["date","YEAR","Year"],["track","TRACK","Track #"],
 ["composer","COMPOSER","Composer"],["copyright","COPYRIGHT","Copyright"],
 ["comment","NOTES","Notes"]
];
function el(id){return d.getElementById(id)}
function make(tag,klass,text){var x=d.createElement(tag);if(klass)x.className=klass;if(text!==undefined)x.textContent=text;return x}
function add(parent,child){parent.appendChild(child);return child}
function defaults(){
 var f={};for(var i=0;i<fields.length;i++)f[fields[i][0]]={enabled:false,auto:fields[i][0]==="title"||fields[i][0]==="artist"||fields[i][0]==="date",value:""};
 f.track.enabled=true;f.track.auto=false;f.track.value="01";
 return {version:4,mode:"draft",revision:"",revisionEnabled:false,order:"track,title,revision",coverEnabled:false,coverPath:"",filename:{date:false,time:false,seconds:false,title:true},embed:false,fields:f};
}
function normal(p){
 var o=defaults();if(!p||typeof p!=="object")return o;
 if(p.filename){for(var k in o.filename)if(o.filename.hasOwnProperty(k))o.filename[k]=!!p.filename[k]}
 if(["draft","radio","final","custom"].indexOf(p.mode)>=0)o.mode=p.mode;
 // On the original iMac page, REV was being used as the TRACK number.
 // Migrate that saved value once; a new optional revision starts blank.
 var legacy=Number(p.version||0)<4;
 o.revision=legacy?"":String(p.revision===undefined?"":p.revision).replace(/[^0-9a-zA-Z_-]/g,"").slice(0,12);
 o.revisionEnabled=!legacy&&!!p.revisionEnabled;
 o.coverEnabled=!!p.coverEnabled;
 // A saved cover always points to one of the verified GitHub album files.
 o.coverPath=albumByPath(p.coverPath)?p.coverPath:"";
 o.order=String(p.order||o.order).slice(0,100);
 o.embed=!!p.embed;
 for(var i=0;i<fields.length;i++){
  var name=fields[i][0],item=p.fields&&p.fields[name];
  if(!item||typeof item!=="object")continue;
  o.fields[name].enabled=!!item.enabled;
  o.fields[name].auto=!!item.auto;
  o.fields[name].value=String(item.value||"").slice(0,180);
 }
 if(legacy&&(o.mode==="draft"||o.mode==="custom")&&
     (!p.fields||!p.fields.track||p.fields.track.auto||!String(p.fields.track.value||"").trim())){
  var oldTrack=String(p.revision||"01").replace(/[^0-9]/g,"").slice(0,6)||"01";
  o.fields.track.auto=false;o.fields.track.value=oldTrack;
 }
 return o;
}
function savedRead(){
 try{return normal(JSON.parse(w.localStorage.getItem(KEY)||"null"))}catch(e){return defaults()}
}
var saved=savedRead(),draft=normal(saved),dirty=false,selectedCover=null,coverPage=0;
function setStatus(s){var node=el("geUploadSettingsStatus");if(node)node.textContent=s}
function baseName(file){return String(file&&file.name||"Untitled").replace(/\.[^.]+$/,"")}
function extension(file){var m=/\.[^.]+$/.exec(String(file&&file.name||""));return m?m[0]:""}
function clean(s){return String(s||"").replace(/[\\/\x00-\x1f\x7f]/g,"_").replace(/\s+/g," ").replace(/^[ ._-]+|[ ._-]+$/g,"").slice(0,145)}
function pad(x){return (Number(x)<10?"0":"")+Number(x)}
function parsed(file){
 var stem=baseName(file),found=/^(.+?)_([0-9]{1,6})_(.+)$/.exec(stem);
 return found?{album:found[1],track:found[2],title:found[3]}:{album:"",track:"",title:stem};
}
function autoVal(key,file){
 var part=parsed(file);
 if(key==="title")return part.title;
 if(key==="artist")return "Grand Element";
 if(key==="album")return part.album;
 if(key==="track")return part.track||"01";
 if(key==="date")return String(new Date().getFullYear());
 return "";
}
function val(key,file,p){
 var f=p.fields[key];if(!f)return "";
 return f.auto?autoVal(key,file):String(f.value||"").trim();
}
function nameFor(file,p){
 p=p||saved;
 var now=new Date(),n=p.filename,day=now.getFullYear()+"-"+pad(now.getMonth()+1)+"-"+pad(now.getDate());
 var title=clean(val("title",file,p))||clean(parsed(file).title)||"Untitled";
 var album=clean(val("album",file,p))||"ALBUM";
 var track=clean(val("track",file,p))||"01";
 var year=clean(val("date",file,p))||String(now.getFullYear());
 var stem="";
 if(p.mode==="draft")stem=track+" - "+title;
 else if(p.mode==="radio")stem=album+"_"+track+"_"+title;
 else if(p.mode==="final")stem="Grand Element - "+year+" - "+album+" - "+track+" - "+title;
 else {
   // Custom pre-final order is fixed: TRACK, SONG, optional additions,
   // optional REVISION last. Never put date or revision before track.
   var parts=[track,title];
   if(n.date)parts.push(day);
   if(n.time)parts.push(pad(now.getHours())+"-"+pad(now.getMinutes()));
   if(n.seconds)parts.push(pad(now.getSeconds()));
   if(p.revisionEnabled&&clean(p.revision))parts.push("Rev "+clean(p.revision));
   stem=parts.join(" - ");
 }
 return clean(stem)+extension(file);
}
function validate(file,p){
 p=p||saved;
 if(p.mode==="radio"||p.mode==="final"){
  if(!val("album",file,p).trim())return "ALBUM REQUIRED · Set an album in METADATA.";
  if(!val("track",file,p).trim())return "TRACK REQUIRED · Enter the track number.";
 }
 if(p.coverEnabled&&p.mode==="final"&&!selectedCover&&!albumByPath(p.coverPath))
  return "COVER ART REQUIRED · Choose a GitHub album cover in METADATA.";
 return "";
}
function tagsFor(file,p){
 p=p||saved;
 if(!p.embed)return {};
 var result={};for(var i=0;i<fields.length;i++){
  var key=fields[i][0],f=p.fields[key];
  if(!f.enabled)continue;
  var v=val(key,file,p);if(v)result[key]=String(v).slice(0,180);
 }
 return result;
}
function active(){return normal(saved)}
function unsaved(){return dirty}
function fileForPreview(){
 if(w.GEImacUploads&&w.GEImacUploads.firstSelected)return w.GEImacUploads.firstSelected();
 return null;
}
function preview(){
 var file=fileForPreview(),label=el("geUploadNamePreview");
 var trackInput=el("geFilenameTrack");
 if(trackInput&&d.activeElement!==trackInput)
  trackInput.value=val("track",file||{name:"Song.aif"},draft)||"01";
 if(label)label.textContent=(file?"FILE: ":"EXAMPLE: ")+nameFor(file||{name:"Song.aif"},draft)+(dirty?" · UNSAVED":"");
 var sample=el("geMetadataExample");
 if(sample){
  var count=0,tags=tagsFor(file||{name:"Song.aif"},draft);
  for(var k in tags)if(tags.hasOwnProperty(k))count++;
  sample.textContent=count?count+" selected embedded tags":"Embedded tags off";
 }
}
function changed(){
 dirty=JSON.stringify(draft)!==JSON.stringify(saved);
 if(dirty)setStatus("UNSAVED CHANGES · UPLOAD will save these settings first, or press SAVE SETTINGS now.");
 else setStatus("SAVED ON THIS IMAC · VAULT NOT SYNCED");
 preview();
}
// The explicit UPLOAD command saves the displayed filename and tags first.
// The checked localStorage readback prevents an unconfirmed preset upload.
function savePending(){
 if(!dirty)return true;
 try{
  w.localStorage.setItem(KEY,JSON.stringify(draft));
  var check=normal(JSON.parse(w.localStorage.getItem(KEY)||"null"));
  if(JSON.stringify(check)!==JSON.stringify(draft))throw Error("Read-back mismatch");
  saved=check;draft=normal(saved);dirty=false;
  setStatus("SAVED ON THIS IMAC · VAULT NOT SYNCED");preview();
  return true;
 }catch(e){
  setStatus("NOT SAVED · Local browser storage unavailable. No upload started.");
  return false;
 }
}
function checkLine(parent,id,title,checked,callback){
 var label=add(parent,make("label","gePresetCheck"));
 var input=add(label,make("input"));input.type="checkbox";input.id=id;input.checked=!!checked;
 add(label,make("span",null,title));
 input.onchange=function(){callback(!!input.checked);changed()};
 return input;
}
function init(){
 var quick=el("geUploadNameQuick"),panel=el("geUploadMetadataPanel");
 if(!quick||!panel)return;
 var modes=add(quick,make("div","geFilenamePresets"));
 add(modes,make("span","gePresetLabel","FORMAT"));
 ["draft","radio","final","custom"].forEach(function(mode){
  var button=add(modes,make("button","gePresetMode",mode.toUpperCase()));
  button.type="button";button.setAttribute("data-mode",mode);
  button.onclick=function(){
   draft.mode=mode;
   if(mode==="final"){
    // Respect explicit tag and artwork choices when changing the file name format.
    ["title","artist","album","date","track"].forEach(function(key){draft.fields[key].enabled=true});
   }
   var revOn=el("geRevisionEnabled"),revField=el("geDraftRevision");
   if(revOn)revOn.checked=!!(draft.mode==="custom"&&draft.revisionEnabled);
   if(revField)revField.disabled=!(draft.mode==="custom"&&draft.revisionEnabled);
   var embedBox=el("geUploadWriteTags");if(embedBox)embedBox.checked=draft.embed;
   var coverBox=el("geUploadCoverEnabled");if(coverBox)coverBox.checked=draft.coverEnabled;
   var buttons=modes.querySelectorAll("button");
   for(var i=0;i<buttons.length;i++)buttons[i].className=buttons[i]===button?"gePresetMode gePresetSelected":"gePresetMode";
   changed();
  };
  if(draft.mode===mode)button.className+=" gePresetSelected";
 });
 // TRACK replaces the old misleading REV 05 control.
 // Text input preserves leading zeros; up/down buttons and mouse wheel step it.
 var trackWrap=add(quick,make("label","geTrackLabel","TRACK"));
 quick.insertBefore(trackWrap,modes);
 var trackDown=add(trackWrap,make("button","geTrackStep","−"));
 trackDown.type="button";trackDown.title="Previous track";
 var trackInput=add(trackWrap,make("input"));trackInput.type="text";
 trackInput.id="geFilenameTrack";trackInput.maxLength=6;
 trackInput.setAttribute("inputmode","numeric");trackInput.setAttribute("aria-label","Track number");
 trackInput.value=val("track",fileForPreview()||{name:"Song.aif"},draft)||"01";
 var trackUp=add(trackWrap,make("button","geTrackStep","+"));
 trackUp.type="button";trackUp.title="Next track";
 function setTrack(raw){
  var value=String(raw||"").replace(/[^0-9]/g,"").slice(0,6);
  draft.fields.track.auto=false;draft.fields.track.value=value;
  var metadata=el("geTagtrackValue"),auto=el("geTagtrackAuto");
  if(metadata){metadata.disabled=false;metadata.value=value}
  if(auto)auto.checked=false;
  trackInput.value=value;
  changed();
 }
 function stepTrack(amount){
  var current=String(trackInput.value||"01").replace(/[^0-9]/g,"")||"01";
  var width=Math.max(2,Math.min(6,current.length));
  var value=Math.max(1,Math.min(999999,Number(current)+amount));
  var digits=String(value);while(digits.length<width)digits="0"+digits;
  setTrack(digits);
 }
 trackDown.onclick=function(){stepTrack(-1)};
 trackUp.onclick=function(){stepTrack(1)};
 trackInput.oninput=function(){setTrack(trackInput.value)};
 trackInput.onkeydown=function(e){
  e=e||w.event;
  var code=e.keyCode||e.which;
  if(code===38||code===40){if(e.preventDefault)e.preventDefault();stepTrack(code===38?1:-1)}
 };
 if(trackInput.addEventListener){
  // Wheel while hovering over TRACK changes the number, without scrolling
  // the whole page. Use only one event type so legacy Firefox never double-steps.
  var wheelEvent=("onwheel" in trackInput)?"wheel":"DOMMouseScroll";
  trackInput.addEventListener(wheelEvent,function(e){
   var delta=wheelEvent==="wheel"?e.deltaY:e.detail;
   if(!delta)return;
   if(e.preventDefault)e.preventDefault();
   stepTrack(delta<0?1:-1);
  },false);
 }
 function chooseCustom(){
  draft.mode="custom";
  var buttons=modes.querySelectorAll("button");
  for(var ci=0;ci<buttons.length;ci++){
    buttons[ci].className=buttons[ci].getAttribute("data-mode")==="custom"?"gePresetMode gePresetSelected":"gePresetMode";
  }
 }
 // REV is an optional suffix for the CUSTOM pre-final filename only.
 var rev=add(quick,make("label","geRevisionLabel"));
 var revToggle=add(rev,make("input"));revToggle.type="checkbox";
 revToggle.id="geRevisionEnabled";revToggle.checked=draft.mode==="custom"&&draft.revisionEnabled;
 add(rev,make("span",null,"REV"));
 var revInput=add(rev,make("input"));revInput.type="text";revInput.id="geDraftRevision";
 revInput.maxLength=12;revInput.value=draft.revision;revInput.placeholder="02";
 revInput.disabled=!(draft.mode==="custom"&&draft.revisionEnabled);revInput.setAttribute("aria-label","Optional revision suffix");
 revToggle.onchange=function(){
  draft.revisionEnabled=!!revToggle.checked;revInput.disabled=!draft.revisionEnabled;
  if(draft.revisionEnabled){
   if(!draft.revision){draft.revision="01";revInput.value="01"}
   chooseCustom();
  }
  changed();
 };
 revInput.oninput=function(){
  draft.revision=revInput.value.replace(/[^0-9a-zA-Z_-]/g,"").slice(0,12);
  if(draft.revisionEnabled)chooseCustom();
  changed();
 };
 var inline=add(quick,make("div","gePresetQuickChecks"));
 var fn=checkLine(inline,"geFileDate","DATE",draft.filename.date,function(b){draft.filename.date=b;chooseCustom()});
 var ft=checkLine(inline,"geFileTime","TIME",draft.filename.time,function(b){draft.filename.time=b;chooseCustom();var sc=el("geFileSeconds");if(sc)sc.disabled=!b});
 var fs=checkLine(inline,"geFileSeconds","SECONDS",draft.filename.seconds,function(b){draft.filename.seconds=b;chooseCustom()});fs.disabled=!draft.filename.time;
 // The song title is mandatory in Draft and Custom filenames.
 add(inline,make("span","geFixedSongName","SONG NAME · ALWAYS"));
 var quickSave=add(quick,make("button","geQuickSave","SAVE FORMAT"));
 quickSave.type="button";quickSave.onclick=function(){var b=el("geUploadSaveSettings");if(b)b.click()};
 add(quick,make("span","geUploadNamePreview","")).id="geUploadNamePreview";
 var head=add(panel,make("div","geMetadataHead"));
 add(head,make("strong",null,"METADATA · NAMING & TAGS"));
 // These switches must remain visible even when the older iMac cannot scroll.
 var topOptions=add(head,make("div","geMetadataTopOptions"));
 checkLine(topOptions,"geUploadWriteTags","EMBED CHECKED TAGS",draft.embed,function(b){draft.embed=b});
 checkLine(topOptions,"geUploadCoverEnabled","ATTACH COVER IN FINAL MP3",draft.coverEnabled,function(b){draft.coverEnabled=b});
 var saveButton=add(head,make("button",null,"SAVE SETTINGS"));saveButton.type="button";saveButton.id="geUploadSaveSettings";
 var restore=add(head,make("button","geSettingsRestore","RESTORE SAVED"));restore.type="button";
 var notice=add(head,make("span","geUploadSettingsStatus",""));notice.id="geUploadSettingsStatus";
 var grid=add(panel,make("div","geMetadataGrid"));
 for(var i=0;i<fields.length;i++)(function(key,labelText,placeholder){
  var row=add(grid,make("div","geMetaRow"));
  var enabled=checkLine(row,"geTag"+key+"Enable",labelText,draft.fields[key].enabled,function(b){draft.fields[key].enabled=b});
  var aut=checkLine(row,"geTag"+key+"Auto","AUTO",draft.fields[key].auto,function(b){
    draft.fields[key].auto=b;input.disabled=b;input.placeholder=b?autoVal(key,{name:"Song.aif"})||placeholder:placeholder;
  });
  var input=add(row,make("input","geMetaValue"));
  input.id="geTag"+key+"Value";input.type="text";input.value=draft.fields[key].value;
  input.maxLength=180;input.placeholder=draft.fields[key].auto?autoVal(key,{name:"Song.aif"})||placeholder:placeholder;
  input.disabled=draft.fields[key].auto;
  input.oninput=function(){draft.fields[key].value=input.value;changed()};
 })(fields[i][0],fields[i][1],fields[i][2]);
 add(panel,make("p","geCustomOrderLabel",
  "CUSTOM PRE-FINAL ORDER: TRACK · SONG NAME · optional DATE/TIME · optional REV at end."));
 // The album artwork picker uses existing GitHub album images. No file upload
 // or GitHub authentication is needed to browse. Exactly one selected artwork.
 var picker=add(panel,make("section","geAlbumCoverPicker"));
 picker.id="geAlbumCoverPicker";
 var pickerTop=add(picker,make("div","geAlbumCoverHeader"));
 add(pickerTop,make("strong",null,"GITHUB ALBUM COVERS"));
 var albumLabel=add(pickerTop,make("span","geAlbumCoverSelected",""));
 albumLabel.id="geAlbumCoverSelected";
 var pager=add(pickerTop,make("span","geAlbumCoverPager"));
 var previous=add(pager,make("button","geAlbumCoverNav","PREV"));
 previous.type="button";
 var pageLabel=add(pager,make("span","geAlbumPageCount",""));
 var next=add(pager,make("button","geAlbumCoverNav","NEXT"));
 next.type="button";
 var tiles=add(picker,make("div","geAlbumCoverTiles"));
 var perPage=(w.innerWidth||1200)<650?3:5;
 function drawCovers(){
  tiles.textContent="";
  var count=Math.ceil(ALBUM_COVERS.length/perPage);
  coverPage=Math.max(0,Math.min(count-1,coverPage));
  pageLabel.textContent=(coverPage+1)+"/"+count;
  previous.disabled=coverPage===0;next.disabled=coverPage>=count-1;
  var selected=albumByPath(draft.coverPath);
  albumLabel.textContent=selected?"SELECTED: "+selected.album:
    selectedCover?"SELECTED: CUSTOM COVER":"NO COVER SELECTED";
  for(var ci=coverPage*perPage;ci<Math.min(ALBUM_COVERS.length,(coverPage+1)*perPage);ci++)(function(item){
    var tile=add(tiles,make("button","geAlbumCoverTile",""));
    tile.type="button";
    if(draft.coverPath===item.path)tile.className+=" geAlbumCoverActive";
    tile.setAttribute("aria-pressed",draft.coverPath===item.path?"true":"false");
    tile.title="Use "+item.album+" artwork from GE Studios GitHub";
    var thumb=add(tile,make("img","geAlbumCoverThumb"));
    thumb.src=item.path;thumb.alt="Grand Element "+item.album+" album cover";
    add(tile,make("span","geAlbumCoverTitle",item.album));
    tile.onclick=function(){
      draft.coverPath=item.path;draft.coverEnabled=true;selectedCover=null;
      var c=el("geUploadCoverFile");if(c)try{c.value=""}catch(ignore){}
      var checked=el("geUploadCoverEnabled");if(checked)checked.checked=true;
      var a=draft.fields.album;
      a.enabled=true;a.auto=false;a.value=item.album;
      var albumInput=el("geTagalbumValue"),auto=el("geTagalbumAuto"),enabled=el("geTagalbumEnable");
      if(albumInput){albumInput.disabled=false;albumInput.value=item.album}
      if(auto)auto.checked=false;if(enabled)enabled.checked=true;
      drawCovers();changed();
    };
  })(ALBUM_COVERS[ci]);
 }
 previous.onclick=function(){coverPage--;drawCovers()};
 next.onclick=function(){coverPage++;drawCovers()};
 drawCovers();
 var foot=add(panel,make("div","geMetadataFoot"));
 var coverLabel=add(foot,make("label","geCoverLabel","COVER JPG/PNG"));
 var coverFile=add(coverLabel,make("input"));coverFile.type="file";coverFile.id="geUploadCoverFile";
 coverFile.accept="image/jpeg,image/png";
 coverFile.onchange=function(){
  selectedCover=coverFile.files&&coverFile.files[0]||null;
  if(selectedCover){draft.coverPath="";drawCovers();changed()}
  else drawCovers();
 };
 var metaText=add(foot,make("span","geMetadataExample",""));metaText.id="geMetadataExample";
 add(panel,make("p","geMetadataNotice","Choose album artwork above. The selected cover and album name save with the preset. FINALS embeds the image in MP3 using Helper V10 and FFmpeg; originals stay unchanged."));
 saveButton.onclick=function(){savePending()};
 restore.onclick=function(){
  draft=normal(saved);dirty=false;selectedCover=null;coverPage=0;
  var root=panel.parentNode;
  if(quick.parentNode)quick.parentNode.removeChild(quick);
  if(panel.parentNode)panel.parentNode.removeChild(panel);
  var x=el("geUploadSection");if(x)x.appendChild(quick);
  if(root)root.appendChild(panel);
  quick.textContent="";panel.textContent="";
  init();
 };
 changed();
}
w.GEImacUploadSettings={
  nameFor:function(file){return nameFor(file,saved)},
  validate:function(file){return validate(file,saved)},
  coverFor:function(){
   if(!saved.coverEnabled||saved.mode!=="final")return null;
   if(selectedCover)return selectedCover;
   var album=albumByPath(saved.coverPath);
   return album?{url:album.path,type:"image/jpeg",name:"Grand Element - "+album.album+".jpg"}:null;
  },
  albumCovers:function(){return ALBUM_COVERS.slice(0)},
  tagsFor:function(file){return tagsFor(file,saved)},
  preview:preview,hasUnsaved:unsaved,savePending:savePending,
  pendingMode:function(){return draft.mode},settings:active,version:4,
  refreshPreview:preview
};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
