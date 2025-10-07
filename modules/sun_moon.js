const C = window.GE_CONFIG;
const sunWrap = document.getElementById('sunWrap');
const sun     = document.getElementById('sun');
const orbit   = document.getElementById('orbit');
const moon    = document.getElementById('moon');
const about   = document.getElementById('about');
const aboutBtn= document.getElementById('aboutBtn');

function applySizes(){
  const sunSize = innerWidth<820 ? C.sunMobile : C.sunDesktop;
  sunWrap.style.width = sunSize+'px'; sunWrap.style.height = sunSize+'px';
  document.documentElement.style.setProperty('--sun-size', sunSize);
  document.documentElement.style.setProperty('--moon-size', C.moonSize);
  document.documentElement.style.setProperty('--orbit-sec', C.moonSeconds);
  document.documentElement.style.setProperty('--orbit-radius',
    `calc((${sunSize}px * .5) + (${C.moonSize}px * ${C.moonDistanceFactor}))`);
}
applySizes(); addEventListener('resize',applySizes,{passive:true});

/* drag the sun */
let sDrag=false,sx=0,sy=0,ox=0,oy=0;
sun.addEventListener('pointerdown',e=>{
  const r=sunWrap.getBoundingClientRect(); sDrag=true; sun.classList.add('dragging');
  sx=e.clientX; sy=e.clientY; ox=r.left+r.width/2; oy=r.top+r.height/2; sun.setPointerCapture(e.pointerId);
});
sun.addEventListener('pointermove',e=>{
  if(!sDrag) return; const nx=ox+(e.clientX-sx), ny=oy+(e.clientY-sy);
  sunWrap.style.left=Math.max(100,Math.min(innerWidth-100,nx))+'px';
  sunWrap.style.top =Math.max(100,Math.min(innerHeight-100,ny))+'px';
});
sun.addEventListener('pointerup',()=>{sDrag=false; sun.classList.remove('dragging');});

/* moon orbit like a clock, logo upright */
const PHASE0 = -Math.PI/2, ORBIT = C.moonSeconds || 60;
requestAnimationFrame(function tick(){
  const t=performance.now()/1000, ang=PHASE0 + (t%ORBIT)/ORBIT*Math.PI*2;
  orbit.style.transform=`rotate(${ang}rad)`;
  moon.style.transform=`translate(var(--orbit-radius), -50%) rotate(${-ang}rad)`;
  orbit.style.zIndex=(ang%(Math.PI*2))>Math.PI?2:6;
  requestAnimationFrame(tick);
});
moon.addEventListener('click',()=>window.open(C.radioBase,'_blank','noopener'));

/* ABOUT modal */
aboutBtn.onclick=()=>about.classList.add('show');
about.addEventListener('click',e=>{ if(e.target.id==='about') about.classList.remove('show');});
addEventListener('keydown',e=>{ if(e.key==='Escape') about.classList.remove('show');});
