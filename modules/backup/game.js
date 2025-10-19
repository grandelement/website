const C=window.GE_CONFIG, IMG=C.imagesBase, MOBILE=innerWidth<820;
const canvas=document.getElementById('fx'), ctx=canvas.getContext('2d');
let W=innerWidth,H=innerHeight; function resize(){ W=innerWidth; H=innerHeight; canvas.width=W; canvas.height=H; } addEventListener('resize',resize,{passive:true}); resize();

const cometImg=new Image(); cometImg.src=IMG+'ge-logo%203.png';
const shipImg =new Image(); shipImg.src =IMG+'ge-logo-4-cutout.png';
const COMET={sizes:[8,10,12,16], max:C.maxComets||3, spawn:[4,9], speed:[60,140], trail:100, fade:1200, touch:26};
const rand=(a,b)=>Math.random()*(b-a)+a, choice=a=>a[(Math.random()*a.length)|0], now=()=>performance.now();

class Comet{
  constructor(){
    const e=choice(['l','r','t','b']), pad=40;
    if(e==='l'){this.x=-pad; this.y=rand(0,H);} if(e==='r'){this.x=W+pad; this.y=rand(0,H);}
    if(e==='t'){this.x=rand(0,W); this.y=-pad;} if(e==='b'){this.x=rand(0,W); this.y=H+pad;}
    const tx=rand(W*.2,W*.8), ty=rand(H*.2,H*.8), a=Math.atan2(ty-this.y, tx-this.x), s=rand(...COMET.speed);
    this.vx=Math.cos(a)*s; this.vy=Math.sin(a)*s; this.r=choice(COMET.sizes);
    this.trail=[]; this.drag=false;
  }
  step(dt){ if(this.drag||this.dance) return; this.x+=this.vx*dt; this.y+=this.vy*dt; this.trail.push([this.x,this.y,now()]); if(this.trail.length>COMET.trail) this.trail.shift(); }
  draw(){ for(const [tx,ty,ts] of this.trail){ const a=Math.max(0,1-(now()-ts)/COMET.fade); if(a<=0) continue; ctx.globalAlpha=a*.6; ctx.drawImage(cometImg,tx-this.r,ty-this.r,this.r*2,this.r*2); }
           ctx.globalAlpha=1; ctx.drawImage(cometImg,this.x-this.r,this.y-this.r,this.r*2,this.r*2); }
}
class Ship{
  constructor(){ const s=choice(['l','r','t','b']); const pad=60;
    this.s=MOBILE?choice([.08,.12,.16,.20]):choice([.10,.14,.19,.22,.26]);
    if(s==='l'){this.x=-pad; this.y=rand(0,H); this.vx=rand(80,220); this.vy=rand(-80,80);}
    if(s==='r'){this.x=W+pad; this.y=rand(0,H); this.vx=-rand(80,220); this.vy=rand(-80,80);}
    if(s==='t'){this.x=rand(0,W); this.y=-pad; this.vx=rand(-180,180); this.vy=rand(80,220);}
    if(s==='b'){this.x=rand(0,W); this.y=H+pad; this.vx=rand(-180,180); this.vy=-rand(80,220);}
    this.beam=0; this.dead=false;
  }
  step(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt;
    if(this.x<-140||this.x>W+140||this.y<-140||this.y>H+140) this.dead=true;
    this.beam=Math.max(0,this.beam-dt); if(Math.random()<0.02) this.beam=rand(.6,1.6);
  }
  draw(){
    if(!shipImg.complete) return;
    const ang=Math.atan2(this.vy,this.vx)+Math.PI, w=shipImg.width*this.s, h=shipImg.height*this.s;
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(ang); ctx.drawImage(shipImg,-w*0.3,-h*0.5,w*0.6,h*0.6);

    if(this.beam>0 && comets.length>=2){
      let best=null, bestd=1e9;
      for(let i=0;i<comets.length;i++)for(let j=i+1;j<comets.length;j++){
        const a=comets[i], b=comets[j]; if(a.drag||b.drag) continue;
        const mx=(a.x+b.x)/2, my=(a.y+b.y)/2, d=Math.hypot(mx-this.x,my-this.y);
        if(d<bestd){bestd=d; best=[a,b,mx,my];}
      }
      if(best && bestd<240){
        const [a,b,mx,my]=best; const k=14*this.beam;
        const aa=Math.atan2(my-a.y,mx-a.x), bb=Math.atan2(my-b.y,mx-b.x);
        a.vx+=Math.cos(aa)*k; a.vy+=Math.sin(aa)*k; b.vx+=Math.cos(bb)*k; b.vy+=Math.sin(bb)*k;

        // centered wavy beam
        ctx.strokeStyle='rgba(126,203,255,.9)'; ctx.lineWidth=2; ctx.beginPath();
        const len=160; for(let i=0;i<=len;i+=6){ const y=Math.sin((i/len)*Math.PI*4 + now()/250)*8; if(i===0) ctx.moveTo(10+i,y); else ctx.lineTo(10+i,y); } ctx.stroke();

        const dAB=Math.hypot(a.x-b.x,a.y-b.y);
        if(dAB<40){ const cx=mx, cy=my, w=2*Math.PI/1.5, R=Math.max(24,dAB*0.6), t0=now();
          a.dance=()=>{ const t=(now()-t0)/1000; a.x=cx+Math.cos(w*t)*R; a.y=cy+Math.sin(w*t)*R; if(t>1.5) delete a.dance; };
          b.dance=()=>{ const t=(now()-t0)/1000; b.x=cx+Math.cos(w*t+Math.PI)*R; b.y=cy+Math.sin(w*t+Math.PI)*R; if(t>1.5) delete b.dance; };
        }
      }
    }
    ctx.restore();
  }
}

const comets=[], ships=[]; let last=performance.now()/1000, cT=0, cNext=rand(...COMET.spawn), sT=0, sNext=rand(6,12);
function loop(){
  const t=performance.now()/1000, dt=Math.min(.05, t-last); last=t;
  cT+=dt; if(cT>cNext && comets.length<COMET.max){ comets.push(new Comet()); cT=0; cNext=rand(...COMET.spawn); }
  sT+=dt; if(sT>sNext){ sT=0; sNext=rand(6,12); if(ships.length<(MOBILE?C.maxShipsMobile:C.maxShipsDesktop)) ships.push(new Ship()); }

  comets.forEach(c=>{ if(c.dance){ c.dance(); } else { c.step(dt); }});
  ships.forEach(s=>s.step(dt));

  // elastic comet↔comet
  for(let i=0;i<comets.length;i++)for(let j=i+1;j<comets.length;j++){
    const a=comets[i], b=comets[j], dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy), min=a.r+b.r;
    if(d>0 && d<min){ const nx=dx/d, ny=dy/d; const dvx=b.vx-a.vx, dvy=b.vy-a.vy, p=2*(dvx*nx + dvy*ny)/2;
      a.vx+=p*nx; a.vy+=p*ny; b.vx-=p*nx; b.vy-=p*ny; const overlap=min-d; a.x-=nx*overlap/2; a.y-=ny*overlap/2; b.x+=nx*overlap/2; b.y+=ny*overlap/2; }
  }

  // ricochet with sun + moon
  const sunRect=document.getElementById('sunWrap').getBoundingClientRect(),
        sunCX=sunRect.left+sunRect.width/2, sunCY=sunRect.top+sunRect.height/2,
        sunR=sunRect.width/2;
  const or = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--orbit-radius'))||240;
  const ang = parseFloat((document.getElementById('orbit').style.transform||'').replace(/[^\-0-9.]/g,''))||0;
  const moonCX=sunCX + Math.cos(ang)*or, moonCY=sunCY + Math.sin(ang)*or, moonR=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--moon-size'))||110)/2;

  function bounce(c, cx, cy, r){ const dx=c.x-cx, dy=c.y-cy, d=Math.hypot(dx,dy);
    if(d<r+c.r){ const nx=dx/d, ny=dy/d, dot=c.vx*nx + c.vy*ny; c.vx-=2*dot*nx; c.vy-=2*dot*ny;
      const push=(r+c.r-d); c.x+=nx*push; c.y+=ny*push; } }
  comets.forEach(c=>{ bounce(c, sunCX, sunCY, sunR); bounce(c, moonCX, moonCY, moonR); });

  // cull & draw
  for(let i=comets.length-1;i>=0;i--) if(comets[i].x<-120||comets[i].x>W+120||comets[i].y<-120||comets[i].y>H+120) comets.splice(i,1);
  for(let i=ships.length-1;i>=0;i--) if(ships[i].dead) ships.splice(i,1);
  ctx.clearRect(0,0,W,H); comets.forEach(c=>c.draw()); ships.forEach(s=>s.draw());
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* grab + fling */
let drag=null,sx=0,sy=0;
canvas.addEventListener('pointerdown',e=>{
  const x=e.clientX,y=e.clientY;
  for(let i=comets.length-1;i>=0;i--){ const c=comets[i]; if(Math.hypot(x-c.x,y-c.y)<=c.r+8){ drag=c; sx=x; sy=y; c.drag=true; break; } }
});
addEventListener('pointermove',e=>{ if(!drag) return; drag.x=e.clientX; drag.y=e.clientY; });
addEventListener('pointerup',e=>{ if(!drag) return; drag.vx=(e.clientX-sx)*2; drag.vy=(e.clientY-sy)*2; drag.drag=false; drag=null; });
