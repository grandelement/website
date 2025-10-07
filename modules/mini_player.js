const C = window.GE_CONFIG;
const mini = document.getElementById('mini');
const toggle = document.getElementById('togglePanel');

// Build UI
mini.innerHTML = `
  <div class="controls">
    <div class="btn" id="prev">◀</div>
    <div class="btn" id="play">▶</div>
    <div class="btn" id="next">▶▶</div>
  </div>
  <div class="title" id="title">—</div>
  <div class="toggles">
    <div class="toggle active" id="tgShuffle">Shuffle</div>
    <div class="toggle" id="tgAlbum">Album</div>
  </div>
  <audio id="gePlayer" preload="auto" playsinline></audio>
  <div class="miniRow">
    <input id="seek" class="range" type="range" min="0" max="100" value="0">
    <input id="vol"  class="range" type="range" min="0" max="1" step="0.02" value="0.9" style="width:90px">
  </div>
`;

toggle.onclick = ()=> mini.classList.toggle('show');

const q = sel=>mini.querySelector(sel);
const PLAYER=q('#gePlayer'), titleEl=q('#title'), prev=q('#prev'), play=q('#play'), next=q('#next');
const tgSh=q('#tgShuffle'), tgAl=q('#tgAlbum'), seek=q('#seek'), vol=q('#vol');

let PLAYLIST=[], idx=0, SHUFFLE=true, USER=false;
const shuffle=a=>{ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } };
const setTitle=u=>{
  try{
    const parts=u.split('/'); const fn=decodeURIComponent(parts.pop());
    const album=decodeURIComponent(parts.pop()).replace(/^Grand Element\s*-\s*\d{4}\s*-\s*/,'');
    const name=fn.replace(/\.[^.]+$/,'').replace(/^\s*\d+\s*[-_.]?\s*/,'').replace(/[_-]/g,' ');
    titleEl.textContent=`${album} · ${name}`;
  }catch{ titleEl.textContent='—'; }
};
function load(i=idx){ if(!PLAYLIST.length) return; idx=(i+PLAYLIST.length)%PLAYLIST.length;
  const src=PLAYLIST[idx]; if(PLAYER.src!==src){ PLAYER.src=src; PLAYER.load(); } setTitle(src);
  if(USER){ PLAYER.play().catch(()=>{}); play.textContent='❚❚'; }
}
function nxt(){ idx=(idx+1)%PLAYLIST.length; load(); }
function prv(){ idx=(idx-1+PLAYLIST.length)%PLAYLIST.length; load(); }

play.onclick=()=>{ USER=true; if(PLAYER.paused){ PLAYER.play().catch(()=>{}); play.textContent='❚❚'; } else { PLAYER.pause(); play.textContent='▶'; } };
next.onclick=()=>{ USER=true; nxt(); };
prev.onclick=()=>{ USER=true; prv(); };
tgSh.onclick=()=>{ SHUFFLE=true; tgSh.classList.add('active'); tgAl.classList.remove('active'); if(PLAYLIST.length){ PLAYLIST=[...PLAYLIST].sort(); shuffle(PLAYLIST); load(0);} };
tgAl.onclick=()=>{ SHUFFLE=false; tgAl.classList.add('active'); tgSh.classList.remove('active'); load(0); };
vol.oninput=()=>{ PLAYER.volume=+vol.value||0.9 };
PLAYER.addEventListener('timeupdate',()=>{ if(PLAYER.duration) seek.value=((PLAYER.currentTime/PLAYER.duration)*100)|0; });
seek.oninput=()=>{ if(PLAYER.duration) PLAYER.currentTime=(seek.value/100)*PLAYER.duration; };
PLAYER.addEventListener('ended',nxt);
PLAYER.addEventListener('error',nxt);
function unmute(){ PLAYER.muted=false; USER=true; if(PLAYER.paused) PLAYER.play().catch(()=>{}); removeEventListener('pointerdown',unmute,{capture:true}); }
addEventListener('pointerdown',unmute,{capture:true,once:true});

// load playlist (playlist.txt → fallback scan)
(async function init(){
  try{
    const r=await fetch(C.playlistTxt);
    if(r.ok){
      const t=await r.text();
      let items=t.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
        .map(n=>n.startsWith('http')?n:`${C.radioBase}music/${encodeURIComponent(n)}`);
      if(items.length){ if(SHUFFLE) shuffle(items); PLAYLIST=items; load(0); return; }
    }
  }catch{}
  try{
    const r=await fetch('https://api.github.com/repos/grandelement/radio/git/trees/main?recursive=1',{headers:{'Accept':'application/vnd.github+json'}});
    if(!r.ok) throw 0; const data=await r.json();
    let items=(data.tree||[]).filter(n=>n.type==='blob' && /\.mp3$/i.test(n.path)).map(n=>`${C.radioBase}${encodeURI(n.path)}`);
    if(items.length){ if(SHUFFLE) shuffle(items); PLAYLIST=items; load(0); return; }
  }catch{}
  titleEl.textContent='No music found';
})();
