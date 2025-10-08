/* ===== helpers ===== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a,b)=>Math.random()*(b-a)+a;
const choice = a => a[(Math.random()*a.length)|0];

/* ===== background (no stretch) + list from data/backgrounds.json ===== */
const BG = { list:[], i:0,
  set(i){
    if(!this.list.length) return;
    this.i = (i + this.list.length) % this.list.length;
    document.body.style.backgroundImage =
      `url("${this.list[this.i]}"), radial-gradient(closest-side,#fff 1px,rgba(255,255,255,0) 1px)`;
    document.body.style.backgroundRepeat = 'repeat,repeat';
    document.body.style.backgroundPosition = 'center center,0 0';
    document.body.style.backgroundSize = 'auto 900px,3px 3px';
  },
  next(){ this.set(this.i+1); }
};
fetch('data/backgrounds.json')
  .then(r=>r.ok?r.json():{images:['images/GE stars.jpg']})
  .then(j=>{ BG.list=j.images||['images/GE stars.jpg']; BG.set(0); });

/* ===== about ===== */
$('#aboutBtn').addEventListener('click', ()=> $('#about').classList.add('show'));
$('#about').addEventListener('click', e=>{ if(e.target.id==='about') e.currentTarget.classList.remove('show'); });
addEventListener('keydown', e=>{ if(e.key==='Escape') $('#about').classList.remove('show'); });

/* ===== controls dock (below sun) ===== */
const openMini = $('#openMini'), mini=$('#mini');
openMini.addEventListener('click', ()=> mini.classList.toggle('show'));
document.addEventListener('click', e=>{
  if(!mini.contains(e.target) && e.target!==openMini) mini.classList.remove('show');
});

/* ===== moon orbit (upright, 60s) ===== */
const orbit = $('#orbit'), moon=$('#moon');
const ORBIT_SEC = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--orbit-seconds'))||60;
const PHASE0 = -Math.PI/2; let t0 = performance.now()/1000;
function orbitTick(){
  const t = performance.now()/1000;
  const ang = PHASE0 + ((t - t0)/ORBIT_SEC)*Math.PI*2;
  orbit.style.transform = `rotate(${ang}rad)`;
  moon.style.transform = `translate(var(--orbit-radius), -50%) rotate(${-ang}rad)`;
  moon.style.zIndex = (ang % (Math.PI*2) > Math.PI) ? 2 : 6;
  requestAnimationFrame(orbitTick);
}
requestAnimationFrame(orbitTick);
moon.addEventListener('click', ()=> window.open('https://grandelement.github.io/radio/','_blank','noopener'));

/* keep sun away from edge so orbit doesn't clip on small screens */
function nudgeSun(){
  const wrap = $('#sunWrap');
  const r = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--orbit-radius'))||160;
  wrap.style.left = Math.max(140, r + 90) + 'px';
}
addEventListener('resize', nudgeSun, {passive:true}); nudgeSun();

/* ===== hidden text (data/hidden.txt; comma OR newline) ===== */
const phrasesEl = $('#phrases');
let PHRASES=[];
fetch('data/hidden.txt')
  .then(r=>r.ok?r.text():'')
  .then(t=>{
    PHRASES = t.split(/[,\r?\n]/).map(s=>s.trim()).filter(Boolean);
    if(!PHRASES.length) PHRASES=['You are the GRAND ELEMENT','Open your eyes'];
    scatterPhrases();
  });
function scatterPhrases(){
  phrasesEl.innerHTML='';
  const n = Math.max(12, PHRASES.length||12);
  for(let i=0;i<n;i++){
    const el=document.createElement('div');
    el.className='phrase';
    el.textContent = PHRASES[i % PHRASES.length];
    el.style.left = (10 + Math.random()*(innerWidth-220)) + 'px';
    el.style.top  = (10 + Math.random()*(innerHeight-120)) + 'px';
    el.addEventListener('click', ()=> el.classList.toggle('pinned'));
    phrasesEl.appendChild(el);
  }
}
let mx=-9999,my=-9999;
addEventListener('mousemove',e=>{mx=e.clientX; my=e.clientY});
setInterval(()=>{
  const r=140;
  [...phrasesEl.children].forEach(el=>{
    if(el.classList.contains('pinned')){ el.classList.add('show'); return; }
    const rc=el.getBoundingClientRect();
    const d=Math.hypot(mx-rc.left, my-rc.top);
    if(d<r) el.classList.add('show'); else el.classList.remove('show');
  });
},60);

/* ===== planets (S curve; drag without opening) ===== */
const ALBUMS=[
  {t:"Fundamental Groove", c:"images/Grand Element - Fundamental Groove.jpg", l:"https://grandelement.bandcamp.com/album/fundamental-groove"},
  {t:"Trio", c:"images/Grand Element - Trio.jpg", l:"https://grandelement.bandcamp.com/album/trio"},
  {t:"Live!", c:"images/Grand Element - Live.jpg", l:"https://grandelement.bandcamp.com/album/live"},
  {t:"Sessions I", c:"images/Grand Element - Sessions I.jpg", l:"https://grandelement.bandcamp.com/album/sessions-i"},
  {t:"Sessions II", c:"images/Grand Element - Sessions II.jpg", l:"https://grandelement.bandcamp.com/album/sessions-ii"},
  {t:"Intergy", c:"images/Grand Element - Intergy.jpg", l:"https://grandelement.bandcamp.com/album/intergy"},
  {t:"Love", c:"images/Grand Element - Love.jpg", l:"https://grandelement.bandcamp.com/album/love"},
  {t:"Soul", c:"images/Grand Element - Soul.jpg", l:"https://grandelement.bandcamp.com/album/soul"},
  {t:"Spirit", c:"images/Grand Element - Spirit.jpg", l:"https://grandelement.bandcamp.com/album/spirit"},
  {t:"Fire", c:"images/Grand Element - Fire.jpg", l:"https://grandelement.bandcamp.com/album/fire"}
];
const planetsEl = $('#planets');
function placeSpiral(){
  planetsEl.innerHTML='';
  const w=innerWidth, h=innerHeight;
  const xC = w*0.56, yB=h*0.88, yT=h*0.14;
  const amp = Math.max(80, w*0.12);
  const waves = 1.2;
  ALBUMS.forEach((a,i)=>{
    const t=i/(ALBUMS.length-1);
    const y=yB - t*(yB-yT);
    const x=xC + amp*Math.sin((t*Math.PI*2*waves)-Math.PI/2);
    const el=document.createElement('a');
    el.className='planet'; el.style.left=x+'px'; el.style.top=y+'px';
    el.style.backgroundImage=`url("${a.c}")`;
    el.innerHTML=`<span class="label">${a.t}</span>`;
    el.href=a.l; el.target="_blank"; el.rel="noopener"; el.title=a.t;
    planetsEl.appendChild(el);

    // drag without triggering link
    let down=false,moved=false,sx=0,sy=0;
    el.addEventListener('pointerdown',e=>{
      down=true; moved=false; sx=e.clientX; sy=e.clientY;
      el.dataset.dx=parseFloat(el.style.left); el.dataset.dy=parseFloat(el.style.top);
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove',e=>{
      if(!down) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      if(Math.hypot(dx,dy)>3) moved=true;
      el.style.left=(+el.dataset.dx+dx)+'px';
      el.style.top=(+el.dataset.dy+dy)+'px';
    });
    el.addEventListener('pointerup',e=>{
      el.releasePointerCapture(e.pointerId); down=false;
      if(!moved){ window.open(a.l,'_blank','noopener'); }
    });
  });
}
placeSpiral();
addEventListener('resize', placeSpiral, {passive:true});

/* ===== music (radio-like) ===== */
const PLAYER = $('#gePlayer'), titleEl=$('#title');
const btnPrev=$('#prev'), btnPlay=$('#play'), btnNext=$('#next');
const tgShuffle=$('#tgShuffle'), tgAlbum=$('#tgAlbum');
let PLAYLIST=[], pIndex=0, SHUFFLE=true;

function formatAlbumTrack(url){
  try{
    const parts = decodeURIComponent(url).split('/');
    const file = parts.pop();           // e.g., "01 Daydream.mp3"
    const album = parts.pop();          // e.g., "Grand Element - 2006 - Trio"
    const cleanFile = file.replace(/\.[^/.]+$/,'').replace(/[_-]/g,' ').trim();
    const cleanAlbum = album.replace(/[_]/g,' ').trim();
    return `${cleanAlbum} • ${cleanFile}`;
  }catch{ return '—'; }
}
function setTitle(url){ titleEl.textContent = formatAlbumTrack(url); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } }
function loadAndPlay(){ if(!PLAYLIST.length) return; const src=PLAYLIST[pIndex]; PLAYER.src=src; setTitle(src); PLAYER.autoplay=true; PLAYER.muted=true; PLAYER.play().catch(()=>{}); btnPlay.textContent='❚❚'; }
function next(){ if(!PLAYLIST.length) return; pIndex=(pIndex+1)%PLAYLIST.length; loadAndPlay(); }
function prev(){ if(!PLAYLIST.length) return; pIndex=(pIndex-1+PLAYLIST.length)%PLAYLIST.length; loadAndPlay(); }

btnPlay.addEventListener('click', ()=>{ if(PLAYER.paused){ PLAYER.play().catch(()=>{}); btnPlay.textContent='❚❚'; } else { PLAYER.pause(); btnPlay.textContent='▶'; } });
btnNext.addEventListener('click', next);
btnPrev.addEventListener('click', prev);
tgShuffle.addEventListener('click', ()=>{ SHUFFLE=true; tgShuffle.classList.add('active'); tgAlbum.classList.remove('active'); if(PLAYLIST.length){ shuffle(PLAYLIST); pIndex=0; loadAndPlay(); }});
tgAlbum.addEventListener('click', ()=>{ SHUFFLE=false; tgAlbum.classList.add('active'); tgShuffle.classList.remove('active'); pIndex=0; loadAndPlay(); });

PLAYER.addEventListener('ended', next);
PLAYER.addEventListener('error', next);
PLAYER.addEventListener('canplay', ()=>{ if(PLAYER.paused) PLAYER.play().catch(()=>{}); });
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden && PLAYER.paused) PLAYER.play().catch(()=>{}); });
function unmuteOnce(){ PLAYER.muted=false; if(PLAYER.paused) PLAYER.play().catch(()=>{}); window.removeEventListener('pointerdown', unmuteOnce, {capture:true}); }
window.addEventListener('pointerdown', unmuteOnce, {capture:true, once:true});

// Point to your radio repo content (works now; can later swap to Cloudflare R2 URL)
const baseURL = 'https://grandelement.github.io/radio/music/';
fetch(baseURL + 'playlist.txt')
  .then(r=>r.ok?r.text():'')
  .then(t=>{
    let items = t.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)
      .map(name=> name.startsWith('http') ? name : baseURL + encodeURIComponent(name));
    if(!items.length){ items=[ baseURL+'Track01.mp3' ]; }
    if(SHUFFLE) shuffle(items);
    PLAYLIST=items; pIndex=0; loadAndPlay();
  });

/* ===== ships + comets (lite; teleport click still works) ===== */
const canvas=$('#fx'), ctx=canvas.getContext('2d');
let W=innerWidth,H=innerHeight; function resize(){ W=innerWidth; H=innerHeight; canvas.width=W; canvas.height=H; } addEventListener('resize',resize,{passive:true}); resize();

const cometImg=new Image(); cometImg.src='images/ge-logo 3.png';
const shipImg=new Image();  shipImg.src='images/ge-logo-4-cutout.png';

const COMET={sizes:[8,10,12,16,20], max:3, spawn:[4,9], speed:[60,160], trail:120, fade:1400, touch:28};

class Comet{ constructor(){ const e=choice(['l','r','t','b']),p=40; if(e==='l'){this.x=-p;this.y=rand(0,H);} if(e==='r'){this.x=W+p;this.y=rand(0,H);} if(e==='t'){this.x=rand(0,W);this.y=-p;} if(e==='b'){this.x=rand(0,W);this.y=H+p;} const tx=rand(W*.2,W*.8),ty=rand(H*.2,H*.8); const a=Math.atan2(ty-this.y,tx-this.x),s=rand(...COMET.speed); this.vx=Math.cos(a)*s; this.vy=Math.sin(a)*s; this.r=choice(COMET.sizes); this.trail=[]; this.state='fly'; this.dead=false; } step(dt){ if(this.state!=='fly'&&this.state!=='separate') return; this.x+=this.vx*dt; this.y+=this.vy*dt; this.trail.push([this.x,this.y,performance.now()]); if(this.trail.length>COMET.trail) this.trail.shift(); if(this.x<-90||this.x>W+90||this.y<-90||this.y>H+90) this.dead=true;} draw(){ for(const [tx,ty,ts] of this.trail){ const a=Math.max(0,1-(performance.now()-ts)/COMET.fade); if(a<=0) continue; ctx.globalAlpha=a*0.6; ctx.drawImage(cometImg,tx-this.r,ty-this.r,this.r*2,this.r*2);} ctx.globalAlpha=1; ctx.drawImage(cometImg,this.x-this.r,this.y-this.r,this.r*2,this.r*2);} }
class Pair{ constructor(a,b){ this.a=a; this.b=b; this.cx=(a.x+b.x)/2; this.cy=(a.y+b.y)/2; this.R=Math.max(18,Math.hypot(a.x-b.x)/2); this.theta=Math.atan2(a.y-this.cy,a.x-this.cx); this.omega=(Math.PI*2)/3; this.t=0; this.phase='orbit'; const va=Math.atan2(a.vy,a.vx),vb=Math.atan2(b.vy,b.vx),out=(va+vb)/2; this.outA=out; this.outB=out+Math.PI; this.sA=Math.hypot(a.vx,a.vy); this.sB=Math.hypot(b.vx,b.vy);} step(dt){ this.t+=dt; if(this.phase==='orbit'){ this.theta+=this.omega*dt; this.a.x=this.cx+Math.cos(this.theta)*this.R; this.a.y=this.cy+Math.sin(this.theta)*this.R; this.b.x=this.cx-Math.cos(this.theta)*this.R; this.b.y=this.cy-Math.sin(this.theta)*this.R; if(this.t>=3){ this.phase='pause'; this.t=0; } } else if(this.phase==='pause'){ if(this.t>=2.5){ this.phase='split'; this.a.vx=Math.cos(this.outA)*this.sA; this.a.vy=Math.sin(this.outA)*this.sA; this.b.vx=Math.cos(this.outB)*this.sB; this.b.vy=Math.sin(this.outB)*this.sB; this.a.state='separate'; this.b.state='separate'; } } else { this.dead=true; } } draw(){ if(this.phase!=='split'){ const g=ctx.createRadialGradient(this.cx,this.cy,2,this.cx,this.cy,this.R+12); g.addColorStop(0,'rgba(180,220,255,.25)'); g.addColorStop(1,'rgba(180,220,255,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(this.cx,this.cy,this.R+12,0,Math.PI*2); ctx.fill(); } } }
const MAX_SHIPS=4, SHIP_SCALES=[0.10,0.14,0.19,0.25,0.33], SHIP_ART_OFFSET=Math.PI;
class Ship{ constructor(){ const side=choice(['l','r','t','b']); this.s=choice(SHIP_SCALES); this.featured=Math.random()<0.12; if(this.featured) this.s=0.33; const pad=60; if(side==='l'){this.x=-pad;this.y=rand(0,H);this.vx=rand(80,220);this.vy=rand(-80,80);} if(side==='r'){this.x=W+pad;this.y=rand(0,H);this.vx=-rand(80,220);this.vy=rand(-80,80);} if(side==='t'){this.x=rand(0,W);this.y=-pad;this.vx=rand(-180,180);this.vy=rand(80,220);} if(side==='b'){this.x=rand(0,W);this.y=H+pad;this.vx=rand(-180,180);this.vy=-rand(80,220);} if(this.featured){ this.x=W+80; this.y=rand(H*.1,H*.9); this.vx=-80; this.vy=rand(-10,10); } this.ax=rand(-30,30); this.ay=rand(-30,30); this.curveT=rand(2,5); this.curveP=rand(0,Math.PI*2); this.dead=false; this.beam=0; } step(dt){ this.curveP+=dt/this.curveT; this.vx+=Math.sin(this.curveP)*18*dt + this.ax*dt*.2; this.vy+=Math.cos(this.curveP)*18*dt + this.ay*dt*.2; const v=Math.hypot(this.vx,this.vy), vmax=320; if(v>vmax){ this.vx*=vmax/v; this.vy*=vmax/v; } this.x+=this.vx*dt; this.y+=this.vy*dt; if(this.x<-140||this.x>W+140||this.y<-140||this.y>H+140) this.dead=true; this.maybeBeam(dt); } maybeBeam(dt){ let a=null,b=null,best=1e9; for(let i=0;i<comets.length;i++){ for(let j=i+1;j<comets.length;j++){ const c1=comets[i],c2=comets[j]; if(c1.state!=='fly'||c2.state!=='fly') continue; const mx=(c1.x+c2.x)/2, my=(c1.y+c2.y)/2; const ds=Math.hypot(this.x-mx,this.y-my); if(ds<220&&ds<best){best=ds; a=c1; b=c2;} } } if(a&&b){ this.beam=Math.min(3,this.beam+dt); const mx=(a.x+b.x)/2, my=(a.y+b.y)/2; [a,b].forEach(c=>{ const ang=Math.atan2(mx-c.x, my-c.y); c.vx += Math.sin(ang)*9*dt*60; c.vy += Math.cos(ang)*9*dt*60; }); } else { this.beam=Math.max(0,this.beam-dt); } } draw(){ if(!shipImg.complete) return; const ang=Math.atan2(this.vy,this.vx)+SHIP_ART_OFFSET; const w=shipImg.width*this.s, h=shipImg.height*this.s; ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(ang); const drawW=w*0.6, drawH=h*0.6; ctx.drawImage(shipImg,-drawW*0.3,-drawH*0.5,drawW,drawH); if(this.beam>0){ const len=160; ctx.strokeStyle='rgba(126,203,255,.9)'; ctx.lineWidth=2; ctx.beginPath(); for(let i=0;i<=len;i+=6){ const dy=Math.sin((i/len)*Math.PI*4 + performance.now()/250)*8; if(i===0) ctx.moveTo(10+i,dy); else ctx.lineTo(10+i,dy);} ctx.stroke(); } ctx.restore(); } }

const comets=[], pairs=[], ships=[];
let last=performance.now()/1000, cTimer=0, cNext=rand(4,9), shipTimer=0, shipNext=rand(6,12);

/* teleport click on ships */
let teleporting=false, teleportT=0, teleportShip=null;
const teleCap=$('#teleportCap');
function shipAt(x,y){
  let best=null, dBest=1e9;
  for(const s of ships){
    const r=(shipImg.width*s.s*0.3);
    const d=Math.hypot(x-s.x,y-s.y);
    if(d<r && d<dBest){ best=s; dBest=d; }
  }
  return best;
}
canvas.addEventListener('click',e=>{
  const r=canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
  const s=shipAt(mx,my); if(s) startTeleport(s);
});
function startTeleport(s){
  if(teleporting) return;
  teleporting=true; teleportT=0; teleportShip=s; teleCap.classList.add('show');
  ships.forEach(sh=>{ sh.vx*=0.2; sh.vy*=0.2; sh.ax=0; sh.ay=0; });
}
function drawTeleportBeams(alpha=1){
  if(!teleportShip) return;
  const src={x:teleportShip.x,y:teleportShip.y};
  const targets=[];
  $$('.planet').forEach(p=>{ const r=p.getBoundingClientRect(); targets.push({x:r.left+r.width/2,y:r.top+r.height/2}); });
  const sunR=$('#sun').getBoundingClientRect(); targets.push({x:sunR.left+sunR.width/2,y:sunR.top+sunR.height/2});
  const moonR=$('#moon').getBoundingClientRect(); targets.push({x:moonR.left+moonR.width/2,y:moonR.top+moonR.height/2});
  comets.forEach(c=>targets.push({x:c.x,y:c.y}));

  ctx.save(); ctx.globalAlpha=alpha; ctx.strokeStyle='rgba(120,200,255,0.95)'; ctx.lineWidth=2;
  for(const t of targets){
    ctx.beginPath();
    const dx=t.x-src.x, dy=t.y-src.y, L=Math.hypot(dx,dy), steps=Math.max(8,Math.min(40,(L/25)|0));
    const ax=dx/steps, ay=dy/steps;
    for(let i=0;i<=steps;i++){
      const px=src.x+ax*i, py=src.y+ay*i;
      const wiggle=Math.sin((i/steps)*Math.PI*4 + performance.now()/200)*8;
      const nx=-dy/L, ny=dx/L;
      const wx=px+nx*wiggle, wy=py+ny*wiggle;
      if(i===0) ctx.moveTo(wx,wy); else ctx.lineTo(wx,wy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function loop(){
  const now=performance.now()/1000, dt=Math.min(.05, now-last); last=now;
  cTimer+=dt; if(cTimer>cNext && comets.length<COMET.max){ comets.push(new Comet()); cTimer=0; cNext=rand(4,9); }
  shipTimer+=dt; if(shipTimer>shipNext){ shipTimer=0; shipNext=rand(6,14); if(ships.length<4) ships.push(new Ship()); }
  comets.forEach(c=>c.step(dt)); ships.forEach(s=>s.step(dt)); pairs.forEach(p=>p.step(dt));
  for(let i=0;i<comets.length;i++) for(let j=i+1;j<comets.length;j++){
    const a=comets[i],b=comets[j];
    if(a.state!=='fly'||b.state!=='fly') continue;
    if(Math.hypot(a.x-b.x,a.y-b.y) < COMET.touch){ a.state='pair'; b.state='pair'; pairs.push(new Pair(a,b)); }
  }
  for(let i=comets.length-1;i>=0;i--) if(comets[i].dead) comets.splice(i,1);
  for(let i=pairs.length-1;i>=0;i--) if(pairs[i].dead) pairs.splice(i,1);
  for(let i=ships.length-1;i>=0;i--) if(ships[i].dead) ships.splice(i,1);

  ctx.clearRect(0,0,W,H);
  pairs.forEach(p=>p.draw()); comets.forEach(c=>c.draw()); ships.forEach(s=>s.draw());

  if(teleporting){
    teleportT+=dt;
    const A=Math.min(1, teleportT/1.5);           // wind up
    drawTeleportBeams(A);
    if(teleportT>1.5 && teleportT<2.6) drawTeleportBeams(1); // pulse
    if(teleportT>=2.6 && teleportT<2.8){ if(Math.abs(teleportT-2.6)<dt*1.5) BG.next(); }
    if(teleportT>=2.8 && teleportT<3.2){ const k=1-(teleportT-2.8)/0.4; drawTeleportBeams(Math.max(0,k)); }
    if(teleportT>=3.2){ teleporting=false; teleportShip=null; $('#teleportCap').classList.remove('show'); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
