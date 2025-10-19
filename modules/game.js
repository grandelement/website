// game.js — comets with tails; bounce off sun & moon; click to pin briefly
(function(){
  const host=document.createElement('div'); host.className='layer-hiddentext'; document.body.appendChild(host);
  const ctx = GE_CANVAS.fxCtx; // reuse fx canvas for tails
  const comets=[];
  for(let i=0;i<40;i++){
    const el=document.createElement('div'); el.className='phrase'; el.textContent='•'; el.style.left=(Math.random()*innerWidth)+'px'; el.style.top=(Math.random()*innerHeight)+'px';
    host.appendChild(el);
    const c={el,x:parseFloat(el.style.left),y:parseFloat(el.style.top),r:5,vx:(Math.random()-.5)*0.6,vy:(Math.random()-.5)*0.6}; comets.push(c);
    el.addEventListener('click',()=>{ c.vx=c.vy=0; setTimeout(()=>{ c.vx=(Math.random()-.5)*0.6; c.vy=(Math.random()-.5)*0.6; },600); });
  }
  function bounce(c,cx,cy,cr){
    const dx=c.x-cx, dy=c.y-cy, d=Math.hypot(dx,dy); if(d===0) return;
    if(d<cr+c.r){ const nx=dx/d, ny=dy/d, overlap=cr+c.r-d+0.5; c.x+=nx*overlap; c.y+=ny*overlap; const dot=c.vx*nx+c.vy*ny; c.vx=(c.vx-2*dot*nx)*0.9; c.vy=(c.vy-2*dot*ny)*0.9; }
  }
  function loop(){
    ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.clearRect(0,0,innerWidth,innerHeight);
    const sun=document.getElementById('sunWrap')?.getBoundingClientRect();
    const moon=document.querySelector('.moon')?.getBoundingClientRect();
    const sx=sun?sun.left+sun.width/2:0, sy=sun?sun.top+sun.height/2:0, sr=sun?sun.width/2:0;
    const mx=moon?moon.left+moon.width/2:0, my=moon?moon.top+moon.height/2:0, mr=moon?moon.width/2:0;
    for(const c of comets){
      c.x+=c.vx; c.y+=c.vy; c.el.style.transform=`translate(${c.x}px,${c.y}px)`;
      const len=18+c.r*4; ctx.beginPath(); ctx.moveTo(c.x,c.y); ctx.lineTo(c.x - c.vx*len, c.y - c.vy*len); ctx.lineWidth=Math.max(1,c.r/2); ctx.strokeStyle='rgba(190,220,255,.5)'; ctx.stroke();
      if(sun) bounce(c,sx,sy,sr); if(moon) bounce(c,mx,my,mr);
    }
    ctx.restore(); requestAnimationFrame(loop);
  }
  loop();
  GE_ENV.mark('game.js','comets active');
})();
