// modules/fx.js
// Ships + Comets + Teleportation (calls background.nextBackground)

import { nextBackground } from './background.js';

export function init({ HUD, ROOT_IMG }) {
  const cvs = (window.GE && window.GE.cvs) || document.getElementById('fx');
  const ctx = (window.GE && window.GE.ctx) || cvs.getContext('2d');

  // --- helpers
  const rand = (a,b)=>Math.random()*(b-a)+a;
  const choice = a=>a[(Math.random()*a.length)|0];
  let W = cvs.width, H = cvs.height;
  function resize(){ W=cvs.width=innerWidth; H=cvs.height=innerHeight; }
  addEventListener('resize', resize, {passive:true}); resize();

  // --- art
  const cometImg = new Image(); cometImg.src = (ROOT_IMG||'images/') + 'ge-logo 3.png';
  const shipImg  = new Image(); shipImg.src  = (ROOT_IMG||'images/') + 'ge-logo-4-cutout.png';
  const SHIP_ART_OFFSET = Math.PI; // rotate to face travel

  // --- config
  const COMET = { sizes:[8,10,12,16], max:3, spawn:[4,9], speed:[60,160], trail:120, fade:1400, pairTouch:26 };
  const MAX_SHIPS = 4;
  const SHIP_SCALES = [0.10,0.14,0.19,0.25];

  // --- state
  const comets=[], pairs=[], ships=[];
  let last = performance.now()/1000, cTimer=0, cNext=rand(...COMET.spawn), sTimer=0, sNext=rand(6,12);
  let teleportOverlayAlpha = 0;

  // --- DOM targets for beams
  function centerOf(el){
    const r = el.getBoundingClientRect();
    return { x:r.left + r.width/2, y:r.top + r.height/2 };
  }
  function gatherBeamTargets(){
    const targets = [];
    const sunWrap = document.getElementById('sunWrap');
    const moon    = document.getElementById('moon');
    if (sunWrap) targets.push(centerOf(sunWrap));
    if (moon)    targets.push(centerOf(moon));
    // planets
    document.querySelectorAll('.planet').forEach(p=>targets.push(centerOf(p)));
    // comets (canvas space is same as page space)
    comets.forEach(c=>targets.push({x:c.x, y:c.y}));
    return targets;
  }

  // --- classes
  class Comet{
    constructor(){
      const edge=choice(['l','r','t','b']), pad=40;
      if(edge==='l'){this.x=-pad;this.y=rand(0,H);} 
      if(edge==='r'){this.x=W+pad;this.y=rand(0,H);}
      if(edge==='t'){this.x=rand(0,W);this.y=-pad;}
      if(edge==='b'){this.x=rand(0,W);this.y=H+pad;}
      const tx=rand(W*.2,W*.8), ty=rand(H*.2,H*.8), a=Math.atan2(ty-this.y,tx-this.x), s=rand(...COMET.speed);
      this.vx=Math.cos(a)*s; this.vy=Math.sin(a)*s; this.r=choice(COMET.sizes);
      this.trail=[]; this.state='fly'; this.dead=false;
    }
    step(dt){
      if(this.state!=='fly' && this.state!=='separate') return;
      this.x += this.vx*dt; this.y += this.vy*dt;
      this.trail.push([this.x,this.y,performance.now()]);
      if(this.trail.length>COMET.trail) this.trail.shift();
      if(this.x<-90||this.x>W+90||this.y<-90||this.y>H+90) this.dead=true;
    }
    draw(){
      for(let i=0;i<this.trail.length;i++){
        const [tx,ty,ts]=this.trail[i];
        const a=Math.max(0,1-(performance.now()-ts)/COMET.fade);
        if(a<=0) continue;
        ctx.globalAlpha=a*0.6;
        ctx.drawImage(cometImg, tx-this.r, ty-this.r, this.r*2, this.r*2);
      }
      ctx.globalAlpha=1;
      ctx.drawImage(cometImg, this.x-this.r, this.y-this.r, this.r*2, this.r*2);
    }
  }

  class Pair{
    constructor(a,b){
      this.a=a; this.b=b;
      this.cx=(a.x+b.x)/2; this.cy=(a.y+b.y)/2;
      this.R=Math.max(18, Math.hypot(a.x-b.x,a.y-b.y)/2);
      this.theta=Math.atan2(a.y-this.cy,a.x-this.cx);
      this.omega=(Math.PI*2)/3; // ~1 rev in ~2s
      this.t=0; this.phase='orbit';
      const va=Math.atan2(a.vy,a.vx), vb=Math.atan2(b.vy,b.vx), out=(va+vb)/2;
      this.outA=out; this.outB=out+Math.PI;
      this.sA=Math.hypot(a.vx,a.vy); this.sB=Math.hypot(b.vx,b.vy);
    }
    step(dt){
      this.t+=dt;
      if(this.phase==='orbit'){
        this.theta+=this.omega*dt;
        this.a.x=this.cx+Math.cos(this.theta)*this.R;
        this.a.y=this.cy+Math.sin(this.theta)*this.R;
        this.b.x=this.cx-Math.cos(this.theta)*this.R;
        this.b.y=this.cy-Math.sin(this.theta)*this.R;
        if(this.t>=3){ this.phase='pause'; this.t=0; }
      } else if(this.phase==='pause'){
        if(this.t>=2.5){
          this.phase='split';
          this.a.vx=Math.cos(this.outA)*this.sA; this.a.vy=Math.sin(this.outA)*this.sA;
          this.b.vx=Math.cos(this.outB)*this.sB; this.b.vy=Math.sin(this.outB)*this.sB;
          this.a.state='separate'; this.b.state='separate';
        }
      } else {
        this.dead=true;
      }
    }
    draw(){
      if(this.phase!=='split'){
        const g=ctx.createRadialGradient(this.cx,this.cy,2,this.cx,this.cy,this.R+12);
        g.addColorStop(0,'rgba(180,220,255,.25)');
        g.addColorStop(1,'rgba(180,220,255,0)');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(this.cx,this.cy,this.R+12,0,Math.PI*2); ctx.fill();
      }
    }
  }

  class Ship{
    constructor(){
      const side=choice(['l','r','t','b']); this.s=choice(SHIP_SCALES);
      const pad=60;
      if(side==='l'){this.x=-pad; this.y=rand(0,H); this.vx=rand(80,220);  this.vy=rand(-60,60);}
      if(side==='r'){this.x=W+pad; this.y=rand(0,H); this.vx=-rand(80,220); this.vy=rand(-60,60);}
      if(side==='t'){this.x=rand(0,W); this.y=-pad; this.vx=rand(-160,160); this.vy=rand(80,200);}
      if(side==='b'){this.x=rand(0,W); this.y=H+pad; this.vx=rand(-160,160); this.vy=-rand(80,200);}
      this.ax=rand(-20,20); this.ay=rand(-20,20);
      this.curveT=rand(2,5); this.curveP=rand(0,Math.PI*2);
      this.beam=0; this.dead=false;
      // Teleportation state
      this.teleporting=false;
      this.wavePhase=0;      // radians
      this.waveSpeed=6;      // Hz-ish feel
      this.tTeleport=0;      // seconds since start
    }
    step(dt){
      if(!this.teleporting){
        this.curveP+=dt/this.curveT;
        this.vx+=Math.sin(this.curveP)*14*dt + this.ax*dt*.2;
        this.vy+=Math.cos(this.curveP)*14*dt + this.ay*dt*.2;
        const v=Math.hypot(this.vx,this.vy), vmax=300;
        if(v>vmax){ this.vx*=vmax/v; this.vy*=vmax/v; }
        this.x+=this.vx*dt; this.y+=this.vy*dt;
        if(this.x<-140||this.x>W+140||this.y<-140||this.y>H+140) this.dead=true;
        // passive beam to gently pull two nearby comets
        this.maybeBeam(dt);
      } else {
        // teleporting: slow motion, run wave
        this.vx*=0.96; this.vy*=0.96;
        this.x+=this.vx*dt; this.y+=this.vy*dt;
        this.tTeleport += dt;
        // ramp wave speed 1Hz -> 30Hz across ~3.5s
        const t = Math.min(this.tTeleport/3.5, 1);
        this.waveSpeed = 1 + t*(30-1);
        this.wavePhase += dt*this.waveSpeed*2*Math.PI;
      }
    }
    maybeBeam(dt){
      let a=null,b=null,best=1e9;
      for(let i=0;i<comets.length;i++) for(let j=i+1;j<comets.length;j++){
        const c1=comets[i],c2=comets[j]; if(c1.state!=='fly'||c2.state!=='fly') continue;
        const mx=(c1.x+c2.x)/2, my=(c1.y+c2.y)/2; const ds=Math.hypot(this.x-mx,this.y-mx);
        if(ds<220 && ds<best){ best=ds; a=c1; b=c2; }
      }
      if(a&&b){
        this.beam=Math.min(3,this.beam+dt);
        const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
        [a,b].forEach(c=>{ const ang=Math.atan2(mx-c.x, my-c.y); c.vx += Math.sin(ang)*9*dt*60; c.vy += Math.cos(ang)*9*dt*60; });
      } else {
        this.beam=Math.max(0,this.beam-dt);
      }
    }
    draw(){
      if(!shipImg.complete) return;
      const ang=Math.atan2(this.vy,this.vx)+SHIP_ART_OFFSET;
      const w=shipImg.width*this.s, h=shipImg.height*this.s;
      ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(ang);
      ctx.drawImage(shipImg, -w*0.3, -h*0.5, w*0.6, h*0.6);
      // passive tractor beam
      if(this.beam>0 && !this.teleporting){
        const len=160;
        ctx.strokeStyle='rgba(126,203,255,.9)'; ctx.lineWidth=2; ctx.beginPath();
        for(let i=0;i<=len;i+=6){
          const dy=Math.sin((i/len)*Math.PI*4 + performance.now()/250)*8;
          if(i===0) ctx.moveTo(10+i,dy); else ctx.lineTo(10+i,dy);
        }
        ctx.stroke();
      }
      ctx.restore();

      // teleportation beams draw in overlay step
    }
  }

  // --- teleportation overlay + beams
  function drawTeleportBeams(ship){
    const targets = gatherBeamTargets();
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(100,200,255,0.9)';
    targets.forEach(t=>{
      const dx = t.x - ship.x, dy = t.y - ship.y;
      const L  = Math.hypot(dx,dy);
      const steps = Math.max(10, Math.min(64, Math.floor(L/12)));
      ctx.beginPath();
      for(let i=0;i<=steps;i++){
        const p = i/steps;
        const x = ship.x + dx*p;
        const y = ship.y + dy*p;
        const amp = 8; // wave amplitude
        // normal vector
        const nx = -dy / (L||1), ny = dx / (L||1);
        // sine offset
        const s = Math.sin(ship.wavePhase + p*12) * amp * (0.6 + 0.4*p);
        const ox = x + nx * s, oy = y + ny * s;
        if(i===0) ctx.moveTo(ox,oy); else ctx.lineTo(ox,oy);
      }
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawTeleportText(alpha){
    if(alpha<=0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(200,235,255,0.95)';
    ctx.font = '900 28px system-ui, Segoe UI, Roboto, Arial';
    ctx.textAlign='center';
    ctx.fillText('TELEPORTATION', W/2, H*0.12);
    ctx.restore();
  }

  // --- main loop
  function loop(){
    const now = performance.now()/1000, dt = Math.min(.05, now-last); last=now;

    // spawn
    cTimer+=dt; if(cTimer>cNext && comets.length<COMET.max){ comets.push(new Comet()); cTimer=0; cNext=rand(...COMET.spawn); }
    sTimer+=dt; if(sTimer>sNext){ sTimer=0; sNext=rand(6,14); if(ships.length<MAX_SHIPS) ships.push(new Ship()); }

    // step
    comets.forEach(c=>c.step(dt));
    ships.forEach(s=>s.step(dt));
    pairs.forEach(p=>p.step(dt));

    // pair on near touch
    for(let i=0;i<comets.length;i++) for(let j=i+1;j<comets.length;j++){
      const a=comets[i], b=comets[j]; if(a.state!=='fly'||b.state!=='fly') continue;
      if(Math.hypot(a.x-b.x,a.y-b.y) < COMET.pairTouch){ a.state='pair'; b.state='pair'; pairs.push(new Pair(a,b)); }
    }

    // cleanup
    for(let i=comets.length-1;i>=0;i--) if(comets[i].dead) comets.splice(i,1);
    for(let i=pairs.length-1;i>=0;i--) if(pairs[i].dead) pairs.splice(i,1);
    for(let i=ships.length-1;i>=0;i--) if(ships[i].dead) ships.splice(i,1);

    // draw
    ctx.clearRect(0,0,W,H);
    pairs.forEach(p=>p.draw());
    comets.forEach(c=>c.draw());
    ships.forEach(s=>s.draw());
    // teleportation overlay elements
    const tpShip = ships.find(s=>s.teleporting);
    if(tpShip){
      drawTeleportBeams(tpShip);
      // fade overlay alpha up then down across ~4.5s total
      const t = tpShip.tTeleport; // seconds
      teleportOverlayAlpha = t<0.6 ? (t/0.6) : (t>4.2 ? Math.max(0,1 - (t-4.2)/0.6) : 1);
    } else {
      teleportOverlayAlpha = Math.max(0, teleportOverlayAlpha - 2*dt);
    }
    drawTeleportText(teleportOverlayAlpha);

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // --- click handling: trigger teleportation on nearest ship
  cvs.addEventListener('pointerdown', e=>{
    const x = e.clientX, y = e.clientY;
    // find nearest ship within 48px
    let best=null, bd=1e9;
    ships.forEach(s=>{
      const d = Math.hypot(x - s.x, y - s.y);
      if(d<bd){ bd=d; best=s; }
    });
    if(best && bd<=48){
      startTeleport(best);
    }
  });

  // --- teleportation
  async function startTeleport(ship){
    if(ship.teleporting) return;
    ship.teleporting = true;
    ship.tTeleport = 0;
    // slow down immediately
    ship.vx *= 0.15; ship.vy *= 0.15;

    // schedule background switch near the climax
    let bgSwitched = false;

    const tStart = performance.now();
    const DUR = 4500; // ms total
    function tickTeleport(){
      const tNow = performance.now();
      const elapsed = tNow - tStart;
      if(!bgSwitched && elapsed >= 3500){ bgSwitched = true; nextBackground().catch(()=>{}); }
      if(elapsed < DUR){
        requestAnimationFrame(tickTeleport);
      } else {
        // restore motion (nudge forward)
        const ang = Math.random()*Math.PI*2, spd = 140;
        ship.vx = Math.cos(ang)*spd; ship.vy = Math.sin(ang)*spd;
        ship.teleporting = false; ship.waveSpeed = 0; ship.tTeleport = 0;
      }
    }
    requestAnimationFrame(tickTeleport);
  }

  // expose small tuning API (optional)
  window.GE = Object.assign(window.GE||{}, {
    setIntensity(opts){
      if(opts?.maxComets!=null) COMET.max = opts.maxComets|0;
      if(opts?.maxShips!=null)  (/* no global cap change at runtime */);
    }
  });

  HUD?.mod?.('fx.js (teleport)', true);
}
