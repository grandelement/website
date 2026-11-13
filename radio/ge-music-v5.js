/* GRAND ELEMENT MUSIC V5 · Single-scroll library (2026-10-24)
   Self-contained UI with Shadow DOM: no old Radio picker styles or scroll scripts.
   Published songs and GE DJ playlists remain source-of-truth. */
(()=>{
'use strict';
const BUILD='GE-MUSIC-V7.34-20261109-DELETE-ROUTE-FALLBACK';
const button=document.getElementById('geMusicV5Button');
if(!button)return;
const store='GE_MUSIC_V3_SELECTION_20261024',myKey='GE_MUSIC_PERSONAL_PLAYLISTS_V1',fanPlaylistKey='GE_MUSIC_FAN_VAULT_KEY_V1',workingKey='GE_MUSIC_WORKING_PLAYLIST_V1',
  testPurchaseKey='GE_MUSIC_TEST_PURCHASES_V1',
  musicSessionKey='GE_MUSIC_CODE_SESSION_V1',
  musicSessionEndpoint='https://vault.grandelement.com/v1/public/access/music-session';
const albumOrder=['Aether','Fire','Spirit','Soul','Love','Intergy','Sessions II','Sessions I','Live','Trio','Fundamental Groove','Singles'];
const LEGACY_ALBUMS=new Set(['Fundamental Groove','Trio','Live','Sessions I','Sessions II']);
const albumDescriptions={Aether:'Energy, consciousness and the unseen connections between us.',Intergy:'Solo electronic grooves, piano, analog synth and rhythm.', 'Sessions I':'Original Grand Element full-band studio sessions.', 'Sessions II':'Further recordings from the original band sessions.',Trio:'A stripped-back studio trio with keys, guitar and drums.',Live:'Live performances from the Grand Element trio.','Fundamental Groove':'Instrumental grooves built around rhythm and movement.',Love:'A collection exploring love and connection.',Soul:'Instrumental reflections on soul and feeling.',Spirit:'Music exploring spirit and atmosphere.',Fire:'Rhythm, energy and intensity.',Singles:'Individual Grand Element recordings.'};
// Representative hues visually checked against all 11 JPG covers in
// ge-images/images. These are NOT the unrelated GOLF_PLANETS gameplay colors.
const albumColors={'Fundamental Groove':'#b94754','Trio':'#a86b3d','Live':'#829343','Sessions I':'#388c76','Sessions II':'#2e9bb1','Intergy':'#635293','Love':'#9b357d','Soul':'#c84cba','Spirit':'#d29482','Fire':'#e2b448','Aether':'#bfc4cd','Singles':'#6e9bb5'};
function applyAlbumStyle(element,name){
 const hex=albumColors[name]||'#addcf5';
 element.style.setProperty('--ge-album-accent',hex);
 element.style.borderLeft='5px solid '+hex;
 const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
 element.style.background='linear-gradient(90deg,rgba('+r+','+g+','+b+',.32),rgba('+r+','+g+','+b+',.13))';
}
const state={open:false,loading:false,loaded:false,tracks:[],view:'all',term:'',showLegacyAlbums:false,expandedAlbum:'',focusedAlbum:'',selected:new Set(),publicLists:[],fanLists:[],assignedLists:[],accessView:'order',accessPlaylistFilter:'',activePlaylist:null,playlistDraftName:'',savingShared:false,arranging:false,arrangeReturnView:'checked',notice:'',playlistsLoading:false,playlistMessage:'CONNECTING TO GITHUB PLAYLISTS…',musicAccess:null,redeemBusy:false};
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
.filterRow{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:7px 0 0}
.filterRow select.songFilter{width:auto;min-width:0;flex:1 1 160px}
.filterRow select.playlistFilter{flex:1 1 100%}
.filterRow .songSelectAll{display:flex;flex:0 0 auto;align-items:center;gap:6px;min-height:42px;
 padding:5px 8px;border:1px solid #5898c7;border-radius:8px;background:#10314d;
 color:#eaffff;font-size:12px;font-weight:850;white-space:nowrap;cursor:pointer}
.filterRow .songSelectAll[hidden]{display:none!important}
.filterRow .reloadCatalogBtn{min-height:42px;width:43px;padding:5px;font-size:22px;flex:0 0 43px;border-color:#72bdec;background:#10314d;color:#ecfaff}
.filterRow .reloadCatalogBtn:disabled{opacity:.55}
.filterRow .songSelectAll input{width:18px;height:18px;min-width:18px;margin:0;accent-color:#48baff}
.filterRow select{width:100%;min-width:0;min-height:42px;padding:8px 10px;border:1px solid #5898c7;border-radius:9px;background:#10314d;color:#ecfaff;font-size:clamp(13px,3.5vw,16px);font-weight:750}
.filterRow select[hidden]{display:none!important}
.musicCodeTools{display:flex;align-items:center;gap:6px;margin-top:0;border:1px solid #ae83e9;border-radius:9px;padding:6px;background:linear-gradient(95deg,#30174b,#171c40 75%);box-shadow:inset 0 0 0 1px rgba(220,174,255,.12)}
.musicCodeTools[hidden]{display:none!important}
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
.selectionActions .buySelected{min-width:62px;min-height:48px;font-size:13px;background:linear-gradient(125deg,#5f4215,#a87d2d)!important;border-color:#efc978!important}
.selectionActions .playSelected{
  position:relative;isolation:isolate;overflow:hidden;min-width:80px;min-height:48px;
  font-size:clamp(14px,3.7vw,18px);letter-spacing:.06em;font-weight:950;
  border:2px solid #d0f6ff;background:linear-gradient(120deg,#0874c7,#16a5ea,#0867bc);
  box-shadow:0 0 13px rgba(68,191,255,.55),inset 0 0 10px rgba(210,249,255,.2)
}
.selectionActions .playSelected:not(:disabled)::after{
  content:"";pointer-events:none;position:absolute;inset:-90% -50%;
  background:linear-gradient(112deg,transparent 35%,rgba(255,255,255,.08) 43%,rgba(255,255,255,.72) 50%,rgba(255,255,255,.10) 57%,transparent 65%);
  transform:translateX(-90%) rotate(9deg);animation:geMusicPlaySparkle 5.2s ease-in-out infinite
}
@keyframes geMusicPlaySparkle{0%,20%{transform:translateX(-90%) rotate(9deg)}50%,100%{transform:translateX(90%) rotate(9deg)}}
@media(max-width:520px){
 .selectionBar{flex-wrap:wrap;gap:5px;padding:7px 8px max(8px,env(safe-area-inset-bottom))}
 .selectionBar strong{flex:0 0 100%;font-size:12px}
 .selectionActions{width:100%;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
 .selectionActions button{min-width:0!important;min-height:46px!important;padding:5px 4px!important;font-size:12px}
 .selectionActions .playSelected{font-size:16px!important}
 .selectionActions .buySelected{font-size:15px!important}
}
@media(prefers-reduced-motion:reduce){.selectionActions .playSelected::after{animation:none!important;display:none!important}}

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
.legacyToggle{width:100%;margin:10px 0 7px;min-height:47px;background:#0d304d;border:1px solid #6a91ad;color:#eef8ff;letter-spacing:.05em;font-weight:850}
.legacyHeading{margin-top:6px;color:#b7d9ed;font-size:12px;padding:5px 8px}
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
.playlistActionsBar{display:none!important}
.geHeaderActions{display:flex;align-items:center;gap:6px;flex:0 1 auto;min-width:0}
.geCodeIdentity{font-size:12px;font-weight:850;line-height:1.13;color:#fff;
  min-width:0;max-width:128px;text-align:left;white-space:normal;
  text-wrap:balance;overflow-wrap:break-word;letter-spacing:0}
.geCodeIdentity[hidden]{display:none!important}
.geCodeIdentity{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.header .brand{text-wrap:balance;overflow-wrap:normal}
@media(max-width:420px){
 .header{gap:5px;padding:7px 8px}
 .geHeaderActions{gap:4px}
 .geCodeIdentity{max-width:79px;font-size:10px;line-height:1.12}
 .accessToggle{min-width:76px!important;font-size:10px!important;padding:5px 4px!important}
 .header .close{min-width:58px!important;padding:5px 5px!important;font-size:11px!important}
 .header .brand{font-size:11px!important;max-width:100px}
}
.accessToggle{min-height:36px;min-width:88px;padding:5px 6px;font-size:11px;background:#6f329d;border-color:#cc9df7;color:#fff}
.accessToggle[aria-expanded=true]{background:#9250b8}
.gePlaylistBar{display:grid;grid-template-columns:minmax(0,1fr) 76px 76px;gap:6px;margin:8px 0 0;align-items:center}
.gePlaylistBar[hidden]{display:none!important}
.arrangeLoad select{display:none!important}
.gePlaylistBar input{width:100%;min-width:0;height:42px;padding:6px 8px;border-radius:8px;border:1px solid #579fd4;background:#061d30;color:#fff;font-size:16px}
.gePlaylistBar button{height:42px;min-width:0;padding:5px 3px;font-size:11px}
.gePlaylistBar .arrangeSave{background:#176ca5;border-color:#9ee3ff}
.gePlaylistBar .arrangeLoadBtn{background:#104b74;border-color:#71bdec}
.gePlaylistBar .arrangeCurrentName{min-width:0;width:100%;height:42px;padding:6px 9px;border-radius:8px;border:1px solid #579fd4;background:#061d30;color:#fff;font-size:16px}
.gePlaylistPicker[hidden]{display:none!important}
.gePlaylistPicker{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:10px;background:rgba(0,8,16,.83)}
.gePlaylistDialog{display:flex;flex-direction:column;gap:9px;width:min(550px,100%);max-height:min(84dvh,730px);padding:13px;border:2px solid #6bc5f4;border-radius:13px;background:#07233a;color:#f3fbff;box-shadow:0 20px 60px #000e}
.gePlaylistDialogHead{display:flex;justify-content:space-between;gap:8px;align-items:center}
.gePlaylistDialogHead strong{font-size:17px}
.gePlaylistDialogHead button{min-height:35px;min-width:42px}
.gePlaylistTabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
.gePlaylistTabs button{min-height:43px;font-size:13px;padding:5px}
.gePlaylistTabs button[aria-pressed=true]{background:#1674af;border-color:#a7ebff}
.gePlaylistItems{min-height:130px;max-height:57dvh;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;display:flex;flex-direction:column;gap:7px}
.gePlaylistItems button{min-height:51px;text-align:left;padding:9px 12px;border-radius:9px;background:#0b3856;border-color:#548eae;font-size:15px}
.gePlaylistItems button[aria-pressed=true]{background:#175a85;border:2px solid #adf0ff}
.gePlaylistItems small{display:block;color:#b6dcef;font-size:11px}
.gePlaylistItems .empty{font-size:13px;padding:12px}
.gePlaylistConfirm{min-height:45px;background:#176faa;border-color:#b6eaff}
@media(max-width:400px){.header .brand{font-size:12px;letter-spacing:.02em}.header .close{min-width:65px;padding:5px 7px;font-size:12px}.gePlaylistBar{grid-template-columns:minmax(0,1fr) 60px 60px;gap:4px}}
.window.arranging .arrangeCurrent,.window.arranging .arrangeLoad,.window.arranging .arrangeCommands{display:none!important}
.playlistActionsBar button{font-size:clamp(11px,3.2vw,13px);min-height:36px;padding:6px 11px}
.playlistActionsBar [data-action=clear]{background:#092a43;border-color:#559dcb}
.playlistActionsBar [data-action=save]{background:#125784;border-color:#87ccf6;color:#fff;font-weight:850}
.arrangeDock{display:none;flex:0 0 auto;background:#06243b;border-bottom:1px solid #4b91bd;padding:8px 10px;gap:7px}
.userPlaylistRow{display:flex;align-items:stretch;gap:6px;margin-bottom:8px;min-width:0;touch-action:pan-y}
.userPlaylistRow>.album{flex:1;min-width:0}
.userPlaylistEdit{flex:0 0 auto;align-self:stretch;background:#174e79;border:1px solid #8fcdf8;color:#fff;padding:8px 10px;border-radius:8px;font-weight:800}
.userPlaylistRow.swiped .userPlaylistEdit,.userPlaylistRow.swiped .userPlaylistDelete{box-shadow:0 0 0 2px #9cdaff}
@media(max-width:420px){.userPlaylistRow{gap:4px}.userPlaylistRow>.album{padding:8px 7px;font-size:12px}.userPlaylistEdit,.userPlaylistDelete{font-size:11px;padding:7px 6px}}
.userPlaylistDelete{flex:0 0 auto;align-self:stretch;background:#542936;border:1px solid #e7a0ab;color:#fff;padding:8px 12px;border-radius:8px;font-weight:800}
.arrangeTitle{display:flex;align-items:center;justify-content:space-between;gap:8px}
.arrangeTitleActions{display:flex;align-items:center;gap:7px;margin-left:auto}
.arrangeTitleActions .arrangeEdit{background:#294967;border-color:#9ed8fa}
.arrangeTitleActions .arrangeDone{background:#176a9d;border-color:#a6e4ff}
@media(max-width:380px){.arrangeTitle strong{font-size:13px}.arrangeTitleActions{gap:4px}.arrangeTitleActions button{padding:7px 9px}}
.arrangeTitle strong{font-size:clamp(14px,3.8vw,18px);font-weight:900;color:#e9faff;letter-spacing:.05em}
.arrangeTitle button{min-height:35px;background:#176a9d;border-color:#a6e4ff}
.arrangeCurrent{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:4px 9px}
.arrangeCurrent label{color:#d9f2ff;font-size:11px;font-weight:900;white-space:nowrap}
.arrangeCurrent input{width:100%;min-width:0;min-height:40px;border:1px solid #5da7d8;border-radius:8px;background:#08283f;color:#fff;padding:7px 10px;font-size:16px;font-weight:750}
.arrangeCurrent .arrangeSource{grid-column:1/-1;color:#afd8f3;font-size:10px;line-height:1.25}
.arrangeOwnerAuth{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px;border:1px solid #4c95bd;border-radius:8px;background:#071a2c}
.arrangeOwnerAuth[hidden]{display:none!important}
.arrangeOwnerAuth label{font-size:11px;font-weight:850;flex:1 1 100%}
.arrangeOwnerAuth input{flex:1 1 130px;min-width:0;min-height:41px;background:#08283f;border:1px solid #6cb9e5;color:#fff;border-radius:7px;padding:7px 9px;font-size:16px}
.arrangeOwnerAuth button{min-height:41px;font-size:12px}
.arrangeLoad{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px}
.arrangeLoad select{min-width:0;width:100%;background:#08283f;color:#fff;border:1px solid #5da7d8;border-radius:8px;padding:6px 8px;font-size:13px;min-height:38px}
.arrangeLoad button{font-size:12px;min-height:38px}
.arrangeCommands{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
.arrangeCommands button{min-width:0;font-size:clamp(10px,2.8vw,13px);min-height:39px;padding:5px 5px}
.arrangeDock .arrangeHint{font-size:11px;color:#b4e0f6;line-height:1.3}
.arrangeDock .arrangeNotice{font-size:11px;color:#ffe3a0;line-height:1.3}
.window.arranging{top:max(2px,env(safe-area-inset-top));bottom:2px;width:min(940px,calc(100vw - 6px));max-height:calc(100dvh - 4px);border-radius:9px}
.window.arranging .tools{display:block!important;padding:6px 8px}
.window.arranging .tools>.search,.window.arranging .tools>.filterRow{display:none!important}
.window.arranging .tools>.browse{display:grid!important;margin-top:5px!important}
.window.arranging .selectionBar{display:flex!important}
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
/* MUSIC is the sole visible brand label. Never show impending session/Gate
   timing. Keep the owner-assigned access name and verified Vault behavior. */
.header{gap:6px;min-height:53px;padding:6px 10px}
.header .brand{flex:0 0 auto;white-space:nowrap;max-width:none!important;
 font-size:clamp(20px,5.2vw,24px)!important;font-weight:950;line-height:1.05;letter-spacing:.065em}
.geHeaderActions{flex:0 1 auto;margin-left:auto;gap:5px;justify-content:flex-end}
.geCodeIdentity{min-width:0;max-width:115px;font-size:11px;line-height:1.15;
 white-space:nowrap;text-overflow:ellipsis;overflow:hidden;
 -webkit-line-clamp:unset;display:block}
.geCodeIdentity[hidden]{display:none!important}
.header .accessToggle{min-width:82px!important;min-height:34px;
 padding:5px 7px!important;font-size:11px!important}
.header .close{min-width:62px!important;min-height:34px;
 padding:5px 7px!important;font-size:11px!important}
.tools{padding-top:7px}
.tools .browse{margin-top:4px}
@media(max-width:420px){
 .header{gap:4px;padding:6px 8px;min-height:51px}
 .header .brand{font-size:20px!important}
 .geHeaderActions{gap:4px}
 .geCodeIdentity{max-width:85px;font-size:10px}
 .header .accessToggle{min-width:76px!important;padding:5px 5px!important;font-size:10px!important}
 .header .close{min-width:57px!important;padding:5px 5px!important;font-size:10px!important}
}
@media(max-width:350px){
 .geCodeIdentity{max-width:65px;font-size:9px}
 .header .brand{font-size:18px!important}
 .header .accessToggle{min-width:70px!important}
 .header .close{min-width:52px!important}
}

.albumPlanetGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:4px 0 12px}
.albumPlanetGrid .albumBrowseRow{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:3px;margin:0;min-width:0;padding:6px;border:1px solid rgba(155,209,240,.5);border-radius:14px;background:radial-gradient(circle at 50% 15%,rgba(22,104,160,.23),#061523 76%);overflow:hidden}
.albumPlanetGrid .albumPickerCompact{grid-column:1;grid-row:1;align-self:start;min-height:30px;min-width:0;max-width:none;background:transparent;border:0;padding:3px}
.albumPlanetGrid .albumPickerCompact input{width:22px;height:22px;accent-color:#0a9aff}
.albumPlanetGrid .album{grid-column:2;grid-row:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:0;width:100%;min-height:104px;padding:5px 1px;background:transparent;border:0;box-shadow:none}
.albumPlanetGrid .album::before{content:"";display:block;width:clamp(42px,12vw,74px);height:clamp(42px,12vw,74px);border-radius:50%;background:radial-gradient(circle at 33% 28%,#d0efff 0%,#47c0ff 9%,#0069b8 34%,#042f68 64%,#000b24 100%);box-shadow:0 0 12px rgba(74,181,255,.5),inset -10px -8px 14px #001126;flex:0 0 auto}
.albumPlanetGrid .album b{font-size:clamp(12px,3.3vw,17px);text-align:center;line-height:1.2;overflow-wrap:anywhere}
.albumPlanetGrid .album small{font-size:10px}
.albumPlanetGrid .albumActions{display:none}
.selectionActions .playSelected:not(:disabled){background:rgba(255,255,255,.035)!important;border:1.5px solid rgba(245,251,255,.8)!important;box-shadow:0 0 11px rgba(245,251,255,.55),inset 0 0 12px rgba(255,255,255,.08)!important}

/* Continuous polished silver PLAY with traveling rim lights. */
.selectionActions .playSelected:not(:disabled){
 color:#172a3a!important;
 border:2px solid #f4f8fc!important;
 background:linear-gradient(155deg,#fff 0%,#d4dce4 17%,#8799aa 35%,#f8fbff 52%,#aebbc8 72%,#f7fafc 100%)!important;
 background-size:220% 220%!important;
 text-shadow:0 1px 0 rgba(255,255,255,.8)!important;
 box-shadow:inset 0 2px 2px rgba(255,255,255,.9),inset 0 -3px 5px rgba(45,60,78,.35),0 0 8px rgba(238,249,255,.6),0 0 18px rgba(190,224,255,.32)!important;
 animation:geSilverMetalFlow 3.6s linear infinite,geSilverRimPulse 2.4s ease-in-out infinite!important;
}
.selectionActions .playSelected:not(:disabled)::before{
 content:"";pointer-events:none;position:absolute;inset:-2px;border-radius:inherit;
 background:conic-gradient(from 0deg,transparent 0deg,rgba(255,255,255,0) 60deg,#fff 83deg,rgba(170,227,255,.95) 94deg,transparent 112deg,transparent 190deg,#fff 212deg,rgba(190,235,255,.9) 224deg,transparent 242deg,transparent 360deg);
 animation:geSilverOrbit 3.2s linear infinite;
 opacity:.9;
 -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
 -webkit-mask-composite:xor;mask-composite:exclude;
 padding:2px;
}
.selectionActions .playSelected:not(:disabled)::after{
 content:"";pointer-events:none;position:absolute;inset:-65% -65%;
 background:linear-gradient(108deg,transparent 40%,rgba(255,255,255,.12) 45%,rgba(255,255,255,.95) 50%,rgba(255,255,255,.12) 55%,transparent 60%);
 animation:geSilverSweep 2.8s linear infinite!important;
}
@keyframes geSilverMetalFlow{0%{background-position:0% 0%}100%{background-position:100% 100%}}
@keyframes geSilverRimPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.1)}}
@keyframes geSilverOrbit{to{transform:rotate(360deg)}}
@keyframes geSilverSweep{0%{transform:translateX(-115%) rotate(8deg)}100%{transform:translateX(115%) rotate(8deg)}}
@media(prefers-reduced-motion:reduce){
 .selectionActions .playSelected:not(:disabled),.selectionActions .playSelected:not(:disabled)::before,.selectionActions .playSelected:not(:disabled)::after{animation:none!important}
}

/* Desktop is a separate responsive layout, not a stretched phone interface. */
.albumPlanetGrid .album::before{display:none!important}
.albumPlanetGrid .albumCover{display:block;width:clamp(66px,17vw,118px);height:clamp(66px,17vw,118px);object-fit:cover;border-radius:10px;box-shadow:0 0 14px rgba(105,196,255,.35);flex:0 0 auto}
.albumPlanetGrid .albumCover[hidden]{display:none!important}
.albumPlanetGrid .albumBrowseRow{grid-template-columns:30px minmax(0,1fr)}
.albumPlanetGrid .album{min-height:145px}
@media(min-width:900px) and (min-height:580px){
 .window{width:min(1320px,calc(100vw - 64px));max-height:calc(100dvh - 72px);top:36px;bottom:36px;border-radius:18px}
 .header{padding:13px 20px}.brand{font-size:24px}
 .tools{padding:12px 18px}.scroll{padding:18px 20px 30px}
 .albumPlanetGrid{grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
 .albumPlanetGrid .albumBrowseRow{min-height:215px;padding:12px;grid-template-columns:28px minmax(0,1fr)}
 .albumPlanetGrid .album{min-height:188px;gap:9px}
 .albumPlanetGrid .albumCover{width:118px;height:118px}
 .albumPlanetGrid .album b{font-size:18px}
 .albumPlanetGrid .album small{font-size:12px}
 .selectionBar{padding:12px 20px;min-height:65px}
 .selectionBar strong{font-size:15px}
 .selectionActions button{font-size:14px;min-height:44px;padding:8px 14px}
}
@media(min-width:1400px){.albumPlanetGrid{grid-template-columns:repeat(5,minmax(0,1fr))}}

/* Responsive album picker and fan playlist controls. */
.albumPlanetGrid{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;min-width:0}
.albumPlanetGrid .albumBrowseRow{grid-template-columns:22px minmax(0,1fr);min-width:0;min-height:0;padding:5px;gap:0;border-radius:10px}
.albumPlanetGrid .albumPickerCompact{grid-column:1;grid-row:1;align-self:start;min-width:0!important;max-width:22px!important;padding:2px 0!important}
.albumPlanetGrid .albumPickerCompact input{width:17px!important;height:17px!important}
.albumPlanetGrid .album{grid-column:2;grid-row:1;min-width:0;min-height:98px;gap:3px;padding:2px!important}
.albumPlanetGrid .albumCover{width:clamp(35px,9vw,62px);height:clamp(35px,9vw,62px);border-radius:50%;object-fit:cover}
.albumPlanetGrid .album b{font-size:clamp(10px,2.8vw,14px);line-height:1.1;overflow-wrap:anywhere}
.albumPlanetGrid .album small{font-size:9px;white-space:normal;text-align:center}
.albumPlanetGrid .album[aria-expanded="true"]{box-shadow:inset 0 0 0 2px #a5ecff,0 0 13px rgba(93,201,255,.55)!important;border-radius:9px!important;background:rgba(33,128,190,.35)!important}
.expandedAlbumSongs{margin:8px 0 20px;padding:8px;border:1px solid #78c9fa;border-radius:10px;background:#081c2d;min-width:0}
.expandedAlbumHeading{display:block;font-size:14px;padding:5px 4px 10px;color:#d8f3ff}
.quickPlaylistRow{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 100%}
.quickPlaylistRow input{flex:1 1 0;min-width:0;border:1px solid #6dbbe9;border-radius:8px;background:#081e30;color:#fff;padding:7px 9px;min-height:36px;font-size:13px}
.quickPlaylistRow button{min-height:36px;min-width:56px;padding:5px 8px;font-size:12px}
.quickPlaylistRow .quickPlaylistDelete{background:#542936;border:1px solid #e7a0ab;color:#fff;min-width:64px}
.quickPlaylistRow .quickPlaylistDelete:disabled{opacity:.42;cursor:not-allowed}
@media(max-width:390px){.quickPlaylistRow{gap:4px}.quickPlaylistRow button{min-width:48px;padding:5px 5px;font-size:11px}.quickPlaylistRow .quickPlaylistDelete{min-width:57px}}
.selectionBar{flex-wrap:wrap;min-width:0;gap:6px;padding:7px 9px max(8px,env(safe-area-inset-bottom))}
.selectionBar .checkedCount{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis}
.selectionBar .selectionActions{flex:0 0 auto;min-width:0}
@media(max-width:600px){
 .window{top:max(4px,env(safe-area-inset-top));bottom:max(4px,env(safe-area-inset-bottom));max-height:none;width:calc(100vw - 8px);border-radius:12px}
 .selectionBar{gap:5px}.selectionBar .quickPlaylistRow{width:100%}
 .selectionBar .checkedCount{flex:1 1 100%;font-size:11px}
 .selectionBar .selectionActions{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
 .selectionActions button{min-width:0!important;padding:5px!important}
 .selectionActions .arrangeBtn{display:none!important}
}
@media(max-height:520px) and (orientation:landscape){
 .window{top:2px;bottom:2px;max-height:none;width:calc(100vw - 12px)}
 .header{padding:3px 9px;min-height:34px}.tools{padding:3px 7px}.tools .browse{margin-top:1px}
 .scroll{padding:5px 8px 12px;min-height:0}
 .albumPlanetGrid{grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}
 .albumPlanetGrid .album{min-height:68px}
 .albumPlanetGrid .albumCover{width:38px;height:38px}
 .selectionBar{padding:4px 7px;gap:4px}
 .quickPlaylistRow input,.quickPlaylistRow button{min-height:29px}
 .selectionActions button{min-height:29px!important}
}
@media(min-width:900px) and (min-height:580px){
 .albumPlanetGrid{grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
 .albumPlanetGrid .albumBrowseRow{min-height:125px;padding:8px;grid-template-columns:26px minmax(0,1fr)}
 .albumPlanetGrid .album{min-height:120px}
 .albumPlanetGrid .albumCover{width:75px;height:75px}
 .albumPlanetGrid .album b{font-size:16px}
 .selectionBar .quickPlaylistRow{flex:1 1 100%}
}
@media(min-width:1400px){.albumPlanetGrid{grid-template-columns:repeat(6,minmax(0,1fr))}}

/* GE DESKTOP CONTROL ROOM v1. Mobile selectors are intentionally untouched.
   Desktop artwork, album picker, playlists, checkout and fan access share
   their existing event handlers, storage, and authorization. */
@media (min-width:1024px) and (min-height:600px) and (pointer:fine){
 .backdrop{
  background:radial-gradient(ellipse at 48% 7%,rgba(20,100,175,.26),transparent 47%),rgba(0,5,15,.78);
  backdrop-filter:blur(13px);
 }
 .window{
  width:min(1480px,calc(100vw - 72px))!important;
  top:clamp(24px,4vh,58px)!important;bottom:clamp(24px,4vh,58px)!important;
  max-height:none!important;
  border:1px solid rgba(153,226,255,.76)!important;
  border-radius:22px!important;
  box-shadow:0 0 0 1px rgba(40,120,200,.26),0 35px 120px rgba(0,0,0,.85),0 0 52px rgba(12,115,205,.19)!important;
  background:linear-gradient(135deg,rgba(8,33,58,.98),rgba(3,13,30,.98) 55%,rgba(9,33,55,.98))!important;
 }
 .window::before{
  content:"";position:absolute;inset:0;pointer-events:none;z-index:0;border-radius:inherit;
  background:linear-gradient(120deg,transparent 12%,rgba(144,219,255,.035) 28%,transparent 46%);
 }
 .header,.tools,.scroll,.selectionBar{position:relative;z-index:1}
 .header{padding:17px 26px!important;background:linear-gradient(95deg,rgba(5,59,104,.9),rgba(11,35,68,.92))!important;border-bottom:1px solid rgba(128,206,255,.34)}
 .brand{font-size:25px!important;letter-spacing:.09em!important;text-shadow:0 0 16px rgba(113,203,255,.45)}
 .tools{padding:16px 26px 12px!important;display:grid!important;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:10px 16px;align-items:center}
 .tools .browse{margin-top:0!important}
 .scroll{padding:18px 26px 36px!important;min-height:0;overflow-y:auto!important}
 .albumPlanetGrid{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:13px!important;align-items:stretch}
 .albumPlanetGrid .albumBrowseRow{
  min-height:176px!important;padding:11px!important;gap:4px!important;
  border-radius:15px!important;border:1px solid rgba(126,196,245,.33)!important;
  background:linear-gradient(145deg,rgba(24,65,105,.58),rgba(7,21,39,.84))!important;
  transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease;
 }
 .albumPlanetGrid .albumBrowseRow:hover{
  transform:translateY(-3px);border-color:rgba(177,231,255,.8)!important;
  box-shadow:0 10px 24px rgba(0,0,0,.4),0 0 15px rgba(51,159,235,.19);
 }
 .albumPlanetGrid .album{min-height:148px!important;gap:9px!important}
 .albumPlanetGrid .albumCover{width:96px!important;height:96px!important;border-radius:50%!important;box-shadow:0 0 0 2px rgba(160,223,255,.5),0 0 21px rgba(51,153,239,.35)!important}
 .albumPlanetGrid .album b{font-size:16px!important;line-height:1.18!important}
 .albumPlanetGrid .album small{font-size:10px!important;letter-spacing:.07em}
 .albumPlanetGrid .albumPickerCompact{max-width:25px!important}
 .albumPlanetGrid .albumPickerCompact input{width:20px!important;height:20px!important}
 .expandedAlbumSongs{padding:18px!important;border-radius:15px!important;box-shadow:inset 0 0 25px rgba(15,90,150,.16)}
 .selectionBar{
  display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:10px 20px!important;
  align-items:center;padding:12px 26px 15px!important;
  background:linear-gradient(95deg,rgba(8,36,63,.98),rgba(7,22,43,.98))!important;
  border-top:1px solid rgba(145,220,255,.48)!important;
 }
 .quickPlaylistRow{grid-column:1 / -1;max-width:none!important}
 .quickPlaylistRow input{font-size:15px!important;min-height:42px!important;padding:9px 14px!important}
 .quickPlaylistRow button{font-size:13px!important;min-height:42px!important;min-width:82px!important}
 .selectionBar .checkedCount{font-size:14px!important;letter-spacing:.06em}
 .selectionBar .selectionActions{display:flex!important;gap:10px!important}
 .selectionActions button{min-height:46px!important;min-width:94px!important;padding:10px 17px!important;font-size:15px!important}
 .selectionActions .playSelected{min-width:145px!important}
}
@media (min-width:1024px) and (max-width:1280px) and (pointer:fine){
 .albumPlanetGrid{grid-template-columns:repeat(5,minmax(0,1fr))!important}
}


@media(min-width:1024px) and (min-height:600px) and (pointer:fine){
 .window .browse{display:none!important}
 .window .tools{display:flex!important;flex-wrap:wrap;gap:8px 14px;align-items:center}
 .window .tools>.search{order:1;flex:1 1 340px;width:auto!important;margin:0!important;min-height:46px}
 .window .tools>.filterRow{order:2;display:flex!important;flex:1 1 460px;align-items:center;margin:0!important;gap:9px}
 .window .tools>.filterRow .songFilter{flex:1 1 180px;min-height:46px}
 .window .tools>.filterRow .songSelectAll{flex:0 0 auto;white-space:nowrap}
 .window .tools>.filterRow .legacyToggle{width:auto!important;min-width:105px;min-height:43px!important;margin:0!important;padding:7px 12px;font-size:12px;border-radius:9px}
 .window .tools>.notice{order:3;flex:1 1 100%}
 .window .gePlaylistBar{display:none!important}
 .window .selectionBar{display:flex!important;flex-wrap:wrap;gap:8px 14px!important}
 .window .selectionBar .quickPlaylistRow{order:-2;flex:1 1 100%;width:100%;margin-bottom:4px}
 .window .selectionBar .checkedCount{flex:1 1 160px}
 .albumPlanetGrid .albumCover{width:116px!important;height:116px!important;border-radius:11px!important;object-fit:cover!important;box-shadow:0 0 0 1px rgba(171,227,255,.5),0 0 20px rgba(51,153,239,.3)!important}
 .albumPlanetGrid .album{min-height:160px!important}
 .albumPlanetGrid .albumBrowseRow{min-height:195px!important}
}
@media(prefers-reduced-motion:no-preference){
.selectionActions .playSelected:not(:disabled){animation-duration:var(--ge-play-flow,3.6s),var(--ge-play-pulse,2.4s)!important}
.selectionActions .playSelected:not(:disabled)::before{animation-duration:var(--ge-play-orbit,3.2s)!important;animation-delay:var(--ge-play-orbit-delay,0s)!important}
.selectionActions .playSelected:not(:disabled)::after{animation-duration:var(--ge-play-sweep,2.8s)!important;animation-delay:var(--ge-play-sweep-delay,0s)!important;opacity:var(--ge-play-opacity,.8)!important}
}

/* Music album cover cards: real full-bleed square jacket art, title at bottom.
   The album checkbox remains independent of the VIEW SONGS button. */
.albumPlanetGrid .albumBrowseRow{
 display:block!important;position:relative!important;aspect-ratio:1/1!important;
 width:100%!important;height:auto!important;min-height:0!important;
 padding:0!important;overflow:hidden!important;border-radius:11px!important;
 border-left:1px solid rgba(171,227,255,.5)!important;
 background:#0b2338!important;
}
.albumPlanetGrid .albumBrowseRow .album{
 display:block!important;position:absolute!important;inset:0!important;
 width:100%!important;height:100%!important;min-height:0!important;
 padding:0!important;margin:0!important;gap:0!important;
 background:transparent!important;border:0!important;border-radius:0!important;
 box-shadow:none!important;overflow:hidden!important;
}
.albumPlanetGrid .albumBrowseRow .albumCover{
 display:block!important;position:absolute!important;inset:0!important;
 width:100%!important;height:100%!important;max-width:none!important;
 max-height:none!important;object-fit:cover!important;border-radius:0!important;
 box-shadow:none!important;filter:none!important;
}
.albumPlanetGrid .albumBrowseRow .albumCover[hidden]{display:none!important}
.albumPlanetGrid .albumBrowseRow .album::before{display:none!important}
.albumPlanetGrid .albumBrowseRow .album b{
 position:absolute!important;z-index:1!important;left:0!important;right:0!important;bottom:0!important;
 display:block!important;min-width:0!important;width:100%!important;
 padding:17px 4px 8px!important;margin:0!important;
 color:white!important;text-align:center!important;font-size:clamp(11px,3vw,17px)!important;
 line-height:1.12!important;font-weight:900!important;letter-spacing:0!important;
 overflow-wrap:anywhere!important;white-space:normal!important;
 text-shadow:0 1px 3px #000,0 1px 6px #000!important;
 background:linear-gradient(0deg,rgba(0,8,18,.96),rgba(0,8,18,.76) 66%,transparent)!important;
}
.albumPlanetGrid .albumBrowseRow .album small{display:none!important}
.albumPlanetGrid .albumBrowseRow .albumPickerCompact{
 position:absolute!important;z-index:4!important;top:7px!important;left:7px!important;
 grid-column:auto!important;grid-row:auto!important;display:flex!important;
 align-items:center!important;justify-content:center!important;
 width:30px!important;height:30px!important;min-width:30px!important;max-width:30px!important;
 min-height:30px!important;max-height:30px!important;margin:0!important;padding:0!important;
 border:1px solid rgba(220,244,255,.9)!important;border-radius:6px!important;
 background:rgba(0,15,29,.82)!important;
}
.albumPlanetGrid .albumBrowseRow .albumPickerCompact input{
 display:block!important;position:static!important;flex:0 0 auto!important;
 width:21px!important;height:21px!important;min-width:21px!important;
 margin:0!important;accent-color:#168fff!important;
}
.song .songInfo{display:flex;align-items:center;gap:9px;flex:1 1 auto;min-width:0}
.song .songTitlePlay{
 display:block!important;flex:1 1 auto!important;min-width:0!important;min-height:36px!important;
 padding:5px 2px!important;margin:0!important;text-align:left!important;
 background:transparent!important;border:0!important;box-shadow:none!important;
 color:#f3faff!important;font:inherit!important;font-weight:750!important;
 white-space:normal!important;overflow-wrap:anywhere!important;cursor:pointer!important;
 touch-action:manipulation!important;
}
.song .songTitlePlay:focus-visible{outline:2px solid #d3f5ff!important;outline-offset:2px}
.song.sortable .songTitlePlay{pointer-events:none!important}
@media(min-width:900px){
 .albumPlanetGrid .albumBrowseRow .album b{font-size:clamp(13px,1.15vw,20px)!important;padding:22px 7px 10px!important}
 .albumPlanetGrid .albumBrowseRow .albumPickerCompact{width:33px!important;height:33px!important;min-width:33px!important;max-width:33px!important}
}


/* Unified phone and small-screen library sizing. Shadow DOM rules are isolated
   from Radio; keep one scroll area, buttons reachable, and the CLOSE visible. */
@media(max-width:820px), (max-height:580px){
 .window{
  box-sizing:border-box!important;left:50%!important;
  top:max(5px,env(safe-area-inset-top))!important;
  bottom:max(5px,env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:calc(100vw - 12px)!important;max-width:100%!important;
  height:auto!important;min-height:0!important;max-height:none!important;
  display:flex!important;flex-direction:column!important;overflow:hidden!important;
 }
 .window.arranging{top:max(3px,env(safe-area-inset-top))!important;bottom:max(3px,env(safe-area-inset-bottom))!important}
 .header,.tools{min-width:0!important;flex:0 0 auto!important}
 .header .brand{min-width:0!important;overflow-wrap:anywhere!important}
 .header .close{flex:0 0 auto!important;min-height:44px!important}
 .scroll{
  flex:1 1 0!important;height:0!important;min-height:0!important;min-width:0!important;
  overflow-x:hidden!important;overflow-y:auto!important;
  -webkit-overflow-scrolling:touch;overscroll-behavior:contain;
 }
 .browse{grid-template-columns:repeat(2,minmax(0,1fr))!important;min-width:0!important}
 .browse button{min-width:0!important;min-height:44px!important;white-space:normal!important;overflow-wrap:anywhere!important}
 .filterRow,.musicCodeTools{min-width:0!important;flex-wrap:wrap!important}
 .filterRow select,.filterRow input,.musicCodeTools input{max-width:100%!important;min-width:0!important}
 .song,.songActions,.albumBrowseRow,.selectionBar{min-width:0!important;max-width:100%!important}
 .song .songInfo,.song .songTitlePlay{min-width:0!important;overflow-wrap:anywhere!important}
}
@media(max-height:520px) and (orientation:landscape){
 .header{padding:4px 8px!important}
 .tools{padding:4px 8px!important}
 .scroll{padding:6px 8px 18px!important}
 .window{border-radius:9px!important}
}
@media(max-width:360px){
 .header{gap:4px!important;padding:6px!important}
 .header .brand{font-size:12px!important}
 .header .close{min-width:60px!important;padding:6px!important}
 .tools{padding:6px!important}
 .filterRow{gap:4px!important}
 .scroll{padding:8px 6px 24px!important}
}

/* GE vertical album library: authentic jacket art, near-connected rows. */
.browse{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important}
.browse button{min-width:0!important;font-size:clamp(10px,3vw,15px)!important;padding:7px 2px!important}
.albumPlanetGrid{display:flex!important;flex-direction:column!important;gap:3px!important;padding:2px 0 12px!important}
.albumPlanetGrid .albumBrowseRow{display:grid!important;position:relative!important;grid-template-columns:minmax(0,48%) minmax(0,1fr)!important;grid-template-rows:1fr auto!important;gap:4px 9px!important;aspect-ratio:auto!important;height:auto!important;min-height:0!important;width:100%!important;padding:4px!important;border:1px solid #28a9f5!important;border-radius:10px!important;overflow:visible!important;background:linear-gradient(110deg,#0a2a4c,#061322)!important}
.albumPlanetGrid .albumBrowseRow .album{display:block!important;position:relative!important;grid-column:1!important;grid-row:1 / span 2!important;inset:auto!important;width:100%!important;height:auto!important;aspect-ratio:1!important;min-height:0!important;padding:0!important;overflow:hidden!important}
.albumPlanetGrid .albumBrowseRow .albumCover{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;border-radius:6px!important}
.albumPlanetGrid .albumBrowseRow .album b,.albumPlanetGrid .albumBrowseRow .album small{display:none!important}
.albumPlanetGrid .albumBrowseRow .albumPickerCompact{z-index:5!important;top:9px!important;left:9px!important}
.albumPlanetGrid .albumDescription{grid-column:2;grid-row:1;display:flex;flex-direction:column;justify-content:center;gap:4px;min-width:0;padding:4px 2px 0}
.albumPlanetGrid .albumDescription strong{font-size:clamp(16px,4.4vw,23px);line-height:1.1;overflow-wrap:anywhere}
.albumPlanetGrid .albumDescription small{font-size:clamp(10px,2.9vw,13px);color:#9edbff}
.albumPlanetGrid .albumDescription p{font-size:clamp(11px,3vw,14px);line-height:1.25;margin:2px 0;color:#e4f4ff}
.albumPlanetGrid .albumRowActions{grid-column:2;grid-row:2;display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:0 2px 4px}
.albumPlanetGrid .albumRowActions button{flex:1 1 auto;min-height:34px!important;padding:5px!important;font-size:clamp(10px,2.7vw,12px)!important;border:1px solid #72ceff!important;border-radius:7px!important;color:#fff!important;background:#104a78!important}
.albumPlanetGrid .albumRowActions .album{position:static!important;inset:auto!important;display:block!important;width:auto!important;height:auto!important;aspect-ratio:auto!important;min-height:34px!important;overflow:visible!important}
.albumPlanetGrid .albumRowActions .album small{display:block!important;position:static!important;font-size:11px!important;color:#fff!important}
.albumPlanetGrid .albumRowActions .album b{display:none!important}
@media(min-width:700px){.albumPlanetGrid .albumBrowseRow{grid-template-columns:minmax(160px,260px) minmax(0,1fr)!important}.albumPlanetGrid .albumDescription strong{font-size:25px}}

/* GE MUSIC mobile card safety: artwork must never overlap album details.
   Overrides legacy grid rules without touching audio, playlist, or access logic. */
@media(max-width:699px){
 .albumPlanetGrid .albumBrowseRow{
  display:grid!important;
  position:relative!important;
  grid-template-columns:minmax(0,1fr)!important;
  grid-template-rows:auto auto auto!important;
  align-items:stretch!important;
  gap:0!important;
  overflow:hidden!important;
  min-height:0!important;
 }
 .albumPlanetGrid .albumBrowseRow > button.album{
  position:relative!important;
  grid-column:1!important;
  grid-row:1!important;
  display:block!important;
  width:100%!important;
  height:auto!important;
  max-height:none!important;
  aspect-ratio:16/9!important;
  overflow:hidden!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
  border-radius:0!important;
 }
 .albumPlanetGrid .albumBrowseRow > button.album .albumCover{
  position:absolute!important;
  inset:0!important;
  display:block!important;
  width:100%!important;
  height:100%!important;
  max-width:100%!important;
  object-fit:contain!important;
  border-radius:0!important;
 }
 .albumPlanetGrid .albumBrowseRow > .albumDescription{
  position:relative!important;
  grid-column:1!important;
  grid-row:2!important;
  display:flex!important;
  padding:10px 13px 5px!important;
  min-width:0!important;
  z-index:1!important;
 }
 .albumPlanetGrid .albumBrowseRow > .albumRowActions{
  position:relative!important;
  grid-column:1!important;
  grid-row:3!important;
  padding:5px 13px 12px!important;
  min-width:0!important;
  z-index:1!important;
 }
 .albumPlanetGrid .albumBrowseRow > .albumPickerCompact{
  position:absolute!important;
  top:12px!important;
  left:12px!important;
  z-index:8!important;
 }
}

/* Mobile album jackets: full square artwork, connected vertically, no crop. */
@media(max-width:699px){
 .albumPlanetGrid{gap:2px!important}
 .albumPlanetGrid .albumBrowseRow{
  display:grid!important;grid-template-columns:minmax(0,1fr)!important;
  grid-template-rows:auto auto auto!important;gap:0!important;
  padding:0!important;overflow:hidden!important;border-radius:8px!important;
 }
 .albumPlanetGrid .albumBrowseRow > .album{
  display:block!important;grid-column:1!important;grid-row:1!important;
  width:100%!important;height:auto!important;aspect-ratio:1/1!important;
  min-height:0!important;max-height:none!important;margin:0!important;
  padding:0!important;border:0!important;border-radius:0!important;
 }
 .albumPlanetGrid .albumBrowseRow .albumCover{
  display:block!important;position:absolute!important;inset:0!important;
  width:100%!important;height:100%!important;object-fit:contain!important;
  border-radius:0!important;
 }
 .albumPlanetGrid .albumBrowseRow .albumPickerCompact{
  position:absolute!important;top:12px!important;left:12px!important;z-index:6!important;
 }
 .albumPlanetGrid .albumDescription{
  grid-column:1!important;grid-row:2!important;padding:7px 12px 3px!important;
 }
 .albumPlanetGrid .albumRowActions{
  grid-column:1!important;grid-row:3!important;padding:3px 12px 9px!important;
 }
}
.selectionActions .offlineSelected{background:linear-gradient(135deg,#123e3c,#145e57)!important;border-color:#68c9b6!important;color:#e0fff6!important;font-weight:850!important}

/* Album browser: centered edge-to-edge within the MUSIC content window.
   Preserve the album checkbox, title, details, and PLAY ALBUM controls. */
.window .albumPlanetGrid{
 box-sizing:border-box!important;
 display:flex!important;
 flex-direction:column!important;
 align-items:stretch!important;
 justify-content:flex-start!important;
 width:100%!important;
 max-width:none!important;
 min-width:0!important;
 margin-left:auto!important;
 margin-right:auto!important;
 padding-left:0!important;
 padding-right:0!important;
}
.window .albumPlanetGrid > .albumBrowseRow{
 box-sizing:border-box!important;
 width:100%!important;
 max-width:100%!important;
 min-width:0!important;
 margin:0 auto!important;
 justify-self:stretch!important;
}
@media(max-width:699px){
 .window .albumPlanetGrid > .albumBrowseRow{grid-template-columns:minmax(0,1fr)!important}
 .window .albumPlanetGrid > .albumBrowseRow > button.album{
  box-sizing:border-box!important;
  display:block!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  height:auto!important;
  aspect-ratio:1 / 1!important;
  margin:0 auto!important;
  overflow:hidden!important;
 }
 .window .albumPlanetGrid > .albumBrowseRow > button.album > img.albumCover{
  position:absolute!important;inset:0!important;
  display:block!important;width:100%!important;height:100%!important;
  max-width:none!important;max-height:none!important;
  object-fit:contain!important;object-position:center!important;
 }
 .window:not(.arranging) .scroll{padding-left:5px!important;padding-right:5px!important}
}

/* Canonical album universe: one selected cover, title and story, surrounding catalog. */
.scroll.geAlbumUniverse{
 background:#020817 url('../ge-images/images/stars%20backgrounds/1.jpeg') center center/cover fixed!important;
 background-attachment:local!important;
}
.geAlbumUniverse .albumPlanetGrid{
 display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;
 gap:14px!important;padding:18px 12px 36px!important;align-items:start!important;
}
.geAlbumUniverse .albumPlanetGrid > .albumBrowseRow{
 order:3!important;grid-column:auto!important;grid-row:auto!important;
 display:block!important;position:relative!important;aspect-ratio:1!important;
 min-width:0!important;min-height:0!important;padding:0!important;margin:0!important;
 border:1px solid rgba(167,218,255,.65)!important;border-radius:12px!important;
 overflow:hidden!important;background:#061523!important;
 box-shadow:0 0 16px rgba(85,186,255,.3)!important;
 transition:box-shadow .35s ease,border-color .35s ease!important;
}
.geAlbumUniverse .albumPlanetGrid > .albumBrowseRow > .album{
 display:flex!important;grid-area:auto!important;position:absolute!important;inset:0!important;
 width:100%!important;height:100%!important;min-height:0!important;
 margin:0!important;padding:0!important;border:0!important;
 border-radius:10px!important;overflow:hidden!important;
 align-items:center!important;justify-content:center!important;
 background:transparent!important;
}
.geAlbumUniverse .albumPlanetGrid .albumBrowseRow .albumCover{
 display:block!important;position:absolute!important;inset:0!important;
 width:100%!important;height:100%!important;max-width:none!important;
 max-height:none!important;object-fit:contain!important;border-radius:8px!important;
}
.geAlbumUniverse .albumPlanetGrid .albumBrowseRow .album b,
.geAlbumUniverse .albumPlanetGrid .albumBrowseRow .countHint,
.geAlbumUniverse .albumPlanetGrid .albumBrowseRow .albumDescription,
.geAlbumUniverse .albumPlanetGrid .albumBrowseRow .albumRowActions{display:none!important}
.geAlbumUniverse .albumPlanetGrid .albumBrowseRow .albumPickerCompact{
 position:absolute!important;top:4px!important;left:4px!important;z-index:3!important;
 width:26px!important;height:26px!important;padding:0!important;
 background:rgba(0,10,24,.75)!important;border-radius:6px!important;
}
.geAlbumUniverse .albumPlanetGrid > .albumBrowseRow.geAlbumFocused{
 order:0!important;grid-column:1/-1!important;
 width:min(76vw,390px)!important;max-width:100%!important;
 justify-self:center!important;margin:8px auto 0!important;
 border:2px solid #d4f1ff!important;border-radius:14px!important;
 box-shadow:0 0 45px rgba(95,187,255,.65)!important;
}
.geAlbumUniverse .geAlbumFeature{
 order:1!important;grid-column:1/-1!important;display:grid!important;
 grid-template-columns:1fr!important;gap:10px!important;
 padding:8px 14px 24px!important;margin:0 auto 8px!important;
 width:min(100%,680px)!important;box-sizing:border-box!important;
 text-align:center!important;background:rgba(1,9,25,.68)!important;
 border-radius:14px!important;backdrop-filter:blur(6px)!important;
 animation:geAlbumFade .65s ease .12s both!important;
}
.geAlbumUniverse .geAlbumFeature h2{
 font-size:clamp(25px,6vw,38px)!important;line-height:1.1!important;
 margin:0 0 5px!important;color:#fff!important;
}
.geAlbumUniverse .geAlbumFeature small{color:#b7dfff!important}
.geAlbumUniverse .geAlbumFeature p{
 font-size:clamp(14px,3.5vw,18px)!important;line-height:1.5!important;
 margin:0 0 12px!important;color:#e7f4ff!important;
}
.geAlbumUniverse .geAlbumFeature button{font-size:13px!important;min-height:38px!important;margin:3px!important}
@keyframes geAlbumFade{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
@media(min-width:850px){
 .geAlbumUniverse .albumPlanetGrid{grid-template-columns:repeat(5,minmax(0,1fr))!important}
 .geAlbumUniverse .geAlbumFeature{
  grid-template-columns:minmax(0,1fr) minmax(0,1.4fr)!important;
  text-align:left!important;align-items:center!important;
 }
}
@media(prefers-reduced-motion:reduce){.geAlbumUniverse *{animation:none!important;transition:none!important}}

/* Albums universe: subdued Soul-style circular BACK button, soft glow.
   Keep the album canvas unobstructed; other MUSIC views retain controls. */
@media(max-width:820px){
 .window:has(.browse [data-tab="albums"][aria-pressed="true"]) .header{
   position:absolute!important;z-index:12!important;top:7px!important;left:8px!important;
   width:auto!important;min-height:0!important;padding:0!important;background:transparent!important;
   border:0!important;pointer-events:none!important;
 }
 .window:has(.browse [data-tab="albums"][aria-pressed="true"]) .header .brand,
 .window:has(.browse [data-tab="albums"][aria-pressed="true"]) .header .accessToggle,
 .window:has(.browse [data-tab="albums"][aria-pressed="true"]) .header .geCodeIdentity{display:none!important}
 .window:has(.browse [data-tab="albums"][aria-pressed="true"]) .header .geHeaderActions{pointer-events:none!important}
 .window:has(.browse [data-tab="albums"][aria-pressed="true"]) .header .close{
   display:flex!important;pointer-events:auto!important;width:56px!important;height:56px!important;
   min-width:56px!important;min-height:56px!important;padding:0!important;
   border:1px solid rgba(216,235,247,.42)!important;border-radius:50%!important;
   color:rgba(235,246,255,.86)!important;background:rgba(179,200,216,.12)!important;
   font-size:11px!important;font-weight:800!important;letter-spacing:.04em!important;
   box-shadow:0 0 15px 4px rgba(198,224,248,.16),inset 0 0 13px rgba(218,239,255,.09)!important;
   backdrop-filter:blur(7px)!important;-webkit-backdrop-filter:blur(7px)!important;
 }
 .window:has(.browse [data-tab="albums"][aria-pressed="true"]) .tools,
 .window:has(.browse [data-tab="albums"][aria-pressed="true"]) .selectionBar{display:none!important}
 .window:has(.browse [data-tab="albums"][aria-pressed="true"]) .scroll{
   padding:68px 8px 16px!important;flex:1 1 auto!important;height:auto!important;
   background:#020817 url('../ge-images/images/stars%20backgrounds/1.jpeg') center center/cover no-repeat!important;
 }
}
/* GE MUSIC phone compact open layout, 2026-11-13.
   One fixed footer row; playlist editing remains in PLAYLISTS.
   No change to selection, access, payment or playback handlers. */
@media(max-width:820px){
 .window{border:0!important;border-radius:0!important;box-shadow:none!important;width:100vw!important;top:env(safe-area-inset-top)!important;bottom:env(safe-area-inset-bottom)!important;background:#020817!important}
 .header{padding:6px 10px!important;min-height:44px!important;background:rgba(2,17,36,.86)!important;border:0!important}
 .header .brand{font-size:19px!important;letter-spacing:.02em!important}
 .header button{min-height:38px!important;padding:5px 9px!important;font-size:12px!important;border-radius:7px!important}
 .tools{padding:4px 8px 5px!important;background:rgba(2,17,36,.84)!important;border:0!important}
 .browse{margin:0!important;gap:3px!important}
 .browse button{min-height:36px!important;padding:5px 3px!important;font-size:12px!important;border:0!important;border-radius:5px!important;background:rgba(15,51,81,.64)!important}
 .browse button[aria-pressed=true]{background:rgba(21,117,189,.85)!important;box-shadow:none!important}
 .search{margin-top:5px!important;min-height:36px!important;padding:5px 9px!important;background:rgba(0,9,24,.62)!important;border:1px solid rgba(117,179,222,.26)!important;border-radius:5px!important}
 .filterRow{margin-top:4px!important;gap:4px!important}
 .filterRow select,.filterRow .songSelectAll,.filterRow .reloadCatalogBtn{min-height:35px!important;border:0!important;border-radius:5px!important;background:rgba(17,52,81,.7)!important;font-size:11px!important}
 .filterRow .songSelectAll{padding:4px 6px!important}
 .filterRow .reloadCatalogBtn{width:36px!important;flex-basis:36px!important;font-size:19px!important}
 .tools .notice{margin:2px 0 0!important;min-height:0!important;font-size:10px!important;line-height:1.2!important;opacity:.7}
 .scroll,.scroll.geAlbumUniverse{background:#020817 url('../ge-images/images/stars%20backgrounds/1.jpeg') center center/cover no-repeat!important;background-attachment:local!important}
 .scroll{padding:3px 7px 10px!important}
 .scroll .section{font-size:14px!important;padding:4px 5px!important;margin:5px 0 2px!important;background:rgba(5,25,47,.45)!important;border:0!important}
 .scroll .albumPicker,.scroll .albumCollectionHeading{padding:3px 5px!important;margin:3px 0!important;min-height:0!important;background:rgba(7,30,51,.35)!important;border:0!important;border-radius:0!important}
 .scroll .albumPicker b,.scroll .albumPicker strong,.scroll .albumCollectionHeading b{font-size:clamp(14px,4vw,18px)!important;line-height:1.2!important}
 .scroll .albumBrowseRow:not(.geAlbumFocused){border-color:rgba(155,209,240,.2)!important;box-shadow:none!important}
 .scroll .song{min-height:37px!important;padding:2px 5px!important;margin:0!important;background:rgba(6,23,43,.45)!important;border:0!important;border-bottom:1px solid rgba(150,198,225,.14)!important;border-radius:0!important}
 .scroll .song .songTitlePlay{min-height:35px!important;font-size:13px!important;padding:3px 2px!important}
 .scroll .song button:not(.songTitlePlay){min-height:33px!important;padding:3px 8px!important;font-size:11px!important;border:1px solid rgba(105,188,239,.5)!important;border-radius:5px!important}
 .selectionBar{display:grid!important;grid-template-columns:1fr!important;gap:0!important;min-height:0!important;padding:4px 6px max(5px,env(safe-area-inset-bottom))!important;background:rgba(2,15,32,.94)!important;border-top:1px solid rgba(132,200,245,.25)!important}
 .selectionBar .quickPlaylistRow{display:none!important}
 .selectionBar .checkedCount{display:none!important}
 .selectionBar .selectionActions{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;width:100%!important;gap:4px!important;align-items:stretch!important}
 .selectionBar .selectionActions button:not(.arrangeBtn){min-width:0!important;min-height:42px!important;max-height:46px!important;padding:5px 2px!important;font-size:clamp(10px,2.8vw,12px)!important;border-radius:6px!important;letter-spacing:0!important}
 .selectionBar .selectionActions .playSelected{min-width:0!important}
 .selectionBar .selectionActions .arrangeBtn{display:none!important}
 .window:has(.browse [data-tab="playlists"][aria-pressed="true"]) .selectionBar .quickPlaylistRow{display:flex!important;width:100%!important;gap:4px!important;margin:0 0 4px!important}
 .window:has(.browse [data-tab="playlists"][aria-pressed="true"]) .selectionBar .quickPlaylistRow input{min-width:0!important;min-height:35px!important;font-size:12px!important;padding:4px 6px!important}
 .window:has(.browse [data-tab="playlists"][aria-pressed="true"]) .selectionBar .quickPlaylistRow button{min-width:43px!important;min-height:35px!important;font-size:10px!important;padding:3px 4px!important}
 .window:has(.browse [data-tab="playlists"][aria-pressed="true"]) .selectionBar .checkedCount{display:block!important;font-size:10px!important;padding:0 2px 3px!important}
}
/* Authoritative phone album universe: no chrome, only small planets and BACK. */
@media(max-width:820px){
 .window.geAlbumsUniverseOnly{background:#020817 url('../ge-images/images/stars%20backgrounds/1.jpeg') center center/cover!important;border:0!important;border-radius:0!important}
 .window.geAlbumsUniverseOnly > .header{position:absolute!important;top:10px!important;left:10px!important;right:auto!important;z-index:50!important;display:block!important;width:58px!important;height:58px!important;min-height:0!important;padding:0!important;background:transparent!important;border:0!important;pointer-events:none!important}
 .window.geAlbumsUniverseOnly > .header .brand,.window.geAlbumsUniverseOnly > .header .accessToggle,.window.geAlbumsUniverseOnly > .header .geCodeIdentity{display:none!important}
 .window.geAlbumsUniverseOnly > .header .geHeaderActions{display:block!important;pointer-events:none!important}
 .window.geAlbumsUniverseOnly > .header .close{pointer-events:auto!important;display:flex!important;width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important;padding:0!important;align-items:center!important;justify-content:center!important;border-radius:50%!important;background:rgba(175,190,202,.16)!important;border:1px solid rgba(228,239,247,.4)!important;color:#e3edf5!important;font-size:11px!important;box-shadow:0 0 18px 5px rgba(200,227,250,.2),inset 0 0 9px rgba(222,238,255,.1)!important}
 .window.geAlbumsUniverseOnly > .tools,.window.geAlbumsUniverseOnly > .selectionBar{display:none!important}
 .window.geAlbumsUniverseOnly > .scroll{flex:1 1 0!important;height:0!important;min-height:0!important;padding:82px 14px 24px!important;overflow-y:auto!important;background:transparent!important}
 .window.geAlbumsUniverseOnly .albumPlanetGrid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:26px 17px!important;padding:10px 0 35px!important;width:100%!important;align-items:center!important;justify-items:center!important}
 .window.geAlbumsUniverseOnly .albumPlanetGrid > .albumBrowseRow,.window.geAlbumsUniverseOnly .albumPlanetGrid > .albumBrowseRow.geAlbumFocused{display:block!important;grid-column:auto!important;grid-row:auto!important;order:initial!important;width:100%!important;max-width:118px!important;min-height:0!important;height:auto!important;aspect-ratio:1!important;margin:0!important;padding:0!important;border-radius:50%!important;border:1px solid rgba(214,231,249,.24)!important;box-shadow:0 0 13px rgba(195,218,248,.14)!important;overflow:hidden!important;background:rgba(6,19,37,.52)!important}
 .window.geAlbumsUniverseOnly .albumPlanetGrid > .albumBrowseRow .album{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;padding:0!important;margin:0!important;border-radius:50%!important;overflow:hidden!important}
 .window.geAlbumsUniverseOnly .albumPlanetGrid > .albumBrowseRow .albumCover{display:block!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;border-radius:50%!important}
 .window.geAlbumsUniverseOnly .albumPlanetGrid > .albumBrowseRow .album b{display:block!important;position:absolute!important;bottom:0!important;left:0!important;right:0!important;padding:14px 3px 7px!important;background:linear-gradient(transparent,rgba(0,7,20,.84))!important;color:white!important;font-size:clamp(10px,2.9vw,13px)!important;text-align:center!important}
 .window.geAlbumsUniverseOnly .albumPlanetGrid > .albumBrowseRow .albumPickerCompact{position:absolute!important;top:4px!important;left:4px!important;width:24px!important;height:24px!important;min-width:24px!important;min-height:24px!important;padding:0!important;border-radius:50%!important}
 .window.geAlbumsUniverseOnly .albumPlanetGrid > .albumBrowseRow .albumPickerCompact input{width:17px!important;height:17px!important;min-width:17px!important}
 .window.geAlbumsUniverseOnly .albumPlanetGrid > .albumBrowseRow .albumDescription,.window.geAlbumsUniverseOnly .albumPlanetGrid > .albumBrowseRow .albumRowActions,.window.geAlbumsUniverseOnly .albumPlanetGrid > .geAlbumFeature{display:none!important}
 .window.geAlbumsUniverseOnly .albumPlanetGrid > .expandedAlbumSongs{grid-column:1/-1!important;width:100%!important}
}
</style>
<div class="backdrop"></div>
<section class="window" role="dialog" aria-modal="true" aria-label="Grand Element music library">
 <div class="header"><div class="brand" aria-label="Grand Element Music">MUSIC</div><div class="geHeaderActions"><span class="geCodeIdentity" role="status" aria-live="polite" hidden></span><button type="button" class="accessToggle" aria-expanded="false">ACCESS CODE</button><button class="close" type="button">CLOSE</button></div></div>
 <div class="tools"><div class="musicCodeTools" hidden><label for="geMusicV5Code">ACCESS CODE</label><input id="geMusicV5Code" class="musicCodeInput" type="password" autocomplete="off" spellcheck="false" placeholder="Enter code" aria-label="GE Music access code"><button class="musicCodeUnlock" type="button">UNLOCK</button><button class="musicCodeClear" type="button" title="Clear active code" aria-label="Clear active Music code" hidden>×</button></div><div class="musicCodeState" role="status" aria-live="polite" hidden></div><nav class="browse" aria-label="Music workspaces"><button type="button" data-tab="albums" aria-pressed="true">ALBUMS</button><button type="button" data-tab="songs" aria-pressed="false">SONGS</button><button type="button" data-tab="playlists" aria-pressed="false">PLAYLISTS</button></nav><input class="search" type="search" placeholder="Find a song, album, or playlist" aria-label="Search music or playlists">
 <div class="playlistActionsBar" aria-label="Playlist saving controls"><button data-action="clear" type="button">CLEAR</button><button data-action="save" type="button">SAVE PLAYLIST</button></div><div class="filterRow"><select class="songFilter" aria-label="Filter songs"><option value="all">ALL SONGS</option><option value="checked">CHECKED SONGS</option><option value="albums">BROWSE ALBUMS</option></select><label class="songSelectAll"><input class="selectAllSongs" type="checkbox" aria-label="Select all available songs">SELECT ALL</label><button type="button" class="reloadCatalogBtn" title="Reload music library from published files" aria-label="Reload music library">⟳</button><select class="playlistFilter" aria-label="Filter playlists" hidden><option value="user-playlists">USER PLAYLISTS</option><option value="ge-playlists">GE PLAYLISTS</option><option value="playlist-order">CHECKED SONGS · ARRANGE</option></select></div><div class="notice" role="status" aria-live="polite"></div></div>
 <div class="arrangeDock" aria-label="Arrange playlist workspace">
   <div class="arrangeTitle"><strong class="arrangeCount">ARRANGE · 0 SONGS</strong><span class="arrangeTitleActions"><button type="button" class="arrangeEdit" aria-pressed="false" aria-label="Edit playlist songs">EDIT</button><button type="button" class="arrangeDone" aria-label="Play this playlist in the Music player">PLAY</button></span></div>
   <div class="arrangeCurrent"><label for="geArrangeCurrentName">CURRENT PLAYLIST</label><input id="geArrangeCurrentName" class="arrangeCurrentName" type="text" maxlength="100" autocomplete="off" spellcheck="false" placeholder="Name this playlist" aria-label="Current playlist name, editable before saving"><small class="arrangeSource" role="status">NEW PLAYLIST · THIS DEVICE</small></div>
    <div class="arrangeLoad"><select class="arrangePlaylistSelect" aria-label="Load an existing playlist to arrange"><option value="">LOAD A SAVED PLAYLIST…</option></select><button type="button" class="arrangeLoadBtn">LOAD</button></div>
   <div class="arrangeCommands"><button type="button" class="arrangeSave">SAVE PLAYLIST</button><button type="button" class="arrangePlay">PLAY</button><button type="button" class="arrangeBuy buyBtn">BUY SELECTED</button></div>
    <div class="arrangeOwnerAuth" hidden><label for="geArrangeOwnerPassword">BACK ROOM OWNER PASSWORD · SHARED SAVE</label><input class="arrangeOwnerPassword" id="geArrangeOwnerPassword" type="password" autocomplete="current-password" placeholder="Owner password"><button type="button" class="arrangeOwnerLogin">SIGN IN &amp; SAVE</button><button type="button" class="arrangeOwnerCancel">CANCEL</button></div>
   <div class="arrangeHint">Hold a song to drag, or use ↑ ↓. Save your order when finished.</div><div class="arrangeNotice" role="status" aria-live="polite"></div>
 </div>
 <div class="scroll" role="region" aria-label="Scrollable Grand Element music collection" tabindex="0"></div>
 <div class="gePlaylistPicker" hidden><section class="gePlaylistDialog" role="dialog" aria-modal="true" aria-label="Load a saved playlist"><div class="gePlaylistDialogHead"><strong>LOAD PLAYLIST</strong><button type="button" class="gePlaylistPickerClose" aria-label="Close playlist list">CLOSE</button></div><div class="gePlaylistTabs"><button type="button" class="gePlaylistTabGE" aria-pressed="true">GE PLAYLISTS</button><button type="button" class="gePlaylistTabUser" aria-pressed="false">USER PLAYLISTS</button></div><div class="gePlaylistItems" role="group" aria-label="Saved playlists"></div><button class="gePlaylistConfirm" type="button" disabled>LOAD SELECTED</button><div class="gePlaylistPickerStatus" role="status" aria-live="polite"></div></section></div>
 <div class="selectionBar" aria-label="Checked song controls"><div class="quickPlaylistRow"><input class="quickPlaylistName" type="text" maxlength="100" autocomplete="off" placeholder="Name your playlist" aria-label="Playlist name"><button class="quickPlaylistDelete" type="button" aria-label="Delete current user playlist" disabled>DELETE</button><button class="quickPlaylistLoad" type="button">LOAD</button><button class="quickPlaylistSave" type="button">SAVE</button></div><strong class="checkedCount" aria-live="polite">CHECKED SONGS · 0</strong><div class="selectionActions"><button type="button" class="offlineSelected" aria-label="Download checked songs for offline listening">OFFLINE</button><button type="button" class="arrangeBtn" aria-pressed="false" hidden>ARRANGE</button><button type="button" class="buySelected buyBtn" disabled aria-label="Buy checked songs">BUY</button><button type="button" class="playSelected" disabled aria-label="Play checked songs">▶ PLAY</button></div></div>

</section>`;
document.body.appendChild(host);
function randomizePlayGlow(){
 if(!state.open||document.hidden||window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
 const b=root.querySelector('.playSelected');if(!b)return;
 const rnd=(lo,hi)=>(lo+Math.random()*(hi-lo)).toFixed(2);
 for(const [k,v] of Object.entries({
 '--ge-play-flow':rnd(3.2,6.9)+'s','--ge-play-pulse':rnd(1.9,4.8)+'s',
 '--ge-play-orbit':rnd(2.8,7.1)+'s','--ge-play-sweep':rnd(3.0,8.5)+'s',
 '--ge-play-orbit-delay':'-'+rnd(0,4)+'s','--ge-play-sweep-delay':'-'+rnd(0,5)+'s',
 '--ge-play-opacity':rnd(.4,.95)
 }))b.style.setProperty(k,v);
}
setInterval(randomizePlayGlow,5700);

const el=sel=>root.querySelector(sel),scroller=el('.scroll'),notice=el('.notice');
/* Separate Albums Universe screen. Not a hidden/modified MUSIC management page. */
const universe=document.createElement('section');
universe.className='geStandaloneAlbumUniverse';
universe.setAttribute('role','dialog');
universe.setAttribute('aria-label','Grand Element album universe');
universe.innerHTML='<button type="button" class="geUniverseBack" aria-label="Back to radio">BACK</button><div class="geUniverseLight" aria-hidden="true"></div><div class="geUniverseAlbums" aria-label="Albums"></div>';
el('.window').after(universe);
const universeStyle=document.createElement('style');
universeStyle.textContent=`
.geStandaloneAlbumUniverse{display:none;position:absolute;inset:0;z-index:20;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:#010510 url('../ge-images/images/stars%20backgrounds/1.jpeg') center center/cover no-repeat;color:white;isolation:isolate}
.geStandaloneAlbumUniverse.isActive{display:block}
.geUniverseBack{position:sticky;top:calc(12px + env(safe-area-inset-top));left:14px;z-index:5;display:flex;align-items:center;justify-content:center;width:55px;height:55px;border-radius:50%;border:1px solid rgba(222,235,246,.38);background:rgba(180,197,213,.13);color:rgba(242,248,255,.86);font:800 11px system-ui;letter-spacing:.04em;box-shadow:0 0 19px 5px rgba(199,226,248,.17),inset 0 0 11px rgba(230,241,255,.1);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.geUniverseLight{position:absolute;pointer-events:none;top:48%;left:50%;width:min(66vw,350px);height:min(66vw,350px);transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95) 0%,rgba(237,246,255,.8) 2%,rgba(174,212,248,.38) 8%,rgba(145,197,241,.12) 26%,transparent 70%);filter:blur(5px);opacity:.85}
.geUniverseAlbums{position:relative;z-index:2;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-content:center;align-items:center;justify-items:center;gap:clamp(30px,7vh,76px) 14px;min-height:calc(100% - 68px);padding:30px 16px max(75px,env(safe-area-inset-bottom))}
.geUniverseAlbum{position:relative;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;width:min(27vw,112px);height:min(27vw,112px);min-width:0;padding:0;overflow:hidden;border-radius:50%;border:1px solid rgba(214,235,249,.35);background:radial-gradient(circle at 35% 28%,rgba(81,137,186,.52),rgba(1,9,24,.96));box-shadow:0 0 14px rgba(176,215,251,.19);color:#fff;cursor:pointer}
.geUniverseAlbum img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%}
.geUniverseAlbum span{position:relative;z-index:1;max-width:95%;padding:4px 6px;border-radius:10px;background:rgba(0,7,20,.7);font:800 clamp(10px,2.7vw,13px)/1.15 system-ui;text-align:center;text-shadow:0 1px 3px #000;overflow-wrap:anywhere}
.geUniverseAlbum:focus-visible,.geUniverseBack:focus-visible{outline:2px solid white;outline-offset:4px}
.geUniverseAlbum:nth-child(3n+2){transform:translateY(12px)}
.geUniverseAlbum:nth-child(3n+3){transform:translateY(-12px)}
@media(min-width:821px){.geUniverseAlbums{grid-template-columns:repeat(4,minmax(0,1fr));max-width:900px;margin:auto}.geUniverseAlbum{width:130px;height:130px}}
@media(prefers-reduced-motion:reduce){.geStandaloneAlbumUniverse *{animation:none!important;transition:none!important}}
`;
root.appendChild(universeStyle);
universe.querySelector('.geUniverseBack').addEventListener('click',()=>close());
universe.addEventListener('touchstart',event=>event.stopPropagation(),{passive:true});
universe.addEventListener('touchmove',event=>event.stopPropagation(),{passive:true});
function renderStandaloneAlbums(){
 const board=universe.querySelector('.geUniverseAlbums');
 board.replaceChildren();
 if(!state.loaded){const loading=document.createElement('p');loading.textContent='Loading albums…';board.append(loading);return;}
 const access=musicAccessActive();
 const allowed=access?.restricted?new Set(access.allowed):null;
 const names=[...new Set(state.tracks.filter(t=>!allowed||allowed.has(t.path)).map(t=>t.album))]
  .filter(name=>!LEGACY_ALBUMS.has(name)&&name!=='Singles')
  .sort((a,b)=>rank(a)-rank(b));
 for(const name of names){
  const item=document.createElement('button');item.type='button';item.className='geUniverseAlbum';
  item.setAttribute('aria-label','Open '+name+' album');
  const image=document.createElement('img');
  image.src=new URL('../ge-images/images/Grand Element - '+encodeURIComponent(name)+'.jpg',location.href).href;
  image.alt='';image.loading='lazy';image.onerror=()=>image.remove();
  const title=document.createElement('span');title.textContent=name;
  item.append(image,title);
  item.addEventListener('click',()=>setView('album:'+name));
  board.append(item);
 }
 if(!names.length){const empty=document.createElement('p');empty.textContent='No albums available';board.append(empty);}
}

const playlistBar=document.createElement('div');playlistBar.className='gePlaylistBar';
const savedSelector=el('.arrangePlaylistSelect'),nameField=el('.arrangeCurrentName');
const loadButton=el('.arrangeLoadBtn'),saveButton=el('.arrangeSave');
savedSelector.setAttribute('aria-label','Choose saved playlist');
nameField.placeholder='Playlist name';saveButton.textContent='SAVE';
// Keep the old select in the hidden arrange dock as a compatibility input,
 // but present the saved records only in LOAD's two-category dialog.
savedSelector.closest('.arrangeLoad').insertBefore(savedSelector,loadButton);
playlistBar.append(nameField,loadButton,saveButton);
el('.tools').insertBefore(playlistBar,el('.notice'));
// Keep native iOS scrolling within this Shadow DOM. The old Radio document
// touch handler must not cancel scrolling through event retargeting.
scroller.addEventListener('touchmove',event=>event.stopPropagation(),{passive:true});
scroller.addEventListener('touchstart',event=>event.stopPropagation(),{passive:true});
function workingScope(){
 // A signed session contains a stable internal code ID. Do not use IP
 // addresses, plaintext access codes, or reusable bearer tokens as keys.
 const id=String(musicAccessActive()?.token||'').split('.')[0];
 return /^access_(?:[0-9a-f-]{36}|legacy_love_v1)$/.test(id)?id:'guest';
}
function preserveWorkingOrder(){
 const p=state.activePlaylist;if(!p?.id)return;
 const copy={v:1,id:p.id,source:p.source,origin:p.origin||'',
  name:p.name,visibility:p.visibility||'published',songs:[...state.selected]};
 try{localStorage.setItem(workingKey+':'+workingScope(),JSON.stringify(copy))}catch(_){}
}
function restoreWorkingOrder(){
 let copy;
 try{copy=JSON.parse(localStorage.getItem(workingKey+':'+workingScope())||'null')}catch(_){return false}
 if(!copy||copy.v!==1||typeof copy.id!=='string'||!copy.id||
  typeof copy.name!=='string'||!['ge','fan','user'].includes(copy.source)||
  !Array.isArray(copy.songs))return false;
 const access=musicAccessActive(),allowed=access?.restricted?new Set(access.allowed):null;
 const rows=[...new Set(copy.songs.map(canonical).filter(path=>path&&(!allowed||allowed.has(path))))];
 if(!rows.length)return false;
 state.selected=new Set(rows);
 state.activePlaylist={id:copy.id,source:copy.source,origin:copy.origin||'',
  name:copy.name,visibility:copy.visibility||'published'};
 state.playlistDraftName=copy.name;return true;
}
const saveSelected=()=>{
 try{localStorage.setItem(store,JSON.stringify([...state.selected]))}catch(_){}
 preserveWorkingOrder();
};
function canonical(input){const s=String(input||'').replace(/^\/+/, '');try{const path=s.startsWith('ge-music/music/')?decodeURIComponent(s):decodeURIComponent(new URL(s,location.href).pathname.replace(/^\/+/,''));return /^ge-music\/music\/.+\.(mp3|m4a|wav|ogg)$/i.test(path)&&!path.includes('..')?path:''}catch(_){return ''}}
function details(path){
 const pieces=path.split('/'),folder=pieces[2]||'',file=pieces.slice(3).join('/');
 const album=folder.replace(/^Grand Element - \d{4} - /,'').trim()||folder;
 const stem=file.replace(/\.(mp3|m4a|wav|ogg)$/i,'');
 // Track number is an ordering hint; the full GitHub path remains the playback ID.
 // Recognize both DJ-generated and hand-uploaded separators.
 const m=stem.match(/(?:^|[ _-])(\d{1,3})(?=[ _-]|$)/);
 const title=(m?stem.slice(m.index+m[0].length):stem).replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
 // Keep the recording path stable for saved playlists and offline downloads.
 return{path,album,title:path==='ge-music/music/Grand Element - 2026 - Aether/Aether_11_Countdown to the Droid Army.mp3'?'PEACE!':title||file,number:m?Number(m[1]):999};
}
const rank=name=>{const i=albumOrder.indexOf(name);return i<0?999:i};
function say(s){state.notice=s;notice.textContent=s||''}
function showCatalogSource(source,count){
 const label='MUSIC V7.28 · '+source+' · '+count+' SONGS';
 state.notice=label;
 notice.textContent=label;
}
function selectedTracks(){
 const byPath=new Map(state.tracks.map(track=>[track.path,track]));
 return [...state.selected].map(path=>byPath.get(path)).filter(Boolean);
}
function updateMeta(){
 const count=state.loaded?selectedTracks().length:state.selected.size;
 el('.checkedCount').textContent='CHECKED SONGS · '+count;
  const selectLabel=el('.songSelectAll');
  if(selectLabel)selectLabel.title=count+' songs checked';
 el('.playSelected').disabled=count===0;
  el('.offlineSelected').disabled=false;
  el('.buySelected').disabled=count===0;
  el('.buySelected').setAttribute('aria-label','Review purchase of '+count+' checked song'+(count===1?'':'s'));
 el('.arrangePlay').disabled=count===0;
 el('.arrangeDone').disabled=count===0;
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
 if(tracks.length){
   const play=elem('button','','PLAY');play.type='button';play.setAttribute('aria-label','Play full album '+album);
   play.addEventListener('click',()=>void playTrack(tracks[0],tracks.map(t=>t.path),true));
   actions.append(play);
   const share=elem('button','','SHARE ALBUM');share.type='button';
   share.setAttribute('aria-label','Share full album '+album);
   share.addEventListener('click',()=>shareExplicitAlbum(album));
   actions.append(share);
 }

 return actions;
}
function elem(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
async function fetchCatalog(options={}){
 const strict=!!options.strict;
 const all=[];
 const publishCatalog=(paths,final=false)=>{
  const unique=[...new Set(paths)].map(details);
  unique.sort((a,b)=>rank(a.album)-rank(b.album)||a.album.localeCompare(b.album)||a.number-b.number||a.title.localeCompare(b.title));
  state.tracks=unique;state.loaded=unique.length>0;state.loading=!state.loaded&&!final;
  if(!state.activePlaylist)restoreWorkingOrder();
  const filter=el('.songFilter'),prior=filter.value;
  filter.replaceChildren(new Option('ALL SONGS','all'),new Option('CHECKED SONGS','checked'),new Option('BROWSE ALBUMS','albums'));
  if(localStorage.getItem('GE_PLAYER_OWNER_DEMO_V1')==='yes')filter.add(new Option('TEST PURCHASED MUSIC · LOCAL ONLY','test-purchases'));
  for(const album of albumOrder.filter(name=>!LEGACY_ALBUMS.has(name)&&unique.some(track=>track.album===name)))
   filter.add(new Option('ALBUM · '+album,'album:'+album));
  if(prior&&[...filter.options].some(option=>option.value===prior))filter.value=prior;
  updateMeta();render();
  if(unique.length){
   try{window.dispatchEvent(new CustomEvent('ge-music-catalog-ready',{detail:{count:unique.length}}))}catch(_){}
  }else if(final)say('The published library could not be loaded. Check network and refresh.');
 };
 // The committed master manifest is authoritative. Check the published copy
 // too, but never replace a newer GitHub manifest with an older CDN snapshot.
 const sources=[
  'https://raw.githubusercontent.com/grandelement/website/main/radio/manifest.json',
  './manifest.json'
 ];
 const results=await Promise.allSettled(sources.map(async url=>{
  const response=await fetch(url+(url.includes('?')?'&':'?')+'ge_master='+Date.now(),{cache:'no-store'});
  if(!response.ok)throw Error(url+' HTTP '+response.status);
  const data=await response.json();
  const rows=Array.isArray(data)?data:Array.isArray(data.files)?data.files:[];
  const paths=[...new Set(rows.map(canonical).filter(Boolean))];
  if(!paths.length)throw Error(url+' has no playable songs');
  return {url,paths};
 }));
 const valid=results.filter(item=>item.status==='fulfilled').map(item=>item.value);
 if(valid.length){
  // Prefer the GitHub master when present; same-origin copy is an offline
  // fallback. Report disagreement explicitly rather than silently hiding songs.
  const chosen=valid.find(item=>item.url===sources[0])||valid[0];
  publishCatalog(chosen.paths,true);
  const mismatch=valid.length===2&&
   (valid[0].paths.length!==valid[1].paths.length||
    valid[0].paths.some(path=>!valid[1].paths.includes(path)));
  showCatalogSource(mismatch?'MASTER / PUBLISHED MISMATCH':'MASTER MANIFEST',state.tracks.length);
  if(mismatch)console.warn('GE MUSIC: Published manifest differs from GitHub master',valid.map(x=>({source:x.url,count:x.paths.length})));
  return {ok:true,count:state.tracks.length,source:'master-manifest'};
 }
 const failure=results.map(item=>item.status==='rejected'?String(item.reason):'').filter(Boolean).join('; ');
 if(strict)throw Error(failure||'Master manifest unavailable');
 if(!state.loaded)publishCatalog([],true);
 showCatalogSource('MASTER UNAVAILABLE / PREVIOUS LIST',state.tracks.length);
 console.warn('Master music manifest unavailable; preserving loaded songs',failure);
 return {ok:state.loaded,count:state.tracks.length,source:'previous-library'};
}
function readMine(){
 try{const rows=JSON.parse(localStorage.getItem(myKey)||'[]');return Array.isArray(rows)?rows.filter(x=>x&&typeof x.name==='string'&&Array.isArray(x.songs)).slice(0,100):[]}
 catch(_){return[]}
}


const fanVaultEndpoint='https://vault.grandelement.com/v1/public/fan-playlists';
function fanVaultKey(){
 try{
  let key=localStorage.getItem(fanPlaylistKey)||'';
  if(/^gefp_[a-f0-9]{64}$/.test(key))return key;
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  key='gefp_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  localStorage.setItem(fanPlaylistKey,key);return key;
 }catch(_){return ''}
}
async function fanVaultRequest(method='GET',body=null){
 const key=fanVaultKey();if(!key)throw Error('Cannot establish a secure fan library key in this browser.');
 const response=await fetch(fanVaultEndpoint,{method,cache:'no-store',
  headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok!==true)throw Error(data.error||'Fan Vault HTTP '+response.status);
 return data;
}
// Offline copy of this browser's OWN Fan Vault playlist metadata only.
 // Key by the existing private fan token so another listener on the same
 // device cannot accidentally inherit this user's cached playlist list.
const fanOfflineCachePrefix='GE_MUSIC_FAN_PLAYLISTS_OFFLINE_V1:';
function fanOfflineCacheKey(){
 const key=fanVaultKey();
 return key?fanOfflineCachePrefix+key:'';
}
function normalizeFanPlaylistRows(items){
 return (Array.isArray(items)?items:[]).filter(p=>p&&typeof p.id==='string'&&
  typeof p.name==='string'&&Array.isArray(p.songs)).slice(0,150).map(p=>({
   id:p.id,name:p.name,songs:p.songs.map(canonical).filter(Boolean),source:'fan'
  }));
}
function cacheFanPlaylistRows(items){
 try{
  const key=fanOfflineCacheKey();
  if(key){localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),items:normalizeFanPlaylistRows(items)}));window.dispatchEvent(new Event('GE_FAN_PLAYLIST_CACHE_UPDATED'));}
 }catch(error){console.warn('Fan playlist offline cache unavailable',error);}
}
function readCachedFanPlaylistRows(){
 try{
  const key=fanOfflineCacheKey();
  if(!key)return null;
  const data=JSON.parse(localStorage.getItem(key)||'null');
  return data&&Array.isArray(data.items)?normalizeFanPlaylistRows(data.items):null;
 }catch(_){return null;}
}
async function loadFanPlaylists(){
 // Show the last confirmed playlist names and track order immediately.
 // An offline network error must never clear the last good copy.
 const cached=readCachedFanPlaylistRows();
 if(cached!==null){
  state.fanLists=cached;
  if(state.open)render();
 }
 try{
  const data=await fanVaultRequest();
  state.fanLists=normalizeFanPlaylistRows(data.items);
  cacheFanPlaylistRows(state.fanLists);
  if(state.open)render();
 }catch(_){
  if(state.open)say(cached!==null
   ?'OFFLINE · SHOWING YOUR LAST SAVED FAN VAULT PLAYLISTS. SONG AUDIO MUST BE DOWNLOADED SEPARATELY.'
   :'FAN VAULT OFFLINE · NO PLAYLIST COPY STORED ON THIS DEVICE YET. CONNECT ONCE TO SYNC.');
 }
}
async function deleteFanPlaylist(playlist){
 if(!playlist?.id||!state.fanLists.some(p=>p.id===playlist.id))return;
 if(!window.confirm('Delete USER playlist "'+playlist.name+'"? This cannot be undone.'))return;
 say('DELETING USER PLAYLIST · '+playlist.name+'…');
 try{
  // Deletion must be confirmed by the authoritative Fan Vault, not merely hidden locally.
  // Try the collection API first, then the REST resource URL if collection DELETE
  // is not routed. Never report success without a fresh verified GET.
  try{
   await fanVaultRequest('DELETE',{id:playlist.id});
  }catch(error){
   if(!/not found|HTTP 404/i.test(String(error?.message||error)))throw error;
   const key=fanVaultKey();
   if(!key)throw Error('Missing Fan Vault session key');
   const response=await fetch(fanVaultEndpoint+'/'+encodeURIComponent(playlist.id),{
    method:'DELETE',cache:'no-store',
    headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'}
   });
   if(!response.ok){
    const data=await response.json().catch(()=>({}));
    throw Error('Fan Vault delete endpoint unavailable ('+response.status+'): '+(data.error||'Server must implement playlist deletion'));
   }
  }
  const verified=await fanVaultRequest();
  if((verified.items||[]).some(p=>p.id===playlist.id))throw Error('Vault still contains this playlist. Delete not verified.');
  state.fanLists=normalizeFanPlaylistRows(verified.items);
  cacheFanPlaylistRows(state.fanLists);
  if(state.activePlaylist?.source==='fan'&&state.activePlaylist.id===playlist.id){
   state.activePlaylist=null;state.playlistDraftName='';
  }
  say('USER PLAYLIST DELETED · '+playlist.name);
 }catch(error){say('DELETE FAILED · '+String(error.message||error))}
 render();
}
async function saveFanArrangement(name,tracks){
 const active=state.activePlaylist;
 const previous=state.fanLists.find(p=>p.name.toLowerCase()===name.toLowerCase());
 const current=active?.source==='fan'&&active.name.toLowerCase()===name.toLowerCase();
 const id=current?active.id:previous?.id||'';
 state.savingShared=true;render();say('SAVING '+name+' TO USER PLAYLISTS…');
 try{
  const data=await fanVaultRequest('POST',{id,name,songs:tracks,
   anon_id:String(window.GEVault?.anonId||'').slice(0,120)});
  const verified=await fanVaultRequest();
  const saved=(verified.items||[]).find(p=>p.id===data.id);
  if(!saved||saved.name!==name||!Array.isArray(saved.songs)||saved.songs.join('\n')!==tracks.join('\n'))
    throw Error('Vault save returned but the exact song order could not be verified.');
  state.fanLists=verified.items.map(p=>({id:p.id,name:p.name,songs:p.songs,source:'fan'}));
  cacheFanPlaylistRows(state.fanLists);
  state.activePlaylist={source:'fan',origin:'vault',id:data.id,name};
  state.playlistDraftName=name;
  saveSelected();
  say('USER PLAYLIST SAVED · '+name+' · '+tracks.length+' SONGS · ORDER VERIFIED.');
  recordPlaylistInteraction('control_change',{control:'fan_playlist_save',
   playlist_id:data.id,song_count:tracks.length,storage:'GE_VAULT_D1'});
 }catch(error){say('USER PLAYLIST NOT SAVED · '+String(error.message||error))}
 finally{state.savingShared=false;render()}
}
// Radio's inline playlist arrows may update only a confirmed USER playlist.
 // Never turn an unsaved selection or a GE-published playlist into an implicit edit.
async function persistLiveUserOrder(identity,paths){
 if(!identity||!['fan','user'].includes(identity.source))throw Error('This is not a saved USER PLAYLIST. Use MUSIC SAVE first.');
 const name=String(identity.name||'').trim().slice(0,100);
 const songs=paths.map(canonical);
 if(!name||!songs.length||songs.some(p=>!p)||new Set(songs).size!==songs.length)
  throw Error('Invalid playlist name or song order.');
 // Re-read the current Vault record before writing; never trust a stale identity.
 const verified=await fanVaultRequest();
 const existing=(verified.items||[]).find(p=>p.id===identity.id&&p.name===name);
 if(identity.source==='fan'&&!existing)throw Error('Original Vault playlist not found. No changes saved.');
 if(identity.source==='user'&&!readMine().some(p=>p.id===identity.id&&p.name===name))
  throw Error('Original device playlist not found. No changes saved.');
 const id=existing?.id||'';
 const result=await fanVaultRequest('POST',{id,name,songs,
  anon_id:String(window.GEVault?.anonId||'').slice(0,120)});
 const check=await fanVaultRequest();
 const saved=(check.items||[]).find(p=>p.id===result.id&&p.name===name);
 if(!saved||!Array.isArray(saved.songs)||saved.songs.join('\n')!==songs.join('\n'))
  throw Error('Vault did not verify the new order.');
 state.fanLists=check.items.map(p=>({id:p.id,name:p.name,songs:p.songs,source:'fan'}));
 cacheFanPlaylistRows(state.fanLists);
 state.activePlaylist={source:'fan',origin:'vault',id:saved.id,name};
 state.playlistDraftName=name;
 state.selected=new Set(songs);saveSelected();
 recordPlaylistInteraction('control_change',{control:'fan_playlist_reorder',playlist_id:saved.id,song_count:songs.length,storage:'GE_VAULT_D1'});
 return {id:saved.id,name,source:'fan'};
}
window.GEPersistLiveUserPlaylistOrder=persistLiveUserOrder;
const playlistPublisher='https://ge-backroom-publisher.grandelement.workers.dev';
function publisherSession(){
 // Guest access codes never authorize editing or saving shared playlists.
 try{return sessionStorage.getItem('GE_BACKROOM_PUBLISH_SESSION_V1')||''}catch(_){return ''}
}
function showOwnerSaveLogin(){
 el('.arrangeOwnerAuth').hidden=false;
 say('ENTER YOUR BACK ROOM OWNER PASSWORD TO SAVE THIS PLAYLIST EVERYWHERE.');
 el('.arrangeNotice').textContent=state.notice;el('.arrangeOwnerPassword').focus();
}
function hideOwnerSaveLogin(){
 el('.arrangeOwnerAuth').hidden=true;el('.arrangeOwnerPassword').value='';
}
async function ownerLoginAndSave(){
 if(state.savingShared)return;
 const input=el('.arrangeOwnerPassword'),password=input.value;input.value='';
 if(!password){say('ENTER BACK ROOM PASSWORD.');el('.arrangeNotice').textContent=state.notice;return}
 state.savingShared=true;el('.arrangeOwnerLogin').disabled=true;
 say('VERIFYING OWNER SIGN-IN…');el('.arrangeNotice').textContent=state.notice;
 try{
  const response=await fetch(playlistPublisher+'/login',{method:'POST',cache:'no-store',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok!==true||!data.token)throw Error(data.error||'Owner sign-in failed');
  sessionStorage.setItem('GE_BACKROOM_PUBLISH_SESSION_V1',data.token);
  hideOwnerSaveLogin();
 }catch(error){
  say('NOT SAVED · '+String(error.message||error));el('.arrangeNotice').textContent=state.notice;return;
 }finally{state.savingShared=false;el('.arrangeOwnerLogin').disabled=false}
 await saveSharedArrangement();
}
async function saveSharedArrangement(){
 if(state.savingShared)return;
 const active=state.activePlaylist,typed=state.playlistDraftName.trim().slice(0,100);
 const tracks=[...state.selected].map(canonical);
 if(!tracks.length||tracks.some(p=>!p)||new Set(tracks).size!==tracks.length){
  say('SELECT VALID SONGS BEFORE SAVING.');render();return;
 }
 // Listener SAVE never alters the Back Room GE publisher master.
 // A loaded Johnb with unchanged name becomes Johnb User, which subsequent
 // SAVEs update in this fan's private Vault rather than creating duplicates.
 const name=active?.source==='ge'&&(!typed||typed.toLowerCase()===active.name.toLowerCase())
  ?(active.name+' User').slice(0,100):typed;
 if(!name){say('ENTER A USER PLAYLIST NAME TO SAVE.');render();return}
 await saveFanArrangement(name,tracks);
}
function saveArrangement(){
 state.playlistDraftName=el('.arrangeCurrentName').value.trim().slice(0,100);
 if(!state.arranging){state.arranging=true;state.view='playlist-order';render()}
 void saveSharedArrangement();
}
async function loadPublished(){
 if(state.playlistsLoading)return;
 state.playlistsLoading=true;
 state.playlistMessage='CHECKING GITHUB AND GE VAULT PLAYLISTS…';
 if(state.open)render();
 const valid=p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Array.isArray(p.songs);
 const toList=(rows,source)=>rows.filter(valid).map(p=>({
  id:String(p.id),name:String(p.name).trim(),
  songs:[...new Set(p.songs.map(canonical).filter(Boolean))],source,visibility:'published'
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
  // One shared playlist registry; UI only displays unlisted names for
   // owner or assigned code. Names in a public GitHub JSON are not secret.
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

function visibleSharedLists(){
 // Unlisted playlists are not presented to unrelated listener codes.
 // This is UI visibility; the public GitHub registry itself is not private.
 const assigned=new Set(musicAccessActive()?.playlistIds||[]);
 return state.publicLists.filter(p=>p.visibility==='published'||assigned.has(p.id)||!!publisherSession());
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
 // Do not advertise a forthcoming gate or the active token expiry in Music.
 // Server-validated timeouts and the 33:33 Gate remain enforced unchanged.
 // Verification failures still use this status field while a code is entered.
 status.hidden=true;
 status.textContent='';
 const identity=el('.geCodeIdentity');
 identity.hidden=!access;
 // Display the owner-selected fan/access name. If intentionally unnamed, use
 // only the exact credential this visitor entered in this browser session.
 // Neither the server's record label nor owner keys are used as a substitute.
 identity.textContent=access?String(access.displayName||'ACCESS ACTIVE').slice(0,80):'';
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
     restricted:!!data.restricted,allowed,playlistIds:Array.isArray(data.playlist_ids)?data.playlist_ids:[],
     displayName:String(data.display_name||'').trim().slice(0,80),
     };
   if(!access.token||access.until<=Date.now())throw Error('Music session not confirmed.');
   state.musicAccess=access;
   try{sessionStorage.setItem(musicSessionKey,JSON.stringify(access))}catch(_){}
   el('.musicCodeInput').value='';musicAccessStatus();
   if(access.restricted){
     if(!restoreWorkingOrder()){state.activePlaylist=null;state.playlistDraftName='';state.selected=new Set(allowed)}
     saveSelected();void loadPublished();setView('access-code');
     say('Music code verified · ALL SONGS shown in the normal catalog order.');
   }else{
     if(!restoreWorkingOrder()){state.activePlaylist=null;state.playlistDraftName=''}
     setView('all');say('Music code verified for the full library.');
   }
 }catch(error){
   clearMusicAccess();say('MUSIC CODE NOT ACTIVE · '+String(error.message||error));
 }finally{state.redeemBusy=false;el('.musicCodeUnlock').disabled=false}
}
function playTrack(track,queueOverride,showPlayer=false,shuffleAll=false){
 // Return the actual bridge result synchronously. A Promise previously
 // looked successful to Radio even when the iframe was not ready.
 // A code-restricted Music session can NEVER substitute the public Radio
 // scope or change the global Bangers broadcast. Verify every requested song.
 const access=musicAccessActive();
 const codePermitted=!!access&&(!access.restricted||access.allowed.includes(track.path));
 const testPermitted=testPurchasedPaths().has(track.path);
 if(access&&!codePermitted&&!testPermitted){say('THIS CODE DOES NOT INCLUDE THAT SONG.');return false}
 if(window.GEGate?.isExpiredLocked?.()&&!codePermitted&&!testPermitted){
  window.GEGate?.restore?.();say('33:33 COMPLETE · ENTER ACCESS CODE.');return false;
 }
 // This receipt was signed by Vault when the listener entered the code.
 // The preview transport verifies the song against Vault separately.
 // Never await a network request BEFORE the click-to-play handoff: iPhone
 // Safari loses the transient audio gesture, making all PLAY buttons inert.
 // Test purchases are a local owner-only player rehearsal, not Vault access.

 // Existing preview transport remains in charge; code verification alone is
 // not proof of paid-content delivery or a full-length song license.
 const queue=Array.isArray(queueOverride)&&queueOverride.length?queueOverride:
   state.view==='access-code'?chosenSongs().map(t=>t.path):[track.path];
 // Describe what the listener actually chose, not a stale playlist label.
 // An album, saved playlist, or checked selection is shareable in its exact order.
 // The automatic PLAYER/full-song catalog is NOT a listener-created playlist.
 const albumSongs=state.tracks.filter(t=>t.album===track.album).map(t=>t.path);
 const fullAlbum=!shuffleAll&&queue.length>1&&queue.length===albumSongs.length&&
   queue.every(path=>albumSongs.includes(path));
 const chosenList=!shuffleAll&&state.activePlaylist?state.activePlaylist:null;
 const explicitQueue=!shuffleAll&&Array.isArray(queueOverride)&&queueOverride.length>0;
 const custom=explicitQueue&&queue.length>1;
 const listKind=fullAlbum?'album':chosenList?
   (['fan','user'].includes(chosenList.source)?'user':'playlist'):
   custom?'selection':'song';
 const playlistName=fullAlbum?track.album:chosenList?.name||
   (custom?(state.playlistDraftName.trim()||'MY SELECTED SONGS'):'SONG');
 // This is a selection-only description; it never carries a Vault entitlement.
 const known=new Map(state.tracks.map(t=>[t.path,t]));
 const labels=queue.map(path=>{
  const song=known.get(path);
  return song?song.title+' — '+song.album:path.split('/').pop().replace(/\.(mp3|m4a|ogg|wav)$/i,'');
 });
 const outcome=window.GEMusicV5Bridge?.play?.(track.path,queue,playlistName,{
  custom,labels,allLibrary:!!shuffleAll,shareKind:shuffleAll?'song':listKind,
  playlistIdentity:!fullAlbum&&chosenList?
   {source:chosenList.source,id:chosenList.id,name:chosenList.name}:null
 });
 if(outcome?.ok){
  if(showPlayer){
   // Use ONLY the existing main Radio player. The Gate/audio controller
   // stays internal; do not open its separate album/playlist editor.
   close();
   window.GEMusicV5Bridge?.showMainPlayer?.();
  }else say('Opening '+track.title+'.');
  return true;
 }
 say(outcome?.message||'Music preview is loading. Tap PLAY again.');
 return false;
}
function checkedQueueStartingAt(track){
 // Preserve the CHECKED playlist order, beginning at the song whose PLAY was tapped.
 // An unchecked clicked song goes first without silently changing checkboxes.
 const checked=selectedTracks().map(t=>t.path);
 if(!checked.length)return [track.path];
 const index=checked.indexOf(track.path);
 return index>=0?[...checked.slice(index),...checked.slice(0,index)]:
  [track.path,...checked];
}
async function playCheckedSongs(showPlayer=true){
 const tracks=selectedTracks();
 if(!tracks.length){say('Check at least one song to play.');return false}
 const inaccessible=musicAccessActive()?tracks.filter(t=>!canPlayTrack(t)):[];
 if(inaccessible.length){
  say(inaccessible.length+' CHECKED SONG'+(inaccessible.length===1?' NEEDS':'S NEED')+' ACCESS · Enter a GE code to play your selection.');
  return false;
 }
 // Preserve the exact checked-song order and prohibit mixing ungranted
 // selections into a restricted Vault or owner-test playlist.
 const queue=tracks.map(t=>t.path);
 recordPlaylistInteraction('control_change',{control:'music_play_checked',song_count:queue.length});
 return await playTrack(tracks[0],queue,showPlayer);
}
function isArrangeView(){return state.arranging&&(state.view==='checked'||state.view==='playlist-order')}
function appendSong(parent,track){
 const sorting=isArrangeView();
 const row=elem('div','song'),label=elem('div','songInfo'),checkbox=elem('input');
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
 const songText=elem('button','songLabel songTitlePlay',track.title);
  // The checkbox changes selection; touching the song title starts that
  // song in the main player. Keep both actions independent on iPhone.
  songText.type='button';
  songText.title='Play '+track.title;
  songText.setAttribute('aria-label','Play '+track.title+' in the main player');
  songText.addEventListener('click',()=>void playTrack(track,checkedQueueStartingAt(track),true));
  label.append(checkbox,songText);
 applyAlbumStyle(row,track.album);
 row.classList.toggle('selectedSong',checkbox.checked);
 const actions=elem('div','songActions');
 const play=elem('button','','PLAY');play.type='button';play.setAttribute('aria-label','Play '+track.title);
 play.addEventListener('click',()=>void playTrack(track,checkedQueueStartingAt(track),true));actions.append(play);

 row.append(label,actions);
 if(sorting){
   const ordered=[...state.selected],index=ordered.indexOf(track.path);
   const swap=other=>{
     if(other<0||other>=ordered.length||index<0)return;
     [ordered[index],ordered[other]]=[ordered[other],ordered[index]];
     state.selected=new Set(ordered);saveSelected();render();
     say('ORDER UPDATED · SAVE TO KEEP YOUR USER PLAYLIST.');
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
   say('ORDER UPDATED · SAVE TO USER PLAYLIST');
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
 state.view=view;state.arranging=view==='playlist-order';if(view!=='playlist-order')gePlaylistEditMode=false;
 if(state.arranging)state.arrangeReturnView='checked';
 state.term='';el('.search').value='';
 render();scroller.scrollTop=0;
}
function activeCategory(){
 return state.view==='user-playlists'||state.view==='ge-playlists'||state.view==='playlist-order'||
        state.view.startsWith('vault:')||state.view.startsWith('local:')?'playlists':state.view==='albums'?'albums':'songs';
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
 if(state.view==='playlist-order'&&gePlaylistEditMode){
   const access=musicAccessActive();
   return access?.restricted?state.tracks.filter(t=>new Set(access.allowed).has(t.path)):state.tracks;
 }
 if(state.view==='checked'||state.view==='playlist-order'){
   const lookup=new Map(state.tracks.map(t=>[t.path,t]));
   return [...state.selected].map(path=>lookup.get(path)).filter(Boolean);
 }
 if(state.view==='test-purchases')return state.tracks.filter(t=>testPurchasedPaths().has(t.path));
 if(state.view==='access-code'){
  const access=musicAccessActive();if(!access)return [];
  // In ALL SONGS use the canonical album/track catalog order. Never use the
  // access code's assigned track insertion order, which can be playlist-first.
  // A separately loaded playlist still uses the explicit selected-song order.
  if(!access.restricted)return state.tracks;
  const allowed=new Set(access.allowed);
  return state.tracks.filter(track=>allowed.has(track.path));
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
 const albumUniverseActive=state.view==='albums';
 el('.window').style.display=albumUniverseActive?'none':'';
 universe.classList.toggle('isActive',albumUniverseActive);
 universe.setAttribute('aria-hidden',String(!albumUniverseActive));
 if(albumUniverseActive){renderStandaloneAlbums();return;}
 el('.arrangeEdit').textContent=gePlaylistEditMode?'DONE':'EDIT';
 el('.arrangeEdit').setAttribute('aria-pressed',String(gePlaylistEditMode));
 const cat=activeCategory();
 el('.scroll').classList.toggle('geAlbumUniverse',cat==='albums');
 const access=musicAccessActive();
 // Keep code scope but remove redundant MY ORDER / BY ALBUM / PLAYLISTS controls.
 root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===cat)));
 const songFilter=el('.songFilter'),playlistFilter=el('.playlistFilter');
 songFilter.hidden=cat!=='songs';playlistFilter.hidden=cat!=='playlists';
 const allLabel=el('.songSelectAll'),allCheck=el('.selectAllSongs');
 allLabel.hidden=cat!=='songs';
 const allAccess=musicAccessActive(),allowed=allAccess?.restricted?new Set(allAccess.allowed):null;
 const allTracks=allowed?state.tracks.filter(t=>allowed.has(t.path)):state.tracks;
 const allCount=allTracks.filter(t=>state.selected.has(t.path)).length;
 allCheck.disabled=!state.loaded||!allTracks.length;
 allCheck.checked=allTracks.length>0&&allCount===allTracks.length;
 allCheck.indeterminate=allCount>0&&allCount<allTracks.length;
 const songView=state.view==='access-code'?'all':state.view;
 songFilter.value=[...songFilter.options].some(o=>o.value===songView)?songView:'all';
 playlistFilter.value=state.view==='ge-playlists'?'ge-playlists':state.view==='user-playlists'?'user-playlists':'playlist-order';
 el('.search').placeholder=cat==='albums'?'Find an album':cat==='songs'?'Find a song or album':'Find a playlist or checked song';
 const previous=scroller.scrollTop;
 el('.window').classList.toggle('arranging',state.arranging);
 // Playlist editor appears under PLAYLISTS (and in ARRANGE), not SONGS.
 el('.gePlaylistBar').hidden=true; // Use one playlist editor: the permanent bottom bar.
 // The playlist selector remains available as internal input to LOAD.
 const picker=el('.arrangePlaylistSelect'),priorKey=picker.value;
 const collections=[
  ...visibleSharedLists().map(p=>({label:'GE · '+p.name,key:'ge:'+p.id})),
  ...state.fanLists.map(p=>({label:'MY · '+p.name,key:'fan:'+p.id})),
  ...state.assignedLists.filter(p=>!state.publicLists.some(x=>x.id===p.id)).map(p=>({label:'CODE · '+p.name,key:'assigned:'+p.id})),
  ...readMine().map(p=>({label:'MY · '+p.name,key:'local:'+p.id}))
 ];
 picker.replaceChildren(new Option('▾',''));
 for(const p of collections)picker.add(new Option(p.label,p.key));
 const activeKey=state.activePlaylist?(
  state.activePlaylist.source==='fan'?'fan:':state.activePlaylist.source==='user'?'local:':'ge:'
 )+state.activePlaylist.id:'';
 picker.value=collections.some(p=>p.key===activeKey)?activeKey:collections.some(p=>p.key===priorKey)?priorKey:'';
 const name=el('.arrangeCurrentName');
 if(document.activeElement!==name&&name.value!==state.playlistDraftName)name.value=state.playlistDraftName;
 el('.arrangeSave').disabled=state.savingShared||!state.selected.size;
 scroller.replaceChildren();updateMeta();
 if(state.arranging){
   el('.arrangeCount').textContent='ARRANGE · '+selectedTracks().length+' SONGS';
   const current=el('.arrangeCurrentName');
   if(document.activeElement!==current&&current.value!==state.playlistDraftName)
     current.value=state.playlistDraftName;
   const shared=state.activePlaylist?.source==='ge';
   el('.arrangeSource').textContent=shared?
     'GE ORIGINAL STAYS UNCHANGED · SAVE A USER VERSION':
     'SAVE UPDATES YOUR PRIVATE USER PLAYLIST';
   el('.arrangeSave').textContent='SAVE';
   el('.arrangeSave').disabled=state.savingShared||!state.selected.size;

   el('.arrangeBuy').disabled=!state.selected.size;
   el('.arrangeNotice').textContent=state.notice||
    'SAVE stores this order in USER PLAYLISTS, not in the GE master.';
 }
 const term=state.term.toLowerCase().trim();
 const filterTrack=t=>(t.title+' '+t.album).toLowerCase().includes(term);
 notice.textContent=state.arranging?'':state.notice;
 const quickDelete=el('.quickPlaylistDelete');
 const activeUser=state.activePlaylist;
 quickDelete.disabled=!activeUser||!['fan','user'].includes(activeUser.source);
 quickDelete.title=quickDelete.disabled?'Load a USER playlist to delete it':'Delete '+activeUser.name;
 const quickName=el('.quickPlaylistName');
 if(document.activeElement!==quickName&&quickName.value!==state.playlistDraftName)quickName.value=state.playlistDraftName;
 el('.quickPlaylistSave').disabled=state.savingShared||!state.selected.size;
 const arrangeBtn=el('.arrangeBtn');
 arrangeBtn.hidden=true;
 arrangeBtn.textContent=state.arranging?'DONE':'ARRANGE';
 arrangeBtn.setAttribute('aria-pressed',String(state.arranging));
 arrangeBtn.title=state.arranging?'Finish arranging':'Hold and drag a song row to reorder';
 if(!state.loaded){scroller.append(elem('p','empty','Loading the published Grand Element catalog…'));return}
 if(state.view==='albums'){
  const grid=elem('div','albumPlanetGrid');scroller.append(grid);
  const names=[...new Set(state.tracks.map(t=>t.album))];
  const current=names.filter(name=>!LEGACY_ALBUMS.has(name)).sort((a,b)=>rank(a)-rank(b));
  const earlier=names.filter(name=>LEGACY_ALBUMS.has(name)).sort((a,b)=>rank(a)-rank(b));
  const legacyButton=elem('button','legacyToggle',
   state.showLegacyAlbums?'LEGACY · HIDE OLDER ALBUMS':'LEGACY · SHOW OLDER ALBUMS');
  legacyButton.type='button';
  legacyButton.setAttribute('aria-expanded',String(state.showLegacyAlbums));
  legacyButton.addEventListener('click',()=>{state.showLegacyAlbums=!state.showLegacyAlbums;render()});
  const shownNames=(state.showLegacyAlbums?[...current.filter(name=>name!=='Singles'),...earlier,'Singles'].filter(name=>names.includes(name)):[...current.filter(name=>name!=='Singles'),...current.filter(name=>name==='Singles')]).filter(name=>!term||name.toLowerCase().includes(term)||state.tracks.some(t=>t.album===name&&filterTrack(t)));
  for(const name of shownNames){
    const rows=state.tracks.filter(t=>t.album===name);
    if(term&&!name.toLowerCase().includes(term)&&!rows.some(filterTrack))continue;
    // Single album row: independent select-all checkbox + VIEW SONGS action.
    const wrapper=elem('div','albumBrowseRow');
    applyAlbumStyle(wrapper,name);
    albumSelectAll(wrapper,name,rows,true);
    const albumButton=elem('button','album','');
    albumButton.type='button';
    albumButton.setAttribute('aria-expanded',String(state.expandedAlbum===name));
    albumButton.setAttribute('aria-label','View songs on '+name+' album');
    albumButton.append(elem('b','',name),elem('small','countHint','VIEW SONGS'));
    albumButton.addEventListener('click',()=>{
      const before=wrapper.getBoundingClientRect();
      state.focusedAlbum=name;state.expandedAlbum='';render();
      requestAnimationFrame(()=>{
        const focused=el('.albumPlanetGrid').querySelector('.geAlbumFocused');
        if(!focused)return;
        const after=focused.getBoundingClientRect();
        if(after.width&&window.matchMedia('(prefers-reduced-motion: no-preference)').matches)
          focused.animate([{transform:'translate('+(before.left-after.left)+'px,'+(before.top-after.top)+'px) scale('+(before.width/after.width)+')',opacity:.75},{transform:'none',opacity:1}],{duration:650,easing:'cubic-bezier(.2,.8,.2,1)'});
        focused.scrollIntoView({block:'center',behavior:'smooth'});
      });
    });
    wrapper.append(albumButton);
    const description=elem('div','albumDescription');
    description.append(elem('strong','',name),elem('small','','Grand Element'),elem('p','',albumDescriptions[name]||'Explore this Grand Element recording.'),elem('small','',rows.length+' SONGS'));
    const playAlbum=elem('button','albumPlayButton','▶ PLAY ALBUM');playAlbum.type='button';
    playAlbum.addEventListener('click',()=>{if(rows.length)playTrack(rows[0],rows.map(t=>t.path),true);});
    const actions=elem('div','albumRowActions');actions.append(playAlbum,albumButton);
    wrapper.append(description,actions);
    const tile=wrapper.querySelector('.album');
    if(tile){
      const cover=document.createElement('img');
      cover.className='albumCover';
      cover.src=new URL('../ge-images/images/Grand Element - '+encodeURIComponent(name)+'.jpg',location.href).href;
      cover.alt=name+' album cover';
      cover.loading='lazy';
      cover.onerror=()=>{cover.hidden=true};
      tile.prepend(cover);
    }
    if(state.focusedAlbum===name)wrapper.classList.add('geAlbumFocused');
    grid.append(wrapper);
  }
  if(!shownNames.includes(state.focusedAlbum))state.focusedAlbum=shownNames[0]||'';
  if(state.focusedAlbum){
    const focus=state.focusedAlbum,albumTracks=state.tracks.filter(t=>t.album===focus);
    const selected=[...grid.children].find(row=>row.querySelector('.albumDescription strong')?.textContent===focus);
    selected?.classList.add('geAlbumFocused');
    const feature=elem('div','geAlbumFeature'),left=elem('div',''),right=elem('div','');
    left.append(elem('h2','',focus));
    const year=albumTracks.map(t=>String(t.path||'').match(/Grand Element - (\d{4}) - /)?.[1]).find(Boolean);
    if(year)left.append(elem('small','','Released '+year));
    right.append(elem('p','',albumDescriptions[focus]||'Explore this Grand Element recording.'));
    const view=elem('button','','VIEW SONGS');
    view.addEventListener('click',()=>{state.expandedAlbum=focus;render();requestAnimationFrame(()=>el('.expandedAlbumSongs')?.scrollIntoView({block:'start',behavior:'smooth'}))});
    const play=elem('button','','▶ PLAY ALBUM');
    play.addEventListener('click',()=>{if(albumTracks.length)playTrack(albumTracks[0],albumTracks.map(t=>t.path),true)});
    right.append(view,play);feature.append(left,right);grid.append(feature);
  }
  if(state.expandedAlbum){
   const expanded=elem('div','expandedAlbumSongs');
   expanded.append(elem('strong','expandedAlbumHeading',state.expandedAlbum+' · SELECT TRACKS'));
   for(const track of state.tracks.filter(t=>t.album===state.expandedAlbum))appendSong(expanded,track);
   scroller.append(expanded);
  }
  if(earlier.length){
   const desktopUnified=window.matchMedia('(min-width:1024px) and (min-height:600px) and (pointer:fine)').matches;
   if(desktopUnified){
    legacyButton.textContent=state.showLegacyAlbums?'LEGACY · HIDE':'LEGACY · SHOW';
    el('.filterRow').append(legacyButton);
   }else{
    scroller.append(legacyButton);
    if(state.showLegacyAlbums)scroller.append(elem('div','legacyHeading',
     'LEGACY · EARLIER GRAND ELEMENT RECORDINGS · LIBRARY ONLY · NOT FOR SALE'));
   }
  }
  if(!shownNames.length)scroller.append(elem('p','empty','No current albums found.'));
 }else if(state.view==='ge-playlists'){

  // Connection summary is already shown above the scroll area.
  // Do not waste scrolling space by repeating it as another full row.
  const shown=visibleSharedLists().filter(p=>!term||p.name.toLowerCase().includes(term));
  for(const p of shown)card(scroller,p.name,p.visibility==='unlisted'?
    'UNLISTED · CODE REQUIRED TO PLAY':'OPEN PLAYLIST',()=>{
   state.selected=new Set(p.songs);saveSelected();state.activePlaylist={source:'ge',origin:p.source||'github',visibility:p.visibility||'published',id:p.id,name:p.name};state.playlistDraftName=p.name;
   recordPlaylistInteraction('playlist_view',{playlist_id:p.id,playlist_source:p.source||'github',song_count:p.songs.length});
   setView('playlist-order');
  });
  if(!visibleSharedLists().length&&!state.playlistsLoading)scroller.append(elem('p','empty',
   'NO PLAYLISTS AVAILABLE. REFRESH OR ENTER AN ASSIGNED CODE.'));
 }else if(state.view==='user-playlists'){
  scroller.append(elem('div','section','USER PLAYLISTS · FAN VAULT & THIS DEVICE'));
  // User playlists have visible EDIT/DELETE actions and optional left-swipe emphasis.
  // Swipe never deletes anything: deletion always requires explicit confirmation.
  function userPlaylistRow(p,source){
   const row=elem('div','userPlaylistRow');
   const openPlaylist=(edit=false)=>{
    state.selected=new Set(p.songs.map(canonical).filter(Boolean));saveSelected();
    state.activePlaylist={source,origin:source==='fan'?'vault':'local',id:p.id,name:p.name};
    state.playlistDraftName=p.name;
    setView('playlist-order');
    gePlaylistEditMode=edit;
    render();scroller.scrollTop=0;
   };
   card(row,p.name,source==='fan'?'USER PLAYLIST · FAN VAULT':'DEVICE PLAYLIST',()=>openPlaylist(false));
   const edit=elem('button','userPlaylistEdit','EDIT');
   edit.type='button';edit.setAttribute('aria-label','Edit user playlist '+p.name);
   edit.addEventListener('click',()=>openPlaylist(true));
   const del=elem('button','userPlaylistDelete','DELETE');
   del.type='button';del.setAttribute('aria-label','Delete user playlist '+p.name);
   del.addEventListener('click',()=>{
    if(source==='fan'){void deleteFanPlaylist(p);return}
    if(!window.confirm('Delete device playlist "'+p.name+'"? This cannot be undone.'))return;
    try{
     localStorage.setItem(myKey,JSON.stringify(readMine().filter(item=>item.id!==p.id)));
     if(readMine().some(item=>item.id===p.id))throw Error('Delete not verified');
     if(state.activePlaylist?.source==='user'&&state.activePlaylist.id===p.id){
      state.activePlaylist=null;state.playlistDraftName='';
     }
     say('DEVICE PLAYLIST DELETED · '+p.name);
    }catch(error){say('DELETE FAILED · '+String(error.message||error))}
    render();
   });
   row.append(edit,del);
   let touchX=0,touchY=0;
   row.addEventListener('touchstart',event=>{
    if(event.touches.length!==1)return;
    touchX=event.touches[0].clientX;touchY=event.touches[0].clientY;
   },{passive:true});
   row.addEventListener('touchend',event=>{
    if(event.changedTouches.length!==1)return;
    const dx=event.changedTouches[0].clientX-touchX;
    const dy=event.changedTouches[0].clientY-touchY;
    if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5){
     row.classList.toggle('swiped',dx<0);
     if(dx<0)edit.focus({preventScroll:true});
    }
   },{passive:true});
   scroller.append(row);
  }
  const personal=state.fanLists.filter(p=>!term||p.name.toLowerCase().includes(term));
  for(const p of personal)userPlaylistRow(p,'fan');
  const local=readMine().filter(p=>!term||p.name.toLowerCase().includes(term));
  for(const p of local)userPlaylistRow(p,'user');
  if(!local.length&&!personal.length)scroller.append(elem('p','empty','Check songs under SONGS, enter a playlist name, then SAVE. Your playlist is stored in your private Fan Vault.'));
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
  if(state.view==='playlist-order'&&gePlaylistEditMode){
   scroller.append(elem('p','section','EDIT PLAYLIST · CHECK SONGS TO ADD OR REMOVE · DONE TO RETURN TO ARRANGE'));
  }
  const shown=chosen.filter(filterTrack);
  if(state.view==='test-purchases'){
    scroller.append(elem('div','section','TEST PURCHASES · NOT PAID · THIS DEVICE ONLY'));
    if(!shown.length)scroller.append(elem('p','empty','No simulated purchases yet. Use SIMULATE PURCHASE in owner Sun Lab.'));
  }

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
 // Reopening Music restores SONGS/PLAYLISTS. Never hide the user's browsing
 // controls behind a prior Arrange session; selected songs remain untouched.
 state.view='albums';state.arranging=false;state.term='';
 if(!state.activePlaylist)restoreWorkingOrder();
 el('.search').value='';
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
 // Every MUSIC opening refreshes the authoritative GitHub inventory.
 // Do not let a previously loaded manifest hide newly uploaded songs.
 if(navigator.onLine!==false&&!state.loading){
  state.loading=true;
  void fetchCatalog().catch(error=>console.warn('MUSIC live catalog refresh',error))
   .finally(()=>{state.loading=false;});
 }else if(!state.loaded&&!state.loading){
  state.loading=true;
  void fetchCatalog().finally(()=>{state.loading=false;});
 }
 void loadPublished();void loadFanPlaylists();render();scroller.scrollTop=0;root.querySelector('[data-tab="'+activeCategory()+'"]').focus();
}
function close(){
 if(!state.open)return;
 state.open=false;host.style.display='none';universe.classList.remove('isActive');document.body.classList.remove('ge-music-v5-open');
 document.body.style.overflow=oldBodyOverflow;
 button.setAttribute('aria-expanded','false');previousFocus?.focus?.();
}
root.querySelector('.backdrop').addEventListener('click',close);
el('.close').textContent='BACK';
el('.close').addEventListener('click',close);
el('.search').addEventListener('input',event=>{
 state.term=event.target.value;if(state.term)state.arranging=false;
 render();scroller.scrollTop=0;
});
el('.arrangeBtn').addEventListener('click',()=>{
 if(state.arranging){exitArrange();return}
 state.arrangeReturnView=state.view;
 if(state.view!=='playlist-order'){state.activePlaylist=null;state.playlistDraftName='';}
 state.view='checked';state.arranging=true;
 state.term='';el('.search').value='';
 say('Drag to reorder · SAVE keeps a user copy. GE master is unchanged.');
 render();scroller.scrollTop=0;
});
function exitArrange(){
 if(dragSession)finishDrag(false);
 state.arranging=false;state.view='checked';state.notice='';
 render();scroller.scrollTop=0;
}
el('.arrangeDone').addEventListener('click',()=>void playCheckedSongs(true));
let gePlaylistEditMode=false;
el('.arrangeEdit').addEventListener('click',()=>{
 gePlaylistEditMode=!gePlaylistEditMode;
 render();scroller.scrollTop=0;
});
function loadSelectedPlaylistKey(key){
 if(!key){
  const msg=state.playlistsLoading?'Playlists are still loading.':
    'NO SAVED PLAYLISTS AVAILABLE · '+state.playlistMessage;
  say(msg);el('.arrangeNotice').textContent=msg;return;
 }
 const [source,id]=key.split(':');
 const p=source==='local'?readMine().find(p=>p.id===id):
   source==='fan'?state.fanLists.find(p=>p.id===id):
   source==='ge'?state.publicLists.find(p=>p.id===id):
   source==='assigned'?state.assignedLists.find(p=>p.id===id):null;
 if(!p){say('That playlist is no longer available. Refresh playlists.');render();return}
 state.selected=new Set(p.songs.map(canonical).filter(Boolean));
 state.activePlaylist={source:source==='local'?'user':source==='fan'?'fan':'ge',
  origin:source==='local'?'local':source==='fan'?'vault':p.source||'github',
  visibility:p.visibility||'published',id:p.id,name:p.name};
 state.playlistDraftName=p.name;
 saveSelected();state.term='';el('.search').value='';
 state.view='playlist-order';state.arranging=true;
 recordPlaylistInteraction('playlist_view',{playlist_id:p.id,playlist_source:source,song_count:p.songs.length});
 say('Loaded '+p.name+' · Arrange freely. SAVE keeps a private user version.');
 render();scroller.scrollTop=0;
}

let playlistPickerCategory='ge',playlistPickerSelected='';
function pickerRows(){
 const ge=visibleSharedLists().map(p=>({key:'ge:'+p.id,name:p.name,count:p.songs.length,
  note:p.visibility==='published'?'GE PUBLISHED PLAYLIST':'GE PLAYLIST · AUTHORIZED CODE'}));
 for(const p of state.assignedLists)if(!ge.some(row=>row.key==='ge:'+p.id))
  ge.push({key:'assigned:'+p.id,name:p.name,count:p.songs.length,note:'ASSIGNED GE PLAYLIST'});
 const users=state.fanLists.map(p=>({key:'fan:'+p.id,name:p.name,count:p.songs.length,note:'SAVED IN YOUR PRIVATE GE VAULT'}));
 // Older device-only playlists remain accessible until users migrate them.
 for(const p of readMine())users.push({key:'local:'+p.id,name:p.name,count:p.songs.length,note:'OLDER DEVICE-ONLY PLAYLIST'});
 return playlistPickerCategory==='ge'?ge:users;
}
function renderPlaylistPicker(){
 if(el('.gePlaylistPicker').hidden)return;
 const isGE=playlistPickerCategory==='ge';
 el('.gePlaylistTabGE').setAttribute('aria-pressed',String(isGE));
 el('.gePlaylistTabUser').setAttribute('aria-pressed',String(!isGE));
 const host=el('.gePlaylistItems');host.replaceChildren();
 const rows=pickerRows();
 for(const p of rows){
  const button=elem('button','',p.name);button.type='button';
  button.setAttribute('aria-pressed',String(p.key===playlistPickerSelected));
  const label=elem('small','',p.note+' · '+p.count+' SONGS');
  button.append(label);
  button.addEventListener('click',()=>{
   playlistPickerSelected=p.key;
   renderPlaylistPicker();
  });
  host.append(button);
 }
 if(!rows.length)host.append(elem('p','empty',isGE?
  'No GE playlists are currently public or assigned to this access code.':
  'No personal playlists saved in this fan library yet.'));
 el('.gePlaylistConfirm').disabled=!rows.some(p=>p.key===playlistPickerSelected);
 el('.gePlaylistPickerStatus').textContent=playlistPickerCategory==='ge'?
  'Published and authorized GE playlists':'Your private GE Vault playlists and older device-only mixes';
}
function closePlaylistPicker(){
 el('.gePlaylistPicker').hidden=true;
 playlistPickerSelected='';
 el('.arrangeLoadBtn').focus();
}
async function openPlaylistPicker(){
 playlistPickerCategory='ge';playlistPickerSelected='';
 el('.gePlaylistPicker').hidden=false;
 renderPlaylistPicker();
 el('.gePlaylistTabGE').focus();
 // Refresh the exact same backing records each time LOAD is opened.
 await Promise.allSettled([loadPublished(),loadFanPlaylists()]);
 if(!el('.gePlaylistPicker').hidden)renderPlaylistPicker();
}
el('.arrangeLoadBtn').addEventListener('click',()=>void openPlaylistPicker());
el('.gePlaylistTabGE').addEventListener('click',()=>{
 playlistPickerCategory='ge';playlistPickerSelected='';renderPlaylistPicker();
});
el('.gePlaylistTabUser').addEventListener('click',()=>{
 playlistPickerCategory='user';playlistPickerSelected='';renderPlaylistPicker();
});
el('.gePlaylistPickerClose').addEventListener('click',closePlaylistPicker);
el('.gePlaylistConfirm').addEventListener('click',()=>{
 const rows=pickerRows();
 if(!rows.some(p=>p.key===playlistPickerSelected))return;
 const key=playlistPickerSelected;
 closePlaylistPicker();
 loadSelectedPlaylistKey(key);
});
el('.gePlaylistPicker').addEventListener('click',event=>{
 if(event.target===el('.gePlaylistPicker'))closePlaylistPicker();
});

el('.arrangeCurrentName').addEventListener('input',event=>{state.playlistDraftName=event.target.value;});
el('.accessToggle').addEventListener('click',()=>{
 const panel=el('.musicCodeTools'),opened=panel.hidden;
 panel.hidden=!opened;el('.accessToggle').setAttribute('aria-expanded',String(opened));
 if(opened)el('.musicCodeInput').focus();
});
// Both offline entry points use the same Radio cache controller.
 // MUSIC supplies only the checked-song filter, never a second downloader.
const musicOfflineDialog=document.createElement('dialog');
musicOfflineDialog.setAttribute('aria-label','Offline download choices');
musicOfflineDialog.style.cssText='position:fixed;z-index:2147483647;inset:0;margin:auto;width:min(92vw,440px);max-height:80vh;overflow:auto;border:2px solid #68c9b6;border-radius:14px;background:#10232c;color:white;padding:22px;font:16px system-ui;box-shadow:0 0 0 100vmax #000a';
musicOfflineDialog.innerHTML='<h2 style="margin:0 0 14px">OFFLINE DOWNLOADS</h2><p class="geOfflineSelectionCount"></p><div style="display:grid;gap:12px"><button type="button" data-action="playlist">DOWNLOAD CURRENT PLAYLIST</button><button type="button" data-action="checked">DOWNLOAD CHECKED SONGS</button><button type="button" data-action="all">DOWNLOAD FULL MUSIC LIBRARY</button><button type="button" data-action="update">UPDATE / RESUME OFFLINE</button><button type="button" data-action="status">OFFLINE STATUS</button><button type="button" data-action="remove">REMOVE OFFLINE MUSIC</button><button type="button" data-action="cancel">CANCEL</button></div>';
document.body.append(musicOfflineDialog);
musicOfflineDialog.addEventListener('click',event=>{
 const action=event.target.closest('button')?.dataset.action;
 if(!action)return;
 musicOfflineDialog.close();
 if(action==='cancel')return;
 if(action==='status'){
  void (async()=>{
   try{
    const result=await window.GEOffline?.diagnose?.();
    if(!result){say('OFFLINE STATUS UNAVAILABLE · Open RADIO once online.');return;}
    say('OFFLINE STATUS · '+result.savedSongCount+' SONGS SAVED · PLAYER '+(result.cachedAppShell?'CACHED':'NOT CACHED')+' · SERVICE WORKER '+(result.serviceWorkerRegistered?'ACTIVE':'NOT READY')+' · '+(result.readyToTestDisconnected?'READY FOR AIRPLANE MODE TEST':'SETUP INCOMPLETE'));
   }catch(error){say('OFFLINE STATUS ERROR · '+String(error?.message||error))}
  })();
  return;
 }
 if(action==='playlist'){
  if(!state.activePlaylist){say('LOAD A PLAYLIST FIRST.');return;}
  const paths=selectedTracks().map(track=>track.path);
  if(!paths.length){say('CURRENT PLAYLIST HAS NO SONGS.');return;}
  window.postMessage({type:'GE_MUSIC_OFFLINE_SELECTED',paths},location.origin);
  return;
 }
 if(action==='update'){window.postMessage({type:'GE_MUSIC_OFFLINE_ALL'},location.origin);return;}
 if(action==='remove'){
  void (async()=>{
   if(!window.confirm('REMOVE OFFLINE MUSIC from this device? This deletes downloaded song files only. Vault accounts, purchases and playlists will not be deleted.'))return;
   if(!('caches' in window)){say('OFFLINE STORAGE IS NOT AVAILABLE.');return;}
   let removed=0,failed=0;
   try{
    for(const cacheName of await caches.keys()){
     const cache=await caches.open(cacheName);
     for(const request of await cache.keys()){
      const url=new URL(request.url);
      const audioPath=decodeURIComponent(url.pathname).toLowerCase();
      if(url.origin!==location.origin||!audioPath.startsWith('/ge-music/music/')||!['.mp3','.m4a','.aac','.wav','.ogg','.flac'].some(ext=>audioPath.endsWith(ext)))continue;
      try{if(await cache.delete(request))removed++;else failed++;}catch(_){failed++;}
     }
    }
    try{localStorage.removeItem('GE_OFFLINE_READY');}catch(_){}
    say(failed?'REMOVED '+removed+' OFFLINE SONG FILES · '+failed+' COULD NOT BE REMOVED.':'REMOVED '+removed+' OFFLINE SONG FILES. PLAYLISTS AND VAULT PRESERVED.');
    geOfflineMeter.classList.remove('active');
   }catch(error){say('REMOVE OFFLINE FAILED · '+String(error.message||error));}
  })();
  return;
 }
 if(action==='checked'){
  const paths=selectedTracks().map(track=>track.path);
  if(!paths.length){say('CHECK SONGS FIRST.');return;}
  window.postMessage({type:'GE_MUSIC_OFFLINE_SELECTED',paths},location.origin);
 }else{
  window.postMessage({type:'GE_MUSIC_OFFLINE_ALL'},location.origin);
 }
});
// Compact offline download telemetry, positioned above MUSIC's bottom actions.
const geOfflineMeter=document.createElement('div');
geOfflineMeter.className='geMusicOfflineMeter';
geOfflineMeter.setAttribute('role','status');
geOfflineMeter.setAttribute('aria-live','off');
geOfflineMeter.innerHTML='<div class="geMusicOfflineTrack"><div class="geMusicOfflineFill"></div></div><div class="geMusicOfflineNumbers"><span class="geMusicOfflinePercent">0%</span><span class="geMusicOfflineRate"></span><span class="geMusicOfflineTime"></span></div>';
const geOfflineMeterStyle=document.createElement('style');
geOfflineMeterStyle.textContent='.geMusicOfflineMeter{display:none;flex:0 0 auto;padding:7px 10px 5px;background:#071e30;border-top:1px solid #477b9c;color:#eaf7ff;font:700 12px system-ui}.geMusicOfflineMeter.active{display:block}.geMusicOfflineTrack{height:12px;border:1px solid #60b3d4;border-radius:10px;overflow:hidden;background:#06121e}.geMusicOfflineFill{height:100%;width:0;background:linear-gradient(90deg,#13bba5,#51d8f7);transition:width .2s}.geMusicOfflineNumbers{display:flex;justify-content:space-between;gap:8px;margin-top:4px}.geMusicOfflineNumbers span{white-space:nowrap}';
document.head.append(geOfflineMeterStyle);
el('.selectionActions').parentElement.insertBefore(geOfflineMeter,el('.selectionActions'));
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.data?.type!=='GE_MUSIC_OFFLINE_PROGRESS')return;
 const p=event.data;
 const percent=Math.max(0,Math.min(100,Number(p.percent)||0));
 geOfflineMeter.classList.add('active');
 geOfflineMeter.querySelector('.geMusicOfflineFill').style.width=percent+'%';
 geOfflineMeter.querySelector('.geMusicOfflinePercent').textContent=Math.round(percent)+'%';
 geOfflineMeter.querySelector('.geMusicOfflineRate').textContent=p.speed>0?p.rate:'';
 geOfflineMeter.querySelector('.geMusicOfflineTime').textContent=Number.isFinite(p.eta)?p.remaining:'';
});
const shareSelectedButton=elem('button','shareSelected','SHARE');
shareSelectedButton.type='button';
shareSelectedButton.setAttribute('aria-label','Share selected songs or current playlist');
el('.selectionActions').insertBefore(shareSelectedButton,el('.buySelected'));
shareSelectedButton.addEventListener('click',()=>{
 const selected=shareSelection();
 if(!selected){say('Select an album, playlist or songs to share.');return}
 void window.GEShareMusicSelection?.(selected);
});
el('.offlineSelected').addEventListener('click',()=>{
 musicOfflineDialog.querySelector('.geOfflineSelectionCount').textContent=selectedTracks().length+' songs checked. Choose what to save on this device.';
 musicOfflineDialog.querySelector('[data-action=playlist]').disabled=!state.activePlaylist;
 if(!musicOfflineDialog.open)musicOfflineDialog.showModal();
});
// The parent offline controller owns Cache Storage. Its status must be shown
// in MUSIC rather than treating a posted request as a completed download.
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.data?.type!=='GE_MUSIC_OFFLINE_STATUS')return;
 if(typeof event.data.message==='string')say(event.data.message.slice(0,260));
});
el('.arrangeSave').addEventListener('click',saveArrangement);
el('.quickPlaylistName').addEventListener('input',event=>{state.playlistDraftName=event.target.value.slice(0,100)});
el('.quickPlaylistLoad').addEventListener('click',()=>void openPlaylistPicker());
el('.quickPlaylistDelete').addEventListener('click',async()=>{
 const active=state.activePlaylist;
 if(!active||!['fan','user'].includes(active.source)){say('LOAD A USER PLAYLIST BEFORE DELETING.');return}
 if(active.source==='fan'){
  const playlist=state.fanLists.find(p=>p.id===active.id);
  if(!playlist){say('USER PLAYLIST NOT FOUND.');return}
  await deleteFanPlaylist(playlist);
  return;
 }
 const playlist=readMine().find(p=>p.id===active.id);
 if(!playlist){say('DEVICE PLAYLIST NOT FOUND.');return}
 if(!window.confirm('Delete device playlist "'+playlist.name+'"? This cannot be undone.'))return;
 try{
  localStorage.setItem(myKey,JSON.stringify(readMine().filter(p=>p.id!==playlist.id)));
  if(readMine().some(p=>p.id===playlist.id))throw Error('Delete not verified');
  state.activePlaylist=null;state.playlistDraftName='';
  say('DEVICE PLAYLIST DELETED · '+playlist.name);
 }catch(error){say('DELETE FAILED · '+String(error.message||error))}
 render();
});
el('.quickPlaylistSave').addEventListener('click',()=>{
 state.playlistDraftName=el('.quickPlaylistName').value.trim().slice(0,100);
 void saveSharedArrangement();
});
el('.arrangeOwnerLogin').addEventListener('click',()=>void ownerLoginAndSave());
el('.arrangeOwnerCancel').addEventListener('click',hideOwnerSaveLogin);
el('.arrangeOwnerPassword').addEventListener('keydown',event=>{
 if(event.key==='Enter'){event.preventDefault();void ownerLoginAndSave()}
});

el('.playSelected').addEventListener('click',()=>void playCheckedSongs(true));
el('.buySelected').addEventListener('click',()=>{
  const tracks=selectedTracks();
  if(!tracks.length){say('Check at least one song to buy.');return;}
  // Express is a checkout REVIEW only until real verified payments are enabled.
  requestBuy({mode:'tracks',paths:tracks.map(track=>track.path),express:true});
});
el('.arrangePlay').addEventListener('click',()=>void playCheckedSongs(true));

el('.songFilter').addEventListener('change',event=>setView(event.target.value));
el('.reloadCatalogBtn').addEventListener('click',async()=>{
 // Use the full Radio reload pipeline when this session has permission.
 // That pipeline updates Radio, MUSIC, playlists, assets and offline media.
 const radioReload=document.getElementById('reloadBtn');
 if(radioReload&&!radioReload.hidden&&!radioReload.disabled){
   radioReload.click();
   say('RELOADING SHARED RADIO AND MUSIC LIBRARY…');
   return;
 }
 const button=el('.reloadCatalogBtn');
 if(state.loading)return;
 state.loading=true;button.disabled=true;
 say('SCANNING GITHUB · BUILDING FRESH LIBRARY…');
 try{
  const result=await fetchCatalog({strict:true});
  void loadPublished();void loadFanPlaylists();
  showCatalogSource(result.source==='master-manifest'?'MASTER MANIFEST':'PREVIOUS LIBRARY',result.count);
 }catch(error){say('GITHUB SCAN FAILED · OLD LIBRARY KEPT · '+String(error?.message||error))}
 finally{state.loading=false;button.disabled=false}
});
el('.selectAllSongs').addEventListener('change',event=>{
 const access=musicAccessActive(),allowed=access?.restricted?new Set(access.allowed):null;
 const rows=allowed?state.tracks.filter(t=>allowed.has(t.path)):state.tracks;
 if(!state.loaded||!rows.length)return;
 for(const track of rows){
  if(event.target.checked)state.selected.add(track.path);
  else state.selected.delete(track.path);
 }
 saveSelected();say(event.target.checked?'ALL AVAILABLE SONGS SELECTED.':'ALL AVAILABLE SONGS UNCHECKED.');
 render();
});
el('.playlistFilter').addEventListener('change',event=>setView(event.target.value));
root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
 const access=musicAccessActive();
 if(b.dataset.tab==='albums')setView('albums');
 else if(b.dataset.tab==='songs')setView(access?.restricted?'access-code':'all');
 else setView('user-playlists');
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
  if(!restoreWorkingOrder()){state.activePlaylist=null;state.playlistDraftName='';state.selected=new Set(access.allowed)}
  saveSelected();state.view='access-code';
  state.accessView='order';state.accessPlaylistFilter='';void loadPublished();
 }
 musicAccessStatus();if(state.open)render();
});
root.querySelector('[data-action=clear]').addEventListener('click',()=>{state.selected.clear();saveSelected();say('Selection cleared.');render()});
root.querySelector('[data-action=save]').addEventListener('click',()=>{
 if(state.view!=='playlist-order'&&!state.activePlaylist)state.playlistDraftName='';
 state.arranging=true;state.view='playlist-order';state.term='';el('.search').value='';
 render();scroller.scrollTop=0;
 say('EDIT PLAYLIST NAME AND PRESS SAVE TO UPDATE THE SHARED MASTER.');
 el('.arrangeNotice').textContent=state.notice;
});
document.addEventListener('keydown',event=>{
 if(!state.open||event.key!=='Escape')return;
 event.preventDefault();
 if(!el('.gePlaylistPicker').hidden){closePlaylistPicker();return}
 close();
});
button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();state.open?close():open()});
button.dataset.geMusicBuild=BUILD;
function preloadCatalog(){
  // Prepare the static catalog before the first main PLAY tap.
  // Never open a purchase screen, start audio or bypass the existing Gate.
  if(!state.loaded&&!state.loading){
    state.loading=true;
    void fetchCatalog().catch(error=>console.warn('MUSIC preload catalog',error))
      .finally(()=>{state.loading=false;});
  }
}
// SHARE exports only a playlist's song paths and label. No fan Vault key,
// owner token, access code, signed session, or entitlement leaves this device.
function shareSelection(){
 const valid=paths=>[...new Set((Array.isArray(paths)?paths:[]).map(canonical).filter(Boolean))].slice(0,250);
 const make=(name,songs,kind,id='')=>{
  const paths=valid(songs);
  return paths.length?{name:String(name||'Music playlist').slice(0,80),paths,kind,id:String(id||'').slice(0,100)}:null;
 };
 if(state.view.startsWith('album:')){
  const album=state.view.slice(6),tracks=state.tracks.filter(t=>t.album===album);
  return make(album,tracks.map(t=>t.path),'album');
 }
 const viewId=state.view.replace(/^(?:vault|local):/,'');
 if(state.view.startsWith('vault:')){
  const p=state.publicLists.find(x=>x.id===viewId);
  return p?make(p.name,p.songs,'playlist',p.id):null;
 }
 if(state.view.startsWith('local:')){
  const p=readMine().find(x=>x.id===viewId);
  return p?make(p.name,p.songs,'user',p.id):null;
 }
 if(state.activePlaylist){
  const p=[...state.fanLists,...state.publicLists,...readMine()].find(x=>
    x.id===state.activePlaylist.id&&x.name===state.activePlaylist.name);
  const songs=p?.songs||selectedTracks().map(t=>t.path);
  return make(state.activePlaylist.name,songs,
    ['fan','user'].includes(state.activePlaylist.source)?'user':'playlist',
    state.activePlaylist.id);
 }
 const chosen=chosenSongs();
 if(state.view==='access-code'&&chosen.length)return make('My access songs',chosen.map(t=>t.path),'selection');
 if(state.view==='checked'||state.view==='playlist-order')
  return make(state.playlistDraftName||'My selected songs',chosen.map(t=>t.path),'selection');
 if(state.open&&state.selected.size)
  return make('My selected songs',selectedTracks().map(t=>t.path),'selection');
 return null;
}
function shareExplicitAlbum(name){
 const tracks=state.tracks.filter(t=>t.album===name);
 const selection={name,paths:tracks.map(t=>t.path),kind:'album'};
 if(!selection.paths.length){say('This album is not loaded yet.');return}
 void window.GEShareMusicSelection?.(selection);
}
window.GEMusicV5={open,close,preload:preloadCatalog,shareSelection,showTestLibrary:openTestLibrary,
 acceptRadioCatalog:(urls)=>{
  const paths=[...new Set((Array.isArray(urls)?urls:[]).map(canonical).filter(Boolean))];
  if(!paths.length)throw Error('Radio supplied no playable songs');
  const unique=paths.map(details).sort((a,b)=>rank(a.album)-rank(b.album)||a.album.localeCompare(b.album)||a.number-b.number||a.title.localeCompare(b.title));
  state.tracks=unique;state.loaded=true;state.loading=false;
  updateMeta();render();
  showCatalogSource('RADIO SHARED CATALOG',unique.length);
  return unique.length;
 },
 playAll:(direction='play')=>{
  // PLAY never demands a code or redirects a guest before the real 33:33 Gate.
  // Vault receipts still restrict assigned songs and the preview player
  // enforces the exact 2013-second listening limit.
  const access=musicAccessActive();
  if(window.GEGate?.isExpiredLocked?.()&&!access){
    window.GEGate?.restore?.();
    say('33:33 COMPLETE · ENTER ACCESS CODE.');
    return false;
  }
  if(!state.loaded){
    preloadCatalog();
    say('Loading songs. Tap PLAY when the library is ready.');
    return false;
  }
  const publicDefault=Array.isArray(window.GEPublicPlayerPlaylistPaths)?
    new Set(window.GEPublicPlayerPlaylistPaths):new Set();
  const approvedMaster=Array.isArray(window.GEPublicPlayerApprovedPaths)?
    new Set(window.GEPublicPlayerApprovedPaths):null;
  const permitted=state.tracks.filter(t=>
    !LEGACY_ALBUMS.has(t.album)&&t.album!=='Singles'&&
    (!access?.restricted||access.allowed.includes(t.path))&&
    (!approvedMaster?.size||approvedMaster.has(t.path))&&
    (!publicDefault.size||publicDefault.has(t.path)));
  if(!permitted.length){
    say(publicDefault.size?'No available songs in the default Player playlist. Check the Master approvals.':
      'No playable non-Legacy songs are in the library.');return false
  }
  // Keep the album-order queue stable. Shuffle selects a random starting
  // track and the preview engine shuffles NEXT, not the song list itself.
  const queue=permitted.map(t=>t.path);
  const shuffle=window.GEMusicV5Bridge?.shuffleEnabled?.()!==false;
  const first=permitted[shuffle?Math.floor(Math.random()*permitted.length):0];
  return playTrack(first,queue,true,true);
 },
 refresh:()=>{if(state.open)render()},reloadLibrary:()=>fetchCatalog(),
 syncUserPlaylists:loadFanPlaylists,
 reportPlayback:message=>say(message),
 build:BUILD,state:()=>({loaded:state.loaded,open:state.open,count:state.selected.size,arranging:state.arranging})};
// Load at startup rather than making the listener press PLAY twice while
// the library downloads its manifest and initializes the music queue.
preloadCatalog();
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