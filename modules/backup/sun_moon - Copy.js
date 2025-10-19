/* SUN + MOON — circular orbit, upright moon, draggable sun, hover/tap UI */
const $ = (sel, root=document) => root.querySelector(sel);

/* --- elements --- */
const sunWrap  = $('#sunWrap') || (()=>{ const d=document.createElement('div'); d.id='sunWrap'; d.className='sunWrap'; document.body.appendChild(d); return d; })();
const sun      = $('#sun')     || (()=>{ const d=document.createElement('div'); d.id='sun'; d.className='sun'; sunWrap.appendChild(d); return d; })();
const orbit    = $('#orbit')   || (()=>{ const d=document.createElement('div'); d.id='orbit'; d.className='orbit'; sunWrap.appendChild(d); return d; })();
const carrier  = $('.carrier', orbit) || (()=>{ const d=document.createElement('div'); d.className='carrier'; d.style.setProperty('--orbit-radius','0px'); orbit.appendChild(d); return d; })();
const moon     = $('#moon')    || (()=>{ const d=document.createElement('div'); d.id='moon'; d.className='moon'; carrier.appendChild(d); return d; })();

/* overlay buttons inside the sun */
let overlay = $('.sunOverlay', sun);
if(!overlay){
  overlay = document.createElement('div');
  overlay.className = 'sunOverlay';
  overlay.innerHTML = `
    <div class="sunAbout" id="aboutBtn">ABOUT</div>
    <div id="nowTitle" class="nowTitle">—</div>
    <button class="pill" id="musicBtn">Music Controls</button>
  `;
  sun.appendChild(overlay);
}
const aboutBtn = $('#aboutBtn');
const musicBtn = $('#musicBtn');
const nowTitle = $('#nowTitle');

/* show overlay only when hovering/tapping the sun */
const isTouch = matchMedia('(pointer:coarse)').matches;
let overlayPinned = false;
function showOverlay(on){ if(on || overlayPinned){ overlay.classList.add('show'); } else { overlay.classList.remove('show'); } }
if(!isTouch){
  sun.addEventListener('mouseenter', ()=>showOverlay(true));
  sun.addEventListener('mouseleave', ()=>showOverlay(false));
}else{
  sun.addEventListener('click', (e)=>{ overlayPinned = !overlayPinned; showOverlay(true); e.stopPropagation(); }, {passive:false});
  document.addEventListener('click', ()=>{ overlayPinned=false; showOverlay(false); }, {passive:true});
}

/* ---- DRAG SUN (keep pointer offset so it grabs from where you clicked) ---- */
let dragging=false, grabDX=0, grabDY=0;
function sunRect(){ return sunWrap.getBoundingClientRect(); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function placeSun(x,y){
  const r = sunRect();
  const w = r.width, h=r.height;
  const left = clamp(x - grabDX, 60, innerWidth - w - 60);
  const top  = clamp(y - grabDY, 60, innerHeight - h - 60);
  sunWrap.style.left = left+'px';
  sunWrap.style.top  = top +'px';
}
function onDown(e){
  dragging=true;
  const p = (e.touches? e.touches[0]: e);
  const r = sunRect();
  grabDX = p.clientX - r.left;
  grabDY = p.clientY - r.top;
  sunWrap.style.cursor='grabbing';
  e.preventDefault();
}
function onMove(e){
  if(!dragging) return;
  const p = (e.touches? e.touches[0]: e);
  placeSun(p.clientX, p.clientY);
}
function onUp(){
  dragging=false;
  sunWrap.style.cursor='';
}
sun.addEventListener('mousedown', onDown); window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
sun.addEventListener('touchstart', onDown, {passive:false}); window.addEventListener('touchmove', onMove, {passive:false}); window.addEventListener('touchend', onUp);

/* ---- MOON ORBIT: perfect circle, 60s period, upright, constant gap ---- */
const PERIOD = 60;               // seconds per full revolution
let t0 = performance.now()/1000; // start time
function computeRadius(){
  const s = sunRect();
  const m = moon.getBoundingClientRect();
  const sunR  = s.width/2;
  const moonR = m.width/2 || 55;
  const gap   = Math.max( moonR*0.5, sunR*0.25 );  // ~ “an inch” off edge, scales with size
  return sunR + gap + moonR;                       // center-to-center radius
}
function sunCenter(){
  const s = sunRect();
  return { cx: s.left + s.width/2, cy: s.top + s.height/2 };
}
function tick(){
  // angle = -90° at start so moon begins at the right side like a clock “3”
  const t = performance.now()/1000;
  const angle = (-Math.PI/2) + ((t - t0) * 2*Math.PI / PERIOD);
  const R = computeRadius();
  const {cx, cy} = sunCenter();

  // position
  const mx = cx + Math.cos(angle) * R;
  const my = cy + Math.sin(angle) * R;

  // place the moon element
  const w = moon.offsetWidth, h = moon.offsetHeight;
  moon.style.transform = `translate(${mx - w/2}px, ${my - h/2}px) rotate(${-angle}rad)`; // counter-rotate to keep text upright

  // go behind the sun on the back half
  const behind = ( (angle % (2*Math.PI)) > Math.PI );
  moon.style.zIndex = behind ? 3 : 7;

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---- Moon click → open Radio site in new tab ---- */
moon.addEventListener('click', (e)=>{
  window.open('https://grandelement.github.io/radio/', '_blank', 'noopener');
  e.stopPropagation();
});

/* ---- expose a tiny API used by the player to show the track title ---- */
export function setNowPlayingTitle(text){
  nowTitle.textContent = text || '—';
}
export const SunMoonAPI = { setNowPlayingTitle };
