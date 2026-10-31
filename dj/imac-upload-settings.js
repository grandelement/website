/* GE iMac naming and tag presets. ES5 compatible with Firefox on OS X 10.11.
 * Settings are intentionally never represented as Vault-synced without a
 * confirmed authenticated Vault write. No credentials are stored here.
 */
(function(w,d){
"use strict";
var KEY="GE_IMAC_UPLOAD_PRESET_V1";
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
 return {version:2,mode:"draft",revision:"01",order:"date,track,title",coverEnabled:false,filename:{date:false,time:false,seconds:false,title:true},embed:false,fields:f};
}
function normal(p){
 var o=defaults();if(!p||typeof p!=="object")return o;
 if(p.filename){for(var k in o.filename)if(o.filename.hasOwnProperty(k))o.filename[k]=!!p.filename[k]}
 if(["draft","radio","final","custom"].indexOf(p.mode)>=0)o.mode=p.mode;
 o.revision=String(p.revision||"01").replace(/[^0-9a-zA-Z_-]/g,"").slice(0,12)||"01";
 o.coverEnabled=!!p.coverEnabled;
 o.order=String(p.order||o.order).slice(0,100);
 o.embed=!!p.embed;
 for(var i=0;i<fields.length;i++){
  var name=fields[i][0],item=p.fields&&p.fields[name];
  if(!item||typeof item!=="object")continue;
  o.fields[name].enabled=!!item.enabled;
  o.fields[name].auto=!!item.auto;
  o.fields[name].value=String(item.value||"").slice(0,180);
 }
 return o;
}
function savedRead(){
 try{return normal(JSON.parse(w.localStorage.getItem(KEY)||"null"))}catch(e){return defaults()}
}
var saved=savedRead(),draft=normal(saved),dirty=false,selectedCover=null;
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
 if(key==="track")return part.track;
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
 if(p.mode==="draft")stem=day+" - "+clean(p.revision||"01")+" - "+title;
 else if(p.mode==="radio")stem=album+"_"+track+"_"+title;
 else if(p.mode==="final")stem="Grand Element - "+year+" - "+album+" - "+track+" - "+title;
 else {
   var pieces={date:day,time:pad(now.getHours())+"-"+pad(now.getMinutes()),
     seconds:pad(now.getSeconds()),title:title,album:album,
     year:year,artist:"Grand Element",track:track,revision:clean(p.revision||"01")};
   var order=String(p.order||"date,track,title").toLowerCase().split(",");
   var parts=[];
   for(var oi=0;oi<order.length;oi++){
    var field=order[oi].replace(/\s/g,"");
    if(pieces[field]&&(field!=="date"||n.date)&&(field!=="time"||n.time)&&
       (field!=="seconds"||n.seconds)&&(field!=="title"||n.title))
      parts.push(pieces[field]);
   }
   stem=parts.join(" - ")||title;
 }
 return clean(stem)+extension(file);
}
function validate(file,p){
 p=p||saved;
 if(p.mode==="radio"||p.mode==="final"){
  if(!val("album",file,p).trim())return "ALBUM REQUIRED · Set an album in METADATA.";
  if(!val("track",file,p).trim())return "TRACK REQUIRED · Enter the track number.";
 }
 if(p.coverEnabled&&p.mode==="final"&&!selectedCover)return "COVER ART REQUIRED · Select JPEG/PNG in METADATA.";
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
 if(dirty)setStatus("UNSAVED CHANGES · Press SAVE SETTINGS to apply.");
 else setStatus("SAVED ON THIS IMAC · VAULT NOT SYNCED");
 preview();
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
    draft.embed=true;draft.coverEnabled=true;
    ["title","artist","album","date","track"].forEach(function(key){draft.fields[key].enabled=true});
   }
   var embedBox=el("geUploadWriteTags");if(embedBox)embedBox.checked=draft.embed;
   var coverBox=el("geUploadCoverEnabled");if(coverBox)coverBox.checked=draft.coverEnabled;
   var buttons=modes.querySelectorAll("button");
   for(var i=0;i<buttons.length;i++)buttons[i].className=buttons[i]===button?"gePresetMode gePresetSelected":"gePresetMode";
   changed();
  };
  if(draft.mode===mode)button.className+=" gePresetSelected";
 });
 var rev=add(quick,make("label","geRevisionLabel","REV"));
 var revInput=add(rev,make("input"));revInput.type="text";revInput.id="geDraftRevision";
 revInput.maxLength=12;revInput.value=draft.revision;revInput.oninput=function(){
   draft.revision=revInput.value.replace(/[^0-9a-zA-Z_-]/g,"").slice(0,12);changed();
 };
 function chooseCustom(){
  draft.mode="custom";
  var buttons=modes.querySelectorAll("button");
  for(var ci=0;ci<buttons.length;ci++){
    buttons[ci].className=buttons[ci].getAttribute("data-mode")==="custom"?"gePresetMode gePresetSelected":"gePresetMode";
  }
 }
 var inline=add(quick,make("div","gePresetQuickChecks"));
 var fn=checkLine(inline,"geFileDate","DATE",draft.filename.date,function(b){draft.filename.date=b;chooseCustom()});
 var ft=checkLine(inline,"geFileTime","TIME",draft.filename.time,function(b){draft.filename.time=b;chooseCustom();var sc=el("geFileSeconds");if(sc)sc.disabled=!b});
 var fs=checkLine(inline,"geFileSeconds","SECONDS",draft.filename.seconds,function(b){draft.filename.seconds=b;chooseCustom()});fs.disabled=!draft.filename.time;
 checkLine(inline,"geFileTitle","SONG NAME",draft.filename.title,function(b){draft.filename.title=b;chooseCustom()});
 var quickSave=add(quick,make("button","geQuickSave","SAVE FORMAT"));
 quickSave.type="button";quickSave.onclick=function(){var b=el("geUploadSaveSettings");if(b)b.click()};
 add(quick,make("span","geUploadNamePreview","")).id="geUploadNamePreview";
 var head=add(panel,make("div","geMetadataHead"));
 add(head,make("strong",null,"METADATA · NAMING & TAGS"));
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
 var orderRow=add(panel,make("label","geCustomOrderLabel","CUSTOM ORDER"));
 var orderValue=add(orderRow,make("input"));orderValue.id="geCustomOrder";
 orderValue.type="text";orderValue.value=draft.order;
 orderValue.placeholder="date,track,title";orderValue.maxLength=100;
 orderValue.oninput=function(){draft.order=orderValue.value;changed()};
 var foot=add(panel,make("div","geMetadataFoot"));
 checkLine(foot,"geUploadCoverEnabled","ATTACH COVER IN FINAL MP3",draft.coverEnabled,function(b){draft.coverEnabled=b});
 var coverLabel=add(foot,make("label","geCoverLabel","COVER JPG/PNG"));
 var coverFile=add(coverLabel,make("input"));coverFile.type="file";coverFile.id="geUploadCoverFile";
 coverFile.accept="image/jpeg,image/png";coverFile.onchange=function(){selectedCover=coverFile.files&&coverFile.files[0]||null;preview()};
 checkLine(foot,"geUploadWriteTags","EMBED CHECKED TAGS",draft.embed,function(b){draft.embed=b});
 var metaText=add(foot,make("span","geMetadataExample",""));metaText.id="geMetadataExample";
 add(panel,make("p","geMetadataNotice","RADIO matches the published Album_Track_Title format. A missing album or track must be entered. Artwork and embedded tags require Helper V10 and FFmpeg. Originals stay unchanged."));
 saveButton.onclick=function(){
  try{
   w.localStorage.setItem(KEY,JSON.stringify(draft));
   var confirmed=normal(JSON.parse(w.localStorage.getItem(KEY)||"null"));
   if(JSON.stringify(confirmed)!==JSON.stringify(draft))throw Error("Read-back mismatch");
   saved=confirmed;draft=normal(saved);dirty=false;
   setStatus("SAVED ON THIS IMAC · VAULT NOT SYNCED");preview();
  }catch(e){setStatus("NOT SAVED · Local storage unavailable. Nothing applied.")}
 };
 restore.onclick=function(){
  draft=normal(saved);dirty=false;
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
  coverFor:function(){return saved.coverEnabled&&saved.mode==="final"?selectedCover:null},
  tagsFor:function(file){return tagsFor(file,saved)},
  preview:preview,hasUnsaved:unsaved,settings:active,version:2,
  refreshPreview:preview
};
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",init);else init();
})(window,document);
