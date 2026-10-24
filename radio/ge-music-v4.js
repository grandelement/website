/* GRAND ELEMENT MUSIC V4 · Vault song selector (2026-10-24)
   Self-contained UI with Shadow DOM: no old Radio picker styles or scroll scripts.
   Published songs and GE DJ playlists remain source-of-truth. */
(()=>{
'use strict';
const BUILD='GE-MUSIC-V4-20261024';
const button=document.getElementById('geMusicV4Button');
if(!button)return;
const store='GE_MUSIC_V3_SELECTION_20261024',myKey='GE_MUSIC_PERSONAL_PLAYLISTS_V1';
const albumOrder=['Singles','Aether','Fire','Spirit','Soul','Love','Intergy','Sessions II','Sessions I','Live','Trio','Fundamental Groove'];
const state={open:false,loading:false,loaded:false,tracks:[],view:'all',term:'',selected:new Set(),publicLists:[],notice:'',playlistsLoading:false,playlistMessage:'CONNECTING TO GE VAULT…'};
try{const raw=JSON.parse(localStorage.getItem(store)||'[]');if(Array.isArray(raw))state.selected=new Set(raw.filter(x=>typeof x==='string'))}catch(_){}
const host=document.createElement('div');host.id='geMusicV4Host';host.dataset.build=BUILD;
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
.chooseRow{display:flex;gap:6px;margin-top:7px}.geV4Choose{flex:1;min-width:0;min-height:46px;background:#092d4b;color:white;border:1px solid #65c7fa;border-radius:9px;padding:8px;font-size:15px;font-weight:800}.geV4Refresh{min-height:46px}
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
 <div class="header"><div class="brand">GRAND ELEMENT · MUSIC<span class="build">GE VAULT · MUSIC V4</span></div><button class="close" type="button">CLOSE</button></div>
 <div class="tools"><label for="geV4Choose">CHOOSE MUSIC</label><div class="chooseRow"><select id="geV4Choose" class="geV4Choose"><option value="all">ALL SONGS</option></select><button type="button" class="geV4Refresh">REFRESH</button></div><input class="search" type="search" placeholder="Find a song" aria-label="Search songs in selection">
 <div class="meta" aria-live="polite">Loading published music…</div><div class="notice" role="status" aria-live="polite"></div></div>
 <div class="scroll" role="region" aria-label="Scrollable Grand Element music collection" tabindex="0"></div>
 <div class="bottom"><span class="count">0 SELECTED</span><button data-action="clear" type="button">CLEAR</button><button data-action="save" type="button">SAVE ON DEVICE</button><a href="../backroom/" style="color:#b8e9ff;font-size:11px">MANAGE GE VAULT</a></div>
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
 try{localStorage.setItem(myKey,JSON.stringify(updated));say('Saved on this device. Permanent GE playlists are managed in the Back Room.');render()}
 catch(_){say('Could not save this playlist on this device.')}
}
async function loadPublished(){
 if(state.playlistsLoading)return;
 state.playlistsLoading=true;state.playlistMessage='CONNECTING TO GE VAULT…';
 if(state.open)render();
 try{
  const response=await fetch('https://vault.grandelement.com/v1/public/music-playlists?refresh='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error('GE Vault HTTP '+response.status);
  const data=await response.json();
  if(data?.ok!==true||data.format!=='ge-music-playlists-v1'||!Array.isArray(data.items))
   throw Error('Invalid GE Vault playlist response');
  state.publicLists=data.items.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.songs))
   .map(p=>({id:p.id,name:p.name,songs:p.songs.map(canonical).filter(Boolean)})).filter(p=>p.songs.length);
  state.playlistMessage=state.publicLists.length?'GE VAULT CONNECTED · '+state.publicLists.length+' PUBLIC PLAYLIST'+(state.publicLists.length===1?'':'S'):
    'GE VAULT CONNECTED · NO PUBLIC PLAYLISTS AVAILABLE';
 }catch(e){
  state.publicLists=[];state.playlistMessage='GE VAULT UNAVAILABLE · '+String(e.message||e);
 }finally{state.playlistsLoading=false;if(state.open)render()}
}
function playTrack(track){
 // Playback remains controlled by the existing radio preview/access gate.
 const outcome=window.GEMusicV4Bridge?.play?.(track.path);
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
function makeOptions(){
 const chooser=root.querySelector('#geV4Choose'),before=state.view,frag=document.createDocumentFragment();
 frag.append(new Option('ALL SONGS · '+state.tracks.length,'all'));
 const albums=document.createElement('optgroup');albums.label='ALBUMS';
 for(const name of [...new Set(state.tracks.map(t=>t.album))])albums.append(new Option(name,'album:'+name));
 frag.append(albums);
 const vault=document.createElement('optgroup');vault.label='GE VAULT PLAYLISTS';
 if(state.publicLists.length)state.publicLists.forEach(p=>vault.append(new Option(p.name+' · '+p.songs.length+' SONGS','vault:'+p.id)));
 else vault.append(new Option(state.playlistsLoading?'CONNECTING…':'NOT AVAILABLE','unavailable'));
 frag.append(vault);
 const mine=readMine();
 if(mine.length){const local=document.createElement('optgroup');local.label='SAVED ON DEVICE';
  mine.forEach(p=>local.append(new Option(p.name,'local:'+p.id)));frag.append(local)}
 chooser.replaceChildren(frag);
 state.view=[...chooser.options].some(o=>o.value===before)?before:'all';chooser.value=state.view;
}
function chosenSongs(){
 if(state.view.startsWith('album:'))return state.tracks.filter(t=>t.album===state.view.slice(6));
 const isVault=state.view.startsWith('vault:'),isLocal=state.view.startsWith('local:');
 if(isVault||isLocal){
  const p=isVault?state.publicLists.find(p=>p.id===state.view.slice(6)):readMine().find(p=>p.id===state.view.slice(6));
  const lookup=new Map(state.tracks.map(t=>[t.path,t]));
  return(p?.songs||[]).map(path=>lookup.get(path)).filter(Boolean);
 }
 return state.view==='unavailable'?[]:state.tracks;
}
function render(){
 if(!state.open)return;
 makeOptions();
 const all=chosenSongs(),term=state.term.toLowerCase().trim();
 const shown=all.filter(t=>!term||(t.album+' '+t.title).toLowerCase().includes(term));
 const scroll=scroller.scrollTop;scroller.replaceChildren();updateMeta();
 meta.textContent=state.tracks.length+' SONGS · '+new Set(state.tracks.map(t=>t.album)).size+' ALBUMS · '+shown.length+' SHOWN';
 notice.textContent=state.notice||state.playlistMessage;
 if(!state.loaded){scroller.appendChild(elem('p','empty','Loading music…'));return}
 if(!shown.length)scroller.appendChild(elem('p','empty',state.view==='unavailable'?
 'Vault playlists are unavailable. ALL SONGS and ALBUMS remain available.':'No matching songs.'));
 let album='';
 shown.forEach(t=>{if(state.view==='all'&&album!==t.album){album=t.album;scroller.appendChild(elem('div','section',album))}appendSong(scroller,t)});
 scroller.scrollTop=scroll;
}
let previousFocus=null,oldBodyOverflow='';
function open(){
 if(state.open)return;
 state.open=true;state.notice='';
 previousFocus=document.activeElement;oldBodyOverflow=document.body.style.overflow;
 document.body.classList.add('ge-music-v3-open');
 document.body.style.setProperty('overflow','hidden','important');
 host.style.display='block';button.setAttribute('aria-expanded','true');
 window.GEMusicV4Bridge?.prepare?.();
 if(!state.loaded&&!state.loading){state.loading=true;void fetchCatalog()}
 void loadPublished();render();scroller.scrollTop=0;root.querySelector('#geV4Choose').focus();
}
function close(){
 if(!state.open)return;
 state.open=false;host.style.display='none';document.body.classList.remove('ge-music-v3-open');
 document.body.style.overflow=oldBodyOverflow;
 button.setAttribute('aria-expanded','false');previousFocus?.focus?.();
}
root.querySelector('.backdrop').addEventListener('click',close);
el('.close').addEventListener('click',close);
el('.search').addEventListener('input',event=>{state.term=event.target.value;render();scroller.scrollTop=0});
root.querySelector('#geV4Choose').addEventListener('change',event=>{state.view=event.target.value;state.term='';el('.search').value='';state.notice='';render();scroller.scrollTop=0});
root.querySelector('.geV4Refresh').addEventListener('click',()=>void loadPublished());
root.querySelector('[data-action=clear]').addEventListener('click',()=>{state.selected.clear();saveSelected();say('Selection cleared.');render()});
root.querySelector('[data-action=save]').addEventListener('click',saveMine);
document.addEventListener('keydown',event=>{if(!state.open)return;if(event.key==='Escape'){event.preventDefault();close()}});
button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();state.open?close():open()});
button.dataset.geMusicBuild=BUILD;
window.GEMusicV4={open,close,refresh:()=>{if(state.open)render()},build:BUILD,state:()=>({loaded:state.loaded,songs:state.tracks.length,playlists:state.publicLists.length,open:state.open})};
})();