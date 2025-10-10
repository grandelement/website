// modules/sun_moon.js
import { isMobile, setVars } from './core.js';

const SUN_PX   = isMobile() ? 220 : 260;   // make the sun a touch smaller
const MOON_PX  = isMobile() ? 90  : 110;
const ORBIT_S  = 60_000;                   // 60s full revolution
const RATIO    = 3.5;                      // “3.5 times itself from the center of the sun”
let   ORBIT_R  = Math.round(MOON_PX * RATIO);

setVars({
  '--sun-size':  `${SUN_PX}px`,
  '--moon-size': `${MOON_PX}px`
});

const sunWrap = document.getElementById('sunWrap');   // positioned box for the sun
const moon    = document.getElementById('moon');

let orbitCenter = { x: 0, y: 0 };   // screen-space center of the sun
let startT = performance.now();

// compute sun center in screen space
function updateOrbitCenter(){
  const r = sunWrap.getBoundingClientRect();
  orbitCenter.x = r.left + r.width  / 2;
  orbitCenter.y = r.top  + r.height / 2;
}
updateOrbitCenter();

// animate the orbit (clock-hand)
function tick(now){
  const t = (now - startT) % ORBIT_S;
  const a = (t / ORBIT_S) * Math.PI * 2; // 0..2π

  // counter-rotate the moon texture so text stays upright
  const counter = -a;

  // compute position around the sun center
  const x = orbitCenter.x + Math.cos(a) * ORBIT_R;
  const y = orbitCenter.y + Math.sin(a) * ORBIT_R;

  // place the moon with CSS transform
  moon.style.transform = `translate(${x}px, ${y}px) rotate(${counter}rad)`;

  // send behind the sun on the far side
  moon.style.zIndex = (Math.sin(a) < 0) ? 1 : 10;

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// click = open radio
moon.addEventListener('click', () => {
  window.open('https://grandelement.github.io/radio/', '_blank', 'noopener');
});

// ===== Drag the sun; moon re-locks automatically =====
let dragging = false, offsetX = 0, offsetY = 0;

sunWrap.style.cursor = 'grab';
sunWrap.addEventListener('pointerdown', (e)=>{
  dragging = true;
  sunWrap.setPointerCapture(e.pointerId);
  sunWrap.style.cursor = 'grabbing';
  const r = sunWrap.getBoundingClientRect();
  offsetX = e.clientX - r.left;
  offsetY = e.clientY - r.top;
});
window.addEventListener('pointermove', (e)=>{
  if(!dragging) return;
  const x = e.clientX - offsetX;
  const y = e.clientY - offsetY;
  sunWrap.style.left = x + 'px';
  sunWrap.style.top  = y + 'px';
  updateOrbitCenter();
});
window.addEventListener('pointerup', ()=>{
  dragging = false;
  sunWrap.style.cursor = 'grab';
});

// responsiveness
window.addEventListener('resize', updateOrbitCenter, {passive:true});
