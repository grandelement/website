// Grand Element — Sun ↔ Moon (clock-orbit, 60s, ~1in offset, draggable sun)
// Assumes the HTML structure contains #sunWrap (positioned), #sun (the blue sun),
// and #moon (radio logo). Works standalone; no other modules required.

(() => {
  const wrap = document.getElementById('sunWrap');
  const sun  = document.getElementById('sun');
  const moon = document.getElementById('moon');

  if (!wrap || !sun || !moon) {
    console.warn('[sun_moon] Required elements not found.');
    return;
  }

  // --- CONFIG ---
  const SECONDS_PER_REV = 60;     // 60s per full orbit
  const PIXEL_OFFSET    = 96;     // ≈ 1 inch extra beyond sun edge
  const KEEP_UPRIGHT    = true;   // counter-rotate the moon so text stays upright

  // --- helpers ---
  const now = () => performance.now() / 1000;
  let t0 = now();

  function getSunCenter() {
    // sun is inside wrap, and wrap is positioned via left/top.
    // We'll use the wrap's box to compute center in local coords.
    // Moon will be absolutely positioned INSIDE wrap.
    const rect = sun.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    // Center relative to wrap (wrap is the containing block)
    return { cx: w / 2, cy: h / 2, r: Math.min(w, h) / 2 };
  }

  // Ensure wrap is a positioning context for the orbit.
  wrap.style.position = 'absolute';
  sun.style.position  = 'absolute';
  sun.style.inset     = '0';
  // Make sure moon is absolutely positioned inside wrap.
  moon.style.position = 'absolute';
  moon.style.transformOrigin = '50% 50%';

  // We'll drive orbit by rotating an invisible carrier angle and placing the moon at:
  //   x = cx + cos(theta) * (sunR + PIXEL_OFFSET) - moonW/2
  //   y = cy + sin(theta) * (sunR + PIXEL_OFFSET) - moonH/2
  function placeMoon(theta) {
    const { cx, cy, r: sunR } = getSunCenter();
    const mRect = moon.getBoundingClientRect();
    const mW = mRect.width  || moon.offsetWidth  || 0;
    const mH = mRect.height || moon.offsetHeight || 0;

    const R = sunR + PIXEL_OFFSET;
    const x = cx + Math.cos(theta) * R - mW / 2;
    const y = cy + Math.sin(theta) * R - mH / 2;

    moon.style.left = `${x}px`;
    moon.style.top  = `${y}px`;

    if (KEEP_UPRIGHT) {
      // Counter-rotate so the face stays upright
      moon.style.rotate = `${-theta}rad`;
    }
  }

  // Animate
  function animate() {
    const elapsed = now() - t0;
    const theta = (elapsed / SECONDS_PER_REV) * Math.PI * 2; // 0..2π in 60s
    placeMoon(theta);
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  // --- Drag the sun (wrap) and keep moon orbiting relative to it ---
  let dragging = false;
  let grabDX = 0, grabDY = 0;

  // Improve drag on touch devices
  wrap.style.touchAction = 'none'; 

  function onDown(e) {
    dragging = true;
    const isTouch = e.touches && e.touches[0];
    const x = isTouch ? e.touches[0].clientX : e.clientX;
    const y = isTouch ? e.touches[0].clientY : e.clientY;

    const rect = wrap.getBoundingClientRect();
    grabDX = x - rect.left;
    grabDY = y - rect.top;

    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    const isTouch = e.touches && e.touches[0];
    const x = isTouch ? e.touches[0].clientX : e.clientX;
    const y = isTouch ? e.touches[0].clientY : e.clientY;

    // Position the wrap so its top-left keeps our grab point under the cursor
    const newLeft = x - grabDX;
    const newTop  = y - grabDY;

    wrap.style.left = `${newLeft}px`;
    wrap.style.top  = `${newTop}px`;
  }
  function onUp() {
    dragging = false;
  }

  wrap.addEventListener('pointerdown', onDown, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });

  // Make sure the moon renders above the starfield but below overlays
  moon.style.zIndex = '6';
})();
