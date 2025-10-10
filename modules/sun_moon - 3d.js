// modules/sun_moon.js
import { isMobile, setVars } from './core.js';

try {
  // --- Responsive size settings ---
  const SUN_SIZE = isMobile() ? 220 : 260;   // Blue sun
  const MOON_SIZE = isMobile() ? 90 : 110;   // Radio moon
  const ORBIT_RADIUS = isMobile() ? 160 : 200;

  // Apply as CSS variables
  setVars({
    '--sun-size': `${SUN_SIZE}px`,
    '--moon-size': `${MOON_SIZE}px`,
    '--orbit-radius': `${ORBIT_RADIUS}px`
  });

  // --- Select elements ---
  const sunWrap = document.getElementById('sunWrap');
  const orbit = document.getElementById('orbit');
  const moon = document.getElementById('moon');

  // --- 60s orbit animation ---
  const ORBIT_TIME = 60000;
  let start = performance.now();

  function animateOrbit(now) {
    const elapsed = (now - start) % ORBIT_TIME;
    const angle = (elapsed / ORBIT_TIME) * 2 * Math.PI;
    const radius = ORBIT_RADIUS;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    moon.style.transform = `translate(${x}px, ${y}px) rotate(${-angle}rad)`;
    moon.style.zIndex = y < 0 ? 1 : 10;

    requestAnimationFrame(animateOrbit);
  }
  requestAnimationFrame(animateOrbit);

  // --- Click to open radio ---
  moon.addEventListener('click', () => {
    window.open('https://grandelement.github.io/radio/', '_blank');
  });

  console.log('✅ sun_moon.js loaded successfully');
} catch (e) {
  console.error('❌ sun_moon.js failed', e);
}
