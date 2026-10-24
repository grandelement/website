/* GRAND ELEMENT MUSIC V3 · clean listener library (2026-10-24)
   Self-contained UI with Shadow DOM: no old Radio picker styles or scroll scripts.
   Published songs and GE DJ playlists remain source-of-truth. */
(()=>{
'use strict';
const BUILD='GE-MUSIC-V3-20261024';
const button=document.getElementById('geMusicV3Button');
if(!button)return;
const store='GE_MUSIC_V3_SELECTION_20261024',myKey='GE_MUSIC_PERSONAL_PLAYLISTS_V1';
const albumOrder=['Singles','Aether','Fire','Spirit','Soul','Love','Intergy','Sessions II','Sessions I','Live','Trio','Fundamental Groove'];
const state={open:false,loading:false,loaded:false,tracks:[],tab:'albums',album:'',term:'',selected:new Set(),publicLists:[],myLists:[],notice:'',request:0};
try{const raw=JSON.parse(localStorage.getItem(store)||'[]');if(Array.isArray(raw))state.selected=new Set(raw.filter(x=>typeof x==='string'))}catch(_){}
const host=document.createElement('div');host.id='geMusicV3Host';host.dataset.build=BUILD;
host.style.cssText='position:fixed;inset:0;z-index:60010;display:none;isolation:isolate';
const root=host.attachShadow({mode:'open'});
root.innerHTML=`
<style>
:host{all:initial;display:block;color:#ecfaff;font:15px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif}
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
.search{display:block;width:100%;padding:9px 11px;min-height:42px;color:#fff;background:#031321;border:1px solid #4b91bd;border-radius:9px}
.tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}
.tab{min-width:0;font-size:clamp(11px,2.9vw,14px);padding:7px 5px;background:#0e314e}
.tab[aria-selected=true]{background:#1168b6;border-color:#a0ebff}
.meta{color:#addcf5;font-size:12px;min-height:17px;margin-top:7px}
.notice{color:#c5efff;font-size:12px;min-height:18px;margin-top:5px}
.scroll{flex:1 1 auto;height:0;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;padding:11px 10px 26px;scroll-behavior:auto}
.album{display:flex;width:100%;justify-content:space-between;gap:10px;min-height:52px;margin:0 0 7px;background:linear-gradient(110deg,#0c3b66,#071e32);border:1px solid #4384b0}
.album b{min-width:0;overflow-wrap:anywhere;text-align:left}.album small{color:#a3dbff;flex:0 0 auto}
.section{padding:8px 7px;background:#0c3653;border-bottom:1px solid #4384ac;font-weight:850;margin:12px 0 5px}
.song{display:flex;align-items:center;gap:9px;min-height:49px;padding:6px 4px;border-bottom:1px solid #203d53;touch-action:pan-y}
.song label{display:flex;align-items:center;gap:10px;flex:1;min-width:0;overflow-wrap:anywhere;cursor:pointer}
.song input[type=checkbox]{flex:0 0 auto;width:21px;height:21px;accent-color:#41d5ff}
.song span{min-width:0;overflow-wrap:anywhere;font-size:13px}
.song button{flex:0 0 auto;min-width:64px;min-height:38px;background:#1165a5;border-color:#5cd9ff;font-size:13px}
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
 <div class="header"><div class="brand">GRAND ELEMENT · MUSIC<span class="build">NEW LIBRARY · V3</span></div><button class="close" type="button">CLOSE</button></div>
 <div class="tools"><input class="search" type="search" placeholder="Search songs and albums" aria-label="Search all music">
 <div class="tabs" role="tablist"><button class="tab" data-tab="albums" role="tab" aria-selected="true">ALBUMS</button><button class="tab" data-tab="songs" role="tab" aria-selected="false">SONGS</button><button class="tab" data-tab="playlists" role="tab" aria-selected="false">PLAYLISTS</button></div>
 <div class="meta" aria-live="polite">Loading published music…</div><div class="notice" role="status" aria-live="polite"></div></div>
 <div class="scroll" role="region" aria-label="Scrollable Grand Element music collection" tabindex="0"></div>
 <div class="bottom"><span class="count">0 SELECTED</span><button data-action="clear" type="button">CLEAR</button><button data-action="save" type="button">SAVE PLAYLIST</button></div>
</section>`;
document.body.appendChild(host);
const el=sel=>root.querySelector(sel),scroller=el('.scroll'),meta=el('.meta'),notice=el('.notice');
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
function updateMeta(){meta.textContent=`${state.tracks.length} SONGS · ${new Set(state.tracks.map(x=>x.album)).size} ALBUMS · ${BUILD}`;el('.count').textContent=state.selected.size+' SELECTED'}
function elem(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
async function fetchCatalog(){
 const all=[];
 for(const [file,key] of [['./manifest.json','files'],['./track-durations.json','tracks']]){
  try{
   const response=await fetch(file+'?musicv3='+BUILD,{cache:'no-store'});
   if(!response.ok)continue;
   const data=await response.json(),rows=Array.isArray(data[key])?data[key]:[];
   for(const item of rows){const path=canonical(key==='files'?item:item?.path);if(path)all.push(path)}
  }catch(error){console.warn('MUSIC V3 catalog source',file,error)}
 }
 const unique=[...new Set(all)].map(details);
 unique.sort((a,b)=>rank(a.album)-rank(b.album)||a.album.localeCompare(b.album)||a.number-b.number||a.title.localeCompare(b.title));
 state.tracks=unique;state.loaded=true;state.loading=false;updateMeta();render();
 if(!unique.length)say('The published library could not be loaded. Check network and refresh.');
}
function readMine(){
 try{const rows=JSON.parse(localStorage.getItem(myKey)||'[]');return Array.isArray(rows)?rows.filter(x=>x&&typeof x.name==='string'&&Array.isArray(x.songs)).slice(0,100):[]}
 catch(_){return[]}
}
function saveMine(){
 const name=prompt('Name your private playlist:','My Playlist');if(name==null)return;
 const clean=name.trim().slice(0,100);if(!clean||!state.selected.size){say('Select songs and enter a playlist name first.');return}
 const mine=readMine(),found=mine.find(x=>x.name.toLowerCase()===clean.toLowerCase());
 const row={id:found?.id||('music-'+Date.now().toString(36)),name:clean,songs:[...state.selected],updatedAt:Date.now()};
 const updated=[row,...mine.filter(x=>x.id!==row.id)].slice(0,100);
 try{localStorage.setItem(myKey,JSON.stringify(updated));say('Saved '+clean+' on this device.');state.tab='playlists';render()}
 catch(_){say('Could not save this playlist on this device.')}
}
async function loadPublished(){
 try{
  const bridge=window.GEMusicV3Bridge;
  if(!bridge?.publicLists)return;
  const rows=await bridge.publicLists();
  state.publicLists=Array.isArray(rows)?rows:[];if(state.open&&state.tab==='playlists')render();
 }catch(_){say('Published GE playlist service is unavailable.')}
}
function loadPlaylist(row){
 const allowed=new Set(state.tracks.map(x=>x.path));
 state.selected=new Set(row.songs.map(canonical).filter(p=>allowed.has(p)));
 saveSelected();state.tab='songs';state.album='';state.term='';el('.search').value='';
 say(row.name+' · '+state.selected.size+' songs loaded for selection.');render();
}
function playTrack(track){
 // Playback remains controlled by the existing radio preview/access gate.
 const outcome=window.GEMusicV3Bridge?.play?.(track.path);
 if(outcome?.ok){say('Opening '+track.title+'.');return}
 say(outcome?.message||'Music preview is loading. Tap PLAY again.');
}
function appendSong(parent,track){
 const row=elem('div','song'),label=elem('label'),checkbox=elem('input');
 checkbox.type='checkbox';checkbox.checked=state.selected.has(track.path);
 checkbox.setAttribute('aria-label','Select '+track.title);
 checkbox.addEventListener('change',()=>{checkbox.checked?state.selected.add(track.path):state.selected.delete(track.path);saveSelected();updateMeta()});
 label.append(checkbox,elem('span','',track.title));
 const play=elem('button','','PLAY');play.type='button';play.setAttribute('aria-label','Play '+track.title);
 play.addEventListener('click',()=>playTrack(track));
 row.append(label,play);parent.appendChild(row);
}
function render(){
 if(!state.open)return;
 el('.search').value=state.term;
 root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===state.tab)));
 const top=scroller.scrollTop;scroller.replaceChildren();updateMeta();notice.textContent=state.notice;
 if(!state.loaded){scroller.appendChild(elem('p','empty','Loading all published music files…'));return}
 const term=state.term.toLowerCase();
 const tracks=state.tracks.filter(t=>(!state.album||t.album===state.album)&&(!term||(`${t.album} ${t.title}`).toLowerCase().includes(term)));
 if(state.tab==='albums'){
  const groups=new Map();
  for(const t of state.tracks.filter(t=>!term||(`${t.album} ${t.title}`).toLowerCase().includes(term))){if(!groups.has(t.album))groups.set(t.album,[]);groups.get(t.album).push(t)}
  if(!groups.size)scroller.appendChild(elem('p','empty','No matching albums.'));
  for(const [name,rows] of groups){
   const b=elem('button','album');b.type='button';
   b.append(elem('b','',name),elem('small','',rows.length+' songs'));
   b.addEventListener('click',()=>{state.tab='songs';state.album=name;state.term='';el('.search').value='';render();scroller.scrollTop=0});
   scroller.appendChild(b);
  }
 }else if(state.tab==='songs'){
  if(state.album){const back=elem('button','','← ALL ALBUMS');back.addEventListener('click',()=>{state.album='';state.tab='albums';render();scroller.scrollTop=0});scroller.append(back)}
  if(!tracks.length)scroller.appendChild(elem('p','empty','No matching songs.'));
  let album='';
  tracks.forEach(t=>{if(t.album!==album){album=t.album;scroller.appendChild(elem('div','section',album))}appendSong(scroller,t)});
 }else{
  const caption=elem('div','section','GE DJ PLAYLISTS');scroller.appendChild(caption);
  const info=elem('p','empty',window.GE_DJ_PLAYLIST_SOURCE_STATUS||'Owner-published GE playlists');
  scroller.appendChild(info);
  if(!state.publicLists.length)scroller.appendChild(elem('p','empty','No published GE playlists are available right now.'));
  const section=(rows)=>rows.forEach(row=>{
   const box=elem('div','playlist'),h=elem('h3','',row.name),p=elem('p','',row.songs.length+' saved songs');
   const bar=elem('div','actions'),btn=elem('button','','LOAD SONGS');btn.type='button';btn.addEventListener('click',()=>loadPlaylist(row));
   bar.append(btn);box.append(h,p,bar);scroller.appendChild(box);
  });
  section(state.publicLists);
  scroller.appendChild(elem('div','section','MY PLAYLISTS · SAVED ON THIS DEVICE'));
  const mine=readMine();if(!mine.length)scroller.appendChild(elem('p','empty','Select songs, then choose SAVE PLAYLIST.'));
  section(mine);
 }
 scroller.scrollTop=(state.tab==='songs'&&state.album)?0:top;
}
let previousFocus=null,oldBodyOverflow='';
function open(){
 if(state.open)return;
 state.open=true;state.notice='';
 previousFocus=document.activeElement;oldBodyOverflow=document.body.style.overflow;
 document.body.classList.add('ge-music-v3-open');
 document.body.style.setProperty('overflow','hidden','important');
 host.style.display='block';button.setAttribute('aria-expanded','true');
 window.GEMusicV3Bridge?.prepare?.();
 if(!state.loaded&&!state.loading){state.loading=true;void fetchCatalog()}
 void loadPublished();render();scroller.scrollTop=0;el('.close').focus();
}
function close(){
 if(!state.open)return;
 state.open=false;host.style.display='none';document.body.classList.remove('ge-music-v3-open');
 document.body.style.overflow=oldBodyOverflow;
 button.setAttribute('aria-expanded','false');previousFocus?.focus?.();
}
root.querySelector('.backdrop').addEventListener('click',close);
el('.close').addEventListener('click',close);
el('.search').addEventListener('input',event=>{state.term=event.target.value;state.album='';render();scroller.scrollTop=0});
root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;state.album='';state.term='';render();scroller.scrollTop=0}));
root.querySelector('[data-action=clear]').addEventListener('click',()=>{state.selected.clear();saveSelected();say('Selection cleared.');render()});
root.querySelector('[data-action=save]').addEventListener('click',saveMine);
document.addEventListener('keydown',event=>{if(!state.open)return;if(event.key==='Escape'){event.preventDefault();close()}});
button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();state.open?close():open()});
button.dataset.geMusicBuild=BUILD;
window.GEMusicV3={open,close,refresh:()=>{if(state.open)render()},build:BUILD,state:()=>({loaded:state.loaded,songs:state.tracks.length,open:state.open})};
})();