/* MINI PLAYER — appears from the sun; loads from radio repo; full controls */
import { setNowPlayingTitle } from './sun_moon.js';

const musicBtn = document.querySelector('#musicBtn');

/* create panel only once */
let panel = document.querySelector('#mini');
if(!panel){
  panel = document.createElement('div');
  panel.id = 'mini';
  panel.className = 'miniPlayer';
  panel.innerHTML = `
    <div class="controls">
      <button class="btn" id="prev" title="Previous">◀</button>
      <button class="btn" id="play" title="Play/Pause">▶</button>
      <button class="btn" id="next" title="Next">▶▶</button>
    </div>
    <div class="title" id="mpTitle">—</div>
    <div class="toggles">
      <button class="toggle active" id="tgShuffle">Shuffle</button>
      <button class="toggle" id="tgAlbum">Album</button>
    </div>
    <div class="sliders">
      <input id="seek" type="range" min="0" max="100" value="0" step="0.1">
      <input id="vol"  type="range" min="0" max="1"   value="0.85" step="0.01">
    </div>
    <audio id="gePlayer" preload="auto" crossorigin="anonymous" playsinline></audio>
  `;
  document.querySelector('#sun').appendChild(panel);
}

/* show/hide panel */
panel.style.display='none';
musicBtn?.addEventListener('click', (e)=>{
  panel.style.display = panel.style.display==='none' ? 'grid' : 'none';
  e.stopPropagation();
});

/* elements */
const PLAYER    = panel.querySelector('#gePlayer');
const titleEl   = panel.querySelector('#mpTitle');
const btnPrev   = panel.querySelector('#prev');
const btnPlay   = panel.querySelector('#play');
const btnNext   = panel.querySelector('#next');
const tgShuffle = panel.querySelector('#tgShuffle');
const tgAlbum   = panel.querySelector('#tgAlbum');
const seek      = panel.querySelector('#seek');
const vol       = panel.querySelector('#vol');

/* playlist */
let PLAYLIST=[], pIndex=0, SHUFFLE=true, SEEKING=false;

/* utility */
function setTitle(urlOrName){
  let name = urlOrName;
  try{
    if(/^https?:/.test(urlOrName)){
      name = decodeURIComponent(urlOrName.split('/').pop()).replace(/\.[^/.]+$/,'');
    }
    // Convert "Album - 03 - Track" → "Album • 03 · Track"
    name = name.replace(/\s*-\s*/g,' · ').replace(/ · (\d{2}) · /,' • $1 · ');
  }catch(_){}
  titleEl.textContent = name || '—';
  setNowPlayingTitle(name);
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } }

function loadAndPlay(){
  if(!PLAYLIST.length) return;
  PLAYER.src = PLAYLIST[pIndex];
  setTitle(PLAYER.src);
  PLAYER.play().then(()=>{ btnPlay.textContent='❚❚'; }).catch(()=>{ btnPlay.textContent='▶'; });
}
function next(){ if(!PLAYLIST.length) return; pIndex = (pIndex+1)%PLAYLIST.length; loadAndPlay(); }
function prev(){ if(!PLAYLIST.length) return; pIndex = (pIndex-1+PLAYLIST.length)%PLAYLIST.length; loadAndPlay(); }

/* controls */
btnPlay.addEventListener('click', ()=>{ if(PLAYER.paused){ PLAYER.play(); btnPlay.textContent='❚❚'; } else { PLAYER.pause(); btnPlay.textContent='▶'; } });
btnNext.addEventListener('click', next);
btnPrev.addEventListener('click', prev);

/* toggles */
function setMode(shuffleOn){
  SHUFFLE = shuffleOn;
  tgShuffle.classList.toggle('active', SHUFFLE);
  tgAlbum.classList.toggle('active', !SHUFFLE);
  if(PLAYLIST.length){
    if(SHUFFLE){ shuffle(PLAYLIST); }
    pIndex=0; loadAndPlay();
  }
}
tgShuffle.addEventListener('click', ()=> setMode(true));
tgAlbum  .addEventListener('click', ()=> setMode(false));

/* sliders */
PLAYER.addEventListener('timeupdate', ()=>{
  if(!SEEKING && PLAYER.duration){
    seek.value = (PLAYER.currentTime / PLAYER.duration) * 100;
  }
});
seek.addEventListener('input', ()=>{ SEEKING=true; });
seek.addEventListener('change', ()=>{
  if(PLAYER.duration){
    PLAYER.currentTime = (seek.value/100) * PLAYER.duration;
  }
  SEEKING=false;
});
vol.addEventListener('input', ()=>{ PLAYER.volume = +vol.value; });

/* autoplay resume + ended */
PLAYER.addEventListener('ended', next);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && PLAYER.paused){ PLAYER.play().catch(()=>{}); }});

/* mobile first-tap to allow audio */
window.addEventListener('pointerdown', function once(){ PLAYER.muted=false; PLAYER.play().catch(()=>{}); window.removeEventListener('pointerdown', once, {capture:true}); }, {capture:true, once:true});

/* ---- Load playlist from Radio repo ----
   Expects a plain text file at:
   https://grandelement.github.io/radio/music/playlist.txt
   Lines can be absolute URLs or bare filenames.
-------------------------------------------------------------- */
const BASE = 'https://grandelement.github.io/radio/music/';
fetch(`${BASE}playlist.txt`, {cache:'no-store'})
  .then(r => r.ok ? r.text() : '')
  .then(text => {
    let items = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    items = items.map(s => s.startsWith('http') ? s : `${BASE}${encodeURIComponent(s)}`);
    if(!items.length){
      // fallback examples (so the UI still works if playlist is missing)
      items = [`${BASE}Track01.mp3`];
    }
    PLAYLIST = items;
    if(SHUFFLE) shuffle(PLAYLIST);
    pIndex = 0;
    loadAndPlay();
  })
  .catch(err=>{
    titleEl.textContent = 'Playlist not found';
    console.warn('mini_player: playlist load failed', err);
  });
