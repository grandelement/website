/* GRAND ELEMENT MUSIC V5 · Single-scroll library (2026-10-24)
   Self-contained UI with Shadow DOM: no old Radio picker styles or scroll scripts.
   Published songs and GE DJ playlists remain source-of-truth. */
(()=>{
'use strict';
const BUILD='GE-MUSIC-V5.8-20261027-CHECKED-SONG-DRAG-ORDER';
const button=document.getElementById('geMusicV5Button');
if(!button)return;
const store='GE_MUSIC_V3_SELECTION_20261024',myKey='GE_MUSIC_PERSONAL_PLAYLISTS_V1',
  musicSessionKey='GE_MUSIC_CODE_SESSION_V1',
  musicSessionEndpoint='https://vault.grandelement.com/v1/public/access/music-session';
const albumOrder=['Singles','Aether','Fire','Spirit','Soul','Love','Intergy','Sessions II','Sessions I','Live','Trio','Fundamental Groove'];
// Representative hues visually checked against all 11 JPG covers in
// ge-images/images. These are NOT the unrelated GOLF_PLANETS gameplay colors.
const albumColors={'Fundamental Groove':'#b94754','Trio':'#a86b3d','Live':'#829343','Sessions I':'#388c76','Sessions II':'#2e9bb1','Intergy':'#635293','Love':'#9b357d','Soul':'#c84cba','Spirit':'#d29482','Fire':'#dbca64','Aether':'#bfc4cd','Singles':'#6e9bb5'};
function applyAlbumStyle(element,name){
 const hex=albumColors[name]||'#addcf5';
 element.style.borderLeft='4px solid '+hex;
 const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
 element.style.background='linear-gradient(90deg,rgba('+r+','+g+','+b+',.32),rgba('+r+','+g+','+b+',.13))';
}
const state={open:false,loading:false,loaded:false,tracks:[],view:'all',term:'',selected:new Set(),publicLists:[],assignedLists:[],accessView:'order',accessPlaylistFilter:'',activePlaylist:null,arranging:false,notice:'',playlistsLoading:false,playlistMessage:'CONNECTING TO GITHUB PLAYLISTS…',musicAccess:null,redeemBusy:false};
try{
 const saved=JSON.parse(sessionStorage.getItem(musicSessionKey)||'null');
 if(saved&&saved.token&&Number(saved.until)>Date.now()&&Array.isArray(saved.allowed))
   state.musicAccess=saved;
}catch(_){}
try{const raw=JSON.parse(localStorage.getItem(store)||'[]');if(Array.isArray(raw))state.selected=new Set(raw.filter(x=>typeof x==='string'))}catch(_){}
const host=document.createElement('div');host.id='geMusicV5Host';host.dataset.build=BUILD;
host.style.cssText='position:fixed;inset:0;z-index:60010;display:none;isolation:isolate';
const root=host.attachShadow({mode:'open'});
root.innerHTML=`
<style>
:host{all:initial;display:block;color:#ecfaff;font:16px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif}
*,*::before,*::after{box-sizing:border-box}
button,input{font:inherit}
.backdrop{position:absolute;inset:0;background:rgba(0,4,12,.86);backdrop-filter:blur(5px)}
.window{position:absolute;left:50%;top:max(45px,calc(env(safe-area-inset-top) + 7px));bottom:max(12px,calc(env(safe-area-inset-bottom) + 8px));transform:translateX(-50%);width:min(770px,calc(100vw - 16px));max-height:calc(100dvh - 50px);background:#061626;border:2px solid #48bfff;border-radius:15px;box-shadow:0 15px 55px #000;display:flex;flex-direction:column;overflow:hidden}
.header{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:linear-gradient(110deg,#004caa,#0c89ec,#023b74);border-bottom:1px solid #64dfff}
.brand{font-weight:900;letter-spacing:.05em;font-size:15px}.build{display:block;color:#e7f9ff;font-size:10px;font-weight:700;opacity:.9}
button{display:inline-flex;justify-content:center;align-items:center;text-align:center;border:1px solid #4c9ac8;border-radius:9px;color:#ebfaff;background:#0e314e;min-height:39px;padding:8px 10px;font-weight:750;cursor:pointer;touch-action:manipulation}
button:focus-visible,input:focus-visible{outline:2px solid #fff;outline-offset:2px}
button:disabled{opacity:.5;cursor:not-allowed}
.close{background:#001a33;border:1px solid #c6f3ff;min-width:82px}
.tools{flex:0 0 auto;padding:10px 10px 8px;background:#071f35;border-bottom:1px solid #365e7a}
.search{display:block;width:100%;padding:9px 11px;min-height:42px;color:#fff;background:#031321;border:1px solid #4b91bd;border-radius:9px;font-size:16px;margin-top:8px}
.browse{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:9px}
.browse button{min-height:45px;min-width:0;padding:7px 3px;font-size:clamp(11px,3.1vw,15px);background:#103753}
.browse button[aria-pressed=true]{background:#1378c5;border-color:#b5f2ff;color:white;box-shadow:inset 0 0 10px #2b99e9}
.browse{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.browse button{font-size:clamp(13px,3.5vw,17px);min-height:43px}
.filterRow{display:grid;grid-template-columns:1fr;gap:5px;margin:8px 0 0}
.filterRow select{width:100%;min-width:0;min-height:42px;padding:8px 10px;border:1px solid #5898c7;border-radius:9px;background:#10314d;color:#ecfaff;font-size:clamp(13px,3.5vw,16px);font-weight:750}
.filterRow select[hidden]{display:none!important}
.libraryAction{display:flex;justify-content:space-between;gap:8px;align-items:center}
.libraryAction button{font-size:12px;min-height:36px;padding:5px 9px}
.musicCodeTools{margin-top:9px;border:1px solid #285b7d;border-radius:9px;padding:7px;background:#062238}
.musicCodeTools summary{cursor:pointer;color:#aee9ff;font-size:12px;font-weight:800}
.musicCodeRow{display:flex;align-items:center;gap:6px;margin-top:8px}
.musicCodeRow input{min-width:0;flex:1;color:#fff;background:#031321;border:1px solid #4b91bd;border-radius:8px;padding:8px 9px;font-size:16px;min-height:41px}
.musicCodeRow button{min-height:41px;font-size:12px}
.musicCodeState{color:#abeaff;font-size:11px;margin-top:6px}
.song button[disabled]{opacity:.48}
.breadcrumb{display:flex;align-items:center;gap:8px;margin:4px 0 10px}
.breadcrumb strong{min-width:0;font-size:14px;overflow-wrap:anywhere}
.album{min-width:0}
.album .countHint{white-space:nowrap}
.empty{font-size:13px;line-height:1.45}
.scroll{scrollbar-width:thin}
@media(max-width:420px){.browse button{font-size:12px}.header .brand{font-size:13px}}
.metaLine{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:7px;min-height:32px}
.meta{color:#addcf5;font-size:12px;min-width:0;flex:1;text-align:left}
.arrangeBtn{min-height:30px;padding:4px 13px;font-size:12px;background:#135d91;border:1px solid #75cfff;color:#f4fbff}
.arrangeBtn[aria-pressed="true"]{background:#187dba;border-color:#b9e9ff;box-shadow:0 0 9px rgba(52,176,245,.28)}
.arrangeBtn[hidden],.notice:empty{display:none!important}
.notice{color:#c5efff;font-size:12px;margin-top:4px;min-height:0}
.song.sortable{cursor:grab;user-select:none;-webkit-user-select:none;border:1px solid rgba(122,204,252,.20);border-radius:7px;margin:0 0 5px;touch-action:pan-y}
.song.sortable .songLabel{user-select:none;-webkit-user-select:none;pointer-events:none}
.song.sortable .songInfo{display:flex;align-items:center;gap:10px;flex:1;min-width:0;overflow:hidden}
.song.draggingSong{position:relative;z-index:15;cursor:grabbing;border:1px solid #b1e7ff;box-shadow:0 0 0 2px rgba(65,181,250,.55),0 7px 20px rgba(0,0,0,.65);filter:brightness(1.15);transform:scale(1.012)}
@media(max-width:420px){.song.sortable{gap:4px}.song .reorder{min-width:30px;padding:4px 3px;font-size:18px}.song .songInfo{gap:6px}}
.scroll{display:block;flex:1 1 0px;height:0;min-height:0;min-width:0;overflow-y:scroll;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:11px 10px 40px;scroll-behavior:auto;position:relative}
.album{display:flex;width:100%;justify-content:space-between;gap:10px;min-height:52px;margin:0 0 7px;background:linear-gradient(110deg,#0c3b66,#071e32);border:1px solid #4384b0}
.album b{min-width:0;overflow-wrap:anywhere;text-align:left}.album small{color:#a3dbff;flex:0 0 auto}
.section{padding:8px 7px;background:#0c3653;border-bottom:1px solid #4384ac;font-weight:850;margin:12px 0 5px}
.song{display:flex;align-items:center;gap:9px;min-height:49px;padding:6px 4px;border-bottom:1px solid #203d53;touch-action:pan-y}
.song label{display:flex;align-items:center;gap:10px;flex:1;min-width:0;overflow-wrap:anywhere;cursor:pointer}
.song input[type=checkbox]{flex:0 0 auto;width:21px;height:21px;accent-color:#41d5ff}
.song span{min-width:0;overflow-wrap:anywhere;font-size:13px}
.song .songLabel{flex:1;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:750}
.albumJump{min-width:0;width:100%;margin-top:7px;padding:8px 10px;min-height:40px;border:1px solid #4b91bd;border-radius:9px;background:#09243a;color:white;font-size:14px}
.song button{flex:0 0 auto;min-width:45px;min-height:38px;background:#1165a5;border-color:#5cd9ff;font-size:13px}
.song .reorder{min-width:38px;padding:4px 6px;font-size:19px}
.albumPicker{display:flex;align-items:center;gap:9px;background:#0b3553;border:1px solid #376f95;border-radius:7px;padding:9px;margin:8px 0 5px}
.albumPicker input{width:21px;height:21px;accent-color:#41d5ff}
.albumPicker span{font-weight:800;font-size:13px}
.albumBrowseRow{display:flex;align-items:stretch;gap:0;min-height:49px;margin:0 0 8px;border:1px solid rgba(154,211,239,.55);border-radius:10px;overflow:hidden}
.albumBrowseRow .albumPickerCompact{display:flex;align-items:center;justify-content:center;flex:0 0 44px;min-width:44px;max-width:44px;min-height:47px;padding:0 8px;margin:0;background:transparent!important;border:0!important;border-right:1px solid rgba(160,225,255,.25)!important;border-radius:0;cursor:pointer}
.albumBrowseRow .albumPickerCompact input{width:21px;height:21px;flex:0 0 21px;margin:0;accent-color:#48baff}
.albumBrowseRow .album{display:flex;align-items:center;justify-content:space-between;flex:1 1 0;min-width:0;min-height:47px;padding:7px 10px;gap:8px;margin:0;border:0!important;border-radius:0;background:transparent!important;box-shadow:none!important}
.albumBrowseRow .album b{flex:1;min-width:0;text-align:left;font-size:clamp(13px,3.5vw,17px);line-height:1.15;overflow-wrap:break-word}
.albumBrowseRow .album small{flex:0 0 auto;white-space:nowrap;font-size:clamp(10px,2.8vw,13px);font-weight:800;color:#b7e6ff}
@media(max-width:420px){.albumBrowseRow .album{padding:6px 7px;gap:5px}.albumBrowseRow .album b{font-size:14px}.albumBrowseRow .album small{font-size:11px}}
.bottom{flex:0 0 auto;display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 10px max(10px,env(safe-area-inset-bottom));background:#071f34;border-top:1px solid #45769b}
.bottom .count{flex:1;font-size:12px;color:#afdfff}
.bottom button{font-size:12px;min-height:36px}
.playlist{margin:0 0 9px;padding:10px;border:1px solid #3d89ba;border-radius:10px;background:#0c2940}
.playlist h3{margin:0 0 8px;font-size:15px}
.playlist p{color:#aed8ef;margin:4px 0 9px;font-size:12px}
.playlist .actions{display:flex;flex-wrap:wrap;gap:7px}
.playlist input{width:100%;min-height:42px;border-radius:9px;border:1px solid #5caccf;background:#05192a;color:#fff;padding:8px;margin-bottom:8px}
.empty{color:#c0ddef;padding:18px 7px}
@media(max-width:420px){.window{border-radius:11px}.brand{font-size:13px}.tools{padding:8px}.song{gap:5px}.song span{font-size:12px}.bottom{padding:7px}.bottom button{font-size:11px}}
</style>
<div class="backdrop"></div>
<section class="window" role="dialog" aria-modal="true" aria-label="Grand Element music library">
 <div class="header"><div class="brand">GRAND ELEMENT · MUSIC<span class="build">SINGLE SCROLL · MUSIC V5.8</span></div><button class="close" type="button">CLOSE</button></div>
 <div class="tools"><div class="libraryAction"><strong>CHOOSE MUSIC</strong><button type="button" class="geV5Refresh" aria-label="Refresh GitHub GE playlists">REFRESH PLAYLISTS</button></div><details class="musicCodeTools"><summary>HAVE A GE ACCESS CODE? ENTER IT HERE</summary><div class="musicCodeRow"><input class="musicCodeInput" type="password" autocomplete="off" spellcheck="false" placeholder="GE Access Code" aria-label="Enter your GE Music access code"><button class="musicCodeUnlock" type="button">UNLOCK</button><button class="musicCodeClear" type="button">CLEAR CODE</button></div><div class="musicCodeState" role="status" aria-live="polite">Code grants are verified privately against GE Vault.</div></details><nav class="browse" aria-label="Music workspaces"><button type="button" data-tab="songs" aria-pressed="true">SONGS</button><button type="button" data-tab="playlists" aria-pressed="false">PLAYLISTS</button></nav><div class="filterRow"><select class="songFilter" aria-label="Filter songs"><option value="all">ALL SONGS</option><option value="checked">CHECKED SONGS</option><option value="albums">BROWSE ALBUMS</option></select><select class="playlistFilter" aria-label="Filter playlists" hidden><option value="user-playlists">USER PLAYLISTS</option><option value="ge-playlists">GE PLAYLISTS</option><option value="playlist-order">CHECKED SONGS · ARRANGE</option></select></div><input class="search" type="search" placeholder="Find a song, album, or playlist" aria-label="Search music or playlists">
 <div class="accessViews" hidden style="margin-top:9px;display:none;gap:6px;flex-wrap:wrap"><button type="button" data-access-view="order">MY ORDER</button><button type="button" data-access-view="album">BY ALBUM</button><button type="button" data-access-view="playlist">PLAYLISTS</button></div><div class="metaLine"><span class="meta" aria-live="polite">Loading published music…</span><button type="button" class="arrangeBtn" aria-pressed="false" hidden>ARRANGE</button></div><div class="notice" role="status" aria-live="polite"></div></div>
 <div class="scroll" role="region" aria-label="Scrollable Grand Element music collection" tabindex="0"></div>
 <div class="bottom"><span class="count">SELECTION</span><button data-action="clear" type="button">CLEAR</button><button data-action="save" type="button">SAVE USER PLAYLIST</button></div>
</section>`;
document.body.appendChild(host);
const el=sel=>root.querySelector(sel),scroller=el('.scroll'),meta=el('.meta'),notice=el('.notice');
// Keep native iOS scrolling within this Shadow DOM. The old Radio document
// touch handler must not cancel scrolling through event retargeting.
scroller.addEventListener('touchmove',event=>event.stopPropagation(),{passive:true});
scroller.addEventListener('touchstart',event=>event.stopPropagation(),{passive:true});
const saveSelected=()=>{try{localStorage.setItem(store,JSON.stringify([...state.selected]))}catch(_){}};
function canonical(input){const s=String(input||'').replace(/^\/+/, '');try{const path=s.startsWith('ge-music/music/')?decodeURIComponent(s):decodeURIComponent(new URL(s,location.href).pathname.replace(/^\/+/,''));return /^ge-music\/music\/.+\.(mp3|m4a|wav|ogg)$/i.test(path)&&!path.includes('..')?path:''}catch(_){return ''}}
function details(path){
 const pieces=path.split('/'),folder=pieces[2]||'',file=pieces.slice(3).join('/');
 const album=folder.replace(/^Grand Element - \d{4} - /,'').trim()||folder;
 const title=file.replace(/\.(mp3|m4a|wav|ogg)$/i,'').replace(/^.*?_\d+[_-]?\s*/,'').replace(/_/g,' ');
 const m=file.match(/_(\d+)[_-]/);
 return{path,album,title:title||file,number:m?Number(m[1]):999};
}
const rank=name=>{const i=albumOrder.indexOf(name);return i<0?999:i};
function say(s){state.notice=s;notice.textContent=s||''}
function updateMeta(){meta.textContent='';el('.count').textContent='YOUR MUSIC SELECTION'}
function elem(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
async function fetchCatalog(){
 const all=[];
 for(const [file,key] of [['./manifest.json','files'],['./track-durations.json','tracks']]){
  try{
   const response=await fetch(file+'?musicv3='+BUILD,{cache:'no-store'});
   if(!response.ok)continue;
   const data=await response.json(),rows=Array.isArray(data[key])?data[key]:[];
   for(const item of rows){const path=canonical(key==='files'?item:item?.path);if(path)all.push(path)}
  }catch(error){console.warn('MUSIC V5 catalog source',file,error)}
 }
 const unique=[...new Set(all)].map(details);
 unique.sort((a,b)=>rank(a.album)-rank(b.album)||a.album.localeCompare(b.album)||a.number-b.number||a.title.localeCompare(b.title));
 state.tracks=unique;state.loaded=true;state.loading=false;
  const filter=el('.songFilter'),prior=filter.value;
  filter.replaceChildren(new Option('ALL SONGS','all'),new Option('CHECKED SONGS','checked'),new Option('BROWSE ALBUMS','albums'));
  for(const album of albumOrder.filter(name=>unique.some(track=>track.album===name)))
    filter.add(new Option('ALBUM · '+album,'album:'+album));
  if(prior&&[...filter.options].some(option=>option.value===prior))filter.value=prior;
  updateMeta();render();
 if(!unique.length)say('The published library could not be loaded. Check network and refresh.');
}
function readMine(){
 try{const rows=JSON.parse(localStorage.getItem(myKey)||'[]');return Array.isArray(rows)?rows.filter(x=>x&&typeof x.name==='string'&&Array.isArray(x.songs)).slice(0,100):[]}
 catch(_){return[]}
}
function saveMine(){
 const name=prompt('Name your private playlist:',state.activePlaylist?.source==='user'?state.activePlaylist.name:'My Playlist');if(name==null)return;
 const clean=name.trim().slice(0,100);if(!clean||!state.selected.size){say('Select songs and enter a playlist name first.');return}
 const mine=readMine(),found=mine.find(x=>x.name.toLowerCase()===clean.toLowerCase());
 if(found&&!confirm('Overwrite your saved playlist "'+found.name+'" on this device?'))return;
 const row={id:found?.id||('music-'+Date.now().toString(36)),name:clean,songs:[...state.selected],updatedAt:Date.now()};
 const updated=[row,...mine.filter(x=>x.id!==row.id)].slice(0,100);
 try{
   localStorage.setItem(myKey,JSON.stringify(updated));
   recordPlaylistInteraction('control_change',{control:'user_playlist_save',playlist_id:row.id,song_count:row.songs.length,storage:'local_device'});
   state.activePlaylist={source:'user',id:row.id,name:row.name};say('Saved on THIS DEVICE ONLY · Cross-device fan playlist syncing is not connected yet.');setView('user-playlists')
 }
 catch(_){say('Could not save this playlist on this device.')}
}
async function loadPublished(){
 if(state.playlistsLoading)return;
 state.playlistsLoading=true;state.playlistMessage='LOADING GITHUB PLAYLIST MASTER…';
 if(state.open)render();
 try{
  const response=await fetch('https://raw.githubusercontent.com/grandelement/website/main/playlists/registry.json?refresh='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('GitHub HTTP '+response.status);
  const data=await response.json();
  if(data?.format!=='ge-playlist-registry-v1'||!Array.isArray(data.playlists))
    throw Error('Invalid GitHub playlist format');
  const valid=p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.songs);
  state.publicLists=data.playlists.filter(p=>valid(p)&&p.visibility==='published')
   .map(p=>({id:p.id,name:p.name,songs:p.songs.map(canonical).filter(Boolean)})).filter(p=>p.songs.length);
  const assigned=new Set(musicAccessActive()?.playlistIds||[]);
  state.assignedLists=data.playlists.filter(p=>valid(p)&&assigned.has(p.id))
   .map(p=>({id:p.id,name:p.name,songs:p.songs.map(canonical).filter(Boolean)}));
  state.playlistMessage='GITHUB CONNECTED · '+state.publicLists.length+' PUBLISHED PLAYLIST'+(state.publicLists.length===1?'':'S');
 }catch(error){
  state.publicLists=[];state.assignedLists=[];
  state.playlistMessage='GITHUB PLAYLIST FILE UNAVAILABLE · '+String(error.message||error);
 }finally{state.playlistsLoading=false;if(state.open)render()}
}

function recordPlaylistInteraction(eventType,detail){
 // Reuse the existing GE Fan Base Vault ledger. It supplies anonymous visitor
 // and session IDs and handles network identity privately server-side.
 // Never send an IP address or private fan details to the public GitHub registry.
 try{void window.GEVault?.radio?.(eventType,detail)}catch(_e){}
}
function musicAccessActive(){
 // Radio Gate may be unlocked AFTER this module initializes: read the latest
 // signed Vault receipt, never an old LOVE flag or a code display label.
 try{
  const saved=JSON.parse(sessionStorage.getItem(musicSessionKey)||'null');
  if(saved&&typeof saved.token==='string'&&Number(saved.until)>Date.now()&&
     Array.isArray(saved.allowed)&&typeof saved.restricted==='boolean'&&
     (!state.musicAccess||saved.token!==state.musicAccess.token))state.musicAccess=saved;
 }catch(_){}
 if(state.musicAccess&&Number(state.musicAccess.until)>Date.now())return state.musicAccess;
 if(state.musicAccess){state.musicAccess=null;try{sessionStorage.removeItem(musicSessionKey)}catch(_){}}
 return null;
}
function musicAccessStatus(){
 const access=musicAccessActive(),status=el('.musicCodeState');
 status.textContent=access?
   ('CODE ACTIVE · '+(access.restricted?'AUTHORIZED MUSIC':'ALL MUSIC')+' · EXPIRES '+new Date(access.until).toLocaleTimeString()):
   'No Music code active · Existing guest previews remain available.';
}
function clearMusicAccess(){
 state.musicAccess=null;
 try{sessionStorage.removeItem(musicSessionKey)}catch(_){}
 el('.musicCodeInput').value='';
 musicAccessStatus();say('Music code cleared. Guest previews remain available.');setView('all');
}
async function musicCodeRequest(body){
 const response=await fetch(musicSessionEndpoint,{
   method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
   body:JSON.stringify(body)
 });
 const data=await response.json().catch(()=>({ok:false,error:'Invalid Vault response'}));
 if(!response.ok||data?.ok!==true)
   throw Error(String(data.error||('Vault HTTP '+response.status)));
 return data;
}
async function redeemMusicCode(){
 if(state.redeemBusy)return;
 const code=el('.musicCodeInput').value.trim();
 if(!code){say('Enter the Music access code first.');return}
 state.redeemBusy=true;el('.musicCodeUnlock').disabled=true;
 el('.musicCodeState').textContent='Verifying code with GE Vault…';
 try{
   const data=await musicCodeRequest({action:'redeem',code});
   const allowed=Array.isArray(data.allowed_tracks)?
     [...new Set(data.allowed_tracks.map(canonical).filter(Boolean))]:[];
   const access={token:String(data.token||''),until:Number(data.session_expires_at)*1000,
     restricted:!!data.restricted,allowed,playlistIds:Array.isArray(data.playlist_ids)?data.playlist_ids:[]};
   if(!access.token||access.until<=Date.now())throw Error('Music session not confirmed.');
   state.musicAccess=access;
   try{sessionStorage.setItem(musicSessionKey,JSON.stringify(access))}catch(_){}
   el('.musicCodeInput').value='';musicAccessStatus();
   if(access.restricted){
     state.selected=new Set(allowed);saveSelected();void loadPublished();
     setView('access-code');
     say('Music code verified · authorized music loaded.');
   }else{setView('all');say('Music code verified for the full music library.')}
 }catch(error){
   clearMusicAccess();say('MUSIC CODE NOT ACTIVE · '+String(error.message||error));
 }finally{state.redeemBusy=false;el('.musicCodeUnlock').disabled=false}
}
async function playTrack(track){
 // A code-restricted Music session can NEVER substitute the public Radio
 // scope or change the global Bangers broadcast. Verify every requested song.
 const access=musicAccessActive();
 if(access){
   if(access.restricted&&!access.allowed.includes(track.path)){
     say('This song is not included in your code.');return;
   }
   try{await musicCodeRequest({action:'verify',token:access.token,track_path:track.path})}
   catch(error){
     say('MUSIC CODE REJECTED · '+String(error.message||error));clearMusicAccess();return;
   }
 }
 // Existing preview transport remains in charge; code verification alone is
 // not proof of paid-content delivery or a full-length song license.
 const queue=state.view==='access-code'?chosenSongs().map(t=>t.path):[track.path];
 const outcome=window.GEMusicV5Bridge?.play?.(track.path,queue);
 if(outcome?.ok){say('Opening '+track.title+'.');return}
 say(outcome?.message||'Music preview is loading. Tap PLAY again.');
}
function isArrangeView(){return state.arranging&&(state.view==='checked'||state.view==='playlist-order')}
function appendSong(parent,track){
 const sorting=isArrangeView();
 const row=elem('div','song'),label=elem(sorting?'div':'label',sorting?'songInfo':''),checkbox=elem('input');
 if(sorting){row.classList.add('sortable');row.dataset.songPath=track.path;
  row.title='Hold and slide this song to reorder, or use ↑ ↓';}
 checkbox.type='checkbox';checkbox.checked=state.selected.has(track.path);
 checkbox.setAttribute('aria-label','Select '+track.title);
 checkbox.addEventListener('change',()=>{
   checkbox.checked?state.selected.add(track.path):state.selected.delete(track.path);
   saveSelected();updateMeta();
   if(state.view==='checked'||state.view==='playlist-order')render();
   recordPlaylistInteraction('control_change',{
     track_id:track.path,track_title:track.title,album:track.album,
     control:'playlist_song_selection',choice:checkbox.checked?'add':'remove',
     playlist_id:(state.view.startsWith('vault:')||state.view.startsWith('local:'))?state.view.slice(state.view.indexOf(':')+1):''
   });
 });
 const songText=elem('span','songLabel',track.title+' — '+track.album);
  songText.title=track.title+' — '+track.album;
  label.append(checkbox,songText);
  applyAlbumStyle(row,track.album);
 const play=elem('button','','PLAY');play.type='button';play.setAttribute('aria-label','Play '+track.title);
 const access=musicAccessActive();
 if(access?.restricted&&!access.allowed.includes(track.path)){
   play.disabled=true;play.title='Not authorized by the current Music code';
 }
 play.addEventListener('click',()=>playTrack(track));
 row.append(label,play);
 if(sorting){
   const ordered=[...state.selected],index=ordered.indexOf(track.path);
   const swap=other=>{
     if(other<0||other>=ordered.length||index<0)return;
     [ordered[index],ordered[other]]=[ordered[other],ordered[index]];
     state.selected=new Set(ordered);saveSelected();render();
     say('ORDER UPDATED · SAVE USER PLAYLIST to keep this order on this device.');
   };
   const up=elem('button','reorder','↑');up.type='button';up.disabled=index<=0;
   up.setAttribute('aria-label','Move '+track.title+' up');up.addEventListener('click',()=>swap(index-1));
   const down=elem('button','reorder','↓');down.type='button';down.disabled=index===ordered.length-1;
   down.setAttribute('aria-label','Move '+track.title+' down');down.addEventListener('click',()=>swap(index+1));
   row.append(up,down);
 }
 parent.appendChild(row);
}

/* CHECKED SONG ORDER: hold an entire row (not its checkbox or PLAY)
   for 280ms on touch; click-and-drag on desktop. Reuses the existing selection
   Set and saveSelected(), never duplicates tracks or writes a playlist remotely. */
let dragSession=null;
function sortableRow(target){
 if(!state.open||!isArrangeView()||state.term||!(target instanceof Element))return null;
 if(target.closest('button,input,select,textarea,a'))return null;
 const row=target.closest('.song.sortable');
 return row&&scroller.contains(row)?row:null;
}
function activateDrag(session){
 if(dragSession!==session||!session.row.isConnected)return;
 session.active=true;
 session.row.classList.add('draggingSong');
 session.row.setAttribute('aria-grabbed','true');
}
function repositionDraggedRow(y){
 const session=dragSession;if(!session?.active)return;
 const row=session.row;
 const others=[...scroller.querySelectorAll('.song.sortable')].filter(el=>el!==row);
 const before=others.find(el=>y<el.getBoundingClientRect().top+el.getBoundingClientRect().height/2);
 if(before){if(row.nextSibling!==before)scroller.insertBefore(row,before)}
 else if(others.length&&row!==others[others.length-1])scroller.append(row);
}
function autoScrollDrag(){
 const session=dragSession;if(!session?.active)return;
 const rect=scroller.getBoundingClientRect(),edge=Math.min(60,rect.height*.18);
 let step=0;
 if(session.y<rect.top+edge)step=-Math.min(18,4+(rect.top+edge-session.y)*.24);
 else if(session.y>rect.bottom-edge)step=Math.min(18,4+(session.y-(rect.bottom-edge))*.24);
 if(step){scroller.scrollTop+=step;repositionDraggedRow(session.y)}
 session.frame=requestAnimationFrame(autoScrollDrag);
}
function finishDrag(commit=true){
 const session=dragSession;if(!session)return;
 dragSession=null;
 if(session.timer)clearTimeout(session.timer);
 if(session.frame)cancelAnimationFrame(session.frame);
 session.row.classList.remove('draggingSong');
 session.row.removeAttribute('aria-grabbed');
 if(!session.active)return;
 if(commit){
  const rows=[...scroller.querySelectorAll('.song.sortable')].map(row=>row.dataset.songPath).filter(Boolean);
  const seen=new Set(rows),leftover=[...state.selected].filter(path=>!seen.has(path));
  const old=[...state.selected],next=[...rows,...leftover];
  if(old.join('\n')!==next.join('\n')){
   state.selected=new Set(next);
   saveSelected();
   say('SONG ORDER UPDATED · SAVE USER PLAYLIST to keep it as a named playlist.');
  }
 }
 if(state.open)render();
}
scroller.addEventListener('touchstart',event=>{
 if(event.touches.length!==1)return;
 const row=sortableRow(event.target);if(!row)return;
 if(dragSession)finishDrag(false);
 const t=event.touches[0];
 const session={kind:'touch',row,id:t.identifier,x:t.clientX,y:t.clientY,startY:t.clientY,active:false,timer:0,frame:0};
 dragSession=session;
 session.timer=setTimeout(()=>{
  if(dragSession!==session)return;
  activateDrag(session);
  session.frame=requestAnimationFrame(autoScrollDrag);
 },280);
},{passive:true});
scroller.addEventListener('touchmove',event=>{
 const session=dragSession;if(session?.kind!=='touch')return;
 const t=[...event.touches].find(t=>t.identifier===session.id);
 if(!t)return;
 session.y=t.clientY;
 if(!session.active){
  if(Math.abs(t.clientY-session.startY)>9||Math.abs(t.clientX-session.x)>9)finishDrag(false);
  return;
 }
 if(event.cancelable)event.preventDefault();
 event.stopPropagation();
 repositionDraggedRow(t.clientY);
},{passive:false});
scroller.addEventListener('touchend',event=>{
 const session=dragSession;if(session?.kind!=='touch')return;
 if([...event.changedTouches].some(t=>t.identifier===session.id))finishDrag();
});
scroller.addEventListener('touchcancel',()=>{if(dragSession?.kind==='touch')finishDrag(false)});
scroller.addEventListener('contextmenu',event=>{
 if(isArrangeView()&&event.target.closest('.song.sortable'))event.preventDefault();
});
scroller.addEventListener('mousedown',event=>{
 if(event.button!==0)return;
 const row=sortableRow(event.target);if(!row)return;
 if(dragSession)finishDrag(false);
 dragSession={kind:'mouse',row,x:event.clientX,y:event.clientY,startY:event.clientY,active:false,timer:0,frame:0};
});
document.addEventListener('mousemove',event=>{
 const session=dragSession;if(session?.kind!=='mouse')return;
 session.y=event.clientY;
 if(!session.active){
  if(Math.hypot(event.clientX-session.x,event.clientY-session.startY)<6)return;
  activateDrag(session);
  session.frame=requestAnimationFrame(autoScrollDrag);
 }
 event.preventDefault();
 repositionDraggedRow(event.clientY);
});
document.addEventListener('mouseup',()=>{if(dragSession?.kind==='mouse')finishDrag()});

// ONE music scroll surface. Category tabs stay pinned above it; selecting an
// album or playlist replaces content inside the SAME scroll surface.
function setView(view){
 if(dragSession)finishDrag(false);
 state.view=view;state.arranging=view==='playlist-order';
 state.term='';el('.search').value='';
 render();scroller.scrollTop=0;
}
function activeCategory(){
 return state.view==='user-playlists'||state.view==='ge-playlists'||state.view==='playlist-order'||
        state.view.startsWith('vault:')||state.view.startsWith('local:')?'playlists':'songs';
}
function card(parent,title,detail,action,album=''){
 const b=elem('button','album');
 b.type='button';b.append(elem('b','',title),elem('small','countHint',detail));
  if(album)applyAlbumStyle(b,album);
 b.addEventListener('click',action);parent.append(b);
}
function breadcrumb(label,back){
 const wrapper=elem('div','breadcrumb');
 const b=elem('button','','← '+back.toUpperCase());b.type='button';
 b.addEventListener('click',()=>setView(back));
 wrapper.append(b,elem('strong','',label));
 scroller.append(wrapper);
}
function chosenSongs(){
 if(state.view==='checked'||state.view==='playlist-order'){
   const lookup=new Map(state.tracks.map(t=>[t.path,t]));
   return [...state.selected].map(path=>lookup.get(path)).filter(Boolean);
 }
 if(state.view==='access-code'){
  const access=musicAccessActive();if(!access)return [];
  const byPath=new Map(state.tracks.map(t=>[t.path,t]));
  let rows=access.restricted?access.allowed.map(path=>byPath.get(path)).filter(Boolean):state.tracks;
  if(state.accessPlaylistFilter){const p=state.assignedLists.find(x=>x.id===state.accessPlaylistFilter);
    if(p){const ids=new Set(p.songs);rows=rows.filter(t=>ids.has(t.path));}}
  return state.accessView==='album'
    ?rows.slice().sort((a,b)=>rank(b.album)-rank(a.album)||a.number-b.number||a.title.localeCompare(b.title))
    :rows;
 }
 if(state.view.startsWith('album:'))return state.tracks.filter(t=>t.album===state.view.slice(6));
 if(state.view.startsWith('vault:')||state.view.startsWith('local:')){
  const isVault=state.view.startsWith('vault:');
  const p=isVault?state.publicLists.find(p=>p.id===state.view.slice(6)):readMine().find(p=>p.id===state.view.slice(6));
  const lookup=new Map(state.tracks.map(t=>[t.path,t]));
  return(p?.songs||[]).map(path=>lookup.get(path)).filter(Boolean);
 }
 return state.view==='all'?state.tracks:[];
}
function albumSelectAll(parent,album,tracks,compact=false){
 const label=elem('label','albumPicker'),box=elem('input');box.type='checkbox';
 const paths=tracks.map(t=>t.path),count=paths.filter(p=>state.selected.has(p)).length;
 box.checked=paths.length>0&&count===paths.length;
 box.indeterminate=count>0&&count<paths.length;
 box.setAttribute('aria-label','Check the entire album '+album);
 box.addEventListener('change',()=>{
   for(const path of paths)box.checked?state.selected.add(path):state.selected.delete(path);
   saveSelected();render();
 });
 if(compact){
  label.classList.add('albumPickerCompact');
  label.title='Select all songs on '+album;
  label.append(box);
 }else{
  label.append(box,elem('span','',album+' · SELECT ALBUM'));
  applyAlbumStyle(label,album);
 }
 parent.append(label);
}
function render(){
 if(!state.open)return;
 const cat=activeCategory();
 const access=musicAccessActive(),views=el('.accessViews');
 views.hidden=!(state.view==='access-code'&&access?.restricted);
 views.style.display=views.hidden?'none':'flex';
 root.querySelectorAll('[data-access-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.accessView===state.accessView)));
 root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===cat)));
 const songFilter=el('.songFilter'),playlistFilter=el('.playlistFilter');
 songFilter.hidden=cat!=='songs';playlistFilter.hidden=cat!=='playlists';
 const songView=state.view==='access-code'?'all':state.view;
 songFilter.value=[...songFilter.options].some(o=>o.value===songView)?songView:'all';
 playlistFilter.value=state.view==='ge-playlists'?'ge-playlists':state.view==='user-playlists'?'user-playlists':'playlist-order';
 el('.search').placeholder=cat==='songs'?'Find a song or album':'Find a playlist or checked song';
 const previous=scroller.scrollTop;
 scroller.replaceChildren();updateMeta();
 const term=state.term.toLowerCase().trim();
 const filterTrack=t=>(t.title+' '+t.album).toLowerCase().includes(term);
 notice.textContent=state.notice||(cat==='playlists'?state.playlistMessage:'');
 const arrangeBtn=el('.arrangeBtn');
 arrangeBtn.hidden=!(state.view==='checked'||state.view==='playlist-order');
 arrangeBtn.textContent=state.arranging?'DONE':'ARRANGE';
 arrangeBtn.setAttribute('aria-pressed',String(state.arranging));
 arrangeBtn.title=state.arranging?'Finish arranging':'Hold and drag a song row to reorder';
 if(!state.loaded){scroller.append(elem('p','empty','Loading the published Grand Element catalog…'));return}
 if(state.view==='albums'&&term){
  // Album-search returns individual matching song titles, not album-only cards.
  const results=state.tracks.filter(filterTrack);
  for(const track of results)appendSong(scroller,track);
  if(!results.length)scroller.append(elem('p','empty','No songs match that search.'));
  meta.textContent='SONG SEARCH';
 }else if(state.view==='albums'){
  const names=[...new Set(state.tracks.map(t=>t.album))];
  for(const name of names){
    const rows=state.tracks.filter(t=>t.album===name);
    if(term&&!name.toLowerCase().includes(term)&&!rows.some(filterTrack))continue;
    // Single album row: independent select-all checkbox + VIEW SONGS action.
    const wrapper=elem('div','albumBrowseRow');
    applyAlbumStyle(wrapper,name);
    albumSelectAll(wrapper,name,rows,true);
    card(wrapper,name,'VIEW SONGS',()=>setView('album:'+name));
    scroller.append(wrapper);
  }
  if(!scroller.children.length)scroller.append(elem('p','empty','No albums match that search.'));
  meta.textContent='ALBUMS';
 }else if(state.view==='ge-playlists'){
  scroller.append(elem('div','section','GE PLAYLISTS · GITHUB'));
  scroller.append(elem('p','empty',state.playlistMessage||'Checking GitHub…'));
  const shown=state.publicLists.filter(p=>!term||p.name.toLowerCase().includes(term));
  for(const p of shown)card(scroller,p.name,'OPEN PLAYLIST',()=>{
   state.selected=new Set(p.songs);saveSelected();state.activePlaylist={source:'ge',id:p.id,name:p.name};
   recordPlaylistInteraction('playlist_view',{playlist_id:p.id,playlist_source:'ge_github',song_count:p.songs.length});
   setView('playlist-order');
  });
  if(!state.publicLists.length&&!state.playlistsLoading)scroller.append(elem('p','empty','No published GE playlists are available yet.'));
  meta.textContent='GE PLAYLISTS';
 }else if(state.view==='user-playlists'){
  scroller.append(elem('div','section','USER PLAYLISTS · THIS DEVICE ONLY'));
  const local=readMine().filter(p=>!term||p.name.toLowerCase().includes(term));
  for(const p of local){
   card(scroller,p.name,'OPEN PLAYLIST',()=>{
     state.selected=new Set(p.songs);saveSelected();state.activePlaylist={source:'user',id:p.id,name:p.name};
     recordPlaylistInteraction('playlist_view',{playlist_id:p.id,playlist_source:'user_local_device',song_count:p.songs.length});
     setView('playlist-order');
   });
  }
  if(!local.length)scroller.append(elem('p','empty','Check songs under ALL SONGS, then SAVE USER PLAYLIST. Saved only on this device until fan account synchronization is ready.'));
  else scroller.append(elem('p','empty','Saved on this device only. Permanent fan playlist and analytics syncing is not connected yet.'));
  meta.textContent='USER PLAYLISTS';
 }else if(state.view==='access-code'&&state.accessView==='playlist'){
  breadcrumb('YOUR ASSIGNED PLAYLISTS','all');
  const allowed=new Set(musicAccessActive()?.allowed||[]);
  const named=state.assignedLists.filter(p=>p.songs.some(song=>allowed.has(song)));
  for(const p of named)card(scroller,p.name,'OPEN PLAYLIST',()=>{
   state.accessView='order';state.accessPlaylistFilter=p.id;render();scroller.scrollTop=0;
  });
  if(!named.length)scroller.append(elem('p','empty','Your songs were selected individually. Choose MY ORDER.'));
  meta.textContent='ASSIGNED PLAYLISTS';
 }else{
  const chosen=chosenSongs();
  const shown=chosen.filter(filterTrack);
  if(state.view==='access-code')breadcrumb(state.accessView==='album'?'AUTHORIZED MUSIC · ALBUM HISTORY':'AUTHORIZED MUSIC · MY ORDER','all');
  if(state.view.startsWith('album:'))breadcrumb(state.view.slice(6),'albums');
  if(state.view.startsWith('vault:')||state.view.startsWith('local:')){
   const isVault=state.view.startsWith('vault:');
   const p=isVault?state.publicLists.find(p=>p.id===state.view.slice(6)):readMine().find(p=>p.id===state.view.slice(6));
   breadcrumb(p?.name||'Playlist',isVault?'ge-playlists':'user-playlists');
  }
  let currentAlbum='';
  for(const t of shown){
   if(state.view==='all'&&t.album!==currentAlbum){
     currentAlbum=t.album;
     albumSelectAll(scroller,currentAlbum,state.tracks.filter(row=>row.album===currentAlbum));
   }
   appendSong(scroller,t);
  }
  if(!shown.length)scroller.append(elem('p','empty','No tracks match your selection. The album and playlist records have not been changed.'));
  meta.textContent=state.view==='playlist-order'?(state.activePlaylist?.name||'CHECKED SONGS'):state.view==='checked'?'CHECKED SONGS':'SONGS';
 }
 scroller.scrollTop=previous;
}
let previousFocus=null,oldBodyOverflow='';
function open(){
 if(state.open)return;
 state.open=true;state.notice='';
 previousFocus=document.activeElement;oldBodyOverflow=document.body.style.overflow;
 document.body.classList.add('ge-music-v5-open');
 document.body.style.setProperty('overflow','hidden','important');
 host.style.display='block';button.setAttribute('aria-expanded','true');
 window.GEMusicV5Bridge?.prepare?.();
 const access=musicAccessActive();
 if(access?.restricted){
  state.view='access-code';
  if(access.radioPlaylistId)state.accessPlaylistFilter=access.radioPlaylistId;
 }
 musicAccessStatus();
 if(!state.loaded&&!state.loading){state.loading=true;void fetchCatalog()}
 void loadPublished();render();scroller.scrollTop=0;root.querySelector('[data-tab="'+activeCategory()+'"]').focus();
}
function close(){
 if(!state.open)return;
 state.open=false;host.style.display='none';document.body.classList.remove('ge-music-v5-open');
 document.body.style.overflow=oldBodyOverflow;
 button.setAttribute('aria-expanded','false');previousFocus?.focus?.();
}
root.querySelector('.backdrop').addEventListener('click',close);
el('.close').addEventListener('click',close);
el('.search').addEventListener('input',event=>{
 state.term=event.target.value;if(state.term)state.arranging=false;
 render();scroller.scrollTop=0;
});
el('.arrangeBtn').addEventListener('click',()=>{
 if(!(state.view==='checked'||state.view==='playlist-order'))return;
 state.arranging=!state.arranging;
 if(state.arranging){state.term='';el('.search').value='';}
 say(state.arranging?'Hold a song row to drag it. Use ↑ ↓ for small moves.':'Order kept in checked songs. SAVE USER PLAYLIST to keep the named playlist.');
 render();
});
el('.songFilter').addEventListener('change',event=>setView(event.target.value));
el('.playlistFilter').addEventListener('change',event=>setView(event.target.value));
root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
 const access=musicAccessActive();
 if(b.dataset.tab==='songs')setView(access?.restricted?'access-code':'all');
 else setView('user-playlists');
}));
root.querySelectorAll('[data-access-view]').forEach(b=>b.addEventListener('click',()=>{
 state.accessView=b.dataset.accessView;state.accessPlaylistFilter='';state.view='access-code';
 render();scroller.scrollTop=0;
}));
root.querySelector('.geV5Refresh').addEventListener('click',()=>void loadPublished());
root.querySelector('.musicCodeUnlock').addEventListener('click',()=>void redeemMusicCode());
root.querySelector('.musicCodeClear').addEventListener('click',clearMusicAccess);
root.querySelector('.musicCodeInput').addEventListener('keydown',event=>{
 if(event.key==='Enter'){event.preventDefault();void redeemMusicCode()}
});
musicAccessStatus();
window.addEventListener('ge-vault-music-access-updated',()=>{
 const access=musicAccessActive();
 if(access?.restricted){
  state.selected=new Set(access.allowed);saveSelected();state.view='access-code';
  state.accessView='order';state.accessPlaylistFilter=access.radioPlaylistId||'';void loadPublished();
 }
 musicAccessStatus();if(state.open)render();
});
root.querySelector('[data-action=clear]').addEventListener('click',()=>{state.selected.clear();saveSelected();say('Selection cleared.');render()});
root.querySelector('[data-action=save]').addEventListener('click',saveMine);
document.addEventListener('keydown',event=>{if(!state.open)return;if(event.key==='Escape'){event.preventDefault();close()}});
button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();state.open?close():open()});
button.dataset.geMusicBuild=BUILD;
window.GEMusicV5={open,close,refresh:()=>{if(state.open)render()},reportPlayback:message=>say(message),build:BUILD,state:()=>({loaded:state.loaded,open:state.open})};
})();