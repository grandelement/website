// planets.js — album planets (grab, throw like billiards; bounce off sun & moon & each other)
// click-without-drag → Bandcamp + teleport ripple
(function(){
  const host=document.createElement('div'); host.className='planets'; document.body.appendChild(host);
  const albums=[
    {name:'Fundamental Groove', url:'https://grandelement.bandcamp.com/album/fundamental-groove', hue:200},
    {name:'Trio',               url:'https://grandelement.bandcamp.com/album/trio',                 hue:320},
    {name:'Live',               url:'https://grandelement.bandcamp.com/album/live',                 hue:48},
    {name:'Sessions I',         url:'https://grandelement.bandcamp.com/album/sessions-i',           hue:210},
    {name:'Sessions II',        url:'https://grandelement.bandcamp.com/album/sessions-ii',          hue:260},
    {name:'Intergy',            url:'https://grandelement.bandcamp.com/album/intergy',              hue:220},
    {name:'Love',               url:'https://grandelement.bandcamp.com/album/love',                 hue:300},
    {name:'Soul',               url:'https://grandelement.bandcamp.com/album/soul',                 hue:190},
    {name:'Spirit',             url:'https://grandelement.bandcamp.com/album/spirit',               hue:130},
    {name:'Fire',               url:'https://grandelement.bandcamp.com/album/fire',                 hue:16},
  ];
  const R=[55,50,46,42,42,38,38,34,34,30];
  const planets=[];

  function place(){
    host.innerHTML=''; planets.length=0;
    const w=innerWidth,h=innerHeight, xC=w*0.56, yB=h*0.88, yT=h*0.14, amp=Math.max(80,w*0.12), waves=1.2;
    albums.forEach((alb,i)=>{
      const t=i/(albums.length-1), y=yB - t*(yB-yT), x=xC + amp*Math.sin((t*Math.PI*2*waves)-Math.PI/2);
      const a=document.createElement('a'); a.className='planet'; a.style.left=x+'px'; a.style.top=y+'px';
      a.style.background=`radial-gradient(circle at 35% 30%, hsl(${alb.hue} 80% 72%) 0%, hsl(${alb.hue} 60% 22%) 62%)`;
      a.innerHTML=`<span class="labelAlways">${alb.name}</span>`; a.href=alb.url; a.target='_blank';
      host.appendChild(a);
      const p={el:a,x,y,r:R[i],vx:0,vy:0,drag:false,link:alb.url}; planets.push(p);
      let sx=0,sy=0,startX=0,startY=0,t0=0;
      a.addEventListener('pointerdown',e=>{ p.drag=true; a.setPointerCapture(e.pointerId); sx=e.clientX; sy=e.clientY; startX=p.x; startY=p.y; t0=performance.now(); });
      a.addEventListener('pointermove',e=>{ if(!p.drag) return; p.x=startX+(e.clientX-sx); p.y=startY+(e.clientY-sy); paint(p); });
      a.addEventListener('pointerup',e=>{
        a.releasePointerCapture(e.pointerId); const dt=Math.max(16,performance.now()-t0); const dx=p.x-startX, dy=p.y-startY; const dist=Math.hypot(dx,dy);
        if(dist<5 && dt<180){ window.open(p.link,'_blank','noopener'); if(window.GE_FX) GE_FX.teleportFrom(p.x,p.y); p.drag=false; return; }
        p.vx=(dx/dt)*18; p.vy=(dy/dt)*18; p.drag=false;
      });
    });
  }
  function paint(p){ p.el.style.left=p.x+'px'; p.el.style.top=p.y+'px'; }
  function bounceCircle(p,cx,cy,cr){
    const dx=p.x-cx, dy=p.y-cy, d=Math.hypot(dx,dy); if(d===0) return;
    if(d<p.r+cr){ const nx=dx/d, ny=dy/d, overlap=p.r+cr-d+0.5; p.x+=nx*overlap; p.y+=ny*overlap; const dot=p.vx*nx+p.vy*ny; p.vx=(p.vx-2*dot*nx)*0.85; p.vy=(p.vy-2*dot*ny)*0.85; }
  }
  function loop(){
    const loss=0.985, edgeLoss=0.86;
    const sun=document.getElementById('sunWrap')?.getBoundingClientRect();
    const moon=document.querySelector('.moon')?.getBoundingClientRect();
    const sx=sun?sun.left+sun.width/2:0, sy=sun?sun.top+sun.height/2:0, sr=sun?sun.width/2:0;
    const mx=moon?moon.left+moon.width/2:0, my=moon?moon.top+moon.height/2:0, mr=moon?moon.width/2:0;

    for(let i=0;i<planets.length;i++){
      const p=planets[i]; if(!p.drag){ p.x+=p.vx; p.y+=p.vy; p.vx*=loss; p.vy*=loss; }
      if(p.x-p.r<0){ p.x=p.r; p.vx=Math.abs(p.vx)*edgeLoss; }
      if(p.x+p.r>innerWidth){ p.x=innerWidth-p.r; p.vx=-Math.abs(p.vx)*edgeLoss; }
      if(p.y-p.r<0){ p.y=p.r; p.vy=Math.abs(p.vy)*edgeLoss; }
      if(p.y+p.r>innerHeight){ p.y=innerHeight-p.r; p.vy=-Math.abs(p.vy)*edgeLoss; }
      for(let j=i+1;j<planets.length;j++){
        const q=planets[j], dx=q.x-p.x, dy=q.y-p.y, d=Math.hypot(dx,dy), R=p.r+q.r;
        if(d>0&&d<R){ const nx=dx/d, ny=dy/d, overlap=R-d; p.x-=nx*overlap/2; p.y-=ny*overlap/2; q.x+=nx*overlap/2; q.y+=ny*overlap/2;
          const pvn=p.vx*nx+p.vy*ny, qvn=q.vx*nx+q.vy*ny, tmp=pvn; p.vx+=(qvn-pvn)*nx; p.vy+=(qvn-pvn)*ny; q.vx+=(tmp-qvn)*nx; q.vy+=(tmp-qvn)*ny; }
      }
      if(sun) bounceCircle(p,sx,sy,sr); if(moon) bounceCircle(p,mx,my,mr);
      paint(p);
    }
    requestAnimationFrame(loop);
  }
  place(); addEventListener('resize', place); loop();
  GE_ENV.mark('planets.js','planets placed & animating');
})();
