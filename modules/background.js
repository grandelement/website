// background.js — starfield + ships (subtle)
(function(){
  const { bgCtx:ctx } = GE_CANVAS;
  const STAR_COUNT=1500, LINK_RADIUS=32, MAX_LINKS=1, GRID=64;
  const stars = Array.from({length:STAR_COUNT}, ()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,vx:(Math.random()-.5)*0.05,vy:(Math.random()-.5)*0.05,r:Math.random()*1.1+0.2}));
  const ships = Array.from({length:10}, ()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,vx:(Math.random()-.5)*0.12,vy:(Math.random()-.5)*0.12,size:6}));
  window.GE_BG={ships};

  function buildGrid(){ const cols=Math.ceil(innerWidth/GRID), rows=Math.ceil(innerHeight/GRID), g=Array.from({length:cols*rows},()=>[]);
    for(let i=0;i<stars.length;i++){ const s=stars[i]; let cx=(s.x/GRID)|0, cy=(s.y/GRID)|0; cx=Math.max(0,Math.min(cols-1,cx)); cy=Math.max(0,Math.min(rows-1,cy)); g[cx+cy*cols].push(i); }
    return {g,cols,rows};
  }

// modules/app.js
(function(){
  const fxLayer = GE_CANVAS.fx;
  fxLayer.addEventListener('click', e=>{
    const ships = (window.GE_BG && GE_BG.ships) || [];
    let closest=null, best=24;
    for(const s of ships){
      const d = Math.hypot(s.x-e.clientX, s.y-e.clientY);
      if(d<best){ best=d; closest=s; }
    }
    if(closest && window.GE_FX) GE_FX.nextFrom(closest.x, closest.y);
  });
  if (window.GE_ENV?.mark) GE_ENV.mark('app.js','wired ship click → bg change');
})();

  function loop(){
    ctx.clearRect(0,0,innerWidth,innerHeight);
    // stars
    ctx.globalAlpha=0.9; ctx.fillStyle='#cfe9ff';
    ctx.beginPath(); for(const s of stars){ s.x+=s.vx; s.y+=s.vy; if(s.x<0)s.x+=innerWidth; if(s.x>innerWidth)s.x-=innerWidth; if(s.y<0)s.y+=innerHeight; if(s.y>innerHeight)s.y-=innerHeight; ctx.moveTo(s.x+s.r,s.y); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);} ctx.fill();
    // links (very faint)
    const {g,cols,rows}=buildGrid(); ctx.globalAlpha=0.18; ctx.lineWidth=1; ctx.strokeStyle='#9ec8ff';
    for(let cx=0;cx<cols;cx++)for(let cy=0;cy<rows;cy++){ const cell=g[cx+cy*cols]; if(!cell.length) continue;
      const neigh=[]; for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){ const nx=cx+dx,ny=cy+dy; if(nx<0||ny<0||nx>=cols||ny>=rows) continue; neigh.push(...g[nx+ny*cols]); }
      for(const i of cell){ const a=stars[i]; let links=0; for(const j of neigh){ if(i===j) continue; const b=stars[j]; const dx=a.x-b.x,dy=a.y-b.y; if(dx*dx+dy*dy<LINK_RADIUS*LINK_RADIUS){ ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke(); if(++links>=MAX_LINKS) break; } }
    } }
    // ships
    ctx.globalAlpha=1;
    for(const sh of ships){ sh.x+=sh.vx; sh.y+=sh.vy; if(sh.x<-20) sh.x=innerWidth+20; if(sh.x>innerWidth+20) sh.x=-20; if(sh.y<-20) sh.y=innerHeight+20; if(sh.y>innerHeight+20) sh.y=-20;
      ctx.beginPath(); ctx.arc(sh.x,sh.y,sh.size,0,Math.PI*2); ctx.fillStyle='#6fb8ff'; ctx.fill(); }
    requestAnimationFrame(loop);
  }
  loop();
  GE_ENV.mark('background.js','starfield & ships running');
})();
