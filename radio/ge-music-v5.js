/* GRAND ELEMENT MUSIC V5 · Single-scroll library (2026-10-24)
   Self-contained UI with Shadow DOM: no old Radio picker styles or scroll scripts.
   Published songs and GE DJ playlists remain source-of-truth. */
(()=>{
'use strict';
const BUILD='GE-MUSIC-V6.5-20261028-VAULT-AND-GITHUB-PLAYLIST-READ';
const button=document.getElementById('geMusicV5Button');
if(!button)return;
const store='GE_MUSIC_V3_SELECTION_20261024',myKey='GE_MUSIC_PERSONAL_PLAYLISTS_V1',
  testPurchaseKey='GE_MUSIC_TEST_PURCHASES_V1',
  musicSessionKey='GE_MUSIC_CODE_SESSION_V1',
  musicSessionEndpoint='https://vault.grandelement.com/v1/public/access/music-session';
const albumOrder=['Singles','Aether','Fire','Spirit','Soul','Love','Intergy','Sessions II','Sessions I','Live','Trio','Fundamental Groove'];
// Representative hues visually checked against all 11 JPG covers in
// ge-images/images. These are NOT the unrelated GOLF_PLANETS gameplay colors.
const albumColors={'Fundamental Groove':'#b94754','Trio':'#a86b3d','Live':'#829343','Sessions I':'#388c76','Sessions II':'#2e9bb1','Intergy':'#635293','Love':'#9b357d','Soul':'#c84cba','Spirit':'#d29482','Fire':'#dbca64','Aether':'#bfc4cd','Singles':'#6e9bb5'};
function applyAlbumStyle(element,name){
 const hex=albumColors[name]||'#addcf5';
 element.style.setProperty('--ge-album-accent',hex);
 element.style.borderLeft='5px solid '+hex;
 const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
 element.style.background='linear-gradient(90deg,rgba('+r+','+g+','+b+',.32),rgba('+r+','+g+','+b+',.13))';
}
const state={open:false,loading:false,loaded:false,tracks:[],view:'all',term:'',selected:new Set(),publicLists:[],assignedLists:[],accessView:'order',accessPlaylistFilter:'',activePlaylist:null,arranging:false,arrangeReturnView:'checked',notice:'',playlistsLoading:false,playlistMessage:'CONNECTING TO GITHUB PLAYLISTS…',musicAccess:null,redeemBusy:false};
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
.filterRow{display:grid;grid-template-columns:1fr;gap:5px;margin:7px 0 0}
.filterRow select{width:100%;min-width:0;min-height:42px;padding:8px 10px;border:1px solid #5898c7;border-radius:9px;background:#10314d;color:#ecfaff;font-size:clamp(13px,3.5vw,16px);font-weight:750}
.filterRow select[hidden]{display:none!important}
.musicCodeTools{display:flex;align-items:center;gap:6px;margin-top:0;border:1px solid #ae83e9;border-radius:9px;padding:6px;background:linear-gradient(95deg,#30174b,#171c40 75%);box-shadow:inset 0 0 0 1px rgba(220,174,255,.12)}
.musicCodeTools label{color:#eddaff;font-size:11px;font-weight:900;letter-spacing:.035em;white-space:nowrap;flex:0 0 auto}
.musicCodeTools input{min-width:0;flex:1 1 auto;width:0;color:#fff;background:#090e23;border:1px solid #ab7bda;border-radius:7px;padding:7px 8px;font-size:16px;min-height:38px}
.musicCodeTools button{min-height:38px;font-size:11px;padding:6px 8px;border-color:#d0a0fb;background:#673a8c}
.musicCodeTools .musicCodeClear{min-width:32px;padding:5px;font-size:18px}
.musicCodeTools button[hidden],.musicCodeState[hidden]{display:none!important}
.musicCodeState{color:#dfbaff;font-size:11px;margin-top:4px}
.selectionBar{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:7px;min-height:50px;margin:0;padding:7px 9px max(8px,env(safe-area-inset-bottom));background:#071f34;border-top:1px solid #4b9ac2}
.selectionBar strong{font-size:clamp(10px,2.7vw,13px);font-weight:900;color:#c5f2ff;white-space:nowrap;min-width:0}
.selectionActions{display:flex;gap:5px;align-items:center;flex:0 0 auto}
.selectionActions button{min-height:36px;font-size:clamp(10px,2.8vw,12px);padding:5px 7px}
.selectionActions .playSelected,.arrangePlay{background:#1376b6;border-color:#a0e2ff;color:#fff}
.selectionActions .playSelected:disabled,.arrangePlay:disabled{opacity:.4}
@media(max-width:365px){.selectionBar{padding-left:5px;padding-right:5px;gap:3px}.selectionBar strong{font-size:9px}.selectionActions{gap:3px}.selectionActions button{font-size:10px;padding:5px 5px;min-height:34px}}
.buyBtn{background:#80602a!important;border-color:#ecc576!important;color:#fff4d4!important}
.buyBtn:disabled{opacity:.4}
.selectionActions .buySelected{min-width:45px}
.albumCollectionHeading{display:flex;gap:6px;align-items:stretch;margin:14px 0 7px;border:1px solid #6e9ab2;border-radius:9px;overflow:hidden;min-height:60px;box-shadow:0 2px 9px rgba(0,0,0,.18)}
.albumCollectionHeading .albumPicker{flex:1;min-width:0;margin:0;padding:8px 10px;border:0!important;background:transparent!important}
.albumCollectionHeading .albumText{display:block;flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.albumCollectionHeading .albumTitle{display:block;max-width:100%;font-size:clamp(25px,7vw,30px);font-weight:950;letter-spacing:.02em;line-height:1.1;color:#fff;text-shadow:0 2px 3px rgba(0,12,24,.8);overflow-wrap:anywhere}
.albumCollectionHeading .albumViewTitle{flex:1;min-width:0;align-self:center;padding:9px 11px;color:#fff;font-size:clamp(25px,7vw,30px);font-weight:950;letter-spacing:.02em;line-height:1.1;text-shadow:0 2px 3px rgba(0,12,24,.8);overflow-wrap:anywhere}

.albumActions,.songActions{display:flex;gap:5px;align-items:center;flex:0 0 auto}
.albumActions{padding:3px}
.albumActions button{min-height:36px;padding:5px 9px;font-size:12px}
.songActions button{min-width:47px}
.song.selectedSong{box-shadow:inset 0 0 0 1px rgba(200,231,255,.25)}
@media(max-width:420px){.albumActions button{padding:5px 7px;font-size:11px}.songActions button{font-size:11px;min-width:43px;padding:6px}}

.song button[disabled]{opacity:.48}
.breadcrumb{display:flex;align-items:center;gap:8px;margin:4px 0 10px}
.breadcrumb strong{min-width:0;font-size:14px;overflow-wrap:anywhere}
.album{min-width:0}
.album .countHint{white-space:nowrap}
.empty{font-size:13px;line-height:1.45}
.scroll{scrollbar-width:thin}
@media(max-width:420px){.browse button{font-size:12px}.header .brand{font-size:13px}}
.arrangeBtn{min-height:32px;padding:5px 10px;font-size:12px;background:#135d91;border:1px solid #75cfff;color:#f4fbff}
.arrangeBtn[aria-pressed="true"]{background:#187dba;border-color:#b9e9ff;box-shadow:0 0 9px rgba(52,176,245,.28)}
.notice:empty{display:none!important}
.notice{color:#c5efff;font-size:11px;line-height:16px;margin-top:3px;min-height:0;max-height:17px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%}
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
.song input[type=checkbox]{flex:0 0 auto;width:21px;height:21px;accent-color:#087eff}
.song span{min-width:0;overflow-wrap:anywhere;font-size:13px}
.song .songLabel{flex:1;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:750}
.albumJump{min-width:0;width:100%;margin-top:7px;padding:8px 10px;min-height:40px;border:1px solid #4b91bd;border-radius:9px;background:#09243a;color:white;font-size:14px}
.song button{flex:0 0 auto;min-width:45px;min-height:38px;background:#1165a5;border-color:#5cd9ff;font-size:13px}
.song .reorder{min-width:38px;padding:4px 6px;font-size:19px}
.albumPicker{display:flex;align-items:center;gap:9px;background:#0b3553;border:1px solid #376f95;border-radius:7px;padding:9px;margin:8px 0 5px}
.albumPicker input{width:21px;height:21px;accent-color:#087eff}
.albumPicker span{font-weight:800;font-size:13px}
.albumBrowseRow{display:flex;align-items:stretch;gap:0;min-height:49px;margin:0 0 8px;border:1px solid rgba(154,211,239,.55);border-radius:10px;overflow:hidden}
.albumBrowseRow .albumPickerCompact{display:flex;align-items:center;justify-content:center;flex:0 0 44px;min-width:44px;max-width:44px;min-height:47px;padding:0 8px;margin:0;background:transparent!important;border:0!important;border-right:1px solid rgba(160,225,255,.25)!important;border-radius:0;cursor:pointer}
.albumBrowseRow .albumPickerCompact input{width:21px;height:21px;flex:0 0 21px;margin:0;accent-color:#087eff}
.song input[type=checkbox]:checked,.albumPicker input:checked{outline:1.5px solid #e8f7ff;outline-offset:1px;border-radius:3px}
.albumBrowseRow .album{display:flex;align-items:center;justify-content:space-between;flex:1 1 0;min-width:0;min-height:47px;padding:7px 10px;gap:8px;margin:0;border:0!important;border-radius:0;background:transparent!important;box-shadow:none!important}
.albumBrowseRow .album b{flex:1;min-width:0;text-align:left;font-size:clamp(20px,5.6vw,24px);font-weight:950;letter-spacing:.02em;line-height:1.12;overflow-wrap:anywhere;color:#fff;text-shadow:0 2px 3px #061626}
.albumBrowseRow .album small{flex:0 0 auto;white-space:nowrap;font-size:clamp(10px,2.8vw,13px);font-weight:800;color:#b7e6ff}
@media(max-width:420px){.albumBrowseRow .album{padding:6px 7px;gap:5px}.albumBrowseRow .album b{font-size:21px}.albumBrowseRow .album small{font-size:10px}.albumCollectionHeading .albumPicker{padding:8px 7px}.albumCollectionHeading .albumTitle{font-size:27px}}
.playlistActionsBar{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.playlistActionsBar button{font-size:clamp(11px,3.2vw,13px);min-height:36px;padding:6px 11px}
.playlistActionsBar [data-action=clear]{background:#092a43;border-color:#559dcb}
.playlistActionsBar [data-action=save]{background:#125784;border-color:#87ccf6;color:#fff;font-weight:850}
.arrangeDock{display:none;flex:0 0 auto;background:#06243b;border-bottom:1px solid #4b91bd;padding:8px 10px;gap:7px}
.arrangeTitle{display:flex;align-items:center;justify-content:space-between;gap:8px}
.arrangeTitle strong{font-size:clamp(14px,3.8vw,18px);font-weight:900;color:#e9faff;letter-spacing:.05em}
.arrangeTitle button{min-height:35px;background:#176a9d;border-color:#a6e4ff}
.arrangeLoad{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}
.arrangeLoad select{min-width:0;width:100%;background:#08283f;color:#fff;border:1px solid #5da7d8;border-radius:8px;padding:6px 8px;font-size:13px;min-height:38px}
.arrangeLoad button{font-size:12px;min-height:38px}
.arrangeCommands{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
.arrangeCommands button{min-width:0;font-size:clamp(10px,2.8vw,13px);min-height:39px;padding:5px 5px}
.arrangeDock .arrangeHint{font-size:11px;color:#b4e0f6;line-height:1.3}
.arrangeDock .arrangeNotice{font-size:11px;color:#ffe3a0;line-height:1.3}
.window.arranging{top:max(2px,env(safe-area-inset-top));bottom:2px;width:min(940px,calc(100vw - 6px));max-height:calc(100dvh - 4px);border-radius:9px}
.window.arranging .tools,.window.arranging .selectionBar{display:none!important}
.window.arranging .arrangeDock{display:flex;flex-direction:column}
.window.arranging .header{padding:6px 10px;min-height:44px}
.window.arranging .header .build{display:none}
.window.arranging .header .close{min-height:33px;padding:4px 9px}
.window.arranging .scroll{padding:7px 8px 14px}
.window.arranging .song{min-height:50px;margin-bottom:4px}
.window.arranging .song .reorder{min-width:36px;min-height:38px}
.window.arranging .song .buyBtn{min-height:38px}
@media(max-width:420px){.window.arranging .song{gap:4px}.window.arranging .songActions button{min-width:42px;padding:5px}.window.arranging .song .reorder{min-width:30px;padding:4px}.arrangeDock{padding:6px 8px}}

.playlist{margin:0 0 9px;padding:10px;border:1px solid #3d89ba;border-radius:10px;background:#0c2940}
.playlist h3{margin:0 0 8px;font-size:15px}
.playlist p{color:#aed8ef;margin:4px 0 9px;font-size:12px}
.playlist .actions{display:flex;flex-wrap:wrap;gap:7px}
.playlist input{width:100%;min-height:42px;border-radius:9px;border:1px solid #5caccf;background:#05192a;color:#fff;padding:8px;margin-bottom:8px}
.empty{color:#c0ddef;padding:18px 7px}
@media(max-width:420px){.window{border-radius:11px}.brand{font-size:13px}.tools{padding:8px}.song{gap:5px}.song span{font-size:12px}.playlistActionsBar{gap:6px}.playlistActionsBar button{font-size:12px;padding:6px 9px}}
</style>
<div class="backdrop"></div>
<section class="window" role="dialog" aria-modal="true" aria-label="Grand Element music library">
 <div class="header"><div class="brand">GRAND ELEMENT · MUSIC<span class="build">SINGLE SCROLL · MUSIC V6.5</span></div><button class="close" type="button">CLOSE</button></div>
 <div class="tools"><div class="musicCodeTools"><label for="geMusicV5Code">ACCESS CODE</label><input id="geMusicV5Code" class="musicCodeInput" type="password" autocomplete="off" spellcheck="false" placeholder="Enter code" aria-label="GE Music access code"><button class="musicCodeUnlock" type="button">UNLOCK</button><button class="musicCodeClear" type="button" title="Clear active code" aria-label="Clear active Music code" hidden>×</button></div><div class="musicCodeState" role="status" aria-live="polite" hidden></div><nav class="browse" aria-label="Music workspaces"><button type="button" data-tab="songs" aria-pressed="true">SONGS</button><button type="button" data-tab="playlists" aria-pressed="false">PLAYLISTS</button></nav><input class="search" type="search" placeholder="Find a song, album, or playlist" aria-label="Search music or playlists">
 <div class="accessViews" hidden style="margin-top:9px;display:none;gap:6px;flex-wrap:wrap"><button type="button" data-access-view="order">MY ORDER</button><button type="button" data-access-view="album">BY ALBUM</button><button type="button" data-access-view="playlist">PLAYLISTS</button></div><div class="playlistActionsBar" aria-label="Playlist saving controls"><button data-action="clear" type="button">CLEAR</button><button data-action="save" type="button">SAVE PLAYLIST</button></div><div class="filterRow"><select class="songFilter" aria-label="Filter songs"><option value="all">ALL SONGS</option><option value="checked">CHECKED SONGS</option><option value="albums">BROWSE ALBUMS</option></select><select class="playlistFilter" aria-label="Filter playlists" hidden><option value="user-playlists">USER PLAYLISTS</option><option value="ge-playlists">GE PLAYLISTS</option><option value="playlist-order">CHECKED SONGS · ARRANGE</option></select></div><div class="notice" role="status" aria-live="polite"></div></div>
 <div class="arrangeDock" aria-label="Arrange playlist workspace">
   <div class="arrangeTitle"><strong class="arrangeCount">ARRANGE · 0 SONGS</strong><button type="button" class="arrangeDone">DONE</button></div>
   <div class="arrangeLoad"><select class="arrangePlaylistSelect" aria-label="Load an existing playlist to arrange"><option value="">LOAD A SAVED PLAYLIST…</option></select><button type="button" class="arrangeLoadBtn">LOAD</button></div>
   <div class="arrangeCommands"><button type="button" class="arrangeSave">SAVE PLAYLIST</button><button type="button" class="arrangePlay">PLAY</button><button type="button" class="arrangeBuy buyBtn">BUY SELECTED</button></div>
   <div class="arrangeHint">Hold a song to drag, or use ↑ ↓. Save your order when finished.</div><div class="arrangeNotice" role="status" aria-live="polite"></div>
 </div>
 <div class="scroll" role="region" aria-label="Scrollable Grand Element music collection" tabindex="0"></div>
 <div class="selectionBar" aria-label="Checked song controls"><strong class="checkedCount" aria-live="polite">CHECKED SONGS · 0</strong><div class="selectionActions"><button type="button" class="arrangeBtn" aria-pressed="false">ARRANGE</button><button type="button" class="playSelected" disabled>PLAY</button><button type="button" class="buySelected buyBtn" disabled>BUY</button></div></div>

</section>`;
document.body.appendChild(host);
const el=sel=>root.querySelector(sel),scroller=el('.scroll'),notice=el('.notice');
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
function selectedTracks(){
 const byPath=new Map(state.tracks.map(track=>[track.path,track]));
 return [...state.selected].map(path=>byPath.get(path)).filter(Boolean);
}
function updateMeta(){
 const count=state.loaded?selectedTracks().length:state.selected.size;
 el('.checkedCount').textContent='CHECKED SONGS · '+count;
 el('.buySelected').disabled=count===0;
 el('.playSelected').disabled=count===0;
 el('.arrangePlay').disabled=count===0;
 el('.buySelected').title=count?'Add '+count+' checked song'+(count===1?'':'s')+' to the GE Support cart':'Check songs to prepare a purchase';
 el('[data-action=save]').disabled=count===0;
}
function requestBuy(intent){
 if(!intent||!['album','tracks'].includes(intent.mode))return;
 // A valid unrestricted GE Music receipt may rehearse payment and delivery.
 // This does not authorize a real purchase, and never writes a Vault grant.
 if(window.GEDemoCheckout?.authorizedMusic?.()){
   void window.GEDemoCheckout.open(intent);return;
 }
 try{sessionStorage.setItem('GE_MUSIC_SHOP_SELECTION_V1',JSON.stringify({version:1,...intent}))}
 catch(_){say('Unable to prepare the shopping selection on this device.');return}
 recordPlaylistInteraction('control_change',{control:'music_buy_cart_open',kind:intent.mode,quantity:intent.paths?.length||1});
 location.assign('../support/?section=music&flow=shop&ge_music_buy=1');
}
function readTestPurchase(){
 // TEST ONLY. This record is not a receipt or server-side ownership grant.
 if(localStorage.getItem('GE_PLAYER_OWNER_DEMO_V1')!=='yes')return [];
 try{
  const rows=JSON.parse(localStorage.getItem(testPurchaseKey)||'[]');
  return Array.isArray(rows)?rows.filter(row=>row?.testOnly===true&&Array.isArray(row.paths)):[];
 }catch(_){return []}
}
function testPurchasedPaths(){
 const all=new Set();
 for(const order of readTestPurchase())for(const path of order.paths){
  const value=canonical(path);if(value)all.add(value);
 }
 return all;
}
function openTestLibrary(){
 if(localStorage.getItem('GE_PLAYER_OWNER_DEMO_V1')!=='yes')return;
 if(!state.open){open();}
 state.view='test-purchases';state.arranging=false;state.term='';el('.search').value='';
 render();scroller.scrollTop=0;
}
function canPlayTrack(track){
 const access=musicAccessActive();
 return (!!access&&(!access.restricted||access.allowed.includes(track.path)))||testPurchasedPaths().has(track.path);
}
function albumActions(album,tracks){
 const actions=elem('div','albumActions');
 if(tracks.length&&tracks.every(canPlayTrack)){
   const play=elem('button','','PLAY');play.type='button';play.setAttribute('aria-label','Play full album '+album);
   play.addEventListener('click',()=>void playTrack(tracks[0],tracks.map(t=>t.path)));
   actions.append(play);
 }
 const buy=elem('button','buyBtn','BUY');buy.type='button';buy.setAttribute('aria-label','Buy album '+album);
 buy.addEventListener('click',()=>requestBuy({mode:'album',album}));
 actions.append(buy);
 return actions;
}
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
  if(localStorage.getItem('GE_PLAYER_OWNER_DEMO_V1')==='yes')filter.add(new Option('TEST PURCHASED MUSIC · LOCAL ONLY','test-purchases'));

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
function saveMine(stayInArrange=false){
 const name=prompt('Name this playlist (saved on this device):',state.activePlaylist?.source==='user'?state.activePlaylist.name:'My Playlist');if(name==null)return;
 const clean=name.trim().slice(0,100);if(!clean||!state.selected.size){say('Select songs and enter a playlist name first.');return}
 const mine=readMine(),found=mine.find(x=>x.name.toLowerCase()===clean.toLowerCase());
 if(found&&!confirm('Overwrite your saved playlist "'+found.name+'" on this device?'))return;
 const row={id:found?.id||('music-'+Date.now().toString(36)),name:clean,songs:[...state.selected],updatedAt:Date.now()};
 const updated=[row,...mine.filter(x=>x.id!==row.id)].slice(0,100);
 try{
   localStorage.setItem(myKey,JSON.stringify(updated));
   recordPlaylistInteraction('control_change',{control:'user_playlist_save',playlist_id:row.id,song_count:row.songs.length,storage:'local_device'});
   state.activePlaylist={source:'user',id:row.id,name:row.name};
   say('Saved '+row.songs.length+' songs in order on THIS DEVICE ONLY. Fan account syncing is not connected.');
   if(stayInArrange){render();}else setView('user-playlists')
 }
 catch(_){say('Could not save this playlist on this device.')}
}
async function loadPublished(){
 if(state.playlistsLoading)return;
 state.playlistsLoading=true;
 state.playlistMessage='CHECKING GITHUB AND GE VAULT PLAYLISTS…';
 if(state.open)render();
 const valid=p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.songs);
 const toList=(rows,source)=>rows.filter(valid).map(p=>({
  id:String(p.id),name:String(p.name).trim(),
  songs:[...new Set(p.songs.map(canonical).filter(Boolean))],source
 })).filter(p=>p.id&&p.name&&p.songs.length);
 async function publicVaultList(endpoint,source){
  // These are public, explicitly published records ONLY. No private fan
  // playlists, DJ keys or access tokens ever enter this unauthenticated UI.
  const response=await fetch('https://vault.grandelement.com'+endpoint,{cache:'no-store'});
  if(!response.ok)throw Error('Vault '+source+' HTTP '+response.status);
  const data=await response.json();
  if(data?.ok!==true||!Array.isArray(data.items))throw Error('Invalid Vault '+source+' response');
  return toList(data.items,source);
 }
 const [github,vaultMusic,vaultDJ]=await Promise.allSettled([
  (async()=>{
   const response=await fetch('https://raw.githubusercontent.com/grandelement/website/main/playlists/registry.json?refresh='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw Error('GitHub HTTP '+response.status);
   const data=await response.json();
   if(data?.format!=='ge-playlist-registry-v1'||!Array.isArray(data.playlists))throw Error('Invalid GitHub playlist format');
   return data;
  })(),
  publicVaultList('/v1/public/music-playlists','vault-music'),
  publicVaultList('/v1/public/dj-playlists','vault-dj')
 ]);
 try{
  const assigned=new Set(musicAccessActive()?.playlistIds||[]);
  const githubOk=github.status==='fulfilled';
  const data=githubOk?github.value:{playlists:[]};
  // All saved GE names are visible in LOAD. Playback is still controlled by
  // the code entitlement; unlisted items are tagged, not silently hidden.
  state.publicLists=data.playlists.filter(valid)
   .map(p=>({id:p.id,name:p.name,songs:p.songs.map(canonical).filter(Boolean),
    visibility:p.visibility||'unlisted',source:'github'})).filter(p=>p.songs.length);
  state.assignedLists=data.playlists.filter(p=>valid(p)&&assigned.has(p.id))
   .map(p=>({id:p.id,name:p.name,songs:p.songs.map(canonical).filter(Boolean),source:'github'}));
  const countGitHub=state.publicLists.length;
  const recordedIds=new Set(state.publicLists.map(p=>p.id));
  const recordedDJNames=new Set(state.publicLists.filter(p=>p.name.toLowerCase()==='bangers').map(()=>'bangers'));
  let vaultCount=0;
  for(const response of [vaultMusic,vaultDJ]){
   if(response.status!=='fulfilled')continue;
   for(const p of response.value){
    // The same Bangers may be exposed by both published Vault endpoints.
    // Keep its real ID and exact song ordering instead of creating a new mix.
    if(recordedIds.has(p.id)||(p.name.toLowerCase()==='bangers'&&recordedDJNames.has('bangers')))continue;
    recordedIds.add(p.id);
    if(p.name.toLowerCase()==='bangers')recordedDJNames.add('bangers');
    state.publicLists.push(p);vaultCount++;
    if(assigned.has(p.id)&&!state.assignedLists.some(x=>x.id===p.id))state.assignedLists.push(p);
   }
  }
  const parts=['GITHUB '+(githubOk?countGitHub:'UNAVAILABLE'),'VAULT '+vaultCount];
  const vaultOnline=vaultMusic.status==='fulfilled'||vaultDJ.status==='fulfilled';
  if(!vaultOnline)parts[1]='VAULT UNAVAILABLE';
  if(!githubOk&&vaultOnline)parts.push('GITHUB ERROR');
  if(githubOk&&!vaultOnline)parts.push('VAULT CONNECTION ERROR');
  if(vaultOnline&&vaultCount===0)parts.push('NO PUBLISHED VAULT PLAYLISTS');
  state.playlistMessage=parts.join(' · ');
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
 status.hidden=!access;
 status.textContent=access?
  ('CODE ACTIVE · '+(access.restricted?'AUTHORIZED MUSIC':'ALL MUSIC')+' · EXPIRES '+new Date(access.until).toLocaleTimeString()):'';
 el('.musicCodeClear').hidden=!access;
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
 el('.musicCodeState').hidden=false;el('.musicCodeState').textContent='Verifying code with GE Vault…';
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
async function playTrack(track,queueOverride){
 // A code-restricted Music session can NEVER substitute the public Radio
 // scope or change the global Bangers broadcast. Verify every requested song.
 const access=musicAccessActive();
 const codePermitted=!!access&&(!access.restricted||access.allowed.includes(track.path));
 const testPermitted=testPurchasedPaths().has(track.path);
 if(!codePermitted&&!testPermitted){say('Enter a GE access code to unlock PLAY, or use BUY to visit the store.');return}
 if(codePermitted){
   try{await musicCodeRequest({action:'verify',token:access.token,track_path:track.path})}
   catch(error){
     say('MUSIC CODE REJECTED · '+String(error.message||error));clearMusicAccess();return;
   }
 }
 // Test purchases are a local owner-only player rehearsal, not Vault access.

 // Existing preview transport remains in charge; code verification alone is
 // not proof of paid-content delivery or a full-length song license.
 const queue=Array.isArray(queueOverride)&&queueOverride.length?queueOverride:
   state.view==='access-code'?chosenSongs().map(t=>t.path):[track.path];
 const outcome=window.GEMusicV5Bridge?.play?.(track.path,queue);
 if(outcome?.ok){say('Opening '+track.title+'.');return}
 say(outcome?.message||'Music preview is loading. Tap PLAY again.');
}
async function playCheckedSongs(){
 const tracks=selectedTracks();
 if(!tracks.length){say('Check at least one song to play.');return}
 const inaccessible=tracks.filter(t=>!canPlayTrack(t));
 if(inaccessible.length){
  say(inaccessible.length+' CHECKED SONG'+(inaccessible.length===1?' NEEDS':'S NEED')+' ACCESS · Enter a GE code to play your selection.');
  return;
 }
 // Preserve the exact checked-song order and prohibit mixing ungranted
 // selections into a restricted Vault or owner-test playlist.
 const queue=tracks.map(t=>t.path);
 recordPlaylistInteraction('control_change',{control:'music_play_checked',song_count:queue.length});
 await playTrack(tracks[0],queue);
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
   row.classList.toggle('selectedSong',checkbox.checked);
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
 row.classList.toggle('selectedSong',checkbox.checked);
 const actions=elem('div','songActions');
 if(canPlayTrack(track)){
   const play=elem('button','','PLAY');play.type='button';play.setAttribute('aria-label','Play '+track.title);
   play.addEventListener('click',()=>void playTrack(track));actions.append(play);
 }
 const buy=elem('button','buyBtn','BUY');buy.type='button';buy.setAttribute('aria-label','Buy '+track.title+' from '+track.album);
 buy.addEventListener('click',()=>requestBuy({mode:'tracks',paths:[track.path]}));actions.append(buy);
 row.append(label,actions);
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
   say('ORDER UPDATED · SAVE PLAYLIST');
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
 if(state.arranging)state.arrangeReturnView='checked';
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
 if(state.view==='test-purchases')return state.tracks.filter(t=>testPurchasedPaths().has(t.path));
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
  const albumText=elem('span','albumText');
  albumText.append(elem('span','albumTitle',album));
  label.append(box,albumText);
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
 el('.window').classList.toggle('arranging',state.arranging);
 scroller.replaceChildren();updateMeta();
 if(state.arranging){
   el('.arrangeCount').textContent='ARRANGE · '+selectedTracks().length+' SONGS';
   const select=el('.arrangePlaylistSelect'),prior=select.value;
   select.replaceChildren(new Option('LOAD A SAVED PLAYLIST…',''));
   const collections=[
    ...state.publicLists.map(p=>({label:'GE · '+p.name,key:'ge:'+p.id})),
    ...state.assignedLists.filter(p=>!state.publicLists.some(x=>x.id===p.id)).map(p=>({label:'CODE · '+p.name,key:'assigned:'+p.id})),
    ...readMine().map(p=>({label:'MY · '+p.name,key:'local:'+p.id}))
   ];
   for(const p of collections)select.add(new Option(p.label,p.key));
   if([...select.options].some(o=>o.value===prior))select.value=prior;
   else if(collections.length)select.value=collections[0].key;
   el('.arrangeBuy').disabled=!state.selected.size;
   el('.arrangeNotice').textContent=state.notice||'Playlists saved here remain on this device until Vault sync is ready.';
 }
 const term=state.term.toLowerCase().trim();
 const filterTrack=t=>(t.title+' '+t.album).toLowerCase().includes(term);
 notice.textContent=state.arranging?'':(state.notice||(cat==='playlists'?state.playlistMessage:''));
 const arrangeBtn=el('.arrangeBtn');
 arrangeBtn.hidden=false;
 arrangeBtn.textContent=state.arranging?'DONE':'ARRANGE';
 arrangeBtn.setAttribute('aria-pressed',String(state.arranging));
 arrangeBtn.title=state.arranging?'Finish arranging':'Hold and drag a song row to reorder';
 if(!state.loaded){scroller.append(elem('p','empty','Loading the published Grand Element catalog…'));return}
 if(state.view==='albums'&&term){
  // Album-search returns individual matching song titles, not album-only cards.
  const results=state.tracks.filter(filterTrack);
  for(const track of results)appendSong(scroller,track);
  if(!results.length)scroller.append(elem('p','empty','No songs match that search.'));
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
    wrapper.append(albumActions(name,rows));scroller.append(wrapper);
  }
  if(!scroller.children.length)scroller.append(elem('p','empty','No albums match that search.'));
 }else if(state.view==='ge-playlists'){
  scroller.append(elem('div','section','GE PLAYLISTS'));
  // Connection summary is already shown above the scroll area.
  // Do not waste scrolling space by repeating it as another full row.
  const shown=state.publicLists.filter(p=>!term||p.name.toLowerCase().includes(term));
  for(const p of shown)card(scroller,p.name,p.visibility==='unlisted'?
    'UNLISTED · CODE REQUIRED TO PLAY':'OPEN PLAYLIST',()=>{
   state.selected=new Set(p.songs);saveSelected();state.activePlaylist={source:'ge',id:p.id,name:p.name};
   recordPlaylistInteraction('playlist_view',{playlist_id:p.id,playlist_source:p.source||'github',song_count:p.songs.length});
   setView('playlist-order');
  });
  if(!state.publicLists.length&&!state.playlistsLoading)scroller.append(elem('p','empty',
   'NO GE PLAYLISTS RETRIEVED · '+state.playlistMessage+
   '. Owner must sync genuine DJ Bangers into GitHub. No records were deleted.'));
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
 }else if(state.view==='access-code'&&state.accessView==='playlist'){
  breadcrumb('YOUR ASSIGNED PLAYLISTS','all');
  const allowed=new Set(musicAccessActive()?.allowed||[]);
  const named=state.assignedLists.filter(p=>p.songs.some(song=>allowed.has(song)));
  for(const p of named)card(scroller,p.name,'OPEN PLAYLIST',()=>{
   state.accessView='order';state.accessPlaylistFilter=p.id;render();scroller.scrollTop=0;
  });
  if(!named.length)scroller.append(elem('p','empty','Your songs were selected individually. Choose MY ORDER.'));
 }else{
  const chosen=chosenSongs();
  const shown=chosen.filter(filterTrack);
  if(state.view==='test-purchases'){
    scroller.append(elem('div','section','TEST PURCHASES · NOT PAID · THIS DEVICE ONLY'));
    if(!shown.length)scroller.append(elem('p','empty','No simulated purchases yet. Use SIMULATE PURCHASE in owner Sun Lab.'));
  }
  if(state.view==='access-code')breadcrumb(state.accessView==='album'?'AUTHORIZED MUSIC · ALBUM HISTORY':'AUTHORIZED MUSIC · MY ORDER','all');
  if(state.view.startsWith('album:')){
    const name=state.view.slice(6);breadcrumb(name,'albums');
    const bar=elem('div','albumCollectionHeading');applyAlbumStyle(bar,name);
    bar.append(elem('strong','albumViewTitle',name),albumActions(name,state.tracks.filter(t=>t.album===name)));
    scroller.append(bar);
  }
  if(state.view.startsWith('vault:')||state.view.startsWith('local:')){
   const isVault=state.view.startsWith('vault:');
   const p=isVault?state.publicLists.find(p=>p.id===state.view.slice(6)):readMine().find(p=>p.id===state.view.slice(6));
   breadcrumb(p?.name||'Playlist',isVault?'ge-playlists':'user-playlists');
  }
  let currentAlbum='';
  for(const t of shown){
   if(state.view==='all'&&t.album!==currentAlbum){
     currentAlbum=t.album;
     const group=elem('div','albumCollectionHeading'),tracks=state.tracks.filter(row=>row.album===currentAlbum);
     applyAlbumStyle(group,currentAlbum);
     albumSelectAll(group,currentAlbum,tracks);
     group.append(albumActions(currentAlbum,tracks));scroller.append(group);
   }
   appendSong(scroller,t);
  }
  if(!shown.length)scroller.append(elem('p','empty','No tracks match your selection. The album and playlist records have not been changed.'));
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
 if(state.arranging){exitArrange();return}
 state.arrangeReturnView=state.view;
 state.view='checked';state.arranging=true;
 state.term='';el('.search').value='';
 say('Drag to reorder · SAVE PLAYLIST keeps your new order on this device.');
 render();scroller.scrollTop=0;
});
function exitArrange(){
 if(dragSession)finishDrag(false);
 state.arranging=false;state.view='checked';state.notice='';
 render();scroller.scrollTop=0;
}
el('.arrangeDone').addEventListener('click',exitArrange);
el('.arrangeLoadBtn').addEventListener('click',()=>{
 const key=el('.arrangePlaylistSelect').value;
 if(!key){
  const msg=state.playlistsLoading?'Playlists are still loading.':
    'NO SAVED PLAYLISTS AVAILABLE · '+state.playlistMessage;
  say(msg);el('.arrangeNotice').textContent=msg;return;
 }
 const [source,id]=key.split(':');
 const p=source==='local'?readMine().find(p=>p.id===id):
   source==='ge'?state.publicLists.find(p=>p.id===id):
   source==='assigned'?state.assignedLists.find(p=>p.id===id):null;
 if(!p){say('That playlist is no longer available. Refresh playlists.');render();return}
 state.selected=new Set(p.songs.map(canonical).filter(Boolean));
 state.activePlaylist={source:source==='local'?'user':'ge',id:p.id,name:p.name};
 saveSelected();state.term='';el('.search').value='';
 state.view='playlist-order';state.arranging=true;
 recordPlaylistInteraction('playlist_view',{playlist_id:p.id,playlist_source:source,song_count:p.songs.length});
 say('Loaded '+p.name+' · Arrange and SAVE PLAYLIST to keep changes.');
 render();scroller.scrollTop=0;
});
el('.arrangeSave').addEventListener('click',()=>saveMine(true));
el('.arrangeBuy').addEventListener('click',()=>{
 const tracks=selectedTracks();if(tracks.length)requestBuy({mode:'tracks',paths:tracks.map(t=>t.path),express:true});
});
el('.playSelected').addEventListener('click',()=>void playCheckedSongs());
el('.arrangePlay').addEventListener('click',()=>void playCheckedSongs());
el('.buySelected').addEventListener('click',()=>{
 const tracks=selectedTracks();if(!tracks.length)return;
 requestBuy({mode:'tracks',paths:tracks.map(t=>t.path),express:true});
});
el('.songFilter').addEventListener('change',event=>setView(event.target.value));
el('.playlistFilter').addEventListener('change',event=>setView(event.target.value));
root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
 const access=musicAccessActive();
 if(b.dataset.tab==='songs')setView(access?.restricted?'access-code':'all');
 else setView('ge-playlists');
}));
root.querySelectorAll('[data-access-view]').forEach(b=>b.addEventListener('click',()=>{
 state.accessView=b.dataset.accessView;state.accessPlaylistFilter='';state.view='access-code';
 render();scroller.scrollTop=0;
}));
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
root.querySelector('[data-action=save]').addEventListener('click',()=>saveMine(false));
document.addEventListener('keydown',event=>{if(!state.open)return;if(event.key==='Escape'){event.preventDefault();close()}});
button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();state.open?close():open()});
button.dataset.geMusicBuild=BUILD;
window.GEMusicV5={open,close,showTestLibrary:openTestLibrary,
 refresh:()=>{if(state.open)render()},reportPlayback:message=>say(message),
 build:BUILD,state:()=>({loaded:state.loaded,open:state.open,count:state.selected.size,arranging:state.arranging})};
window.addEventListener('ge-music-demo-purchase-updated',()=>{if(state.open)render()});
// A Vault-verified checkout can return the visitor directly to their MUSIC
// selection. This flag never grants access; only a signed Vault session does.
try{
 if(sessionStorage.getItem('GE_MUSIC_OPEN_AFTER_ACCESS_V1')==='1'){
  sessionStorage.removeItem('GE_MUSIC_OPEN_AFTER_ACCESS_V1');
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',open,{once:true});
  else open();
 }
}catch(_){}
})();