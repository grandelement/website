/* GE Radio/Music: one inventory, four destinations, one published save. */
(()=>{
'use strict';
const root=document.getElementById('brCatalogRouting');
if(!root)return;
const $=id=>document.getElementById(id);
const API='https://ge-backroom-publisher.grandelement.workers.dev';
const TOKEN_KEY='GE_BACKROOM_PUBLISH_SESSION_V1';
const ORDER=['Aether','Fire','Spirit','Soul','Love','Intergy','Sessions II','Sessions I','Live','Trio','Fundamental Groove','Singles'];
const SONG=/^ge-music\/music\/.+\.(?:mp3|m4a|wav|ogg|flac)$/i;
const PATH_KEYS=['storeSongPaths','playerSongPaths','radioSongPaths'];
const COLORS=window.GE_ALBUM_COLORS||{};
let entries=[],names=[],view='all',loaded=false,busy=false,serverReady=false,expected=null,baseSignature='';
let flags={frontAlbums:new Set(),storeAlbums:new Set(),storeSongPaths:new Set(),playerSongPaths:new Set(),radioSongPaths:new Set()};
const albumOf=path=>(String(path).split('/')[2]||'').replace(/^Grand Element - (?:\d{4} - )?/,'').trim()||'Other';
const songOf=path=>{
 let name=String(path).split('/').pop()||'';
 try{name=decodeURIComponent(name)}catch(_){}
 return name.replace(/\.(mp3|m4a|wav|ogg|flac)$/i,'').replace(/^[^_]+_\d+[-_]?/,'').replace(/_/g,' ').replace(/\s+/g,' ').trim();
};
const order=(a,b)=>{let x=ORDER.indexOf(a),y=ORDER.indexOf(b);return (x<0?999:x)-(y<0?999:y)||a.localeCompare(b)};
const status=message=>{$('brRouteStatus').textContent=String(message)};
const sorted=key=>[...flags[key]].sort();
const snapshot=()=>JSON.stringify({
 frontAlbums:sorted('frontAlbums'),storeAlbums:sorted('storeAlbums'),
 storeSongPaths:sorted('storeSongPaths'),playerSongPaths:sorted('playerSongPaths'),
 radioSongPaths:sorted('radioSongPaths')
});
const changed=()=>snapshot()!==baseSignature;
const token=()=>{try{return sessionStorage.getItem(TOKEN_KEY)||''}catch(_){return ''}};
async function ownerApi(method,body){
 const secret=token();if(!secret)throw Error('Sign in to the private Back Room first.');
 const response=await fetch(API+'/manage/player-profile',{
  method,cache:'no-store',headers:{Authorization:'Bearer '+secret,...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true)throw Error(data.error||'Publisher HTTP '+response.status);
 return data;
}
function useRecord(record){
 const paths=entries.map(row=>row.path);
 flags={
  frontAlbums:new Set(Array.isArray(record?.frontAlbums)?record.frontAlbums:names.filter(name=>name!=='Singles')),
  storeAlbums:new Set(Array.isArray(record?.storeAlbums)?record.storeAlbums:names),
  storeSongPaths:new Set(Array.isArray(record?.storeSongPaths)?record.storeSongPaths:paths),
  playerSongPaths:new Set(Array.isArray(record?.playerSongPaths)?record.playerSongPaths:paths),
  radioSongPaths:new Set(Array.isArray(record?.radioSongPaths)?record.radioSongPaths:[])
 };
 baseSignature=snapshot();
}
function updateCount(){
 if(!loaded){
  $('brRouteCounts').textContent='SIGN IN TO LOAD THE MASTER CATALOG';
  $('brRouteSave').disabled=true;return;
 }
 $('brRouteCounts').textContent=entries.length+' FILES · '+flags.frontAlbums.size+' FRONT · '+flags.storeAlbums.size+
  ' STORE · '+flags.playerSongPaths.size+' PLAYER · '+flags.radioSongPaths.size+' RADIO';
 $('brRouteSave').disabled=!loaded||!serverReady||busy||!changed();
 if(changed())status(serverReady?'UNSAVED CHANGES · SAVE ALL CHANGES to publish.':
  'READ ONLY · Publisher needs the new Music routing deployment before it can save.');
}
function toggle(kind,value,aria){
 const label=document.createElement('label');label.className='brRouteBox';
 label.title=aria+' · '+value;
 const input=document.createElement('input');input.type='checkbox';input.checked=flags[kind].has(value);
 input.setAttribute('aria-label',aria+' '+value);
 input.addEventListener('change',()=>{if(input.checked)flags[kind].add(value);else flags[kind].delete(value);updateCount()});
 label.append(input);return label;
}
function render(){
 const list=$('brRouteSongList'),header=$('brRouteStickyHead');
 list.replaceChildren();header.replaceChildren();
 const cols=view==='all'?PATH_KEYS:view==='front'?[]:view==='store'?['storeSongPaths']:view==='player'?['playerSongPaths']:['radioSongPaths'];
 const grid='minmax(0,1fr)'+cols.map(()=>' 49px').join('');
 header.style.gridTemplateColumns=grid;
 const word=document.createElement('strong');word.textContent='ALBUM / SONG';header.append(word);
 for(const kind of cols){const el=document.createElement('strong');el.textContent=kind==='storeSongPaths'?'STORE':kind==='playerSongPaths'?'PLAYER':'RADIO';header.append(el)}
 const term=$('brRouteSearch').value.trim().toLowerCase(),albumFilter=$('brRouteAlbum').value;
 for(const album of names){
  if(albumFilter&&albumFilter!==album)continue;
  const songs=entries.filter(row=>row.album===album&&(!term||(album+' '+row.title+' '+row.path).toLowerCase().includes(term)));
  if(!songs.length)continue;
  const group=document.createElement('section');group.className='brRouteAlbum';
  group.style.setProperty('--br-album-color',COLORS[album]||'#6da7c6');
  const head=document.createElement('div');head.className='brRouteAlbumHead';
  const title=document.createElement('strong');title.textContent=album+' · '+songs.length+' SONGS';head.append(title);
  if(view==='all'||view==='front'){
   const c=document.createElement('div');c.className='brRouteAlbumToggle';
   c.append('FRONT ',toggle('frontAlbums',album,'Show album on front'));head.append(c);
  }
  if(view==='all'||view==='store'){
   const c=document.createElement('div');c.className='brRouteAlbumToggle';
   c.append('STORE ',toggle('storeAlbums',album,'Show album in store'));head.append(c);
  }
  group.append(head);
  if(view!=='front')for(const row of songs){
   const line=document.createElement('div');line.className='brRouteSong';line.style.gridTemplateColumns=grid;
   const label=document.createElement('span');label.className='brRouteName';label.textContent=row.title;label.title=row.path;
   line.append(label);
   for(const kind of cols)line.append(toggle(kind,row.path,kind==='radioSongPaths'?'Approve Radio Shuffle':kind==='playerSongPaths'?'Show in Music Player':'Show in Store'));
   group.append(line);
  }
  list.append(group);
 }
 if(!list.childElementCount)list.textContent='NO MATCHING SONGS';
 updateCount();
}
function setView(next){
 view=next;
 $('brRouteMatrix').dataset.view=view;
 root.querySelectorAll('[data-route-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.routeView===view)));
 $('brRouteRadioAux').hidden=view!=='radio';
 render();
}
async function load(force=false){
 if(busy)return;
 if(changed()&&!force&&!confirm('Discard unsaved master checkboxes and refresh?'))return;
 busy=true;$('brRouteRefresh').disabled=true;$('brRouteRebuild').disabled=true;$('brRouteSave').disabled=true;
 status('READING MASTER MUSIC MANIFEST…');
 try{
  const response=await fetch('../radio/manifest.json?router='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('Manifest HTTP '+response.status);
  const manifest=await response.json();
  if(!Array.isArray(manifest.files))throw Error('Invalid music manifest.');
  entries=[...new Set(manifest.files.filter(path=>typeof path==='string'&&SONG.test(path)&&!path.includes('..')))]
   .map(path=>({path,album:albumOf(path),title:songOf(path)}))
   .sort((a,b)=>order(a.album,b.album)||a.title.localeCompare(b.title));
  if(!entries.length)throw Error('No committed song files. Settings were not changed.');
  names=[...new Set(entries.map(row=>row.album))].sort(order);
  const select=$('brRouteAlbum'),prior=select.value;
  select.replaceChildren(new Option('ALL ALBUMS',''));
  for(const album of names)select.add(new Option(album,album));
  select.value=names.includes(prior)?prior:'';
  let record;
  try{
   const result=await ownerApi('GET');
   if(!Object.prototype.hasOwnProperty.call(result,'routing'))throw Error('Publisher needs deployment of the new Music routing handler.');
   record=result.routing;expected=JSON.parse(JSON.stringify(record));serverReady=true;
  }catch(error){
   const current=await fetch('../config/site-live.json?router='+Date.now(),{cache:'no-store'});
   if(!current.ok)throw error;
   const cfg=await current.json(),saved=cfg.music?.catalogRouting||{};
   record={...saved,radioSongPaths:cfg.music?.radioMasterSongPaths||[]};
   expected=null;serverReady=false;
   status('READ ONLY · '+String(error.message||error)+' · Deploy updated Back Room Publisher to enable SAVE.');
  }
  useRecord(record);loaded=true;render();
  if(serverReady)status('READY · '+entries.length+' MUSIC FILES · ONE PUBLISHED MASTER.');
 }catch(error){loaded=false;status('NOT LOADED · '+String(error.message||error))}
 finally{busy=false;$('brRouteRefresh').disabled=false;$('brRouteRebuild').disabled=false;updateCount()}
}
async function save(){
 if(!loaded||!serverReady||busy)return;
 if(!changed()){status('NO CHANGES.');return;}
 const oldRadio=Array.isArray(expected?.radioSongPaths)?expected.radioSongPaths:[];
 const radioSongPaths=[...oldRadio.filter(path=>flags.radioSongPaths.has(path)),
  ...sorted('radioSongPaths').filter(path=>!oldRadio.includes(path))];
 const routing={frontAlbums:sorted('frontAlbums'),storeAlbums:sorted('storeAlbums'),
  storeSongPaths:sorted('storeSongPaths'),playerSongPaths:sorted('playerSongPaths'),
  radioSongPaths};
 if(!routing.radioSongPaths.length){status('NOT SAVED · Retain at least one RADIO track.');return;}
 if(!confirm('PUBLISH FRONT / STORE / PLAYER / RADIO CHECKBOXES?\n\nThis changes public music routing in one GitHub commit. It does not change payments or the live BLITZ DJ queue.'))return;
 busy=true;$('brRouteSave').disabled=true;status('SAVING ALL MUSIC DESTINATIONS…');
 try{
  const result=await ownerApi('POST',{action:'save_catalog_routing',routing,expectedRouting:expected});
  if(!result.commit||!result.routing)throw Error('No GitHub commit confirmation.');
  expected=JSON.parse(JSON.stringify(result.routing));useRecord(result.routing);render();
  status('PUBLISHED · '+result.commit.slice(0,12)+' · ALL CHECKBOXES SAVED.');
 }catch(error){status('NOT SAVED · '+String(error.message||error))}
 finally{busy=false;updateCount()}
}
async function rebuild(){
 if(busy)return;
 if(changed()&&!confirm('Discard unsaved routing changes before rebuilding the manifest?'))return;
 if(!confirm('REBUILD THE MUSIC MANIFEST FROM THE FILES IN GITHUB?\n\nThis will not change audio files, playlists, purchases or the live DJ program.'))return;
 busy=true;$('brRouteRebuild').disabled=true;status('SCANNING GITHUB MUSIC FILES…');
 try{
  const result=await ownerApi('POST',{action:'rebuild_manifest'});
  busy=false;
  await load(true);
  status('MANIFEST '+(result.unchanged?'CURRENT':'REBUILT')+' · '+result.count+' FILES'+
   (result.commit?' · '+result.commit.slice(0,12):'')+' · If GitHub Pages still shows the older list, press REFRESH again.');
 }catch(error){status('MANIFEST NOT REBUILT · '+String(error.message||error))}
 finally{busy=false;$('brRouteRebuild').disabled=false}
}
for(const id of ['brRadioStationStatus','brRadioPlaylistTools']){
 const el=$(id);if(el)$('brRouteRadioAux').append(el);
}
$('brRouteRefresh').addEventListener('click',()=>void load());
$('brRouteSave').addEventListener('click',()=>void save());
$('brRouteRebuild').addEventListener('click',()=>void rebuild());
$('brRouteSearch').addEventListener('input',render);
$('brRouteAlbum').addEventListener('change',render);
root.querySelectorAll('[data-route-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.routeView)));
const prior=window.GE_BACKROOM_TAB_SELECTED;
window.GE_BACKROOM_TAB_SELECTED=tab=>{prior?.(tab);if(tab==='radio'&&token()&&!loaded)void load()};
window.GE_BACKROOM_ROUTER_LOAD=()=>{if(token()&&!loaded)void load()};
setView('all');
})();
