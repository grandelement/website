/* GE Studios direct GitHub publisher. No Cloudflare calls and no stored credentials.
   Public music routing and public player profile only. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const API='https://api.github.com/repos/grandelement/website/contents/config/site-live.json';
const DRAFT_KEY='GE_DIRECT_GITHUB_MUSIC_DRAFT_V1';
const ORDER=['Aether','Fire','Spirit','Soul','Love','Intergy','Sessions II','Sessions I','Live','Trio','Fundamental Groove','Singles'];
const SCOPE=['sunlab','offline','reload','debug','legacy','iam'];
const KEYS=['frontAlbums','storeAlbums','storeSongPaths','playerSongPaths','radioSongPaths'];
let files=[],albums=[],base=null,work=null,assignments={},busy=false,playlistList=[];
const distinct=items=>[...new Set(items)];
const sorted=items=>distinct(items).sort();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clone=thing=>JSON.parse(JSON.stringify(thing));
const albumOf=path=>(String(path).split('/')[2]||'').replace(/^Grand Element - (?:\d{4} - )?/,'').trim();
const fileName=path=>String(path).split('/').pop().replace(/\.(?:mp3|m4a|wav|ogg|flac)$/i,'')
 .replace(/^[^_]+_\d+[-_]?/,'').replace(/_/g,' ').replace(/\s+/g,' ').trim();
function status(message,kind='warn'){
 $('status').dataset.kind=kind;$('status').textContent=message;
}
function snapshot(config){
 const music=config.music||{},routing=music.catalogRouting||{},profile=music.publicPlayer||{};
 const available=files.map(row=>row.path),names=albums;
 return {
  frontAlbums:sorted(Array.isArray(routing.frontAlbums)?routing.frontAlbums:names.filter(n=>n!=='Singles')),
  storeAlbums:sorted(Array.isArray(routing.storeAlbums)?routing.storeAlbums:names),
  storeSongPaths:sorted(Array.isArray(routing.storeSongPaths)?routing.storeSongPaths:available),
  playerSongPaths:sorted(Array.isArray(routing.playerSongPaths)?routing.playerSongPaths:available),
  radioSongPaths:sorted(Array.isArray(music.radioMasterSongPaths)?music.radioMasterSongPaths:[]),
  playlistId:String(profile.playlistId||''),
  scopes:sorted(Array.isArray(profile.scopes)?profile.scopes.filter(x=>SCOPE.includes(x)):[]),
  assignments:Object.fromEntries(['front','store','player','radio'].map(k=>[k,String(routing.assignments?.[k]||'')]))
 };
}
function recover(){
 try{
  const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
  if(d?.version===1&&d.base&&d.work){
   // Only use local drafts from the same committed music catalog.
   if([...KEYS,'scopes'].every(k=>Array.isArray(d.work[k]))){
    work=d.work;base=d.base;return true;
   }
  }
 }catch(_){}
 return false;
}
function remember(){
 if(!work||!base)return;
 try{localStorage.setItem(DRAFT_KEY,JSON.stringify({version:1,base,work,at:Date.now()}))}catch(_){}
}
function changed(){return !!work&&!!base&&!same(work,base)}
function counts(){
 if(!work)return;
 $('counts').textContent=files.length+' FILES · '+work.frontAlbums.length+' FRONT ALBUMS · '+
 work.storeAlbums.length+' STORE ALBUMS · '+work.storeSongPaths.length+' STORE SONGS · '+
 work.playerSongPaths.length+' PLAYER SONGS · '+work.radioSongPaths.length+' RADIO SONGS'+
 (changed()?' · UNSAVED LOCAL DRAFT':' · MATCHES PUBLISHED');
 $('save').disabled=busy||!changed();
 $('discard').disabled=busy||!changed();
}
function choose(key,value,on){
 const set=new Set(work[key]);if(on)set.add(value);else set.delete(value);
 work[key]=sorted([...set]);remember();counts();
}
function box(key,value,display){
 const label=document.createElement('label');
 const c=document.createElement('input');c.type='checkbox';c.checked=work[key].includes(value);
 const destination=key==='frontAlbums'?'front':key==='storeAlbums'||key==='storeSongPaths'?'store':
  key==='playerSongPaths'?'player':'radio';
 const assigned=!!assignments[destination];
 c.disabled=assigned;c.setAttribute('aria-label',display);
 if(assigned)c.title='This destination is assigned to a saved playlist; edit its playlist first.';
 c.addEventListener('change',()=>choose(key,value,c.checked));
 label.append(c);return label;
}
function renderAlbums(){
 const host=$('albumChoices');host.replaceChildren();
 const title=document.createElement('div');title.className='albumRow columnLegend';
 for(const name of ['ALBUM','FRONT','STORE']){const s=document.createElement('span');s.textContent=name;title.append(s)}
 host.append(title);
 for(const album of albums){
  const row=document.createElement('div');row.className='albumRow';
  const name=document.createElement('strong');name.textContent=album;row.append(name);
  row.append(box('frontAlbums',album,'Show '+album+' on front'));
  row.append(box('storeAlbums',album,'Show '+album+' in store'));
  host.append(row);
 }
}
function renderSongs(){
 const host=$('songs');host.replaceChildren();
 const head=document.createElement('div');head.className='songRow columnLegend';
 for(const name of ['SONG','STORE','PLAYER','RADIO']){const el=document.createElement('span');el.textContent=name;head.append(el)}
 host.append(head);
 const filter=$('albumFilter').value,term=$('search').value.toLowerCase().trim();
 for(const entry of files){
  if(filter&&entry.album!==filter)continue;
  if(term&&!(entry.album+' '+entry.name).toLowerCase().includes(term))continue;
  const row=document.createElement('div');row.className='songRow';
  const label=document.createElement('span');label.textContent=entry.name;
  const small=document.createElement('small');small.textContent=entry.album;label.append(small);
  row.append(label);
  for(const [key,caption] of [['storeSongPaths','Store'],['playerSongPaths','Player'],['radioSongPaths','Radio']])
   row.append(box(key,entry.path,caption+' '+entry.name));
  host.append(row);
 }
}
function renderProfile(){
 const options=$('playlist');
 options.replaceChildren(new Option('MASTER SONGS · DEFAULT',''));
 for(const p of playlistList){
  if(!p.id||!Array.isArray(p.songs)||!p.songs.length)continue;
  options.add(new Option(p.name+' · '+p.songs.length+' SONGS',p.id));
 }
 if(work.playlistId&&![...options.options].some(o=>o.value===work.playlistId))
  options.add(new Option('MISSING PLAYLIST · RELOAD',work.playlistId));
 options.value=work.playlistId;
 for(const input of $('scopes').querySelectorAll('input[type=checkbox]'))
  input.checked=work.scopes.includes(input.value);
}
function renderAll(){
 renderAlbums();renderSongs();renderProfile();counts();
}
async function fetchPublished(){
 const query='?ge-direct='+Date.now();
 const [cfgResponse,manifestResponse,playlistResponse]=await Promise.all([
  fetch('../config/site-live.json'+query,{cache:'no-store'}),
  fetch('../radio/manifest.json'+query,{cache:'no-store'}),
  fetch('../playlists/registry.json'+query,{cache:'no-store'})
 ]);
 if(!cfgResponse.ok||!manifestResponse.ok)throw Error('Public website settings or music manifest unavailable.');
 const config=await cfgResponse.json(),manifest=await manifestResponse.json();
 if(!Array.isArray(manifest.files)||!Array.isArray(config.music?.radioMasterSongPaths))
  throw Error('Missing public music inventory or approved Radio songs.');
 files=distinct(manifest.files.filter(p=>/^ge-music\/music\/.+\.(?:mp3|m4a|wav|ogg|flac)$/i.test(p)))
  .map(path=>({path,album:albumOf(path),name:fileName(path)}))
  .sort((a,b)=>ORDER.indexOf(a.album)-ORDER.indexOf(b.album)||a.name.localeCompare(b.name));
 if(!files.length)throw Error('Music inventory empty. Nothing changed.');
 albums=distinct(files.map(row=>row.album)).sort((a,b)=>ORDER.indexOf(a)-ORDER.indexOf(b));
 try{const data=playlistResponse.ok?await playlistResponse.json():null;playlistList=data?.playlists||[]}catch(_){playlistList=[]}
 $('albumFilter').replaceChildren(new Option('ALL ALBUMS',''),
  ...albums.map(a=>new Option(a,a)));
 return config;
}
async function load(force=false){
 if(busy)return;
 if(force&&changed()&&!confirm('Reload published settings? Your unsaved selections are backed up locally, but reloading will discard that draft.'))return;
 busy=true;$('reload').disabled=true;status('LOADING PUBLISHED SETTINGS…');
 try{
  const config=await fetchPublished(),fresh=snapshot(config);
  base=fresh;work=clone(fresh);
  if(!force&&recover()){
   if(!same(base,fresh))status('LOCAL DRAFT RESTORED. GitHub has changed since this draft. Saving will stop on conflict until you review.','warn');
   else status('LOCAL DRAFT RESTORED · Unsaved selections are still on this device.','warn');
  }else{
   if(force)localStorage.removeItem(DRAFT_KEY);
   status('PUBLISHED MUSIC SETTINGS LOADED · GitHub direct publishing ready.','success');
  }
  assignments=work.assignments||fresh.assignments;
  renderAll();
 }catch(e){status('NOT LOADED · '+String(e.message||e),'error')}
 finally{busy=false;$('reload').disabled=false;counts()}
}
function decode64(base64){
 const binary=atob(String(base64||'').replace(/\s/g,'')),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 return new TextDecoder().decode(bytes);
}
function encode64(s){
 const buf=new TextEncoder().encode(s),list=[];
 for(let i=0;i<buf.length;i+=8192)list.push(String.fromCharCode(...buf.subarray(i,i+8192)));
 return btoa(list.join(''));
}
async function githubGet(token){
 const response=await fetch(API+'?ref=main',{cache:'no-store',credentials:'omit',
  headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.sha||!data.content)
  throw Error(response.status===401?'GitHub token is invalid or expired.':
   'GitHub GET rejected (HTTP '+response.status+'). Check token repository and Contents permissions.');
 return {data:JSON.parse(decode64(data.content)),sha:data.sha};
}
function checkSelections(){
 const allowed=new Set(files.map(x=>x.path)),validAlbums=new Set(albums);
 if(!work.radioSongPaths.length)throw Error('Keep at least one RADIO song enabled.');
 for(const k of ['storeSongPaths','playerSongPaths','radioSongPaths'])
  if(work[k].some(x=>!allowed.has(x)))throw Error('Unknown song in '+k+'. Please reload.');
 for(const k of ['frontAlbums','storeAlbums'])
  if(work[k].some(x=>!validAlbums.has(x)))throw Error('Unknown album in '+k+'. Please reload.');
 if(!SCOPE.every(x=>typeof x==='string')||work.scopes.some(x=>!SCOPE.includes(x)))
  throw Error('Invalid player permission.');
 if(Object.values(work.assignments).some(Boolean)&&
    KEYS.some(k=>!same(work[k],base[k])))throw Error('Playlist assignment is active. Use the assigned playlist editor; direct save will not override it.');
}
async function save(){
 if(busy||!changed()){status('NO CHANGES TO SAVE.','warn');return}
 const input=$('token'),secret=String(input.value||'').trim();
 if(!secret){status('ENTER THE FINE-GRAINED GITHUB TOKEN FOR THIS SAVE.','error');return}
 // Erase the DOM copy immediately. The secret only remains in this call while GitHub API requests finish.
 input.value='';
 if(!confirm('Publish your selected FRONT, STORE, PLAYER, RADIO and Public Player settings to GitHub? This will NOT change the BLITZ DJ queue, private Vault or access codes.'))return;
 busy=true;$('save').disabled=true;$('discard').disabled=true;
 let commit='';
 try{
  checkSelections();
  status('CHECKING CURRENT GITHUB SETTINGS. LOCAL DRAFT IS SAFE.');
  const {data:remote,sha}=await githubGet(secret);
  const live=snapshot(remote);
  if(!same(live,base))throw Error('GitHub settings changed after you loaded this page. Nothing saved. Keep your local draft and review the latest settings before retrying.');
  const next=clone(remote);next.music={...(remote.music||{})};
  next.music.catalogRouting={...(remote.music?.catalogRouting||{}),version:2,
   frontAlbums:work.frontAlbums,storeAlbums:work.storeAlbums,
   storeSongPaths:work.storeSongPaths,playerSongPaths:work.playerSongPaths,
   assignments:{...work.assignments}};
  const was=remote.music?.radioMasterSongPaths||[],desired=new Set(work.radioSongPaths);
  next.music.radioMasterSongPaths=[...was.filter(x=>desired.has(x)),
   ...work.radioSongPaths.filter(x=>!was.includes(x))];
  if(!same(sorted(was),sorted(next.music.radioMasterSongPaths)))
   next.music.radioMasterRevision=(Number(remote.music?.radioMasterRevision)||0)+1;
  next.music.publicPlayer={...(remote.music?.publicPlayer||{}),playlistId:work.playlistId,scopes:work.scopes};
  next.publishedAt=new Date().toISOString();
  const payload=JSON.stringify(next,null,2)+'\n';
  status('SAVING PUBLIC SETTINGS TO GITHUB…');
  const put=await fetch(API,{method:'PUT',cache:'no-store',credentials:'omit',
   headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+secret,
    'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
   body:JSON.stringify({message:'GE Direct Publisher: save public music destinations and player profile',
    content:encode64(payload),sha,branch:'main'})});
  const response=await put.json().catch(()=>({}));
  if(!put.ok||!response.commit?.sha)
   throw Error('GitHub did not accept the save (HTTP '+put.status+'). '+String(response.message||''));
  commit=response.commit.sha;
  const read=await githubGet(secret),verified=snapshot(read.data);
  if(!same(verified,work))
   throw Error('GitHub commit exists, but verification differed. Do not retry until reviewed.');
  base=clone(work);localStorage.removeItem(DRAFT_KEY);counts();
  status('SAVED AND VERIFIED ON GITHUB · '+commit.slice(0,12)+'\n'+
   work.playerSongPaths.length+' PLAYER · '+work.radioSongPaths.length+' RADIO · '+
   work.storeSongPaths.length+' STORE SONGS. Pages deployment follows.','success');
 }catch(e){
  status((commit?'COMMIT MADE BUT NOT VERIFIED · ':'NOT SAVED · ')+String(e.message||e)+
   '\nYour selections remain in the local draft.','error');
 }finally{
  busy=false;input.value='';counts();
 }
}
$('save').addEventListener('click',()=>void save());
$('reload').addEventListener('click',()=>void load(true));
$('discard').addEventListener('click',()=>{
 if(!confirm('Discard the unsaved local draft and reload the published GitHub music settings?'))return;
 localStorage.removeItem(DRAFT_KEY);base=null;work=null;void load(true);
});
$('albumFilter').addEventListener('change',renderSongs);
$('search').addEventListener('input',renderSongs);
$('playlist').addEventListener('change',()=>{work.playlistId=$('playlist').value;remember();counts()});
for(const box of $('scopes').querySelectorAll('input[type=checkbox]'))
 box.addEventListener('change',()=>{work.scopes=sorted([...$('scopes').querySelectorAll('input:checked')].map(x=>x.value));remember();counts()});
void load();
})();