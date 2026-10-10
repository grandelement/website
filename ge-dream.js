/* GE DREAM: lightweight procedural visual layer; no external dependencies. */
(()=>{'use strict';
let canvas,ctx,on=false,raf=0,last=0,phase=0,seed=0,particles=[],pointer={x:.5,y:.5},nextChange=0,mode=0,kaleidoSince=0,kaleidoFrom=0,kaleidoTo=1;
const activeFingers=new Map(),fingerEchoes=[];
const MAX_FINGERS=10,MAX_TRAIL=38;
function trackFinger(e){
 if(!on)return;
 pointer={x:e.clientX/Math.max(1,innerWidth),y:e.clientY/Math.max(1,innerHeight)};
 const finger=activeFingers.get(e.pointerId);
 if(!finger)return;
 finger.x=e.clientX;finger.y=e.clientY;
 const path=finger.path,lastPoint=path[path.length-1];
 if(!lastPoint||Math.hypot(finger.x-lastPoint.x,finger.y-lastPoint.y)>2){
   path.push({x:finger.x,y:finger.y});if(path.length>MAX_TRAIL)path.shift();
 }
}
function startFinger(e){
 if(!on||!['touch','pen','mouse'].includes(e.pointerType)||activeFingers.has(e.pointerId)||activeFingers.size>=MAX_FINGERS)return;
 if(e.pointerType==='mouse'&&e.button!==0)return;
 const finger={x:e.clientX,y:e.clientY,path:[{x:e.clientX,y:e.clientY}],seed:Math.random()*Math.PI*2};
 activeFingers.set(e.pointerId,finger);
 trackFinger(e);
}
function endFinger(e){
 const finger=activeFingers.get(e.pointerId);if(!finger)return;
 fingerEchoes.push({path:finger.path.slice(),x:finger.x,y:finger.y,seed:finger.seed,until:performance.now()+800});
 if(fingerEchoes.length>MAX_FINGERS*2)fingerEchoes.splice(0,fingerEchoes.length-MAX_FINGERS*2);
 activeFingers.delete(e.pointerId);
}
function drawFingers(t,w,h){
 const list=[...activeFingers.values()];
 fingerEchoes.splice(0,fingerEchoes.length,...fingerEchoes.filter(f=>f.until>t));
 if(!list.length&&!fingerEchoes.length)return;
 ctx.save();ctx.globalCompositeOperation='screen';ctx.lineCap='round';ctx.lineJoin='round';
 const all=list.concat(fingerEchoes);
 for(let n=0;n<all.length;n++){
   const f=all[n],fade=f.until?Math.max(0,(f.until-t)/800):1;
   const hue=(198+n*42+phase*16)%360;
   ctx.strokeStyle='hsla('+hue+',100%,69%,'+(.60*fade)+')';ctx.shadowColor='hsla('+hue+',100%,67%,'+(.55*fade)+')';ctx.shadowBlur=15;ctx.lineWidth=2.2;
   ctx.beginPath();f.path.forEach((pt,i)=>i?ctx.lineTo(pt.x,pt.y):ctx.moveTo(pt.x,pt.y));ctx.stroke();
   ctx.fillStyle='hsla('+hue+',100%,85%,'+(.8*fade)+')';
   ctx.beginPath();ctx.arc(f.x,f.y,5+2*Math.sin(t*.008+f.seed),0,TAU);ctx.fill();
 }
 // Braided living-energy strands join all current fingers without consuming
 // touch input or replacing the Dream's original procedural animation.
 if(list.length>=2){
   for(let n=0;n<list.length;n++){
     const a=list[n],b=list[(n+1)%list.length];if(list.length===2&&n>0)break;
     const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
     for(let strand=0;strand<3;strand++){
       ctx.beginPath();
       for(let k=0;k<=24;k++){
         const u=k/24,wave=Math.sin(u*Math.PI*7+t*.005+strand*TAU/3+n)*Math.sin(Math.PI*u)*Math.min(22,len*.12);
         const x=a.x+dx*u+nx*wave,y=a.y+dy*u+ny*wave;
         if(k)ctx.lineTo(x,y);else ctx.moveTo(x,y);
       }
       ctx.strokeStyle='hsla('+((185+n*47+strand*65+phase*9)%360)+',100%,70%,.49)';
       ctx.lineWidth=1.35;ctx.shadowBlur=8;ctx.stroke();
     }
   }
 }
 ctx.restore();
}
const TAU=Math.PI*2,rand=(a,b)=>a+Math.random()*(b-a);
const effects=['vortex','nebula','plasma','ripple','aurora','spiral','breathing','comet','kaleidoscope','halo','fractals','magnetism','rain','waves','smoke','prism','stardust','lattice','pulsar','orbit','liquid','lightning','tunnel','shimmer','flame','crystal','echo','bloom','filament','gravity'];

const kaleidoDesigns=[
 {folds:6,petals:5,twist:.3,rings:4,hue:205,kind:0},
 {folds:8,petals:9,twist:1.3,rings:6,hue:290,kind:1},
 {folds:12,petals:4,twist:2.4,rings:5,hue:175,kind:2},
 {folds:5,petals:11,twist:3.6,rings:7,hue:320,kind:3},
 {folds:10,petals:7,twist:4.5,rings:3,hue:35,kind:0},
 {folds:16,petals:12,twist:5.4,rings:8,hue:250,kind:2},
 {folds:7,petals:6,twist:2.7,rings:5,hue:140,kind:1},
 {folds:9,petals:14,twist:1.8,rings:6,hue:10,kind:3},
 {folds:14,petals:8,twist:3.2,rings:4,hue:195,kind:0},
 {folds:11,petals:3,twist:5.8,rings:7,hue:275,kind:2},
 {folds:18,petals:10,twist:4.2,rings:5,hue:65,kind:1},
 {folds:4,petals:13,twist:2.1,rings:8,hue:225,kind:3}
];
const lerp=(a,b,v)=>a+(b-a)*v;
function kaleidoShape(d,cx,cy,R,alpha){
 const count=d.folds,seg=TAU/count;
 ctx.save();ctx.translate(cx,cy);ctx.rotate(phase*.035);
 ctx.globalCompositeOperation='screen';
 for(let n=0;n<count;n++){
  ctx.save();ctx.rotate(n*seg);if(n%2)ctx.scale(1,-1);
  for(let j=0;j<d.rings;j++){
   const rr=R*(j+1)/(d.rings+1),wave=phase*(.22+(j%3)*.07)+d.twist;
   const spread=seg*(.14+.15*Math.sin(wave+j));
   const x=rr*Math.cos(spread),y=rr*Math.sin(spread);
   const hue=(d.hue+j*34+phase*7+n*2)%360;
   ctx.beginPath();ctx.strokeStyle='hsla('+hue+',100%,65%,'+(alpha*.6)+')';ctx.lineWidth=1.2;
   const size=R*(.035+.025*Math.sin(wave*1.2+j));
   if(d.kind===0){ctx.ellipse(x,y,size*1.8,size*.65,wave,0,TAU);}
   else if(d.kind===1){for(let k=0;k<=d.petals;k++){const a=k*TAU/d.petals+wave*.2;const rad=size*(k%2?.55:1.8);const px=x+Math.cos(a)*rad,py=y+Math.sin(a)*rad;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
   else if(d.kind===2){ctx.moveTo(x-size,y);ctx.quadraticCurveTo(x,y-size*2,x+size,y);ctx.quadraticCurveTo(x,y+size*2,x-size,y);}
   else {for(let k=0;k<=d.petals;k++){const a=k*TAU/d.petals+wave*.15;const rad=size*(1+.6*Math.sin(k*2+wave));const px=x+Math.cos(a)*rad,py=y+Math.sin(a)*rad;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}}
   ctx.stroke();
  }
  ctx.restore();
 }
 ctx.restore();
}
function drawKaleidoscope(t,cx,cy,R){
 if(!kaleidoSince)kaleidoSince=t;
 if(t-kaleidoSince>8500){kaleidoFrom=kaleidoTo;kaleidoTo=(kaleidoTo+1+Math.floor(rand(0,kaleidoDesigns.length-1)))%kaleidoDesigns.length;kaleidoSince=t;}
 const mix=Math.min(1,(t-kaleidoSince)/2800),smooth=mix*mix*(3-2*mix);
 kaleidoShape(kaleidoDesigns[kaleidoFrom],cx,cy,R,(1-smooth)*.8);
 kaleidoShape(kaleidoDesigns[kaleidoTo],cx,cy,R,smooth*.8);
}
function setup(){if(canvas)return;canvas=document.createElement('canvas');canvas.id='geDreamCanvas';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9;opacity:0;transition:opacity 2s ease';document.body.appendChild(canvas);ctx=canvas.getContext('2d',{alpha:true});resize();addEventListener('resize',resize,{passive:true});
 document.addEventListener('pointerdown',startFinger,{passive:true,capture:true});
 document.addEventListener('pointermove',trackFinger,{passive:true,capture:true});
 document.addEventListener('pointerup',endFinger,{passive:true,capture:true});
 document.addEventListener('pointercancel',endFinger,{passive:true,capture:true});
 addEventListener('blur',()=>{activeFingers.clear();fingerEchoes.length=0});
}
function resize(){if(!canvas)return;let d=Math.min(devicePixelRatio||1,1.5),w=innerWidth,h=innerHeight;canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);}
function reset(){particles=Array.from({length:Math.min(100,Math.max(32,Math.floor(innerWidth/10)))},()=>({x:Math.random(),y:Math.random(),v:rand(.15,1.3),a:rand(0,TAU),s:rand(1,3)}));}
function draw(t){if(!on)return;raf=requestAnimationFrame(draw);if(t-last<32)return;let dt=Math.min(.07,(t-last)/1000||.03);last=t;phase+=dt;let w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);
if(t>nextChange){mode=(mode+1+Math.floor(rand(0,effects.length-1)))%effects.length;seed=rand(0,TAU);nextChange=t+rand(12000,42000);}
let cx=w*(.5+(pointer.x-.5)*.06),cy=h*(.5+(pointer.y-.5)*.06),R=Math.min(w,h)*.42;
const fingers=[...activeFingers.values()];
if(fingers.length){
 const avg=fingers.reduce((p,f)=>({x:p.x+f.x,y:p.y+f.y}),{x:0,y:0});
 cx=cx*.65+(avg.x/fingers.length)*.35;
 cy=cy*.65+(avg.y/fingers.length)*.35;
}
if(mode%6===4)drawKaleidoscope(t,cx,cy,R);
ctx.globalCompositeOperation='screen';
let density=Math.min(100,particles.length);
for(let i=0;i<density;i++){let p=particles[i],q=i/density,angle=p.a+phase*(.035+p.v*.06)*(mode%2?1:-1),rad=R*(.12+.83*p.x),x,y;
switch(mode%6){case 0:x=cx+Math.cos(angle+rad*.016)*rad;y=cy+Math.sin(angle+rad*.016)*rad*.6;break;
case 1:x=cx+Math.sin(angle*2+seed)*rad;y=cy+Math.cos(angle*3)*rad*.8;break;
case 2:x=cx+Math.cos(angle+phase*.1)*rad*(.7+.3*Math.sin(phase+p.y*12));y=cy+Math.sin(angle)*rad;break;
case 3:x=w*p.x+Math.sin(phase*.3+p.y*9)*28;y=h*((p.y+phase*.007*p.v)%1);break;
case 4:x=cx+Math.sin(angle*4)*rad*.8;y=cy+Math.cos(angle*4)*rad*.6;break;
default:x=cx+Math.cos(angle)*rad;y=cy+Math.sin(angle)*rad*.7;}
if(fingers.length){
 const f=fingers[i%fingers.length],dx=f.x-x,dy=f.y-y,dist=Math.hypot(dx,dy)||1;
 const attract=Math.max(0,1-dist/(R*.85));
 x+=dx*attract*.14;y+=dy*attract*.14;
}
let hue=(195+mode*17+q*130+phase*3)%360,alpha=.12+.18*(.5+.5*Math.sin(phase*.8+p.a));
ctx.beginPath();ctx.fillStyle='hsla('+hue+',95%,68%,'+alpha+')';ctx.arc(x,y,p.s*(1+.5*Math.sin(phase+p.a)),0,TAU);ctx.fill();
if(i%3===0){ctx.beginPath();ctx.strokeStyle='hsla('+hue+',95%,60%,'+(alpha*.55)+')';ctx.lineWidth=.7;ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(angle+seed)*rand(0,1)*18,y+Math.sin(angle+seed)*12);ctx.stroke();}
}
ctx.globalCompositeOperation='source-over';
drawFingers(t,w,h);
}
function start(){setup();if(on)return;on=true;activeFingers.clear();fingerEchoes.length=0;reset();kaleidoSince=0;nextChange=0;last=0;canvas.style.opacity='1';document.body.classList.add('ge-dream-active');raf=requestAnimationFrame(draw);}
function stop(){on=false;activeFingers.clear();fingerEchoes.length=0;cancelAnimationFrame(raf);if(canvas){canvas.style.opacity='0';setTimeout(()=>{if(!on&&ctx)ctx.clearRect(0,0,innerWidth,innerHeight)},2100)}document.body.classList.remove('ge-dream-active');}
window.GE_DREAM={start,stop,toggle:()=>on?stop():start(),get active(){return on},effects};
})();