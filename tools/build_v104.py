from pathlib import Path
import re

src = Path('index.html')
out = Path('GE-index-v10.4-NO-PREVIEW.txt')
html = src.read_text(encoding='utf-8')
if len(html) < 150000:
    raise SystemExit(f'Refusing to patch unexpectedly small index: {len(html)} bytes')

CSS = r'''
/* =========================================================
   GE STUDIOS GAME v10.4 — stabilization layer
   Built against the 199,903-byte current index.
   ========================================================= */
#gameTrails{display:none!important}
#gameTrailsV104,#gameTrailFadeV104{
  position:fixed;inset:0;width:100%;height:100%;display:none;pointer-events:none;
  z-index:2;mix-blend-mode:screen;transform-origin:50% 50%;
  animation:geV104TrailBreathe 5.6s ease-in-out infinite;
}
body.game-mode-active #gameTrailsV104,
body.game-mode-active #gameTrailFadeV104{display:block}
@keyframes geV104TrailBreathe{
  0%,100%{transform:translate3d(-.3px,.15px,0) scale(1.0002);opacity:.94}
  50%{transform:translate3d(.5px,-.35px,0) scale(1.0007);opacity:1}
}
#gameTrailFadeV104{opacity:0;transition:opacity 3000ms ease}

#gameScoreBubblesV104{position:fixed;inset:0;z-index:72;pointer-events:none;display:none}
body.game-mode-active #gameScoreBubblesV104{display:block}
.geScoreBubbleV104{
  position:fixed;box-sizing:border-box;min-width:58px;min-height:58px;max-width:min(128px,38vw);
  padding:7px 11px;border-radius:999px;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center;line-height:1.02;color:#f5fbff;background:rgba(7,18,34,.72);
  border:2px solid rgba(164,226,255,.88);box-shadow:0 0 11px rgba(93,195,255,.74),inset 0 0 12px rgba(120,210,255,.12);
  text-shadow:0 1px 4px #000;transform:translate(-50%,-50%);overflow:visible;
}
.geScoreBubbleV104.geBank{border-color:#9ee9ff}.geScoreBubbleV104.gePlanet{border-color:#ffd87a}.geScoreBubbleV104.geSun{border-color:#d9f4ff}
.geScoreBubbleV104.geAnimated{animation:geV104BubbleIn .34s cubic-bezier(.2,.8,.2,1),geV104BubbleGlow 1.5s ease-in-out infinite alternate}
.geScoreBubbleV104.geLeaving{animation:geV104BubbleOut .46s ease forwards!important}
.geScoreBubbleValue{font-size:clamp(16px,4.2vw,22px);font-weight:1000;letter-spacing:.015em;white-space:normal;overflow-wrap:anywhere}
.geScoreBubbleType{margin-top:3px;font-size:clamp(8px,2vw,10px);font-weight:900;letter-spacing:.09em;opacity:.82;white-space:nowrap}
@keyframes geV104BubbleIn{0%{opacity:0;transform:translate(-50%,-50%) scale(.55)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes geV104BubbleGlow{to{box-shadow:0 0 19px rgba(115,215,255,.94),inset 0 0 16px rgba(140,220,255,.18)}}
@keyframes geV104BubbleOut{to{opacity:0;transform:translate(-50%,-50%) scale(.72)}}

.geV104TracerSettings{grid-column:1/-1;display:grid;grid-template-columns:1fr;gap:6px;padding:9px 10px;border:1px solid rgba(150,195,235,.22);border-radius:10px;background:rgba(7,16,29,.38)}
.geV104TracerSettings label{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(128px,46%)!important;gap:10px!important;align-items:center!important;margin:0!important}
.geV104TracerSettings select{width:100%;min-width:0;background:#07101e;color:#eaf4ff;border:1px solid rgba(180,220,255,.38);border-radius:8px;padding:7px;font-weight:800}
.geV104TracerHelp{font-size:9px;line-height:1.35;opacity:.72}

/* Equal/proportional Soul allocation. */
#gameHUD{--ge-v104-souls:1}
@media (orientation:portrait){
  #gameScoreCluster{display:grid!important;grid-template-columns:repeat(var(--ge-v104-souls),minmax(0,1fr))!important;gap:clamp(2px,.9vw,7px)!important;width:100%!important;overflow:hidden!important;padding:2px 0!important;justify-content:stretch!important}
  #gameScoreCluster .playerScoreItem{min-width:0!important;width:100%!important;max-width:none!important;justify-content:center!important;gap:clamp(2px,.65vw,5px)!important;padding:0!important}
  #gameScoreCluster .playerDot{width:clamp(28px,8.2vw,42px)!important;height:clamp(28px,8.2vw,42px)!important;min-width:clamp(28px,8.2vw,42px)!important;font-size:clamp(9px,2.8vw,13px)!important}
  #gameScoreCluster .playerScoreLabel{font-size:clamp(7px,2vw,10px)!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-align:center!important}
  #gameScoreCluster .turnDots{max-width:100%!important}
}
@media (orientation:landscape){
  #gameScoreCluster{display:grid!important;grid-template-columns:1fr!important;grid-template-rows:repeat(var(--ge-v104-souls),minmax(0,1fr))!important;gap:clamp(2px,1vh,6px)!important;overflow:hidden!important;width:100%!important}
  #gameScoreCluster .playerScoreItem{min-width:0!important;min-height:0!important;width:100%!important;justify-content:center!important;gap:3px!important}
  #gameScoreCluster .playerDot{width:clamp(25px,5.4vh,36px)!important;height:clamp(25px,5.4vh,36px)!important;min-width:clamp(25px,5.4vh,36px)!important;font-size:clamp(8px,2.4vh,12px)!important}
  #gameScoreCluster .playerScoreLabel{font-size:clamp(7px,1.7vh,9px)!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
}
@media (max-width:380px) and (orientation:portrait){
  #gameScoreCluster .playerDot{width:clamp(25px,7.6vw,32px)!important;height:clamp(25px,7.6vw,32px)!important;min-width:clamp(25px,7.6vw,32px)!important}
  #gameScoreCluster .playerScoreLabel{font-size:clamp(6px,1.85vw,8px)!important}
}
'''

JS = r'''
/* =========================================================
   GE STUDIOS GAME v10.4 — authoritative stabilization layer
   ========================================================= */
(function GE_V104(){
  'use strict';
  const $=id=>document.getElementById(id);
  const game=window.GE_GAME;
  if(!game||!game.state){console.error('GE v10.4: GE_GAME unavailable');return;}
  const state=game.state;

  /* ---------- shared playable rectangle ---------- */
  function playBounds(){
    let left=0,top=0,right=innerWidth,bottom=innerHeight;
    const hud=$('gameHUD'),dock=$('gameMusicDock');
    const landscape=matchMedia('(orientation: landscape)').matches;
    if(document.body.classList.contains('game-mode-active')){
      const hr=hud?.getBoundingClientRect(),dr=dock?.getBoundingClientRect();
      if(landscape){
        if(hr&&hr.width>0)left=Math.max(left,hr.right);
        if(dr&&dr.width>0)right=Math.min(right,dr.left);
      }else{
        if(hr&&hr.height>0)top=Math.max(top,hr.bottom);
        if(dr&&dr.height>0)bottom=Math.min(bottom,dr.top);
      }
    }
    if(right-left<80){left=0;right=innerWidth}
    if(bottom-top<80){top=0;bottom=innerHeight}
    return{left,top,right,bottom,width:right-left,height:bottom-top};
  }
  window.GE_V104_PLAY_BOUNDS=playBounds;

  /* ---------- bigger score bubbles, FULLY inside the field ---------- */
  const oldMarks=window.GE_GAME_POINT_MARKS;
  try{oldMarks?.clear?.()}catch(_e){}
  const bubbleLayer=document.createElement('div');
  bubbleLayer.id='gameScoreBubblesV104';document.body.appendChild(bubbleLayer);
  let bubblesVisible=state.pointMarks!==false,bubblesAnimated=state.scoreFx!==false;
  function clampBubble(el,x,y){
    const b=playBounds();
    el.style.visibility='hidden';el.style.left='0px';el.style.top='0px';
    const w=Math.max(58,el.offsetWidth||58),h=Math.max(58,el.offsetHeight||58),pad=7;
    const cx=Math.max(b.left+w/2+pad,Math.min(b.right-w/2-pad,x));
    const cy=Math.max(b.top+h/2+pad,Math.min(b.bottom-h/2-pad,y));
    el.style.left=cx+'px';el.style.top=cy+'px';el.style.visibility='visible';
  }
  function addBubble(type,x,y,label='+1'){
    if(!bubblesVisible||!Number.isFinite(x)||!Number.isFinite(y))return null;
    const t=String(type||'POINT').toUpperCase();
    const el=document.createElement('div');
    el.className='geScoreBubbleV104 '+(t==='BANK'?'geBank':t==='PLANET'?'gePlanet':t.includes('SUN')?'geSun':'')+(bubblesAnimated?' geAnimated':'');
    const val=document.createElement('div');val.className='geScoreBubbleValue';val.textContent=String(label||'+1');
    const typ=document.createElement('div');typ.className='geScoreBubbleType';typ.textContent=t;
    el.append(val,typ);bubbleLayer.appendChild(el);clampBubble(el,x,y);return el;
  }
  function clearBubbles(immediate=false){
    const els=[...bubbleLayer.children];
    if(immediate){els.forEach(e=>e.remove());return}
    els.forEach(e=>e.classList.add('geLeaving'));
    setTimeout(()=>els.forEach(e=>e.remove()),480);
  }
  window.GE_GAME_POINT_MARKS={
    add:addBubble,clear:()=>clearBubbles(true),
    setVisible:v=>{bubblesVisible=!!v;bubbleLayer.style.visibility=bubblesVisible?'visible':'hidden'},
    setAnimated:v=>{bubblesAnimated=!!v},getVisible:()=>bubblesVisible,
    endThrow:()=>clearBubbles(false)
  };

  /* ---------- tracer manager ---------- */
  const oldTrail=$('gameTrails');if(oldTrail)oldTrail.style.setProperty('display','none','important');
  const trail=document.createElement('canvas');trail.id='gameTrailsV104';document.body.appendChild(trail);
  const fade=document.createElement('canvas');fade.id='gameTrailFadeV104';document.body.appendChild(fade);
  const tg=trail.getContext('2d'),fg=fade.getContext('2d');
  let dpr=1,w=0,h=0,trailVisible=state.tracers!==false,segments=[],last=new WeakMap(),fadeTimer=0;
  const albumPalette={trio:'#7ed7ff',live:'#ff8fce','sessions i':'#a994ff','sessions ii':'#77e7c4',intergy:'#54c9ff',love:'#ff78af',soul:'#ffd46f',spirit:'#b695ff',fire:'#ff704f'};
  function fitTrails(){
    dpr=Math.min(2,devicePixelRatio||1);w=innerWidth;h=innerHeight;
    for(const c of [trail,fade]){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c.style.width=w+'px';c.style.height=h+'px'}
    tg.setTransform(dpr,0,0,dpr,0,0);fg.setTransform(dpr,0,0,dpr,0,0);last=new WeakMap();
  }
  function pColor(p){
    const n=String(p?.el?.dataset?.album||p?.el?.title||'').toLowerCase().replace(/!/g,'').trim();
    return albumPalette[n]||'#91dcff';
  }
  function drawTrails(now){
    tg.clearRect(0,0,w,h);
    for(const s of segments){
      if(s.fadeAt){const q=(now-s.fadeAt)/3000;if(q>=1)continue;s.alpha=1-q}else s.alpha=1;
      const wob=Math.sin(now/690+s.seed)*.55;
      tg.globalAlpha=.20+.60*s.alpha;tg.strokeStyle=s.color;tg.lineWidth=2.1;tg.shadowColor=s.color;tg.shadowBlur=5;
      tg.beginPath();tg.moveTo(s.x1,s.y1+wob);tg.lineTo(s.x2,s.y2-wob);tg.stroke();
    }
    tg.globalAlpha=1;tg.shadowBlur=0;
    segments=segments.filter(s=>!s.fadeAt||(now-s.fadeAt)<3000);
  }
  function fadeAll(){const now=performance.now();for(const s of segments)if(!s.fadeAt)s.fadeAt=now}
  function clearTrails(){segments.length=0;last=new WeakMap();tg.clearRect(0,0,w,h);fg.clearRect(0,0,w,h);fade.style.opacity='0'}
  function trailTick(now){
    const active=document.body.classList.contains('game-mode-active')&&window.GE_V104_SHOT?.active;
    if(active&&trailVisible&&Array.isArray(window.planetNodes)){
      for(const p of window.planetNodes){
        const prev=last.get(p),speed=Math.hypot(Number(p.vx)||0,Number(p.vy)||0);
        if(prev&&speed>.8){
          const dist=Math.hypot(p.x-prev.x,p.y-prev.y);
          if(dist>.3&&dist<140){segments.push({x1:prev.x,y1:prev.y,x2:p.x,y2:p.y,color:pColor(p),seed:Math.random()*6.28,fadeAt:0,alpha:1});if(segments.length>12000)segments.splice(0,segments.length-10000)}
        }
        last.set(p,{x:p.x,y:p.y});
      }
    }else if(!active){last=new WeakMap()}
    drawTrails(now);requestAnimationFrame(trailTick);
  }
  fitTrails();addEventListener('resize',fitTrails,{passive:true});
  window.GE_GAME_TRAILS={clear:clearTrails,setVisible:v=>{trailVisible=!!v;trail.style.visibility=trailVisible?'visible':'hidden';fade.style.visibility=trailVisible?'visible':'hidden'},getVisible:()=>trailVisible,fadeAll};
  window.GE_CLEAR_GAME_TRAILS=clearTrails;
  requestAnimationFrame(trailTick);

  /* ---------- visible tracer lifetime selector ---------- */
  const lifetimeKey='GE_GAME_TRACER_LIFETIME_V104';
  let tracerLifetime=localStorage.getItem(lifetimeKey)||'throw';
  if(!['throw','turn','round','game'].includes(tracerLifetime))tracerLifetime='throw';
  const tracerToggle=$('optTracers');
  if(tracerToggle){
    const holder=document.createElement('div');holder.className='geV104TracerSettings';
    holder.innerHTML='<label><span>Tracer duration</span><select id="optTracerLifetimeV104"><option value="throw">Per Throw</option><option value="turn">Per Soul Turn</option><option value="round">Per Round</option><option value="game">Per Game</option></select></label><div class="geV104TracerHelp">Per Throw is the default: the completed shot fades for 3 seconds. Soul Turn keeps that Soul’s complete set; Round keeps everybody’s set; Game keeps everything until Exit/New Game.</div>';
    tracerToggle.closest('label')?.insertAdjacentElement('afterend',holder);
    const sel=$('optTracerLifetimeV104');sel.value=tracerLifetime;
    sel.addEventListener('change',()=>{tracerLifetime=sel.value;localStorage.setItem(lifetimeKey,tracerLifetime)});
  }

  /* ---------- authoritative shot lifecycle ---------- */
  const rawRegister=game.registerThrow.bind(game);
  const shot={active:false,planet:null,shooter:0,scoreBefore:0,startedAt:0,settledFrames:0};
  window.GE_V104_SHOT=shot;
  const launchMin=85,slowBrakeAt=72,snapAt=8;
  function armShot(p){
    let ps=state.planetState.get(p)||{vx:p.vx||0,vy:p.vy||0,banks:0,inSun:false,lastBank:0};
    ps.owner=state.activePlayer;ps.banks=0;ps.inSun=false;ps.scored=false;ps.armed=true;ps.contactedTargets=new Set();state.planetState.set(p,ps);
  }
  function beginShot(p){
    if(!state.active||!state.running||state.players===0||!p||shot.active)return;
    const speed=Math.hypot(Number(p.vx)||0,Number(p.vy)||0);
    if(speed<launchMin){if(speed<snapAt*2){p.vx=0;p.vy=0}return}
    shot.active=true;shot.planet=p;shot.shooter=state.activePlayer;shot.scoreBefore=Number(state.scores?.[shot.shooter])||0;shot.startedAt=performance.now();shot.settledFrames=0;
    armShot(p);last=new WeakMap();
  }
  game.registerThrow=beginShot;

  /* Do not let a moving table be grabbed accidentally. */
  document.addEventListener('pointerdown',e=>{
    if(!shot.active)return;
    const planet=e.target?.closest?.('.planet');if(!planet)return;
    e.preventDefault();e.stopImmediatePropagation();
  },true);

  function endShot(){
    const shooter=shot.shooter,beforePlayer=state.activePlayer,beforeProgress=(state.turnProgress?.[shooter]||0);
    const points=Math.max(0,(Number(state.scores?.[shooter])||0)-shot.scoreBefore);
    window.GE_GAME_POINT_MARKS?.endThrow?.();
    if(tracerLifetime==='throw')window.GE_GAME_TRAILS?.fadeAll?.();
    if(points>0){
      rawRegister(shot.planet);
      const afterPlayer=state.activePlayer,afterProgress=(state.turnProgress?.[afterPlayer]||0);
      const soulTurnEnded=(afterPlayer!==beforePlayer)||(state.players===1&&beforeProgress>=state.turnsPerPlayer-1&&afterProgress===0);
      const roundEnded=(state.players>1&&afterPlayer===0&&beforePlayer!==0)||(state.players===1&&soulTurnEnded);
      if(tracerLifetime==='turn'&&soulTurnEnded)window.GE_GAME_TRAILS?.fadeAll?.();
      if(tracerLifetime==='round'&&roundEnded)window.GE_GAME_TRAILS?.fadeAll?.();
    }else{
      try{const ps=state.planetState.get(shot.planet);if(ps){ps.armed=false;ps.owner=state.activePlayer}}catch(_e){}
      if(typeof window.GE_GAME?.saveGameStateNow==='function')window.GE_GAME.saveGameStateNow();
      const n=$('gameNotice');if(n){n.textContent='NO POINTS — THROW NOT USED';n.classList.add('show');setTimeout(()=>n.classList.remove('show'),1100)}
    }
    shot.active=false;shot.planet=null;shot.settledFrames=0;
  }
  function shotTick(){
    if(shot.active&&Array.isArray(window.planetNodes)){
      let max=0,dragging=false;
      for(const p of window.planetNodes){
        if(p.dragging){dragging=true;continue}
        let sp=Math.hypot(Number(p.vx)||0,Number(p.vy)||0);
        if(sp<slowBrakeAt&&sp>snapAt){p.vx*=.865;p.vy*=.865;sp=Math.hypot(p.vx||0,p.vy||0)}
        if(sp<=snapAt){p.vx=0;p.vy=0;sp=0}
        max=Math.max(max,sp);
      }
      if(!dragging&&max===0&&performance.now()-shot.startedAt>160)shot.settledFrames++;else shot.settledFrames=0;
      if(shot.settledFrames>=5)endShot();
    }
    requestAnimationFrame(shotTick);
  }
  requestAnimationFrame(shotTick);

  /* ---------- equal player slots ---------- */
  function syncSoulGrid(){const n=Math.max(1,Math.min(6,Number(state.players)||1));$('gameHUD')?.style.setProperty('--ge-v104-souls',String(n))}
  syncSoulGrid();setInterval(()=>{if(document.body.classList.contains('game-mode-active'))syncSoulGrid()},300);

  /* ---------- HARD EXIT: no resurrection, no second confirmation ---------- */
  function hardExit(ev){
    ev?.preventDefault?.();ev?.stopImmediatePropagation?.();
    if(!confirm('Exit Game Mode?'))return;
    shot.active=false;state.active=false;state.running=false;state.completed=false;
    try{localStorage.removeItem(window.GE_EASY_SETTINGS?.GAME_STATE_KEY||'GE_GAME_STATE_V9')}catch(_e){}
    try{localStorage.removeItem('GE_GAME_STATE_V9')}catch(_e){}
    try{window.GE_GAME_TRAILS?.clear?.();window.GE_GAME_POINT_MARKS?.clear?.()}catch(_e){}
    document.body.classList.remove('game-mode-active');
    const hud=$('gameHUD');hud?.classList.remove('show');hud?.setAttribute('aria-hidden','true');
    ['gameOptionsPanel','playerOptionsPanel','roundPrompt','gamePrompt','gameNotice','scoreArchivePanel'].forEach(id=>$(id)?.classList.remove('show'));
    const bg=$('gameBackground');if(bg){bg.style.backgroundImage='none';bg.style.display='none'}
    requestAnimationFrame(()=>{try{window.placePlanets?.();window.buildPlanetPhysics?.()}catch(_e){}});
  }
  for(const id of ['gameExitBtn','gameExitTopBtn'])$(id)?.addEventListener('click',hardExit,true);
  $('gameNewBtn')?.addEventListener('click',()=>{clearTrails();clearBubbles(true)},true);

  /* ---------- authoritative music controller ---------- */
  (function installMusicV104(){
    const audio=$('gePlayer');if(!audio)return;
    const ORDER=['Trio','Live','Sessions I','Sessions II','Intergy','Love','Soul','Spirit','Fire'];
    const key=s=>String(s||'').toLowerCase().replace(/!/g,'').replace(/[^a-z0-9]/g,'');
    const rank=new Map(ORDER.map((n,i)=>[key(n),i]));
    let catalog=[],eligible=[],idx=0,shuffle=window.GE_MUSIC_CONTROLLER?.getShuffle?.()??true,history=[],hist=-1,ready=false;
    function parse(path){
      const clean=decodeURIComponent(String(path||'')).replace(/^website\//,'').replace(/^\/+/, '');
      if(!/\.(mp3|m4a|wav)$/i.test(clean)||!clean.includes('ge-music/music/'))return null;
      const parts=clean.split('/'),mi=parts.findIndex((p,i)=>p==='music'&&parts[i-1]==='ge-music');if(mi<0||!parts[mi+1])return null;
      let album=parts[mi+1].replace(/^Grand Element\s*-\s*\d{4}\s*-\s*/i,'').replace(/^Grand Element\s*-\s*/i,'').trim();
      if(!rank.has(key(album)))return null;
      const file=parts.at(-1),m=file.match(/_(\d{1,3})(?:_|\b)/)||file.match(/^\s*(\d{1,3})/),trackNum=m?Number(m[1]):9999;
      const title=file.replace(/\.[^.]+$/,'').replace(/^.*?_\d{1,3}_/,'').replace(/_/g,' ').trim();
      return{path:clean,url:new URL(encodeURI(clean),location.href).href,album,trackNum,title};
    }
    function selected(){const names=window.GE_MUSIC_ALBUM_CONFIG?.getSelected?.()||['Intergy','Love','Soul','Spirit','Fire'];return new Set(names.map(key))}
    function rebuild(keep=audio.currentSrc||audio.src||''){
      const s=selected();eligible=catalog.filter(t=>s.has(key(t.album)));
      const found=eligible.findIndex(t=>t.url===keep||decodeURI(t.url)===decodeURI(keep));idx=found>=0?found:Math.min(idx,Math.max(0,eligible.length-1));syncMode();
    }
    function current(){return eligible[idx]||null}
    function setTitle(t){const np=$('nowPlaying');if(np)np.textContent=t?`${t.album} · ${String(t.trackNum).padStart(2,'0')} · ${t.title}`:'—'}
    async function playIndex(n,remember=true){
      if(!eligible.length)return;idx=(n+eligible.length)%eligible.length;const t=current();
      if(audio.currentSrc!==t.url&&audio.src!==t.url)audio.src=t.url;setTitle(t);
      if(remember&&shuffle){if(hist<history.length-1)history=history.slice(0,hist+1);if(history.at(-1)!==t.url)history.push(t.url);hist=history.length-1}
      try{await audio.play()}catch(_e){}
    }
    function randomIndex(){if(eligible.length<2)return 0;let n=idx;for(let i=0;i<8&&n===idx;i++)n=(Math.random()*eligible.length)|0;return n}
    function next(){if(!eligible.length)return;if(shuffle&&hist>=0&&hist<history.length-1){hist++;const n=eligible.findIndex(t=>t.url===history[hist]);if(n>=0)return playIndex(n,false)}return playIndex(shuffle?randomIndex():idx+1,true)}
    function prev(){if(!eligible.length)return;if(shuffle&&hist>0){hist--;const n=eligible.findIndex(t=>t.url===history[hist]);if(n>=0)return playIndex(n,false)}return playIndex(idx-1,false)}
    function setShuffle(v){shuffle=!!v;syncMode();return shuffle}
    function syncMode(){
      $('tgShuffle')?.classList.toggle('active',shuffle);$('tgAlbum')?.classList.toggle('active',!shuffle);
      const b=$('gameMusicMode');if(b){b.textContent=shuffle?'SHUFFLE':'ALBUM';b.classList.toggle('albumMode',!shuffle)}
    }
    const ctl={
      playPause:()=>{if(audio.paused){if(!audio.src&&eligible.length)return playIndex(idx,true);return audio.play().catch(()=>{})}audio.pause()},
      next,prev,setShuffle,getShuffle:()=>shuffle,
      refreshAlbums:()=>{const wasPlaying=!audio.paused,keep=audio.currentSrc||audio.src;rebuild(keep);if(wasPlaying&&eligible.length&&!eligible.some(t=>t.url===keep))playIndex(idx,true)},
      volumeDelta:d=>{const v=Math.max(0,Math.min(1,(audio.volume||0)+Number(d||0)));audio.volume=v;const vol=$('vol');if(vol)vol.value=String(v);return v},
      selectTrackNumber:n=>{const c=current();if(!c)return false;const k=key(c.album),found=eligible.findIndex(t=>key(t.album)===k&&t.trackNum===Number(n));if(found<0)return false;playIndex(found,true);return true},
      getCurrent:current
    };
    window.GE_MUSIC_CONTROLLER=ctl;
    $('prev')&&( $('prev').onclick=()=>ctl.prev() );$('next')&&( $('next').onclick=()=>ctl.next() );$('play')&&( $('play').onclick=()=>ctl.playPause() );
    $('tgShuffle')&&( $('tgShuffle').onclick=()=>ctl.setShuffle(true) );$('tgAlbum')&&( $('tgAlbum').onclick=()=>ctl.setShuffle(false) );
    audio.addEventListener('error',e=>{e.stopImmediatePropagation();setTimeout(()=>ctl.next(),80)},true);
    fetch(new URL('radio/manifest.json',location.href),{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('manifest '+r.status))).then(j=>{
      const files=Array.isArray(j)?j:(Array.isArray(j?.files)?j.files:[]);catalog=files.map(parse).filter(Boolean).sort((a,b)=>(rank.get(key(a.album))-rank.get(key(b.album)))||(a.trackNum-b.trackNum)||a.path.localeCompare(b.path));
      rebuild();ready=true;const keep=audio.currentSrc||audio.src;if(!keep&&eligible.length)setTitle(current());syncMode();
    }).catch(err=>console.error('GE v10.4 music manifest:',err));
  })();
})();
'''

if 'GE STUDIOS GAME v10.4 — stabilization layer' in html:
    raise SystemExit('v10.4 layer already present')
html = html.replace('</head>', '<style id="ge-v104-style">\n'+CSS+'\n</style>\n</head>', 1)
html = html.replace('</body>', '<script>\n'+JS+'\n</script>\n</body>', 1)
out.write_text(html, encoding='utf-8')
print(out, len(html))
