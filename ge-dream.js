/* GE DREAM: lightweight procedural visual layer; no external dependencies. */
(()=>{'use strict';
let canvas,ctx,on=false,raf=0,last=0,phase=0,seed=0,particles=[],pointer={x:.5,y:.5},nextChange=0,mode=0;
const TAU=Math.PI*2,rand=(a,b)=>a+Math.random()*(b-a);
const effects=['vortex','nebula','plasma','ripple','aurora','spiral','breathing','comet','kaleidoscope','halo','fractals','magnetism','rain','waves','smoke','prism','stardust','lattice','pulsar','orbit','liquid','lightning','tunnel','shimmer','flame','crystal','echo','bloom','filament','gravity'];
function setup(){if(canvas)return;canvas=document.createElement('canvas');canvas.id='geDreamCanvas';canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9;opacity:0;transition:opacity 2s ease';document.body.appendChild(canvas);ctx=canvas.getContext('2d',{alpha:true});resize();addEventListener('resize',resize,{passive:true});addEventListener('pointermove',e=>{pointer.x=e.clientX/innerWidth;pointer.y=e.clientY/innerHeight},{passive:true});}
function resize(){if(!canvas)return;let d=Math.min(devicePixelRatio||1,1.5),w=innerWidth,h=innerHeight;canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);}
function reset(){particles=Array.from({length:Math.min(100,Math.max(32,Math.floor(innerWidth/10)))},()=>({x:Math.random(),y:Math.random(),v:rand(.15,1.3),a:rand(0,TAU),s:rand(1,3)}));}
function draw(t){if(!on)return;raf=requestAnimationFrame(draw);if(t-last<32)return;let dt=Math.min(.07,(t-last)/1000||.03);last=t;phase+=dt;let w=innerWidth,h=innerHeight;ctx.clearRect(0,0,w,h);
if(t>nextChange){mode=(mode+1+Math.floor(rand(0,effects.length-1)))%effects.length;seed=rand(0,TAU);nextChange=t+rand(12000,42000);}
let cx=w*(.5+(pointer.x-.5)*.06),cy=h*(.5+(pointer.y-.5)*.06),R=Math.min(w,h)*.42;
ctx.globalCompositeOperation='screen';
let density=Math.min(100,particles.length);
for(let i=0;i<density;i++){let p=particles[i],q=i/density,angle=p.a+phase*(.035+p.v*.06)*(mode%2?1:-1),rad=R*(.12+.83*p.x),x,y;
switch(mode%6){case 0:x=cx+Math.cos(angle+rad*.016)*rad;y=cy+Math.sin(angle+rad*.016)*rad*.6;break;
case 1:x=cx+Math.sin(angle*2+seed)*rad;y=cy+Math.cos(angle*3)*rad*.8;break;
case 2:x=cx+Math.cos(angle+phase*.1)*rad*(.7+.3*Math.sin(phase+p.y*12));y=cy+Math.sin(angle)*rad;break;
case 3:x=w*p.x+Math.sin(phase*.3+p.y*9)*28;y=h*((p.y+phase*.007*p.v)%1);break;
case 4:x=cx+Math.sin(angle*4)*rad*.8;y=cy+Math.cos(angle*4)*rad*.6;break;
default:x=cx+Math.cos(angle)*rad;y=cy+Math.sin(angle)*rad*.7;}
let hue=(195+mode*17+q*130+phase*3)%360,alpha=.12+.18*(.5+.5*Math.sin(phase*.8+p.a));
ctx.beginPath();ctx.fillStyle='hsla('+hue+',95%,68%,'+alpha+')';ctx.arc(x,y,p.s*(1+.5*Math.sin(phase+p.a)),0,TAU);ctx.fill();
if(i%3===0){ctx.beginPath();ctx.strokeStyle='hsla('+hue+',95%,60%,'+(alpha*.55)+')';ctx.lineWidth=.7;ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(angle+seed)*rand(0,1)*18,y+Math.sin(angle+seed)*12);ctx.stroke();}
}
ctx.globalCompositeOperation='source-over';
}
function start(){setup();if(on)return;on=true;reset();nextChange=0;last=0;canvas.style.opacity='1';document.body.classList.add('ge-dream-active');raf=requestAnimationFrame(draw);}
function stop(){on=false;cancelAnimationFrame(raf);if(canvas){canvas.style.opacity='0';setTimeout(()=>{if(!on&&ctx)ctx.clearRect(0,0,innerWidth,innerHeight)},2100)}document.body.classList.remove('ge-dream-active');}
window.GE_DREAM={start,stop,toggle:()=>on?stop():start(),get active(){return on},effects};
})();